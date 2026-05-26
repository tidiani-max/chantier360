// frontend/src/context/PermissionsContext.js
// BTP Manager — 13 roles (added directeur_general + directeur_technique)
// admin_entreprise kept as ALIAS for backward compat with existing DB users

import React, { createContext, useContext } from 'react';
import { useAuth } from './AuthContext';

// ─── PERMISSION MATRIX ────────────────────────────────────────────────────────
// Levels: 'full' | 'edit' | 'read' | 'none'
const ROLE_PERMISSIONS = {
  // A — App Owner (SaaS platform super admin)
  app_owner: {
    config:'full', budget:'full', planning:'full', journal:'full',
    pointage:'full', qhse:'full', documents:'full', stock:'full',
    treasury:'full', reports:'full', dashboard:'full', users:'full',
    directives:'full', decompte:'full', satisfaction:'full',
  },
  // B1 — Directeur Général (NEW — replaces admin_entreprise)
  directeur_general: {
    config:'full', budget:'full', planning:'full', journal:'read',
    pointage:'read', qhse:'read', documents:'full', stock:'read',
    treasury:'full', reports:'full', dashboard:'full', users:'full',
    directives:'full', decompte:'full', satisfaction:'full',
  },
  // B1 alias — keep admin_entreprise working for existing DB users
  admin_entreprise: {
    config:'full', budget:'full', planning:'full', journal:'read',
    pointage:'read', qhse:'read', documents:'full', stock:'read',
    treasury:'full', reports:'full', dashboard:'full', users:'full',
    directives:'full', decompte:'full', satisfaction:'full',
  },
  // B2 — Directeur Technique (NEW)
  directeur_technique: {
    config:'full', budget:'read', planning:'full', journal:'read',
    pointage:'read', qhse:'full', documents:'full', stock:'read',
    treasury:'none', reports:'full', dashboard:'full', users:'edit',
    directives:'edit', decompte:'read', satisfaction:'read',
  },
  // C — Office Admin (RH / Pivot)
  office_admin: {
    config:'full', budget:'read', planning:'read', journal:'read',
    pointage:'read', qhse:'read', documents:'read', stock:'read',
    treasury:'none', reports:'read', dashboard:'full', users:'full',
    directives:'read', decompte:'none', satisfaction:'none',
  },
  // D — Chef de Projet
  chef_projet: {
    config:'full', budget:'read', planning:'full', journal:'read',
    pointage:'read', qhse:'read', documents:'full', stock:'read',
    treasury:'read', reports:'full', dashboard:'full', users:'edit',
    directives:'read', decompte:'read', satisfaction:'read',
  },
  // E — Chef de Chantier (BLOCKED from all financials)
  chef_chantier: {
    config:'none', budget:'none', planning:'none', journal:'edit',
    pointage:'full', qhse:'edit', documents:'none', stock:'none',
    treasury:'none', reports:'none', dashboard:'none', users:'none',
    directives:'read', decompte:'none', satisfaction:'none',
  },
  // F — Chef d'Équipe
  chef_equipe: {
    config:'none', budget:'none', planning:'none', journal:'none',
    pointage:'full', qhse:'none', documents:'none', stock:'none',
    treasury:'none', reports:'none', dashboard:'none', users:'none',
    directives:'read', decompte:'none', satisfaction:'none',
  },
  // G — Ingénieur / Bureau d'Études
  ingenieur: {
    config:'none', budget:'none', planning:'read', journal:'none',
    pointage:'none', qhse:'none', documents:'full', stock:'none',
    treasury:'none', reports:'none', dashboard:'none', users:'none',
    directives:'read', decompte:'none', satisfaction:'none',
  },
  // H — QHSE
  qhse: {
    config:'none', budget:'none', planning:'none', journal:'read',
    pointage:'none', qhse:'full', documents:'none', stock:'none',
    treasury:'read', reports:'edit', dashboard:'none', users:'none',
    directives:'read', decompte:'none', satisfaction:'none',
  },
  // I — Magasinier
  magasinier: {
    config:'none', budget:'read', planning:'none', journal:'none',
    pointage:'none', qhse:'none', documents:'none', stock:'full',
    treasury:'none', reports:'none', dashboard:'none', users:'none',
    directives:'read', decompte:'none', satisfaction:'none',
  },
  // J — Comptable / Financier
  comptable: {
    config:'none', budget:'full', planning:'none', journal:'none',
    pointage:'none', qhse:'none', documents:'none', stock:'read',
    treasury:'full', reports:'edit', dashboard:'read', users:'none',
    directives:'read', decompte:'full', satisfaction:'none',
  },
  // K — Client (read-only)
  client: {
    config:'none', budget:'none', planning:'read', journal:'none',
    pointage:'none', qhse:'none', documents:'none', stock:'none',
    treasury:'none', reports:'read', dashboard:'read', users:'none',
    directives:'none', decompte:'none', satisfaction:'full',
  },
};

