// frontend/src/pages/admin/InventairePage.js
// Office Admin (C) — unit price catalog + equipment/vehicle fleet
// Backend: no dedicated model yet → uses localStorage via storage API
// When a backend model is added, replace localStorage calls with API calls
import React, { useState, useEffect } from 'react';
import AppLayout from '../../components/layout/AppLayout';
import toast from 'react-hot-toast';

const T = {
  card:'#FFFFFF', border:'#E8EDF2', text:'#1a1f2e', textSub:'#6B7280', textMuted:'#9CA3AF',
  orange:'#F97316', orangeLight:'rgba(249,115,22,0.1)',
  green:'#10B981', greenLight:'rgba(16,185,129,0.08)',
  red:'#EF4444', redLight:'rgba(239,68,68,0.08)',
  blue:'#3B82F6', shadow:'0 1px 3px rgba(0,0,0,0.07)',
};

const CATEGORIES = ['Béton & liants', 'Aciers & ferraillage', 'Maçonnerie', 'Menuiserie', 'Plomberie', 'Électricité', 'Étanchéité', 'Finitions', 'Équipements', 'Transports', 'Autre'];
const UNITS = ['m³', 'm²', 'ml', 'kg', 't', 'u', 'sac', 'lot', 'forfait', 'heure', 'jour'];

// Default catalog seed
const DEFAULT_CATALOG = [
  { id:'1', designation:'Béton BPE B25', category:'Béton & liants', unit:'m³', prix_unitaire:85000, fournisseur:'CIMAF Mali' },
  { id:'2', designation:'Béton BPE B30', category:'Béton & liants', unit:'m³', prix_unitaire:92000, fournisseur:'CIMAF Mali' },
  { id:'3', designation:'Ciment CEM II — 50kg', category:'Béton & liants', unit:'sac', prix_unitaire:12500, fournisseur:'Diamou Ciments' },
  { id:'4', designation:'Ferraillage HA12', category:'Aciers & ferraillage', unit:'kg', prix_unitaire:950, fournisseur:'Aciers du Sahel' },
  { id:'5', designation:'Ferraillage HA16', category:'Aciers & ferraillage', unit:'kg', prix_unitaire:1100, fournisseur:'Aciers du Sahel' },
  { id:'6', designation:'Ferraillage HA20', category:'Aciers & ferraillage', unit:'kg', prix_unitaire:1200, fournisseur:'Aciers du Sahel' },
  { id:'7', designation:'Parpaings 20x20x40', category:'Maçonnerie', unit:'u', prix_unitaire:320, fournisseur:'Briqueterie Bamako' },
  { id:'8', designation:'Sable de rivière', category:'Béton & liants', unit:'m³', prix_unitaire:18000, fournisseur:'Carrière Bamako' },
  { id:'9', designation:'Gravier 15/25', category:'Béton & liants', unit:'m³', prix_unitaire:22000, fournisseur:'Carrière Bamako' },
  { id:'10', designation:'PVC DN150 assainissement', category:'Plomberie', unit:'ml', prix_unitaire:4500, fournisseur:'Plombafric' },
];

function fmtFCFA(n) {
  if (!n) return '—';
  const v = parseFloat(n);
  if (v>=1e6) return `${(v/1e6).toFixed(2)} M FCFA`;
  if (v>=1e3) return `${(v/1e3).toFixed(0)} K FCFA`;
  return v.toLocaleString('fr-FR') + ' FCFA';
}

function Card({ children, style={}, p=24 }) {
  return <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:12, padding:p, boxShadow:T.shadow, ...style }}>{children}</div>;
}

