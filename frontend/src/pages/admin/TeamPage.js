// frontend/src/pages/admin/TeamPage.js
// Accessible by: admin_entreprise (B), office_admin (C)
// B can create C→K, C can create D→K
import React, { useState, useEffect, useCallback } from 'react';
import { teamAPI } from '../../services/api';
import { usePermissions } from '../../context/PermissionsContext';
import { useAuth } from '../../context/AuthContext';
import AppLayout from '../../components/layout/AppLayout';
import toast from 'react-hot-toast';

const T = {
  bg: '#F8F9FA', card: '#FFFFFF', border: '#E8EDF2',
  text: '#1a1f2e', textSub: '#6B7280', textMuted: '#9CA3AF',
  orange: '#F97316', orangeLight: 'rgba(249,115,22,0.1)',
  green: '#10B981', greenLight: 'rgba(16,185,129,0.08)',
  red: '#EF4444', redLight: 'rgba(239,68,68,0.08)',
  blue: '#3B82F6', blueLight: 'rgba(59,130,246,0.1)',
  shadow: '0 1px 3px rgba(0,0,0,0.07)',
};

const ROLE_CONFIG = {
  app_owner:        { label: 'App Owner',        color: '#6B7280', bg: '#F3F4F6' },
  admin_entreprise: { label: 'Directeur',         color: '#F97316', bg: '#FFF7ED' },
  office_admin:     { label: 'Admin de Bureau',   color: '#06B6D4', bg: '#ECFEFF' },
  chef_projet:      { label: 'Chef de Projet',    color: '#8B5CF6', bg: '#F5F3FF' },
  chef_chantier:    { label: 'Chef de Chantier',  color: '#F97316', bg: '#FFF7ED' },
  chef_equipe:      { label: "Chef d'Équipe",      color: '#F59E0B', bg: '#FFFBEB' },
  ingenieur:        { label: 'Ingénieur',          color: '#10B981', bg: '#ECFDF5' },
  qhse:             { label: 'QHSE',               color: '#EF4444', bg: '#FEF2F2' },
  magasinier:       { label: 'Magasinier',         color: '#6B7280', bg: '#F3F4F6' },
  comptable:        { label: 'Comptable',          color: '#10B981', bg: '#ECFDF5' },
  client:           { label: "Client MO",          color: '#3B82F6', bg: '#EFF6FF' },
};

// Roles each type can invite
const INVITABLE_BY = {
  admin_entreprise: ['office_admin','chef_projet','chef_chantier','chef_equipe','ingenieur','qhse','magasinier','comptable','client'],
  office_admin:     ['chef_projet','chef_chantier','chef_equipe','ingenieur','qhse','magasinier','comptable','client'],
  app_owner:        Object.keys(ROLE_CONFIG),
};

function Card({ children, style = {}, p = 24 }) {
  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: p, boxShadow: T.shadow, ...style }}>
      {children}
    </div>
  );
}

function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#fff', borderRadius: 14, width: 460, maxWidth: '95vw', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
        <div style={{ padding: '18px 24px 14px', borderBottom: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: T.text }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, color: T.textMuted, cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ padding: 24 }}>{children}</div>
      </div>
    </div>
  );
}

const inputStyle = {
  width: '100%', padding: '9px 12px', borderRadius: 8,
  border: `1px solid ${T.border}`, background: '#FAFAFA',
  fontSize: 13, color: T.text, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
};

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.textSub, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
        {label}
      </label>
      {children}
    </div>
  );
}

