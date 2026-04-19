// frontend/src/pages/dashboard/DashboardPage.js
// FIXED:
// 1. No longer forces "Immeuble R+4" in title — shows role-appropriate greeting
// 2. Client "Télécharger rapport" buttons actually work
// 3. All CTA buttons are wired to correct routes
// 4. Rich mock data for all 11 roles when API returns empty
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { projectsAPI, teamAPI, workersAPI, attendanceAPI, companiesAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../context/PermissionsContext';
import AppLayout from '../../components/layout/AppLayout';
import toast from 'react-hot-toast';

const T = {
  bg:'#F8F9FA', card:'#FFFFFF', border:'#E8EDF2',
  text:'#1a1f2e', textSub:'#6B7888', textMuted:'#A0ADB8',
  orange:'#F97316', orangeLight:'rgba(249,115,22,0.1)',
  green:'#10B981', greenLight:'rgba(16,185,129,0.1)',
  red:'#EF4444', redLight:'rgba(239,68,68,0.08)',
  blue:'#3B82F6', blueLight:'rgba(59,130,246,0.1)',
  yellow:'#F59E0B', yellowLight:'rgba(245,158,11,0.1)',
  purple:'#8B5CF6',
  shadow:'0 1px 3px rgba(0,0,0,0.06)',
};

const fmtFCFA = n => {
  if (n == null) return '—';
  const v = parseFloat(n);
  if (v >= 1e9) return `${(v/1e9).toFixed(1)}Mrd`;
  if (v >= 1e6) return `${(v/1e6).toFixed(0)}M`;
  if (v >= 1e3) return `${(v/1e3).toFixed(0)}K`;
  return v.toLocaleString('fr-FR');
};
const fmtDs = d => { if(!d) return '—'; return new Date(d+'T00:00:00').toLocaleDateString('fr-FR',{day:'2-digit',month:'short'}); };

const STATUS_CFG = {
  planifie:{ label:'Planifié', color:'#6366F1', bg:'rgba(99,102,241,0.1)' },
  en_cours:{ label:'En cours', color:'#F97316', bg:'rgba(249,115,22,0.1)' },
  suspendu:{ label:'Suspendu', color:'#EF4444', bg:'rgba(239,68,68,0.1)'  },
  termine: { label:'Terminé',  color:'#10B981', bg:'rgba(16,185,129,0.1)' },
};

// ── Mock data for demo/offline ────────────────────────────────────────────────
const MOCK_PROJECTS = [
  { id:'mock-1', name:'Construction Immeuble R+4 Hamdallaye ACI 2000', project_type:'batiment', status:'en_cours', location:'Hamdallaye ACI 2000, Bamako', progress_pct:37, start_date:'2024-03-01', end_date:'2025-09-30', budget:850000000, actual_expenses:312500000, is_delayed:false, contracts_count:2 },
  { id:'mock-2', name:'Réhabilitation Route Nationale RN6', project_type:'route', status:'planifie', location:'Ségou — San', progress_pct:0, start_date:'2025-02-01', end_date:'2027-01-31', budget:2400000000, actual_expenses:0, is_delayed:false, contracts_count:1 },
  { id:'mock-3', name:"Adduction d'eau potable — Kati", project_type:'aep', status:'termine', location:'Kati, Mali', progress_pct:100, start_date:'2023-06-01', end_date:'2024-02-28', budget:185000000, actual_expenses:178200000, is_delayed:false, contracts_count:3 },
  { id:'mock-4', name:'Pont sur le Bani — Djenné', project_type:'pont', status:'suspendu', location:'Djenné, Mopti', progress_pct:8, start_date:'2024-02-01', end_date:'2026-06-30', budget:1200000000, actual_expenses:98500000, is_delayed:true, contracts_count:1 },
];

const MOCK_TEAM = [
  { id:'t1', full_name:'Seydou Keïta',       platform_role:'chef_chantier', platform_role_display:'Chef de Chantier',    is_active:true,  email:'chef.chantier@btpmali.ml' },
  { id:'t2', full_name:'Ibrahim Traoré',      platform_role:'chef_projet',   platform_role_display:'Chef de Projet',       is_active:true,  email:'chef.projet@btpmali.ml' },
  { id:'t3', full_name:'Dr. Moussa Coulibaly',platform_role:'ingenieur',     platform_role_display:'Ingénieur',            is_active:true,  email:'ingenieur@btpmali.ml' },
  { id:'t4', full_name:'Aminata Sanogo',      platform_role:'qhse',          platform_role_display:'Resp. QHSE',          is_active:true,  email:'qhse@btpmali.ml' },
  { id:'t5', full_name:'Fatoumata Sissoko',   platform_role:'comptable',     platform_role_display:'Comptable',           is_active:true,  email:'finance@btpmali.ml' },
  { id:'t6', full_name:'Oumar Coulibaly',     platform_role:'chef_equipe',   platform_role_display:"Chef d'Équipe",       is_active:true,  email:'chef.equipe@btpmali.ml' },
  { id:'t7', full_name:'Boubacar Dembélé',    platform_role:'magasinier',    platform_role_display:'Magasinier',          is_active:false, email:'magasin@btpmali.ml' },
  { id:'t8', full_name:'Col. Mamadou Bah',    platform_role:'client',        platform_role_display:"Client / MO",        is_active:true,  email:'client@btpmali.ml' },
];

const MOCK_WORKERS = [
  { id:'w1', first_name:'Mamadou', last_name:'Coulibaly', trade:'maconnerie',  trade_display:'Maçonnerie',   daily_rate:8000,  is_active:true  },
  { id:'w2', first_name:'Boubacar',last_name:'Traoré',    trade:'ferraillage', trade_display:'Ferraillage',  daily_rate:9000,  is_active:true  },
  { id:'w3', first_name:'Seydou',  last_name:'Diarra',    trade:'coffrage',    trade_display:'Coffrage',     daily_rate:8500,  is_active:true  },
  { id:'w4', first_name:'Moussa',  last_name:'Sanogo',    trade:'maconnerie',  trade_display:'Maçonnerie',   daily_rate:8000,  is_active:true  },
  { id:'w5', first_name:'Ibrahim', last_name:'Keïta',     trade:'manoeuvre',   trade_display:'Manœuvre',     daily_rate:6500,  is_active:true  },
  { id:'w6', first_name:'Oumar',   last_name:'Bah',       trade:'manoeuvre',   trade_display:'Manœuvre',     daily_rate:6500,  is_active:false },
  { id:'w7', first_name:'Drissa',  last_name:'Camara',    trade:'carrelage',   trade_display:'Carrelage',    daily_rate:9500,  is_active:true  },
  { id:'w8', first_name:'Modibo',  last_name:'Sissoko',   trade:'peinture',    trade_display:'Peinture',     daily_rate:8000,  is_active:true  },
];

const MOCK_PURCHASES = [
  { designation:'Béton BPE B25 — Lot 3', fournisseur:'CIMAF Mali',      quantite:28, unite:'m³', prix_unitaire:85000, total:2380000,  date_commande:'2025-01-25', date_livraison:'2025-01-25', statut:'livre',    project_name:'Immeuble R+4' },
  { designation:'Ferraillage HA16',       fournisseur:'Aciers du Sahel', quantite:850,unite:'kg', prix_unitaire:1200,  total:1020000,  date_commande:'2025-01-20', date_livraison:'2025-01-22', statut:'livre',    project_name:'Immeuble R+4' },
  { designation:'Parpaings 20x20x40',     fournisseur:'Briqueterie BKO', quantite:2000,unite:'u', prix_unitaire:320,   total:640000,   date_commande:'2025-02-01', date_livraison:'2025-02-05', statut:'commande', project_name:'Immeuble R+4' },
  { designation:'Ciment CEM II — 200 sac',fournisseur:'Diamou Ciments',  quantite:200, unite:'sac',prix_unitaire:12500, total:2500000,  date_commande:'2025-02-10', date_livraison:null,         statut:'en_attente',project_name:'Route RN6'    },
  { designation:'Silicone Sika 50 cart.', fournisseur:'Sika Mali',       quantite:50,  unite:'u', prix_unitaire:8500,  total:425000,   date_commande:'2025-02-15', date_livraison:'2025-02-20', statut:'livre',    project_name:'Immeuble R+4' },
];

// ── Shared components ─────────────────────────────────────────────────────────
function Card({ children, style={}, p=24 }) {
  return <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:12, padding:p, boxShadow:T.shadow, ...style }}>{children}</div>;
}

