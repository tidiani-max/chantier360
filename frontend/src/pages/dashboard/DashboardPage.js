// frontend/src/pages/dashboard/DashboardPage.js
// REFACTORED: Project-first dashboard — every role sees their projects first,
// then role-specific KPIs below. app_owner still sees companies only.
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../context/PermissionsContext';
import { projectsAPI, teamAPI, workersAPI, companiesAPI, attendanceAPI } from '../../services/api';
import AppLayout from '../../components/layout/AppLayout';
import toast from 'react-hot-toast';

// ─── DESIGN TOKENS ────────────────────────────────────────────────────────────
const T = {
  bg:'#F8F9FA', card:'#FFFFFF', border:'#E8EDF2',
  text:'#1a1f2e', textSub:'#6B7280', textMuted:'#9CA3AF',
  orange:'#F97316', orangeLight:'rgba(249,115,22,0.08)',
  green:'#10B981',  greenLight:'rgba(16,185,129,0.08)',
  red:'#EF4444',    redLight:'rgba(239,68,68,0.08)',
  blue:'#3B82F6',   blueLight:'rgba(59,130,246,0.08)',
  yellow:'#F59E0B', yellowLight:'rgba(245,158,11,0.08)',
  purple:'#8B5CF6', purpleLight:'rgba(139,92,246,0.08)',
  shadow:'0 1px 3px rgba(0,0,0,0.07)',
  shadowMd:'0 4px 12px rgba(0,0,0,0.08)',
};

const STATUS_CFG = {
  planifie:{ label:'Planifié', color:'#6366F1', bg:'rgba(99,102,241,0.10)'  },
  en_cours:{ label:'En cours', color:'#F59E0B', bg:'rgba(245,158,11,0.10)'  },
  suspendu:{ label:'Suspendu', color:'#EF4444', bg:'rgba(239,68,68,0.10)'   },
  termine: { label:'Terminé',  color:'#10B981', bg:'rgba(16,185,129,0.10)'  },
};

const TYPE_ICONS = {
  batiment:'🏢',route:'🛣️',hydraulique:'💧',electricite:'⚡',
  autre:'🔧',aep:'💧',assainissement:'🚰',pont:'🌉',
};

// ─── SMALL COMPONENTS ─────────────────────────────────────────────────────────
function Card({ children, style={}, p=24 }) {
  return (
    <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:12, padding:p, boxShadow:T.shadow, ...style }}>
      {children}
    </div>
  );
}

function KPI({ label, value, color=T.orange, sub, trend, alert, icon }) {
  return (
    <Card p={20}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
        <div style={{ fontSize:22 }}>{icon}</div>
        {alert && <span style={{ fontSize:10, color:T.red, fontWeight:700, padding:'2px 6px', background:T.redLight, borderRadius:100 }}>⚠ Alerte</span>}
      </div>
      <div style={{ fontSize:28, fontWeight:800, color:alert?T.red:color, marginBottom:4 }}>{value}</div>
      <div style={{ fontSize:11, color:T.textMuted, textTransform:'uppercase', letterSpacing:'0.5px', fontWeight:600 }}>{label}</div>
      {sub   && <div style={{ fontSize:11, color:T.textSub, marginTop:4 }}>{sub}</div>}
      {trend && <div style={{ fontSize:11, color:T.green, marginTop:4, fontWeight:600 }}>{trend}</div>}
    </Card>
  );
}

function Pbar({ pct, color=T.orange, h=6 }) {
  return (
    <div style={{ height:h, background:'#F1F5F9', borderRadius:h, overflow:'hidden' }}>
      <div style={{ height:'100%', width:`${Math.min(100,pct||0)}%`, background:pct>85?T.red:color, borderRadius:h, transition:'width 0.5s' }}/>
    </div>
  );
}

function SBadge({ status }) {
  const c = STATUS_CFG[status] || STATUS_CFG.planifie;
  return (
    <span style={{ padding:'2px 9px', borderRadius:100, fontSize:11, fontWeight:600, color:c.color, background:c.bg, whiteSpace:'nowrap' }}>
      {c.label}
    </span>
  );
}

function fmtM(v) {
  if (!v) return '0';
  const n = parseFloat(v);
  if (n >= 1_000_000_000) return (n/1_000_000_000).toFixed(1)+'Mrd';
  if (n >= 1_000_000)     return (n/1_000_000).toFixed(1)+'M';
  if (n >= 1_000)         return (n/1_000).toFixed(0)+'K';
  return n.toFixed(0);
}

