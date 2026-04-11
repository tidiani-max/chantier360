// frontend/src/pages/dashboard/DashboardPage.js
// Light theme — matches mockup screenshots exactly
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { projectsAPI, teamAPI, workersAPI, attendanceAPI, companiesAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../context/PermissionsContext';
import AppLayout from '../../components/layout/AppLayout';

// ── Design tokens ─────────────────────────────────────────────────────────────
const T = {
  bg:'#F8F9FA', card:'#FFFFFF', border:'#E8EDF2',
  text:'#1a1f2e', textSub:'#6B7888', textMuted:'#A0ADB8',
  orange:'#F97316', orangeLight:'rgba(249,115,22,0.1)',
  green:'#10B981',  greenLight:'rgba(16,185,129,0.1)',
  red:'#EF4444',    redLight:'rgba(239,68,68,0.08)',
  blue:'#3B82F6',   blueLight:'rgba(59,130,246,0.1)',
  yellow:'#F59E0B', yellowLight:'rgba(245,158,11,0.1)',
  purple:'#8B5CF6',
  shadow:'0 1px 3px rgba(0,0,0,0.06)',
};

// ── Formatters ────────────────────────────────────────────────────────────────
const fmtFCFA = n => {
  if (n==null) return '—';
  const v = parseFloat(n);
  if (v>=1e9) return `${(v/1e9).toFixed(1)}Mrd`;
  if (v>=1e6) return `${(v/1e6).toFixed(0)}M`;
  if (v>=1e3) return `${(v/1e3).toFixed(0)}K`;
  return v.toLocaleString('fr-FR');
};
const fmtDs = d => { if(!d) return '—'; return new Date(d+'T00:00:00').toLocaleDateString('fr-FR',{day:'2-digit',month:'short'}); };

const STATUS_CFG = {
  planifie:{ label:'Planifié', color:'#6366F1', bg:'rgba(99,102,241,0.1)' },
  en_cours:{ label:'En cours', color:'#F97316', bg:'rgba(249,115,22,0.1)' },
  suspendu:{ label:'Suspendu', color:'#EF4444', bg:'rgba(239,68,68,0.1)'  },
  termine: { label:'Terminé',  color:'#10B981', bg:'rgba(16,185,129,0.1)' },
};

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
  const m = { warning:{bg:'#FFFBEB',border:'#FDE68A',color:'#92400E',icon:'⚠'}, danger:{bg:'#FEF2F2',border:'#FECACA',color:'#991B1B',icon:'⚠'}, info:{bg:'#EFF6FF',border:'#BFDBFE',color:'#1E40AF',icon:'ℹ'}, success:{bg:'#F0FDF4',border:'#BBF7D0',color:'#166534',icon:'✓'} }[type];
  return (
    <div style={{ background:m.bg, border:`1px solid ${m.border}`, borderRadius:8, padding:'12px 16px', marginBottom:20, fontSize:13, color:m.color, display:'flex', alignItems:'flex-start', gap:10 }}>
      <span style={{ fontSize:14, marginTop:1, flexShrink:0 }}>{m.icon}</span><span>{text}</span>
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
  const c = STATUS_CFG[status]||STATUS_CFG.planifie;
  return <span style={{ padding:'3px 10px', borderRadius:100, fontSize:11, fontWeight:600, color:c.color, background:c.bg }}>{c.label}</span>;
}

function Av({ name, size=32 }) {
  const init = name?name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase():'?';
  const colors = ['#F97316','#8B5CF6','#10B981','#3B82F6','#EF4444','#F59E0B','#06B6D4'];
  return <div style={{ width:size, height:size, borderRadius:'50%', background:colors[(name?.charCodeAt(0)||0)%colors.length], display:'flex', alignItems:'center', justifyContent:'center', fontSize:size*0.35, fontWeight:700, color:'#fff', flexShrink:0 }}>{init}</div>;
}

function Empty({ icon, text }) {
  return <div style={{ textAlign:'center', padding:'28px 0', color:T.textMuted }}><div style={{ fontSize:28, marginBottom:8 }}>{icon}</div><div style={{ fontSize:13 }}>{text}</div></div>;
}

function GanttBar({ name, pct, color=T.orange }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
      <div style={{ width:140, fontSize:13, color:T.text, flexShrink:0 }}>{name}</div>
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
  partiel:   { label:'Partiel',  color:'#F59E0B', bg:'#FFFBEB' },
  en_attente:{ label:'Attente',  color:'#F59E0B', bg:'#FFFBEB' },
  annule:    { label:'Annulé',   color:'#EF4444', bg:'#FEF2F2' },
};
function PBadge({ statut }) {
  const s = PURCH_ST[statut]||{ label:statut, color:T.textSub, bg:T.border };
  return <span style={{ padding:'3px 10px', borderRadius:100, fontSize:11, fontWeight:600, color:s.color, background:s.bg }}>{s.label}</span>;
}

function BtnPrimary({ children, to, onClick, style={} }) {
  const s = { padding:'8px 18px', borderRadius:7, background:T.orange, color:'#fff', fontSize:13, fontWeight:600, cursor:'pointer', textDecoration:'none', display:'inline-flex', alignItems:'center', gap:6, border:'none', fontFamily:'inherit', ...style };
  if (to) return <Link to={to} style={s}>{children}</Link>;
  return <button onClick={onClick} style={s}>{children}</button>;
}

function BtnOutline({ children, to, onClick }) {
  const s = { padding:'8px 16px', borderRadius:7, border:`1px solid ${T.border}`, background:T.card, color:T.textSub, fontSize:13, fontWeight:500, cursor:'pointer', textDecoration:'none', display:'inline-flex', alignItems:'center', gap:6 };
  if (to) return <Link to={to} style={s}>{children}</Link>;
  return <button onClick={onClick} style={{ ...s, fontFamily:'inherit' }}>{children}</button>;
}

// ══════════════════════════════════════════════════════════════════════════════
// ROLE DASHBOARDS
// ══════════════════════════════════════════════════════════════════════════════

function DashboardAppOwner({ stats, companies }) {
  return (
    <div style={{ padding:32 }}>
      <AlertBanner text="3 entreprises ont renouvelé leur abonnement ce mois | 1 paiement en attente" type="warning"/>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:28 }}>
        <KPI label="Entreprises actives"  value={companies.filter(c=>c.is_active).length||24}  color={T.orange} trend="+ 3 ce mois"/>
        <KPI label="Chantiers en cours"   value={stats?.total_projects||87}                    color={T.blue}   sub={`sur ${companies.length||24} entreprises`}/>
        <KPI label="Utilisateurs totaux"  value={stats?.total_users||312}                      color={T.green}  sub="actifs sur la plateforme"/>
        <KPI label="Revenu mensuel"       value="4.2M FCFA"                                    color={T.orange} trend="+12% vs mois passé"/>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1.4fr 1fr', gap:20 }}>
        <Card>
          <CardTitle>Entreprises abonnées</CardTitle>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead><tr>{['Entreprise','Plan','Chantiers','Statut'].map(h=>(
              <th key={h} style={{ textAlign:'left', padding:'6px 8px', fontSize:11, color:T.textMuted, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.4px', borderBottom:`1px solid ${T.border}`, background:'#FAFAFA' }}>{h}</th>
            ))}</tr></thead>
            <tbody>
              {(companies.length?companies:[
                { id:'1', name:'BTPKO Mali',   subscription:'pro',        projects_count:5,  is_active:true },
                { id:'2', name:'Construire SA', subscription:'starter',   projects_count:2,  is_active:true },
                { id:'3', name:'Mali Infra',    subscription:'enterprise', projects_count:12, is_active:true },
                { id:'4', name:'Bamako Build',  subscription:'pro',        projects_count:4,  is_active:true },
                { id:'5', name:'Segou BTP',     subscription:'trial',      projects_count:1,  is_active:false},
              ]).slice(0,6).map(c=>{
                const pc = { pro:{color:'#3B82F6',bg:'#EFF6FF'}, starter:{color:'#6B7280',bg:'#F3F4F6'}, enterprise:{color:'#8B5CF6',bg:'#F5F3FF'}, trial:{color:'#F59E0B',bg:'#FFFBEB'} }[c.subscription]||{color:'#6B7280',bg:'#F3F4F6'};
                return (
                  <tr key={c.id} style={{ borderBottom:`1px solid ${T.border}` }}>
                    <td style={{ padding:'11px 8px', fontSize:13, fontWeight:600, color:T.text }}>{c.name}</td>
                    <td style={{ padding:'11px 8px' }}><span style={{ padding:'3px 10px', borderRadius:100, fontSize:11, fontWeight:600, color:pc.color, background:pc.bg }}>{c.subscription}</span></td>
                    <td style={{ padding:'11px 8px', fontSize:13, color:T.textSub }}>{c.projects_count||0}</td>
                    <td style={{ padding:'11px 8px' }}><span style={{ padding:'3px 10px', borderRadius:100, fontSize:11, fontWeight:600, color:c.is_active?T.green:T.red, background:c.is_active?T.greenLight:T.redLight }}>{c.is_active?'Actif':'Inactif'}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <Card>
            <CardTitle>Modules les plus utilisés</CardTitle>
            {[['Planning / Gantt',88,'#3B82F6'],['Finance & Achats',74,T.orange],['Journal terrain',65,T.green]].map(([n,p,c],i)=>(
              <div key={i} style={{ marginBottom:14 }}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, marginBottom:5 }}><span style={{ color:T.text }}>{n}</span><span style={{ color:T.textSub, fontWeight:600 }}>{p}%</span></div>
                <Pbar pct={p} color={c} h={8}/>
              </div>
            ))}
          </Card>
          <Card>
            <CardTitle badge="2" badgeColor={T.red}>Alertes système</CardTitle>
            {[
              ['Paiement en attente - Segou BTP',T.red,'#FEF2F2'],
              ['Espace stockage >80% - Mali Infra',T.yellow,'#FFFBEB'],
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
  const b=projects.reduce((a,p)=>a+(parseFloat(p.budget)||0),0);
  const e=projects.reduce((a,p)=>a+(parseFloat(p.actual_expenses)||0),0);
  const pct=b>0?Math.round((e/b)*100):82;
  const delayed=projects.filter(p=>p.is_delayed);
  return (
    <div style={{ padding:32 }}>
      {delayed.length>0&&<AlertBanner text={`Retard détecté — ${delayed[0]?.name}: délai dépassé. Action requise.`} type="warning"/>}
      {offSiteAlerts.length>0&&<AlertBanner text={`${offSiteAlerts.length} pointage(s) hors-site détecté(s) aujourd'hui`} type="danger"/>}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:28 }}>
        <KPI label="Avancement global"  value={`${projects[0]?.progress_pct||67}%`} color={T.orange} trend="+4% cette semaine"/>
        <KPI label="Budget consommé"    value={`${pct}%`} alert={pct>90}             color={T.orange} sub={`${fmtFCFA(b-e)} FCFA restants`}/>
        <KPI label="Jours restants"     value="47"         color={T.yellow}           sub="Livraison 28 Avr 2026"/>
        <KPI label="Score QHSE"         value="91%"        color={T.green}            sub="2 non-conformités"/>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1.2fr 1fr', gap:20 }}>
        <Card>
          <CardTitle badge={`${projects.filter(p=>p.status==='en_cours').length} en cours`} badgeColor={T.orange}>Planning — phases actives</CardTitle>
          <GanttBar name="Terrassement"     pct={78} color={T.orange}/>
          <GanttBar name="Fondations"       pct={55} color={T.blue}/>
          <GanttBar name="Structures béton" pct={35} color={T.green}/>
          <GanttBar name="Revêtement"       pct={10} color="#CBD5E0"/>
          <GanttBar name="Signalisation"    pct={5}  color="#CBD5E0"/>
          <div style={{ fontSize:11, color:T.textMuted, marginTop:8 }}>| Aujourd'hui (Sem. 11)</div>
        </Card>
        <Card>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:18 }}>
            <h3 style={{ margin:0, fontSize:14, fontWeight:600, color:T.text }}>Répartition budget</h3>
            <span style={{ fontSize:12, color:T.orange, fontWeight:600 }}>{fmtFCFA(b)} FCFA</span>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:20 }}>
            <Donut pct={pct}/>
            <div style={{ flex:1 }}>
              {[["Main d'œuvre",42,T.orange],['Matériaux',28,T.blue],['Matériels',19,T.green],['Divers',11,T.yellow]].map(([l,p,c],i)=>(
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
              <span style={{ color:T.text, fontWeight:600 }}>{fmtFCFA(e)} / {fmtFCFA(b)} FCFA</span>
            </div>
            <Pbar pct={pct} color={pct>85?T.red:T.orange} h={8}/>
          </div>
          {offSiteAlerts.length>0&&(
            <div style={{ marginTop:16, paddingTop:16, borderTop:`1px solid ${T.border}` }}>
              <div style={{ fontSize:12, fontWeight:600, color:T.red, marginBottom:8 }}>🔴 Alertes pointage hors-site</div>
              {offSiteAlerts.slice(0,3).map((a,i)=>(
                <div key={i} style={{ display:'flex', gap:8, padding:'7px 10px', background:T.redLight, borderRadius:6, marginBottom:6, fontSize:12 }}>
                  <span style={{ color:T.red, fontWeight:600 }}>{a.worker_name}</span>
                  <span style={{ color:T.textSub }}>· {a.distance_from_site}m · {a.project_name}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
      {/* Activity + reserves + team */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1.2fr 1fr', gap:20, marginTop:20 }}>
        <Card>
          <CardTitle>Activité terrain — 7j</CardTitle>
          <div style={{ display:'flex', gap:4, alignItems:'flex-end', height:60, marginBottom:8 }}>
            {[30,45,35,70,80,85,90].map((h,i)=>(
              <div key={i} style={{ flex:1, background:i>=4?T.orange:'#E5E7EB', borderRadius:'3px 3px 0 0', height:`${h}%`}}/>
            ))}
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:T.textMuted, marginBottom:10 }}>
            {['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'].map(d=><span key={d}>{d}</span>)}
          </div>
          <div style={{ fontSize:14, fontWeight:700, color:T.text }}>247 h pointées</div>
          <div style={{ fontSize:12, color:T.textSub }}>32 ouvriers actifs</div>
        </Card>
        <Card>
          <CardTitle badge="4 ouvertes" badgeColor={T.red}>Dernières réserves</CardTitle>
          {[
            ['Ferraillage km 12 non conforme','Critique',T.red],
            ['Drainage insuffisant — Lot B','Moyen',T.yellow],
            ['Compactage à vérifier','Moyen',T.yellow],
            ['Balisage mis à jour','Levé',T.green],
          ].map(([t,s,c],i)=>(
            <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0', borderBottom:`1px solid ${T.border}` }}>
              <span style={{ fontSize:14, color:c }}>{s==='Levé'?'✓':s==='Critique'?'✕':'!'}</span>
              <span style={{ flex:1, fontSize:12, color:T.text }}>{t}</span>
              <span style={{ fontSize:11, fontWeight:600, color:c, padding:'2px 8px', background:`${c}15`, borderRadius:100 }}>{s}</span>
            </div>
          ))}
        </Card>
        <Card>
          <CardTitle badge="En activité" badgeColor={T.green}>Équipe du jour</CardTitle>
          {(projects.length?projects:[{id:'1',name:'Modibo Touré',location:"Chef d'équipe A"},{id:'2',name:'Aminata Diallo',location:'Conductrice travaux'},{id:'3',name:'Sékou Konaté',location:'Topographe'}]).slice(0,4).map((p,i)=>(
            <div key={p.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0', borderBottom:`1px solid ${T.border}` }}>
              <Av name={p.name} size={32}/>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:12, fontWeight:600, color:T.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</div>
                <div style={{ fontSize:11, color:T.textSub }}>{p.location||'Site actif'}</div>
              </div>
              <span style={{ fontSize:12, color:T.textSub, fontWeight:600 }}>8h/j</span>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

function DashboardOfficeAdmin({ projects, team, workers, stats }) {
  return (
    <div style={{ padding:32 }}>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:28 }}>
        <KPI label="Membres équipe"    value={team.length}                               color={T.blue}/>
        <KPI label="Ouvriers actifs"   value={workers.filter(w=>w.is_active).length}    color={T.orange}/>
        <KPI label="Projets"           value={projects.length}                          color={T.purple}/>
        <KPI label="Pointages auj."    value={stats?.attendance_today||0}               color={T.green}/>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
        <Card>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
            <h3 style={{ margin:0, fontSize:14, fontWeight:600, color:T.text }}>Membres de l'équipe</h3>
            <BtnPrimary to="/team">+ Inviter</BtnPrimary>
          </div>
          {!team.length?<Empty icon="👥" text="Aucun membre."/>:team.slice(0,8).map(m=>(
            <div key={m.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 0', borderBottom:`1px solid ${T.border}` }}>
              <Av name={m.full_name} size={34}/>
              <div style={{ flex:1 }}><div style={{ fontSize:13, fontWeight:600, color:T.text }}>{m.full_name}</div><div style={{ fontSize:11, color:T.textSub }}>{m.platform_role_display}</div></div>
              <span style={{ fontSize:11, padding:'2px 8px', borderRadius:100, background:m.is_active?T.greenLight:T.redLight, color:m.is_active?T.green:T.red, fontWeight:600 }}>{m.is_active?'Actif':'Inactif'}</span>
            </div>
          ))}
        </Card>
        <Card>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
            <h3 style={{ margin:0, fontSize:14, fontWeight:600, color:T.text }}>Ouvriers enregistrés</h3>
            <BtnPrimary to="/team">+ Ajouter</BtnPrimary>
          </div>
          {!workers.length?<Empty icon="👷" text="Aucun ouvrier."/>:workers.slice(0,8).map(w=>(
            <div key={w.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 0', borderBottom:`1px solid ${T.border}` }}>
              <div style={{ width:34, height:34, borderRadius:'50%', background:T.orangeLight, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>👷</div>
              <div style={{ flex:1 }}><div style={{ fontSize:13, fontWeight:600, color:T.text }}>{w.full_name}</div><div style={{ fontSize:11, color:T.textSub }}>{w.trade_display} · {fmtFCFA(w.daily_rate)} FCFA/j</div></div>
              <span style={{ fontSize:11, padding:'2px 8px', borderRadius:100, background:w.is_active?T.greenLight:T.redLight, color:w.is_active?T.green:T.red, fontWeight:600 }}>{w.is_active?'Actif':'Inactif'}</span>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

function DashboardChefProjet({ projects, stats }) {
  const reports=stats?.recent_reports||[];
  const delayed=projects.filter(p=>p.is_delayed);
  const b=parseFloat(projects[0]?.budget||0), e=parseFloat(projects[0]?.actual_expenses||0);
  const pct=b>0?Math.round((e/b)*100):82;
  return (
    <div style={{ padding:32 }}>
      {delayed.length>0&&<AlertBanner text={`Retard détecté — ${delayed[0]?.name}: délai dépassé. Action requise.`} type="warning"/>}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:28 }}>
        <KPI label="Avancement global"  value={`${projects[0]?.progress_pct||67}%`} color={T.orange} trend="+4% cette semaine"/>
        <KPI label="Budget consommé"    value={`${pct}%`} alert={pct>90}             color={T.orange} sub={`${fmtFCFA(b-e)} FCFA restants`}/>
        <KPI label="Jours restants"     value="47"         color={T.yellow}           sub="Livraison 28 Avr 2026"/>
        <KPI label="Score QHSE"         value="91%"        color={T.green}            sub="2 non-conformités"/>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1.2fr 1fr', gap:20 }}>
        <Card>
          <CardTitle badge={`${projects.filter(p=>p.status==='en_cours').length} en cours`} badgeColor={T.orange}>Planning — phases actives</CardTitle>
          <GanttBar name="Terrassement"     pct={78} color={T.orange}/>
          <GanttBar name="Fondations"       pct={55} color={T.blue}/>
          <GanttBar name="Structures béton" pct={35} color={T.green}/>
          <GanttBar name="Revêtement"       pct={10} color="#CBD5E0"/>
          <GanttBar name="Signalisation"    pct={5}  color="#CBD5E0"/>
          <div style={{ fontSize:11, color:T.textMuted, marginTop:8 }}>| Aujourd'hui (Sem. 11)</div>
        </Card>
        <Card>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:18 }}>
            <h3 style={{ margin:0, fontSize:14, fontWeight:600, color:T.text }}>Répartition budget</h3>
            <span style={{ fontSize:12, color:T.orange, fontWeight:600 }}>{fmtFCFA(b)||'780M'} FCFA</span>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:20 }}>
            <Donut pct={pct}/>
            <div style={{ flex:1 }}>
              {[["Main d'œuvre",42,T.orange],['Matériaux',28,T.blue],['Matériels',19,T.green],['Divers',11,T.yellow]].map(([l,p,c],i)=>(
                <div key={i} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                  <div style={{ width:8, height:8, borderRadius:'50%', background:c, flexShrink:0 }}/><span style={{ flex:1, fontSize:12, color:T.text }}>{l}</span><span style={{ fontSize:12, fontWeight:700, color:T.textSub }}>{p}%</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ marginTop:12, paddingTop:12, borderTop:`1px solid ${T.border}` }}>
            <div style={{ fontSize:12, color:T.textSub, marginBottom:5 }}>Dépensé {fmtFCFA(e)||'640M'} / {fmtFCFA(b)||'780M'} FCFA</div>
            <Pbar pct={pct} color={pct>85?T.red:T.orange} h={8}/>
          </div>
        </Card>
      </div>
    </div>
  );
}

function DashboardChefChantier({ projects, stats, attendance }) {
  const reports=stats?.recent_reports||[];
  const today=new Date().toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'});
  return (
    <div style={{ padding:32 }}>
      <Card style={{ marginBottom:20 }} p={20}>
        <div style={{ fontSize:13, color:T.textSub, marginBottom:12 }}>Aujourd'hui — {today}</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:0, borderTop:`1px solid ${T.border}`, paddingTop:16 }}>
          {[
            [attendance?.workers_in||32,'Ouvriers',T.text],
            ['8h00','Début travaux',T.blue],
            [attendance?.off_site_alerts||1,'Incident',T.orange],
            ['Photos',`${reports.length*4||12} ajoutées`,T.orange],
          ].map(([v,l,c],i)=>(
            <div key={i}>
              <div style={{ fontSize:24, fontWeight:800, color:c, fontFamily:'DM Sans' }}>{v}</div>
              <div style={{ fontSize:11, color:T.textSub, marginTop:2 }}>{l}</div>
            </div>
          ))}
        </div>
      </Card>
      <div style={{ display:'grid', gridTemplateColumns:'1.2fr 1fr', gap:20 }}>
        <Card>
          <CardTitle>Journal de chantier — {new Date().toLocaleDateString('fr-FR',{month:'long',year:'numeric'})}</CardTitle>
          {!reports.length?<Empty icon="📓" text="Commencez le journal !"/>:reports.map(r=>(
            <Link key={r.id} to={`/projects/${r.project_id}/reports/${r.id}`} style={{ textDecoration:'none' }}>
              <div style={{ display:'flex', gap:16, padding:'14px 0', borderBottom:`1px solid ${T.border}`, cursor:'pointer' }}>
                <div style={{ textAlign:'center', flexShrink:0, width:36 }}>
                  <div style={{ fontSize:20, fontWeight:800, color:T.orange }}>{new Date(r.report_date+'T00:00:00').getDate()}</div>
                  <div style={{ fontSize:9, color:T.textMuted, textTransform:'uppercase' }}>{new Date(r.report_date+'T00:00:00').toLocaleDateString('fr-FR',{month:'short'})}</div>
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:T.text, marginBottom:4 }}>{r.project_name}</div>
                  <div style={{ fontSize:12, color:T.textSub, marginBottom:6 }}>{typeof r.work_done==='string'?r.work_done.slice(0,70)+'…':'—'}</div>
                  <div style={{ display:'flex', gap:6 }}>
                    {r.incidents_count>0&&<span style={{ padding:'2px 8px', borderRadius:100, fontSize:10, fontWeight:600, background:T.yellowLight, color:T.yellow }}>Incident</span>}
                    {r.is_validated&&<span style={{ padding:'2px 8px', borderRadius:100, fontSize:10, fontWeight:600, background:T.greenLight, color:T.green }}>Conforme</span>}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </Card>
        <Card>
          <CardTitle>Pointage — Semaine 11</CardTitle>
          {[
            ['Modibo T.','Chef équipe',48,'#F97316'],['Aminata D.','Cond. trav.',40,'#8B5CF6'],
            ['Ibrahim K.','Maçon',44,'#3B82F6'],['Fatoumata S.','Ferrailleuse',38,'#10B981'],
            ['Oumar B.','Conducteur',40,'#F59E0B'],['Seydou T.','Manœuvre',32,'#6366F1'],
          ].map(([n,r,h,c],i)=>(
            <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 0', borderBottom:`1px solid ${T.border}` }}>
              <div style={{ width:28, height:28, borderRadius:'50%', background:c, display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, color:'#fff', flexShrink:0 }}>{n.split(' ').map(x=>x[0]).join('')}</div>
              <div style={{ flex:1 }}><div style={{ fontSize:12, fontWeight:600, color:T.text }}>{n}</div><div style={{ fontSize:10, color:T.textMuted }}>{r}</div></div>
              <span style={{ fontSize:13, fontWeight:700, color:T.text }}>{h}h</span>
            </div>
          ))}
          <div style={{ display:'flex', justifyContent:'space-between', paddingTop:10, fontSize:13 }}>
            <span style={{ color:T.textSub }}>Total semaine:</span><span style={{ fontWeight:800, color:T.text }}>242 heures</span>
          </div>
        </Card>
      </div>
    </div>
  );
}

function DashboardChefEquipe({ projects, attendance }) {
  return (
    <div style={{ padding:32 }}>
      <AlertBanner text="Vous avez accès au pointage de votre équipe uniquement." type="info"/>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16, marginBottom:24 }}>
        <KPI label="Projets assignés" value={projects.length}             color={T.orange}/>
        <KPI label="Présents auj."    value={attendance?.workers_in||0}   color={T.green}/>
        <KPI label="Hors-site"        value={attendance?.off_site_alerts||0} color={T.red} alert={(attendance?.off_site_alerts||0)>0}/>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
        <Card>
          <CardTitle>Mes chantiers</CardTitle>
          {projects.map(p=>(
            <Link key={p.id} to={`/projects/${p.id}`} style={{ textDecoration:'none' }}>
              <div style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 0', borderBottom:`1px solid ${T.border}` }}>
                <div style={{ flex:1 }}><div style={{ fontSize:13, fontWeight:600, color:T.text }}>{p.name}</div><div style={{ fontSize:11, color:T.textSub }}>📍 {p.location||'—'}</div></div>
                <SBadge status={p.status}/>
              </div>
            </Link>
          ))}
          {!projects.length&&<Empty icon="👷" text="Aucun projet assigné."/>}
          <div style={{ marginTop:14 }}><BtnPrimary to="/pointage">📍 Pointer mon équipe</BtnPrimary></div>
        </Card>
        <Card><CardTitle>Présences aujourd'hui</CardTitle><Empty icon="👷" text="Aucun pointage encore."/></Card>
      </div>
    </div>
  );
}

function DashboardIngenieur({ projects }) {
  return (
    <div style={{ padding:32 }}>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16, marginBottom:28 }}>
        <KPI label="Projets suivis" value={projects.length}                                     color={T.green}/>
        <KPI label="En cours"       value={projects.filter(p=>p.status==='en_cours').length}    color={T.orange}/>
        <KPI label="Terminés"       value={projects.filter(p=>p.status==='termine').length}     color={T.green}/>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
        <Card>
          <CardTitle>Projets & Plans techniques</CardTitle>
          {projects.map(p=>(
            <Link key={p.id} to={`/projects/${p.id}`} style={{ textDecoration:'none' }}>
              <div style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 0', borderBottom:`1px solid ${T.border}` }}>
                <span style={{ fontSize:22 }}>📋</span>
                <div style={{ flex:1 }}><div style={{ fontSize:13, fontWeight:600, color:T.text }}>{p.name}</div><div style={{ fontSize:11, color:T.textSub }}>{p.project_type_display}</div></div>
                <SBadge status={p.status}/>
              </div>
            </Link>
          ))}
          {!projects.length&&<Empty icon="📐" text="Aucun projet assigné."/>}
        </Card>
        <Card><CardTitle>Gestion documentaire</CardTitle><AlertBanner text="Module Documents disponible en Phase 2 — gestion des versions DWG/PDF." type="info"/></Card>
      </div>
    </div>
  );
}

function DashboardQHSE({ projects, stats }) {
  const reports=stats?.recent_reports||[];
  const totalInc=reports.reduce((a,r)=>a+(r.incidents_count||0),0);
  return (
    <div style={{ padding:32 }}>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16, marginBottom:28 }}>
        <Card p={20}><div style={{ fontSize:12, color:T.textSub, marginBottom:4 }}>Conformités</div><div style={{ fontSize:28, fontWeight:800, color:T.green }}>18/20</div><div style={{ fontSize:12, color:T.green, marginBottom:8 }}>Score 90%</div><Pbar pct={90} color={T.green} h={6}/></Card>
        <Card p={20}><div style={{ fontSize:12, color:T.textSub, marginBottom:4 }}>Non-conformités</div><div style={{ fontSize:28, fontWeight:800, color:T.red }}>{totalInc||2}</div><div style={{ fontSize:12, color:T.red }}>Action requise</div><div style={{ height:3, background:T.red, borderRadius:2, marginTop:12, width:'30%' }}/></Card>
        <Card p={20}><div style={{ fontSize:12, color:T.textSub, marginBottom:4 }}>Réserves levées</div><div style={{ fontSize:28, fontWeight:800, color:T.yellow }}>7/9</div><div style={{ fontSize:12, color:T.yellow }}>Cette semaine</div><Pbar pct={77} color={T.yellow} h={6}/></Card>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
        <Card>
          <CardTitle badge="Ctrl: 14 Mar" badgeColor={T.blue}>Checklists sécurité</CardTitle>
          {[
            [true,'EPI - équipement complet','Modibo T.'],[true,'Balisage zone active','Chef chantier'],
            [true,'Vérification engins','Mécanicien'],[false,'Ferraillage km 12 non conforme','Ing. structure'],
            [true,'Stockage produits chimiques','Magasinier'],[null,'Évacuation eau de pluie','À vérifier'],
            [true,'Formation sécurité à jour','RH'],
          ].map(([ok,t,b],i)=>(
            <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 0', borderBottom:`1px solid ${T.border}` }}>
              <div style={{ width:22, height:22, borderRadius:4, background:ok===true?T.greenLight:ok===false?T.redLight:T.yellowLight, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, flexShrink:0, color:ok===true?T.green:ok===false?T.red:T.yellow, fontWeight:700 }}>
                {ok===true?'OK':ok===false?'X':'!'}
              </div>
              <div style={{ flex:1 }}><div style={{ fontSize:12, fontWeight:600, color:T.text }}>{t}</div><div style={{ fontSize:11, color:T.textMuted }}>{b}</div></div>
            </div>
          ))}
        </Card>
        <Card>
          <CardTitle badge="4 ouvertes" badgeColor={T.red}>Levée de réserves</CardTitle>
          {[
            ['Ferraillage km 12 non conforme','Ing. structure','Critique','Ouverte',T.red],
            ['Drainage insuffisant - Lot B','Cond. travaux','Moyen','En cours',T.yellow],
            ['Compactage à re-contrôler','Laborantin','Faible','En cours',T.yellow],
            ['Marquage inadéquat zone C','Chef équipe','Faible','En cours',T.yellow],
            ['Balisage mis à jour','Chef chantier','Faible','Levée',T.green],
            ['Signalisation temporaire ok','Topographe','Faible','Levée',T.green],
          ].map(([t,w,s,st,c],i)=>(
            <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 0', borderBottom:`1px solid ${T.border}` }}>
              <div style={{ flex:1 }}><div style={{ fontSize:12, fontWeight:600, color:T.text }}>{t}</div><div style={{ fontSize:11, color:T.textMuted }}>{w} · Gravité: {s}</div></div>
              <span style={{ padding:'3px 9px', borderRadius:100, fontSize:11, fontWeight:600, color:c, background:`${c}15`, flexShrink:0 }}>{st}</span>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

function DashboardMagasinier({ projects, stats }) {
  const purchases=stats?.recent_purchases||[];
  return (
    <div style={{ padding:32 }}>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16, marginBottom:24 }}>
        <KPI label="Projets assignés"     value={projects.length}                                     color={T.orange}/>
        <KPI label="Livraisons récentes"  value={purchases.filter(p=>p.statut==='livre').length}      color={T.green}/>
        <KPI label="Commandes en attente" value={purchases.filter(p=>p.statut==='commande').length}   color={T.yellow} alert={purchases.some(p=>p.statut==='en_attente')}/>
      </div>
      <Card>
        <CardTitle>Achats & Livraisons</CardTitle>
        {!purchases.length?<Empty icon="📦" text="Aucun achat enregistré."/>:(
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead><tr>{['Date','Désignation','Projet','Statut'].map(h=><th key={h} style={{ textAlign:'left', padding:'8px 10px', fontSize:11, color:T.textMuted, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.4px', borderBottom:`1px solid ${T.border}`, background:'#FAFAFA' }}>{h}</th>)}</tr></thead>
            <tbody>{purchases.map((p,i)=>(
              <tr key={i} style={{ borderBottom:`1px solid ${T.border}` }}>
                <td style={{ padding:'11px 10px', fontSize:13, color:T.textSub }}>{fmtDs(p.date_commande)}</td>
                <td style={{ padding:'11px 10px', fontSize:13, fontWeight:600, color:T.text }}>{p.designation}</td>
                <td style={{ padding:'11px 10px', fontSize:13, color:T.textSub }}>{p.project_name||'—'}</td>
                <td style={{ padding:'11px 10px' }}><PBadge statut={p.statut}/></td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

function DashboardComptable({ projects, stats }) {
  const purchases=stats?.recent_purchases||[];
  const b=projects.reduce((a,p)=>a+(parseFloat(p.budget)||0),0);
  const e=projects.reduce((a,p)=>a+(parseFloat(p.actual_expenses)||0),0);
  const pct=b>0?Math.round((e/b)*100):82;
  return (
    <div style={{ padding:32 }}>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:28 }}>
        <KPI label="Budget total"       value={`${fmtFCFA(b)||'780M'} FCFA`}   color={T.text}   sub="Contractuel"/>
        <KPI label="Dépense"            value={`${fmtFCFA(e)||'640M'} FCFA`}   color={T.orange} sub={`${pct}% du budget`} alert={pct>90}/>
        <KPI label="Commandes en cours" value={`${purchases.filter(p=>p.statut==='commande').length} cmd`} color={T.yellow}/>
        <KPI label="Solde disponible"   value={`${fmtFCFA(b-e)||'120M'} FCFA`} color={T.green}  sub="Reste budgétaire"/>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1.5fr 1fr', gap:20 }}>
        <Card>
          <CardTitle>Registre des achats</CardTitle>
          {!purchases.length?<Empty icon="🛒" text="Aucun achat enregistré."/>:(
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead><tr>{['Date','Désignation','Fournisseur','Qte','Total FCFA','Statut'].map(h=><th key={h} style={{ textAlign:'left', padding:'7px 8px', fontSize:11, color:T.textMuted, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.3px', borderBottom:`1px solid ${T.border}`, background:'#FAFAFA' }}>{h}</th>)}</tr></thead>
              <tbody>{purchases.map((p,i)=>(
                <tr key={i} style={{ borderBottom:`1px solid ${T.border}` }}>
                  <td style={{ padding:'10px 8px', fontSize:12, color:T.textSub, whiteSpace:'nowrap' }}>{fmtDs(p.date_commande)}</td>
                  <td style={{ padding:'10px 8px', fontSize:12, fontWeight:600, color:T.text }}>{p.designation}</td>
                  <td style={{ padding:'10px 8px', fontSize:12, color:T.textSub }}>{p.fournisseur||'—'}</td>
                  <td style={{ padding:'10px 8px', fontSize:12, color:T.textSub }}>{p.quantite} {p.unite}</td>
                  <td style={{ padding:'10px 8px', fontSize:12, fontWeight:600, color:T.text }}>{fmtFCFA(p.total)}</td>
                  <td style={{ padding:'10px 8px' }}><PBadge statut={p.statut}/></td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </Card>
        <Card>
          <CardTitle>Budget vs Réalisé</CardTitle>
          {!projects.length?<Empty icon="💰" text="Aucun projet."/>:projects.map(p=>{
            const pp=parseFloat(p.budget)>0?Math.min(100,Math.round((parseFloat(p.actual_expenses)/parseFloat(p.budget))*100)):0;
            return (
              <div key={p.id} style={{ marginBottom:20 }}>
                <div style={{ fontSize:13, fontWeight:600, color:T.text, marginBottom:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</div>
                <div style={{ fontSize:11, color:T.textSub, marginBottom:5 }}>Prévu: {fmtFCFA(p.budget)}M · Réel: {fmtFCFA(p.actual_expenses)}M</div>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}><div style={{ flex:1, height:10, background:T.border, borderRadius:5, overflow:'hidden' }}><div style={{ height:'100%', width:`${pp}%`, background:pp>90?T.red:T.orange, borderRadius:5 }}/></div><span style={{ fontSize:12, color:T.textSub, fontWeight:600, minWidth:32, textAlign:'right' }}>{pp}%</span></div>
              </div>
            );
          })}
        </Card>
      </div>
    </div>
  );
}

function DashboardClient({ projects, stats }) {
  const reports=stats?.recent_reports||[];
  const activeP=projects.find(p=>p.status==='en_cours')||projects[0];
  return (
    <div style={{ padding:32 }}>
      <AlertBanner text="Accès en lecture seule — Tableau de bord Maître d'Ouvrage. Vous pouvez consulter l'avancement et les rapports partagés par l'entreprise." type="info"/>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16, marginBottom:28 }}>
        <KPI label="Avancement global"  value={`${activeP?.progress_pct||67}%`}                        color={T.orange} trend="+4% cette semaine"/>
        <KPI label="Jours restants"     value="47"                                                      color={T.blue}   sub="Livraison 28 Avr 2026"/>
        <KPI label="Dernier rapport"    value={reports[0]?fmtDs(reports[0].report_date):'14 Mar'}       color={T.green}  sub="Rapport semaine 11"/>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1.2fr 1fr', gap:20 }}>
        <Card>
          <CardTitle>Avancement par phase</CardTitle>
          {[
            ['Terrassement',78,'En cours',T.orange],['Fondations',55,'En cours',T.blue],
            ['Structures béton',35,'En cours',T.green],['Revêtement',10,'À venir','#CBD5E0'],
            ['Signalisation',0,'À venir','#CBD5E0'],
          ].map(([n,p,s,c],i)=>(
            <div key={i} style={{ display:'flex', alignItems:'center', gap:12, marginBottom:14 }}>
              <div style={{ width:130, fontSize:13, color:T.text, flexShrink:0 }}>{n}</div>
              <div style={{ flex:1, height:16, background:'#F1F3F5', borderRadius:3, overflow:'hidden' }}><div style={{ height:'100%', width:`${p}%`, background:c, borderRadius:3 }}/></div>
              <div style={{ display:'flex', gap:6, alignItems:'center', flexShrink:0 }}>
                <span style={{ padding:'2px 8px', borderRadius:100, fontSize:10, fontWeight:600, color:p>0?T.orange:T.textMuted, background:p>0?T.orangeLight:T.border }}>{s}</span>
                <span style={{ fontSize:12, color:T.textSub, fontWeight:600, width:32, textAlign:'right' }}>{p}%</span>
              </div>
            </div>
          ))}
        </Card>
        <Card>
          <CardTitle>Rapports partagés</CardTitle>
          {[
            ['Rapport Sem. 11','14 Mar 2026','PDF',T.green],
            ['Rapport Sem. 10','07 Mar 2026','PDF',T.green],
            ['Bilan mensuel Fév','28 Fév 2026','PDF',T.green],
            ['Photos terrain','14 Mar 2026','Galerie',T.purple],
          ].map(([l,d,t,c],i)=>(
            <div key={i} style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 0', borderBottom:`1px solid ${T.border}` }}>
              <div style={{ width:44, height:44, borderRadius:8, background:`${c}18`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <span style={{ fontSize:11, fontWeight:700, color:c }}>{t}</span>
              </div>
              <div style={{ flex:1 }}><div style={{ fontSize:13, fontWeight:600, color:T.text }}>{l}</div><div style={{ fontSize:11, color:T.textSub }}>{d}</div></div>
              <button style={{ padding:'5px 12px', borderRadius:6, border:`1px solid ${T.border}`, background:T.card, color:T.textSub, fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>Télécharger</button>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════════════════

const TITLES = {
  app_owner:'Tableau de bord - Administration', admin_entreprise:"Vue d'ensemble",
  office_admin:"Vue d'ensemble - Ressources", chef_projet:"Vue d'ensemble",
  chef_chantier:'Journal de Chantier', chef_equipe:'Mon équipe — Pointage',
  ingenieur:'Documents & Plans', qhse:'Contrôle Qualité & Sécurité (QHSE)',
  magasinier:'Stocks & Livraisons', comptable:'Budget & Achats', client:'Suivi',
};

const CTA_CFG = {
  admin_entreprise:{ outline:'+ Journal du jour', primary:'Générer rapport IA' },
  chef_projet:     { outline:'+ Journal du jour', primary:'Générer rapport IA' },
  chef_chantier:   { outline:'+ Journal du jour', primary:'+ Nouvelle entrée'  },
  comptable:       { outline:'+ Journal du jour', primary:'Exporter rapport'   },
  qhse:            { outline:'+ Journal du jour', primary:'Générer rapport QHSE'},
  client:          { outline:null,                primary:'Télécharger rapport' },
};

export default function DashboardPage() {
  const { user } = useAuth();
  const { role } = usePermissions();
  const [projects,setProjects]=useState([]);
  const [stats,setStats]=useState(null);
  const [team,setTeam]=useState([]);
  const [workers,setWorkers]=useState([]);
  const [companies,setCompanies]=useState([]);
  const [attendance,setAttendance]=useState(null);
  const [offSiteAlerts,setOffSiteAlerts]=useState([]);
  const [loading,setLoading]=useState(true);

  const activeProject=projects.find(p=>p.status==='en_cours')||projects[0];

  useEffect(()=>{
    const calls=[
      projectsAPI.list().catch(()=>({data:[]})),
      projectsAPI.getDashboardStats().catch(()=>({data:null})),
    ];
    if(['app_owner','admin_entreprise','office_admin'].includes(role)) calls.push(teamAPI.list().catch(()=>({data:[]})));
    if(['office_admin','admin_entreprise','app_owner'].includes(role)) calls.push(workersAPI.list().catch(()=>({data:[]})));
    if(role==='app_owner') calls.push(companiesAPI.list().catch(()=>({data:[]})));
    Promise.all(calls).then(results=>{
      const[pR,sR,...rest]=results;
      setProjects(pR.data||[]); setStats(sR.data);
      let i=0;
      if(['app_owner','admin_entreprise','office_admin'].includes(role)){setTeam(rest[i]?.data||[]);i++;}
      if(['office_admin','admin_entreprise','app_owner'].includes(role)){setWorkers(rest[i]?.data||[]);i++;}
      if(role==='app_owner') setCompanies(rest[i]?.data||[]);
    }).finally(()=>setLoading(false));
  },[role]);

  useEffect(()=>{
    if(!['chef_chantier','chef_equipe'].includes(role)||!projects.length) return;
    attendanceAPI.summary(projects[0]?.id).then(r=>setAttendance(r.data)).catch(()=>{});
  },[role,projects]);

  useEffect(()=>{
    if(!['admin_entreprise','app_owner','chef_projet'].includes(role)||!projects.length) return;
    Promise.all(projects.filter(p=>p.status==='en_cours').map(p=>attendanceAPI.alerts(p.id).then(r=>r.data?.alerts||[]).catch(()=>[]))).then(r=>setOffSiteAlerts(r.flat()));
  },[role,projects]);

  const cta=CTA_CFG[role];
  const title=TITLES[role]||'Tableau de bord';
  const subtitle=activeProject?.name||'';

  return (
    <AppLayout projectName={subtitle}>
      {/* Top bar */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'0 32px', height:60, background:'#fff', borderBottom:`1px solid ${T.border}`, position:'sticky', top:0, zIndex:10 }}>
        <h1 style={{ margin:0, fontSize:18, fontWeight:700, color:T.text }}>{title}{subtitle?` - ${subtitle}`:''}</h1>
        <div style={{ display:'flex', gap:10 }}>
          {cta?.outline&&<BtnOutline>{cta.outline}</BtnOutline>}
          {cta?.primary&&<BtnPrimary>{cta.primary}</BtnPrimary>}
        </div>
      </div>

      {loading?(
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:400 }}>
          <div style={{ width:36, height:36, border:`3px solid ${T.orange}`, borderTopColor:'transparent', borderRadius:'50%', animation:'spin 1s linear infinite'}}/>
          <p style={{ color:T.textSub, fontSize:14, marginTop:14 }}>Chargement...</p>
        </div>
      ):(
        <>
          {role==='app_owner'        &&<DashboardAppOwner     stats={stats}     companies={companies}/>}
          {role==='admin_entreprise' &&<DashboardDirecteur    projects={projects} stats={stats} offSiteAlerts={offSiteAlerts}/>}
          {role==='office_admin'     &&<DashboardOfficeAdmin  projects={projects} team={team} workers={workers} stats={stats}/>}
          {role==='chef_projet'      &&<DashboardChefProjet   projects={projects} stats={stats}/>}
          {role==='chef_chantier'    &&<DashboardChefChantier projects={projects} stats={stats} attendance={attendance}/>}
          {role==='chef_equipe'      &&<DashboardChefEquipe   projects={projects} attendance={attendance}/>}
          {role==='ingenieur'        &&<DashboardIngenieur    projects={projects}/>}
          {role==='qhse'             &&<DashboardQHSE         projects={projects} stats={stats}/>}
          {role==='magasinier'       &&<DashboardMagasinier   projects={projects} stats={stats}/>}
          {role==='comptable'        &&<DashboardComptable    projects={projects} stats={stats}/>}
          {role==='client'           &&<DashboardClient       projects={projects} stats={stats}/>}
        </>
      )}
    </AppLayout>
  );
}