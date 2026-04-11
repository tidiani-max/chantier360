// frontend/src/pages/projects/ProjectPickerPage.js
// Shared project picker — used by /planning, /budget, /qhse global routes
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { projectsAPI } from '../../services/api';
import AppLayout from '../../components/layout/AppLayout';
import toast from 'react-hot-toast';

const T = {
  card:'#FFFFFF', border:'#E8EDF2', text:'#1a1f2e', textSub:'#6B7280', textMuted:'#9CA3AF',
  orange:'#F97316', orangeLight:'rgba(249,115,22,0.1)',
  green:'#10B981', greenLight:'rgba(16,185,129,0.08)',
  red:'#EF4444', redLight:'rgba(239,68,68,0.08)',
  blue:'#3B82F6', yellow:'#F59E0B', shadow:'0 1px 3px rgba(0,0,0,0.07)',
};

const STATUS_CFG = {
  planifie: { label:'Planifié',  color:'#6366F1', bg:'rgba(99,102,241,0.1)'  },
  en_cours: { label:'En cours',  color:'#F97316', bg:'rgba(249,115,22,0.1)'  },
  suspendu: { label:'Suspendu',  color:'#EF4444', bg:'rgba(239,68,68,0.1)'   },
  termine:  { label:'Terminé',   color:'#10B981', bg:'rgba(16,185,129,0.1)'  },
};

const TYPE_ICONS = {
  batiment:'🏢', route:'🛣️', hydraulique:'💧', electricite:'⚡',
  autre:'🔧', aep:'💧', assainissement:'🚰', pont:'🌉',
};

const MODULE_CFG = {
  planning: { icon:'📅', title:'Planning / Gantt',  label:'Voir le planning',  color:'#3B82F6' },
  budget:   { icon:'💰', title:'Budget & Achats',   label:'Voir le budget',    color:'#F97316' },
  qhse:     { icon:'🛡️', title:'QHSE / Sécurité',  label:'Voir le QHSE',      color:'#EF4444' },
  pointage: { icon:'📍', title:'Pointage GPS',      label:'Pointer',           color:'#10B981' },
};

