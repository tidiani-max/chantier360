// frontend/src/pages/admin/CompaniesPage.js
// App Owner only — manages all tenant companies (real API calls)
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { companiesAPI, teamAPI } from '../../services/api';
import AppLayout from '../../components/layout/AppLayout';
import toast from 'react-hot-toast';

const T = {
  bg: '#F8F9FA', card: '#FFFFFF', border: '#E8EDF2',
  text: '#1a1f2e', textSub: '#6B7280', textMuted: '#9CA3AF',
  orange: '#F97316', orangeLight: 'rgba(249,115,22,0.1)',
  green: '#10B981', greenLight: 'rgba(16,185,129,0.08)',
  red: '#EF4444', redLight: 'rgba(239,68,68,0.08)',
  blue: '#3B82F6', blueLight: 'rgba(59,130,246,0.1)',
  yellow: '#F59E0B', purple: '#8B5CF6',
  shadow: '0 1px 3px rgba(0,0,0,0.07)',
};

const PLAN_CFG = {
  trial:      { label: 'Essai',      color: '#F59E0B', bg: '#FFFBEB' },
  starter:    { label: 'Starter',    color: '#6B7280', bg: '#F3F4F6' },
  pro:        { label: 'Pro',        color: '#3B82F6', bg: '#EFF6FF' },
  enterprise: { label: 'Enterprise', color: '#8B5CF6', bg: '#F5F3FF' },
};

function Card({ children, style = {}, p = 24 }) {
  return (
    <div style={{
      background: T.card, border: `1px solid ${T.border}`, borderRadius: 12,
      padding: p, boxShadow: T.shadow, ...style,
    }}>
      {children}
    </div>
  );
}

