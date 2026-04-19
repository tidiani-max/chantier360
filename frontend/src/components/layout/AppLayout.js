// frontend/src/components/layout/AppLayout.js
import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../context/PermissionsContext';

// ─── NAV CONFIG ────────────────────────────────────────────────────────────────
// app_owner   → NO projects, NO financial data. Only platform management.
// admin_entreprise → Full access: projects, finance, team, QHSE, rapports.
// office_admin → HR, team, workers, documents. NO financial margins.
const NAV_CONFIG = {

  app_owner: [
    { section: 'PLATEFORME', items: [
      { label: "Vue d'ensemble",    to: '/dashboard',   icon: '▦',  exact: true },
      { label: 'Entreprises',       to: '/companies',   icon: '🏢' },
      { label: 'Utilisateurs',      to: '/users',       icon: '👥' },
      { label: 'Abonnements',       to: '/subscriptions', icon: '💳' },
    ]},
    { section: 'SYSTÈME', items: [
      { label: 'Monitoring',        to: '/monitoring',  icon: '📡' },
      { label: 'Logs / Maintenance',to: '/logs',        icon: '🔧' },
      { label: 'Paramètres',        to: '/settings',    icon: '⚙️' },
    ]},
  ],

  admin_entreprise: [
    { section: 'PRINCIPAL', items: [
      { label: "Vue d'ensemble",    to: '/dashboard',         icon: '▦',  exact: true },
      { label: 'Mes projets',       to: '/projects',          icon: '🏗️' },
      { label: 'Équipe',            to: '/team',              icon: '👥' },
    ]},
    { section: 'PROJETS', items: [
      { label: 'Nouveau projet',    to: '/projects/new',      icon: '➕' },
      { label: 'Contrats IA',       to: '/contracts/upload',  icon: '📄' },
      { label: 'Planning',          to: '/planning',          icon: '📅' },
    ]},
    { section: 'FINANCE', items: [
      { label: 'Budget & Achats',   to: '/budget',            icon: '💰' },
      { label: 'Trésorerie',        to: '/treasury',          icon: '🏦' },
    ]},
    { section: 'QUALITÉ', items: [
      { label: 'QHSE',              to: '/qhse',              icon: '🛡️' },
      { label: 'Rapports',          to: '/reports',           icon: '📈' },
    ]},
  ],

  office_admin: [
    { section: 'PRINCIPAL', items: [
      { label: "Vue d'ensemble",    to: '/dashboard',         icon: '▦',  exact: true },
    ]},
    { section: 'RESSOURCES HUMAINES', items: [
      { label: 'Équipe / Comptes',  to: '/team',              icon: '👥' },
      { label: 'Ouvriers',          to: '/workers',           icon: '👷' },
      { label: 'Pointage / Paie',   to: '/attendance',        icon: '📋' },
      { label: 'Mes projets',       to: '/projects',          icon: '🏗️' },
    ]},
    { section: 'ADMINISTRATION', items: [
      { label: 'Documents officiels',to: '/documents',        icon: '📁' },
      { label: 'Contrats IA',       to: '/contracts/upload',  icon: '📄' },
      { label: 'Inventaire / Prix', to: '/inventory',         icon: '📦' },
    ]},
    { section: 'PARAMÈTRES', items: [
      { label: 'Paramètres',        to: '/settings',          icon: '⚙️' },
    ]},
  ],

  chef_projet: [
    { section: 'PRINCIPAL', items: [
      { label: "Vue d'ensemble", to: '/dashboard', icon: '▦', exact: true },
      { label: 'Projets',        to: '/projects',  icon: '🏗️' },
      { label: 'Planning',       to: '/planning',  icon: '📅' },
    ]},
    { section: 'FINANCE', items: [
      { label: 'Budget & Achats', to: '/budget',   icon: '💰' },
    ]},
    { section: 'QUALITÉ', items: [
      { label: 'QHSE',     to: '/qhse',    icon: '🛡️' },
      { label: 'Rapports', to: '/reports', icon: '📈' },
    ]},
    { section: 'ÉQUIPES', items: [
      { label: 'Intervenants', to: '/team', icon: '👥' },
    ]},
  ],

  chef_chantier: [
    { section: 'TERRAIN', items: [
      { label: 'Journal terrain',  to: '/dashboard', icon: '▦', exact: true },
      { label: 'Pointage heures',  to: '/pointage',  icon: '📍' },
      { label: 'Photos chantier',  to: '/reports',   icon: '📷' },
      { label: 'Incidents',        to: '/qhse',      icon: '⚠️' },
      { label: 'Avancement',       to: '/projects',  icon: '📊' },
    ]},
  ],

  chef_equipe: [
    { section: 'MON ÉQUIPE', items: [
      { label: 'Tableau de bord', to: '/dashboard', icon: '▦', exact: true },
      { label: 'Pointer équipe',  to: '/pointage',  icon: '📍' },
      { label: 'Mes tâches',      to: '/projects',  icon: '✅' },
    ]},
  ],

  ingenieur: [
    { section: 'TECHNIQUE', items: [
      { label: "Vue d'ensemble", to: '/dashboard', icon: '▦', exact: true },
      { label: 'Projets',        to: '/projects',  icon: '🏗️' },
      { label: 'Documents',      to: '/documents', icon: '📁' },
      { label: 'Planning',       to: '/planning',  icon: '📅' },
    ]},
  ],

  qhse: [
    { section: 'SÉCURITÉ', items: [
      { label: 'Tableau QHSE',   to: '/dashboard', icon: '▦', exact: true },
      { label: 'Checklists',     to: '/qhse',      icon: '✅' },
      { label: 'Levée réserves', to: '/qhse',      icon: '🔓' },
      { label: 'Incidents',      to: '/qhse',      icon: '⚠️' },
      { label: 'Rapports QHSE',  to: '/reports',   icon: '📈' },
    ]},
  ],

  magasinier: [
    { section: 'LOGISTIQUE', items: [
      { label: "Vue d'ensemble", to: '/dashboard', icon: '▦', exact: true },
      { label: 'Stocks',         to: '/stock',     icon: '📦' },
      { label: 'Livraisons',     to: '/stock',     icon: '🚚' },
      { label: 'Projets',        to: '/projects',  icon: '🏗️' },
    ]},
  ],

  comptable: [
    { section: 'FINANCE', items: [
      { label: "Vue d'ensemble",  to: '/dashboard', icon: '▦', exact: true },
      { label: 'Budget global',   to: '/budget',    icon: '💼' },
      { label: 'Registre achats', to: '/budget',    icon: '🛒' },
      { label: 'Prévisionnel',    to: '/treasury',  icon: '📊' },
      { label: 'Rapports fin.',   to: '/reports',   icon: '📈' },
    ]},
  ],

  client: [
    { section: 'MON PROJET', items: [
      { label: 'Mon projet',  to: '/dashboard', icon: '▦', exact: true },
      { label: 'Avancement',  to: '/projects',  icon: '📊' },
      { label: 'Rapports',    to: '/reports',   icon: '📄' },
      { label: 'Photos',      to: '/reports',   icon: '📷' },
    ]},
  ],
};

