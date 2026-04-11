// frontend/src/pages/admin/WorkersPage.js
// Office Admin (C) and Admin Entreprise (B) manage workers (ouvriers)
import React, { useState, useEffect, useCallback } from 'react';
import { workersAPI } from '../../services/api';
import AppLayout from '../../components/layout/AppLayout';
import toast from 'react-hot-toast';

const T = {
  bg: '#F8F9FA', card: '#FFFFFF', border: '#E8EDF2',
  text: '#1a1f2e', textSub: '#6B7280', textMuted: '#9CA3AF',
  orange: '#F97316', orangeLight: 'rgba(249,115,22,0.1)',
  green: '#10B981', greenLight: 'rgba(16,185,129,0.08)',
  red: '#EF4444', redLight: 'rgba(239,68,68,0.08)',
  shadow: '0 1px 3px rgba(0,0,0,0.07)',
};

const TRADE_LABELS = {
  maconnerie:  'Maçonnerie',
  ferraillage: 'Ferraillage',
  coffrage:    'Coffrage',
  carrelage:   'Carrelage',
  peinture:    'Peinture',
  plomberie:   'Plomberie',
  electricite: 'Électricité',
  menuiserie:  'Menuiserie',
  manoeuvre:   'Manœuvre',
  conducteur:  "Conducteur d'engin",
  autre:       'Autre',
};

