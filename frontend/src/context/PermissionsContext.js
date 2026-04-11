// frontend/src/context/PermissionsContext.js
// Mirrors backend ROLE_PERMISSIONS exactly — all 11 roles A→K

import React, { createContext, useContext } from 'react';
import { useAuth } from './AuthContext';

// Permission matrix — mirrors ProjectMember.ROLE_PERMISSIONS in projects/models.py
// Roles A, B, C have platform-level access (not per-project)
const ROLE_PERMISSIONS = {
  // A — App Owner (SaaS platform admin — sees everything)
  app_owner: {
    config: 'full', budget: 'full', planning: 'full', journal: 'full',
    pointage: 'full', qhse: 'full', documents: 'full', stock: 'full',
    treasury: 'full', reports: 'full', dashboard: 'full', users: 'full',
  },
  // B — Directeur / Admin Entreprise
  admin_entreprise: {
    config: 'full', budget: 'full', planning: 'full', journal: 'read',
    pointage: 'read', qhse: 'read', documents: 'full', stock: 'read',
    treasury: 'full', reports: 'full', dashboard: 'full', users: 'full',
  },
  // C — Office Admin (RH / Pivot)
  office_admin: {
    config: 'full', budget: 'read', planning: 'read', journal: 'read',
    pointage: 'read', qhse: 'read', documents: 'read', stock: 'read',
    treasury: 'none', reports: 'read', dashboard: 'full', users: 'full',
  },
  // D — Chef de Projet
  chef_projet: {
    config: 'full', budget: 'read', planning: 'full', journal: 'read',
    pointage: 'read', qhse: 'read', documents: 'full', stock: 'read',
    treasury: 'read', reports: 'full', dashboard: 'full', users: 'edit',
  },
  // E — Chef de Chantier (blocked from all financials)
  chef_chantier: {
    config: 'none', budget: 'none', planning: 'none', journal: 'edit',
    pointage: 'full', qhse: 'edit', documents: 'none', stock: 'none',
    treasury: 'none', reports: 'none', dashboard: 'none', users: 'none',
  },
  // F — Chef d'Équipe
  chef_equipe: {
    config: 'none', budget: 'none', planning: 'none', journal: 'none',
    pointage: 'full', qhse: 'none', documents: 'none', stock: 'none',
    treasury: 'none', reports: 'none', dashboard: 'none', users: 'none',
  },
  // G — Ingénieur / Bureau d'Études
  ingenieur: {
    config: 'none', budget: 'none', planning: 'read', journal: 'none',
    pointage: 'none', qhse: 'none', documents: 'full', stock: 'none',
    treasury: 'none', reports: 'none', dashboard: 'none', users: 'none',
  },
  // H — QHSE
  qhse: {
    config: 'none', budget: 'none', planning: 'none', journal: 'read',
    pointage: 'none', qhse: 'full', documents: 'none', stock: 'none',
    treasury: 'read', reports: 'edit', dashboard: 'none', users: 'none',
  },
  // I — Magasinier
  magasinier: {
    config: 'none', budget: 'read', planning: 'none', journal: 'none',
    pointage: 'none', qhse: 'none', documents: 'none', stock: 'full',
    treasury: 'none', reports: 'none', dashboard: 'none', users: 'none',
  },
  // J — Comptable / Financier
  comptable: {
    config: 'none', budget: 'full', planning: 'none', journal: 'none',
    pointage: 'none', qhse: 'none', documents: 'none', stock: 'read',
    treasury: 'full', reports: 'edit', dashboard: 'read', users: 'none',
  },
  // K — Client (read-only)
  client: {
    config: 'none', budget: 'none', planning: 'read', journal: 'none',
    pointage: 'none', qhse: 'none', documents: 'none', stock: 'none',
    treasury: 'none', reports: 'read', dashboard: 'read', users: 'none',
  },
};

export const ROLE_LABELS = {
  app_owner:        'App Owner',
  admin_entreprise: 'Directeur / Admin',
  office_admin:     'Admin de Bureau',
  chef_projet:      'Chef de Projet',
  chef_chantier:    'Chef de Chantier',
  chef_equipe:      "Chef d'Équipe",
  ingenieur:        "Ingénieur / Bureau d'Études",
  qhse:             'Responsable QHSE',
  magasinier:       'Magasinier',
  comptable:        'Comptable / Financier',
  client:           "Client / Maître d'Ouvrage",
};