function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div style={{
        background: '#fff', borderRadius: 14, width: 480, maxWidth: '95vw',
        boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
      }}>
        <div style={{
          padding: '20px 24px 16px', borderBottom: `1px solid ${T.border}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: T.text }}>{title}</h3>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', fontSize: 20,
            color: T.textMuted, cursor: 'pointer', padding: '0 4px',
          }}>×</button>
        </div>
        <div style={{ padding: 24 }}>{children}</div>
      </div>
    </div>
  );
}

function FieldGroup({ label, children, hint }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.textSub, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
        {label}
      </label>
      {children}
      {hint && <div style={{ fontSize: 11, color: T.textMuted, marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

const inputStyle = {
  width: '100%', padding: '9px 12px', borderRadius: 8,
  border: `1px solid ${T.border}`, background: '#FAFAFA',
  fontSize: 13, color: T.text, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
};

export default function CompaniesPage() {
  const navigate = useNavigate();

  const [companies, setCompanies]       = useState([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState('');
  const [filterPlan, setFilterPlan]     = useState('');
  const [modalOpen, setModalOpen]       = useState(false);
  const [detailOpen, setDetailOpen]     = useState(false);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [companyUsers, setCompanyUsers] = useState([]);
  const [saving, setSaving]             = useState(false);

  const [form, setForm] = useState({
    name: '', slug: '', country: 'Mali', city: '',
    phone: '', email: '', subscription: 'trial',
  });

  const load = useCallback(() => {
    setLoading(true);
    companiesAPI.list()
      .then(r => setCompanies(r.data || []))
      .catch(() => toast.error('Erreur lors du chargement'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const openDetail = async (company) => {
    setSelectedCompany(company);
    setDetailOpen(true);
    try {
      const r = await teamAPI.list({ company: company.id });
      setCompanyUsers(r.data || []);
    } catch {
      setCompanyUsers([]);
    }
  };

  const handleCreate = async () => {
    if (!form.name || !form.slug) return toast.error('Nom et slug requis');
    setSaving(true);
    try {
      await companiesAPI.create(form);
      toast.success(`Entreprise "${form.name}" créée !`);
      setModalOpen(false);
      setForm({ name: '', slug: '', country: 'Mali', city: '', phone: '', email: '', subscription: 'trial' });
      load();
    } catch (err) {
      const errors = err.response?.data;
      if (errors) {
        Object.entries(errors).forEach(([k, v]) => {
          const msgs = Array.isArray(v) ? v : [v];
          msgs.forEach(m => toast.error(`${k}: ${m}`));
        });
      } else {
        toast.error('Erreur lors de la création');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (company) => {
    try {
      await companiesAPI.update(company.id, { is_active: !company.is_active });
      toast.success(`Entreprise ${company.is_active ? 'suspendue' : 'réactivée'}`);
      load();
      if (selectedCompany?.id === company.id) {
        setSelectedCompany(c => ({ ...c, is_active: !c.is_active }));
      }
    } catch {
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const handleUpdatePlan = async (company, subscription) => {
    try {
      await companiesAPI.update(company.id, { subscription });
      toast.success('Plan mis à jour');
      load();
      if (selectedCompany?.id === company.id) {
        setSelectedCompany(c => ({ ...c, subscription }));
      }
    } catch {
      toast.error('Erreur');
    }
  };

  // Auto-generate slug from name
  const autoSlug = (name) =>
    name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 50);

  const filtered = companies.filter(c => {
    const q = search.toLowerCase();
    const matchSearch = !q || c.name.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q);
    const matchPlan = !filterPlan || c.subscription === filterPlan;
    return matchSearch && matchPlan;
  });

  const stats = {
    total: companies.length,
    active: companies.filter(c => c.is_active).length,
    enterprise: companies.filter(c => c.subscription === 'enterprise').length,
    trial: companies.filter(c => c.subscription === 'trial').length,
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
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: T.text }}>
            Gestion des Entreprises
          </h1>
          <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>
            {companies.length} entreprise{companies.length !== 1 ? 's' : ''} sur la plateforme
          </div>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          style={{
            padding: '9px 20px', borderRadius: 8,
            background: T.orange, color: '#fff', fontSize: 13, fontWeight: 600,
            border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          <span style={{ fontSize: 16 }}>+</span> Nouvelle entreprise
        </button>
      </div>

      <div style={{ padding: 32 }}>
        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 28 }}>
          {[
            { label: 'Total entreprises', value: stats.total,      color: T.orange, icon: '🏢' },
            { label: 'Actives',           value: stats.active,     color: T.green,  icon: '✅' },
            { label: 'Enterprise',        value: stats.enterprise, color: T.purple, icon: '⭐' },
            { label: 'En essai',          value: stats.trial,      color: T.yellow, icon: '⏳' },
          ].map((k, i) => (
            <Card key={i} p={20}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 11, color: T.textSub, marginBottom: 6, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                    {k.label}
                  </div>
                  <div style={{ fontSize: 32, fontWeight: 800, color: k.color, lineHeight: 1 }}>
                    {k.value}
                  </div>
                </div>
                <span style={{ fontSize: 24 }}>{k.icon}</span>
              </div>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            placeholder="🔍  Rechercher une entreprise..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ ...inputStyle, width: 280, background: '#fff' }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { value: '', label: 'Tous les plans' },
              { value: 'trial', label: '⏳ Essai' },
              { value: 'starter', label: 'Starter' },
              { value: 'pro', label: 'Pro' },
              { value: 'enterprise', label: '⭐ Enterprise' },
            ].map(f => (
              <button key={f.value} onClick={() => setFilterPlan(f.value)}
                style={{
                  padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', border: `1px solid ${filterPlan === f.value ? T.orange : T.border}`,
                  background: filterPlan === f.value ? T.orangeLight : '#fff',
                  color: filterPlan === f.value ? T.orange : T.textSub,
                  fontFamily: 'inherit',
                }}>
                {f.label}
              </button>
            ))}
          </div>
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
              <div style={{ fontSize: 40, marginBottom: 12 }}>🏢</div>
              <div>Aucune entreprise trouvée</div>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Entreprise', 'Plan', 'Ville', 'Email', 'Statut', 'Actions'].map(h => (
                    <th key={h} style={{
                      textAlign: 'left', padding: '12px 16px',
                      fontSize: 11, color: T.textMuted, fontWeight: 600,
                      textTransform: 'uppercase', letterSpacing: '0.5px',
                      borderBottom: `1px solid ${T.border}`, background: '#FAFAFA',
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => {
                  const plan = PLAN_CFG[c.subscription] || PLAN_CFG.trial;
                  return (
                    <tr key={c.id} style={{ borderBottom: `1px solid ${T.border}` }}
                      onMouseEnter={e => e.currentTarget.style.background = '#FAFAFA'}
                      onMouseLeave={e => e.currentTarget.style.background = ''}
                    >
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: T.text }}>{c.name}</div>
                        <div style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>/{c.slug}</div>
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{
                          padding: '3px 10px', borderRadius: 100,
                          fontSize: 11, fontWeight: 600,
                          color: plan.color, background: plan.bg,
                        }}>
                          {plan.label}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px', fontSize: 13, color: T.textSub }}>
                        {c.city || c.country || '—'}
                      </td>
                      <td style={{ padding: '14px 16px', fontSize: 13, color: T.textSub }}>
                        {c.email || '—'}
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{
                          padding: '3px 10px', borderRadius: 100, fontSize: 11, fontWeight: 600,
                          color: c.is_active ? T.green : T.red,
                          background: c.is_active ? T.greenLight : T.redLight,
                        }}>
                          {c.is_active ? 'Active' : 'Suspendue'}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            onClick={() => openDetail(c)}
                            style={{
                              padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 500,
                              background: T.blueLight, color: T.blue,
                              border: `1px solid ${T.blue}30`, cursor: 'pointer', fontFamily: 'inherit',
                            }}>
                            Détail
                          </button>
                          <button
                            onClick={() => handleToggleActive(c)}
                            style={{
                              padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 500,
                              background: c.is_active ? T.redLight : T.greenLight,
                              color: c.is_active ? T.red : T.green,
                              border: `1px solid ${c.is_active ? T.red : T.green}30`,
                              cursor: 'pointer', fontFamily: 'inherit',
                            }}>
                            {c.is_active ? 'Suspendre' : 'Réactiver'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      {/* ── Create Company Modal ── */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nouvelle entreprise (tenant)">
        <FieldGroup label="Raison sociale *">
          <input
            style={inputStyle}
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value, slug: autoSlug(e.target.value) }))}
            placeholder="BTP Mali SARL"
          />
        </FieldGroup>
        <FieldGroup label="Slug (identifiant URL) *" hint="Lettres minuscules et tirets uniquement">
          <input
            style={inputStyle}
            value={form.slug}
            onChange={e => setForm(f => ({ ...f, slug: autoSlug(e.target.value) }))}
            placeholder="btp-mali"
          />
        </FieldGroup>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <FieldGroup label="Pays">
            <input style={inputStyle} value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} />
          </FieldGroup>
          <FieldGroup label="Ville">
            <input style={inputStyle} value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} placeholder="Bamako" />
          </FieldGroup>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <FieldGroup label="Téléphone">
            <input style={inputStyle} value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+223 xx xx xx xx" />
          </FieldGroup>
          <FieldGroup label="Email">
            <input style={inputStyle} type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="contact@..." />
          </FieldGroup>
        </div>
        <FieldGroup label="Plan d'abonnement">
          <select style={inputStyle} value={form.subscription} onChange={e => setForm(f => ({ ...f, subscription: e.target.value }))}>
            <option value="trial">Essai gratuit (30 jours)</option>
            <option value="starter">Starter</option>
            <option value="pro">Pro</option>
            <option value="enterprise">Enterprise</option>
          </select>
        </FieldGroup>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
          <button onClick={() => setModalOpen(false)}
            style={{ padding: '9px 20px', borderRadius: 8, border: `1px solid ${T.border}`, background: '#fff', color: T.textSub, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
            Annuler
          </button>
          <button onClick={handleCreate} disabled={saving}
            style={{ padding: '9px 20px', borderRadius: 8, background: T.orange, color: '#fff', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
            {saving ? 'Création...' : 'Créer l\'entreprise'}
          </button>
        </div>
      </Modal>

      {/* ── Company Detail Modal ── */}
      <Modal open={detailOpen} onClose={() => { setDetailOpen(false); setSelectedCompany(null); setCompanyUsers([]); }} title={selectedCompany?.name || 'Détail'}>
        {selectedCompany && (
          <div>
            {/* Plan change */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: T.textSub, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                Plan d'abonnement
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {Object.entries(PLAN_CFG).map(([val, cfg]) => (
                  <button key={val} onClick={() => handleUpdatePlan(selectedCompany, val)}
                    style={{
                      padding: '6px 14px', borderRadius: 100, fontSize: 12, fontWeight: 600,
                      cursor: 'pointer', border: `1px solid ${selectedCompany.subscription === val ? cfg.color : T.border}`,
                      background: selectedCompany.subscription === val ? cfg.bg : '#fff',
                      color: selectedCompany.subscription === val ? cfg.color : T.textSub,
                      fontFamily: 'inherit',
                    }}>
                    {cfg.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Info */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
              {[
                ['Slug', selectedCompany.slug],
                ['Pays', selectedCompany.country],
                ['Ville', selectedCompany.city || '—'],
                ['Email', selectedCompany.email || '—'],
                ['Téléphone', selectedCompany.phone || '—'],
                ['Statut', selectedCompany.is_active ? 'Active' : 'Suspendue'],
              ].map(([l, v]) => (
                <div key={l} style={{ background: '#F9FAFB', borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{ fontSize: 10, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 3 }}>{l}</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{v}</div>
                </div>
              ))}
            </div>

            {/* Users */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: T.textSub, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                Utilisateurs ({companyUsers.length})
              </div>
              {companyUsers.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px 0', color: T.textMuted, fontSize: 13 }}>
                  Aucun utilisateur
                </div>
              ) : (
                companyUsers.slice(0, 6).map(u => (
                  <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: `1px solid ${T.border}` }}>
                    <div style={{ width: 30, height: 30, borderRadius: '50%', background: T.orangeLight, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: T.orange }}>
                      {u.full_name?.slice(0, 2).toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{u.full_name}</div>
                      <div style={{ fontSize: 11, color: T.textMuted }}>{u.platform_role_display || u.platform_role}</div>
                    </div>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 100, background: u.is_active ? T.greenLight : T.redLight, color: u.is_active ? T.green : T.red, fontWeight: 600 }}>
                      {u.is_active ? 'Actif' : 'Inactif'}
                    </span>
                  </div>
                ))
              )}
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20, paddingTop: 16, borderTop: `1px solid ${T.border}` }}>
              <button
                onClick={() => handleToggleActive(selectedCompany)}
                style={{
                  padding: '9px 18px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                  background: selectedCompany.is_active ? T.redLight : T.greenLight,
                  color: selectedCompany.is_active ? T.red : T.green,
                  border: `1px solid ${selectedCompany.is_active ? T.red : T.green}30`,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}>
                {selectedCompany.is_active ? '🔴 Suspendre' : '🟢 Réactiver'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </AppLayout>
  );
}