const ROLE_SIDEBAR_LABEL = {
  app_owner:        'Super Admin Plateforme',
  admin_entreprise: 'Directeur',
  office_admin:     'Admin de Bureau',
  chef_projet:      'Chef de Projet',
  chef_chantier:    'Cond. Travaux',
  chef_equipe:      "Chef d'Équipe",
  ingenieur:        'Ingénieur',
  qhse:             'Resp. QHSE',
  magasinier:       'Magasinier',
  comptable:        'Resp. Financier',
  client:           "Maître d'Ouvrage",
};

const ROLE_ACCENT = {
  app_owner:        '#fff',
  admin_entreprise: '#F97316',
  office_admin:     '#06B6D4',
  chef_projet:      '#8B5CF6',
  chef_chantier:    '#F97316',
  chef_equipe:      '#EAB308',
  ingenieur:        '#10B981',
  qhse:             '#EF4444',
  magasinier:       '#6B7280',
  comptable:        '#10B981',
  client:           '#6366F1',
};

function Avatar({ name, role, size = 32 }) {
  const initials = name
    ? name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : '??';
  const bg = ROLE_ACCENT[role] || '#F97316';
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: bg === '#fff' ? '#334155' : bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.35, fontWeight: 700, color: '#fff', flexShrink: 0,
    }}>
      {initials}
    </div>
  );
}