export default function ProjectPickerPage({ module = 'planning' }) {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');

  const cfg = MODULE_CFG[module] || MODULE_CFG.planning;

  useEffect(() => {
    projectsAPI.list()
      .then(r => setProjects(r.data || []))
      .catch(() => toast.error('Erreur chargement'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = projects.filter(p => {
    const q = search.toLowerCase();
    return !q || p.name.toLowerCase().includes(q) || (p.location||'').toLowerCase().includes(q);
  });

  const active = filtered.filter(p => p.status === 'en_cours');
  const others = filtered.filter(p => p.status !== 'en_cours');

  return (
    <AppLayout>
      {/* Top bar */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'0 32px', height:60, background:'#fff', borderBottom:`1px solid ${T.border}`, position:'sticky', top:0, zIndex:10 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <span style={{ fontSize:22 }}>{cfg.icon}</span>
          <h1 style={{ margin:0, fontSize:17, fontWeight:700, color:T.text }}>{cfg.title} — Sélectionner un projet</h1>
        </div>
        <input
          placeholder="🔍 Rechercher un projet..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ padding:'8px 14px', borderRadius:8, border:`1px solid ${T.border}`, background:'#fff', fontSize:13, color:T.text, outline:'none', fontFamily:'inherit', width:260 }}
        />
      </div>

      <div style={{ padding:32 }}>
        {loading ? (
          <div style={{ textAlign:'center', padding:'60px 0', color:T.textMuted }}>
            <div style={{ width:32, height:32, border:`3px solid ${T.orange}`, borderTopColor:'transparent', borderRadius:'50%', animation:'spin 1s linear infinite', margin:'0 auto 12px' }}/>
            Chargement...
          </div>
        ) : projects.length === 0 ? (
          <div style={{ textAlign:'center', padding:'80px 0', color:T.textMuted }}>
            <div style={{ fontSize:48, marginBottom:16 }}>{cfg.icon}</div>
            <div style={{ fontSize:15, fontWeight:600, color:T.text, marginBottom:8 }}>Aucun projet disponible</div>
            <div style={{ fontSize:13 }}>Créez un projet pour accéder à ce module</div>
            <button onClick={() => navigate('/projects/new')}
              style={{ marginTop:20, padding:'10px 24px', borderRadius:8, background:T.orange, color:'#fff', fontSize:13, fontWeight:600, border:'none', cursor:'pointer', fontFamily:'inherit' }}>
              + Nouveau projet
            </button>
          </div>
        ) : (
          <>
            {/* Active projects first */}
            {active.length > 0 && (
              <>
                <div style={{ fontSize:12, fontWeight:700, color:T.textMuted, textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:14 }}>
                  ⚡ En cours ({active.length})
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:16, marginBottom:28 }}>
                  {active.map(p => (
                    <ProjectCard key={p.id} project={p} module={module} cfg={cfg} navigate={navigate}/>
                  ))}
                </div>
              </>
            )}

            {/* Other projects */}
            {others.length > 0 && (
              <>
                <div style={{ fontSize:12, fontWeight:700, color:T.textMuted, textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:14 }}>
                  Autres projets ({others.length})
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:16 }}>
                  {others.map(p => (
                    <ProjectCard key={p.id} project={p} module={module} cfg={cfg} navigate={navigate}/>
                  ))}
                </div>
              </>
            )}

            {filtered.length === 0 && (
              <div style={{ textAlign:'center', padding:'60px 0', color:T.textMuted }}>
                <div style={{ fontSize:36, marginBottom:12 }}>🔍</div>
                <div>Aucun projet trouvé pour "{search}"</div>
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}

function ProjectCard({ project, module, cfg, navigate }) {
  const sc = STATUS_CFG[project.status] || STATUS_CFG.planifie;
  const budget = parseFloat(project.budget || 0);
  const expenses = parseFloat(project.actual_expenses || 0);
  const pct = budget > 0 ? Math.min(100, Math.round((expenses/budget)*100)) : 0;

  return (
    <div
      onClick={() => navigate(`/projects/${project.id}/${module}`)}
      style={{
        background:T.card, border:`1px solid ${T.border}`, borderRadius:12,
        padding:20, cursor:'pointer', boxShadow:T.shadow,
        transition:'all 0.2s', position:'relative', overflow:'hidden',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = cfg.color + '60';
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = `0 8px 24px rgba(0,0,0,0.1)`;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = T.border;
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = T.shadow;
      }}
    >
      {/* Top accent bar */}
      <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:cfg.color, opacity:0.7 }}/>

      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:12 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, flex:1, minWidth:0 }}>
          <span style={{ fontSize:22, flexShrink:0 }}>{TYPE_ICONS[project.project_type]||'🏗️'}</span>
          <div style={{ minWidth:0 }}>
            <div style={{ fontSize:14, fontWeight:700, color:T.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {project.name}
            </div>
            {project.location && (
              <div style={{ fontSize:11, color:T.textMuted, marginTop:1 }}>📍 {project.location}</div>
            )}
          </div>
        </div>
        <span style={{ padding:'3px 9px', borderRadius:100, fontSize:11, fontWeight:600, color:sc.color, background:sc.bg, flexShrink:0, marginLeft:8 }}>
          {sc.label}
        </span>
      </div>

      {/* Progress bar */}
      {budget > 0 && (
        <div style={{ marginBottom:12 }}>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:T.textMuted, marginBottom:4 }}>
            <span>Avancement</span>
            <span style={{ fontWeight:600 }}>{project.progress_pct||0}%</span>
          </div>
          <div style={{ height:5, background:T.border, borderRadius:3, overflow:'hidden' }}>
            <div style={{ height:'100%', width:`${project.progress_pct||0}%`, background:cfg.color, borderRadius:3 }}/>
          </div>
        </div>
      )}

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div style={{ fontSize:11, color:T.textMuted }}>
          {project.start_date ? `Début: ${new Date(project.start_date+'T00:00:00').toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'2-digit'})}` : ''}
          {project.is_delayed && <span style={{ color:T.red, fontWeight:600, marginLeft:8 }}>⚠️ Retard</span>}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 12px', borderRadius:7, background:`${cfg.color}15`, color:cfg.color, fontSize:12, fontWeight:600 }}>
          {cfg.icon} {cfg.label}
        </div>
      </div>
    </div>
  );
}