export default function TeamPage() {
  const { role } = usePermissions();
  const { user }  = useAuth();

  const [team, setTeam]           = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [tempPass, setTempPass]   = useState('');
  const [saving, setSaving]       = useState(false);

  const [form, setForm] = useState({
    full_name: '', email: '', phone: '', fonction: '', platform_role: '',
  });

  const invitableRoles = INVITABLE_BY[role] || [];

  const load = useCallback(() => {
    setLoading(true);
    teamAPI.list()
      .then(r => setTeam(r.data || []))
      .catch(() => toast.error('Erreur chargement équipe'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleInvite = async () => {
    if (!form.full_name || !form.email || !form.platform_role) {
      return toast.error('Nom, email et rôle requis');
    }
    setSaving(true);
    try {
      const r = await teamAPI.invite(form);
      toast.success(`Invitation envoyée à ${form.email}`);
      setTempPass(r.data.temp_password);
      setForm({ full_name: '', email: '', phone: '', fonction: '', platform_role: '' });
      load();
    } catch (err) {
      const errors = err.response?.data;
      if (errors) {
        Object.entries(errors).forEach(([k, v]) => {
          const msgs = Array.isArray(v) ? v : [v];
          msgs.forEach(m => toast.error(`${k}: ${m}`));
        });
      } else {
        toast.error('Erreur lors de l\'invitation');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (member) => {
    try {
      await teamAPI.update(member.id, { is_active: !member.is_active });
      toast.success(`${member.full_name} ${member.is_active ? 'désactivé' : 'réactivé'}`);
      load();
    } catch {
      toast.error('Erreur');
    }
  };

  const filtered = team.filter(m => {
    const q = search.toLowerCase();
    const matchSearch = !q || m.full_name?.toLowerCase().includes(q) || m.email?.toLowerCase().includes(q);
    const matchRole = !filterRole || m.platform_role === filterRole;
    return matchSearch && matchRole;
  });

  const stats = {
    total: team.length,
    active: team.filter(m => m.is_active).length,
    admins: team.filter(m => ['admin_entreprise', 'office_admin'].includes(m.platform_role)).length,
    terrain: team.filter(m => ['chef_chantier', 'chef_equipe'].includes(m.platform_role)).length,
  };

  return (
    <AppLayout>
      {/* Top bar */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '0 32px', height: 60, background: '#fff',
        borderBottom: `1px solid ${T.border}`, position: 'sticky', top: 0, zIndex: 10,
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: T.text }}>Équipe & Comptes utilisateurs</h1>
          <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>
            {team.length} membre{team.length !== 1 ? 's' : ''} dans votre entreprise
          </div>
        </div>
        <button
          onClick={() => { setTempPass(''); setModalOpen(true); }}
          style={{
            padding: '9px 20px', borderRadius: 8, background: T.orange, color: '#fff',
            fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer',
            fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          <span style={{ fontSize: 16 }}>+</span> Inviter un membre
        </button>
      </div>

      <div style={{ padding: 32 }}>
        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 28 }}>
          {[
            { label: 'Total membres', value: stats.total,   color: T.orange },
            { label: 'Actifs',        value: stats.active,  color: T.green  },
            { label: 'Administratifs',value: stats.admins,  color: '#8B5CF6' },
            { label: 'Terrain',       value: stats.terrain, color: '#F59E0B' },
          ].map((k, i) => (
            <Card key={i} p={20}>
              <div style={{ fontSize: 11, color: T.textSub, marginBottom: 6, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{k.label}</div>
              <div style={{ fontSize: 32, fontWeight: 800, color: k.color, lineHeight: 1 }}>{k.value}</div>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            placeholder="🔍  Rechercher..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ ...inputStyle, width: 260, background: '#fff' }}
          />
          <select
            value={filterRole}
            onChange={e => setFilterRole(e.target.value)}
            style={{ ...inputStyle, width: 200, background: '#fff' }}
          >
            <option value="">Tous les rôles</option>
            {Object.entries(ROLE_CONFIG).filter(([v]) => v !== 'app_owner').map(([v, c]) => (
              <option key={v} value={v}>{c.label}</option>
            ))}
          </select>
        </div>

        {/* Table */}
        <Card p={0}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: T.textMuted }}>
              <div style={{ width: 32, height: 32, border: `3px solid ${T.orange}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
              Chargement...
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: T.textMuted }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>👥</div>
              <div style={{ fontSize: 14 }}>Aucun membre trouvé</div>
              <div style={{ fontSize: 12, marginTop: 6 }}>Invitez des membres avec le bouton ci-dessus</div>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Membre', 'Rôle', 'Fonction', 'Email', 'Téléphone', 'Statut', 'Actions'].map(h => (
                    <th key={h} style={{
                      textAlign: 'left', padding: '12px 16px',
                      fontSize: 11, color: T.textMuted, fontWeight: 600,
                      textTransform: 'uppercase', letterSpacing: '0.5px',
                      borderBottom: `1px solid ${T.border}`, background: '#FAFAFA',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(m => {
                  const rc = ROLE_CONFIG[m.platform_role] || ROLE_CONFIG.client;
                  const isSelf = m.id === user?.id;
                  return (
                    <tr key={m.id} style={{ borderBottom: `1px solid ${T.border}` }}
                      onMouseEnter={e => e.currentTarget.style.background = '#FAFAFA'}
                      onMouseLeave={e => e.currentTarget.style.background = ''}>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{
                            width: 34, height: 34, borderRadius: '50%',
                            background: rc.bg, border: `2px solid ${rc.color}30`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 12, fontWeight: 700, color: rc.color, flexShrink: 0,
                          }}>
                            {m.full_name?.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>
                              {m.full_name}
                              {isSelf && <span style={{ fontSize: 10, color: T.orange, marginLeft: 6, fontWeight: 700 }}>VOUS</span>}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ padding: '3px 10px', borderRadius: 100, fontSize: 11, fontWeight: 600, color: rc.color, background: rc.bg }}>
                          {rc.label}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: T.textSub }}>{m.fonction || '—'}</td>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: T.textSub }}>{m.email}</td>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: T.textSub }}>{m.phone || '—'}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          padding: '3px 10px', borderRadius: 100, fontSize: 11, fontWeight: 600,
                          color: m.is_active ? T.green : T.red,
                          background: m.is_active ? T.greenLight : T.redLight,
                        }}>
                          {m.is_active ? 'Actif' : 'Inactif'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {!isSelf && (
                          <button
                            onClick={() => handleToggleActive(m)}
                            style={{
                              padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 500,
                              background: m.is_active ? T.redLight : T.greenLight,
                              color: m.is_active ? T.red : T.green,
                              border: `1px solid ${m.is_active ? T.red : T.green}30`,
                              cursor: 'pointer', fontFamily: 'inherit',
                            }}>
                            {m.is_active ? 'Désactiver' : 'Réactiver'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      {/* ── Invite Modal ── */}
      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setTempPass(''); }} title="Inviter un membre">
        {tempPass ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: T.text, marginBottom: 8 }}>Invitation envoyée !</div>
            <div style={{ fontSize: 13, color: T.textSub, marginBottom: 20 }}>
              Partagez ce mot de passe temporaire avec le nouveau membre :
            </div>
            <div style={{
              padding: '12px 20px', background: '#F9FAFB', borderRadius: 10,
              border: `2px dashed ${T.orange}`, fontSize: 18, fontWeight: 800,
              color: T.orange, letterSpacing: '0.5px', marginBottom: 20, fontFamily: 'monospace',
            }}>
              {tempPass}
            </div>
            <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 20 }}>
              Le membre devra changer son mot de passe à la première connexion.
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={() => { navigator.clipboard.writeText(tempPass); toast.success('Copié !'); }}
                style={{ padding: '9px 18px', borderRadius: 8, border: `1px solid ${T.border}`, background: '#fff', color: T.textSub, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                📋 Copier
              </button>
              <button onClick={() => { setTempPass(''); setModalOpen(false); }}
                style={{ padding: '9px 18px', borderRadius: 8, background: T.orange, color: '#fff', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                Fermer
              </button>
            </div>
          </div>
        ) : (
          <>
            <Field label="Nom complet *">
              <input style={inputStyle} value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} placeholder="Prénom Nom" />
            </Field>
            <Field label="Email *">
              <input style={inputStyle} type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="prenom.nom@entreprise.ml" />
            </Field>
            <Field label="Rôle *">
              <select style={inputStyle} value={form.platform_role} onChange={e => setForm(f => ({ ...f, platform_role: e.target.value }))}>
                <option value="">— Sélectionner un rôle —</option>
                {invitableRoles.map(r => (
                  <option key={r} value={r}>{ROLE_CONFIG[r]?.label || r}</option>
                ))}
              </select>
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Fonction / Poste">
                <input style={inputStyle} value={form.fonction} onChange={e => setForm(f => ({ ...f, fonction: e.target.value }))} placeholder="Ex: Conducteur travaux" />
              </Field>
              <Field label="Téléphone">
                <input style={inputStyle} value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+223 xx xx xx xx" />
              </Field>
            </div>
            <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#92400E', marginBottom: 16 }}>
              ⚠️ Un mot de passe temporaire sera généré automatiquement et affiché après la création.
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setModalOpen(false)}
                style={{ padding: '9px 20px', borderRadius: 8, border: `1px solid ${T.border}`, background: '#fff', color: T.textSub, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                Annuler
              </button>
              <button onClick={handleInvite} disabled={saving}
                style={{ padding: '9px 20px', borderRadius: 8, background: T.orange, color: '#fff', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                {saving ? 'Invitation...' : '📨 Inviter'}
              </button>
            </div>
          </>
        )}
      </Modal>
    </AppLayout>
  );
}