export default function AppLayout({ children, projectName }) {
  const { user, logout } = useAuth();
  const { role } = usePermissions();
  const location  = useLocation();
  const navigate  = useNavigate();

  const navSections = NAV_CONFIG[role] || NAV_CONFIG.client;
  const accent      = ROLE_ACCENT[role] || '#F97316';

  const isActive = (item) => {
    if (item.exact) return location.pathname === item.to;
    // avoid '/dashboard' matching '/dashboard/something' incorrectly:
    return location.pathname === item.to ||
      (item.to !== '/dashboard' && location.pathname.startsWith(item.to));
  };

  return (
    <div style={{
      display: 'flex', minHeight: '100vh',
      background: '#F8F9FA', fontFamily: 'DM Sans, system-ui, sans-serif',
    }}>
      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside style={{
        width: 220, minHeight: '100vh',
        background: '#111827',
        display: 'flex', flexDirection: 'column', flexShrink: 0,
        position: 'sticky', top: 0, height: '100vh',
        overflowY: 'auto', overflowX: 'hidden',
      }}>

        {/* Logo */}
        <div style={{
          padding: '18px 20px 14px',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8, flexShrink: 0,
            background: accent, display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: 13, fontWeight: 800,
            color: accent === '#fff' ? '#111' : '#fff',
          }}>
            BTP
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>
              BTP Manager
            </div>
            <div style={{ fontSize: 9, color: '#4B5563', marginTop: 1, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {ROLE_SIDEBAR_LABEL[role] || role}
            </div>
          </div>
        </div>

        {/* Active project pill */}
        {projectName && (
          <div style={{
            margin: '10px 12px 0',
            padding: '7px 12px',
            background: `${accent}18`,
            border: `1px solid ${accent}30`,
            borderRadius: 8,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#10B981', flexShrink: 0, boxShadow: '0 0 5px #10B981' }} />
            <span style={{ fontSize: 11, color: accent, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {projectName}
            </span>
          </div>
        )}

        {/* Nav */}
        <nav style={{ flex: 1, padding: '10px 0', overflowY: 'auto' }}>
          {navSections.map((section, si) => (
            <div key={si} style={{ marginBottom: 2 }}>
              <div style={{
                fontSize: 9, fontWeight: 700, color: '#374151',
                letterSpacing: '0.8px', padding: '10px 20px 4px',
                textTransform: 'uppercase',
              }}>
                {section.section}
              </div>
              {section.items.map((item, ii) => {
                const active = isActive(item);
                return (
                  <Link
                    key={ii}
                    to={item.to}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '8px 20px', margin: '1px 8px', borderRadius: 7,
                      background: active ? `${accent}20` : 'transparent',
                      borderLeft: `3px solid ${active ? accent : 'transparent'}`,
                      textDecoration: 'none', transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                    onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <span style={{ fontSize: 14, lineHeight: 1, flexShrink: 0 }}>{item.icon}</span>
                    <span style={{
                      fontSize: 13,
                      fontWeight: active ? 600 : 400,
                      color: active ? accent : '#9CA3AF',
                      whiteSpace: 'nowrap',
                    }}>
                      {item.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* User footer */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ padding: '12px 16px 8px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Avatar name={user?.full_name} role={role} size={34} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.full_name || 'Utilisateur'}
              </div>
              <div style={{ fontSize: 10, color: '#6B7280' }}>
                {user?.email || ''}
              </div>
            </div>
          </div>
          <button
            onClick={() => { logout(); navigate('/login'); }}
            style={{
              width: 'calc(100% - 24px)', margin: '0 12px 12px',
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 12px', borderRadius: 7,
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)',
              color: '#FCA5A5', fontSize: 12, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit', transition: 'background 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.16)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(239,68,68,0.08)'}
          >
            <span style={{ fontSize: 14 }}>⏻</span>
            Se déconnecter
          </button>
        </div>
      </aside>

      {/* ── Main content ────────────────────────────────────────────────── */}
      <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {children}
      </main>
    </div>
  );
}