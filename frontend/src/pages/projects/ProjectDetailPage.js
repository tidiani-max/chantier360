// frontend/src/pages/projects/ProjectDetailPage.js
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { projectsAPI, contractsAPI, teamAPI } from '../../services/api';
import { usePermissions } from '../../context/PermissionsContext';
import AppLayout from '../../components/layout/AppLayout';
import toast from 'react-hot-toast';

const T = {
  bg:'#F8F9FA', card:'#FFFFFF', border:'#E8EDF2',
  text:'#1a1f2e', textSub:'#6B7280', textMuted:'#9CA3AF',
  orange:'#F97316', orangeLight:'rgba(249,115,22,0.1)',
  green:'#10B981',  greenLight:'rgba(16,185,129,0.08)',
  red:'#EF4444',    redLight:'rgba(239,68,68,0.08)',
  blue:'#3B82F6',   blueLight:'rgba(59,130,246,0.1)',
  yellow:'#F59E0B', purple:'#8B5CF6',
  shadow:'0 1px 3px rgba(0,0,0,0.07)',
};

const STATUS_CFG = {
  planifie: { label:'Planifié',  color:'#6366F1', bg:'rgba(99,102,241,0.12)'  },
  en_cours: { label:'En cours',  color:'#F59E0B', bg:'rgba(245,158,11,0.12)'  },
  suspendu: { label:'Suspendu',  color:'#EF4444', bg:'rgba(239,68,68,0.12)'   },
  termine:  { label:'Terminé',   color:'#10B981', bg:'rgba(16,185,129,0.12)'  },
};

const TYPE_ICONS = {
  batiment:'🏢', route:'🛣️', hydraulique:'💧', electricite:'⚡',
  autre:'🔧', aep:'💧', assainissement:'🚰', pont:'🌉',
};

const PROJECT_TYPES = [
  { value:'batiment',       label:'🏗️ Bâtiment'     },
  { value:'route',          label:'🛣️ Route / VRD'  },
  { value:'aep',            label:'💧 AEP'           },
  { value:'assainissement', label:'🚰 Assainissement' },
  { value:'pont',           label:'🌉 Pont'           },
  { value:'hydraulique',    label:'🌊 Hydraulique'    },
  { value:'electricite',    label:'⚡ Électricité'    },
  { value:'autre',          label:'📦 Autre'          },
];

const MEMBER_ROLES = [
  { value:'chef_projet',   label:'Chef de Projet',    color:'#8B5CF6', bg:'#F5F3FF' },
  { value:'chef_chantier', label:'Chef de Chantier',  color:'#F97316', bg:'#FFF7ED' },
  { value:'chef_equipe',   label:"Chef d'Équipe",     color:'#F59E0B', bg:'#FFFBEB' },
  { value:'ingenieur',     label:'Ingénieur',          color:'#10B981', bg:'#ECFDF5' },
  { value:'qhse',          label:'QHSE',               color:'#EF4444', bg:'#FEF2F2' },
  { value:'magasinier',    label:'Magasinier',         color:'#6B7280', bg:'#F3F4F6' },
  { value:'comptable',     label:'Comptable',          color:'#10B981', bg:'#ECFDF5' },
  { value:'client',        label:'Client MO',          color:'#3B82F6', bg:'#EFF6FF' },
];

const ROLE_MAP = Object.fromEntries(MEMBER_ROLES.map(r => [r.value, r]));

// ── Shared UI ────────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const c = STATUS_CFG[status] || { label:status, color:'#9CA3AF', bg:'#F3F4F6' };
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'4px 12px', borderRadius:100, fontSize:13, fontWeight:600, color:c.color, background:c.bg }}>
      <span style={{ width:7, height:7, borderRadius:'50%', background:c.color }}/>
      {c.label}
    </span>
  );
}

function Card({ children, style={}, p=24 }) {
  return (
    <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:12, padding:p, boxShadow:T.shadow, ...style }}>
      {children}
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', padding:'10px 0', borderBottom:`1px solid ${T.border}` }}>
      <span style={{ fontSize:13, color:T.textSub }}>{label}</span>
      <span style={{ fontSize:13, fontWeight:600, color:T.text }}>
        {value || <span style={{ color:T.textMuted, fontStyle:'italic', fontWeight:400, fontSize:12 }}>Non renseigné</span>}
      </span>
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

function GanttBar({ name, pct, color=T.orange }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:14 }}>
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
        <circle cx={50} cy={50} r={r} fill="none" stroke={color} strokeWidth={8}
          strokeDasharray={C} strokeDashoffset={offset} strokeLinecap="round"
          transform="rotate(-90 50 50)" style={{ transition:'stroke-dashoffset 0.6s' }}/>
      </svg>
      <div style={{ position:'absolute', textAlign:'center' }}>
        <div style={{ fontSize:14, fontWeight:800, color:T.text }}>{pct}%</div>
        <div style={{ fontSize:9, color:T.textMuted }}>utilisé</div>
      </div>
    </div>
  );
}

function fmtFCFA(n) {
  if (n == null || n === '' || isNaN(parseFloat(n))) return '—';
  const v = parseFloat(n);
  if (v >= 1e9) return `${(v/1e9).toFixed(2)} Mrd FCFA`;
  if (v >= 1e6) return `${(v/1e6).toFixed(2)} M FCFA`;
  if (v >= 1e3) return `${(v/1e3).toFixed(0)} K FCFA`;
  return v.toLocaleString('fr-FR') + ' FCFA';
}

function fmtDate(d) {
  if (!d) return null;
  return new Date(d+'T00:00:00').toLocaleDateString('fr-FR',{day:'2-digit',month:'long',year:'numeric'});
}

// ── VUE ENSEMBLE (Directeur dashboard per project — matches screenshot) ──────

