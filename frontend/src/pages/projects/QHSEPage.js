// frontend/src/pages/projects/QHSEPage.js
// Real incidents from /api/projects/:id/reports/:rid/incidents/
// Checklists are local (no backend model yet) — saved in state
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { projectsAPI } from '../../services/api';
import { usePermissions } from '../../context/PermissionsContext';
import AppLayout from '../../components/layout/AppLayout';
import toast from 'react-hot-toast';

const T = {
  card:'#FFFFFF', border:'#E8EDF2', text:'#1a1f2e', textSub:'#6B7280', textMuted:'#9CA3AF',
  orange:'#F97316', orangeLight:'rgba(249,115,22,0.1)',
  green:'#10B981', greenLight:'rgba(16,185,129,0.08)',
  red:'#EF4444', redLight:'rgba(239,68,68,0.08)',
  blue:'#3B82F6', yellow:'#F59E0B', shadow:'0 1px 3px rgba(0,0,0,0.07)',
};

const SEVERITY_CFG = {
  faible:   { label:'Faible',    color:'#10B981', bg:'#ECFDF5' },
  moyen:    { label:'Moyen',     color:'#F59E0B', bg:'#FFFBEB' },
  eleve:    { label:'Élevé',     color:'#F97316', bg:'#FFF7ED' },
  critique: { label:'Critique',  color:'#EF4444', bg:'#FEF2F2' },
};

const TYPE_CFG = {
  intemperie: { label:'Intempérie',       icon:'🌧️' },
  panne:      { label:'Panne machine',    icon:'⚙️' },
  accident:   { label:'Accident travail', icon:'🚨' },
  retard:     { label:'Retard livraison', icon:'📦' },
  securite:   { label:'Sécurité',         icon:'🛡️' },
  autre:      { label:'Autre',            icon:'⚠️' },
};

// Checklist items — static template (extend as needed)
const CHECKLIST_ITEMS = [
  { id:'epi',        label:'EPI — équipement complet (casque, gilet, chaussures)',  category:'Sécurité' },
  { id:'balisage',   label:'Balisage zone active en place',                          category:'Sécurité' },
  { id:'engins',     label:'Vérification état engins et véhicules',                 category:'Matériel' },
  { id:'prodchim',   label:'Stockage produits chimiques conforme',                  category:'Produits' },
  { id:'evacuation', label:'Évacuation eau de pluie opérationnelle',                category:'Chantier' },
  { id:'signalis',   label:'Signalisation temporaire conforme',                     category:'Sécurité' },
  { id:'premiers',   label:'Trousse de premiers secours accessible',                category:'Sécurité' },
  { id:'extincteur', label:'Extincteurs vérifiés et accessibles',                   category:'Sécurité' },
  { id:'electricite',label:'Installations électriques conformes',                  category:'Électricité' },
  { id:'echafaud',   label:'Échafaudages et protections anti-chutes',               category:'Hauteur' },
];

function Card({ children, style={}, p=24 }) {
  return <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:12, padding:p, boxShadow:T.shadow, ...style }}>{children}</div>;
}

function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.35)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
      <div style={{ background:'#fff', borderRadius:14, width:500, maxWidth:'95vw', maxHeight:'90vh', overflow:'auto', boxShadow:'0 20px 60px rgba(0,0,0,0.15)' }}>
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