export const ROLE_COLORS = {
  app_owner:        { bg: 'rgba(255,255,255,0.1)',  color: '#fff',     border: 'rgba(255,255,255,0.2)'  },
  admin_entreprise: { bg: 'rgba(245,158,11,0.15)',  color: '#F59E0B',  border: 'rgba(245,158,11,0.3)'   },
  office_admin:     { bg: 'rgba(6,182,212,0.15)',   color: '#22D3EE',  border: 'rgba(6,182,212,0.3)'    },
  chef_projet:      { bg: 'rgba(99,102,241,0.15)',  color: '#818CF8',  border: 'rgba(99,102,241,0.3)'   },
  chef_chantier:    { bg: 'rgba(249,115,22,0.15)',  color: '#FB923C',  border: 'rgba(249,115,22,0.3)'   },
  chef_equipe:      { bg: 'rgba(251,191,36,0.15)',  color: '#FCD34D',  border: 'rgba(251,191,36,0.3)'   },
  ingenieur:        { bg: 'rgba(16,185,129,0.15)',  color: '#34D399',  border: 'rgba(16,185,129,0.3)'   },
  qhse:             { bg: 'rgba(239,68,68,0.15)',   color: '#F87171',  border: 'rgba(239,68,68,0.3)'    },
  magasinier:       { bg: 'rgba(156,163,175,0.12)', color: '#9CA3AF',  border: 'rgba(156,163,175,0.25)' },
  comptable:        { bg: 'rgba(52,211,153,0.15)',  color: '#4ADE80',  border: 'rgba(52,211,153,0.3)'   },
  client:           { bg: 'rgba(59,130,246,0.15)',  color: '#60A5FA',  border: 'rgba(59,130,246,0.3)'   },
};

export const ROLE_ICONS = {
  app_owner:        '⚙️',
  admin_entreprise: '👑',
  office_admin:     '🗂️',
  chef_projet:      '🏗️',
  chef_chantier:    '⛏️',
  chef_equipe:      '👷',
  ingenieur:        '📐',
  qhse:             '🛡️',
  magasinier:       '📦',
  comptable:        '💰',
  client:           '🏛️',
};

// Maps each role to its dashboard type — used by App.js for routing
export const ROLE_DASHBOARD = {
  app_owner:        'infrastructure',
  admin_entreprise: 'strategic',
  office_admin:     'resources',
  chef_projet:      'gantt_budget',
  chef_chantier:    'field_action',
  chef_equipe:      'attendance_simple',
  ingenieur:        'documents',
  qhse:             'safety',
  magasinier:       'stock',
  comptable:        'treasury',
  client:           'progress',
};

// ── Helpers ───────────────────────────────────────────────────────────────

export function getPermissions(role) {
  return ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.client;
}

export function can(role, module) {
  const p = getPermissions(role)[module];
  return p !== undefined && p !== 'none';
}

export function canWrite(role, module) {
  const p = getPermissions(role)[module];
  return p === 'edit' || p === 'full';
}

export function canFull(role, module) {
  return getPermissions(role)[module] === 'full';
}

// ── Context ───────────────────────────────────────────────────────────────

const PermissionsContext = createContext(null);

export function PermissionsProvider({ children }) {
  const { user } = useAuth();
  const role = user?.platform_role || 'client';

  const value = {
    role,
    roleLabel:     ROLE_LABELS[role]     || role,
    roleColor:     ROLE_COLORS[role]     || ROLE_COLORS.client,
    roleIcon:      ROLE_ICONS[role]      || '👤',
    dashboardType: ROLE_DASHBOARD[role]  || 'progress',
    can:      (module) => can(role, module),
    canWrite: (module) => canWrite(role, module),
    canFull:  (module) => canFull(role, module),
    // Shorthand booleans
    isAppOwner:       role === 'app_owner',
    isDirecteur:      role === 'admin_entreprise',
    isOfficeAdmin:    role === 'office_admin',
    isChefChantier:   role === 'chef_chantier',
    isChefEquipe:     role === 'chef_equipe',
    isReadOnly:       role === 'client',
    canCreateUsers:   ['app_owner', 'admin_entreprise', 'office_admin'].includes(role),
    canViewFinancials:['app_owner', 'admin_entreprise', 'comptable'].includes(role),
    canPointage:      ['chef_chantier', 'chef_equipe', 'app_owner'].includes(role),
    permissions: getPermissions(role),
  };

  return (
    <PermissionsContext.Provider value={value}>
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions() {
  return useContext(PermissionsContext);
}