function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.35)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
      <div style={{ background:'#fff', borderRadius:14, width:500, maxWidth:'95vw', maxHeight:'90vh', overflow:'auto', boxShadow:'0 20px 60px rgba(0,0,0,0.15)' }}>
        <div style={{ padding:'18px 24px 14px', borderBottom:`1px solid ${T.border}`, display:'flex', justifyContent:'space-between', alignItems:'center', position:'sticky', top:0, background:'#fff' }}>
          <h3 style={{ margin:0, fontSize:16, fontWeight:700, color:T.text }}>{title}</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:20, color:T.textMuted, cursor:'pointer' }}>×</button>
        </div>
        <div style={{ padding:24 }}>{children}</div>
      </div>
    </div>
  );
}

const inp = {
  width:'100%', padding:'9px 12px', borderRadius:8,
  border:`1px solid ${T.border}`, background:'#FAFAFA',
  fontSize:13, color:T.text, outline:'none', fontFamily:'inherit', boxSizing:'border-box',
};

function Field({ label, children }) {
  return (
    <div style={{ marginBottom:14 }}>
      <label style={{ display:'block', fontSize:11, fontWeight:600, color:T.textSub, marginBottom:5, textTransform:'uppercase', letterSpacing:'0.4px' }}>{label}</label>
      {children}
    </div>
  );
}

const emptyForm = { designation:'', category:'Béton & liants', unit:'m³', prix_unitaire:'', fournisseur:'' };

