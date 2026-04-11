// frontend/src/pages/projects/PlanningPage.js
// Real Gantt — tasks from /api/projects/:id/tasks/ — chef_projet can create/edit
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { projectsAPI } from '../../services/api';
import { usePermissions } from '../../context/PermissionsContext';
import AppLayout from '../../components/layout/AppLayout';
import toast from 'react-hot-toast';

const T = {
  card:'#FFFFFF', border:'#E8EDF2', text:'#1a1f2e', textSub:'#6B7280', textMuted:'#9CA3AF',
  orange:'#F97316', orangeLight:'rgba(249,115,22,0.1)',
  green:'#10B981', greenLight:'rgba(16,185,129,0.08)',
  red:'#EF4444', redLight:'rgba(239,68,68,0.08)',
  blue:'#3B82F6', yellow:'#F59E0B', purple:'#8B5CF6',
  shadow:'0 1px 3px rgba(0,0,0,0.07)',
};

const STATUS_CFG = {
  a_faire:   { label:'À faire',   color:'#6B7280', bg:'#F3F4F6' },
  en_cours:  { label:'En cours',  color:'#F97316', bg:'#FFF7ED' },
  termine:   { label:'Terminé',   color:'#10B981', bg:'#ECFDF5' },
  en_retard: { label:'En retard', color:'#EF4444', bg:'#FEF2F2' },
  suspendu:  { label:'Suspendu',  color:'#6366F1', bg:'#F0F0FF' },
};

const BAR_COLORS = ['#F97316','#3B82F6','#10B981','#8B5CF6','#F59E0B','#06B6D4','#EF4444','#EC4899'];

function Card({ children, style={}, p=24 }) {
  return <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:12, padding:p, boxShadow:T.shadow, ...style }}>{children}</div>;
}

function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.35)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
      <div style={{ background:'#fff', borderRadius:14, width:520, maxWidth:'95vw', maxHeight:'90vh', overflow:'auto', boxShadow:'0 20px 60px rgba(0,0,0,0.15)' }}>
        <div style={{ padding:'18px 24px 14px', borderBottom:`1px solid ${T.border}`, display:'flex', justifyContent:'space-between', alignItems:'center', position:'sticky', top:0, background:'#fff' }}>
          <h3 style={{ margin:0, fontSize:16, fontWeight:700, color:T.text }}>{title}</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:20, color:T.textMuted, cursor:'pointer' }}>×</button>
        </div>
        <div style={{ padding:24 }}>{children}</div>
      </div>
    </div>
  );
}

const inp = {
  width:'100%', padding:'9px 12px', borderRadius:8,
  border:`1px solid ${T.border}`, background:'#FAFAFA',
  fontSize:13, color:T.text, outline:'none', fontFamily:'inherit', boxSizing:'border-box',
};

function Field({ label, children }) {
  return (
    <div style={{ marginBottom:14 }}>
      <label style={{ display:'block', fontSize:11, fontWeight:600, color:T.textSub, marginBottom:5, textTransform:'uppercase', letterSpacing:'0.4px' }}>{label}</label>
      {children}
    </div>
  );
}

