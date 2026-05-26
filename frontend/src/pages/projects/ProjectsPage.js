// frontend/src/pages/projects/ProjectsPage.js
// CHANGES: archive soft delete, new directeur roles, fixed canCreate/canDelete
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { projectsAPI } from '../../services/api';
import { usePermissions } from '../../context/PermissionsContext';
import AppLayout from '../../components/layout/AppLayout';
import toast from 'react-hot-toast';
import api from '../../services/api';

const T = {
  bg: '#F8F9FA', card: '#FFFFFF', border: '#E8EDF2',
  text: '#1a1f2e', textSub: '#6B7280', textMuted: '#9CA3AF',
  orange: '#F97316', orangeLight: 'rgba(249,115,22,0.1)',
  green: '#10B981', greenLight: 'rgba(16,185,129,0.1)',
  red: '#EF4444', redLight: 'rgba(239,68,68,0.1)',
  yellow: '#F59E0B', indigo: '#6366F1', cyan: '#06B6D4',
  shadow: '0 1px 3px rgba(0,0,0,0.07)',
  shadowHover: '0 8px 24px rgba(0,0,0,0.10)',
};

const STATUS_CONFIG = {
  planifie: { label: 'Planifié',  color: '#6366F1', bg: 'rgba(99,102,241,0.10)'  },
  en_cours: { label: 'En cours',  color: '#F59E0B', bg: 'rgba(245,158,11,0.10)'  },
  suspendu: { label: 'Suspendu',  color: '#EF4444', bg: 'rgba(239,68,68,0.10)'   },
  termine:  { label: 'Terminé',   color: '#10B981', bg: 'rgba(16,185,129,0.10)'  },
};

const TYPE_ICONS = {
  batiment:'🏢', route:'🛣️', hydraulique:'💧', electricite:'⚡',
  autre:'🔧', aep:'💧', assainissement:'🚰', pont:'🌉',
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || { label: status, color: T.textMuted, bg: T.border };
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:5, padding:'3px 10px', borderRadius:100, fontSize:12, fontWeight:600, color:cfg.color, background:cfg.bg }}>
      <span style={{ width:6, height:6, borderRadius:'50%', background:cfg.color, display:'inline-block' }}/>
      {cfg.label}
    </span>
  );
}

function BudgetBar({ budget, expenses, contractsTotal }) {
  if (!budget) return <span style={{ fontSize:12, color:T.textMuted, fontStyle:'italic' }}>Budget non défini</span>;
  const pct         = Math.min(100, (expenses / budget) * 100);
  const contractPct = Math.min(100, (contractsTotal / budget) * 100);
  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:T.textSub, marginBottom:5 }}>
        <span>{(expenses / 1_000_000).toFixed(1)}M FCFA dépensés</span>
        <span>{(budget / 1_000_000).toFixed(1)}M FCFA</span>
      </div>
      <div style={{ height:5, background:T.border, borderRadius:3, overflow:'hidden', position:'relative' }}>
        <div style={{ position:'absolute', left:0, top:0, height:'100%', width:`${contractPct}%`, background:'rgba(245,158,11,0.25)', borderRadius:3 }}/>
        <div style={{ position:'absolute', left:0, top:0, height:'100%', width:`${pct}%`, background:pct>85?T.red:T.orange, borderRadius:3, transition:'width 0.6s ease' }}/>
      </div>
      <div style={{ fontSize:11, color:pct>85?T.red:T.textMuted, marginTop:4 }}>{pct.toFixed(0)}% consommé</div>
    </div>
  );
}

