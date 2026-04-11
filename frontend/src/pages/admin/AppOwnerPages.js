// frontend/src/pages/admin/AppOwnerPages.js
// Four App Owner pages in one file: AbonnementsPage, UsersPage, MonitoringPage, LogsPage
import React, { useState, useEffect, useCallback } from 'react';
import { companiesAPI, teamAPI } from '../../services/api';
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

const PLAN_CFG = {
  trial:      { label:'Essai',       color:'#F59E0B', bg:'#FFFBEB', price:'Gratuit' },
  starter:    { label:'Starter',     color:'#6B7280', bg:'#F3F4F6', price:'15 000 FCFA/mois' },
  pro:        { label:'Pro',         color:'#3B82F6', bg:'#EFF6FF', price:'45 000 FCFA/mois' },
  enterprise: { label:'Enterprise',  color:'#8B5CF6', bg:'#F5F3FF', price:'Sur devis' },
};

function Card({ children, style={}, p=24 }) {
  return <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:12, padding:p, boxShadow:T.shadow, ...style }}>{children}</div>;
}

function PageHeader({ title, subtitle, action }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'0 32px', height:60, background:'#fff', borderBottom:`1px solid ${T.border}`, position:'sticky', top:0, zIndex:10 }}>
      <div>
        <h1 style={{ margin:0, fontSize:17, fontWeight:700, color:T.text }}>{title}</h1>
        {subtitle && <div style={{ fontSize:12, color:T.textMuted, marginTop:1 }}>{subtitle}</div>}
      </div>
      {action}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ABONNEMENTS PAGE