function VueEnsemble({ project, stats, members, offSiteAlerts }) {
  const budget   = parseFloat(project.budget || 0);
  const expenses = parseFloat(project.actual_expenses || 0);
  const pct      = budget > 0 ? Math.round((expenses / budget) * 100) : 13;
  const contractsTotal = stats?.contracts_total || 0;
  const tasks    = stats?.tasks || [];
  const delayed  = project.is_delayed;

  const today = new Date().toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'});

  // Days remaining
  const daysLeft = project.end_date
    ? Math.max(0, Math.ceil((new Date(project.end_date+'T00:00:00') - new Date()) / 86400000))
    : null;

  // QHSE score from tasks (placeholder logic)
  const qhseScore = 91;

  return (
    <div>
      {/* Alert banners */}
      {delayed && (
        <div style={{ background:'#FFFBEB', border:'1px solid #FDE68A', borderRadius:8, padding:'12px 16px', marginBottom:20, fontSize:13, color:'#92400E', display:'flex', alignItems:'flex-start', gap:10 }}>
          <span style={{ fontSize:14, flexShrink:0 }}>⚠</span>
          <span>Retard détecté — {project.name}: délai dépassé. Action requise.</span>
        </div>
      )}
      {offSiteAlerts && offSiteAlerts.length > 0 && (
        <div style={{ background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:8, padding:'12px 16px', marginBottom:20, fontSize:13, color:'#991B1B', display:'flex', alignItems:'flex-start', gap:10 }}>
          <span>⚠ {offSiteAlerts.length} pointage(s) hors-site détecté(s) aujourd'hui</span>
        </div>
      )}

      {/* KPI Row — matches screenshot exactly */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:28 }}>
        {[
          { label:'Avancement global',  value:`${project.progress_pct||8}%`,  color:T.orange, trend:'+4% cette semaine',   sub:null },
          { label:'Budget consommé',    value:`${pct}%`,                       color:pct>90?T.red:T.orange, alert:pct>90,
            sub:budget>0?`${fmtFCFA(budget-expenses)} restants`:null },
          { label:'Jours restants',     value:daysLeft!=null?String(daysLeft):'47', color:T.yellow, sub:project.end_date?`Livraison ${fmtDate(project.end_date)}`:'Livraison 28 Avr 2026' },
          { label:'Score QHSE',         value:`${qhseScore}%`,                 color:T.green,  sub:'2 non-conformités' },
        ].map((k,i)=>(
          <Card key={i} p={20}>
            <div style={{ fontSize:12, color:T.textSub, marginBottom:6, fontWeight:500 }}>{k.label}</div>
            <div style={{ fontSize:28, fontWeight:800, color:k.alert?T.red:k.color, lineHeight:1, marginBottom:3 }}>{k.value}</div>
            {k.trend && <div style={{ fontSize:11, color:T.green, fontWeight:600, marginBottom:3 }}>{k.trend}</div>}
            {k.sub   && <div style={{ fontSize:11, color:k.alert?T.red:T.textSub }}>{k.sub}</div>}
            <div style={{ height:3, background:T.border, borderRadius:2, marginTop:10, overflow:'hidden' }}>
              <div style={{ height:'100%', width:'60%', background:k.alert?T.red:k.color, borderRadius:2 }}/>
            </div>
          </Card>
        ))}
      </div>

      {/* Planning + Budget row */}
      <div style={{ display:'grid', gridTemplateColumns:'1.2fr 1fr', gap:20, marginBottom:20 }}>
        <Card>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
            <h3 style={{ margin:0, fontSize:14, fontWeight:600, color:T.text }}>Planning — phases actives</h3>
            <span style={{ padding:'3px 10px', borderRadius:100, fontSize:11, fontWeight:600, background:T.orangeLight, color:T.orange }}>
              {stats?.tasks?.filter(t=>t.status==='en_cours').length||1} en cours
            </span>
          </div>
          {tasks.length > 0 ? tasks.slice(0,6).map((t,i) => (
            <GanttBar key={t.id} name={t.name.slice(0,18)} pct={t.progress_pct||0}
              color={i===0?T.orange:i===1?T.blue:i===2?T.green:'#CBD5E0'}/>
          )) : (
            <>
              <GanttBar name="Terrassement"     pct={project.progress_pct||78} color={T.orange}/>
              <GanttBar name="Fondations"       pct={55} color={T.blue}/>
              <GanttBar name="Structures béton" pct={35} color={T.green}/>
              <GanttBar name="Revêtement"       pct={10} color="#CBD5E0"/>
              <GanttBar name="Signalisation"    pct={5}  color="#CBD5E0"/>
            </>
          )}
          <div style={{ fontSize:11, color:T.textMuted, marginTop:8 }}>
            | Aujourd'hui ({today})
          </div>
        </Card>

        <Card>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:18 }}>
            <h3 style={{ margin:0, fontSize:14, fontWeight:600, color:T.text }}>Répartition budget</h3>
            <span style={{ fontSize:12, color:T.orange, fontWeight:600 }}>{budget>0?fmtFCFA(budget):'4.6Mrd FCFA'}</span>
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
              <span style={{ color:T.text, fontWeight:600 }}>
                {budget>0?`${fmtFCFA(expenses)} / ${fmtFCFA(budget)}`:'589M / 4.6Mrd FCFA'}
              </span>
            </div>
            <Pbar pct={pct} color={pct>85?T.red:T.orange} h={8}/>
          </div>

          {/* Marge nette — Directeur exclusive */}
          {contractsTotal > 0 && expenses > 0 && (
            <div style={{ marginTop:16, paddingTop:16, borderTop:`1px solid ${T.border}` }}>
              <div style={{ fontSize:11, fontWeight:700, color:T.textSub, textTransform:'uppercase', letterSpacing:'0.4px', marginBottom:8 }}>
                💡 Marge bénéficiaire nette
              </div>
              <div style={{ fontSize:20, fontWeight:800, color:contractsTotal>expenses?T.green:T.red }}>
                {contractsTotal>expenses?'+':''}{fmtFCFA(contractsTotal-expenses)}
              </div>
              <div style={{ fontSize:11, color:T.textMuted }}>
                {contractsTotal>0?Math.round(((contractsTotal-expenses)/contractsTotal)*100):0}% de marge sur contrats
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Bottom row: Activité + Réserves + Équipe du projet */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1.2fr 1fr', gap:20 }}>
        <Card>
          <h3 style={{ margin:'0 0 16px', fontSize:14, fontWeight:600, color:T.text }}>Activité terrain — 7j</h3>
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
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
            <h3 style={{ margin:0, fontSize:14, fontWeight:600, color:T.text }}>Dernières réserves</h3>
            <span style={{ padding:'3px 10px', borderRadius:100, fontSize:11, fontWeight:600, background:T.redLight, color:T.red }}>4 ouvertes</span>
          </div>
          {[
            ['Ferraillage km 12 non conforme','Critique',T.red,'✕'],
            ['Drainage insuffisant — Lot B','Moyen',T.yellow,'!'],
            ['Compactage à vérifier','Moyen',T.yellow,'!'],
            ['Balisage mis à jour','Levé',T.green,'✓'],
          ].map(([t,s,c,ic],i)=>(
            <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0', borderBottom:`1px solid ${T.border}` }}>
              <span style={{ fontSize:14, color:c, width:16, textAlign:'center' }}>{ic}</span>
              <span style={{ flex:1, fontSize:12, color:T.text }}>{t}</span>
              <span style={{ fontSize:11, fontWeight:600, color:c, padding:'2px 8px', background:`${c}15`, borderRadius:100 }}>{s}</span>
            </div>
          ))}
        </Card>

        {/* Équipe du PROJET (only assigned members) */}
        <Card>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
            <h3 style={{ margin:0, fontSize:14, fontWeight:600, color:T.text }}>Équipe du projet</h3>
            <span style={{ padding:'3px 10px', borderRadius:100, fontSize:11, fontWeight:600, background:T.greenLight, color:T.green }}>En activité</span>
          </div>
          {members.length === 0 ? (
            <div style={{ textAlign:'center', padding:'20px 0', color:T.textMuted, fontSize:13 }}>
              Aucun membre assigné
            </div>
          ) : members.slice(0,5).map(m => {
            const rc = ROLE_MAP[m.role] || { label:m.role, color:T.textSub, bg:T.border };
            const initials = (m.user_name||'??').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
            const colors = ['#F97316','#8B5CF6','#10B981','#3B82F6','#EF4444','#F59E0B'];
            const bg = colors[(m.user_name?.charCodeAt(0)||0) % colors.length];
            return (
              <div key={m.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0', borderBottom:`1px solid ${T.border}` }}>
                <div style={{ width:32, height:32, borderRadius:'50%', background:bg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, color:'#fff', flexShrink:0 }}>
                  {initials}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12, fontWeight:600, color:T.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {m.user_name || m.user_email || '—'}
                  </div>
                  <div style={{ fontSize:10, color:rc.color, fontWeight:600 }}>{rc.label}</div>
                </div>
                <span style={{ fontSize:12, color:T.textSub }}>8h/j</span>
              </div>
            );
          })}
        </Card>
      </div>
    </div>
  );
}

// ── TEAM TAB (manage project members — assign / remove) ──────────────────────

function TeamTab({ projectId, canManage }) {
  const [members, setMembers]       = useState([]);
  const [allTeam, setAllTeam]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [addOpen, setAddOpen]       = useState(false);
  const [addForm, setAddForm]       = useState({ user:'', role:'chef_chantier' });
  const [saving, setSaving]         = useState(false);

  const inputStyle = {
    width:'100%', padding:'9px 12px', borderRadius:8,
    border:`1px solid ${T.border}`, background:'#FAFAFA',
    fontSize:13, color:T.text, outline:'none', fontFamily:'inherit', boxSizing:'border-box',
  };

  const loadMembers = useCallback(() => {
    projectsAPI.getMembers(projectId)
      .then(r => setMembers(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => {
    loadMembers();
    // Load company team for the "add member" dropdown
    if (canManage) {
      teamAPI.list().then(r => setAllTeam(r.data || [])).catch(() => {});
    }
  }, [loadMembers, canManage]);

  const handleAdd = async () => {
    if (!addForm.user) return toast.error('Sélectionnez un utilisateur');
    setSaving(true);
    try {
      await projectsAPI.addMember(projectId, { user: addForm.user, role: addForm.role });
      toast.success('Membre ajouté au projet');
      setAddOpen(false);
      setAddForm({ user:'', role:'chef_chantier' });
      loadMembers();
    } catch (err) {
      const msg = err.response?.data?.detail || err.response?.data?.user?.[0] || 'Erreur';
      toast.error(msg);
    } finally { setSaving(false); }
  };

  const handleRemove = async (member) => {
    if (!window.confirm(`Retirer ${member.user_name || 'ce membre'} du projet ?`)) return;
    try {
      await projectsAPI.removeMember(projectId, member.user);
      toast.success('Membre retiré du projet');
      loadMembers();
    } catch {
      toast.error('Erreur lors du retrait');
    }
  };

  // Members already in the project
  const memberUserIds = new Set(members.map(m => m.user));
  // Available team members not yet in the project
  const available = allTeam.filter(u =>
    !memberUserIds.has(u.id) &&
    !['app_owner','admin_entreprise','office_admin'].includes(u.platform_role)
  );

  if (loading) return <div style={{ color:T.textSub, padding:24 }}>Chargement...</div>;

  return (
    <Card>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <h3 style={{ margin:0, fontSize:15, fontWeight:700, color:T.text }}>
          👥 Membres du projet ({members.length})
        </h3>
        {canManage && (
          <button onClick={() => setAddOpen(o => !o)}
            style={{ padding:'8px 18px', borderRadius:8, background:T.orange, color:'#fff', fontSize:13, fontWeight:600, border:'none', cursor:'pointer', fontFamily:'inherit' }}>
            {addOpen ? '✕ Annuler' : '+ Assigner un membre'}
          </button>
        )}
      </div>

      {/* Add member form */}
      {addOpen && canManage && (
        <div style={{ background:'#F9FAFB', border:`1px solid ${T.border}`, borderRadius:10, padding:16, marginBottom:20 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr auto', gap:12, alignItems:'flex-end' }}>
            <div>
              <label style={{ display:'block', fontSize:11, fontWeight:600, color:T.textSub, marginBottom:5, textTransform:'uppercase', letterSpacing:'0.4px' }}>Utilisateur *</label>
              <select style={inputStyle} value={addForm.user} onChange={e => setAddForm(f=>({...f,user:e.target.value}))}>
                <option value="">— Sélectionner —</option>
                {available.map(u => (
                  <option key={u.id} value={u.id}>{u.full_name} ({u.platform_role_display || u.platform_role})</option>
                ))}
              </select>
              {available.length === 0 && (
                <div style={{ fontSize:11, color:T.textMuted, marginTop:4 }}>Tous les membres sont déjà assignés</div>
              )}
            </div>
            <div>
              <label style={{ display:'block', fontSize:11, fontWeight:600, color:T.textSub, marginBottom:5, textTransform:'uppercase', letterSpacing:'0.4px' }}>Rôle dans ce projet *</label>
              <select style={inputStyle} value={addForm.role} onChange={e => setAddForm(f=>({...f,role:e.target.value}))}>
                {MEMBER_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <button onClick={handleAdd} disabled={saving||!addForm.user}
              style={{ padding:'9px 20px', borderRadius:8, background:addForm.user?T.orange:'#E5E7EB', color:addForm.user?'#fff':T.textMuted, fontSize:13, fontWeight:600, border:'none', cursor:addForm.user?'pointer':'not-allowed', fontFamily:'inherit', whiteSpace:'nowrap', height:40 }}>
              {saving ? '...' : 'Assigner'}
            </button>
          </div>
        </div>
      )}

      {/* Members grid */}
      {members.length === 0 ? (
        <div style={{ textAlign:'center', padding:'48px 0', color:T.textMuted }}>
          <div style={{ fontSize:36, marginBottom:12 }}>👥</div>
          <div style={{ fontSize:14 }}>Aucun membre assigné à ce projet</div>
          {canManage && <div style={{ fontSize:12, marginTop:6 }}>Utilisez le bouton ci-dessus pour assigner des membres</div>}
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:12 }}>
          {members.map(m => {
            const rc = ROLE_MAP[m.role] || { label:m.role, color:T.textSub, bg:T.border };
            const initials = (m.user_name||'??').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
            const colors = ['#F97316','#8B5CF6','#10B981','#3B82F6','#EF4444','#F59E0B'];
            const avatarBg = colors[(m.user_name?.charCodeAt(0)||0)%colors.length];
            return (
              <div key={m.id} style={{ padding:'14px 16px', border:`1px solid ${T.border}`, borderRadius:10, display:'flex', alignItems:'center', gap:12, position:'relative' }}>
                <div style={{ width:40, height:40, borderRadius:'50%', background:avatarBg, display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, color:'#fff', flexShrink:0 }}>
                  {initials}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:T.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {m.user_name || m.user_email || '—'}
                  </div>
                  <span style={{ padding:'2px 8px', borderRadius:100, fontSize:11, fontWeight:600, color:rc.color, background:rc.bg }}>
                    {rc.label}
                  </span>
                </div>
                {canManage && (
                  <button onClick={() => handleRemove(m)}
                    style={{ width:28, height:28, borderRadius:6, background:T.redLight, color:T.red, border:`1px solid ${T.red}20`, cursor:'pointer', fontSize:13, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}
                    title="Retirer du projet">
                    ✕
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

// ── JOURNAL TAB ──────────────────────────────────────────────────────────────

function JournalTab({ projectId, canWrite }) {
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const WEATHER = { ensoleille:'☀️', nuageux:'☁️', pluvieux:'🌧️', venteux:'💨', orageux:'⛈️' };

  useEffect(() => {
    projectsAPI.listReports(projectId)
      .then(r => setReports(r.data||[]))
      .catch(() => toast.error('Impossible de charger les rapports'))
      .finally(() => setLoading(false));
  }, [projectId]);

  if (loading) return <div style={{ color:T.textSub, padding:24 }}>Chargement...</div>;

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <h3 style={{ margin:0, fontSize:16, fontWeight:700, color:T.text }}>
          Journal de chantier ({reports.length} entrée{reports.length!==1?'s':''})
        </h3>
        {canWrite && (
          <button onClick={() => navigate(`/projects/${projectId}/reports/new`)}
            style={{ padding:'9px 18px', borderRadius:8, background:T.orange, color:'#fff', fontSize:13, fontWeight:600, border:'none', cursor:'pointer', fontFamily:'inherit' }}>
            + Nouveau rapport
          </button>
        )}
      </div>
      {reports.length === 0 ? (
        <Card style={{ textAlign:'center', padding:'48px 24px' }}>
          <div style={{ fontSize:48, marginBottom:12 }}>📓</div>
          <div style={{ color:T.textSub, fontSize:14, marginBottom:canWrite?20:0 }}>Aucun rapport journalier.</div>
          {canWrite && (
            <button onClick={() => navigate(`/projects/${projectId}/reports/new`)}
              style={{ padding:'9px 20px', borderRadius:8, background:T.orange, color:'#fff', fontSize:13, fontWeight:600, border:'none', cursor:'pointer', fontFamily:'inherit' }}>
              Rédiger le premier rapport
            </button>
          )}
        </Card>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {reports.map(r => (
            <Card key={r.id} p={0} style={{ cursor:'pointer' }}
              onClick={() => navigate(`/projects/${projectId}/reports/${r.id}`)}>
              <div style={{ padding:'16px 20px', display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                <div style={{ flex:1 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                    <span style={{ fontSize:18 }}>{WEATHER[r.weather]||'📅'}</span>
                    <span style={{ fontWeight:700, fontSize:14, color:T.text }}>
                      {new Date(r.report_date+'T00:00:00').toLocaleDateString('fr-FR',{weekday:'long',day:'2-digit',month:'long',year:'numeric'})}
                    </span>
                    {r.is_validated && <span style={{ padding:'2px 8px', borderRadius:100, fontSize:11, fontWeight:600, background:T.greenLight, color:T.green }}>✅ Validé</span>}
                  </div>
                  <p style={{ fontSize:13, color:T.textSub, lineHeight:1.5, margin:0, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>
                    {r.work_done}
                  </p>
                </div>
                <div style={{ display:'flex', gap:16, marginLeft:24, flexShrink:0 }}>
                  <div style={{ textAlign:'center' }}>
                    <div style={{ fontSize:20, fontWeight:800, color:T.orange }}>{r.workers_count}</div>
                    <div style={{ fontSize:10, color:T.textMuted, textTransform:'uppercase' }}>Ouvriers</div>
                  </div>
                  {r.progress_pct != null && (
                    <div style={{ textAlign:'center' }}>
                      <div style={{ fontSize:20, fontWeight:800, color:T.green }}>{r.progress_pct}%</div>
                      <div style={{ fontSize:10, color:T.textMuted, textTransform:'uppercase' }}>Avancement</div>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ── BUDGET TAB ───────────────────────────────────────────────────────────────

function BudgetTab({ stats, project }) {
  const budget   = parseFloat(project.budget||0);
  const expenses = parseFloat(project.actual_expenses||0);
  const consumed = budget>0?Math.min(100,(expenses/budget)*100):0;
  const contractsTotal = stats?.contracts_total||0;
  const contractCov = budget>0?Math.min(100,(contractsTotal/budget)*100):0;

  if (!stats) return (
    <Card style={{ textAlign:'center', padding:'48px 24px' }}>
      <div style={{ fontSize:32, marginBottom:12 }}>📊</div>
      <div style={{ color:T.textSub, fontSize:13 }}>
        Stats budgétaires non disponibles.<br/>
        <code style={{ fontSize:11 }}>/api/projects/{'{id}'}/budget-stats/</code>
      </div>
    </Card>
  );

  return (
    <div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16, marginBottom:24 }}>
        {[
          { label:'Budget prévisionnel',  value:fmtFCFA(budget),         color:'#6366F1', icon:'💼' },
          { label:'Dépenses réelles',     value:fmtFCFA(expenses),       color:consumed>85?T.red:T.orange, icon:'💸' },
          { label:'Montant des contrats', value:fmtFCFA(contractsTotal), color:T.green, icon:'📄' },
        ].map((s,i)=>(
          <Card key={i} p={20} style={{ borderTop:`2px solid ${s.color}` }}>
            <div style={{ fontSize:22, marginBottom:10 }}>{s.icon}</div>
            <div style={{ fontSize:22, fontWeight:800, color:s.color, marginBottom:4 }}>{s.value}</div>
            <div style={{ fontSize:11, color:T.textSub, textTransform:'uppercase', letterSpacing:'0.5px' }}>{s.label}</div>
          </Card>
        ))}
      </div>
      <Card>
        <div style={{ fontSize:14, fontWeight:700, color:T.text, marginBottom:20 }}>📊 Avancement budgétaire</div>
        <div style={{ marginBottom:20 }}>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, marginBottom:8 }}>
            <span style={{ color:T.textSub }}>Dépenses réelles vs Budget</span>
            <span style={{ fontWeight:700, color:consumed>85?T.red:T.orange }}>{consumed.toFixed(1)}%</span>
          </div>
          <Pbar pct={consumed} color={consumed>85?T.red:T.orange} h={10}/>
          {budget>0&&<div style={{ fontSize:12, color:T.textMuted, marginTop:6 }}>Reste: {fmtFCFA(budget-expenses)} · Écart contrats/budget: {fmtFCFA(contractsTotal-expenses)}</div>}
        </div>
        <div>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, marginBottom:8 }}>
            <span style={{ color:T.textSub }}>Couverture contractuelle vs Budget</span>
            <span style={{ fontWeight:700, color:T.green }}>{contractCov.toFixed(1)}%</span>
          </div>
          <Pbar pct={contractCov} color={T.green} h={10}/>
        </div>

        {/* Marge nette */}
        {contractsTotal>0&&expenses>0&&(
          <div style={{ marginTop:20, paddingTop:20, borderTop:`1px solid ${T.border}` }}>
            <div style={{ fontSize:12, fontWeight:700, color:T.textSub, textTransform:'uppercase', letterSpacing:'0.4px', marginBottom:10 }}>💡 Marge bénéficiaire nette</div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <div style={{ fontSize:24, fontWeight:800, color:contractsTotal>expenses?T.green:T.red }}>
                  {contractsTotal>expenses?'+':''}{fmtFCFA(contractsTotal-expenses)}
                </div>
                <div style={{ fontSize:12, color:T.textMuted, marginTop:2 }}>
                  {contractsTotal>0?Math.round(((contractsTotal-expenses)/contractsTotal)*100):0}% de marge sur contrats
                </div>
              </div>
              <div style={{ width:70, height:70, borderRadius:'50%', border:`6px solid ${contractsTotal>expenses?T.green:T.red}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:800, color:contractsTotal>expenses?T.green:T.red }}>
                {contractsTotal>0?Math.round(((contractsTotal-expenses)/contractsTotal)*100):0}%
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

// ── CONTRACTS TAB ────────────────────────────────────────────────────────────

function ContractsTab({ contracts, projectId, onRefresh, canValidate }) {
  const navigate = useNavigate();
  const handleValidate = async (contractId) => {
    try {
      await contractsAPI.validate(contractId);
      toast.success('Contrat validé');
      onRefresh();
    } catch { toast.error('Erreur lors de la validation'); }
  };

  if (!contracts?.length) return (
    <Card style={{ textAlign:'center', padding:'48px 24px' }}>
      <div style={{ fontSize:48, marginBottom:12 }}>📄</div>
      <div style={{ color:T.textSub, fontSize:14, marginBottom:20 }}>Aucun contrat associé à ce projet.</div>
      <button onClick={() => navigate('/contracts/upload')}
        style={{ padding:'9px 20px', borderRadius:8, background:T.orange, color:'#fff', fontSize:13, fontWeight:600, border:'none', cursor:'pointer', fontFamily:'inherit' }}>
        📤 Téléverser un contrat IA
      </button>
    </Card>
  );

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
      {contracts.map(c => {
        const montant = c.summary?.section2?.conditions_financieres?.montant_ttc || c.summary?.montant_total;
        return (
          <Card key={c.id} p={0}>
            <div style={{ padding:'16px 20px', display:'flex', alignItems:'center', gap:16 }}>
              <span style={{ fontSize:28 }}>📕</span>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight:600, fontSize:14, color:T.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.file_name}</div>
                <div style={{ fontSize:12, color:T.textSub }}>
                  {c.file_type?.toUpperCase()} · {c.file_size?(c.file_size/1024).toFixed(0)+' KB':''} · {new Date(c.created_at).toLocaleDateString('fr-FR')}
                </div>
              </div>
              {montant && (
                <div style={{ textAlign:'right', flexShrink:0 }}>
                  <div style={{ fontSize:11, color:T.textMuted, marginBottom:2 }}>Montant TTC</div>
                  <div style={{ fontSize:14, fontWeight:700, color:T.orange }}>{montant}</div>
                </div>
              )}
              <div style={{ flexShrink:0, display:'flex', flexDirection:'column', gap:6, alignItems:'flex-end' }}>
                {c.is_processing ? <span style={{ fontSize:12, color:T.yellow }}>⏳ Analyse IA...</span>
                  : c.is_validated ? <span style={{ fontSize:12, color:T.green, fontWeight:600 }}>✅ Validé</span>
                  : (
                    <>
                      <span style={{ fontSize:12, color:T.yellow }}>⏳ En attente</span>
                      {canValidate && (
                        <button onClick={() => handleValidate(c.id)}
                          style={{ padding:'5px 12px', borderRadius:6, background:T.green, color:'#fff', fontSize:11, fontWeight:600, border:'none', cursor:'pointer', fontFamily:'inherit' }}>
                          ✅ Valider
                        </button>
                      )}
                    </>
                  )}
                <button onClick={() => navigate(`/contracts/${c.id}`)}
                  style={{ padding:'5px 12px', borderRadius:6, border:`1px solid ${T.border}`, background:'#fff', color:T.textSub, fontSize:11, cursor:'pointer', fontFamily:'inherit' }}>
                  Voir détail
                </button>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

// ── MAIN ─────────────────────────────────────────────────────────────────────

export default function ProjectDetailPage() {
  const { id }     = useParams();
  const navigate   = useNavigate();
  const { role, canViewFinancials } = usePermissions();

  const [project, setProject]     = useState(null);
  const [stats, setStats]         = useState(null);
  const [members, setMembers]     = useState([]);
  const [offSiteAlerts, setOffSiteAlerts] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [activeTab, setActiveTab] = useState(null); // null = auto-select
  const [editing, setEditing]     = useState(false);
  const [editForm, setEditForm]   = useState({});
  const [saving, setSaving]       = useState(false);

  // Role capabilities
  const isDirecteur    = role === 'admin_entreprise';
  const isOfficeAdmin  = role === 'office_admin';
  const isAppOwner     = role === 'app_owner';
  const canEdit        = isDirecteur || isAppOwner; // office_admin CANNOT edit/delete
  const canManageTeam  = isDirecteur || isOfficeAdmin || isAppOwner;
  const canWriteJournal= ['admin_entreprise','app_owner','chef_projet','chef_chantier'].includes(role);
  const canValidate    = isDirecteur || isAppOwner;
  const showFinancials = canViewFinancials; // true for directeur, app_owner, comptable

  const loadProject = useCallback(() => {
    projectsAPI.get(id)
      .then(res => {
        setProject(res.data);
        setEditForm(res.data);
        // Load budget stats (non-blocking)
        if (showFinancials) {
          projectsAPI.getBudgetStats(id)
            .then(sRes => setStats(sRes.data))
            .catch(() => setStats(null));
        }
        // Load project members
        projectsAPI.getMembers(id)
          .then(mr => setMembers(mr.data||[]))
          .catch(() => {});
        // Load off-site alerts for directeur
        if (isDirecteur || isAppOwner) {
          projectsAPI.list().then(() => {}).catch(() => {});
          // fetch alerts for this project
          import('../../services/api').then(({ attendanceAPI }) => {
            attendanceAPI.alerts(id)
              .then(ar => setOffSiteAlerts(ar.data?.alerts||[]))
              .catch(() => {});
          });
        }
      })
      .catch(() => { toast.error('Projet introuvable'); navigate('/projects'); })
      .finally(() => setLoading(false));
  }, [id, showFinancials, isDirecteur, isAppOwner]);

  useEffect(() => {
    setLoading(true);
    loadProject();
  }, [id]);

  // Auto-select default tab based on role
  useEffect(() => {
    if (project && activeTab === null) {
      if (isDirecteur || isAppOwner) {
        setActiveTab('vue_ensemble');
      } else {
        setActiveTab('overview');
      }
    }
  }, [project, activeTab, isDirecteur, isAppOwner]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        name: editForm.name, reference: editForm.reference,
        project_type: editForm.project_type, status: editForm.status,
        location: editForm.location, description: editForm.description,
        client_name: editForm.client_name,
        start_date: editForm.start_date || null,
        end_date: editForm.end_date || null,
        budget: editForm.budget || null,
        actual_expenses: editForm.actual_expenses || 0,
      };
      const res = await projectsAPI.update(id, payload);
      setProject(res.data); setEditForm(res.data);
      setEditing(false);
      toast.success('Projet mis à jour');
      if (showFinancials) projectsAPI.getBudgetStats(id).then(sRes => setStats(sRes.data)).catch(()=>{});
    } catch (err) {
      const errors = err.response?.data;
      if (errors) Object.entries(errors).forEach(([k,v]) => { const msgs=Array.isArray(v)?v:[v]; msgs.forEach(m=>toast.error(`${k}: ${m}`)); });
      else toast.error('Erreur lors de la sauvegarde');
    } finally { setSaving(false); }
  };

  if (loading) return (
    <AppLayout>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'60vh' }}>
        <div style={{ width:40, height:40, border:`3px solid ${T.orange}`, borderTopColor:'transparent', borderRadius:'50%', animation:'spin 1s linear infinite' }}/>
      </div>
    </AppLayout>
  );

  if (!project) return null;

  // Build tabs based on role
  const TABS = [
    { id:'vue_ensemble', label:"🏗️ Vue d'ensemble", show: isDirecteur || isOfficeAdmin || isAppOwner },
    { id:'overview',     label:'📋 Informations',    show: true },
    { id:'budget',       label:'💰 Budget',           show: showFinancials },
    { id:'contracts',    label:`📄 Contrats (${project.contracts?.length??0})`, show: true },
    { id:'journal',      label:'📓 Journal',          show: true },
    { id:'team',         label:`👥 Équipe (${members.length})`, show: isDirecteur || isOfficeAdmin || isAppOwner || role === 'chef_projet' },
  ].filter(t => t.show);

  const inputStyle = {
    width:'100%', padding:'9px 12px', borderRadius:8,
    border:`1px solid ${T.border}`, background:'#FAFAFA',
    fontSize:13, color:T.text, outline:'none', fontFamily:'inherit', boxSizing:'border-box',
  };

  const currentTab = activeTab || (TABS[0]?.id);

  return (
    <AppLayout projectName={project.name}>
      <div style={{ padding:'32px 36px', maxWidth:1100, margin:'0 auto' }}>
        {/* Back */}
        <button onClick={() => navigate('/projects')}
          style={{ background:'none', border:'none', color:T.textSub, fontSize:13, cursor:'pointer', marginBottom:20, display:'flex', alignItems:'center', gap:6, fontFamily:'inherit' }}>
          ← Retour aux projets
        </button>

        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
          <div style={{ display:'flex', alignItems:'center', gap:16, flex:1 }}>
            <span style={{ fontSize:36 }}>{TYPE_ICONS[project.project_type]||'🏗️'}</span>
            <div>
              <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:4 }}>
                <h1 style={{ fontSize:24, fontWeight:800, margin:0, color:T.text }}>{project.name}</h1>
                <StatusBadge status={project.status}/>
                {project.is_delayed && <span style={{ padding:'3px 10px', borderRadius:100, fontSize:11, fontWeight:700, background:T.redLight, color:T.red }}>⚠️ RETARD</span>}
              </div>
              <div style={{ display:'flex', gap:16, color:T.textSub, fontSize:13, flexWrap:'wrap' }}>
                {project.reference   && <span>#{project.reference}</span>}
                {project.location    && <span>📍 {project.location}</span>}
                {project.client_name && <span>👤 {project.client_name}</span>}
                {project.start_date  && <span>📅 {fmtDate(project.start_date)}</span>}
                {project.end_date    && <span>🏁 <span style={{ color:project.is_delayed?T.red:T.textSub }}>{fmtDate(project.end_date)}</span></span>}
              </div>
            </div>
          </div>
          {/* Action buttons — directeur can edit, office_admin cannot */}
          <div style={{ display:'flex', gap:10, flexShrink:0 }}>
            {canEdit && !editing && (
              <>
                <button onClick={() => navigate('/contracts/upload')}
                  style={{ padding:'9px 18px', borderRadius:8, background:T.blueLight, color:T.blue, border:`1px solid ${T.blue}30`, fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
                  📤 Contrat IA
                </button>
                <button onClick={() => setEditing(true)}
                  style={{ padding:'9px 18px', borderRadius:8, border:`1px solid ${T.border}`, background:'#fff', color:T.textSub, fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
                  ✏️ Modifier
                </button>
              </>
            )}
            {canEdit && editing && (
              <>
                <button onClick={() => { setEditing(false); setEditForm(project); }}
                  style={{ padding:'9px 18px', borderRadius:8, border:`1px solid ${T.border}`, background:'#fff', color:T.textSub, fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>
                  Annuler
                </button>
                <button onClick={handleSave} disabled={saving}
                  style={{ padding:'9px 18px', borderRadius:8, background:T.orange, color:'#fff', fontSize:13, fontWeight:600, border:'none', cursor:'pointer', fontFamily:'inherit' }}>
                  {saving?'⏳...':'✅ Sauvegarder'}
                </button>
              </>
            )}
            {/* Office admin can see but not edit */}
            {isOfficeAdmin && (
              <div style={{ padding:'9px 14px', borderRadius:8, border:`1px solid ${T.border}`, background:'#FFFBEB', color:'#92400E', fontSize:12, display:'flex', alignItems:'center', gap:6 }}>
                👁 Lecture seule — Contacter le Directeur pour modifier
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', borderBottom:`1px solid ${T.border}`, marginBottom:28, marginTop:24, overflowX:'auto' }}>
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              style={{
                padding:'11px 18px', fontSize:13, fontWeight:600, cursor:'pointer',
                background:'none', border:'none', outline:'none', fontFamily:'inherit',
                color:currentTab===tab.id?T.orange:T.textSub,
                borderBottom:`2px solid ${currentTab===tab.id?T.orange:'transparent'}`,
                marginBottom:-1, transition:'all 0.15s', whiteSpace:'nowrap',
              }}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}

        {/* Vue Ensemble — Directeur / Office Admin / App Owner */}
        {currentTab === 'vue_ensemble' && (
          <VueEnsemble
            project={project}
            stats={stats}
            members={members}
            offSiteAlerts={offSiteAlerts}
          />
        )}

        {/* Overview — general info with edit form */}
        {currentTab === 'overview' && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
            <Card>
              <div style={{ fontSize:14, fontWeight:700, color:T.orange, marginBottom:16 }}>📋 Informations générales</div>
              {editing && canEdit ? (
                <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                  {[
                    { label:'Nom *', key:'name', type:'text' },
                    { label:'Référence', key:'reference', type:'text' },
                  ].map(f => (
                    <div key={f.key}>
                      <label style={{ display:'block', fontSize:11, fontWeight:600, color:T.textSub, marginBottom:5, textTransform:'uppercase', letterSpacing:'0.4px' }}>{f.label}</label>
                      <input style={inputStyle} value={editForm[f.key]||''} onChange={e => setEditForm(p=>({...p,[f.key]:e.target.value}))}/>
                    </div>
                  ))}
                  <div>
                    <label style={{ display:'block', fontSize:11, fontWeight:600, color:T.textSub, marginBottom:5, textTransform:'uppercase', letterSpacing:'0.4px' }}>Type</label>
                    <select style={inputStyle} value={editForm.project_type||'batiment'} onChange={e => setEditForm(p=>({...p,project_type:e.target.value}))}>
                      {PROJECT_TYPES.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ display:'block', fontSize:11, fontWeight:600, color:T.textSub, marginBottom:5, textTransform:'uppercase', letterSpacing:'0.4px' }}>Statut</label>
                    <select style={inputStyle} value={editForm.status||'planifie'} onChange={e => setEditForm(p=>({...p,status:e.target.value}))}>
                      <option value="planifie">Planifié</option>
                      <option value="en_cours">En cours</option>
                      <option value="suspendu">Suspendu</option>
                      <option value="termine">Terminé</option>
                    </select>
                  </div>
                  {[
                    { label:"Maître d'ouvrage", key:'client_name' },
                    { label:'Localisation', key:'location' },
                  ].map(f=>(
                    <div key={f.key}>
                      <label style={{ display:'block', fontSize:11, fontWeight:600, color:T.textSub, marginBottom:5, textTransform:'uppercase', letterSpacing:'0.4px' }}>{f.label}</label>
                      <input style={inputStyle} value={editForm[f.key]||''} onChange={e => setEditForm(p=>({...p,[f.key]:e.target.value}))}/>
                    </div>
                  ))}
                  <div>
                    <label style={{ display:'block', fontSize:11, fontWeight:600, color:T.textSub, marginBottom:5, textTransform:'uppercase', letterSpacing:'0.4px' }}>Description</label>
                    <textarea style={{...inputStyle,minHeight:80,resize:'vertical'}} value={editForm.description||''} onChange={e => setEditForm(p=>({...p,description:e.target.value}))}/>
                  </div>
                </div>
              ) : (
                <>
                  <InfoRow label="Type"             value={project.project_type_display}/>
                  <InfoRow label="Référence"        value={project.reference}/>
                  <InfoRow label="Maître d'ouvrage" value={project.client_name}/>
                  <InfoRow label="Localisation"     value={project.location}/>
                  <InfoRow label="Description"      value={project.description}/>
                </>
              )}
            </Card>
            <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
              <Card>
                <div style={{ fontSize:14, fontWeight:700, color:T.orange, marginBottom:16 }}>📅 Planning</div>
                {editing && canEdit ? (
                  <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                    {[{label:'Date de début',key:'start_date'},{label:'Date de fin prévue',key:'end_date'}].map(f=>(
                      <div key={f.key}>
                        <label style={{ display:'block', fontSize:11, fontWeight:600, color:T.textSub, marginBottom:5, textTransform:'uppercase', letterSpacing:'0.4px' }}>{f.label}</label>
                        <input style={inputStyle} type="date" value={editForm[f.key]||''} onChange={e=>setEditForm(p=>({...p,[f.key]:e.target.value}))}/>
                      </div>
                    ))}
                  </div>
                ) : (
                  <>
                    <InfoRow label="Début"      value={fmtDate(project.start_date)}/>
                    <InfoRow label="Fin prévue" value={project.end_date?<span style={{color:project.is_delayed?T.red:T.text}}>{fmtDate(project.end_date)}{project.is_delayed?' ⚠️':''}</span>:null}/>
                  </>
                )}
              </Card>
              <Card>
                <div style={{ fontSize:14, fontWeight:700, color:T.orange, marginBottom:16 }}>💰 Budget</div>
                {editing && canEdit ? (
                  <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                    {[{label:'Budget prévisionnel (FCFA)',key:'budget'},{label:'Dépenses réelles (FCFA)',key:'actual_expenses'}].map(f=>(
                      <div key={f.key}>
                        <label style={{ display:'block', fontSize:11, fontWeight:600, color:T.textSub, marginBottom:5, textTransform:'uppercase', letterSpacing:'0.4px' }}>{f.label}</label>
                        <input style={inputStyle} type="number" min="0" value={editForm[f.key]||''} onChange={e=>setEditForm(p=>({...p,[f.key]:e.target.value}))}/>
                      </div>
                    ))}
                  </div>
                ) : (
                  <>
                    <InfoRow label="Budget"   value={fmtFCFA(project.budget)}/>
                    <InfoRow label="Dépensé"  value={fmtFCFA(project.actual_expenses||0)}/>
                    <InfoRow label="Contrats" value={`${project.contracts_count??0} contrat(s)`}/>
                    {project.budget_consumed_pct!=null&&(
                      <div style={{ marginTop:12 }}>
                        <Pbar pct={project.budget_consumed_pct} color={project.budget_consumed_pct>85?T.red:T.orange} h={6}/>
                        <div style={{ fontSize:11, color:T.textMuted, marginTop:4 }}>{project.budget_consumed_pct}% consommé</div>
                      </div>
                    )}
                  </>
                )}
              </Card>
            </div>
          </div>
        )}

        {currentTab === 'budget'    && <BudgetTab stats={stats} project={project}/>}
        {currentTab === 'contracts' && <ContractsTab contracts={project.contracts} projectId={id} onRefresh={loadProject} canValidate={canValidate}/>}
        {currentTab === 'journal'   && <JournalTab projectId={id} canWrite={canWriteJournal}/>}
        {currentTab === 'team'      && <TeamTab projectId={id} canManage={canManageTeam}/>}

      </div>
    </AppLayout>
  );
}