const TRADE_ICONS = {
  maconnerie: '🧱', ferraillage: '⚙️', coffrage: '🪵', carrelage: '🔲',
  peinture: '🎨', plomberie: '🔧', electricite: '⚡', menuiserie: '🪚',
  manoeuvre: '👷', conducteur: '🚜', autre: '🔩',
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
      <div style={{ background: '#fff', borderRadius: 14, width: 480, maxWidth: '95vw', boxShadow: '0 20px 60px rgba(0,0,0,0.15)', maxHeight: '90vh', overflow: 'auto' }}>
        <div style={{ padding: '18px 24px 14px', borderBottom: `1px solid ${T.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: '#fff' }}>
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
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: T.textSub, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{label}</label>
      {children}
    </div>
  );
}

const emptyForm = {
  first_name: '', last_name: '', phone: '', trade: 'manoeuvre',
  daily_rate: '', id_number: '',
};

export default function WorkersPage() {
  const [workers, setWorkers]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [filterTrade, setFilterTrade] = useState('');
  const [filterActive, setFilterActive] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editWorker, setEditWorker] = useState(null);
  const [saving, setSaving]       = useState(false);
  const [form, setForm]           = useState(emptyForm);

  const load = useCallback(() => {
    setLoading(true);
    workersAPI.list()
      .then(r => setWorkers(r.data || []))
      .catch(() => toast.error('Erreur chargement ouvriers'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditWorker(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (w) => {
    setEditWorker(w);
    setForm({
      first_name: w.first_name, last_name: w.last_name,
      phone: w.phone || '', trade: w.trade,
      daily_rate: w.daily_rate || '', id_number: w.id_number || '',
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.first_name || !form.last_name) return toast.error('Prénom et nom requis');
    setSaving(true);
    try {
      if (editWorker) {
        await workersAPI.update(editWorker.id, form);
        toast.success('Ouvrier mis à jour');
      } else {
        await workersAPI.create(form);
        toast.success('Ouvrier enregistré');
      }
      setModalOpen(false);
      load();
    } catch (err) {
      const errors = err.response?.data;
      if (errors) {
        Object.entries(errors).forEach(([k, v]) => {
          const msgs = Array.isArray(v) ? v : [v];
          msgs.forEach(m => toast.error(`${k}: ${m}`));
        });
      } else {
        toast.error('Erreur lors de la sauvegarde');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (w) => {
    if (!window.confirm(`${w.is_active ? 'Désactiver' : 'Réactiver'} ${w.full_name || `${w.first_name} ${w.last_name}`} ?`)) return;
    try {
      await workersAPI.update(w.id, { is_active: !w.is_active });
      toast.success('Mis à jour');
      load();
    } catch {
      toast.error('Erreur');
    }
  };

  const fmtFCFA = (n) => {
    if (!n) return '—';
    const v = parseFloat(n);
    return v.toLocaleString('fr-FR') + ' FCFA/j';
  };

  const filtered = workers.filter(w => {
    const name = `${w.first_name} ${w.last_name}`.toLowerCase();
    const q = search.toLowerCase();
    const matchSearch = !q || name.includes(q) || w.phone?.includes(q);
    const matchTrade = !filterTrade || w.trade === filterTrade;
    const matchActive = filterActive === '' || String(w.is_active) === filterActive;
    return matchSearch && matchTrade && matchActive;
  });

  const stats = {
    total: workers.length,
    active: workers.filter(w => w.is_active).length,
    avgRate: workers.filter(w => w.daily_rate).length
      ? Math.round(workers.filter(w => w.daily_rate).reduce((a, w) => a + parseFloat(w.daily_rate), 0) / workers.filter(w => w.daily_rate).length)
      : 0,
  };

  // Trade distribution
  const tradeCounts = workers.reduce((acc, w) => {
    acc[w.trade] = (acc[w.trade] || 0) + 1;
    return acc;
  }, {});
  const topTrades = Object.entries(tradeCounts).sort((a, b) => b[1] - a[1]).slice(0, 4);

  return (
    <AppLayout>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '0 32px', height: 60, background: '#fff',
        borderBottom: `1px solid ${T.border}`, position: 'sticky', top: 0, zIndex: 10,
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: T.text }}>Ouvriers</h1>
          <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>
            {workers.length} ouvrier{workers.length !== 1 ? 's' : ''} enregistré{workers.length !== 1 ? 's' : ''}
          </div>
        </div>
        <button onClick={openCreate} style={{
          padding: '9px 20px', borderRadius: 8, background: T.orange, color: '#fff',
          fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer',
          fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span>+</span> Ajouter un ouvrier
        </button>
      </div>

      <div style={{ padding: 32 }}>
        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr) 1.2fr', gap: 16, marginBottom: 28 }}>
          <Card p={20}>
            <div style={{ fontSize: 11, color: T.textSub, marginBottom: 6, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Total ouvriers</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: T.orange, lineHeight: 1 }}>{stats.total}</div>
          </Card>
          <Card p={20}>
            <div style={{ fontSize: 11, color: T.textSub, marginBottom: 6, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Actifs</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: T.green, lineHeight: 1 }}>{stats.active}</div>
          </Card>
          <Card p={20}>
            <div style={{ fontSize: 11, color: T.textSub, marginBottom: 6, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Taux moy./jour</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: T.text, lineHeight: 1 }}>
              {stats.avgRate ? stats.avgRate.toLocaleString('fr-FR') + ' FCFA' : '—'}
            </div>
          </Card>
          <Card p={20}>
            <div style={{ fontSize: 11, color: T.textSub, marginBottom: 8, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.4px' }}>Corps de métier</div>
            {topTrades.length === 0
              ? <div style={{ fontSize: 13, color: T.textMuted }}>—</div>
              : topTrades.map(([trade, count]) => (
                <div key={trade} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                  <span style={{ fontSize: 14 }}>{TRADE_ICONS[trade] || '👷'}</span>
                  <span style={{ flex: 1, fontSize: 12, color: T.text }}>{TRADE_LABELS[trade] || trade}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: T.textSub }}>{count}</span>
                </div>
              ))
            }
          </Card>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            placeholder="🔍  Rechercher un ouvrier..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ ...inputStyle, width: 260, background: '#fff' }}
          />
          <select value={filterTrade} onChange={e => setFilterTrade(e.target.value)}
            style={{ ...inputStyle, width: 180, background: '#fff' }}>
            <option value="">Tous les métiers</option>
            {Object.entries(TRADE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
          <select value={filterActive} onChange={e => setFilterActive(e.target.value)}
            style={{ ...inputStyle, width: 140, background: '#fff' }}>
            <option value="">Tous</option>
            <option value="true">Actifs</option>
            <option value="false">Inactifs</option>
          </select>
        </div>

        {/* Grid */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: T.textMuted }}>
            <div style={{ width: 32, height: 32, border: `3px solid ${T.orange}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
            Chargement...
          </div>
        ) : filtered.length === 0 ? (
          <Card style={{ textAlign: 'center', padding: '60px 24px' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>👷</div>
            <div style={{ fontSize: 14, color: T.textSub, marginBottom: 16 }}>
              {workers.length === 0 ? 'Aucun ouvrier enregistré' : 'Aucun résultat pour ce filtre'}
            </div>
            {workers.length === 0 && (
              <button onClick={openCreate} style={{ padding: '9px 20px', borderRadius: 8, background: T.orange, color: '#fff', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                + Ajouter le premier ouvrier
              </button>
            )}
          </Card>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
            {filtered.map(w => (
              <Card key={w.id} p={20} style={{ position: 'relative', opacity: w.is_active ? 1 : 0.65 }}>
                {!w.is_active && (
                  <div style={{ position: 'absolute', top: 12, right: 12, padding: '2px 8px', borderRadius: 100, background: T.redLight, color: T.red, fontSize: 10, fontWeight: 700 }}>
                    INACTIF
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                  <div style={{
                    width: 46, height: 46, borderRadius: 12,
                    background: T.orangeLight, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: 22, flexShrink: 0,
                  }}>
                    {TRADE_ICONS[w.trade] || '👷'}
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>
                      {w.first_name} {w.last_name}
                    </div>
                    <div style={{ fontSize: 12, color: T.textSub }}>{TRADE_LABELS[w.trade] || w.trade}</div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
                  <div style={{ background: '#F9FAFB', borderRadius: 8, padding: '8px 10px' }}>
                    <div style={{ fontSize: 10, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 2 }}>Taux/jour</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: T.orange }}>{fmtFCFA(w.daily_rate)}</div>
                  </div>
                  <div style={{ background: '#F9FAFB', borderRadius: 8, padding: '8px 10px' }}>
                    <div style={{ fontSize: 10, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 2 }}>Téléphone</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{w.phone || '—'}</div>
                  </div>
                </div>

                {w.id_number && (
                  <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 12 }}>
                    🪪 CNI: {w.id_number}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => openEdit(w)}
                    style={{ flex: 1, padding: '7px 0', borderRadius: 7, border: `1px solid ${T.border}`, background: '#fff', color: T.textSub, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                    ✏️ Modifier
                  </button>
                  <button onClick={() => handleDeactivate(w)}
                    style={{ flex: 1, padding: '7px 0', borderRadius: 7, border: `1px solid ${w.is_active ? T.red : T.green}30`, background: w.is_active ? T.redLight : T.greenLight, color: w.is_active ? T.red : T.green, fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                    {w.is_active ? '🚫 Désactiver' : '✅ Réactiver'}
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* ── Worker Form Modal ── */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editWorker ? 'Modifier l\'ouvrier' : 'Ajouter un ouvrier'}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Prénom *">
            <input style={inputStyle} value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} placeholder="Modibo" />
          </Field>
          <Field label="Nom *">
            <input style={inputStyle} value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} placeholder="Touré" />
          </Field>
        </div>
        <Field label="Corps de métier *">
          <select style={inputStyle} value={form.trade} onChange={e => setForm(f => ({ ...f, trade: e.target.value }))}>
            {Object.entries(TRADE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{TRADE_ICONS[v]} {l}</option>
            ))}
          </select>
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Téléphone">
            <input style={inputStyle} value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+223 xx xx xx xx" />
          </Field>
          <Field label="Taux journalier (FCFA)">
            <input style={inputStyle} type="number" min="0" value={form.daily_rate} onChange={e => setForm(f => ({ ...f, daily_rate: e.target.value }))} placeholder="5000" />
          </Field>
        </div>
        <Field label="N° CNI / Pièce d'identité">
          <input style={inputStyle} value={form.id_number} onChange={e => setForm(f => ({ ...f, id_number: e.target.value }))} placeholder="MALI-XXXXX" />
        </Field>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
          <button onClick={() => setModalOpen(false)}
            style={{ padding: '9px 20px', borderRadius: 8, border: `1px solid ${T.border}`, background: '#fff', color: T.textSub, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
            Annuler
          </button>
          <button onClick={handleSave} disabled={saving}
            style={{ padding: '9px 20px', borderRadius: 8, background: T.orange, color: '#fff', fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
            {saving ? 'Sauvegarde...' : editWorker ? 'Mettre à jour' : 'Enregistrer'}
          </button>
        </div>
      </Modal>
    </AppLayout>
  );
}