// frontend/src/pages/reports/RapportsPage.js
// Consolidated rapports — all daily reports across all accessible projects
import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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

const WEATHER_ICONS = { ensoleille:'☀️', nuageux:'☁️', pluvieux:'🌧️', venteux:'💨', orageux:'⛈️' };

function Card({ children, style={}, p=24 }) {
  return <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:12, padding:p, boxShadow:T.shadow, ...style }}>{children}</div>;
}

function Pbar({ pct, color=T.orange, h=6 }) {
  return (
    <div style={{ height:h, background:T.border, borderRadius:h, overflow:'hidden' }}>
      <div style={{ height:'100%', width:`${Math.min(100,pct||0)}%`, background:color, borderRadius:h, transition:'width 0.6s' }}/>
    </div>
  );
}

export default function RapportsPage() {
  const navigate = useNavigate();
  const { role } = usePermissions();

  const [projects, setProjects] = useState([]);
  const [allReports, setAllReports] = useState([]); // [{...report, project_name, project_id}]
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [filterProject, setFilterProject] = useState('');
  const [filterValidated, setFilterValidated] = useState('');
  const [activeTab, setActiveTab] = useState('list');

  const load = useCallback(async () => {
    try {
      const pRes = await projectsAPI.list();
      const prjs = pRes.data || [];
      setProjects(prjs);
      // Load reports for each project in parallel
      const reportArrays = await Promise.all(
        prjs.map(p =>
          projectsAPI.listReports(p.id)
            .then(r => (r.data||[]).map(rep => ({ ...rep, project_name: p.name, project_id: p.id, project_status: p.status })))
            .catch(() => [])
        )
      );
      const flat = reportArrays.flat().sort((a,b) => b.report_date.localeCompare(a.report_date));
      setAllReports(flat);
    } catch { toast.error('Erreur chargement'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = allReports.filter(r => {
    const q = search.toLowerCase();
    const matchSearch = !q || r.project_name.toLowerCase().includes(q) || r.work_done?.toLowerCase().includes(q);
    const matchProject = !filterProject || r.project_id === filterProject;
    const matchVal = filterValidated===''?true:filterValidated==='true'?r.is_validated:!r.is_validated;
    return matchSearch && matchProject && matchVal;
  });

  // Stats
  const total      = allReports.length;
  const validated  = allReports.filter(r=>r.is_validated).length;
  const withInc    = allReports.filter(r=>r.incidents?.length>0).length;
  const avgWorkers = total>0 ? Math.round(allReports.reduce((a,r)=>a+(r.workers_count||0),0)/total) : 0;

  // Group by project for the "by project" view
  const byProject = projects.map(p => {
    const reps = allReports.filter(r=>r.project_id===p.id);
    const lastRep = reps[0];
    return {
      ...p,
      reports_count: reps.length,
      validated_count: reps.filter(r=>r.is_validated).length,
      last_report_date: lastRep?.report_date,
      last_progress: lastRep?.progress_pct,
      incidents_count: reps.reduce((a,r)=>a+(r.incidents?.length||0),0),
    };
  }).filter(p=>p.reports_count>0);

  const canValidate = ['admin_entreprise','chef_projet','app_owner'].includes(role);

  const handleValidate = async (projectId, reportId) => {
    try {
      await projectsAPI.validateReport(projectId, reportId);
      toast.success('Rapport validé');
      load();
    } catch { toast.error('Erreur validation'); }
  };

  return (
    <AppLayout>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'0 32px', height:60, background:'#fff', borderBottom:`1px solid ${T.border}`, position:'sticky', top:0, zIndex:10 }}>
        <h1 style={{ margin:0, fontSize:17, fontWeight:700, color:T.text }}>📈 Rapports & Journaux de chantier</h1>
        <div style={{ fontSize:12, color:T.textMuted }}>{total} rapport{total!==1?'s':''} au total</div>
      </div>

      <div style={{ padding:32 }}>
        {/* KPIs */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:24 }}>
          {[
            { label:'Total rapports',       value:total,       color:T.orange },
            { label:'Validés',              value:`${validated}/${total}`, color:T.green },
            { label:'Avec incidents',        value:withInc,     color:withInc>0?T.red:T.textMuted },
            { label:'Moy. ouvriers/jour',   value:avgWorkers,  color:T.blue  },
          ].map((k,i)=>(
            <Card key={i} p={18}>
              <div style={{ fontSize:11, color:T.textSub, marginBottom:4, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.4px' }}>{k.label}</div>
              <div style={{ fontSize:28, fontWeight:800, color:k.color, lineHeight:1 }}>{k.value}</div>
            </Card>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', borderBottom:`1px solid ${T.border}`, marginBottom:20 }}>
          {[{id:'list',label:'📋 Liste des rapports'},{id:'byproject',label:'🏗️ Par projet'},{id:'stats',label:'📊 Statistiques'}].map(t=>(
            <button key={t.id} onClick={()=>setActiveTab(t.id)}
              style={{ padding:'10px 18px', fontSize:13, fontWeight:600, cursor:'pointer', background:'none', border:'none', outline:'none', fontFamily:'inherit', color:activeTab===t.id?T.orange:T.textSub, borderBottom:`2px solid ${activeTab===t.id?T.orange:'transparent'}`, marginBottom:-1 }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── List tab ── */}
        {activeTab === 'list' && (
          <>
            {/* Filters */}
            <div style={{ display:'flex', gap:12, marginBottom:16, alignItems:'center', flexWrap:'wrap' }}>
              <input placeholder="🔍 Rechercher..." value={search} onChange={e=>setSearch(e.target.value)}
                style={{ padding:'8px 12px', borderRadius:8, border:`1px solid ${T.border}`, background:'#fff', fontSize:13, color:T.text, outline:'none', fontFamily:'inherit', width:240 }}/>
              <select value={filterProject} onChange={e=>setFilterProject(e.target.value)}
                style={{ padding:'8px 12px', borderRadius:8, border:`1px solid ${T.border}`, background:'#fff', fontSize:13, color:T.text, outline:'none', fontFamily:'inherit' }}>
                <option value="">Tous les projets</option>
                {projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <select value={filterValidated} onChange={e=>setFilterValidated(e.target.value)}
                style={{ padding:'8px 12px', borderRadius:8, border:`1px solid ${T.border}`, background:'#fff', fontSize:13, color:T.text, outline:'none', fontFamily:'inherit' }}>
                <option value="">Tous les statuts</option>
                <option value="true">Validés</option>
                <option value="false">En attente</option>
              </select>
              <span style={{ marginLeft:'auto', fontSize:12, color:T.textMuted }}>{filtered.length} résultat{filtered.length!==1?'s':''}</span>
            </div>

            {loading ? (
              <div style={{ textAlign:'center', padding:'40px 0', color:T.textMuted }}>
                <div style={{ width:32, height:32, border:`3px solid ${T.orange}`, borderTopColor:'transparent', borderRadius:'50%', animation:'spin 1s linear infinite', margin:'0 auto 12px' }}/>
                Chargement...
              </div>
            ) : filtered.length === 0 ? (
              <Card style={{ textAlign:'center', padding:'60px 24px' }}>
                <div style={{ fontSize:40, marginBottom:12 }}>📓</div>
                <div style={{ fontSize:14, color:T.textSub }}>Aucun rapport trouvé</div>
              </Card>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                {filtered.map(r=>(
                  <Card key={r.id} p={0}>
                    <div style={{ padding:'14px 20px', display:'flex', alignItems:'flex-start', gap:16 }}>
                      {/* Date */}
                      <div style={{ textAlign:'center', flexShrink:0, width:48, paddingTop:2 }}>
                        <div style={{ fontSize:22, fontWeight:800, color:T.orange, lineHeight:1 }}>
                          {new Date(r.report_date+'T00:00:00').getDate()}
                        </div>
                        <div style={{ fontSize:10, color:T.textMuted, textTransform:'uppercase' }}>
                          {new Date(r.report_date+'T00:00:00').toLocaleDateString('fr-FR',{month:'short'})}
                        </div>
                        <div style={{ fontSize:18, marginTop:4 }}>{WEATHER_ICONS[r.weather]||'📅'}</div>
                      </div>
                      {/* Content */}
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:5, flexWrap:'wrap' }}>
                          <span style={{ fontSize:13, fontWeight:600, color:T.textSub }}>{r.project_name}</span>
                          {r.is_validated
                            ? <span style={{ padding:'2px 8px', borderRadius:100, fontSize:11, fontWeight:600, background:T.greenLight, color:T.green }}>✅ Validé</span>
                            : <span style={{ padding:'2px 8px', borderRadius:100, fontSize:11, fontWeight:600, background:T.orangeLight, color:T.orange }}>⏳ En attente</span>
                          }
                          {r.incidents?.length>0&&<span style={{ padding:'2px 8px', borderRadius:100, fontSize:11, fontWeight:600, background:T.redLight, color:T.red }}>⚠️ {r.incidents.length} incident{r.incidents.length>1?'s':''}</span>}
                        </div>
                        <p style={{ fontSize:13, color:T.text, margin:'0 0 6px', lineHeight:1.5, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>
                          {r.work_done}
                        </p>
                        <div style={{ display:'flex', gap:16, fontSize:12, color:T.textSub }}>
                          <span>👷 {r.workers_count} ouvriers</span>
                          {r.progress_pct!=null&&<span>📊 {r.progress_pct}% avancement</span>}
                          {r.temperature&&<span>🌡️ {r.temperature}°C</span>}
                        </div>
                      </div>
                      {/* Actions */}
                      <div style={{ display:'flex', flexDirection:'column', gap:6, flexShrink:0 }}>
                        <Link to={`/projects/${r.project_id}/reports/${r.id}`}
                          style={{ padding:'6px 14px', borderRadius:7, border:`1px solid ${T.border}`, background:'#fff', color:T.textSub, fontSize:12, textDecoration:'none', fontWeight:500, display:'block', textAlign:'center' }}>
                          Voir
                        </Link>
                        {canValidate && !r.is_validated && (
                          <button onClick={()=>handleValidate(r.project_id, r.id)}
                            style={{ padding:'6px 14px', borderRadius:7, background:T.green, color:'#fff', fontSize:12, fontWeight:600, border:'none', cursor:'pointer', fontFamily:'inherit' }}>
                            ✅ Valider
                          </button>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── By project tab ── */}
        {activeTab === 'byproject' && (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(320px,1fr))', gap:16 }}>
            {byProject.length===0?(
              <Card style={{ gridColumn:'1/-1', textAlign:'center', padding:'60px 24px' }}>
                <div style={{ fontSize:40, marginBottom:12 }}>📁</div>
                <div style={{ fontSize:14, color:T.textSub }}>Aucun rapport disponible</div>
              </Card>
            ):byProject.map(p=>(
              <Card key={p.id}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14 }}>
                  <div style={{ fontSize:14, fontWeight:700, color:T.text, flex:1, marginRight:8 }}>{p.name}</div>
                  <span style={{ padding:'2px 9px', borderRadius:100, fontSize:11, fontWeight:600,
                    color:p.status==='termine'?T.green:p.status==='en_cours'?T.orange:T.textSub,
                    background:p.status==='termine'?T.greenLight:p.status==='en_cours'?T.orangeLight:'#F3F4F6',
                    flexShrink:0 }}>
                    {p.status==='termine'?'Terminé':p.status==='en_cours'?'En cours':p.status==='planifie'?'Planifié':'Suspendu'}
                  </span>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:14 }}>
                  {[
                    ['Rapports',     p.reports_count,    T.orange ],
                    ['Validés',      p.validated_count,  T.green  ],
                    ['Incidents',    p.incidents_count,  p.incidents_count>0?T.red:T.textMuted ],
                    ['Dernier',      p.last_report_date||'—', T.textSub ],
                  ].map(([l,v,c])=>(
                    <div key={l} style={{ padding:'8px 10px', background:'#F9FAFB', borderRadius:8 }}>
                      <div style={{ fontSize:10, color:T.textMuted, textTransform:'uppercase', letterSpacing:'0.4px', marginBottom:2 }}>{l}</div>
                      <div style={{ fontSize:14, fontWeight:700, color:c }}>{v}</div>
                    </div>
                  ))}
                </div>
                {p.last_progress!=null&&(
                  <>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:T.textSub, marginBottom:4 }}>
                      <span>Avancement</span><span style={{ fontWeight:700, color:T.orange }}>{p.last_progress}%</span>
                    </div>
                    <Pbar pct={p.last_progress}/>
                  </>
                )}
                <Link to={`/projects/${p.id}`}
                  style={{ display:'block', marginTop:14, padding:'8px 0', borderRadius:8, border:`1px solid ${T.border}`, background:'#fff', color:T.textSub, fontSize:12, fontWeight:500, textDecoration:'none', textAlign:'center' }}>
                  Voir le projet →
                </Link>
              </Card>
            ))}
          </div>
        )}

        {/* ── Stats tab ── */}
        {activeTab === 'stats' && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
            <Card>
              <div style={{ fontSize:14, fontWeight:700, color:T.text, marginBottom:20 }}>📊 Météo des chantiers</div>
              {Object.entries(WEATHER_ICONS).map(([w,icon])=>{
                const count = allReports.filter(r=>r.weather===w).length;
                const pct = total>0?Math.round((count/total)*100):0;
                return (
                  <div key={w} style={{ display:'flex', alignItems:'center', gap:12, marginBottom:10 }}>
                    <span style={{ fontSize:18, width:24, textAlign:'center' }}>{icon}</span>
                    <span style={{ flex:1, fontSize:13, color:T.text }}>{w.charAt(0).toUpperCase()+w.slice(1)}</span>
                    <div style={{ width:120, height:8, background:T.border, borderRadius:4, overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${pct}%`, background:T.orange, borderRadius:4 }}/>
                    </div>
                    <span style={{ fontSize:12, color:T.textSub, width:40, textAlign:'right' }}>{count} ({pct}%)</span>
                  </div>
                );
              })}
            </Card>
            <Card>
              <div style={{ fontSize:14, fontWeight:700, color:T.text, marginBottom:20 }}>👷 Présences par mois</div>
              {(() => {
                const byMonth = {};
                allReports.forEach(r => {
                  const m = r.report_date?.slice(0,7);
                  if (m) { if (!byMonth[m]) byMonth[m]={count:0,workers:0}; byMonth[m].count++; byMonth[m].workers+=r.workers_count||0; }
                });
                const months = Object.entries(byMonth).sort((a,b)=>b[0].localeCompare(a[0])).slice(0,6);
                const maxWorkers = Math.max(...months.map(([,v])=>v.workers),1);
                return months.length===0?(
                  <div style={{ color:T.textMuted, fontSize:13, textAlign:'center', padding:'20px 0' }}>Pas de données</div>
                ):months.map(([m,v])=>(
                  <div key={m} style={{ display:'flex', alignItems:'center', gap:12, marginBottom:10 }}>
                    <span style={{ fontSize:12, color:T.textSub, width:50 }}>{m.slice(0,7)}</span>
                    <div style={{ flex:1, height:18, background:T.border, borderRadius:3, overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${(v.workers/maxWorkers)*100}%`, background:T.blue, borderRadius:3 }}/>
                    </div>
                    <span style={{ fontSize:12, color:T.textSub, width:80, textAlign:'right' }}>{v.workers} présences</span>
                  </div>
                ));
              })()}
            </Card>
          </div>
        )}
      </div>
    </AppLayout>
  );
}