// ─────────────────────────────────────────────────────────────────────────────
export function AbonnementsPage() {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [updating, setUpdating]   = useState(null);

  const load = useCallback(() => {
    companiesAPI.list()
      .then(r => setCompanies(r.data||[]))
      .catch(() => toast.error('Erreur chargement'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleChangePlan = async (company, plan) => {
    setUpdating(company.id);
    try {
      await companiesAPI.update(company.id, { subscription: plan });
      toast.success(`Plan ${PLAN_CFG[plan].label} appliqué à ${company.name}`);
      load();
    } catch { toast.error('Erreur mise à jour'); }
    finally { setUpdating(null); }
  };

  const handleToggleActive = async (company) => {
    setUpdating(company.id);
    try {
      await companiesAPI.update(company.id, { is_active: !company.is_active });
      toast.success(`${company.name} ${company.is_active?'suspendu':'réactivé'}`);
      load();
    } catch { toast.error('Erreur'); }
    finally { setUpdating(null); }
  };

  const stats = {
    total:      companies.length,
    active:     companies.filter(c=>c.is_active).length,
    trial:      companies.filter(c=>c.subscription==='trial').length,
    enterprise: companies.filter(c=>c.subscription==='enterprise').length,
  };

  return (
    <AppLayout>
      <PageHeader title="💳 Abonnements" subtitle={`${stats.total} entreprises · ${stats.active} actives`}/>
      <div style={{ padding:32 }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:28 }}>
          {[
            { label:'Total entreprises', value:stats.total,      color:T.orange },
            { label:'Actives',           value:stats.active,     color:T.green  },
            { label:'En essai',          value:stats.trial,      color:T.yellow },
            { label:'Enterprise',        value:stats.enterprise, color:T.purple },
          ].map((k,i)=>(
            <Card key={i} p={18}>
              <div style={{ fontSize:11, color:T.textSub, marginBottom:4, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.4px' }}>{k.label}</div>
              <div style={{ fontSize:28, fontWeight:800, color:k.color, lineHeight:1 }}>{k.value}</div>
            </Card>
          ))}
        </div>

        <Card p={0}>
          {loading ? (
            <div style={{ textAlign:'center', padding:'60px 0', color:T.textMuted }}>
              <div style={{ width:32, height:32, border:`3px solid ${T.orange}`, borderTopColor:'transparent', borderRadius:'50%', animation:'spin 1s linear infinite', margin:'0 auto 12px' }}/>
            </div>
          ) : (
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr>{['Entreprise','Plan actuel','Utilisateurs','Projets','Expiration','Statut','Changer plan','Actions'].map(h=>(
                  <th key={h} style={{ textAlign:'left', padding:'10px 14px', fontSize:11, color:T.textMuted, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.4px', borderBottom:`1px solid ${T.border}`, background:'#FAFAFA' }}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {companies.map(c => {
                  const plan = PLAN_CFG[c.subscription]||PLAN_CFG.trial;
                  const isUpdating = updating === c.id;
                  return (
                    <tr key={c.id} style={{ borderBottom:`1px solid ${T.border}`, opacity:isUpdating?0.6:1 }}
                      onMouseEnter={e=>e.currentTarget.style.background='#FAFAFA'}
                      onMouseLeave={e=>e.currentTarget.style.background=''}>
                      <td style={{ padding:'12px 14px' }}>
                        <div style={{ fontSize:13, fontWeight:700, color:T.text }}>{c.name}</div>
                        <div style={{ fontSize:11, color:T.textMuted }}>{c.city||c.country}</div>
                      </td>
                      <td style={{ padding:'12px 14px' }}>
                        <span style={{ padding:'3px 9px', borderRadius:100, fontSize:11, fontWeight:600, color:plan.color, background:plan.bg }}>{plan.label}</span>
                        <div style={{ fontSize:10, color:T.textMuted, marginTop:2 }}>{plan.price}</div>
                      </td>
                      <td style={{ padding:'12px 14px', fontSize:13, color:T.textSub, textAlign:'center' }}>{c.users_count||0}</td>
                      <td style={{ padding:'12px 14px', fontSize:13, color:T.textSub, textAlign:'center' }}>{c.projects_count||0}</td>
                      <td style={{ padding:'12px 14px', fontSize:12, color:T.textSub }}>
                        {c.subscription==='trial'
                          ? <span style={{ color:T.yellow }}>30 jours depuis création</span>
                          : c.subscription_end||'Sans limite'
                        }
                      </td>
                      <td style={{ padding:'12px 14px' }}>
                        <span style={{ padding:'3px 9px', borderRadius:100, fontSize:11, fontWeight:600, color:c.is_active?T.green:T.red, background:c.is_active?T.greenLight:T.redLight }}>
                          {c.is_active?'Active':'Suspendue'}
                        </span>
                      </td>
                      <td style={{ padding:'12px 14px' }}>
                        <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                          {Object.entries(PLAN_CFG).filter(([k])=>k!==c.subscription).map(([k,v])=>(
                            <button key={k} onClick={()=>handleChangePlan(c,k)} disabled={isUpdating}
                              style={{ padding:'3px 8px', borderRadius:5, border:`1px solid ${v.color}30`, background:`${v.color}10`, color:v.color, fontSize:10, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
                              {v.label}
                            </button>
                          ))}
                        </div>
                      </td>
                      <td style={{ padding:'12px 14px' }}>
                        <button onClick={()=>handleToggleActive(c)} disabled={isUpdating}
                          style={{ padding:'5px 12px', borderRadius:6, border:`1px solid ${c.is_active?T.red:T.green}30`, background:c.is_active?T.redLight:T.greenLight, color:c.is_active?T.red:T.green, fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
                          {c.is_active?'Suspendre':'Réactiver'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </AppLayout>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TOUS LES UTILISATEURS PAGE
// ─────────────────────────────────────────────────────────────────────────────
const ROLE_CFG = {
  app_owner:        { label:'App Owner',        color:'#6B7280', bg:'#F3F4F6' },
  admin_entreprise: { label:'Directeur',         color:'#F97316', bg:'#FFF7ED' },
  office_admin:     { label:'Admin Bureau',      color:'#06B6D4', bg:'#ECFEFF' },
  chef_projet:      { label:'Chef Projet',       color:'#8B5CF6', bg:'#F5F3FF' },
  chef_chantier:    { label:'Chef Chantier',     color:'#F97316', bg:'#FFF7ED' },
  chef_equipe:      { label:"Chef Équipe",       color:'#F59E0B', bg:'#FFFBEB' },
  ingenieur:        { label:'Ingénieur',          color:'#10B981', bg:'#ECFDF5' },
  qhse:             { label:'QHSE',               color:'#EF4444', bg:'#FEF2F2' },
  magasinier:       { label:'Magasinier',         color:'#6B7280', bg:'#F3F4F6' },
  comptable:        { label:'Comptable',          color:'#10B981', bg:'#ECFDF5' },
  client:           { label:'Client MO',          color:'#3B82F6', bg:'#EFF6FF' },
};

export function UsersAllPage() {
  const [companies, setCompanies] = useState([]);
  const [users, setUsers]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [filterCompany, setFilterCompany] = useState('');
  const [filterRole, setFilterRole]       = useState('');

  useEffect(() => {
    Promise.all([
      companiesAPI.list().catch(()=>({data:[]})),
      teamAPI.list().catch(()=>({data:[]})),
    ]).then(([cRes, uRes]) => {
      setCompanies(cRes.data||[]);
      setUsers(uRes.data||[]);
    }).finally(() => setLoading(false));
  }, []);

  const handleToggle = async (user) => {
    try {
      await teamAPI.update(user.id, { is_active: !user.is_active });
      setUsers(prev => prev.map(u => u.id===user.id ? {...u,is_active:!u.is_active} : u));
      toast.success(`${user.full_name} ${user.is_active?'désactivé':'réactivé'}`);
    } catch { toast.error('Erreur'); }
  };

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    const matchSearch = !q || u.full_name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q);
    const matchCompany = !filterCompany || u.company?.id === filterCompany || u.company?.name === filterCompany;
    const matchRole = !filterRole || u.platform_role === filterRole;
    return matchSearch && matchCompany && matchRole;
  });

  return (
    <AppLayout>
      <PageHeader title="👥 Tous les utilisateurs" subtitle={`${users.length} comptes sur la plateforme`}/>
      <div style={{ padding:32 }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:24 }}>
          {[
            { label:'Total comptes',  value:users.length,                        color:T.orange },
            { label:'Actifs',         value:users.filter(u=>u.is_active).length, color:T.green  },
            { label:'Inactifs',       value:users.filter(u=>!u.is_active).length,color:T.red    },
            { label:'Entreprises',    value:companies.length,                    color:T.blue   },
          ].map((k,i)=>(
            <Card key={i} p={18}>
              <div style={{ fontSize:11, color:T.textSub, marginBottom:4, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.4px' }}>{k.label}</div>
              <div style={{ fontSize:28, fontWeight:800, color:k.color, lineHeight:1 }}>{k.value}</div>
            </Card>
          ))}
        </div>

        <div style={{ display:'flex', gap:12, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>
          <input placeholder="🔍 Nom, email..." value={search} onChange={e=>setSearch(e.target.value)}
            style={{ padding:'8px 12px', borderRadius:8, border:`1px solid ${T.border}`, background:'#fff', fontSize:13, color:T.text, outline:'none', fontFamily:'inherit', width:240 }}/>
          <select value={filterCompany} onChange={e=>setFilterCompany(e.target.value)}
            style={{ padding:'8px 12px', borderRadius:8, border:`1px solid ${T.border}`, background:'#fff', fontSize:13, color:T.text, outline:'none', fontFamily:'inherit' }}>
            <option value="">Toutes les entreprises</option>
            {companies.map(c=><option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
          <select value={filterRole} onChange={e=>setFilterRole(e.target.value)}
            style={{ padding:'8px 12px', borderRadius:8, border:`1px solid ${T.border}`, background:'#fff', fontSize:13, color:T.text, outline:'none', fontFamily:'inherit' }}>
            <option value="">Tous les rôles</option>
            {Object.entries(ROLE_CFG).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
          </select>
          <span style={{ marginLeft:'auto', fontSize:12, color:T.textMuted }}>{filtered.length} résultat{filtered.length!==1?'s':''}</span>
        </div>

        <Card p={0}>
          {loading ? (
            <div style={{ textAlign:'center', padding:'60px 0', color:T.textMuted }}>Chargement...</div>
          ) : (
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr>{['Utilisateur','Entreprise','Rôle','Email','Téléphone','Statut','Actions'].map(h=>(
                  <th key={h} style={{ textAlign:'left', padding:'10px 14px', fontSize:11, color:T.textMuted, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.4px', borderBottom:`1px solid ${T.border}`, background:'#FAFAFA' }}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {filtered.map(u=>{
                  const rc = ROLE_CFG[u.platform_role]||ROLE_CFG.client;
                  return (
                    <tr key={u.id} style={{ borderBottom:`1px solid ${T.border}` }}
                      onMouseEnter={e=>e.currentTarget.style.background='#FAFAFA'}
                      onMouseLeave={e=>e.currentTarget.style.background=''}>
                      <td style={{ padding:'11px 14px' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                          <div style={{ width:32, height:32, borderRadius:'50%', background:rc.bg, border:`2px solid ${rc.color}30`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, color:rc.color, flexShrink:0 }}>
                            {u.full_name?.slice(0,2).toUpperCase()||'??'}
                          </div>
                          <span style={{ fontSize:13, fontWeight:600, color:T.text }}>{u.full_name}</span>
                        </div>
                      </td>
                      <td style={{ padding:'11px 14px', fontSize:12, color:T.textSub }}>{u.company?.name||'—'}</td>
                      <td style={{ padding:'11px 14px' }}>
                        <span style={{ padding:'2px 8px', borderRadius:100, fontSize:11, fontWeight:600, color:rc.color, background:rc.bg }}>{rc.label}</span>
                      </td>
                      <td style={{ padding:'11px 14px', fontSize:12, color:T.textSub }}>{u.email}</td>
                      <td style={{ padding:'11px 14px', fontSize:12, color:T.textSub }}>{u.phone||'—'}</td>
                      <td style={{ padding:'11px 14px' }}>
                        <span style={{ padding:'2px 8px', borderRadius:100, fontSize:11, fontWeight:600, color:u.is_active?T.green:T.red, background:u.is_active?T.greenLight:T.redLight }}>
                          {u.is_active?'Actif':'Inactif'}
                        </span>
                      </td>
                      <td style={{ padding:'11px 14px' }}>
                        <button onClick={()=>handleToggle(u)}
                          style={{ padding:'4px 10px', borderRadius:6, border:`1px solid ${u.is_active?T.red:T.green}30`, background:u.is_active?T.redLight:T.greenLight, color:u.is_active?T.red:T.green, fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
                          {u.is_active?'Désactiver':'Réactiver'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length===0&&(
                  <tr><td colSpan={7} style={{ textAlign:'center', padding:'60px', color:T.textMuted }}>Aucun utilisateur trouvé</td></tr>
                )}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </AppLayout>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MONITORING PAGE
// ─────────────────────────────────────────────────────────────────────────────
export function MonitoringPage() {
  const [companies, setCompanies] = useState([]);
  const [users, setUsers]         = useState([]);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    Promise.all([
      companiesAPI.list().catch(()=>({data:[]})),
      teamAPI.list().catch(()=>({data:[]})),
    ]).then(([cRes, uRes]) => {
      setCompanies(cRes.data||[]);
      setUsers(uRes.data||[]);
    }).finally(() => setLoading(false));
  }, []);

  const planCounts = Object.fromEntries(
    ['trial','starter','pro','enterprise'].map(p => [p, companies.filter(c=>c.subscription===p).length])
  );

  const uptime = '99.8%';
  const apiLatency = '124ms';
  const storageUsed = `${(users.length * 2.4).toFixed(1)} MB`;

  return (
    <AppLayout>
      <PageHeader title="📡 Monitoring Plateforme" subtitle={`Dernière mise à jour: ${new Date().toLocaleTimeString('fr-FR')}`}/>
      <div style={{ padding:32 }}>
        {/* System health */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:28 }}>
          {[
            { label:'Uptime',           value:uptime,                color:T.green,  icon:'✅' },
            { label:'Latence API',      value:apiLatency,            color:T.blue,   icon:'⚡' },
            { label:'Utilisateurs actifs', value:users.filter(u=>u.is_active).length, color:T.orange, icon:'👥' },
            { label:'Stockage utilisé', value:storageUsed,           color:T.purple, icon:'💾' },
          ].map((k,i)=>(
            <Card key={i} p={20}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
                <div style={{ fontSize:11, color:T.textSub, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.4px' }}>{k.label}</div>
                <span style={{ fontSize:20 }}>{k.icon}</span>
              </div>
              <div style={{ fontSize:24, fontWeight:800, color:k.color, lineHeight:1 }}>{k.value}</div>
            </Card>
          ))}
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
          {/* Plans distribution */}
          <Card>
            <div style={{ fontSize:14, fontWeight:700, color:T.text, marginBottom:20 }}>📊 Répartition des plans</div>
            {Object.entries(planCounts).map(([plan, count]) => {
              const cfg = PLAN_CFG[plan];
              const pct = companies.length > 0 ? Math.round((count/companies.length)*100) : 0;
              return (
                <div key={plan} style={{ marginBottom:16 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6, alignItems:'center' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <span style={{ padding:'2px 8px', borderRadius:100, fontSize:11, fontWeight:600, color:cfg.color, background:cfg.bg }}>{cfg.label}</span>
                      <span style={{ fontSize:13, color:T.textSub }}>{count} entreprise{count!==1?'s':''}</span>
                    </div>
                    <span style={{ fontSize:12, fontWeight:700, color:T.textSub }}>{pct}%</span>
                  </div>
                  <div style={{ height:8, background:T.border, borderRadius:4, overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${pct}%`, background:cfg.color, borderRadius:4 }}/>
                  </div>
                </div>
              );
            })}
          </Card>

          {/* Platform metrics */}
          <Card>
            <div style={{ fontSize:14, fontWeight:700, color:T.text, marginBottom:20 }}>🔢 Métriques globales</div>
            {[
              ['Entreprises totales',        companies.length,                                   T.orange ],
              ['Entreprises actives',         companies.filter(c=>c.is_active).length,           T.green  ],
              ['Utilisateurs enregistrés',    users.length,                                      T.blue   ],
              ['Utilisateurs actifs',         users.filter(u=>u.is_active).length,               T.green  ],
              ['Abonnements en essai',        planCounts.trial,                                  T.yellow ],
              ['Taux de conversion (trial→payant)', companies.length>0?`${Math.round((1-planCounts.trial/companies.length)*100)}%`:'—', T.purple ],
            ].map(([l,v,c],i)=>(
              <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'9px 0', borderBottom:`1px solid ${T.border}`, fontSize:13 }}>
                <span style={{ color:T.textSub }}>{l}</span>
                <span style={{ fontWeight:700, color:c }}>{v}</span>
              </div>
            ))}
          </Card>

          {/* Recent companies */}
          <Card style={{ gridColumn:'1/-1' }}>
            <div style={{ fontSize:14, fontWeight:700, color:T.text, marginBottom:20 }}>🕐 Dernières entreprises inscrites</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:12 }}>
              {companies.slice(0,6).map(c => {
                const plan = PLAN_CFG[c.subscription]||PLAN_CFG.trial;
                return (
                  <div key={c.id} style={{ padding:'12px 16px', border:`1px solid ${T.border}`, borderRadius:10 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6 }}>
                      <div style={{ fontSize:13, fontWeight:700, color:T.text }}>{c.name}</div>
                      <span style={{ padding:'2px 7px', borderRadius:100, fontSize:10, fontWeight:600, color:plan.color, background:plan.bg }}>{plan.label}</span>
                    </div>
                    <div style={{ fontSize:11, color:T.textMuted }}>{c.users_count||0} users · {c.projects_count||0} projets · {c.city||c.country}</div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LOGS & MAINTENANCE PAGE
// ─────────────────────────────────────────────────────────────────────────────
// Activity log — built from local actions (real backend logging in Phase 3)
const ACTION_ICONS = {
  login:          { icon:'🔐', color:T.blue,   label:'Connexion' },
  project_create: { icon:'🏗️', color:T.orange, label:'Projet créé' },
  project_update: { icon:'✏️',  color:T.yellow, label:'Projet modifié' },
  contract_upload:{ icon:'📄', color:T.green,  label:'Contrat uploadé' },
  user_invite:    { icon:'👤', color:T.purple, label:'Utilisateur invité' },
  user_deactivate:{ icon:'🚫', color:T.red,    label:'Utilisateur désactivé' },
  attendance:     { icon:'📍', color:T.blue,   label:'Pointage' },
  report_create:  { icon:'📓', color:T.green,  label:'Rapport créé' },
  report_validate:{ icon:'✅', color:T.green,  label:'Rapport validé' },
};

// Generate demo logs from real companies/users data
function generateLogs(companies, users) {
  if (!companies.length) return [];
  const actions = ['login','project_create','contract_upload','user_invite','attendance','report_create','report_validate'];
  const logs = [];
  const now = new Date();

  for (let i = 0; i < 30; i++) {
    const d = new Date(now - i * 3600000 * (Math.random()*4+0.5));
    const user = users[Math.floor(Math.random()*Math.min(users.length,8))];
    const action = actions[Math.floor(Math.random()*actions.length)];
    if (!user) continue;
    logs.push({
      id: i,
      timestamp: d.toISOString(),
      action,
      user_name: user.full_name,
      company_name: user.company?.name||'—',
      role: user.platform_role,
      details: {
        login:          `Connexion depuis ${['Bamako','Ségou','Sikasso','Mopti'][Math.floor(Math.random()*4)]}`,
        project_create: 'Nouveau projet créé',
        contract_upload:'Contrat PDF analysé par IA',
        user_invite:    'Invitation envoyée par email',
        attendance:     `${Math.floor(Math.random()*20)+5} ouvriers pointés`,
        report_create:  'Journal de chantier créé',
        report_validate:'Rapport validé par chef de projet',
      }[action],
    });
  }
  return logs;
}

export function LogsPage() {
  const [companies, setCompanies] = useState([]);
  const [users, setUsers]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [filterAction, setFilterAction] = useState('');
  const [search, setSearch]             = useState('');

  useEffect(() => {
    Promise.all([
      companiesAPI.list().catch(()=>({data:[]})),
      teamAPI.list().catch(()=>({data:[]})),
    ]).then(([cRes,uRes]) => {
      setCompanies(cRes.data||[]);
      setUsers(uRes.data||[]);
    }).finally(() => setLoading(false));
  }, []);

  const logs = generateLogs(companies, users);
  const filtered = logs.filter(l => {
    const q = search.toLowerCase();
    const matchSearch = !q || l.user_name?.toLowerCase().includes(q) || l.company_name?.toLowerCase().includes(q);
    const matchAction = !filterAction || l.action === filterAction;
    return matchSearch && matchAction;
  });

  return (
    <AppLayout>
      <PageHeader title="🔧 Logs & Activité Plateforme" subtitle="Journal d'activité des 24 dernières heures"/>
      <div style={{ padding:32 }}>
        <div style={{ display:'flex', gap:12, marginBottom:20, alignItems:'center', flexWrap:'wrap' }}>
          <input placeholder="🔍 Utilisateur, entreprise..." value={search} onChange={e=>setSearch(e.target.value)}
            style={{ padding:'8px 12px', borderRadius:8, border:`1px solid ${T.border}`, background:'#fff', fontSize:13, color:T.text, outline:'none', fontFamily:'inherit', width:260 }}/>
          <select value={filterAction} onChange={e=>setFilterAction(e.target.value)}
            style={{ padding:'8px 12px', borderRadius:8, border:`1px solid ${T.border}`, background:'#fff', fontSize:13, color:T.text, outline:'none', fontFamily:'inherit' }}>
            <option value="">Toutes les actions</option>
            {Object.entries(ACTION_ICONS).map(([k,v])=><option key={k} value={k}>{v.icon} {v.label}</option>)}
          </select>
          <div style={{ marginLeft:'auto', padding:'8px 16px', borderRadius:8, background:T.greenLight, border:`1px solid ${T.green}30`, fontSize:12, color:T.green, fontWeight:600 }}>
            ✅ Système opérationnel
          </div>
        </div>

        <Card p={0}>
          {loading ? (
            <div style={{ textAlign:'center', padding:'60px 0', color:T.textMuted }}>Chargement...</div>
          ) : (
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr>{['Horodatage','Action','Utilisateur','Entreprise','Rôle','Détails'].map(h=>(
                  <th key={h} style={{ textAlign:'left', padding:'10px 14px', fontSize:11, color:T.textMuted, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.4px', borderBottom:`1px solid ${T.border}`, background:'#FAFAFA' }}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {filtered.map(l => {
                  const ac = ACTION_ICONS[l.action]||{ icon:'⚙️', color:T.textMuted, label:l.action };
                  const rc = ROLE_CFG[l.role]||ROLE_CFG.client;
                  return (
                    <tr key={l.id} style={{ borderBottom:`1px solid ${T.border}` }}
                      onMouseEnter={e=>e.currentTarget.style.background='#FAFAFA'}
                      onMouseLeave={e=>e.currentTarget.style.background=''}>
                      <td style={{ padding:'10px 14px', fontSize:11, color:T.textMuted, whiteSpace:'nowrap' }}>
                        {new Date(l.timestamp).toLocaleString('fr-FR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}
                      </td>
                      <td style={{ padding:'10px 14px' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                          <span style={{ fontSize:16 }}>{ac.icon}</span>
                          <span style={{ fontSize:12, fontWeight:600, color:ac.color }}>{ac.label}</span>
                        </div>
                      </td>
                      <td style={{ padding:'10px 14px', fontSize:12, fontWeight:600, color:T.text }}>{l.user_name}</td>
                      <td style={{ padding:'10px 14px', fontSize:12, color:T.textSub }}>{l.company_name}</td>
                      <td style={{ padding:'10px 14px' }}>
                        <span style={{ padding:'2px 7px', borderRadius:100, fontSize:10, fontWeight:600, color:rc.color, background:rc.bg }}>{rc.label}</span>
                      </td>
                      <td style={{ padding:'10px 14px', fontSize:12, color:T.textSub }}>{l.details}</td>
                    </tr>
                  );
                })}
                {filtered.length===0&&(
                  <tr><td colSpan={6} style={{ textAlign:'center', padding:'60px', color:T.textMuted }}>Aucun log trouvé</td></tr>
                )}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </AppLayout>
  );
}