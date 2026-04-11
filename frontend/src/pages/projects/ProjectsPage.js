import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { projectsAPI } from '../../services/api';
import AppLayout from '../../components/layout/AppLayout';
import toast from 'react-hot-toast';

const STATUS_CONFIG = {
  planifie:  { label: 'Planifié',  color: '#6366F1', bg: 'rgba(99,102,241,0.12)'  },
  en_cours:  { label: 'En cours',  color: '#F59E0B', bg: 'rgba(245,158,11,0.12)'  },
  suspendu:  { label: 'Suspendu',  color: '#EF4444', bg: 'rgba(239,68,68,0.12)'   },
  termine:   { label: 'Terminé',   color: '#10B981', bg: 'rgba(16,185,129,0.12)'  },
};

const TYPE_ICONS = {
  batiment:    '🏢',
  route:       '🛣️',
  hydraulique: '💧',
  electricite: '⚡',
  autre:       '🔧',
  aep:         '💧',
  assainissement: '🚰',
  pont:        '🌉',
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || { label: status, color: '#9CA3AF', bg: 'rgba(156,163,175,0.12)' };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 10px', borderRadius: 100,
      fontSize: 12, fontWeight: 600,
      color: cfg.color, background: cfg.bg,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.color, display: 'inline-block' }} />
      {cfg.label}
    </span>
  );
}

function BudgetBar({ budget, expenses, contractsTotal }) {
  if (!budget) return <span style={{ fontSize: 12, color: 'var(--gray-4)', fontStyle: 'italic' }}>Budget non défini</span>;
  const pct = Math.min(100, (expenses / budget) * 100);
  const contractPct = Math.min(100, (contractsTotal / budget) * 100);
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--gray-3)', marginBottom: 5 }}>
        <span>{(expenses / 1_000_000).toFixed(1)}M DA dépensés</span>
        <span>{(budget / 1_000_000).toFixed(1)}M DA</span>
      </div>
      <div style={{ height: 5, background: 'var(--dark-border)', borderRadius: 3, overflow: 'hidden', position: 'relative' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${contractPct}%`, background: 'rgba(245,158,11,0.3)', borderRadius: 3 }} />
        <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${pct}%`, background: pct > 85 ? '#EF4444' : 'var(--gold)', borderRadius: 3, transition: 'width 0.6s ease' }} />
      </div>
      <div style={{ fontSize: 11, color: pct > 85 ? '#EF4444' : 'var(--gray-4)', marginTop: 4 }}>{pct.toFixed(0)}% consommé</div>
    </div>
  );
}

