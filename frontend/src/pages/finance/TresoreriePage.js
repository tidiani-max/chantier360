// frontend/src/pages/finance/TresoreriePage.js
// Directeur (B) + Comptable (J) — company-wide treasury view
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { projectsAPI } from '../../services/api';
import { usePermissions } from '../../context/PermissionsContext';
import AppLayout from '../../components/layout/AppLayout';
import toast from 'react-hot-toast';

const T = {
  card:'#FFFFFF', border:'#E8EDF2', text:'#1a1f2e', textSub:'#6B7280', textMuted:'#9CA3AF',
  orange:'#F97316', orangeLight:'rgba(249,115,22,0.1)',
  green:'#10B981', greenLight:'rgba(16,185,129,0.08)',
  red:'#EF4444', redLight:'rgba(239,68,68,0.08)',
  blue:'#3B82F6', blueLight:'rgba(59,130,246,0.1)',
  yellow:'#F59E0B', purple:'#8B5CF6', shadow:'0 1px 3px rgba(0,0,0,0.07)',
};

function fmtFCFA(n) {
  if (n==null||isNaN(parseFloat(n))) return '—';
  const v=parseFloat(n);
  if (v>=1e9) return `${(v/1e9).toFixed(2)} Mrd FCFA`;
  if (v>=1e6) return `${(v/1e6).toFixed(2)} M FCFA`;
  if (v>=1e3) return `${(v/1e3).toFixed(0)} K FCFA`;
  return v.toLocaleString('fr-FR')+' FCFA';
}

function Card({ children, style={}, p=24 }) {
  return <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:12, padding:p, boxShadow:T.shadow, ...style }}>{children}</div>;
}

function Pbar({ pct, color=T.orange, h=8 }) {
  return (
    <div style={{ height:h, background:T.border, borderRadius:h, overflow:'hidden' }}>
      <div style={{ height:'100%', width:`${Math.min(100,pct||0)}%`, background:color, borderRadius:h, transition:'width 0.6s' }}/>
    </div>
  );
}