export default function QHSEPage() {
  const { id: projectId } = useParams();
  const navigate = useNavigate();
  const { role } = usePermissions();

  const [project, setProject]   = useState(null);
  const [reports, setReports]   = useState([]);
  const [incidents, setIncidents] = useState([]); // flat list across all reports
  const [loading, setLoading]   = useState(true);
  const [activeTab, setActiveTab] = useState('incidents');
  const [checklist, setChecklist] = useState(
    () => Object.fromEntries(CHECKLIST_ITEMS.map(i=>[i.id, null])) // null=not checked, true=ok, false=nok
  );
  const [incidentModal, setIncidentModal] = useState(false);
  const [resolveModal, setResolveModal]   = useState(null);
  const [saving, setSaving]     = useState(false);
  const [incForm, setIncForm]   = useState({ type:'securite', severity:'moyen', description:'', impact:'', report_id:'' });

  const canWrite = ['admin_entreprise','office_admin','chef_chantier','qhse','chef_projet','app_owner'].includes(role);

  const load = useCallback(async () => {
    try {
      const [pRes, rRes] = await Promise.all([
        projectsAPI.get(projectId),
        projectsAPI.listReports(projectId),
      ]);
      setProject(pRes.data);
      const reps = rRes.data || [];
      setReports(reps);
      // Collect all incidents from all reports
      const allInc = reps.flatMap(r => (r.incidents||[]).map(inc => ({
        ...inc,
        report_date: r.report_date,
        report_id: r.id,
        project_name: pRes.data.name,
      })));
      setIncidents(allInc);
    } catch { toast.error('Erreur chargement'); }
    finally { setLoading(false); }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const handleAddIncident = async () => {
    if (!incForm.description) return toast.error('Description requise');
    if (!incForm.report_id)   return toast.error('Sélectionnez un rapport journalier');
    setSaving(true);
    try {
      await projectsAPI.createIncident(projectId, incForm.report_id, {
        type: incForm.type,
        severity: incForm.severity,
        description: incForm.description,
        impact: incForm.impact,
      });
      toast.success('Incident signalé');
      setIncidentModal(false);
      load();
    } catch { toast.error('Erreur lors du signalement'); }
    finally { setSaving(false); }
  };

  const handleResolve = async (incident) => {
    setSaving(true);
    try {
      await projectsAPI.updateIncident(projectId, incident.report_id, incident.id, { resolved: true });
      toast.success('Incident marqué comme résolu');
      setResolveModal(null);
      load();
    } catch { toast.error('Erreur'); }
    finally { setSaving(false); }
  };

  // Stats
  const total    = incidents.length;
  const open_i   = incidents.filter(i=>!i.resolved).length;
  const critical = incidents.filter(i=>i.severity==='critique'&&!i.resolved).length;
  const resolved = incidents.filter(i=>i.resolved).length;

  const checkOk  = Object.values(checklist).filter(v=>v===true).length;
  const checkNok = Object.values(checklist).filter(v=>v===false).length;
  const checkScore = CHECKLIST_ITEMS.length>0 ? Math.round((checkOk/CHECKLIST_ITEMS.length)*100) : 0;

  const TABS = [
    { id:'incidents',  label:`⚠️ Incidents (${total})` },
    { id:'checklist',  label:`✅ Checklist sécurité` },
    { id:'reserves',   label:'🔓 Levée de réserves' },
  ];

  return (
    <AppLayout projectName={project?.name}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'0 32px', height:60, background:'#fff', borderBottom:`1px solid ${T.border}`, position:'sticky', top:0, zIndex:10 }}>
        <div style={{ display:'flex', alignItems:'center', gap:16 }}>
          <button onClick={()=>navigate(`/projects/${projectId}`)}
            style={{ background:'none', border:'none', color:T.textMuted, fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>← Projet</button>
          <h1 style={{ margin:0, fontSize:17, fontWeight:700, color:T.text }}>QHSE — {project?.name}</h1>
        </div>
        {canWrite && (
          <button onClick={()=>{ setIncForm({type:'securite',severity:'moyen',description:'',impact:'',report_id:reports[0]?.id||''}); setIncidentModal(true); }}
            style={{ padding:'8px 20px', borderRadius:8, background:T.red, color:'#fff', fontSize:13, fontWeight:600, border:'none', cursor:'pointer', fontFamily:'inherit' }}>
            + Signaler un incident
          </button>
        )}
      </div>

      <div style={{ padding:32 }}>
        {/* KPIs */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:24 }}>
          {[
            { label:'Total incidents',    value:total,    color:T.textSub },
            { label:'Ouverts',            value:open_i,   color:open_i>0?T.orange:T.green, alert:open_i>3 },
            { label:'Critiques',          value:critical, color:critical>0?T.red:T.green,  alert:critical>0 },
            { label:'Score checklist',    value:`${checkScore}%`, color:checkScore>=80?T.green:checkScore>=50?T.yellow:T.red },
          ].map((k,i)=>(
            <Card key={i} p={18}>
              <div style={{ fontSize:11, color:T.textSub, marginBottom:4, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.4px' }}>{k.label}</div>
              <div style={{ fontSize:28, fontWeight:800, color:k.alert?T.red:k.color, lineHeight:1 }}>{k.value}</div>
            </Card>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', borderBottom:`1px solid ${T.border}`, marginBottom:24 }}>
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setActiveTab(t.id)}
              style={{ padding:'10px 18px', fontSize:13, fontWeight:600, cursor:'pointer', background:'none', border:'none', outline:'none', fontFamily:'inherit', color:activeTab===t.id?T.orange:T.textSub, borderBottom:`2px solid ${activeTab===t.id?T.orange:'transparent'}`, marginBottom:-1 }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Incidents tab */}
        {activeTab === 'incidents' && (
          loading ? <div style={{ textAlign:'center', padding:'40px 0', color:T.textMuted }}>Chargement...</div> :
          incidents.length === 0 ? (
            <Card style={{ textAlign:'center', padding:'60px 24px' }}>
              <div style={{ fontSize:40, marginBottom:12 }}>✅</div>
              <div style={{ fontSize:14, color:T.textSub }}>Aucun incident signalé — chantier sûr !</div>
            </Card>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {incidents.map(inc=>{
                const sc = SEVERITY_CFG[inc.severity]||SEVERITY_CFG.moyen;
                const tc = TYPE_CFG[inc.type]||TYPE_CFG.autre;
                return (
                  <Card key={inc.id} p={0}>
                    <div style={{ padding:'14px 20px', display:'flex', alignItems:'flex-start', gap:14 }}>
                      <div style={{ width:44, height:44, borderRadius:10, background:`${sc.color}15`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, flexShrink:0 }}>
                        {tc.icon}
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6, flexWrap:'wrap' }}>
                          <span style={{ fontSize:13, fontWeight:700, color:T.text }}>{tc.label}</span>
                          <span style={{ padding:'2px 9px', borderRadius:100, fontSize:11, fontWeight:600, color:sc.color, background:sc.bg }}>{sc.label}</span>
                          {inc.resolved
                            ? <span style={{ padding:'2px 9px', borderRadius:100, fontSize:11, fontWeight:600, color:T.green, background:T.greenLight }}>✅ Résolu</span>
                            : <span style={{ padding:'2px 9px', borderRadius:100, fontSize:11, fontWeight:600, color:T.orange, background:T.orangeLight }}>⏳ Ouvert</span>
                          }
                          <span style={{ fontSize:11, color:T.textMuted }}>Rapport du {inc.report_date}</span>
                        </div>
                        <div style={{ fontSize:13, color:T.text, marginBottom:4 }}>{inc.description}</div>
                        {inc.impact && <div style={{ fontSize:12, color:T.textSub }}>Impact: {inc.impact}</div>}
                      </div>
                      <div style={{ display:'flex', flexDirection:'column', gap:6, flexShrink:0 }}>
                        <Link to={`/projects/${projectId}/reports/${inc.report_id}`}
                          style={{ padding:'5px 12px', borderRadius:6, border:`1px solid ${T.border}`, background:'#fff', color:T.textSub, fontSize:11, textDecoration:'none' }}>
                          Voir rapport
                        </Link>
                        {canWrite && !inc.resolved && (
                          <button onClick={()=>setResolveModal(inc)}
                            style={{ padding:'5px 12px', borderRadius:6, background:T.greenLight, color:T.green, border:`1px solid ${T.green}30`, fontSize:11, cursor:'pointer', fontFamily:'inherit', fontWeight:600 }}>
                            Marquer résolu
                          </button>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )
        )}

        {/* Checklist tab */}
        {activeTab === 'checklist' && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
            <Card>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
                <div style={{ fontSize:14, fontWeight:700, color:T.text }}>✅ Checklist sécurité chantier</div>
                <div style={{ fontSize:13, fontWeight:700, color:checkScore>=80?T.green:T.orange }}>Score: {checkScore}%</div>
              </div>
              {CHECKLIST_ITEMS.map(item=>{
                const val = checklist[item.id];
                return (
                  <div key={item.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 0', borderBottom:`1px solid ${T.border}` }}>
                    <div style={{ display:'flex', gap:6 }}>
                      <button
                        onClick={()=>canWrite&&setChecklist(c=>({...c,[item.id]:true}))}
                        style={{ width:32, height:32, borderRadius:6, border:`2px solid ${val===true?T.green:T.border}`, background:val===true?T.greenLight:'#fff', color:val===true?T.green:T.textMuted, fontSize:14, cursor:canWrite?'pointer':'default', display:'flex', alignItems:'center', justifyContent:'center' }}>
                        ✓
                      </button>
                      <button
                        onClick={()=>canWrite&&setChecklist(c=>({...c,[item.id]:false}))}
                        style={{ width:32, height:32, borderRadius:6, border:`2px solid ${val===false?T.red:T.border}`, background:val===false?T.redLight:'#fff', color:val===false?T.red:T.textMuted, fontSize:14, cursor:canWrite?'pointer':'default', display:'flex', alignItems:'center', justifyContent:'center' }}>
                        ✕
                      </button>
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13, color:T.text, marginBottom:2 }}>{item.label}</div>
                      <div style={{ fontSize:10, color:T.textMuted, textTransform:'uppercase', letterSpacing:'0.4px' }}>{item.category}</div>
                    </div>
                    {val===null&&<span style={{ fontSize:11, color:T.textMuted }}>Non vérifié</span>}
                  </div>
                );
              })}
            </Card>
            <Card>
              <div style={{ fontSize:14, fontWeight:700, color:T.text, marginBottom:16 }}>📊 Résumé de la checklist</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginBottom:20 }}>
                {[
                  { label:'Conformes',     value:checkOk,                                   color:T.green },
                  { label:'Non conformes', value:checkNok,                                  color:T.red   },
                  { label:'Non vérifiés',  value:CHECKLIST_ITEMS.length-checkOk-checkNok,  color:T.textMuted },
                ].map((k,i)=>(
                  <div key={i} style={{ textAlign:'center', padding:'12px 0', borderRadius:10, background:'#F9FAFB', border:`1px solid ${T.border}` }}>
                    <div style={{ fontSize:24, fontWeight:800, color:k.color }}>{k.value}</div>
                    <div style={{ fontSize:11, color:T.textMuted, marginTop:2 }}>{k.label}</div>
                  </div>
                ))}
              </div>
              {/* Progress ring */}
              <div style={{ display:'flex', alignItems:'center', justifyContent:'center', padding:'20px 0' }}>
                <div style={{ position:'relative', display:'inline-flex' }}>
                  {(() => {
                    const r=50, C=2*Math.PI*r, offset=C-(checkScore/100)*C;
                    return (
                      <svg width={120} height={120}>
                        <circle cx={60} cy={60} r={r} fill="none" stroke={T.border} strokeWidth={10}/>
                        <circle cx={60} cy={60} r={r} fill="none" stroke={checkScore>=80?T.green:T.orange} strokeWidth={10}
                          strokeDasharray={C} strokeDashoffset={offset} strokeLinecap="round" transform="rotate(-90 60 60)"/>
                      </svg>
                    );
                  })()}
                  <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
                    <div style={{ fontSize:22, fontWeight:800, color:checkScore>=80?T.green:T.orange }}>{checkScore}%</div>
                    <div style={{ fontSize:10, color:T.textMuted }}>Score</div>
                  </div>
                </div>
              </div>
              {checkNok > 0 && (
                <div style={{ padding:'10px 14px', background:T.redLight, borderRadius:8, fontSize:12, color:T.red, fontWeight:500 }}>
                  ⚠️ {checkNok} point{checkNok>1?'s':''} non conforme{checkNok>1?'s':''} — action corrective requise
                </div>
              )}
            </Card>
          </div>
        )}

        {/* Reserves tab */}
        {activeTab === 'reserves' && (
          <Card>
            <div style={{ fontSize:14, fontWeight:700, color:T.text, marginBottom:20 }}>🔓 Levée de réserves</div>
            {incidents.filter(i=>i.severity==='eleve'||i.severity==='critique').length===0 ? (
              <div style={{ textAlign:'center', padding:'40px 0', color:T.textMuted }}>
                <div style={{ fontSize:36, marginBottom:12 }}>✅</div>
                <div>Aucune réserve ouverte — excellent !</div>
              </div>
            ) : (
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr>{['Type','Description','Gravité','Rapport','Statut','Action'].map(h=>(
                    <th key={h} style={{ textAlign:'left', padding:'10px 14px', fontSize:11, color:T.textMuted, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.4px', borderBottom:`1px solid ${T.border}`, background:'#FAFAFA' }}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {incidents.filter(i=>i.severity==='eleve'||i.severity==='critique').map(inc=>{
                    const sc = SEVERITY_CFG[inc.severity]||SEVERITY_CFG.moyen;
                    const tc = TYPE_CFG[inc.type]||TYPE_CFG.autre;
                    return (
                      <tr key={inc.id} style={{ borderBottom:`1px solid ${T.border}` }}>
                        <td style={{ padding:'11px 14px' }}><span style={{ fontSize:16 }}>{tc.icon}</span> <span style={{ fontSize:12, color:T.textSub }}>{tc.label}</span></td>
                        <td style={{ padding:'11px 14px', fontSize:13, color:T.text, maxWidth:280 }}>{inc.description.slice(0,80)}{inc.description.length>80?'...':''}</td>
                        <td style={{ padding:'11px 14px' }}><span style={{ padding:'3px 9px', borderRadius:100, fontSize:11, fontWeight:600, color:sc.color, background:sc.bg }}>{sc.label}</span></td>
                        <td style={{ padding:'11px 14px', fontSize:12, color:T.textSub }}>{inc.report_date}</td>
                        <td style={{ padding:'11px 14px' }}>
                          {inc.resolved
                            ? <span style={{ padding:'3px 9px', borderRadius:100, fontSize:11, fontWeight:600, color:T.green, background:T.greenLight }}>Levée ✓</span>
                            : <span style={{ padding:'3px 9px', borderRadius:100, fontSize:11, fontWeight:600, color:T.red, background:T.redLight }}>Ouverte</span>
                          }
                        </td>
                        <td style={{ padding:'11px 14px' }}>
                          {canWrite && !inc.resolved && (
                            <button onClick={()=>handleResolve(inc)}
                              style={{ padding:'5px 12px', borderRadius:6, background:T.greenLight, color:T.green, border:`1px solid ${T.green}30`, fontSize:11, cursor:'pointer', fontFamily:'inherit', fontWeight:600 }}>
                              ✓ Lever
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </Card>
        )}
      </div>

      {/* Add incident modal */}
      <Modal open={incidentModal} onClose={()=>setIncidentModal(false)} title="Signaler un incident">
        <Field label="Rapport journalier associé *">
          <select style={inp} value={incForm.report_id} onChange={e=>setIncForm(f=>({...f,report_id:e.target.value}))}>
            <option value="">— Sélectionner un rapport —</option>
            {reports.map(r=><option key={r.id} value={r.id}>Rapport du {r.report_date}</option>)}
          </select>
          {reports.length===0&&<div style={{ fontSize:11, color:T.red, marginTop:4 }}>Aucun rapport disponible — créez d'abord un journal de chantier</div>}
        </Field>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <Field label="Type *">
            <select style={inp} value={incForm.type} onChange={e=>setIncForm(f=>({...f,type:e.target.value}))}>
              {Object.entries(TYPE_CFG).map(([k,v])=><option key={k} value={k}>{v.icon} {v.label}</option>)}
            </select>
          </Field>
          <Field label="Gravité *">
            <select style={inp} value={incForm.severity} onChange={e=>setIncForm(f=>({...f,severity:e.target.value}))}>
              {Object.entries(SEVERITY_CFG).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Description *">
          <textarea style={{...inp,minHeight:90,resize:'vertical'}} value={incForm.description} onChange={e=>setIncForm(f=>({...f,description:e.target.value}))} placeholder="Décrivez précisément l'incident..."/>
        </Field>
        <Field label="Impact / Conséquences">
          <textarea style={{...inp,minHeight:60,resize:'vertical'}} value={incForm.impact} onChange={e=>setIncForm(f=>({...f,impact:e.target.value}))} placeholder="Retard, arrêt chantier, blessure..."/>
        </Field>
        <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:8 }}>
          <button onClick={()=>setIncidentModal(false)} style={{ padding:'9px 20px', borderRadius:8, border:`1px solid ${T.border}`, background:'#fff', color:T.textSub, fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>Annuler</button>
          <button onClick={handleAddIncident} disabled={saving} style={{ padding:'9px 20px', borderRadius:8, background:T.red, color:'#fff', fontSize:13, fontWeight:600, border:'none', cursor:'pointer', fontFamily:'inherit' }}>
            {saving?'Signalement...':'⚠️ Signaler'}
          </button>
        </div>
      </Modal>

      {/* Resolve confirmation modal */}
      <Modal open={!!resolveModal} onClose={()=>setResolveModal(null)} title="Confirmer la levée">
        {resolveModal && (
          <div>
            <p style={{ fontSize:14, color:T.text, marginBottom:20 }}>
              Marquer cet incident comme résolu ?<br/>
              <strong>{resolveModal.description.slice(0,100)}</strong>
            </p>
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
              <button onClick={()=>setResolveModal(null)} style={{ padding:'9px 20px', borderRadius:8, border:`1px solid ${T.border}`, background:'#fff', color:T.textSub, fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>Annuler</button>
              <button onClick={()=>handleResolve(resolveModal)} disabled={saving} style={{ padding:'9px 20px', borderRadius:8, background:T.green, color:'#fff', fontSize:13, fontWeight:600, border:'none', cursor:'pointer', fontFamily:'inherit' }}>
                {saving?'...':'✅ Marquer résolu'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </AppLayout>
  );
}