function ProjectCard({ project, onDelete }) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleDelete = async (e) => {
    e.stopPropagation();
    if (!window.confirm(`Supprimer « ${project.name} » ? Cette action est irréversible.`)) return;
    try {
      await projectsAPI.delete(project.id);
      toast.success('Projet supprimé');
      onDelete(project.id);
    } catch {
      toast.error('Erreur lors de la suppression');
    }
    setMenuOpen(false);
  };

  return (
    <div
      onClick={() => navigate(`/projects/${project.id}`)}
      style={{
        background: 'var(--dark-2)',
        border: '1px solid var(--dark-border)',
        borderRadius: 'var(--radius-lg)',
        padding: 24,
        cursor: 'pointer',
        transition: 'border-color 0.2s, transform 0.15s, box-shadow 0.2s',
        position: 'relative',
        overflow: 'hidden',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'rgba(245,158,11,0.4)';
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,0.3)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'var(--dark-border)';
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: STATUS_CONFIG[project.status]?.color || 'var(--gold)', opacity: 0.6 }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 24, flexShrink: 0 }}>{TYPE_ICONS[project.project_type] || '🔧'}</span>
          <div style={{ minWidth: 0 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 2, fontFamily: 'var(--font-display)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {project.name}
            </h3>
            {project.reference && (
              <span style={{ fontSize: 11, color: 'var(--gray-4)', fontFamily: 'monospace' }}>#{project.reference}</span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <StatusBadge status={project.status} />
          <div style={{ position: 'relative' }}>
            <button
              onClick={e => { e.stopPropagation(); setMenuOpen(v => !v); }}
              style={{ background: 'none', color: 'var(--gray-3)', width: 28, height: 28, borderRadius: 6, cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >⋯</button>
            {menuOpen && (
              <div style={{ position: 'absolute', right: 0, top: 32, background: 'var(--dark-3)', border: '1px solid var(--dark-border)', borderRadius: 8, padding: '4px 0', zIndex: 50, minWidth: 140, boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}
                onClick={e => e.stopPropagation()}>
                <button onClick={e => { e.stopPropagation(); navigate(`/projects/${project.id}`); setMenuOpen(false); }}
                  style={{ display: 'block', width: '100%', padding: '8px 16px', textAlign: 'left', fontSize: 13, color: 'var(--white)', background: 'none', cursor: 'pointer' }}>
                  👁 Voir le détail
                </button>
                <button onClick={handleDelete}
                  style={{ display: 'block', width: '100%', padding: '8px 16px', textAlign: 'left', fontSize: 13, color: '#EF4444', background: 'none', cursor: 'pointer' }}>
                  🗑 Supprimer
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {project.location && (
        <div style={{ fontSize: 12, color: 'var(--gray-3)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
          📍 {project.location}
        </div>
      )}

      <div style={{ marginBottom: 16 }}>
        <BudgetBar budget={project.budget} expenses={project.actual_expenses || 0} contractsTotal={project.contracts_total || 0} />
      </div>

      <div style={{ display: 'flex', gap: 16, borderTop: '1px solid var(--dark-border)', paddingTop: 14 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: 'var(--gray-4)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Contrats</div>
          <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-display)' }}>{project.contracts_count ?? 0}</div>
        </div>
        {project.start_date && (
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: 'var(--gray-4)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Début</div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{new Date(project.start_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
          </div>
        )}
        {project.end_date && (
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: 'var(--gray-4)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Fin prévue</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: new Date(project.end_date) < new Date() && project.status !== 'termine' ? '#EF4444' : 'inherit' }}>
              {new Date(project.end_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ProjectsPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

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

  const filtered = projects.filter(p => {
    const matchStatus = !statusFilter || p.status === statusFilter;
    const q = search.toLowerCase();
    const matchSearch = !q || p.name.toLowerCase().includes(q) || (p.reference || '').toLowerCase().includes(q) || (p.location || '').toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  const stats = {
    total: projects.length,
    en_cours: projects.filter(p => p.status === 'en_cours').length,
    totalBudget: projects.reduce((a, p) => a + (parseFloat(p.budget) || 0), 0),
    totalContracts: projects.reduce((a, p) => a + (p.contracts_count || 0), 0),
  };

  return (
    <AppLayout>
      <div style={{ padding: '40px 36px' }}>
        <div className="animate-fade-in">

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
            <div>
              <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 800, marginBottom: 6 }}>Projets</h1>
              <p style={{ color: 'var(--gray-3)', fontSize: 15 }}>
                {projects.length} projet{projects.length !== 1 ? 's' : ''} dans votre portefeuille
              </p>
            </div>
            <button className="btn-primary" onClick={() => navigate('/projects/new')}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 24px' }}>
              <span style={{ fontSize: 18 }}>+</span> Nouveau projet
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
            {[
              { label: 'Total projets', value: stats.total, icon: '🏗️', color: '#6366F1' },
              { label: 'En cours', value: stats.en_cours, icon: '⚡', color: '#F59E0B' },
              { label: 'Budget total', value: (stats.totalBudget / 1_000_000).toFixed(1) + 'M DA', icon: '💰', color: '#10B981' },
              { label: 'Contrats liés', value: stats.totalContracts, icon: '📄', color: '#06B6D4' },
            ].map((s, i) => (
              <div key={i} className="card" style={{ padding: '20px 24px', borderLeft: `3px solid ${s.color}` }}>
                <div style={{ fontSize: 24, marginBottom: 10 }}>{s.icon}</div>
                <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'var(--font-display)', marginBottom: 4 }}>{s.value}</div>
                <div style={{ fontSize: 12, color: 'var(--gray-3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{s.label}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 12, marginBottom: 24, alignItems: 'center' }}>
            <input
              className="input-field"
              placeholder="🔍  Rechercher un projet..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ flex: 1, maxWidth: 320 }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              {[
                { value: '', label: 'Tous' },
                { value: 'planifie', label: '🔵 Planifié' },
                { value: 'en_cours', label: '🟡 En cours' },
                { value: 'suspendu', label: '🔴 Suspendu' },
                { value: 'termine', label: '🟢 Terminé' },
              ].map(f => (
                <button key={f.value} onClick={() => setStatusFilter(f.value)}
                  style={{
                    padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    border: `1px solid ${statusFilter === f.value ? 'var(--gold)' : 'var(--dark-border)'}`,
                    background: statusFilter === f.value ? 'rgba(245,158,11,0.1)' : 'var(--dark-2)',
                    color: statusFilter === f.value ? 'var(--gold)' : 'var(--gray-3)',
                    transition: 'all 0.15s',
                  }}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--gray-3)' }}>
              <div style={{ width: 40, height: 40, border: '3px solid var(--gold)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
              Chargement...
            </div>
          ) : filtered.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '64px 24px' }}>
              <div style={{ fontSize: 56, marginBottom: 16 }}>🏗️</div>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, marginBottom: 8 }}>
                {projects.length === 0 ? 'Aucun projet pour l\'instant' : 'Aucun résultat'}
              </h3>
              <p style={{ color: 'var(--gray-3)', fontSize: 14, marginBottom: 24 }}>
                {projects.length === 0
                  ? 'Créez votre premier projet pour commencer à suivre votre chantier.'
                  : 'Essayez de modifier vos filtres de recherche.'}
              </p>
              {projects.length === 0 && (
                <button className="btn-primary" onClick={() => navigate('/projects/new')}>+ Créer un projet</button>
              )}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 20 }}>
              {filtered.map(p => (
                <ProjectCard key={p.id} project={p} onDelete={id => setProjects(prev => prev.filter(x => x.id !== id))} />
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}