export default function TresoreriePage() {
  const navigate = useNavigate();
  const { role, canViewFinancials } = usePermissions();

  const [projects, setProjects]   = useState([]);
  const [statsMap, setStatsMap]   = useState({}); // projectId → stats
  const [loading, setLoading]     = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  const load = useCallback(async () => {
    try {
      const pRes = await projectsAPI.list();
      const prjs = pRes.data || [];
      setProjects(prjs);

      // Load budget stats for each project
      const statsArr = await Promise.all(
        prjs.map(p =>
          projectsAPI.getBudgetStats(p.id)
            .then(r => ({ id: p.id, ...r.data }))
            .catch(() => ({ id: p.id }))
        )
      );
      const map = {};
      statsArr.forEach(s => { map[s.id] = s; });
      setStatsMap(map);
    } catch { toast.error('Erreur chargement'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Consolidated totals
  const totalBudget    = projects.reduce((a,p) => a+parseFloat(p.budget||0), 0);
  const totalExpenses  = projects.reduce((a,p) => a+parseFloat(p.actual_expenses||0), 0);
  const totalContracts = Object.values(statsMap).reduce((a,s) => a+(s.contracts_total||0), 0);
  const totalMarge     = totalContracts - totalExpenses;
  const globalPct      = totalBudget>0 ? Math.min(100,Math.round((totalExpenses/totalBudget)*100)) : 0;

  const activeProjects = projects.filter(p=>p.status==='en_cours');
  const overBudget     = projects.filter(p=>parseFloat(p.actual_expenses||0)>parseFloat(p.budget||0) && p.budget);

  // Monthly breakdown (mock from purchases — real data when invoice model added)
  const monthlyData = [
    { month:'Oct', depense:18500000, budget:22000000 },
    { month:'Nov', depense:24300000, budget:22000000 },
    { month:'Déc', depense:19800000, budget:22000000 },
    { month:'Jan', depense:31200000, budget:28000000 },
    { month:'Fév', depense:28700000, budget:28000000 },
    { month:'Mar', depense:totalExpenses > 0 ? Math.round(totalExpenses/6) : 25000000, budget:totalBudget > 0 ? Math.round(totalBudget/24) : 28000000 },
  ];
  const maxMonthly = Math.max(...monthlyData.map(m=>Math.max(m.depense,m.budget)));

  return (
    <AppLayout>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'0 32px', height:60, background:'#fff', borderBottom:`1px solid ${T.border}`, position:'sticky', top:0, zIndex:10 }}>
        <h1 style={{ margin:0, fontSize:17, fontWeight:700, color:T.text }}>🏦 Trésorerie — Vue consolidée</h1>
        <div style={{ fontSize:12, color:T.textMuted }}>{projects.length} projet{projects.length!==1?'s':''} · {activeProjects.length} en cours</div>
      </div>

      <div style={{ padding:32 }}>
        {/* Global KPIs */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:28 }}>
          {[
            { label:'Budget total',      value:fmtFCFA(totalBudget),    color:T.blue,   icon:'💼' },
            { label:'Dépenses totales',  value:fmtFCFA(totalExpenses),  color:globalPct>90?T.red:T.orange, icon:'💸', alert:globalPct>90 },
            { label:'Contrats signés',   value:fmtFCFA(totalContracts), color:T.green,  icon:'📄' },
            { label:'Marge nette globale',value:fmtFCFA(totalMarge),    color:totalMarge>=0?T.green:T.red, icon:'💡', alert:totalMarge<0 },
          ].map((k,i)=>(
            <Card key={i} p={20}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
                <div style={{ fontSize:11, color:T.textSub, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.4px' }}>{k.label}</div>
                <span style={{ fontSize:20 }}>{k.icon}</span>
              </div>
              <div style={{ fontSize:20, fontWeight:800, color:k.alert?T.red:k.color, lineHeight:1.2, marginBottom:6 }}>{k.value}</div>
              {k.label==='Dépenses totales'&&<Pbar pct={globalPct} color={globalPct>90?T.red:T.orange}/>}
              {k.label==='Marge nette globale'&&totalContracts>0&&(
                <div style={{ fontSize:11, color:T.textMuted, marginTop:4 }}>
                  {Math.round((totalMarge/totalContracts)*100)}% sur contrats
                </div>
              )}
            </Card>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', borderBottom:`1px solid ${T.border}`, marginBottom:24 }}>
          {[
            {id:'overview',  label:'📊 Vue d\'ensemble'},
            {id:'projects',  label:'🏗️ Par projet'},
            {id:'cashflow',  label:'📈 Cash flow'},
          ].map(t=>(
            <button key={t.id} onClick={()=>setActiveTab(t.id)}
              style={{ padding:'10px 18px', fontSize:13, fontWeight:600, cursor:'pointer', background:'none', border:'none', outline:'none', fontFamily:'inherit', color:activeTab===t.id?T.orange:T.textSub, borderBottom:`2px solid ${activeTab===t.id?T.orange:'transparent'}`, marginBottom:-1 }}>
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign:'center', padding:'60px 0', color:T.textMuted }}>
            <div style={{ width:32, height:32, border:`3px solid ${T.orange}`, borderTopColor:'transparent', borderRadius:'50%', animation:'spin 1s linear infinite', margin:'0 auto 12px' }}/>
            Chargement...
          </div>
        ) : (
          <>
            {/* Overview tab */}
            {activeTab==='overview' && (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
                {/* Budget consumption */}
                <Card>
                  <div style={{ fontSize:14, fontWeight:700, color:T.text, marginBottom:20 }}>📊 Consommation budgétaire globale</div>
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, marginBottom:8 }}>
                    <span style={{ color:T.textSub }}>Dépenses / Budget total</span>
                    <span style={{ fontWeight:700, color:globalPct>90?T.red:T.orange }}>{globalPct}%</span>
                  </div>
                  <Pbar pct={globalPct} color={globalPct>90?T.red:T.orange} h={12}/>
                  <div style={{ fontSize:12, color:T.textMuted, marginTop:8, marginBottom:20 }}>
                    Reste disponible: {fmtFCFA(totalBudget-totalExpenses)}
                  </div>

                  {/* Per-status breakdown */}
                  {[
                    { label:'Projets en cours',  value:activeProjects.length,                              color:T.orange },
                    { label:'Projets dépassés',  value:overBudget.length,                                  color:overBudget.length>0?T.red:T.green },
                    { label:'Projets terminés',  value:projects.filter(p=>p.status==='termine').length,    color:T.green  },
                    { label:'Projets planifiés', value:projects.filter(p=>p.status==='planifie').length,   color:T.blue   },
                  ].map((k,i)=>(
                    <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:`1px solid ${T.border}` }}>
                      <span style={{ fontSize:13, color:T.textSub }}>{k.label}</span>
                      <span style={{ fontSize:15, fontWeight:800, color:k.color }}>{k.value}</span>
                    </div>
                  ))}
                </Card>

                {/* Marge par projet */}
                <Card>
                  <div style={{ fontSize:14, fontWeight:700, color:T.text, marginBottom:20 }}>💡 Marge bénéficiaire par projet</div>
                  {projects.length===0 ? (
                    <div style={{ textAlign:'center', padding:'40px 0', color:T.textMuted, fontSize:13 }}>Aucun projet</div>
                  ) : projects.map(p=>{
                    const s = statsMap[p.id]||{};
                    const contractsT = s.contracts_total||0;
                    const exp = parseFloat(p.actual_expenses||0);
                    const marge = contractsT-exp;
                    const margeP = contractsT>0?Math.round((marge/contractsT)*100):null;
                    return (
                      <div key={p.id} style={{ marginBottom:16 }}>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:5 }}>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:13, fontWeight:600, color:T.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</div>
                            <div style={{ fontSize:11, color:T.textMuted }}>{fmtFCFA(exp)} dépensé · {fmtFCFA(contractsT)} contrats</div>
                          </div>
                          {margeP!=null&&(
                            <span style={{ fontSize:13, fontWeight:800, color:marge>=0?T.green:T.red, marginLeft:8, flexShrink:0 }}>
                              {marge>=0?'+':''}{margeP}%
                            </span>
                          )}
                        </div>
                        {parseFloat(p.budget||0)>0&&(
                          <Pbar pct={parseFloat(p.actual_expenses||0)/parseFloat(p.budget)*100} color={parseFloat(p.actual_expenses||0)>parseFloat(p.budget||0)?T.red:T.orange} h={6}/>
                        )}
                      </div>
                    );
                  })}
                </Card>

                {/* Alerts */}
                {overBudget.length > 0 && (
                  <Card style={{ borderColor:T.red+'40', background:T.redLight, gridColumn:'1/-1' }}>
                    <div style={{ fontSize:13, fontWeight:700, color:T.red, marginBottom:12 }}>
                      🔴 {overBudget.length} projet{overBudget.length>1?'s':''} en dépassement budgétaire
                    </div>
                    {overBudget.map(p=>{
                      const over = parseFloat(p.actual_expenses||0)-parseFloat(p.budget||0);
                      return (
                        <div key={p.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 0', borderBottom:`1px solid ${T.red}20` }}>
                          <Link to={`/projects/${p.id}/budget`} style={{ fontSize:13, fontWeight:600, color:T.red, textDecoration:'none' }}>{p.name}</Link>
                          <span style={{ fontSize:12, color:T.red }}>+{fmtFCFA(over)} de dépassement</span>
                        </div>
                      );
                    })}
                  </Card>
                )}
              </div>
            )}

            {/* By project tab */}
            {activeTab==='projects' && (
              <Card p={0}>
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead>
                    <tr>{['Projet','Statut','Budget prévu','Dépensé','Contrats','Marge','Consommation',''].map(h=>(
                      <th key={h} style={{ textAlign:'left', padding:'11px 16px', fontSize:11, color:T.textMuted, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.4px', borderBottom:`1px solid ${T.border}`, background:'#FAFAFA' }}>{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {projects.map(p=>{
                      const s = statsMap[p.id]||{};
                      const budget = parseFloat(p.budget||0);
                      const exp    = parseFloat(p.actual_expenses||0);
                      const ct     = s.contracts_total||0;
                      const marge  = ct-exp;
                      const pct    = budget>0?Math.min(100,Math.round((exp/budget)*100)):0;
                      const sc     = {planifie:{c:'#6366F1'},en_cours:{c:T.orange},suspendu:{c:T.red},termine:{c:T.green}}[p.status]||{c:T.textMuted};
                      return (
                        <tr key={p.id} style={{ borderBottom:`1px solid ${T.border}` }}
                          onMouseEnter={e=>e.currentTarget.style.background='#FAFAFA'}
                          onMouseLeave={e=>e.currentTarget.style.background=''}>
                          <td style={{ padding:'12px 16px', fontSize:13, fontWeight:600, color:T.text, maxWidth:200 }}>
                            <div style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</div>
                          </td>
                          <td style={{ padding:'12px 16px' }}>
                            <span style={{ fontSize:11, fontWeight:600, color:sc.c, padding:'2px 8px', borderRadius:100, background:`${sc.c}15` }}>
                              {p.status==='en_cours'?'En cours':p.status==='planifie'?'Planifié':p.status==='termine'?'Terminé':'Suspendu'}
                            </span>
                          </td>
                          <td style={{ padding:'12px 16px', fontSize:12, color:T.textSub }}>{fmtFCFA(budget)}</td>
                          <td style={{ padding:'12px 16px', fontSize:12, color:exp>budget&&budget>0?T.red:T.text, fontWeight:exp>budget&&budget>0?700:400 }}>{fmtFCFA(exp)}</td>
                          <td style={{ padding:'12px 16px', fontSize:12, color:T.green }}>{fmtFCFA(ct)}</td>
                          <td style={{ padding:'12px 16px', fontSize:13, fontWeight:700, color:marge>=0?T.green:T.red }}>
                            {ct>0?`${marge>=0?'+':''}${fmtFCFA(marge)}`:'—'}
                          </td>
                          <td style={{ padding:'12px 16px', width:120 }}>
                            {budget>0&&(
                              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                                <div style={{ flex:1, height:6, background:T.border, borderRadius:3, overflow:'hidden' }}>
                                  <div style={{ height:'100%', width:`${pct}%`, background:pct>90?T.red:T.orange, borderRadius:3 }}/>
                                </div>
                                <span style={{ fontSize:11, color:T.textSub, minWidth:28 }}>{pct}%</span>
                              </div>
                            )}
                          </td>
                          <td style={{ padding:'12px 16px' }}>
                            <Link to={`/projects/${p.id}/budget`}
                              style={{ padding:'5px 12px', borderRadius:6, border:`1px solid ${T.border}`, background:'#fff', color:T.textSub, fontSize:11, textDecoration:'none' }}>
                              Détail →
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ background:'#FAFAFA', borderTop:`2px solid ${T.border}` }}>
                      <td colSpan={2} style={{ padding:'12px 16px', fontSize:13, fontWeight:700, color:T.text }}>Total</td>
                      <td style={{ padding:'12px 16px', fontSize:13, fontWeight:700, color:T.text }}>{fmtFCFA(totalBudget)}</td>
                      <td style={{ padding:'12px 16px', fontSize:13, fontWeight:700, color:T.text }}>{fmtFCFA(totalExpenses)}</td>
                      <td style={{ padding:'12px 16px', fontSize:13, fontWeight:700, color:T.green }}>{fmtFCFA(totalContracts)}</td>
                      <td style={{ padding:'12px 16px', fontSize:13, fontWeight:800, color:totalMarge>=0?T.green:T.red }}>{fmtFCFA(totalMarge)}</td>
                      <td colSpan={2}/>
                    </tr>
                  </tfoot>
                </table>
              </Card>
            )}

            {/* Cash flow chart tab */}
            {activeTab==='cashflow' && (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
                <Card>
                  <div style={{ fontSize:14, fontWeight:700, color:T.text, marginBottom:20 }}>📈 Dépenses vs Budget — 6 derniers mois</div>
                  <div style={{ display:'flex', alignItems:'flex-end', gap:8, height:160, marginBottom:12 }}>
                    {monthlyData.map((m,i)=>(
                      <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
                        <div style={{ width:'100%', display:'flex', gap:2, alignItems:'flex-end', height:140 }}>
                          <div style={{ flex:1, background:T.blue+'40', borderRadius:'3px 3px 0 0', height:`${(m.budget/maxMonthly)*100}%`, minHeight:4 }}/>
                          <div style={{ flex:1, background:m.depense>m.budget?T.red:T.orange, borderRadius:'3px 3px 0 0', height:`${(m.depense/maxMonthly)*100}%`, minHeight:4 }}/>
                        </div>
                        <span style={{ fontSize:10, color:T.textMuted }}>{m.month}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ display:'flex', gap:16 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, color:T.textMuted }}>
                      <div style={{ width:12, height:12, background:T.blue+'40', borderRadius:2 }}/> Budget
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, color:T.textMuted }}>
                      <div style={{ width:12, height:12, background:T.orange, borderRadius:2 }}/> Dépenses
                    </div>
                  </div>
                </Card>

                <Card>
                  <div style={{ fontSize:14, fontWeight:700, color:T.text, marginBottom:20 }}>💰 Synthèse financière</div>
                  {[
                    ['Budget total alloué',          fmtFCFA(totalBudget),    T.blue   ],
                    ['Dépenses réelles cumulées',    fmtFCFA(totalExpenses),  T.orange ],
                    ['Reste à dépenser',             fmtFCFA(totalBudget-totalExpenses), T.green ],
                    ['Montant total contractualisé', fmtFCFA(totalContracts), T.purple ],
                    ['Marge bénéficiaire estimée',   fmtFCFA(totalMarge),     totalMarge>=0?T.green:T.red ],
                    ['Taux de consommation global',  `${globalPct}%`,          globalPct>90?T.red:T.orange],
                  ].map(([l,v,c],i)=>(
                    <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'10px 0', borderBottom:`1px solid ${T.border}`, fontSize:13 }}>
                      <span style={{ color:T.textSub }}>{l}</span>
                      <span style={{ fontWeight:700, color:c }}>{v}</span>
                    </div>
                  ))}
                </Card>
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}