function CardTitle({ children, badge, badgeColor }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
      <h3 style={{ margin:0, fontSize:14, fontWeight:600, color:T.text }}>{children}</h3>
      {badge && <span style={{ padding:'3px 10px', borderRadius:100, fontSize:11, fontWeight:600, background:`${badgeColor||T.orange}18`, color:badgeColor||T.orange }}>{badge}</span>}
    </div>
  );
}

function KPI({ label, value, sub, color=T.orange, alert, trend }) {
  return (
    <Card p={20}>
      <div style={{ fontSize:12, color:T.textSub, marginBottom:6, fontWeight:500 }}>{label}</div>
      <div style={{ fontSize:28, fontWeight:800, color:alert?T.red:color, lineHeight:1, marginBottom:3 }}>{value??'—'}</div>
      {trend && <div style={{ fontSize:11, color:trend.startsWith('+')?T.green:T.red, fontWeight:600, marginBottom:3 }}>{trend}</div>}
      {sub   && <div style={{ fontSize:11, color:alert?T.red:T.textSub }}>{sub}</div>}
      <div style={{ height:3, background:T.border, borderRadius:2, marginTop:12, overflow:'hidden' }}>
        <div style={{ height:'100%', width:'60%', background:alert?T.red:color, borderRadius:2 }}/>
      </div>
    </Card>
  );
}

function AlertBanner({ text, type='warning' }) {
  const m = {
    warning:{ bg:'#FFFBEB', border:'#FDE68A', color:'#92400E', icon:'⚠' },
    danger: { bg:'#FEF2F2', border:'#FECACA', color:'#991B1B', icon:'⚠' },
    info:   { bg:'#EFF6FF', border:'#BFDBFE', color:'#1E40AF', icon:'ℹ' },
    success:{ bg:'#F0FDF4', border:'#BBF7D0', color:'#166534', icon:'✓' },
  }[type];
  return (
    <div style={{ background:m.bg, border:`1px solid ${m.border}`, borderRadius:8, padding:'12px 16px', marginBottom:20, fontSize:13, color:m.color, display:'flex', alignItems:'flex-start', gap:10 }}>
      <span style={{ fontSize:14, marginTop:1, flexShrink:0 }}>{m.icon}</span>
      <span>{text}</span>
    </div>
  );
}

function Pbar({ pct, color=T.orange, h=6 }) {
  return (
    <div style={{ height:h, background:T.border, borderRadius:h, overflow:'hidden' }}>
      <div style={{ height:'100%', width:`${Math.min(100,pct||0)}%`, background:color, borderRadius:h, transition:'width 0.6s' }}/>
    </div>
  );
}

function SBadge({ status }) {
  const c = STATUS_CFG[status] || STATUS_CFG.planifie;
  return <span style={{ padding:'3px 10px', borderRadius:100, fontSize:11, fontWeight:600, color:c.color, background:c.bg }}>{c.label}</span>;
}

function Av({ name, size=32 }) {
  const init = name ? name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase() : '?';
  const colors = ['#F97316','#8B5CF6','#10B981','#3B82F6','#EF4444','#F59E0B','#06B6D4'];
  return (
    <div style={{ width:size, height:size, borderRadius:'50%', background:colors[(name?.charCodeAt(0)||0)%colors.length], display:'flex', alignItems:'center', justifyContent:'center', fontSize:size*0.35, fontWeight:700, color:'#fff', flexShrink:0 }}>
      {init}
    </div>
  );
}

function Empty({ icon, text }) {
  return <div style={{ textAlign:'center', padding:'28px 0', color:T.textMuted }}><div style={{ fontSize:28, marginBottom:8 }}>{icon}</div><div style={{ fontSize:13 }}>{text}</div></div>;
}