// ── Gantt bar renderer ────────────────────────────────────────────────────────
function GanttRow({ task, projectStart, totalDays, color, onEdit, canEdit, level=0 }) {
  const taskStart = task.start_date ? new Date(task.start_date+'T00:00:00') : null;
  const taskEnd   = task.end_date   ? new Date(task.end_date  +'T00:00:00') : null;
  const projStart = projectStart ? new Date(projectStart+'T00:00:00') : new Date();

  let left = 0, width = 5;
  if (taskStart && taskEnd && totalDays > 0) {
    const startOffset = Math.max(0, (taskStart - projStart) / 86400000);
    const duration    = Math.max(1, (taskEnd - taskStart) / 86400000);
    left  = Math.min(100, (startOffset / totalDays) * 100);
    width = Math.min(100 - left, (duration / totalDays) * 100);
  }

  const sc = STATUS_CFG[task.status] || STATUS_CFG.a_faire;

  return (
    <>
      <div style={{ display:'grid', gridTemplateColumns:'220px 1fr 80px 100px', gap:0, borderBottom:`1px solid ${T.border}`, minHeight:42 }}>
        {/* Name */}
        <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 12px', paddingLeft:12+level*20 }}>
          <span style={{ fontSize:12, color:T.textMuted }}>{level>0?'└':'▸'}</span>
          <span style={{ fontSize:13, fontWeight:level>0?400:600, color:T.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{task.name}</span>
        </div>
        {/* Bar */}
        <div style={{ position:'relative', display:'flex', alignItems:'center', padding:'0 8px', background:task.status==='termine'?'#F9FFF9':'transparent' }}>
          <div style={{ position:'absolute', left:`${left}%`, width:`${Math.max(1,width)}%`, height:20, borderRadius:4, background:color, opacity:task.status==='termine'?0.5:0.85, minWidth:4 }}>
            {task.progress_pct>0&&<div style={{ height:'100%', width:`${task.progress_pct}%`, background:'rgba(0,0,0,0.2)', borderRadius:4 }}/>}
          </div>
          {/* Today marker */}
          <div style={{ position:'absolute', left:`${Math.min(100,Math.max(0,((new Date()-new Date(projectStart+'T00:00:00'))/86400000/totalDays)*100))}%`, width:2, height:'100%', background:'rgba(239,68,68,0.6)', pointerEvents:'none' }}/>
        </div>
        {/* Progress */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color:T.textSub }}>{task.progress_pct||0}%</div>
        {/* Status + actions */}
        <div style={{ display:'flex', alignItems:'center', gap:6, padding:'0 8px' }}>
          <span style={{ padding:'2px 7px', borderRadius:100, fontSize:10, fontWeight:600, color:sc.color, background:sc.bg, whiteSpace:'nowrap' }}>{sc.label}</span>
          {canEdit&&<button onClick={()=>onEdit(task)} style={{ background:'none', border:'none', fontSize:13, cursor:'pointer', color:T.textMuted, padding:'2px 4px' }}>✏️</button>}
        </div>
      </div>
      {task.subtasks?.map((s,i)=><GanttRow key={s.id} task={s} projectStart={projectStart} totalDays={totalDays} color={color} onEdit={onEdit} canEdit={canEdit} level={level+1}/>)}
    </>
  );
}

const emptyForm = { name:'', status:'a_faire', start_date:'', end_date:'', progress_pct:0, description:'' };

export default function PlanningPage() {
  const { id: projectId } = useParams();
  const navigate = useNavigate();
  const { role } = usePermissions();

  const [project, setProject] = useState(null);
  const [tasks, setTasks]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTask, setEditTask]   = useState(null);
  const [saving, setSaving]       = useState(false);
  const [form, setForm]           = useState(emptyForm);

  const canEdit = ['admin_entreprise','office_admin','chef_projet','app_owner'].includes(role);

  const load = useCallback(async () => {
    try {
      const [pRes, tRes] = await Promise.all([
        projectsAPI.get(projectId),
        projectsAPI.listTasks(projectId),
      ]);
      setProject(pRes.data);
      setTasks(tRes.data || []);
    } catch { toast.error('Erreur chargement'); }
    finally { setLoading(false); }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditTask(null); setForm(emptyForm); setModalOpen(true); };
  const openEdit   = (task) => {
    setEditTask(task);
    setForm({
      name: task.name, status: task.status,
      start_date: task.start_date||'', end_date: task.end_date||'',
      progress_pct: task.progress_pct||0, description: task.description||'',
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name) return toast.error('Nom requis');
    setSaving(true);
    try {
      const payload = { ...form, progress_pct: Number(form.progress_pct)||0 };
      if (!payload.start_date) delete payload.start_date;
      if (!payload.end_date)   delete payload.end_date;
      if (editTask) {
        await projectsAPI.updateTask(projectId, editTask.id, payload);
        toast.success('Tâche mise à jour');
      } else {
        await projectsAPI.createTask(projectId, payload);
        toast.success('Tâche créée');
      }
      setModalOpen(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    } finally { setSaving(false); }
  };

  const handleDelete = async (taskId) => {
    if (!window.confirm('Supprimer cette tâche ?')) return;
    try {
      await projectsAPI.deleteTask(projectId, taskId);
      toast.success('Tâche supprimée');
      load();
    } catch { toast.error('Erreur'); }
  };

  // Compute Gantt timeline
  const allDates = tasks.flatMap(t => [t.start_date, t.end_date].filter(Boolean));
  const projStart = project?.start_date || allDates[0] || new Date().toISOString().slice(0,10);
  const projEnd   = project?.end_date   || allDates[allDates.length-1] || '';
  const totalDays = projStart && projEnd
    ? Math.max(30, (new Date(projEnd+'T00:00:00') - new Date(projStart+'T00:00:00')) / 86400000)
    : 180;

  // Stats
  const done    = tasks.filter(t=>t.status==='termine').length;
  const delayed = tasks.filter(t=>t.is_delayed).length;
  const avgPct  = tasks.length ? Math.round(tasks.reduce((a,t)=>a+(t.progress_pct||0),0)/tasks.length) : 0;

  // Month ticks for Gantt header
  const monthTicks = [];
  if (projStart && totalDays > 0) {
    const start = new Date(projStart+'T00:00:00');
    for (let m = 0; m < 18; m++) {
      const d = new Date(start); d.setMonth(d.getMonth()+m);
      const offset = (d-start)/86400000;
      if (offset > totalDays) break;
      monthTicks.push({ label: d.toLocaleDateString('fr-FR',{month:'short',year:'2-digit'}), pct: (offset/totalDays)*100 });
    }
  }

  return (
    <AppLayout projectName={project?.name}>
      {/* Top bar */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'0 32px', height:60, background:'#fff', borderBottom:`1px solid ${T.border}`, position:'sticky', top:0, zIndex:10 }}>
        <div style={{ display:'flex', alignItems:'center', gap:16 }}>
          <button onClick={() => navigate(`/projects/${projectId}`)}
            style={{ background:'none', border:'none', color:T.textMuted, fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>← Projet</button>
          <h1 style={{ margin:0, fontSize:17, fontWeight:700, color:T.text }}>Planning / Gantt — {project?.name}</h1>
        </div>
        {canEdit && (
          <button onClick={openCreate}
            style={{ padding:'8px 20px', borderRadius:8, background:T.orange, color:'#fff', fontSize:13, fontWeight:600, border:'none', cursor:'pointer', fontFamily:'inherit' }}>
            + Nouvelle tâche
          </button>
        )}
      </div>

      <div style={{ padding:32 }}>
        {/* KPIs */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:24 }}>
          {[
            { label:'Total tâches',      value:tasks.length,  color:T.orange },
            { label:'Terminées',         value:done,          color:T.green  },
            { label:'En retard',         value:delayed,       color:delayed>0?T.red:T.textMuted, alert:delayed>0 },
            { label:'Avancement moyen',  value:`${avgPct}%`,  color:T.blue   },
          ].map((k,i)=>(
            <Card key={i} p={18}>
              <div style={{ fontSize:11, color:T.textSub, marginBottom:4, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.4px' }}>{k.label}</div>
              <div style={{ fontSize:28, fontWeight:800, color:k.alert?T.red:k.color, lineHeight:1 }}>{k.value}</div>
            </Card>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign:'center', padding:'60px 0', color:T.textMuted }}>
            <div style={{ width:32, height:32, border:`3px solid ${T.orange}`, borderTopColor:'transparent', borderRadius:'50%', animation:'spin 1s linear infinite', margin:'0 auto 12px' }}/>
            Chargement...
          </div>
        ) : tasks.length === 0 ? (
          <Card style={{ textAlign:'center', padding:'60px 24px' }}>
            <div style={{ fontSize:48, marginBottom:12 }}>📅</div>
            <div style={{ fontSize:15, fontWeight:600, color:T.text, marginBottom:8 }}>Aucune tâche planifiée</div>
            <div style={{ fontSize:13, color:T.textSub, marginBottom:20 }}>Créez les phases de votre projet pour visualiser le planning</div>
            {canEdit && (
              <button onClick={openCreate}
                style={{ padding:'9px 22px', borderRadius:8, background:T.orange, color:'#fff', fontSize:13, fontWeight:600, border:'none', cursor:'pointer', fontFamily:'inherit' }}>
                + Créer la première tâche
              </button>
            )}
          </Card>
        ) : (
          <Card p={0}>
            {/* Gantt header */}
            <div style={{ display:'grid', gridTemplateColumns:'220px 1fr 80px 100px', borderBottom:`2px solid ${T.border}`, background:'#FAFAFA' }}>
              <div style={{ padding:'10px 12px', fontSize:11, fontWeight:700, color:T.textMuted, textTransform:'uppercase', letterSpacing:'0.5px' }}>Phase / Tâche</div>
              <div style={{ position:'relative', padding:'10px 8px', overflow:'hidden' }}>
                {monthTicks.map((m,i) => (
                  <span key={i} style={{ position:'absolute', left:`${m.pct}%`, fontSize:10, color:T.textMuted, whiteSpace:'nowrap', transform:'translateX(-50%)', top:10 }}>{m.label}</span>
                ))}
                <div style={{ height:28 }}/>
              </div>
              <div style={{ padding:'10px 0', fontSize:11, fontWeight:700, color:T.textMuted, textTransform:'uppercase', letterSpacing:'0.5px', textAlign:'center' }}>Avanc.</div>
              <div style={{ padding:'10px 8px', fontSize:11, fontWeight:700, color:T.textMuted, textTransform:'uppercase', letterSpacing:'0.5px' }}>Statut</div>
            </div>

            {/* Task rows */}
            {tasks.map((task, i) => (
              <GanttRow
                key={task.id}
                task={task}
                projectStart={projStart}
                totalDays={totalDays}
                color={BAR_COLORS[i % BAR_COLORS.length]}
                onEdit={openEdit}
                canEdit={canEdit}
              />
            ))}

            {/* Legend */}
            <div style={{ padding:'12px 16px', background:'#FAFAFA', borderTop:`1px solid ${T.border}`, display:'flex', gap:20, alignItems:'center' }}>
              <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, color:T.textMuted }}>
                <div style={{ width:20, height:3, background:T.red, opacity:0.6 }}/> Aujourd'hui
              </div>
              {Object.entries(STATUS_CFG).map(([k,v])=>(
                <div key={k} style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, color:T.textMuted }}>
                  <div style={{ width:8, height:8, borderRadius:'50%', background:v.color }}/>{v.label}
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Task list table below Gantt */}
        {tasks.length > 0 && (
          <Card style={{ marginTop:20 }} p={0}>
            <div style={{ padding:'14px 20px', borderBottom:`1px solid ${T.border}`, fontSize:14, fontWeight:700, color:T.text }}>
              📋 Détail des tâches
            </div>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr>{['Tâche','Début','Fin','Avancement','Statut',''].map(h=>(
                  <th key={h} style={{ textAlign:'left', padding:'10px 14px', fontSize:11, color:T.textMuted, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.4px', borderBottom:`1px solid ${T.border}`, background:'#FAFAFA' }}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {tasks.map(t=>{
                  const sc = STATUS_CFG[t.status]||STATUS_CFG.a_faire;
                  return (
                    <tr key={t.id} style={{ borderBottom:`1px solid ${T.border}` }}
                      onMouseEnter={e=>e.currentTarget.style.background='#FAFAFA'}
                      onMouseLeave={e=>e.currentTarget.style.background=''}>
                      <td style={{ padding:'12px 14px', fontSize:13, fontWeight:600, color:T.text }}>
                        {t.name}
                        {t.is_delayed&&<span style={{ marginLeft:8, fontSize:10, color:T.red, fontWeight:700 }}>⚠ RETARD</span>}
                      </td>
                      <td style={{ padding:'12px 14px', fontSize:12, color:T.textSub }}>{t.start_date||'—'}</td>
                      <td style={{ padding:'12px 14px', fontSize:12, color:t.is_delayed?T.red:T.textSub }}>{t.end_date||'—'}</td>
                      <td style={{ padding:'12px 14px', width:120 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <div style={{ flex:1, height:6, background:T.border, borderRadius:3, overflow:'hidden' }}>
                            <div style={{ height:'100%', width:`${t.progress_pct||0}%`, background:T.orange, borderRadius:3 }}/>
                          </div>
                          <span style={{ fontSize:12, fontWeight:700, color:T.textSub, minWidth:28 }}>{t.progress_pct||0}%</span>
                        </div>
                      </td>
                      <td style={{ padding:'12px 14px' }}>
                        <span style={{ padding:'3px 9px', borderRadius:100, fontSize:11, fontWeight:600, color:sc.color, background:sc.bg }}>{sc.label}</span>
                      </td>
                      <td style={{ padding:'12px 14px' }}>
                        {canEdit&&(
                          <div style={{ display:'flex', gap:6 }}>
                            <button onClick={()=>openEdit(t)}
                              style={{ padding:'4px 10px', borderRadius:6, border:`1px solid ${T.border}`, background:'#fff', color:T.textSub, fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>✏️</button>
                            <button onClick={()=>handleDelete(t.id)}
                              style={{ padding:'4px 10px', borderRadius:6, border:`1px solid ${T.red}30`, background:T.redLight, color:T.red, fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>🗑</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        )}
      </div>

      {/* Task form modal */}
      <Modal open={modalOpen} onClose={()=>setModalOpen(false)} title={editTask?'Modifier la tâche':'Nouvelle tâche'}>
        <Field label="Nom de la tâche *">
          <input style={inp} value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="ex: Phase 3 — Gros œuvre R+2"/>
        </Field>
        <Field label="Statut">
          <select style={inp} value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))}>
            {Object.entries(STATUS_CFG).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
          </select>
        </Field>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <Field label="Date début">
            <input style={inp} type="date" value={form.start_date} onChange={e=>setForm(f=>({...f,start_date:e.target.value}))}/>
          </Field>
          <Field label="Date fin">
            <input style={inp} type="date" value={form.end_date} onChange={e=>setForm(f=>({...f,end_date:e.target.value}))}/>
          </Field>
        </div>
        <Field label={`Avancement (${form.progress_pct}%)`}>
          <input style={inp} type="range" min="0" max="100" value={form.progress_pct} onChange={e=>setForm(f=>({...f,progress_pct:Number(e.target.value)}))}/>
          <div style={{ height:6, background:T.border, borderRadius:3, marginTop:6, overflow:'hidden' }}>
            <div style={{ height:'100%', width:`${form.progress_pct}%`, background:T.orange, borderRadius:3 }}/>
          </div>
        </Field>
        <Field label="Description">
          <textarea style={{...inp,minHeight:70,resize:'vertical'}} value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} placeholder="Détails de cette phase..."/>
        </Field>
        <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:8 }}>
          <button onClick={()=>setModalOpen(false)}
            style={{ padding:'9px 20px', borderRadius:8, border:`1px solid ${T.border}`, background:'#fff', color:T.textSub, fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>
            Annuler
          </button>
          <button onClick={handleSave} disabled={saving}
            style={{ padding:'9px 20px', borderRadius:8, background:T.orange, color:'#fff', fontSize:13, fontWeight:600, border:'none', cursor:'pointer', fontFamily:'inherit' }}>
            {saving?'Sauvegarde...':editTask?'Mettre à jour':'Créer'}
          </button>
        </div>
      </Modal>
    </AppLayout>
  );
}