export const ROLE_LABELS = {
  app_owner:           'App Owner',
  directeur_general:   'Directeur Général',
  admin_entreprise:    'Directeur / Admin',   // alias
  directeur_technique: 'Directeur Technique',
  office_admin:        'Admin de Bureau',
  chef_projet:         'Chef de Projet',
  chef_chantier:       'Chef de Chantier',
  chef_equipe:         "Chef d'Équipe",
  ingenieur:           "Ingénieur / Bureau d'Études",
  qhse:                'Responsable QHSE',
  magasinier:          'Magasinier',
  comptable:           'Comptable / Financier',
  client:              "Client / Maître d'Ouvrage",
};

export const ROLE_COLORS = {
  app_owner:           { bg:'rgba(255,255,255,0.1)',  color:'#fff',     border:'rgba(255,255,255,0.2)'  },
  directeur_general:   { bg:'rgba(245,158,11,0.15)',  color:'#F59E0B',  border:'rgba(245,158,11,0.3)'   },
  admin_entreprise:    { bg:'rgba(245,158,11,0.15)',  color:'#F59E0B',  border:'rgba(245,158,11,0.3)'   },
  directeur_technique: { bg:'rgba(99,102,241,0.15)',  color:'#818CF8',  border:'rgba(99,102,241,0.3)'   },
  office_admin:        { bg:'rgba(6,182,212,0.15)',   color:'#22D3EE',  border:'rgba(6,182,212,0.3)'    },
  chef_projet:         { bg:'rgba(99,102,241,0.15)',  color:'#818CF8',  border:'rgba(99,102,241,0.3)'   },
  chef_chantier:       { bg:'rgba(249,115,22,0.15)',  color:'#FB923C',  border:'rgba(249,115,22,0.3)'   },
  chef_equipe:         { bg:'rgba(251,191,36,0.15)',  color:'#FCD34D',  border:'rgba(251,191,36,0.3)'   },
  ingenieur:           { bg:'rgba(16,185,129,0.15)',  color:'#34D399',  border:'rgba(16,185,129,0.3)'   },
  qhse:                { bg:'rgba(239,68,68,0.15)',   color:'#F87171',  border:'rgba(239,68,68,0.3)'    },
  magasinier:          { bg:'rgba(156,163,175,0.12)', color:'#9CA3AF',  border:'rgba(156,163,175,0.25)' },
  comptable:           { bg:'rgba(52,211,153,0.15)',  color:'#4ADE80',  border:'rgba(52,211,153,0.3)'   },
  client:              { bg:'rgba(59,130,246,0.15)',  color:'#60A5FA',  border:'rgba(59,130,246,0.3)'   },
};

export const ROLE_ICONS = {
  app_owner:           '⚙️',
  directeur_general:   '👑',
  admin_entreprise:    '👑',
  directeur_technique: '🏗️',
  office_admin:        '🗂️',
  chef_projet:         '📋',
  chef_chantier:       '⛏️',
  chef_equipe:         '👷',
  ingenieur:           '📐',
  qhse:                '🛡️',
  magasinier:          '📦',
  comptable:           '💰',
  client:              '🏛️',
};

export const ROLE_DASHBOARD = {
  app_owner:           'infrastructure',
  directeur_general:   'strategic',
  admin_entreprise:    'strategic',
  directeur_technique: 'technical',
  office_admin:        'resources',
  chef_projet:         'gantt_budget',
  chef_chantier:       'field_action',
  chef_equipe:         'attendance_simple',
  ingenieur:           'documents',
  qhse:                'safety',
  magasinier:          'stock',
  comptable:           'treasury',
  client:              'progress',
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────
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

// Roles that see ALL company projects (not just assigned)
export const COMPANY_WIDE_ROLES = new Set([
  'app_owner', 'directeur_general', 'admin_entreprise',
  'directeur_technique', 'office_admin',
]);

// Roles that can create projects
export const PROJECT_CREATE_ROLES = new Set([
  'app_owner', 'directeur_general', 'admin_entreprise',
]);

// Roles that can delete/archive projects
export const PROJECT_DELETE_ROLES = new Set([
  'app_owner', 'directeur_general', 'admin_entreprise',
]);

// ─── CONTEXT ──────────────────────────────────────────────────────────────────
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
    // Role booleans
    isAppOwner:           role === 'app_owner',
    isDirecteurGeneral:   role === 'directeur_general' || role === 'admin_entreprise',
    isDirecteurTechnique: role === 'directeur_technique',
    isDirecteur:          role === 'directeur_general' || role === 'admin_entreprise',
    isOfficeAdmin:        role === 'office_admin',
    isChefProjet:         role === 'chef_projet',
    isChefChantier:       role === 'chef_chantier',
    isChefEquipe:         role === 'chef_equipe',
    isReadOnly:           role === 'client',
    // Access booleans
    canSeeAllProjects: COMPANY_WIDE_ROLES.has(role),
    canCreateProject:  PROJECT_CREATE_ROLES.has(role),
    canDeleteProject:  PROJECT_DELETE_ROLES.has(role),
    canCreateUsers:    ['app_owner','directeur_general','admin_entreprise','office_admin'].includes(role),
    canViewFinancials: ['app_owner','directeur_general','admin_entreprise','comptable'].includes(role),
    canPointage:       ['chef_chantier','chef_equipe','app_owner'].includes(role),
    permissions:       getPermissions(role),
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