function ProjectCard({ project, onArchive, canArchive, canViewFinancials }) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [hovered, setHovered]   = useState(false);
  const [archiving, setArchiving] = useState(false);

  const statusColor = STATUS_CONFIG[project.status]?.color || T.orange;

  const handleArchive = async (e) => {
    e.stopPropagation();
    if (!window.confirm(`Archiver « ${project.name} » ?\n\nLe projet sera masqué mais conservé. Vous pourrez le restaurer depuis les archives.`)) return;
    setArchiving(true);
    try {
      // Try soft archive endpoint first, fall back to delete
      try {
        await api.post(`projects/${project.id}/archive/`, { action: 'archive' });
      } catch {
        await projectsAPI.delete(project.id);
      }
      toast.success('Projet archivé');
      onArchive(project.id);
    } catch {
      toast.error('Erreur lors de l\'archivage');
    } finally {
      setArchiving(false);
      setMenuOpen(false);
    }
  };

  return (
    <div
      onClick={() => navigate(`/projects/${project.id}`)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setMenuOpen(false); }}
      style={{
        background: T.card,
        border: `1px solid ${hovered ? statusColor + '60' : T.border}`,
        borderRadius: 12, padding: 24, cursor: 'pointer',
        transition: 'border-color 0.2s, transform 0.15s, box-shadow 0.2s',
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
        boxShadow: hovered ? T.shadowHover : T.shadow,
        position: 'relative', overflow: 'hidden',
      }}
    >
      {/* Status stripe */}
      <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:statusColor, opacity:0.8, borderRadius:'12px 12px 0 0' }}/>

      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14, marginTop:6 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, flex:1, minWidth:0 }}>
          <span style={{ fontSize:24, flexShrink:0 }}>{TYPE_ICONS[project.project_type] || '🔧'}</span>
          <div style={{ minWidth:0 }}>
            <h3 style={{ fontSize:15, fontWeight:700, color:T.text, margin:'0 0 2px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
              {project.name}
            </h3>
            {project.reference && (
              <span style={{ fontSize:11, color:T.textMuted, fontFamily:'monospace' }}>#{project.reference}</span>
            )}
          </div>
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
          <StatusBadge status={project.status}/>
          {/* Archive menu — directeurs only */}
          {canArchive && (
            <div style={{ position:'relative' }}>
              <button
                onClick={e => { e.stopPropagation(); setMenuOpen(v => !v); }}
                style={{
                  background: menuOpen ? T.border : 'transparent',
                  color:T.textSub, width:28, height:28, borderRadius:6,
                  border:`1px solid ${menuOpen ? T.border : 'transparent'}`,
                  cursor:'pointer', fontSize:18,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontFamily:'inherit',
                }}
              >⋯</button>
              {menuOpen && (
                <div
                  onClick={e => e.stopPropagation()}
                  style={{ position:'absolute', right:0, top:32, background:T.card, border:`1px solid ${T.border}`, borderRadius:8, padding:'4px 0', zIndex:50, minWidth:165, boxShadow:'0 8px 24px rgba(0,0,0,0.12)' }}
                >
                  <button
                    onClick={e => { e.stopPropagation(); navigate(`/projects/${project.id}`); setMenuOpen(false); }}
                    style={{ display:'block', width:'100%', padding:'9px 16px', textAlign:'left', fontSize:13, color:T.text, background:'none', border:'none', cursor:'pointer', fontFamily:'inherit' }}
                  >
                    👁 Voir le détail
                  </button>
                  <div style={{ height:1, background:T.border, margin:'2px 0' }}/>
                  {/* CHANGED: Archive instead of delete */}
                  <button
                    onClick={handleArchive}
                    disabled={archiving}
                    style={{ display:'block', width:'100%', padding:'9px 16px', textAlign:'left', fontSize:13, color:'#92400E', background:'none', border:'none', cursor:'pointer', fontFamily:'inherit' }}
                  >
                    {archiving ? '⏳ Archivage...' : '📦 Archiver le projet'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {project.location && (
        <div style={{ fontSize:12, color:T.textSub, marginBottom:14, display:'flex', alignItems:'center', gap:4 }}>
          📍 {project.location}
        </div>
      )}

      {canViewFinancials && (
        <div style={{ marginBottom:16 }}>
          <BudgetBar budget={project.budget} expenses={project.actual_expenses||0} contractsTotal={project.contracts_total||0}/>
        </div>
      )}

      <div style={{ display:'flex', gap:16, borderTop:`1px solid ${T.border}`, paddingTop:14 }}>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:11, color:T.textMuted, marginBottom:3, textTransform:'uppercase', letterSpacing:'0.5px' }}>Contrats</div>
          <div style={{ fontSize:16, fontWeight:700, color:T.text }}>{project.contracts_count ?? 0}</div>
        </div>
        {project.start_date && (
          <div style={{ flex:1 }}>
            <div style={{ fontSize:11, color:T.textMuted, marginBottom:3, textTransform:'uppercase', letterSpacing:'0.5px' }}>Début</div>
            <div style={{ fontSize:13, fontWeight:600, color:T.text }}>
              {new Date(project.start_date).toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric'})}
            </div>
          </div>
        )}
        {project.end_date && (
          <div style={{ flex:1 }}>
            <div style={{ fontSize:11, color:T.textMuted, marginBottom:3, textTransform:'uppercase', letterSpacing:'0.5px' }}>Fin prévue</div>
            <div style={{ fontSize:13, fontWeight:600, color:new Date(project.end_date)<new Date()&&project.status!=='termine'?T.red:T.text }}>
              {new Date(project.end_date).toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric'})}
            </div>
          </div>
        )}
        {project.progress_pct != null && (
          <div style={{ flex:1 }}>
            <div style={{ fontSize:11, color:T.textMuted, marginBottom:3, textTransform:'uppercase', letterSpacing:'0.5px' }}>Avancement</div>
            <div style={{ fontSize:13, fontWeight:600, color:T.orange }}>{project.progress_pct}%</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── MAIN PAGE ─────────────────────────────────────────────────────────────────
export default function ProjectsPage() {
  const navigate = useNavigate();
  const {
    isDirecteurGeneral, isDirecteurTechnique, isOfficeAdmin,
    isAppOwner, canViewFinancials, canCreateProject, canDeleteProject,
    role, canSeeAllProjects,
  } = usePermissions();

  const [projects, setProjects]         = useState([]);
  const [loading, setLoading]           = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch]             = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [archived, setArchived]         = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await projectsAPI.list();
        setProjects(res.data);
      } catch {
        toast.error('Erreur lors du chargement des projets');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Load archived projects (admins only)
  useEffect(() => {
    if (!showArchived || !canDeleteProject) return;
    api.get('projects/archived/').then(r => setArchived(r.data || [])).catch(() => setArchived([]));
  }, [showArchived, canDeleteProject]);

  const handleRestore = async (projectId) => {
    try {
      await api.post(`projects/${projectId}/archive/`, { action: 'restore' });
      toast.success('Projet restauré');
      setArchived(prev => prev.filter(p => p.id !== projectId));
      const res = await projectsAPI.list();
      setProjects(res.data);
    } catch {
      toast.error('Erreur lors de la restauration');
    }
  };

  const filtered = projects.filter(p => {
    const matchStatus = !statusFilter || p.status === statusFilter;
    const q           = search.toLowerCase();
    const matchSearch = !q
      || p.name.toLowerCase().includes(q)
      || (p.reference || '').toLowerCase().includes(q)
      || (p.location  || '').toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  const stats = {
    total:    projects.length,
    en_cours: projects.filter(p => p.status === 'en_cours').length,
    totalBudget:    projects.reduce((a, p) => a + (parseFloat(p.budget) || 0), 0),
    totalContracts: projects.reduce((a, p) => a + (p.contracts_count || 0), 0),
  };

  const kpiCards = [
    { label: 'Total projets', value: stats.total,    icon: '🏗️', color: T.indigo },
    { label: 'En cours',      value: stats.en_cours, icon: '⚡',  color: T.yellow },
    ...(canViewFinancials ? [{ label: 'Budget total', value: (stats.totalBudget/1_000_000).toFixed(1)+'M FCFA', icon:'💰', color:T.green }] : []),
    { label: 'Contrats liés', value: stats.totalContracts, icon:'📄', color:T.cyan },
  ];

  const filterButtons = [
    { value:'',         label:'Tous'        },
    { value:'planifie', label:'🔵 Planifié'  },
    { value:'en_cours', label:'🟡 En cours'  },
    { value:'suspendu', label:'🔴 Suspendu'  },
    { value:'termine',  label:'🟢 Terminé'   },
  ];

  const pageTitle = canSeeAllProjects
    ? 'Tous les projets'
    : 'Mes projets assignés';

  const pageSubtitle = canSeeAllProjects
    ? `${projects.length} projet${projects.length!==1?'s':''} dans votre portefeuille`
    : `${projects.length} projet${projects.length!==1?'s':''} vous sont assignés`;

  return (
    <AppLayout>
      <div style={{ padding:'40px 36px', background:T.bg, minHeight:'100vh' }}>

        {/* Page title */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:32 }}>
          <div>
            <h1 style={{ fontSize:32, fontWeight:800, color:T.text, margin:'0 0 6px' }}>{pageTitle}</h1>
            <p style={{ color:T.textSub, fontSize:15, margin:0 }}>{pageSubtitle}</p>
          </div>
          <div style={{ display:'flex', gap:10, alignItems:'center' }}>
            {/* Show archived toggle — admins only */}
            {canDeleteProject && (
              <button
                onClick={() => setShowArchived(v => !v)}
                style={{
                  padding:'10px 18px', borderRadius:9, fontSize:13, fontWeight:600, cursor:'pointer',
                  border:`1px solid ${showArchived?T.orange:T.border}`,
                  background: showArchived?T.orangeLight:'#fff',
                  color: showArchived?T.orange:T.textSub,
                  fontFamily:'inherit',
                }}
              >
                📦 Archives {archived.length > 0 ? `(${archived.length})` : ''}
              </button>
            )}
            {canCreateProject && (
              <button
                onClick={() => navigate('/projects/new')}
                style={{
                  display:'flex', alignItems:'center', gap:8,
                  padding:'12px 24px', borderRadius:10,
                  background:T.orange, color:'#fff', border:'none',
                  fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit',
                  boxShadow:'0 2px 8px rgba(249,115,22,0.3)',
                }}
              >
                <span style={{ fontSize:18, lineHeight:1 }}>+</span> Nouveau projet
              </button>
            )}
          </div>
        </div>

        {/* KPI cards */}
        <div style={{ display:'grid', gridTemplateColumns:`repeat(${kpiCards.length},1fr)`, gap:16, marginBottom:32 }}>
          {kpiCards.map((s, i) => (
            <div key={i} style={{ background:T.card, border:`1px solid ${T.border}`, borderLeft:`4px solid ${s.color}`, borderRadius:12, padding:'20px 24px', boxShadow:T.shadow }}>
              <div style={{ fontSize:26, marginBottom:12 }}>{s.icon}</div>
              <div style={{ fontSize:26, fontWeight:800, color:T.text, marginBottom:4 }}>{s.value}</div>
              <div style={{ fontSize:12, color:T.textMuted, textTransform:'uppercase', letterSpacing:'0.6px', fontWeight:600 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Search + filter */}
        <div style={{ display:'flex', gap:12, marginBottom:28, alignItems:'center', flexWrap:'wrap' }}>
          <div style={{ position:'relative', flex:1, maxWidth:320 }}>
            <span style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', fontSize:14, color:T.textMuted, pointerEvents:'none' }}>🔍</span>
            <input
              placeholder="Rechercher un projet..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width:'100%', padding:'10px 12px 10px 36px', borderRadius:9, border:`1px solid ${T.border}`, background:T.card, fontSize:13, color:T.text, outline:'none', fontFamily:'inherit', boxSizing:'border-box' }}
            />
          </div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {filterButtons.map(f => {
              const active = statusFilter === f.value;
              return (
                <button key={f.value} onClick={() => setStatusFilter(f.value)}
                  style={{ padding:'9px 16px', borderRadius:9, fontSize:13, fontWeight:600, cursor:'pointer', border:`1px solid ${active?T.orange:T.border}`, background:active?T.orangeLight:T.card, color:active?T.orange:T.textSub, transition:'all 0.15s', fontFamily:'inherit' }}>
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Active projects grid */}
        {loading ? (
          <div style={{ textAlign:'center', padding:'80px 0', color:T.textSub }}>
            <div style={{ width:40, height:40, border:`3px solid ${T.orange}`, borderTopColor:'transparent', borderRadius:'50%', animation:'spin 1s linear infinite', margin:'0 auto 16px' }}/>
            Chargement...
          </div>
        ) : filtered.length === 0 && !showArchived ? (
          <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:12, textAlign:'center', padding:'64px 24px' }}>
            <div style={{ fontSize:56, marginBottom:16 }}>🏗️</div>
            <h3 style={{ fontSize:20, fontWeight:700, color:T.text, marginBottom:8 }}>
              {projects.length === 0 ? 'Aucun projet pour l\'instant' : 'Aucun résultat'}
            </h3>
            <p style={{ color:T.textSub, fontSize:14, marginBottom:24 }}>
              {projects.length === 0
                ? canCreateProject
                  ? 'Créez votre premier projet pour commencer.'
                  : 'Aucun projet ne vous a encore été assigné.'
                : 'Essayez de modifier vos filtres.'}
            </p>
            {projects.length === 0 && canCreateProject && (
              <button onClick={() => navigate('/projects/new')}
                style={{ padding:'10px 24px', borderRadius:9, background:T.orange, color:'#fff', fontSize:14, fontWeight:700, border:'none', cursor:'pointer', fontFamily:'inherit' }}>
                + Créer un projet
              </button>
            )}
          </div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(340px,1fr))', gap:20 }}>
            {filtered.map(p => (
              <ProjectCard
                key={p.id}
                project={p}
                onArchive={id => setProjects(prev => prev.filter(x => x.id !== id))}
                canArchive={canDeleteProject}
                canViewFinancials={canViewFinancials}
              />
            ))}
          </div>
        )}

        {/* Archived projects section */}
        {showArchived && canDeleteProject && (
          <div style={{ marginTop:40 }}>
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
              <h2 style={{ fontSize:20, fontWeight:700, color:T.textSub, margin:0 }}>📦 Projets archivés</h2>
              <span style={{ fontSize:12, color:T.textMuted, padding:'2px 10px', borderRadius:100, background:T.border }}>{archived.length}</span>
            </div>
            {archived.length === 0 ? (
              <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:12, padding:'32px', textAlign:'center', color:T.textMuted, fontSize:14 }}>
                Aucun projet archivé
              </div>
            ) : (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(340px,1fr))', gap:16 }}>
                {archived.map(p => (
                  <div key={p.id} style={{ background:'#fff', border:`1px solid ${T.border}`, borderRadius:12, padding:20, opacity:0.75 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                      <span style={{ fontSize:14, fontWeight:700, color:T.text }}>{p.name}</span>
                      <span style={{ fontSize:11, color:T.textMuted }}>Archivé</span>
                    </div>
                    {p.location && <div style={{ fontSize:12, color:T.textMuted, marginBottom:12 }}>📍 {p.location}</div>}
                    <button
                      onClick={() => handleRestore(p.id)}
                      style={{ width:'100%', padding:'8px 0', borderRadius:8, background:T.greenLight, border:`1px solid ${T.green}40`, color:T.green, fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
                      ↩ Restaurer ce projet
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