// ─── PROJECT CARD (used in all role dashboards) ────────────────────────────────
function ProjectCard({ project, showBudget=false, compact=false }) {
  const navigate = useNavigate();
  const [hovered, setHovered] = useState(false);
  const sc = STATUS_CFG[project.status] || STATUS_CFG.planifie;
  const budgetPct = project.budget && project.actual_expenses
    ? Math.min(100, Math.round((parseFloat(project.actual_expenses)/parseFloat(project.budget))*100))
    : 0;

  if (compact) {
    return (
      <div
        onClick={() => navigate(`/projects/${project.id}`)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 0', borderBottom:`1px solid ${T.border}`, cursor:'pointer', transition:'background 0.1s' }}
      >
        <span style={{ fontSize:20, flexShrink:0 }}>{TYPE_ICONS[project.project_type]||'🔧'}</span>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:13, fontWeight:600, color:T.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{project.name}</div>
          <div style={{ fontSize:11, color:T.textSub }}>{project.location || '—'}</div>
        </div>
        <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4, flexShrink:0 }}>
          <SBadge status={project.status}/>
          <span style={{ fontSize:11, color:T.textSub }}>{project.progress_pct||0}%</span>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={() => navigate(`/projects/${project.id}`)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background:T.card, borderRadius:12, padding:20, cursor:'pointer',
        border:`1px solid ${hovered ? sc.color+'60' : T.border}`,
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
        boxShadow: hovered ? T.shadowMd : T.shadow,
        transition:'all 0.15s', position:'relative', overflow:'hidden',
      }}
    >
      <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:sc.color, opacity:0.7, borderRadius:'12px 12px 0 0' }}/>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12, marginTop:4 }}>
        <div style={{ display:'flex', gap:10, alignItems:'center', flex:1, minWidth:0 }}>
          <span style={{ fontSize:22, flexShrink:0 }}>{TYPE_ICONS[project.project_type]||'🔧'}</span>
          <div style={{ minWidth:0 }}>
            <div style={{ fontSize:14, fontWeight:700, color:T.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{project.name}</div>
            {project.location && <div style={{ fontSize:11, color:T.textSub, marginTop:1 }}>📍 {project.location}</div>}
          </div>
        </div>
        <SBadge status={project.status}/>
      </div>
      <div style={{ marginBottom:10 }}>
        <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:T.textSub, marginBottom:5 }}>
          <span>Avancement</span>
          <span style={{ fontWeight:700, color:T.orange }}>{project.progress_pct||0}%</span>
        </div>
        <Pbar pct={project.progress_pct||0}/>
      </div>
      {showBudget && project.budget && (
        <div>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:T.textSub, marginBottom:5 }}>
            <span>Budget</span>
            <span style={{ fontWeight:600, color:budgetPct>85?T.red:T.text }}>{budgetPct}%</span>
          </div>
          <Pbar pct={budgetPct} color={budgetPct>85?T.red:T.orange}/>
          <div style={{ fontSize:10, color:T.textMuted, marginTop:3 }}>
            {fmtM(project.actual_expenses)} / {fmtM(project.budget)} FCFA
          </div>
        </div>
      )}
      <div style={{ display:'flex', gap:16, marginTop:12, paddingTop:12, borderTop:`1px solid ${T.border}` }}>
        <div style={{ fontSize:11, color:T.textSub }}>📄 {project.contracts_count||0} contrat{(project.contracts_count||0)!==1?'s':''}</div>
        {project.end_date && (
          <div style={{ fontSize:11, color:new Date(project.end_date)<new Date()&&project.status!=='termine'?T.red:T.textSub }}>
            🗓 Fin: {new Date(project.end_date).toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric'})}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── PROJECT SECTION (shared header for all dashboards) ───────────────────────
function ProjectSection({ projects, showBudget=false, role }) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const filtered = projects.filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) || (p.location||'').toLowerCase().includes(search.toLowerCase())
  );

  // Roles that see full card grid vs compact list
  const useGrid = ['directeur_general','admin_entreprise','directeur_technique','office_admin','chef_projet','comptable'].includes(role);

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <h2 style={{ fontSize:16, fontWeight:700, color:T.text, margin:0 }}>
          {['directeur_general','admin_entreprise','directeur_technique','office_admin'].includes(role)
            ? `Tous les projets (${projects.length})`
            : `Mes projets (${projects.length})`}
        </h2>
        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
          <input
            placeholder="Rechercher..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ padding:'7px 12px', borderRadius:8, border:`1px solid ${T.border}`, fontSize:12, color:T.text, outline:'none', fontFamily:'inherit', background:'#fff' }}
          />
          <button onClick={() => navigate('/projects')}
            style={{ padding:'7px 16px', borderRadius:8, background:T.orangeLight, border:`1px solid ${T.orange}30`, color:T.orange, fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
            Tout voir →
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card style={{ textAlign:'center', padding:'32px' }}>
          <div style={{ fontSize:32, marginBottom:8 }}>🏗️</div>
          <div style={{ fontSize:13, color:T.textSub }}>
            {search ? 'Aucun résultat' : 'Aucun projet assigné'}
          </div>
        </Card>
      ) : useGrid ? (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:16 }}>
          {filtered.slice(0,6).map(p => <ProjectCard key={p.id} project={p} showBudget={showBudget}/>)}
        </div>
      ) : (
        <Card>
          {filtered.slice(0,8).map(p => <ProjectCard key={p.id} project={p} compact/>)}
          {filtered.length > 8 && (
            <div style={{ paddingTop:12, textAlign:'center' }}>
              <button onClick={() => navigate('/projects')}
                style={{ fontSize:12, color:T.orange, fontWeight:600, background:'none', border:'none', cursor:'pointer' }}>
                Voir {filtered.length - 8} autres →
              </button>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

// ─── ROLE DASHBOARDS ──────────────────────────────────────────────────────────

function DashboardAppOwner({ stats, companies }) {
  const navigate = useNavigate();
  const comps = companies.length > 0 ? companies : [];
  return (
    <div style={{ padding:32 }}>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:28 }}>
        <KPI icon="🏢" label="Entreprises actives" value={comps.filter(c=>c.is_active).length} color={T.orange} trend={`${comps.length} total`}/>
        <KPI icon="🏗️" label="Projets plateforme"  value={stats?.total_projects||0}             color={T.blue}/>
        <KPI icon="👥" label="Utilisateurs"         value={stats?.total_users||0}                color={T.green}/>
        <KPI icon="💳" label="Abonnements actifs"   value={comps.filter(c=>c.is_active&&c.subscription!=='trial').length} color={T.purple}/>
      </div>
      <Card>
        <div style={{ fontSize:14, fontWeight:700, color:T.text, marginBottom:16 }}>Entreprises abonnées</div>
        {comps.length === 0 ? (
          <div style={{ textAlign:'center', padding:'24px 0', color:T.textMuted, fontSize:13 }}>Aucune entreprise</div>
        ) : comps.slice(0,8).map(c => {
          const planColor = {pro:T.blue,enterprise:T.purple,starter:T.textSub,trial:T.yellow}[c.subscription]||T.textSub;
          return (
            <div key={c.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 0', borderBottom:`1px solid ${T.border}` }}>
              <div style={{ flex:1, fontSize:13, fontWeight:600, color:T.text }}>{c.name}</div>
              <span style={{ fontSize:11, padding:'2px 9px', borderRadius:100, background:`${planColor}15`, color:planColor, fontWeight:600 }}>{c.subscription}</span>
              <span style={{ fontSize:11, padding:'2px 9px', borderRadius:100, background:c.is_active?T.greenLight:T.redLight, color:c.is_active?T.green:T.red, fontWeight:600 }}>{c.is_active?'Actif':'Inactif'}</span>
              <button onClick={()=>navigate('/companies')} style={{ padding:'4px 10px', borderRadius:6, border:`1px solid ${T.border}`, background:'#fff', color:T.textSub, fontSize:11, cursor:'pointer', fontFamily:'inherit' }}>Gérer</button>
            </div>
          );
        })}
        <div style={{ marginTop:14, textAlign:'right' }}>
          <button onClick={()=>navigate('/companies')} style={{ padding:'8px 18px', borderRadius:8, background:T.orange, color:'#fff', fontSize:12, fontWeight:600, border:'none', cursor:'pointer', fontFamily:'inherit' }}>
            Toutes les entreprises →
          </button>
        </div>
      </Card>
    </div>
  );
}

function DashboardDirecteurGeneral({ projects, stats, offSiteAlerts }) {
  const navigate = useNavigate();
  const en_cours = projects.filter(p=>p.status==='en_cours');
  const delayed  = projects.filter(p=>p.is_delayed);
  const totalBudget  = projects.reduce((a,p)=>a+(parseFloat(p.budget)||0),0);
  const totalExpenses= projects.reduce((a,p)=>a+(parseFloat(p.actual_expenses)||0),0);
  const globalPct    = totalBudget>0 ? Math.round((totalExpenses/totalBudget)*100) : 0;

  return (
    <div style={{ padding:32, display:'flex', flexDirection:'column', gap:28 }}>
      {delayed.length>0 && (
        <div style={{ padding:'12px 16px', background:T.yellowLight, border:`1px solid ${T.yellow}40`, borderRadius:10, fontSize:13, color:'#92400E', fontWeight:500 }}>
          ⚠️ {delayed.length} projet{delayed.length>1?'s':''} en retard — action requise
        </div>
      )}
      {offSiteAlerts.length>0 && (
        <div style={{ padding:'12px 16px', background:T.redLight, border:`1px solid ${T.red}40`, borderRadius:10, fontSize:13, color:T.red, fontWeight:500 }}>
          📍 {offSiteAlerts.length} pointage{offSiteAlerts.length>1?'s':''} hors-site aujourd'hui
        </div>
      )}

      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16 }}>
        <KPI icon="🏗️" label="Projets en cours" value={en_cours.length} color={T.orange} sub={`${projects.length} total`}/>
        <KPI icon="💰" label="Budget consommé"   value={`${globalPct}%`} alert={globalPct>90} color={T.orange} sub={`${fmtM(totalExpenses)} / ${fmtM(totalBudget)} FCFA`}/>
        <KPI icon="⚠️" label="Projets en retard" value={delayed.length} alert={delayed.length>0} color={T.red}/>
        <KPI icon="📄" label="Contrats liés"     value={projects.reduce((a,p)=>a+(p.contracts_count||0),0)} color={T.blue}/>
      </div>

      {/* Projects grid */}
      <ProjectSection projects={projects} showBudget={true} role="directeur_general"/>

      {/* Quick actions */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
        {[
          ['➕ Nouveau projet', '/projects/new', T.orange],
          ['📅 Planning', '/planning', T.blue],
          ['🏦 Trésorerie', '/treasury', T.green],
          ['📈 Rapports', '/reports', T.purple],
        ].map(([label,to,color])=>(
          <button key={to} onClick={()=>navigate(to)}
            style={{ padding:'12px', borderRadius:10, border:`1px solid ${color}30`, background:`${color}08`, color, fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function DashboardDirecteurTechnique({ projects }) {
  const navigate = useNavigate();
  const en_cours = projects.filter(p=>p.status==='en_cours');
  return (
    <div style={{ padding:32, display:'flex', flexDirection:'column', gap:28 }}>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16 }}>
        <KPI icon="🏗️" label="Projets suivis"   value={projects.length}     color={T.purple}/>
        <KPI icon="⚡"  label="En cours"          value={en_cours.length}    color={T.orange}/>
        <KPI icon="📐"  label="Plans techniques"  value={8}                  color={T.blue} sub="Documents actifs"/>
      </div>
      <ProjectSection projects={projects} role="directeur_technique"/>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12 }}>
        {[
          ['📅 Planning', '/planning', T.blue],
          ['🛡️ QHSE / Normes', '/qhse', T.red],
          ['📁 Documents', '/documents', T.green],
        ].map(([label,to,color])=>(
          <button key={to} onClick={()=>navigate(to)}
            style={{ padding:'12px', borderRadius:10, border:`1px solid ${color}30`, background:`${color}08`, color, fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function DashboardOfficeAdmin({ projects, team, workers }) {
  const navigate = useNavigate();
  return (
    <div style={{ padding:32, display:'flex', flexDirection:'column', gap:28 }}>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16 }}>
        <KPI icon="🏗️" label="Projets"         value={projects.length}                         color={T.orange}/>
        <KPI icon="👥" label="Membres équipe"   value={team.length}                             color={T.blue}/>
        <KPI icon="👷" label="Ouvriers actifs"  value={workers.filter(w=>w.is_active).length}  color={T.green}/>
        <KPI icon="📋" label="Pointages auj."   value="—"                                      color={T.purple}/>
      </div>
      <ProjectSection projects={projects} role="office_admin"/>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
        <Card>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
            <div style={{ fontSize:14, fontWeight:700, color:T.text }}>Équipe récente</div>
            <button onClick={()=>navigate('/team')} style={{ fontSize:12, color:T.orange, fontWeight:600, background:'none', border:'none', cursor:'pointer' }}>Gérer</button>
          </div>
          {team.slice(0,5).map(m=>(
            <div key={m.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0', borderBottom:`1px solid ${T.border}` }}>
              <div style={{ width:30, height:30, borderRadius:'50%', background:T.orangeLight, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color:T.orange }}>
                {(m.full_name||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:12, fontWeight:600, color:T.text }}>{m.full_name}</div>
                <div style={{ fontSize:10, color:T.textMuted }}>{m.platform_role_display||m.platform_role}</div>
              </div>
              <span style={{ fontSize:10, padding:'2px 7px', borderRadius:100, background:m.is_active?T.greenLight:T.redLight, color:m.is_active?T.green:T.red, fontWeight:600 }}>
                {m.is_active?'Actif':'Inactif'}
              </span>
            </div>
          ))}
        </Card>
        <Card>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
            <div style={{ fontSize:14, fontWeight:700, color:T.text }}>Ouvriers récents</div>
            <button onClick={()=>navigate('/workers')} style={{ fontSize:12, color:T.orange, fontWeight:600, background:'none', border:'none', cursor:'pointer' }}>Gérer</button>
          </div>
          {workers.slice(0,5).map(w=>(
            <div key={w.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0', borderBottom:`1px solid ${T.border}` }}>
              <span style={{ fontSize:18 }}>👷</span>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:12, fontWeight:600, color:T.text }}>{w.first_name} {w.last_name}</div>
                <div style={{ fontSize:10, color:T.textMuted }}>{w.trade_display||w.trade}</div>
              </div>
              <span style={{ fontSize:10, padding:'2px 7px', borderRadius:100, background:w.is_active?T.greenLight:T.redLight, color:w.is_active?T.green:T.red, fontWeight:600 }}>
                {w.is_active?'Actif':'Inactif'}
              </span>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

function DashboardChefProjet({ projects }) {
  const navigate = useNavigate();
  const en_cours = projects.filter(p=>p.status==='en_cours');
  const delayed  = projects.filter(p=>p.is_delayed);
  const totalBudget   = projects.reduce((a,p)=>a+(parseFloat(p.budget)||0),0);
  const totalExpenses = projects.reduce((a,p)=>a+(parseFloat(p.actual_expenses)||0),0);
  const globalPct     = totalBudget>0 ? Math.round((totalExpenses/totalBudget)*100) : 0;

  return (
    <div style={{ padding:32, display:'flex', flexDirection:'column', gap:28 }}>
      {delayed.length>0 && (
        <div style={{ padding:'12px 16px', background:T.yellowLight, border:`1px solid ${T.yellow}40`, borderRadius:10, fontSize:13, color:'#92400E', fontWeight:500 }}>
          ⚠️ {delayed.length} projet{delayed.length>1?'s':''} en retard
        </div>
      )}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16 }}>
        <KPI icon="🏗️" label="Mes projets"     value={projects.length}   color={T.orange}/>
        <KPI icon="⚡"  label="En cours"         value={en_cours.length}  color={T.yellow}/>
        <KPI icon="💰"  label="Budget consommé"  value={`${globalPct}%`}  alert={globalPct>90} color={T.orange}/>
        <KPI icon="⚠️"  label="En retard"        value={delayed.length}   alert={delayed.length>0} color={T.red}/>
      </div>
      <ProjectSection projects={projects} showBudget={true} role="chef_projet"/>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
        {[['📅 Planning','/planning',T.blue],['💰 Budget','/budget',T.orange],['🛡️ QHSE','/qhse',T.red],['📈 Rapports','/reports',T.green]].map(([l,to,c])=>(
          <button key={to} onClick={()=>navigate(to)} style={{ padding:'12px', borderRadius:10, border:`1px solid ${c}30`, background:`${c}08`, color:c, fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>{l}</button>
        ))}
      </div>
    </div>
  );
}

function DashboardChefChantier({ projects, attendance }) {
  const navigate = useNavigate();
  const today = new Date().toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'});
  return (
    <div style={{ padding:32, display:'flex', flexDirection:'column', gap:28 }}>
      <Card p={20}>
        <div style={{ fontSize:12, color:T.textSub, marginBottom:12, fontWeight:500, textTransform:'capitalize' }}>{today}</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:0, borderTop:`1px solid ${T.border}`, paddingTop:16 }}>
          {[
            [attendance?.workers_in||0,'Présents',T.green],
            [attendance?.workers_out||0,'Sortis',T.blue],
            [attendance?.off_site_alerts||0,'Hors site',T.red],
            [projects.length,'Chantiers',T.orange],
          ].map(([v,l,c],i)=>(
            <div key={i} style={{ textAlign:'center', borderRight:i<3?`1px solid ${T.border}`:'none' }}>
              <div style={{ fontSize:28, fontWeight:800, color:c }}>{v}</div>
              <div style={{ fontSize:11, color:T.textSub, marginTop:2 }}>{l}</div>
            </div>
          ))}
        </div>
      </Card>
      <ProjectSection projects={projects} role="chef_chantier"/>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
        <button onClick={()=>navigate('/pointage')} style={{ padding:'14px', borderRadius:10, background:T.green, color:'#fff', fontSize:14, fontWeight:700, border:'none', cursor:'pointer', fontFamily:'inherit' }}>📍 Pointer mon équipe</button>
        <button onClick={()=>navigate('/reports')}  style={{ padding:'14px', borderRadius:10, background:T.orange, color:'#fff', fontSize:14, fontWeight:700, border:'none', cursor:'pointer', fontFamily:'inherit' }}>📝 Nouveau rapport journalier</button>
      </div>
    </div>
  );
}

function DashboardChefEquipe({ projects, attendance }) {
  const navigate = useNavigate();
  return (
    <div style={{ padding:32, display:'flex', flexDirection:'column', gap:28 }}>
      <div style={{ padding:'12px 16px', background:T.blueLight, border:`1px solid ${T.blue}30`, borderRadius:10, fontSize:13, color:T.blue, fontWeight:500 }}>
        ℹ️ Vous avez accès au pointage GPS de votre équipe uniquement.
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16 }}>
        <KPI icon="🏗️" label="Chantiers"        value={projects.length}              color={T.orange}/>
        <KPI icon="✅"  label="Présents auj."    value={attendance?.workers_in||0}    color={T.green}/>
        <KPI icon="⚠️"  label="Hors-site"        value={attendance?.off_site_alerts||0} alert={(attendance?.off_site_alerts||0)>0} color={T.red}/>
      </div>
      <ProjectSection projects={projects} role="chef_equipe"/>
      <button onClick={()=>navigate('/pointage')} style={{ padding:'16px', borderRadius:10, background:T.green, color:'#fff', fontSize:15, fontWeight:700, border:'none', cursor:'pointer', fontFamily:'inherit' }}>
        📍 Pointer mon équipe maintenant
      </button>
    </div>
  );
}

function DashboardIngenieur({ projects }) {
  const navigate = useNavigate();
  return (
    <div style={{ padding:32, display:'flex', flexDirection:'column', gap:28 }}>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16 }}>
        <KPI icon="🏗️" label="Projets suivis"  value={projects.length}                               color={T.green}/>
        <KPI icon="⚡"  label="En cours"         value={projects.filter(p=>p.status==='en_cours').length} color={T.orange}/>
        <KPI icon="📁"  label="Documents"         value={8}                                            color={T.blue} sub="Plans techniques"/>
      </div>
      <ProjectSection projects={projects} role="ingenieur"/>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
        <button onClick={()=>navigate('/documents')} style={{ padding:'12px', borderRadius:10, border:`1px solid ${T.blue}30`, background:T.blueLight, color:T.blue, fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>📁 Mes documents</button>
        <button onClick={()=>navigate('/planning')}  style={{ padding:'12px', borderRadius:10, border:`1px solid ${T.orange}30`, background:T.orangeLight, color:T.orange, fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>📅 Planning</button>
      </div>
    </div>
  );
}

function DashboardQHSE({ projects }) {
  const navigate = useNavigate();
  return (
    <div style={{ padding:32, display:'flex', flexDirection:'column', gap:28 }}>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16 }}>
        <Card p={20}><div style={{ fontSize:12,color:T.textSub,marginBottom:4 }}>Conformités</div><div style={{ fontSize:28,fontWeight:800,color:T.green }}>18/20</div><div style={{ fontSize:11,color:T.green }}>Score 90%</div><Pbar pct={90} color={T.green} h={6}/></Card>
        <Card p={20}><div style={{ fontSize:12,color:T.textSub,marginBottom:4 }}>Non-conformités</div><div style={{ fontSize:28,fontWeight:800,color:T.red }}>2</div><div style={{ fontSize:11,color:T.red }}>Action requise</div></Card>
        <Card p={20}><div style={{ fontSize:12,color:T.textSub,marginBottom:4 }}>Réserves levées</div><div style={{ fontSize:28,fontWeight:800,color:T.yellow }}>7/9</div><div style={{ fontSize:11,color:T.yellow }}>Cette semaine</div><Pbar pct={77} color={T.yellow} h={6}/></Card>
      </div>
      <ProjectSection projects={projects} role="qhse"/>
      <button onClick={()=>navigate('/qhse')} style={{ padding:'12px', borderRadius:10, background:T.red, color:'#fff', fontSize:13, fontWeight:600, border:'none', cursor:'pointer', fontFamily:'inherit' }}>
        🛡️ Accéder aux checklists QHSE
      </button>
    </div>
  );
}

function DashboardMagasinier({ projects }) {
  const navigate = useNavigate();
  return (
    <div style={{ padding:32, display:'flex', flexDirection:'column', gap:28 }}>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16 }}>
        <KPI icon="🏗️" label="Chantiers" value={projects.length} color={T.orange}/>
        <KPI icon="📦" label="Livraisons récentes" value="—" color={T.green}/>
        <KPI icon="⏳" label="Cmdes en attente"    value="—" color={T.yellow}/>
      </div>
      <ProjectSection projects={projects} role="magasinier"/>
      <button onClick={()=>navigate('/stock')} style={{ padding:'12px', borderRadius:10, background:T.orange, color:'#fff', fontSize:13, fontWeight:600, border:'none', cursor:'pointer', fontFamily:'inherit' }}>
        📦 Gérer les stocks et livraisons
      </button>
    </div>
  );
}

function DashboardComptable({ projects }) {
  const navigate = useNavigate();
  const totalBudget   = projects.reduce((a,p)=>a+(parseFloat(p.budget)||0),0);
  const totalExpenses = projects.reduce((a,p)=>a+(parseFloat(p.actual_expenses)||0),0);
  const pct = totalBudget>0?Math.round((totalExpenses/totalBudget)*100):0;
  return (
    <div style={{ padding:32, display:'flex', flexDirection:'column', gap:28 }}>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16 }}>
        <KPI icon="💼" label="Budget total"     value={fmtM(totalBudget)+' FCFA'}    color={T.text}/>
        <KPI icon="💸" label="Dépenses"          value={fmtM(totalExpenses)+' FCFA'} color={T.orange} sub={`${pct}% du budget`} alert={pct>90}/>
        <KPI icon="✅" label="Disponible"        value={fmtM(totalBudget-totalExpenses)+' FCFA'} color={T.green}/>
        <KPI icon="🏗️" label="Projets suivis"   value={projects.length} color={T.blue}/>
      </div>
      <ProjectSection projects={projects} showBudget={true} role="comptable"/>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
        <button onClick={()=>navigate('/budget')}   style={{ padding:'12px', borderRadius:10, border:`1px solid ${T.orange}30`, background:T.orangeLight, color:T.orange, fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>💰 Budget & Achats</button>
        <button onClick={()=>navigate('/treasury')} style={{ padding:'12px', borderRadius:10, border:`1px solid ${T.green}30`, background:T.greenLight, color:T.green, fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>🏦 Trésorerie</button>
      </div>
    </div>
  );
}

function DashboardClient({ projects }) {
  const navigate = useNavigate();
  const activeP  = projects.find(p=>p.status==='en_cours') || projects[0];
  return (
    <div style={{ padding:32, display:'flex', flexDirection:'column', gap:28 }}>
      <div style={{ padding:'12px 16px', background:T.blueLight, border:`1px solid ${T.blue}30`, borderRadius:10, fontSize:13, color:T.blue, fontWeight:500 }}>
        🏛️ Accès Maître d'Ouvrage — consultation de l'avancement de vos projets
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16 }}>
        <KPI icon="📊" label="Avancement global" value={`${activeP?.progress_pct||0}%`} color={T.orange}/>
        <KPI icon="🏗️" label="Mes projets"       value={projects.length}                color={T.blue}/>
        <KPI icon="📄" label="Rapports valides"   value="—"                             color={T.green}/>
      </div>
      <ProjectSection projects={projects} role="client"/>
      <button onClick={()=>navigate('/reports')} style={{ padding:'12px', borderRadius:10, background:T.blue, color:'#fff', fontSize:13, fontWeight:600, border:'none', cursor:'pointer', fontFamily:'inherit' }}>
        📄 Voir mes rapports et photos
      </button>
    </div>
  );
}

// ─── GREETING CONFIG ──────────────────────────────────────────────────────────
const GREETINGS = {
  app_owner:           'Tableau de bord Plateforme',
  directeur_general:   "Vue d'ensemble — Direction Générale",
  admin_entreprise:    "Vue d'ensemble — Direction",
  directeur_technique: "Vue d'ensemble — Direction Technique",
  office_admin:        "Vue d'ensemble — Ressources Humaines",
  chef_projet:         'Mes projets',
  chef_chantier:       'Journal de Chantier',
  chef_equipe:         "Mon équipe — Pointage",
  ingenieur:           'Documents & Plans techniques',
  qhse:                'Contrôle Qualité & Sécurité',
  magasinier:          'Stocks & Livraisons',
  comptable:           'Budget & Finances',
  client:              "Suivi de mon projet",
};

const CTA_ROUTES = {
  directeur_general:   [{label:'+ Nouveau projet',to:'/projects/new'},{label:'📈 Rapports',to:'/reports'}],
  admin_entreprise:    [{label:'+ Nouveau projet',to:'/projects/new'},{label:'📈 Rapports',to:'/reports'}],
  directeur_technique: [{label:'📅 Planning',to:'/planning'},{label:'🛡️ QHSE',to:'/qhse'}],
  office_admin:        [{label:'+ Inviter',to:'/team'},{label:'📋 Présences',to:'/attendance'}],
  chef_projet:         [{label:'📅 Planning',to:'/planning'},{label:'📈 Rapports',to:'/reports'}],
  chef_chantier:       [{label:'+ Rapport du jour',to:'/reports'},{label:'📍 Pointer',to:'/pointage'}],
  chef_equipe:         [{label:'📍 Pointer mon équipe',to:'/pointage'}],
  qhse:                [{label:'⚠️ Signaler incident',to:'/qhse'},{label:'📈 Rapports QHSE',to:'/reports'}],
  comptable:           [{label:'💰 Budget',to:'/budget'},{label:'🏦 Trésorerie',to:'/treasury'}],
  client:              [{label:'📄 Mes rapports',to:'/reports'}],
};

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { user }     = useAuth();
  const { role }     = usePermissions();
  const navigate     = useNavigate();

  const [projects,   setProjects]   = useState([]);
  const [stats,      setStats]      = useState(null);
  const [team,       setTeam]       = useState([]);
  const [workers,    setWorkers]    = useState([]);
  const [companies,  setCompanies]  = useState([]);
  const [attendance, setAttendance] = useState(null);
  const [offSite,    setOffSite]    = useState([]);
  const [loading,    setLoading]    = useState(true);

  useEffect(() => {
    const calls = [
      projectsAPI.list().catch(()=>({data:[]})),
      projectsAPI.getDashboardStats().catch(()=>({data:null})),
    ];
    const needsTeam    = ['app_owner','directeur_general','admin_entreprise','directeur_technique','office_admin'].includes(role);
    const needsWorkers = ['office_admin','directeur_general','admin_entreprise'].includes(role);
    const needsCompanies = role === 'app_owner';

    if (needsTeam)     calls.push(teamAPI.list().catch(()=>({data:[]})));
    if (needsWorkers)  calls.push(workersAPI.list().catch(()=>({data:[]})));
    if (needsCompanies)calls.push(companiesAPI.list().catch(()=>({data:[]})));

    Promise.all(calls).then(results => {
      const [pR, sR, ...rest] = results;
      setProjects(pR.data || []);
      setStats(sR.data);
      let i = 0;
      if (needsTeam)      { setTeam(rest[i]?.data||[]);      i++; }
      if (needsWorkers)   { setWorkers(rest[i]?.data||[]);   i++; }
      if (needsCompanies) { setCompanies(rest[i]?.data||[]); }
    }).finally(()=>setLoading(false));
  }, [role]);

  // Attendance for field roles
  useEffect(()=>{
    if (!['chef_chantier','chef_equipe'].includes(role)) return;
    if (!projects.length) return;
    attendanceAPI.summary(projects[0]?.id)
      .then(r=>setAttendance(r.data))
      .catch(()=>{});
  },[role,projects]);

  // Off-site alerts for directeurs
  useEffect(()=>{
    if (!['directeur_general','admin_entreprise','directeur_technique','chef_projet'].includes(role)) return;
    if (!projects.length) return;
    Promise.all(
      projects.filter(p=>p.status==='en_cours').map(p=>
        attendanceAPI.alerts(p.id).then(r=>r.data?.alerts||[]).catch(()=>[])
      )
    ).then(r=>setOffSite(r.flat()));
  },[role,projects]);

  const title    = GREETINGS[role] || 'Tableau de bord';
  const firstName= user?.full_name?.split(' ')[0] || 'Utilisateur';
  const ctaBtns  = CTA_ROUTES[role] || [];

  return (
    <AppLayout>
      {/* Top bar */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'0 32px', height:64, background:'#fff', borderBottom:`1px solid ${T.border}`, position:'sticky', top:0, zIndex:10 }}>
        <div>
          <h1 style={{ margin:0, fontSize:18, fontWeight:700, color:T.text }}>{title}</h1>
          <div style={{ fontSize:12, color:T.textMuted, marginTop:1 }}>Bonjour, {firstName} 👋</div>
        </div>
        <div style={{ display:'flex', gap:10 }}>
          {ctaBtns.map(({label,to})=>(
            <button key={to} onClick={()=>navigate(to)}
              style={{ padding:'9px 18px', borderRadius:9, background:T.orange, color:'#fff', fontSize:13, fontWeight:600, border:'none', cursor:'pointer', fontFamily:'inherit' }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:400, flexDirection:'column', gap:16 }}>
          <div style={{ width:36, height:36, border:`3px solid ${T.orange}`, borderTopColor:'transparent', borderRadius:'50%', animation:'spin 1s linear infinite' }}/>
          <span style={{ color:T.textSub, fontSize:13 }}>Chargement...</span>
        </div>
      ) : (
        <>
          {role === 'app_owner'           && <DashboardAppOwner          stats={stats} companies={companies}/>}
          {(role==='directeur_general'||role==='admin_entreprise') && <DashboardDirecteurGeneral projects={projects} stats={stats} offSiteAlerts={offSite}/>}
          {role === 'directeur_technique' && <DashboardDirecteurTechnique projects={projects}/>}
          {role === 'office_admin'        && <DashboardOfficeAdmin        projects={projects} team={team} workers={workers}/>}
          {role === 'chef_projet'         && <DashboardChefProjet         projects={projects}/>}
          {role === 'chef_chantier'       && <DashboardChefChantier       projects={projects} attendance={attendance}/>}
          {role === 'chef_equipe'         && <DashboardChefEquipe         projects={projects} attendance={attendance}/>}
          {role === 'ingenieur'           && <DashboardIngenieur          projects={projects}/>}
          {role === 'qhse'                && <DashboardQHSE               projects={projects}/>}
          {role === 'magasinier'          && <DashboardMagasinier         projects={projects}/>}
          {role === 'comptable'           && <DashboardComptable          projects={projects}/>}
          {role === 'client'              && <DashboardClient             projects={projects}/>}
        </>
      )}
    </AppLayout>
  );
}
