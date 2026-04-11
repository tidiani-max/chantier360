// frontend/src/components/ui/RoleBadge.js
import React from 'react';
import { ROLE_LABELS, ROLE_COLORS, ROLE_ICONS } from '../../context/PermissionsContext';

export default function RoleBadge({ role, size = 'md', showIcon = true }) {
  const colors = ROLE_COLORS[role] || ROLE_COLORS.client;
  const label  = ROLE_LABELS[role]  || role;
  const icon   = ROLE_ICONS[role]   || '👤';

  const sizes = {
    sm: { fontSize: 11, padding: '2px 8px',  gap: 4 },
    md: { fontSize: 13, padding: '4px 12px', gap: 6 },
    lg: { fontSize: 15, padding: '6px 16px', gap: 8 },
  };

  const s = sizes[size] || sizes.md;

  return (
    <span style={{
      display:      'inline-flex',
      alignItems:   'center',
      gap:          s.gap,
      padding:      s.padding,
      borderRadius: 100,
      fontSize:     s.fontSize,
      fontWeight:   600,
      color:        colors.color,
      background:   colors.bg,
      border:       `1px solid ${colors.border}`,
      whiteSpace:   'nowrap',
    }}>
      {showIcon && <span style={{ fontSize: s.fontSize }}>{icon}</span>}
      {label}
    </span>
  );
}