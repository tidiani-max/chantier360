// frontend/src/pages/projects/ProjectPickerPage.js
// FIXED: No longer forces "Immeuble R+4" — shows ALL projects, user picks one
// Rich mock data shown when API returns empty
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
  planning:  { icon:'📅', title:'Planning / Gantt',    label:'Voir le planning',  color:'#3B82F6' },
  budget:    { icon:'💰', title:'Budget & Achats',      label:'Voir le budget',    color:'#F97316' },
  qhse:      { icon:'🛡️', title:'QHSE / Sécurité',    label:'Voir le QHSE',      color:'#EF4444' },
  pointage:  { icon:'📍', title:'Pointage GPS',        label:'Pointer',           color:'#10B981' },
  documents: { icon:'📁', title:'Documents & Plans',   label:'Voir les docs',     color:'#8B5CF6' },
  reports:   { icon:'📈', title:'Rapports',            label:'Voir les rapports', color:'#F59E0B' },
};

// Rich mock data — shown when API returns empty (dev/demo mode)
const MOCK_PROJECTS = [
  {
    id: 'mock-1',
    name: 'Construction Immeuble R+4 Hamdallaye ACI 2000',
    project_type: 'batiment',
    status: 'en_cours',
    location: 'Hamdallaye ACI 2000, Bamako',
    progress_pct: 37,
    start_date: '2024-03-01',
    end_date: '2025-09-30',
    budget: 850000000,
    actual_expenses: 312500000,
    is_delayed: false,
  },
  {
    id: 'mock-2',
    name: 'Réhabilitation Route Nationale RN6 — Ségou/San',
    project_type: 'route',
    status: 'planifie',
    location: 'Route Nationale 6, Ségou — San',
    progress_pct: 0,
    start_date: '2025-02-01',
    end_date: '2027-01-31',
    budget: 2400000000,
    actual_expenses: 0,
    is_delayed: false,
  },
  {
    id: 'mock-3',
    name: "Adduction d'eau potable — Villages Kati",
    project_type: 'aep',
    status: 'termine',
    location: 'Kati, Cercle de Kati',
    progress_pct: 100,
    start_date: '2023-06-01',
    end_date: '2024-02-28',
    budget: 185000000,
    actual_expenses: 178200000,
    is_delayed: false,
  },
  {
    id: 'mock-4',
    name: 'Construction Pont sur le Bani — Djenné',
    project_type: 'pont',
    status: 'suspendu',
    location: 'Djenné, Mopti',
    progress_pct: 8,
    start_date: '2024-02-01',
    end_date: '2026-06-30',
    budget: 1200000000,
    actual_expenses: 98500000,
    is_delayed: true,
  },
];