function GanttBar({ name, pct, color=T.orange }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
      <div style={{ width:140, fontSize:13, color:T.text, flexShrink:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{name}</div>
      <div style={{ flex:1, height:22, background:'#F1F3F5', borderRadius:4, overflow:'hidden', position:'relative' }}>
        <div style={{ position:'absolute', left:0, top:0, height:'100%', width:`${pct}%`, background:color, borderRadius:4, transition:'width 0.6s' }}/>
        <div style={{ position:'absolute', left:'65%', top:0, width:2, height:'100%', background:'#CBD5E0' }}/>
      </div>
      <div style={{ width:36, fontSize:13, color:T.textSub, fontWeight:600, textAlign:'right', flexShrink:0 }}>{pct}%</div>
    </div>
  );
}

function Donut({ pct, color=T.orange }) {
  const r=38, C=2*Math.PI*r, offset=C-(pct/100)*C;
  return (
    <div style={{ position:'relative', display:'inline-flex', alignItems:'center', justifyContent:'center' }}>
      <svg width={100} height={100}>
        <circle cx={50} cy={50} r={r} fill="none" stroke={T.border} strokeWidth={8}/>
        <circle cx={50} cy={50} r={r} fill="none" stroke={color} strokeWidth={8} strokeDasharray={C} strokeDashoffset={offset} strokeLinecap="round" transform="rotate(-90 50 50)" style={{ transition:'stroke-dashoffset 0.6s' }}/>
      </svg>
      <div style={{ position:'absolute', textAlign:'center' }}>
        <div style={{ fontSize:14, fontWeight:800, color:T.text }}>{pct}%</div>
        <div style={{ fontSize:9, color:T.textMuted }}>utilisé</div>
      </div>
    </div>
  );
}

const PURCH_ST = {
  livre:     { label:'Livré',    color:'#10B981', bg:'#ECFDF5' },
  commande:  { label:'Commandé', color:'#3B82F6', bg:'#EFF6FF' },
  en_attente:{ label:'Attente',  color:'#F59E0B', bg:'#FFFBEB' },
  annule:    { label:'Annulé',   color:'#EF4444', bg:'#FEF2F2' },
};
function PBadge({ statut }) {
  const s = PURCH_ST[statut] || { label:statut, color:T.textSub, bg:T.border };
  return <span style={{ padding:'3px 10px', borderRadius:100, fontSize:11, fontWeight:600, color:s.color, background:s.bg }}>{s.label}</span>;
}

// ── Download helper (works for client & all roles) ────────────────────────────
function downloadReport(title, content) {
  const blob = new Blob([content], { type:'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${title.replace(/[^a-z0-9]/gi,'_')}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast.success('Rapport téléchargé ✓');
}

// ══════════════════════════════════════════════════════════════════════════════
// ROLE DASHBOARDS
// ══════════════════════════════════════════════════════════════════════════════

function DashboardAppOwner({ stats, companies }) {
  const navigate = useNavigate();
  const comps = companies.length > 0 ? companies : [
    { id:'1', name:'BTP Mali Construction',  subscription:'pro',        projects_count:5,  is_active:true  },
    { id:'2', name:'Construire Sahel SA',    subscription:'enterprise', projects_count:12, is_active:true  },
    { id:'3', name:'BTPKO Bamako',           subscription:'starter',    projects_count:2,  is_active:true  },
    { id:'4', name:'Mali Infrastructures',   subscription:'pro',        projects_count:8,  is_active:true  },
    { id:'5', name:'Segou BTP SARL',         subscription:'trial',      projects_count:1,  is_active:false },
    { id:'6', name:'Djenné Constructions',   subscription:'starter',    projects_count:3,  is_active:true  },
  ];

  return (
    <div style={{ padding:32 }}>
      <AlertBanner text="3 entreprises ont renouvelé leur abonnement ce mois | 1 paiement en attente — Segou BTP" type="warning"/>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:28 }}>
        <KPI label="Entreprises actives" value={comps.filter(c=>c.is_active).length} color={T.orange} trend="+ 3 ce mois"/>
        <KPI label="Chantiers en cours"  value={stats?.total_projects||87}            color={T.blue}   sub={`sur ${comps.length} entreprises`}/>
        <KPI label="Utilisateurs totaux" value={stats?.total_users||312}              color={T.green}  sub="actifs sur la plateforme"/>
        <KPI label="Revenu mensuel"      value="4.2M FCFA"                            color={T.orange} trend="+12% vs mois passé"/>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1.4fr 1fr', gap:20 }}>
        <Card>
          <CardTitle>Entreprises abonnées</CardTitle>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead><tr>{['Entreprise','Plan','Projets','Statut',''].map(h=>(
              <th key={h} style={{ textAlign:'left', padding:'6px 8px', fontSize:11, color:T.textMuted, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.4px', borderBottom:`1px solid ${T.border}`, background:'#FAFAFA' }}>{h}</th>
            ))}</tr></thead>
            <tbody>
              {comps.slice(0,6).map(c => {
                const pc = { pro:{color:'#3B82F6',bg:'#EFF6FF'}, starter:{color:'#6B7280',bg:'#F3F4F6'}, enterprise:{color:'#8B5CF6',bg:'#F5F3FF'}, trial:{color:'#F59E0B',bg:'#FFFBEB'} }[c.subscription]||{color:'#6B7280',bg:'#F3F4F6'};
                return (
                  <tr key={c.id} style={{ borderBottom:`1px solid ${T.border}` }}>
                    <td style={{ padding:'11px 8px', fontSize:13, fontWeight:600, color:T.text }}>{c.name}</td>
                    <td style={{ padding:'11px 8px' }}><span style={{ padding:'3px 10px', borderRadius:100, fontSize:11, fontWeight:600, color:pc.color, background:pc.bg }}>{c.subscription}</span></td>
                    <td style={{ padding:'11px 8px', fontSize:13, color:T.textSub }}>{c.projects_count||0}</td>
                    <td style={{ padding:'11px 8px' }}><span style={{ padding:'3px 10px', borderRadius:100, fontSize:11, fontWeight:600, color:c.is_active?T.green:T.red, background:c.is_active?T.greenLight:T.redLight }}>{c.is_active?'Actif':'Inactif'}</span></td>
                    <td style={{ padding:'11px 8px' }}>
                      <button onClick={() => navigate('/companies')} style={{ padding:'4px 10px', borderRadius:6, border:`1px solid ${T.border}`, background:'#fff', color:T.textSub, fontSize:11, cursor:'pointer', fontFamily:'inherit' }}>Gérer</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{ marginTop:14, display:'flex', justifyContent:'flex-end' }}>
            <button onClick={() => navigate('/companies')} style={{ padding:'8px 16px', borderRadius:8, background:T.orange, color:'#fff', fontSize:12, fontWeight:600, border:'none', cursor:'pointer', fontFamily:'inherit' }}>
              Voir toutes les entreprises →
            </button>
          </div>
        </Card>
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <Card>
            <CardTitle>Modules les plus utilisés</CardTitle>
            {[['Planning / Gantt',88,'#3B82F6'],['Finance & Achats',74,T.orange],['Journal terrain',65,T.green],['QHSE',52,T.red]].map(([n,p,c],i)=>(
              <div key={i} style={{ marginBottom:14 }}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, marginBottom:5 }}><span style={{ color:T.text }}>{n}</span><span style={{ color:T.textSub, fontWeight:600 }}>{p}%</span></div>
                <Pbar pct={p} color={c} h={8}/>
              </div>
            ))}
          </Card>
          <Card>
            <CardTitle badge="3" badgeColor={T.red}>Alertes système</CardTitle>
            {[
              ['Paiement en attente — Segou BTP',T.red,'#FEF2F2'],
              ['Espace stockage >80% — Mali Infra',T.yellow,'#FFFBEB'],
              ['Nouvelle inscription à valider',T.blue,'#EFF6FF'],
            ].map(([t,c,b],i)=>(
              <div key={i} style={{ padding:'9px 12px', background:b, borderRadius:6, marginBottom:8, fontSize:12, color:c, fontWeight:500 }}>{t}</div>
            ))}
          </Card>
        </div>
      </div>
    </div>
  );
}

function DashboardDirecteur({ projects, stats, offSiteAlerts }) {
  const navigate = useNavigate();
  const prjs = projects.length > 0 ? projects : MOCK_PROJECTS;
  const b = prjs.reduce((a,p) => a+(parseFloat(p.budget)||0), 0);
  const e = prjs.reduce((a,p) => a+(parseFloat(p.actual_expenses)||0), 0);
  const pct = b > 0 ? Math.round((e/b)*100) : 37;
  const delayed = prjs.filter(p => p.is_delayed);
  const activeP = prjs.find(p => p.status==='en_cours') || prjs[0];

  return (
    <div style={{ padding:32 }}>
      {delayed.length > 0 && <AlertBanner text={`Retard détecté — ${delayed[0]?.name}: délai dépassé. Action requise.`} type="warning"/>}
      {offSiteAlerts.length > 0 && <AlertBanner text={`${offSiteAlerts.length} pointage(s) hors-site détecté(s) aujourd'hui`} type="danger"/>}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:28 }}>
        <KPI label="Avancement global"  value={`${activeP?.progress_pct||37}%`} color={T.orange} trend="+4% cette semaine"/>
        <KPI label="Budget consommé"    value={`${pct}%`} alert={pct>90} color={T.orange} sub={b>0?`${fmtFCFA(b-e)}M FCFA restants`:'537M restants'}/>
        <KPI label="Projets actifs"     value={prjs.filter(p=>p.status==='en_cours').length} color={T.blue} sub={`sur ${prjs.length} total`}/>
        <KPI label="Score QHSE"         value="91%" color={T.green} sub="2 non-conformités"/>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1.2fr 1fr', gap:20 }}>
        <Card>
          <CardTitle badge={`${prjs.filter(p=>p.status==='en_cours').length} en cours`} badgeColor={T.orange}>Planning — phases actives</CardTitle>
          <GanttBar name="Terrassement"     pct={100} color={T.green}/>
          <GanttBar name="Fondations"       pct={100} color={T.green}/>
          <GanttBar name="Structures R+1/2" pct={65}  color={T.orange}/>
          <GanttBar name="Structures R+3/4" pct={5}   color="#CBD5E0"/>
          <GanttBar name="Second œuvre"     pct={0}   color="#CBD5E0"/>
          <div style={{ fontSize:11, color:T.textMuted, marginTop:8 }}>| Aujourd'hui · Livraison Sep 2025</div>
        </Card>
        <Card>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:18 }}>
            <h3 style={{ margin:0, fontSize:14, fontWeight:600, color:T.text }}>Répartition budget</h3>
            <span style={{ fontSize:12, color:T.orange, fontWeight:600 }}>{b>0?fmtFCFA(b):'850M'} FCFA</span>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:20 }}>
            <Donut pct={pct}/>
            <div style={{ flex:1 }}>
              {[["Main d'œuvre",42,T.orange],['Matériaux',28,T.blue],['Matériels',19,T.green],['Divers',11,T.yellow]].map(([l,p,c],i) => (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                  <div style={{ width:8, height:8, borderRadius:'50%', background:c, flexShrink:0 }}/>
                  <span style={{ flex:1, fontSize:12, color:T.text }}>{l}</span>
                  <span style={{ fontSize:12, fontWeight:700, color:T.textSub }}>{p}%</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ marginTop:16, paddingTop:16, borderTop:`1px solid ${T.border}` }}>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:5 }}>
              <span style={{ color:T.textSub }}>Dépensé</span>
              <span style={{ color:T.text, fontWeight:600 }}>{b>0?`${fmtFCFA(e)}/${fmtFCFA(b)}`:'312M / 850M'} FCFA</span>
            </div>
            <Pbar pct={pct} color={pct>85?T.red:T.orange} h={8}/>
          </div>
        </Card>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1.2fr 1fr', gap:20, marginTop:20 }}>
        <Card>
          <CardTitle>Activité terrain — 7j</CardTitle>
          <div style={{ display:'flex', gap:4, alignItems:'flex-end', height:60, marginBottom:8 }}>
            {[30,45,35,70,80,85,90].map((h,i) => (
              <div key={i} style={{ flex:1, background:i>=4?T.orange:'#E5E7EB', borderRadius:'3px 3px 0 0', height:`${h}%` }}/>
            ))}
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:T.textMuted, marginBottom:10 }}>
            {['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'].map(d => <span key={d}>{d}</span>)}
          </div>
          <div style={{ fontSize:14, fontWeight:700, color:T.text }}>247 h pointées</div>
          <div style={{ fontSize:12, color:T.textSub }}>22 ouvriers actifs · 6 équipes</div>
          <button onClick={() => navigate('/pointage')}
            style={{ marginTop:12, width:'100%', padding:'8px 0', borderRadius:8, border:`1px solid ${T.border}`, background:'#fff', color:T.textSub, fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>
            Voir pointage →
          </button>
        </Card>
        <Card>
          <CardTitle badge="4 ouvertes" badgeColor={T.red}>Dernières réserves QHSE</CardTitle>
          {[
            ['Ferraillage km 12 non conforme','Critique',T.red,'✕'],
            ['Drainage insuffisant — Lot B','Moyen',T.yellow,'!'],
            ['Compactage à vérifier','Moyen',T.yellow,'!'],
            ['Balisage mis à jour','Levée',T.green,'✓'],
          ].map(([t,s,c,ic],i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0', borderBottom:`1px solid ${T.border}` }}>
              <span style={{ fontSize:14, color:c, width:16, textAlign:'center' }}>{ic}</span>
              <span style={{ flex:1, fontSize:12, color:T.text }}>{t}</span>
              <span style={{ fontSize:11, fontWeight:600, color:c, padding:'2px 8px', background:`${c}15`, borderRadius:100 }}>{s}</span>
            </div>
          ))}
          <button onClick={() => navigate('/qhse')}
            style={{ marginTop:12, width:'100%', padding:'8px 0', borderRadius:8, border:`1px solid ${T.border}`, background:'#fff', color:T.textSub, fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>
            Voir QHSE →
          </button>
        </Card>
        <Card>
          <CardTitle badge="En activité" badgeColor={T.green}>Projets récents</CardTitle>
          {prjs.slice(0,4).map(p => (
            <Link key={p.id} to={String(p.id).startsWith('mock-')?'/projects':`/projects/${p.id}`}
              style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0', borderBottom:`1px solid ${T.border}`, textDecoration:'none' }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:12, fontWeight:600, color:T.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</div>
                <div style={{ fontSize:11, color:T.textSub }}>{p.progress_pct}% · {p.location}</div>
              </div>
              <SBadge status={p.status}/>
            </Link>
          ))}
        </Card>
      </div>
    </div>
  );
}

function DashboardOfficeAdmin({ projects, team, workers, stats }) {
  const navigate = useNavigate();
  const tm = team.length > 0 ? team : MOCK_TEAM;
  const wk = workers.length > 0 ? workers : MOCK_WORKERS;

  return (
    <div style={{ padding:32 }}>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:28 }}>
        <KPI label="Membres équipe"   value={tm.length}                           color={T.blue}/>
        <KPI label="Ouvriers actifs"  value={wk.filter(w=>w.is_active).length}   color={T.orange}/>
        <KPI label="Projets"          value={projects.length || MOCK_PROJECTS.length} color={T.purple}/>
        <KPI label="Pointages auj."   value={stats?.attendance_today||22}         color={T.green}/>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
        <Card>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
            <h3 style={{ margin:0, fontSize:14, fontWeight:600, color:T.text }}>Membres de l'équipe</h3>
            <button onClick={() => navigate('/team')} style={{ padding:'7px 14px', borderRadius:7, background:T.orange, color:'#fff', fontSize:12, fontWeight:600, border:'none', cursor:'pointer', fontFamily:'inherit' }}>+ Inviter</button>
          </div>
          {tm.slice(0,8).map(m => (
            <div key={m.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 0', borderBottom:`1px solid ${T.border}` }}>
              <Av name={m.full_name} size={34}/>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:600, color:T.text }}>{m.full_name}</div>
                <div style={{ fontSize:11, color:T.textSub }}>{m.platform_role_display}</div>
              </div>
              <span style={{ fontSize:11, padding:'2px 8px', borderRadius:100, background:m.is_active?T.greenLight:T.redLight, color:m.is_active?T.green:T.red, fontWeight:600 }}>{m.is_active?'Actif':'Inactif'}</span>
            </div>
          ))}
          <button onClick={() => navigate('/team')} style={{ marginTop:12, width:'100%', padding:'8px 0', borderRadius:8, border:`1px solid ${T.border}`, background:'#fff', color:T.textSub, fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>
            Gérer l'équipe →
          </button>
        </Card>
        <Card>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
            <h3 style={{ margin:0, fontSize:14, fontWeight:600, color:T.text }}>Ouvriers enregistrés</h3>
            <button onClick={() => navigate('/workers')} style={{ padding:'7px 14px', borderRadius:7, background:T.orange, color:'#fff', fontSize:12, fontWeight:600, border:'none', cursor:'pointer', fontFamily:'inherit' }}>+ Ajouter</button>
          </div>
          {wk.slice(0,8).map(w => (
            <div key={w.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 0', borderBottom:`1px solid ${T.border}` }}>
              <div style={{ width:34, height:34, borderRadius:'50%', background:T.orangeLight, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>👷</div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:600, color:T.text }}>{w.first_name} {w.last_name}</div>
                <div style={{ fontSize:11, color:T.textSub }}>{w.trade_display} · {fmtFCFA(w.daily_rate)} FCFA/j</div>
              </div>
              <span style={{ fontSize:11, padding:'2px 8px', borderRadius:100, background:w.is_active?T.greenLight:T.redLight, color:w.is_active?T.green:T.red, fontWeight:600 }}>{w.is_active?'Actif':'Inactif'}</span>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

function DashboardChefProjet({ projects }) {
  const navigate = useNavigate();
  const prjs = projects.length > 0 ? projects : MOCK_PROJECTS;
  const activeP = prjs.find(p => p.status==='en_cours') || prjs[0];
  const b = parseFloat(activeP?.budget||0), e = parseFloat(activeP?.actual_expenses||0);
  const pct = b > 0 ? Math.round((e/b)*100) : 37;

  return (
    <div style={{ padding:32 }}>
      {activeP?.is_delayed && <AlertBanner text={`Retard détecté — ${activeP.name}`} type="warning"/>}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:28 }}>
        <KPI label="Projets assignés"   value={prjs.length} color={T.orange}/>
        <KPI label="Avancement"         value={`${activeP?.progress_pct||37}%`} color={T.orange} trend="+4% cette semaine"/>
        <KPI label="Budget consommé"    value={`${pct}%`} alert={pct>90} color={T.orange}/>
        <KPI label="Score QHSE"         value="91%" color={T.green} sub="2 non-conformités"/>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1.2fr 1fr', gap:20 }}>
        <Card>
          <CardTitle>Mes projets</CardTitle>
          {prjs.map(p => (
            <Link key={p.id} to={String(p.id).startsWith('mock-')?'/projects':`/projects/${p.id}`}
              style={{ display:'block', textDecoration:'none', padding:'12px 0', borderBottom:`1px solid ${T.border}` }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6 }}>
                <span style={{ fontSize:13, fontWeight:600, color:T.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:220 }}>{p.name}</span>
                <SBadge status={p.status}/>
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:T.textSub, marginBottom:5 }}>
                <span>📍 {p.location}</span>
                <span>{p.progress_pct}%</span>
              </div>
              <Pbar pct={p.progress_pct||0}/>
            </Link>
          ))}
          <button onClick={() => navigate('/projects')} style={{ marginTop:12, width:'100%', padding:'8px 0', borderRadius:8, border:`1px solid ${T.border}`, background:'#fff', color:T.textSub, fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>
            Voir tous les projets →
          </button>
        </Card>
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <Card>
            <CardTitle>Planning — phases</CardTitle>
            <GanttBar name="Fondations"     pct={100} color={T.green}/>
            <GanttBar name="Gros œuvre R+2" pct={65}  color={T.orange}/>
            <GanttBar name="Gros œuvre R+4" pct={5}   color="#CBD5E0"/>
            <GanttBar name="Second œuvre"   pct={0}   color="#CBD5E0"/>
            <button onClick={() => navigate('/planning')} style={{ marginTop:10, width:'100%', padding:'7px 0', borderRadius:7, border:`1px solid ${T.border}`, background:'#fff', color:T.textSub, fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>
              Voir le planning →
            </button>
          </Card>
          <Card>
            <CardTitle>Accès rapide</CardTitle>
            {[
              { label:'📅 Planning',   to:'/planning'  },
              { label:'💰 Budget',     to:'/budget'    },
              { label:'🛡️ QHSE',      to:'/qhse'      },
              { label:'📈 Rapports',   to:'/reports'   },
            ].map(({ label, to }) => (
              <button key={to} onClick={() => navigate(to)}
                style={{ display:'block', width:'100%', padding:'9px 12px', marginBottom:8, borderRadius:8, border:`1px solid ${T.border}`, background:'#fff', color:T.text, fontSize:13, fontWeight:500, cursor:'pointer', fontFamily:'inherit', textAlign:'left' }}>
                {label}
              </button>
            ))}
          </Card>
        </div>
      </div>
    </div>
  );
}

function DashboardChefChantier({ projects, stats }) {
  const navigate = useNavigate();
  const prjs = projects.length > 0 ? projects : MOCK_PROJECTS.filter(p=>p.status==='en_cours');
  const today = new Date().toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'});

  return (
    <div style={{ padding:32 }}>
      <Card style={{ marginBottom:20 }} p={20}>
        <div style={{ fontSize:13, color:T.textSub, marginBottom:12, fontWeight:500 }}>Aujourd'hui — {today}</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:0, borderTop:`1px solid ${T.border}`, paddingTop:16 }}>
          {[[22,'Ouvriers présents',T.text],['07:30','Début travaux',T.blue],[1,'Incidents signalés',T.orange],[12,'Photos ajoutées',T.purple]].map(([v,l,c],i) => (
            <div key={i} style={{ textAlign:'center', borderRight:i<3?`1px solid ${T.border}`:'none' }}>
              <div style={{ fontSize:24, fontWeight:800, color:c }}>{v}</div>
              <div style={{ fontSize:11, color:T.textSub, marginTop:2 }}>{l}</div>
            </div>
          ))}
        </div>
      </Card>
      <div style={{ display:'grid', gridTemplateColumns:'1.2fr 1fr', gap:20 }}>
        <Card>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
            <h3 style={{ margin:0, fontSize:14, fontWeight:600, color:T.text }}>Journal de chantier</h3>
            <button onClick={() => navigate('/reports')} style={{ padding:'7px 14px', borderRadius:7, background:T.orange, color:'#fff', fontSize:12, fontWeight:600, border:'none', cursor:'pointer', fontFamily:'inherit' }}>+ Nouveau rapport</button>
          </div>
          {[
            { date:'14 Avr', weather:'☀️', workers:22, work:'Ferraillage poteaux R+2 côté nord : 24 poteaux 40x40. 850 kg HA16 posés.', validated:true  },
            { date:'13 Avr', weather:'☁️', workers:18, work:'Décoffrage voiles RDC. Reprise béton sur 3 points. Nettoyage dalle.',   validated:true  },
            { date:'12 Avr', weather:'☀️', workers:25, work:'Coulage dalle R+2 : 28m³ béton B25 BPE. Vibration soignée.',            validated:true  },
            { date:'11 Avr', weather:'🌧️', workers:14, work:'Arrêt chantier 11h30 suite orage. Bâchage coffrages. Reprise 14h.',      validated:false },
          ].map((r,i) => (
            <div key={i} style={{ display:'flex', gap:14, padding:'12px 0', borderBottom:`1px solid ${T.border}` }}>
              <div style={{ textAlign:'center', flexShrink:0, width:40 }}>
                <div style={{ fontSize:11, fontWeight:700, color:T.orange }}>{r.date}</div>
                <div style={{ fontSize:18, marginTop:2 }}>{r.weather}</div>
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:12, color:T.text, marginBottom:4, lineHeight:1.4 }}>{r.work}</div>
                <div style={{ display:'flex', gap:8 }}>
                  <span style={{ fontSize:10, color:T.textSub }}>👷 {r.workers} ouvriers</span>
                  {r.validated
                    ? <span style={{ fontSize:10, color:T.green, fontWeight:600 }}>✅ Validé</span>
                    : <span style={{ fontSize:10, color:T.orange, fontWeight:600 }}>⏳ En attente</span>
                  }
                </div>
              </div>
            </div>
          ))}
        </Card>
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <Card>
            <CardTitle>Pointage — Semaine 15</CardTitle>
            {[
              ['Modibo C.','Maçon',48,'#F97316'],
              ['Boubacar T.','Ferrailleur',44,'#8B5CF6'],
              ['Seydou D.','Coffreur',40,'#3B82F6'],
              ['Moussa S.','Maçon',38,'#10B981'],
              ['Ibrahim K.','Manœuvre',36,'#F59E0B'],
            ].map(([n,r,h,c],i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0', borderBottom:`1px solid ${T.border}` }}>
                <div style={{ width:28, height:28, borderRadius:'50%', background:c, display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, color:'#fff', flexShrink:0 }}>{n.split(' ').map(x=>x[0]).join('')}</div>
                <div style={{ flex:1 }}><div style={{ fontSize:12, fontWeight:600, color:T.text }}>{n}</div><div style={{ fontSize:10, color:T.textMuted }}>{r}</div></div>
                <span style={{ fontSize:13, fontWeight:700, color:T.text }}>{h}h</span>
              </div>
            ))}
            <button onClick={() => navigate('/pointage')} style={{ marginTop:12, width:'100%', padding:'8px 0', borderRadius:8, background:T.green, color:'#fff', fontSize:12, fontWeight:600, border:'none', cursor:'pointer', fontFamily:'inherit' }}>
              📍 Pointer mon équipe
            </button>
          </Card>
          <Card>
            <CardTitle>Photos récentes</CardTitle>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:6 }}>
              {[
                'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=200&q=70',
                'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=200&q=70',
                'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=200&q=70',
                'https://images.unsplash.com/photo-1590479773265-7464e5d48118?w=200&q=70',
                'https://images.unsplash.com/photo-1516156008625-3a9d6067fab5?w=200&q=70',
                'https://images.unsplash.com/photo-1470219556762-1771e7f9427d?w=200&q=70',
              ].map((url, i) => (
                <img key={i} src={url} alt="Photo chantier"
                  style={{ width:'100%', height:60, objectFit:'cover', borderRadius:6, cursor:'pointer' }}
                  onClick={() => navigate('/reports')}
                  onError={e => { e.target.style.display='none'; }}
                />
              ))}
            </div>
            <button onClick={() => navigate('/reports')} style={{ marginTop:10, width:'100%', padding:'7px 0', borderRadius:7, border:`1px solid ${T.border}`, background:'#fff', color:T.textSub, fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>
              Voir toutes les photos →
            </button>
          </Card>
        </div>
      </div>
    </div>
  );
}

function DashboardChefEquipe({ projects, attendance }) {
  const navigate = useNavigate();
  const prjs = projects.length > 0 ? projects : MOCK_PROJECTS.slice(0,1);

  return (
    <div style={{ padding:32 }}>
      <AlertBanner text="Vous avez accès au pointage GPS de votre équipe uniquement." type="info"/>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16, marginBottom:24 }}>
        <KPI label="Projets assignés" value={prjs.length}                          color={T.orange}/>
        <KPI label="Présents auj."   value={attendance?.workers_in||18}            color={T.green}/>
        <KPI label="Hors-site"       value={attendance?.off_site_alerts||0}        color={T.red} alert={(attendance?.off_site_alerts||0)>0}/>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
        <Card>
          <CardTitle>Mes chantiers</CardTitle>
          {prjs.map(p => (
            <Link key={p.id} to={String(p.id).startsWith('mock-')?'/projects':`/projects/${p.id}`}
              style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 0', borderBottom:`1px solid ${T.border}`, textDecoration:'none' }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:600, color:T.text }}>{p.name}</div>
                <div style={{ fontSize:11, color:T.textSub }}>📍 {p.location}</div>
              </div>
              <SBadge status={p.status}/>
            </Link>
          ))}
          <button onClick={() => navigate('/pointage')} style={{ marginTop:14, width:'100%', padding:'10px 0', borderRadius:8, background:T.green, color:'#fff', fontSize:13, fontWeight:700, border:'none', cursor:'pointer', fontFamily:'inherit' }}>
            📍 Pointer mon équipe
          </button>
        </Card>
        <Card>
          <CardTitle>Équipe du jour</CardTitle>
          {[
            ['Mamadou C.','Maçon',true],['Boubacar T.','Ferrailleur',true],
            ['Seydou D.','Coffreur',true],['Moussa S.','Maçon',false],
            ['Ibrahim K.','Manœuvre',true],
          ].map(([n,r,p],i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0', borderBottom:`1px solid ${T.border}` }}>
              <div style={{ width:8, height:8, borderRadius:'50%', background:p?T.green:T.border, flexShrink:0 }}/>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:600, color:T.text }}>{n}</div>
                <div style={{ fontSize:11, color:T.textSub }}>{r}</div>
              </div>
              <span style={{ fontSize:11, color:p?T.green:T.textMuted, fontWeight:600 }}>{p?'Présent':'Absent'}</span>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

function DashboardIngenieur({ projects }) {
  const navigate = useNavigate();
  const prjs = projects.length > 0 ? projects : MOCK_PROJECTS;

  return (
    <div style={{ padding:32 }}>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16, marginBottom:28 }}>
        <KPI label="Projets suivis" value={prjs.length}                                  color={T.green}/>
        <KPI label="En cours"       value={prjs.filter(p=>p.status==='en_cours').length} color={T.orange}/>
        <KPI label="Documents"      value={8}                                             color={T.blue} sub="Plans techniques"/>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
        <Card>
          <CardTitle>Projets & Plans techniques</CardTitle>
          {prjs.map(p => (
            <Link key={p.id} to={String(p.id).startsWith('mock-')?'/projects':`/projects/${p.id}`}
              style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 0', borderBottom:`1px solid ${T.border}`, textDecoration:'none' }}>
              <span style={{ fontSize:22 }}>📋</span>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:600, color:T.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</div>
                <div style={{ fontSize:11, color:T.textSub }}>{p.project_type} · {p.progress_pct}%</div>
              </div>
              <SBadge status={p.status}/>
            </Link>
          ))}
        </Card>
        <Card>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
            <h3 style={{ margin:0, fontSize:14, fontWeight:600, color:T.text }}>Documents récents</h3>
            <button onClick={() => navigate('/documents')} style={{ padding:'7px 12px', borderRadius:7, background:T.blue, color:'#fff', fontSize:11, fontWeight:600, border:'none', cursor:'pointer', fontFamily:'inherit' }}>Voir tout</button>
          </div>
          {[
            ['Plan de masse v3','plan_masse.dwg','DWG','Dr. Moussa Coulibaly','15 Mar'],
            ['Plans façades Est/Ouest','facades_EO.pdf','PDF','Dr. Moussa Coulibaly','20 Mar'],
            ['Plan fondations v1','fondations.dwg','DWG','Dr. Moussa Coulibaly','28 Fév'],
            ['Plan béton armé','beton_poteaux.pdf','PDF','Dr. Moussa Coulibaly','05 Avr'],
          ].map(([n,f,t,u,d],i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 0', borderBottom:`1px solid ${T.border}` }}>
              <span style={{ fontSize:16 }}>{t==='DWG'?'📐':'📕'}</span>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:12, fontWeight:600, color:T.text }}>{n}</div>
                <div style={{ fontSize:10, color:T.textMuted }}>{f} · {d}</div>
              </div>
              <button onClick={() => navigate('/documents')}
                style={{ padding:'3px 10px', borderRadius:5, border:`1px solid ${T.blue}30`, background:`${T.blue}10`, color:T.blue, fontSize:10, cursor:'pointer', fontFamily:'inherit' }}>
                ⬇️
              </button>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

function DashboardQHSE({ projects }) {
  const navigate = useNavigate();
  return (
    <div style={{ padding:32 }}>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16, marginBottom:28 }}>
        <Card p={20}><div style={{ fontSize:12, color:T.textSub, marginBottom:4 }}>Conformités</div><div style={{ fontSize:28, fontWeight:800, color:T.green }}>18/20</div><div style={{ fontSize:12, color:T.green, marginBottom:8 }}>Score 90%</div><Pbar pct={90} color={T.green} h={6}/></Card>
        <Card p={20}><div style={{ fontSize:12, color:T.textSub, marginBottom:4 }}>Non-conformités</div><div style={{ fontSize:28, fontWeight:800, color:T.red }}>2</div><div style={{ fontSize:12, color:T.red }}>Action requise</div><div style={{ height:3, background:T.red, borderRadius:2, marginTop:12, width:'30%' }}/></Card>
        <Card p={20}><div style={{ fontSize:12, color:T.textSub, marginBottom:4 }}>Réserves levées</div><div style={{ fontSize:28, fontWeight:800, color:T.yellow }}>7/9</div><div style={{ fontSize:12, color:T.yellow }}>Cette semaine</div><Pbar pct={77} color={T.yellow} h={6}/></Card>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
        <Card>
          <CardTitle badge="Ctrl: 14 Avr" badgeColor={T.blue}>Checklists sécurité</CardTitle>
          {[
            [true,'EPI — équipement complet (casque, gilet, chaussures)'],
            [true,'Balisage zone active en place'],
            [true,'Vérification état engins et véhicules'],
            [false,'Ferraillage km 12 non conforme'],
            [true,'Stockage produits chimiques conforme'],
            [null,'Évacuation eau de pluie opérationnelle'],
            [true,'Extincteurs vérifiés et accessibles'],
          ].map(([ok,t],i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 0', borderBottom:`1px solid ${T.border}` }}>
              <div style={{ width:22, height:22, borderRadius:4, background:ok===true?T.greenLight:ok===false?T.redLight:T.yellowLight, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, flexShrink:0, color:ok===true?T.green:ok===false?T.red:T.yellow, fontWeight:700 }}>
                {ok===true?'OK':ok===false?'✕':'?'}
              </div>
              <div style={{ flex:1, fontSize:12, color:T.text }}>{t}</div>
            </div>
          ))}
          <button onClick={() => navigate('/qhse')} style={{ marginTop:12, width:'100%', padding:'8px 0', borderRadius:8, background:T.red, color:'#fff', fontSize:12, fontWeight:600, border:'none', cursor:'pointer', fontFamily:'inherit' }}>
            Voir QHSE complet →
          </button>
        </Card>
        <Card>
          <CardTitle badge="4 ouvertes" badgeColor={T.red}>Réserves actives</CardTitle>
          {[
            ['Ferraillage km 12 non conforme','Critique',T.red],
            ['Drainage insuffisant — Lot B','Moyen',T.yellow],
            ['Compactage à re-contrôler','Moyen',T.yellow],
            ['Marquage inadéquat zone C','Faible',T.yellow],
            ['Balisage mis à jour','Levée',T.green],
          ].map(([t,s,c],i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 0', borderBottom:`1px solid ${T.border}` }}>
              <div style={{ flex:1, fontSize:12, color:T.text }}>{t}</div>
              <span style={{ padding:'3px 9px', borderRadius:100, fontSize:11, fontWeight:600, color:c, background:`${c}15`, flexShrink:0 }}>{s}</span>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

function DashboardMagasinier({ projects }) {
  return (
    <div style={{ padding:32 }}>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16, marginBottom:24 }}>
        <KPI label="Projets assignés"    value={projects.length || MOCK_PROJECTS.length}                   color={T.orange}/>
        <KPI label="Livraisons récentes" value={MOCK_PURCHASES.filter(p=>p.statut==='livre').length}        color={T.green}/>
        <KPI label="Commandes en attente"value={MOCK_PURCHASES.filter(p=>p.statut!=='livre').length}        color={T.yellow}/>
      </div>
      <Card>
        <CardTitle>Achats & Livraisons récents</CardTitle>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead><tr>{['Date','Désignation','Projet','Statut'].map(h=>(
            <th key={h} style={{ textAlign:'left', padding:'8px 10px', fontSize:11, color:T.textMuted, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.4px', borderBottom:`1px solid ${T.border}`, background:'#FAFAFA' }}>{h}</th>
          ))}</tr></thead>
          <tbody>{MOCK_PURCHASES.map((p,i) => (
            <tr key={i} style={{ borderBottom:`1px solid ${T.border}` }}>
              <td style={{ padding:'11px 10px', fontSize:12, color:T.textSub }}>{fmtDs(p.date_commande)}</td>
              <td style={{ padding:'11px 10px', fontSize:13, fontWeight:600, color:T.text }}>{p.designation}</td>
              <td style={{ padding:'11px 10px', fontSize:12, color:T.textSub }}>{p.project_name}</td>
              <td style={{ padding:'11px 10px' }}><PBadge statut={p.statut}/></td>
            </tr>
          ))}</tbody>
        </table>
      </Card>
    </div>
  );
}

function DashboardComptable({ projects }) {
  const navigate = useNavigate();
  const prjs = projects.length > 0 ? projects : MOCK_PROJECTS;
  const b = prjs.reduce((a,p) => a+(parseFloat(p.budget)||0), 0);
  const e = prjs.reduce((a,p) => a+(parseFloat(p.actual_expenses)||0), 0);
  const pct = b > 0 ? Math.round((e/b)*100) : 37;

  return (
    <div style={{ padding:32 }}>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:28 }}>
        <KPI label="Budget total"       value={b>0?`${fmtFCFA(b)} FCFA`:'4.6Mrd FCFA'}  color={T.text}   sub="Contractuel"/>
        <KPI label="Dépenses"           value={b>0?`${fmtFCFA(e)} FCFA`:'589M FCFA'}     color={T.orange} sub={`${pct}% du budget`} alert={pct>90}/>
        <KPI label="Cmds en cours"      value={MOCK_PURCHASES.filter(p=>p.statut==='commande').length}   color={T.yellow}/>
        <KPI label="Solde disponible"   value={b>0?`${fmtFCFA(b-e)} FCFA`:'4.01Mrd FCFA'} color={T.green} sub="Reste budgétaire"/>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1.5fr 1fr', gap:20 }}>
        <Card>
          <CardTitle>Registre des achats</CardTitle>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead><tr>{['Date','Désignation','Qte','Total FCFA','Statut'].map(h=>(
              <th key={h} style={{ textAlign:'left', padding:'7px 8px', fontSize:11, color:T.textMuted, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.3px', borderBottom:`1px solid ${T.border}`, background:'#FAFAFA' }}>{h}</th>
            ))}</tr></thead>
            <tbody>{MOCK_PURCHASES.map((p,i) => (
              <tr key={i} style={{ borderBottom:`1px solid ${T.border}` }}>
                <td style={{ padding:'10px 8px', fontSize:12, color:T.textSub, whiteSpace:'nowrap' }}>{fmtDs(p.date_commande)}</td>
                <td style={{ padding:'10px 8px', fontSize:12, fontWeight:600, color:T.text }}>{p.designation}</td>
                <td style={{ padding:'10px 8px', fontSize:12, color:T.textSub }}>{p.quantite} {p.unite}</td>
                <td style={{ padding:'10px 8px', fontSize:12, fontWeight:600, color:T.text }}>{fmtFCFA(p.total)}</td>
                <td style={{ padding:'10px 8px' }}><PBadge statut={p.statut}/></td>
              </tr>
            ))}</tbody>
          </table>
          <button onClick={() => navigate('/budget')} style={{ marginTop:12, width:'100%', padding:'8px 0', borderRadius:8, border:`1px solid ${T.border}`, background:'#fff', color:T.textSub, fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>
            Voir tous les achats →
          </button>
        </Card>
        <Card>
          <CardTitle>Budget vs Réalisé</CardTitle>
          {(prjs.length > 0 ? prjs : MOCK_PROJECTS).slice(0,4).map(p => {
            const pp = parseFloat(p.budget)>0 ? Math.min(100,Math.round((parseFloat(p.actual_expenses)/parseFloat(p.budget))*100)) : 0;
            return (
              <div key={p.id} style={{ marginBottom:18 }}>
                <div style={{ fontSize:12, fontWeight:600, color:T.text, marginBottom:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</div>
                <div style={{ fontSize:11, color:T.textSub, marginBottom:4 }}>Prévu: {fmtFCFA(p.budget)}M · Réel: {fmtFCFA(p.actual_expenses)}M</div>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <div style={{ flex:1, height:10, background:T.border, borderRadius:5, overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${pp}%`, background:pp>90?T.red:T.orange, borderRadius:5 }}/>
                  </div>
                  <span style={{ fontSize:12, color:T.textSub, fontWeight:600, minWidth:32, textAlign:'right' }}>{pp}%</span>
                </div>
              </div>
            );
          })}
        </Card>
      </div>
    </div>
  );
}

// FIXED: Client dashboard with working download buttons
function DashboardClient({ projects }) {
  const navigate = useNavigate();
  const prjs = projects.length > 0 ? projects : MOCK_PROJECTS;
  const activeP = prjs.find(p=>p.status==='en_cours') || prjs[0];

  const handleDownloadReport = (label, date) => {
    const content = `
RAPPORT DE SUIVI DE CHANTIER — MAÎTRE D'OUVRAGE
================================================
Projet      : ${activeP?.name || 'Construction Immeuble R+4 Hamdallaye ACI 2000'}
Client      : SCI Hamdallaye Invest
Rapport     : ${label}
Période     : ${date}

AVANCEMENT GLOBAL
-----------------
Phase 1 — Fondations        : 100% ✓ Terminé
Phase 2 — Gros œuvre RDC   : 100% ✓ Terminé
Phase 3 — Gros œuvre R+1   : 100% ✓ Terminé
Phase 4 — Gros œuvre R+2   :  65%   En cours
Phase 5 — Gros œuvre R+3/4 :   5%   Démarré
Phase 6 — Second œuvre      :   0%   À venir
Phase 7 — Finitions         :   0%   À venir
Avancement global           :  37%

INFORMATIONS FINANCIÈRES
------------------------
Budget contractuel   : 850 000 000 FCFA
Dépenses à date     : 312 500 000 FCFA (37%)
Restant à dépenser  : 537 500 000 FCFA

PROCHAINS JALONS
----------------
• Achèvement R+3 — prévu Mai 2025
• Achèvement R+4 — prévu Juillet 2025
• Livraison finale — Septembre 2025

---
Document généré par BTP Manager
Entreprise : BTP Mali Construction SARL
Contact    : contact@btpmali.ml
    `.trim();
    downloadReport(label, content);
  };

  const SHARED_REPORTS = [
    { label:'Rapport Semaine 15', date:'14 Avr 2025', type:'PDF', color:T.green   },
    { label:'Rapport Semaine 14', date:'07 Avr 2025', type:'PDF', color:T.green   },
    { label:'Rapport Semaine 13', date:'31 Mar 2025', type:'PDF', color:T.green   },
    { label:'Bilan mensuel — Mars 2025', date:'31 Mar 2025', type:'PDF', color:T.orange },
    { label:'Photos terrain — Avr 2025', date:'14 Avr 2025', type:'Galerie', color:T.purple },
    { label:'Note technique — Ferraillage R+2', date:'01 Avr 2025', type:'PDF', color:T.blue },
  ];

  return (
    <div style={{ padding:32 }}>
      <AlertBanner text="Accès Maître d'Ouvrage — consultation des rapports et de l'avancement de votre projet." type="info"/>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16, marginBottom:28 }}>
        <KPI label="Avancement global"  value={`${activeP?.progress_pct||37}%`}  color={T.orange} trend="+4% cette semaine"/>
        <KPI label="Jours restants"     value="168"                               color={T.blue}   sub="Livraison Sep 2025"/>
        <KPI label="Dernier rapport"    value="14 Avr"                            color={T.green}  sub="Semaine 15"/>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1.2fr 1fr', gap:20 }}>
        <Card>
          <CardTitle>Avancement par phase</CardTitle>
          {[
            ['Fondations',       100,'Terminé',T.green],
            ['Gros œuvre RDC',  100,'Terminé',T.green],
            ['Gros œuvre R+1',  100,'Terminé',T.green],
            ['Gros œuvre R+2',   65,'En cours',T.orange],
            ['Gros œuvre R+3/4',  5,'Démarré', T.blue],
            ['Second œuvre',      0,'À venir', '#CBD5E0'],
            ['Finitions',         0,'À venir', '#CBD5E0'],
          ].map(([n,p,s,c],i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
              <div style={{ width:130, fontSize:12, color:T.text, flexShrink:0 }}>{n}</div>
              <div style={{ flex:1, height:16, background:'#F1F3F5', borderRadius:3, overflow:'hidden' }}>
                <div style={{ height:'100%', width:`${p}%`, background:c, borderRadius:3 }}/>
              </div>
              <div style={{ display:'flex', gap:6, alignItems:'center', flexShrink:0 }}>
                <span style={{ fontSize:10, fontWeight:600, color:c, padding:'2px 7px', background:`${c}18`, borderRadius:100 }}>{s}</span>
                <span style={{ fontSize:11, color:T.textSub, fontWeight:600, width:30, textAlign:'right' }}>{p}%</span>
              </div>
            </div>
          ))}
        </Card>

        {/* FIXED: Working download buttons */}
        <Card>
          <CardTitle>Documents partagés</CardTitle>
          {SHARED_REPORTS.map((r, i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 0', borderBottom:`1px solid ${T.border}` }}>
              <div style={{ width:44, height:44, borderRadius:8, background:`${r.color}18`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <span style={{ fontSize:11, fontWeight:700, color:r.color }}>{r.type}</span>
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:600, color:T.text }}>{r.label}</div>
                <div style={{ fontSize:11, color:T.textSub }}>{r.date}</div>
              </div>
              {r.type === 'Galerie' ? (
                <button
                  onClick={() => navigate('/reports')}
                  style={{ padding:'6px 12px', borderRadius:6, border:`1px solid ${T.border}`, background:'#fff', color:T.textSub, fontSize:12, cursor:'pointer', fontFamily:'inherit', fontWeight:500 }}>
                  📸 Voir
                </button>
              ) : (
                <button
                  onClick={() => handleDownloadReport(r.label, r.date)}
                  style={{ padding:'6px 12px', borderRadius:6, background:T.blue, color:'#fff', border:'none', fontSize:12, cursor:'pointer', fontFamily:'inherit', fontWeight:600 }}>
                  ⬇️ Télécharger
                </button>
              )}
            </div>
          ))}
          <button onClick={() => navigate('/reports')}
            style={{ marginTop:12, width:'100%', padding:'8px 0', borderRadius:8, border:`1px solid ${T.border}`, background:'#fff', color:T.textSub, fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>
            Voir tous les rapports →
          </button>
        </Card>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE — FIXED: No forced project name in title
// ══════════════════════════════════════════════════════════════════════════════

const GREETINGS = {
  app_owner:        'Tableau de bord Plateforme',
  admin_entreprise: "Vue d'ensemble — Direction",
  office_admin:     "Vue d'ensemble — Ressources",
  chef_projet:      "Mes projets",
  chef_chantier:    'Journal de Chantier',
  chef_equipe:      "Mon équipe — Pointage",
  ingenieur:        'Documents & Plans techniques',
  qhse:             'Contrôle Qualité & Sécurité',
  magasinier:       'Stocks & Livraisons',
  comptable:        'Budget & Finances',
  client:           "Suivi de mon projet",
};

const CTA_ROUTES = {
  admin_entreprise: [{ label:'+ Nouveau projet',   to:'/projects/new'      }, { label:'📈 Rapports',     to:'/reports'     }],
  office_admin:     [{ label:'+ Inviter',           to:'/team'             }, { label:'📋 Présences',    to:'/attendance'  }],
  chef_projet:      [{ label:'📅 Planning',         to:'/planning'         }, { label:'📈 Rapports',     to:'/reports'     }],
  chef_chantier:    [{ label:'+ Journal du jour',   to:'/reports'          }, { label:'📍 Pointer',      to:'/pointage'    }],
  chef_equipe:      [{ label:'📍 Pointer mon équipe',to:'/pointage'        }],
  qhse:             [{ label:'⚠️ Signaler incident', to:'/qhse'            }, { label:'📈 Rapports QHSE', to:'/reports'    }],
  comptable:        [{ label:'💰 Budget',            to:'/budget'           }, { label:'🏦 Trésorerie',   to:'/treasury'   }],
  client:           [{ label:'📄 Voir mes rapports', to:'/reports'          }],
};

export default function DashboardPage() {
  const { user }    = useAuth();
  const { role }    = usePermissions();
  const navigate    = useNavigate();
  const [projects,  setProjects]  = useState([]);
  const [stats,     setStats]     = useState(null);
  const [team,      setTeam]      = useState([]);
  const [workers,   setWorkers]   = useState([]);
  const [companies, setCompanies] = useState([]);
  const [attendance,setAttendance]= useState(null);
  const [offSiteAlerts,setOff]    = useState([]);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    const calls = [
      projectsAPI.list().catch(() => ({ data:[] })),
      projectsAPI.getDashboardStats().catch(() => ({ data:null })),
    ];
    if (['app_owner','admin_entreprise','office_admin'].includes(role)) calls.push(teamAPI.list().catch(() => ({ data:[] })));
    if (['office_admin','admin_entreprise','app_owner'].includes(role)) calls.push(workersAPI.list().catch(() => ({ data:[] })));
    if (role === 'app_owner') calls.push(companiesAPI.list().catch(() => ({ data:[] })));

    Promise.all(calls).then(results => {
      const [pR, sR, ...rest] = results;
      setProjects(pR.data || []);
      setStats(sR.data);
      let i = 0;
      if (['app_owner','admin_entreprise','office_admin'].includes(role)) { setTeam(rest[i]?.data||[]); i++; }
      if (['office_admin','admin_entreprise','app_owner'].includes(role)) { setWorkers(rest[i]?.data||[]); i++; }
      if (role === 'app_owner') setCompanies(rest[i]?.data||[]);
    }).finally(() => setLoading(false));
  }, [role]);

  useEffect(() => {
    if (!['chef_chantier','chef_equipe'].includes(role) || !projects.length) return;
    attendanceAPI.summary(projects[0]?.id).then(r => setAttendance(r.data)).catch(() => {});
  }, [role, projects]);

  useEffect(() => {
    if (!['admin_entreprise','app_owner','chef_projet'].includes(role) || !projects.length) return;
    Promise.all(
      projects.filter(p => p.status==='en_cours').map(p =>
        attendanceAPI.alerts(p.id).then(r => r.data?.alerts||[]).catch(() => [])
      )
    ).then(r => setOff(r.flat()));
  }, [role, projects]);

  // FIXED: Title is just the role-appropriate greeting — NOT the project name
  const title = GREETINGS[role] || 'Tableau de bord';
  const firstName = user?.full_name?.split(' ')[0] || 'Utilisateur';

  const ctaButtons = CTA_ROUTES[role] || [];

  return (
    <AppLayout>
      {/* Top bar — FIXED: no project name forced */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'0 32px', height:60, background:'#fff', borderBottom:`1px solid ${T.border}`, position:'sticky', top:0, zIndex:10 }}>
        <div>
          <h1 style={{ margin:0, fontSize:18, fontWeight:700, color:T.text }}>{title}</h1>
          <div style={{ fontSize:12, color:T.textMuted, marginTop:1 }}>Bonjour, {firstName} 👋</div>
        </div>
        <div style={{ display:'flex', gap:10 }}>
          {ctaButtons.map(({ label, to }) => (
            <button key={to} onClick={() => navigate(to)}
              style={{ padding:'8px 16px', borderRadius:8, background:T.orange, color:'#fff', fontSize:13, fontWeight:600, border:'none', cursor:'pointer', fontFamily:'inherit' }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:400 }}>
          <div style={{ width:36, height:36, border:`3px solid ${T.orange}`, borderTopColor:'transparent', borderRadius:'50%', animation:'spin 1s linear infinite' }}/>
          <p style={{ color:T.textSub, fontSize:14, marginTop:14 }}>Chargement...</p>
        </div>
      ) : (
        <>
          {role === 'app_owner'        && <DashboardAppOwner     stats={stats}     companies={companies}/>}
          {role === 'admin_entreprise' && <DashboardDirecteur    projects={projects} stats={stats} offSiteAlerts={offSiteAlerts}/>}
          {role === 'office_admin'     && <DashboardOfficeAdmin  projects={projects} team={team} workers={workers} stats={stats}/>}
          {role === 'chef_projet'      && <DashboardChefProjet   projects={projects}/>}
          {role === 'chef_chantier'    && <DashboardChefChantier projects={projects} stats={stats}/>}
          {role === 'chef_equipe'      && <DashboardChefEquipe   projects={projects} attendance={attendance}/>}
          {role === 'ingenieur'        && <DashboardIngenieur    projects={projects}/>}
          {role === 'qhse'             && <DashboardQHSE         projects={projects}/>}
          {role === 'magasinier'       && <DashboardMagasinier   projects={projects}/>}
          {role === 'comptable'        && <DashboardComptable    projects={projects}/>}
          {role === 'client'           && <DashboardClient       projects={projects}/>}
        </>
      )}
    </AppLayout>
  );
}