export default function InventairePage() {
  const [catalog, setCatalog]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem]   = useState(null);
  const [form, setForm]           = useState(emptyForm);
  const [activeTab, setActiveTab] = useState('catalog');

  // Load from localStorage (will be replaced by API when model exists)
  useEffect(() => {
    try {
      const saved = localStorage.getItem('btp_catalog');
      if (saved) setCatalog(JSON.parse(saved));
      else setCatalog(DEFAULT_CATALOG);
    } catch { setCatalog(DEFAULT_CATALOG); }
    setLoading(false);
  }, []);

  const save = (items) => {
    setCatalog(items);
    try { localStorage.setItem('btp_catalog', JSON.stringify(items)); } catch {}
  };

  const openCreate = () => { setEditItem(null); setForm(emptyForm); setModalOpen(true); };
  const openEdit   = (item) => { setEditItem(item); setForm({ designation:item.designation, category:item.category, unit:item.unit, prix_unitaire:item.prix_unitaire, fournisseur:item.fournisseur||'' }); setModalOpen(true); };

  const handleSave = () => {
    if (!form.designation || !form.prix_unitaire) return toast.error('Désignation et prix requis');
    if (editItem) {
      const updated = catalog.map(i => i.id===editItem.id ? { ...i, ...form, prix_unitaire: parseFloat(form.prix_unitaire) } : i);
      save(updated);
      toast.success('Article mis à jour');
    } else {
      const newItem = { ...form, id: Date.now().toString(), prix_unitaire: parseFloat(form.prix_unitaire) };
      save([...catalog, newItem]);
      toast.success('Article ajouté au catalogue');
    }
    setModalOpen(false);
  };

  const handleDelete = (id) => {
    if (!window.confirm('Supprimer cet article ?')) return;
    save(catalog.filter(i=>i.id!==id));
    toast.success('Supprimé');
  };

  const filtered = catalog.filter(i => {
    const q = search.toLowerCase();
    const matchSearch = !q || i.designation.toLowerCase().includes(q) || (i.fournisseur||'').toLowerCase().includes(q);
    const matchCat = !filterCat || i.category === filterCat;
    return matchSearch && matchCat;
  });

  // Group by category
  const byCat = CATEGORIES.map(cat => ({
    cat,
    items: filtered.filter(i=>i.category===cat),
  })).filter(g=>g.items.length>0);

  return (
    <AppLayout>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'0 32px', height:60, background:'#fff', borderBottom:`1px solid ${T.border}`, position:'sticky', top:0, zIndex:10 }}>
        <h1 style={{ margin:0, fontSize:17, fontWeight:700, color:T.text }}>📦 Inventaire & Prix unitaires</h1>
        <div style={{ display:'flex', gap:10 }}>
          <button onClick={openCreate}
            style={{ padding:'8px 20px', borderRadius:8, background:T.orange, color:'#fff', fontSize:13, fontWeight:600, border:'none', cursor:'pointer', fontFamily:'inherit' }}>
            + Ajouter au catalogue
          </button>
        </div>
      </div>

      <div style={{ padding:32 }}>
        {/* KPIs */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:24 }}>
          {[
            { label:'Articles au catalogue', value:catalog.length,         color:T.orange },
            { label:'Catégories',             value:new Set(catalog.map(i=>i.category)).size, color:T.blue },
            { label:'Fournisseurs',           value:new Set(catalog.map(i=>i.fournisseur).filter(Boolean)).size, color:T.green },
            { label:'Résultats filtrés',      value:filtered.length,       color:T.textSub },
          ].map((k,i)=>(
            <Card key={i} p={18}>
              <div style={{ fontSize:11, color:T.textSub, marginBottom:4, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.4px' }}>{k.label}</div>
              <div style={{ fontSize:28, fontWeight:800, color:k.color, lineHeight:1 }}>{k.value}</div>
            </Card>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', borderBottom:`1px solid ${T.border}`, marginBottom:20 }}>
          {[{id:'catalog',label:'📋 Catalogue des prix'},{id:'grouped',label:'📂 Par catégorie'}].map(t=>(
            <button key={t.id} onClick={()=>setActiveTab(t.id)}
              style={{ padding:'10px 18px', fontSize:13, fontWeight:600, cursor:'pointer', background:'none', border:'none', outline:'none', fontFamily:'inherit', color:activeTab===t.id?T.orange:T.textSub, borderBottom:`2px solid ${activeTab===t.id?T.orange:'transparent'}`, marginBottom:-1 }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display:'flex', gap:12, marginBottom:16, alignItems:'center', flexWrap:'wrap' }}>
          <input placeholder="🔍 Désignation, fournisseur..." value={search} onChange={e=>setSearch(e.target.value)}
            style={{...inp, width:280, background:'#fff'}}/>
          <select value={filterCat} onChange={e=>setFilterCat(e.target.value)}
            style={{...inp, width:200, background:'#fff'}}>
            <option value="">Toutes catégories</option>
            {CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Catalog tab */}
        {activeTab === 'catalog' && (
          <Card p={0}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr>{['Désignation','Catégorie','Unité','Prix unitaire (FCFA)','Fournisseur','Actions'].map(h=>(
                  <th key={h} style={{ textAlign:'left', padding:'10px 16px', fontSize:11, color:T.textMuted, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.4px', borderBottom:`1px solid ${T.border}`, background:'#FAFAFA' }}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} style={{ textAlign:'center', padding:'40px', color:T.textMuted }}>Chargement...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign:'center', padding:'60px', color:T.textMuted }}>
                    <div style={{ fontSize:36, marginBottom:12 }}>📋</div>
                    <div>{catalog.length===0?'Catalogue vide — ajoutez le premier article':'Aucun résultat'}</div>
                  </td></tr>
                ) : filtered.map(item=>(
                  <tr key={item.id} style={{ borderBottom:`1px solid ${T.border}` }}
                    onMouseEnter={e=>e.currentTarget.style.background='#FAFAFA'}
                    onMouseLeave={e=>e.currentTarget.style.background=''}>
                    <td style={{ padding:'12px 16px', fontSize:13, fontWeight:600, color:T.text }}>{item.designation}</td>
                    <td style={{ padding:'12px 16px' }}>
                      <span style={{ padding:'3px 8px', borderRadius:100, fontSize:11, fontWeight:500, background:T.orangeLight, color:T.orange }}>{item.category}</span>
                    </td>
                    <td style={{ padding:'12px 16px', fontSize:12, color:T.textSub }}>{item.unit}</td>
                    <td style={{ padding:'12px 16px', fontSize:14, fontWeight:700, color:T.text }}>{fmtFCFA(item.prix_unitaire)}</td>
                    <td style={{ padding:'12px 16px', fontSize:12, color:T.textSub }}>{item.fournisseur||'—'}</td>
                    <td style={{ padding:'12px 16px' }}>
                      <div style={{ display:'flex', gap:6 }}>
                        <button onClick={()=>openEdit(item)} style={{ padding:'4px 10px', borderRadius:6, border:`1px solid ${T.border}`, background:'#fff', color:T.textSub, fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>✏️</button>
                        <button onClick={()=>handleDelete(item.id)} style={{ padding:'4px 10px', borderRadius:6, border:`1px solid ${T.red}30`, background:T.redLight, color:T.red, fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>🗑</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}

        {/* Grouped tab */}
        {activeTab === 'grouped' && (
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            {byCat.length===0?(
              <Card style={{ textAlign:'center', padding:'60px 24px' }}>
                <div style={{ fontSize:40, marginBottom:12 }}>📂</div>
                <div style={{ color:T.textSub, fontSize:14 }}>Aucun article dans le catalogue</div>
              </Card>
            ):byCat.map(g=>(
              <Card key={g.cat} p={0}>
                <div style={{ padding:'12px 20px', background:'#FAFAFA', borderBottom:`1px solid ${T.border}`, borderRadius:'12px 12px 0 0', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ fontSize:14, fontWeight:700, color:T.text }}>{g.cat}</span>
                  <span style={{ fontSize:12, color:T.textMuted }}>{g.items.length} article{g.items.length!==1?'s':''}</span>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))', gap:12, padding:16 }}>
                  {g.items.map(item=>(
                    <div key={item.id} style={{ padding:'12px 14px', border:`1px solid ${T.border}`, borderRadius:10 }}>
                      <div style={{ fontSize:13, fontWeight:600, color:T.text, marginBottom:4 }}>{item.designation}</div>
                      <div style={{ fontSize:14, fontWeight:800, color:T.orange, marginBottom:4 }}>
                        {fmtFCFA(item.prix_unitaire)} / {item.unit}
                      </div>
                      {item.fournisseur&&<div style={{ fontSize:11, color:T.textMuted }}>{item.fournisseur}</div>}
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Form modal */}
      <Modal open={modalOpen} onClose={()=>setModalOpen(false)} title={editItem?'Modifier l\'article':'Ajouter au catalogue'}>
        <Field label="Désignation *">
          <input style={inp} value={form.designation} onChange={e=>setForm(f=>({...f,designation:e.target.value}))} placeholder="ex: Béton BPE B25"/>
        </Field>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <Field label="Catégorie *">
            <select style={inp} value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))}>
              {CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Unité *">
            <select style={inp} value={form.unit} onChange={e=>setForm(f=>({...f,unit:e.target.value}))}>
              {UNITS.map(u=><option key={u} value={u}>{u}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Prix unitaire (FCFA) *">
          <input style={inp} type="number" min="0" value={form.prix_unitaire} onChange={e=>setForm(f=>({...f,prix_unitaire:e.target.value}))} placeholder="85000"/>
          {form.prix_unitaire && <div style={{ fontSize:11, color:T.textMuted, marginTop:3 }}>= {fmtFCFA(form.prix_unitaire)}</div>}
        </Field>
        <Field label="Fournisseur habituel">
          <input style={inp} value={form.fournisseur} onChange={e=>setForm(f=>({...f,fournisseur:e.target.value}))} placeholder="ex: CIMAF Mali"/>
        </Field>
        <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:8 }}>
          <button onClick={()=>setModalOpen(false)} style={{ padding:'9px 20px', borderRadius:8, border:`1px solid ${T.border}`, background:'#fff', color:T.textSub, fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>Annuler</button>
          <button onClick={handleSave} style={{ padding:'9px 20px', borderRadius:8, background:T.orange, color:'#fff', fontSize:13, fontWeight:600, border:'none', cursor:'pointer', fontFamily:'inherit' }}>
            {editItem?'Mettre à jour':'Ajouter'}
          </button>
        </div>
      </Modal>
    </AppLayout>
  );
}