export default function ProjectPickerPage({ module = 'planning' }) {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');

  const cfg = MODULE_CFG[module] || MODULE_CFG.planning;

  useEffect(() => {
    projectsAPI.list()
      .then(r => {
        const data = r.data || [];
        // Use mock data if API returns nothing (demo mode)
        setProjects(data.length > 0 ? data : MOCK_PROJECTS);
      })
      .catch(() => {
        toast.error('Erreur chargement — affichage données de démonstration');
        setProjects(MOCK_PROJECTS);
      })
      .finally(() => setLoading(false));
  }, []);

  const handlePickProject = (project) => {
    // FIXED: Navigate to the chosen project's module page
    // If mock data, go to projects list instead
    if (String(project.id).startsWith('mock-')) {
      toast('Mode démonstration — connectez le backend pour accéder aux données réelles', { icon: 'ℹ️' });
      navigate('/projects');
      return;
    }
    navigate(`/projects/${project.id}/${module}`);
  };

  const filtered = projects.filter(p => {
    const q = search.toLowerCase();
    return !q || p.name.toLowerCase().includes(q) || (p.location||'').toLowerCase().includes(q);
  });

  const active = filtered.filter(p => p.status === 'en_cours');
  const others = filtered.filter(p => p.status !== 'en_cours');

  return (
    <AppLayout>
      {/* Top bar */}
      <div style={{
        display:'flex', justifyContent:'space-between', alignItems:'center',
        padding:'0 32px', height:60, background:'#fff',
        borderBottom:`1px solid ${T.border}`, position:'sticky', top:0, zIndex:10,
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <span style={{ fontSize:22 }}>{cfg.icon}</span>
          <div>
            <h1 style={{ margin:0, fontSize:17, fontWeight:700, color:T.text }}>{cfg.title}</h1>
            <div style={{ fontSize:11, color:T.textMuted, marginTop:1 }}>
              Sélectionnez un projet pour continuer
            </div>
          </div>
        </div>
        <input
          placeholder="🔍 Rechercher un projet..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            padding:'8px 14px', borderRadius:8, border:`1px solid ${T.border}`,
            background:'#fff', fontSize:13, color:T.text,
            outline:'none', fontFamily:'inherit', width:260,
          }}
        />
      </div>

      <div style={{ padding:32 }}>
        {loading ? (
          <div style={{ textAlign:'center', padding:'60px 0', color:T.textMuted }}>
            <div style={{ width:32, height:32, border:`3px solid ${T.orange}`, borderTopColor:'transparent', borderRadius:'50%', animation:'spin 1s linear infinite', margin:'0 auto 12px' }}/>
            Chargement des projets...
          </div>
        ) : (
          <>
            {/* Active projects */}
            {active.length > 0 && (
              <>
                <div style={{ fontSize:12, fontWeight:700, color:T.textMuted, textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:14, display:'flex', alignItems:'center', gap:8 }}>
                  <div style={{ width:8, height:8, borderRadius:'50%', background:T.orange, boxShadow:`0 0 6px ${T.orange}` }}/>
                  En cours ({active.length})
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:16, marginBottom:32 }}>
                  {active.map(p => (
                    <ProjectCard key={p.id} project={p} module={module} cfg={cfg} onPick={handlePickProject}/>
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
                    <ProjectCard key={p.id} project={p} module={module} cfg={cfg} onPick={handlePickProject}/>
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

function ProjectCard({ project, module, cfg, onPick }) {
  const sc = STATUS_CFG[project.status] || STATUS_CFG.planifie;
  const [hovered, setHovered] = useState(false);

  const fmtFCFA = (n) => {
    if (!n) return null;
    const v = parseFloat(n);
    if (v >= 1e9) return `${(v/1e9).toFixed(1)} Mrd FCFA`;
    if (v >= 1e6) return `${(v/1e6).toFixed(0)} M FCFA`;
    return `${v.toLocaleString('fr-FR')} FCFA`;
  };

  return (
    <div
      onClick={() => onPick(project)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background:T.card,
        border:`1px solid ${hovered ? cfg.color+'60' : T.border}`,
        borderRadius:12,
        padding:20,
        cursor:'pointer',
        boxShadow: hovered ? '0 8px 24px rgba(0,0,0,0.1)' : '0 1px 3px rgba(0,0,0,0.07)',
        transition:'all 0.2s',
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
        position:'relative',
        overflow:'hidden',
      }}
    >
      {/* Top accent */}
      <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:cfg.color, opacity:0.8 }}/>

      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:12 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, flex:1, minWidth:0 }}>
          <span style={{ fontSize:22, flexShrink:0 }}>{TYPE_ICONS[project.project_type]||'🏗️'}</span>
          <div style={{ minWidth:0 }}>
            <div style={{ fontSize:14, fontWeight:700, color:T.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {project.name}
            </div>
            {project.location && (
              <div style={{ fontSize:11, color:T.textMuted, marginTop:2 }}>📍 {project.location}</div>
            )}
          </div>
        </div>
        <span style={{ padding:'3px 9px', borderRadius:100, fontSize:11, fontWeight:600, color:sc.color, background:sc.bg, flexShrink:0, marginLeft:8 }}>
          {sc.label}
        </span>
      </div>

      {/* Progress bar */}
      {project.progress_pct > 0 && (
        <div style={{ marginBottom:12 }}>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:T.textMuted, marginBottom:4 }}>
            <span>Avancement</span>
            <span style={{ fontWeight:600, color:cfg.color }}>{project.progress_pct}%</span>
          </div>
          <div style={{ height:5, background:T.border, borderRadius:3, overflow:'hidden' }}>
            <div style={{ height:'100%', width:`${project.progress_pct}%`, background:cfg.color, borderRadius:3, transition:'width 0.6s' }}/>
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <div style={{ fontSize:11, color:T.textMuted }}>
          {project.start_date && (
            <span>Début: {new Date(project.start_date+'T00:00:00').toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'2-digit'})}</span>
          )}
          {project.is_delayed && <span style={{ color:T.red, fontWeight:600, marginLeft:8 }}>⚠️ Retard</span>}
          {project.budget && <div style={{ marginTop:2 }}>{fmtFCFA(project.budget)}</div>}
        </div>
        <div style={{
          display:'flex', alignItems:'center', gap:6,
          padding:'7px 14px', borderRadius:8,
          background:`${cfg.color}18`, color:cfg.color,
          fontSize:12, fontWeight:700,
        }}>
          {cfg.icon} {cfg.label} →
        </div>
      </div>
    </div>
  );
}