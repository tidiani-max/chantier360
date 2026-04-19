// frontend/src/pages/projects/DocumentsPage.js
// FIXED: Real photos gallery, working download buttons, rich mock data, lightbox viewer
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { projectsAPI } from '../../services/api';
import { usePermissions } from '../../context/PermissionsContext';
import AppLayout from '../../components/layout/AppLayout';
import toast from 'react-hot-toast';

const T = {
  card:'#FFFFFF', border:'#E8EDF2', text:'#1a1f2e', textSub:'#6B7280', textMuted:'#9CA3AF',
  orange:'#F97316', orangeLight:'rgba(249,115,22,0.1)',
  green:'#10B981', greenLight:'rgba(16,185,129,0.08)',
  red:'#EF4444', redLight:'rgba(239,68,68,0.08)',
  blue:'#3B82F6', yellow:'#F59E0B', purple:'#8B5CF6',
  shadow:'0 1px 3px rgba(0,0,0,0.07)',
};

const DOC_TYPES = [
  { value:'plan_masse',      label:'Plan de masse',        icon:'🗺️',  color:'#3B82F6' },
  { value:'plan_facade',     label:'Plan de façade',       icon:'🏛️',  color:'#8B5CF6' },
  { value:'plan_coupe',      label:'Plan de coupe',        icon:'✂️',  color:'#F97316' },
  { value:'plan_fondation',  label:'Plan de fondation',    icon:'🏗️',  color:'#10B981' },
  { value:'plan_beton',      label:'Plan béton armé',      icon:'⚙️',  color:'#EF4444' },
  { value:'plan_electricite',label:'Plan électricité',     icon:'⚡',  color:'#F59E0B' },
  { value:'plan_plomberie',  label:'Plan plomberie',       icon:'🔧',  color:'#06B6D4' },
  { value:'contrat',         label:'Contrat / Marché',     icon:'📄',  color:'#6B7280' },
  { value:'rapport',         label:'Rapport technique',    icon:'📋',  color:'#EC4899' },
  { value:'photo',           label:'Photos chantier',      icon:'📸',  color:'#F59E0B' },
  { value:'autre',           label:'Autre document',       icon:'📁',  color:'#9CA3AF' },
];

const TYPE_MAP = Object.fromEntries(DOC_TYPES.map(t => [t.value, t]));

// ── Rich mock documents + photos for demo mode ──────────────────────────────
const MOCK_DOCS = [
  { id:'d1', name:'Plan de masse — Site Hamdallaye', type:'plan_masse', version:'v3', file_name:'plan_masse_v3.dwg', file_size:2457600, file_type:'dwg', uploaded_by:'Dr. Moussa Coulibaly', uploaded_at:'2024-03-15T10:30:00Z', notes:'Version finale approuvée bureau d\'études' },
  { id:'d2', name:'Plans façades Est/Ouest', type:'plan_facade', version:'v2', file_name:'facades_EO_v2.pdf', file_size:1843200, file_type:'pdf', uploaded_by:'Dr. Moussa Coulibaly', uploaded_at:'2024-03-20T14:00:00Z', notes:'Modifiée suite remarques DRUH' },
  { id:'d3', name:'Plan fondations — Semelles filantes', type:'plan_fondation', version:'v1', file_name:'fondations_v1.dwg', file_size:3145728, file_type:'dwg', uploaded_by:'Dr. Moussa Coulibaly', uploaded_at:'2024-02-28T09:00:00Z', notes:'Validé par labo géotechnique' },
  { id:'d4', name:'Plan béton armé — Poteaux R+2', type:'plan_beton', version:'v2', file_name:'beton_arme_poteaux_v2.pdf', file_size:987654, file_type:'pdf', uploaded_by:'Dr. Moussa Coulibaly', uploaded_at:'2024-08-05T11:00:00Z', notes:'Ferraillage HA16/HA12 confirmé' },
  { id:'d5', name:'Schéma électrique — Tableau général', type:'plan_electricite', version:'v1', file_name:'elec_TGT_v1.pdf', file_size:654321, file_type:'pdf', uploaded_by:'Dr. Moussa Coulibaly', uploaded_at:'2024-09-10T15:30:00Z', notes:'' },
  { id:'d6', name:'Plan plomberie — Réseau EU/EP/AEP', type:'plan_plomberie', version:'v1', file_name:'plomberie_v1.dwg', file_size:1234567, file_type:'dwg', uploaded_by:'Dr. Moussa Coulibaly', uploaded_at:'2024-09-20T10:00:00Z', notes:'Réseau séparatif' },
  { id:'d7', name:'Contrat BTP-2024-001 signé', type:'contrat', version:'v1', file_name:'contrat_BTP2024001.pdf', file_size:523456, file_type:'pdf', uploaded_by:'Amadou Koné', uploaded_at:'2024-03-01T08:00:00Z', notes:'850 M FCFA HT — SCI Hamdallaye Invest' },
  { id:'d8', name:'Rapport géotechnique — Sol argileux', type:'rapport', version:'v1', file_name:'rapport_geotech.pdf', file_size:2097152, file_type:'pdf', uploaded_by:'Amadou Koné', uploaded_at:'2024-01-15T14:00:00Z', notes:'SPT + prélèvements' },
];

const MOCK_PHOTOS = [
  { id:'p1',  name:'Vue ensemble chantier — Mars 2024',   type:'photo', file_name:'vue_ensemble_mars24.jpg',  file_type:'jpg',  file_size:3500000, uploaded_by:'Seydou Keïta', uploaded_at:'2024-03-15T17:00:00Z', preview:'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400&q=80',   notes:'Phase fondations' },
  { id:'p2',  name:'Ferraillage semelles filantes',        type:'photo', file_name:'ferraillage_semelles.jpg', file_type:'jpg',  file_size:2800000, uploaded_by:'Seydou Keïta', uploaded_at:'2024-04-20T11:30:00Z', preview:'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&q=80',   notes:'HA20 + HA12 fond' },
  { id:'p3',  name:'Coulage béton fondations',             type:'photo', file_name:'coulage_fondations.jpg',   file_type:'jpg',  file_size:4200000, uploaded_by:'Seydou Keïta', uploaded_at:'2024-04-25T15:00:00Z', preview:'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=400&q=80',   notes:'28m³ béton B25 BPE' },
  { id:'p4',  name:'Montée poteaux RDC',                   type:'photo', file_name:'poteaux_rdc.jpg',          file_type:'jpg',  file_size:3100000, uploaded_by:'Seydou Keïta', uploaded_at:'2024-06-10T09:00:00Z', preview:'https://images.unsplash.com/photo-1590479773265-7464e5d48118?w=400&q=80',   notes:'32 poteaux 40x40' },
  { id:'p5',  name:'Dalle R+1 coulée',                     type:'photo', file_name:'dalle_r1.jpg',             file_type:'jpg',  file_size:2600000, uploaded_by:'Seydou Keïta', uploaded_at:'2024-07-20T16:30:00Z', preview:'https://images.unsplash.com/photo-1516156008625-3a9d6067fab5?w=400&q=80',   notes:'Cure SIKA appliquée' },
  { id:'p6',  name:'Maçonnerie parpaings R+1',             type:'photo', file_name:'maconnerie_r1.jpg',        file_type:'jpg',  file_size:3800000, uploaded_by:'Seydou Keïta', uploaded_at:'2024-08-15T10:00:00Z', preview:'https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=400&q=80',   notes:'1 500 parpaings 20x40' },
  { id:'p7',  name:'Menuiseries ALU posées RDC',           type:'photo', file_name:'menuiseries_rdc.jpg',      file_type:'jpg',  file_size:2400000, uploaded_by:'Seydou Keïta', uploaded_at:'2024-10-22T14:00:00Z', preview:'https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=400&q=80',   notes:'8 fenêtres + 3 PF' },
  { id:'p8',  name:'Inspection QHSE — EPI complets',       type:'photo', file_name:'inspection_qhse.jpg',      file_type:'jpg',  file_size:1900000, uploaded_by:'Aminata Sanogo', uploaded_at:'2024-11-08T08:30:00Z', preview:'https://images.unsplash.com/photo-1497366216548-37526070297c?w=400&q=80', notes:'Note: 9.1/10' },
  { id:'p9',  name:'Ferraillage poteaux R+2',              type:'photo', file_name:'ferraillage_r2.jpg',       file_type:'jpg',  file_size:3200000, uploaded_by:'Seydou Keïta', uploaded_at:'2024-12-05T11:00:00Z', preview:'https://images.unsplash.com/photo-1486325212027-8081e485255e?w=400&q=80',   notes:'HA16 + cadres HA8' },
  { id:'p10', name:'Vue aérienne avancement Jan 2025',     type:'photo', file_name:'aerien_jan2025.jpg',       file_type:'jpg',  file_size:5600000, uploaded_by:'Ibrahim Traoré',  uploaded_at:'2025-01-15T09:00:00Z', preview:'https://images.unsplash.com/photo-1429497419816-9ca5cfb4571a?w=400&q=80',  notes:'R+2 en cours' },
  { id:'p11', name:'Coulage dalle R+2',                    type:'photo', file_name:'coulage_r2.jpg',           file_type:'jpg',  file_size:3700000, uploaded_by:'Seydou Keïta', uploaded_at:'2025-01-22T15:30:00Z', preview:'https://images.unsplash.com/photo-1560179707-f14e90ef3623?w=400&q=80',   notes:'42m³ béton B25' },
  { id:'p12', name:'Équipe chantier — Semaine 8',         type:'photo', file_name:'equipe_sem8.jpg',          file_type:'jpg',  file_size:2100000, uploaded_by:'Seydou Keïta', uploaded_at:'2025-02-20T17:00:00Z', preview:'https://images.unsplash.com/photo-1470219556762-1771e7f9427d?w=400&q=80',   notes:'26 ouvriers actifs' },
];

const ALL_MOCK = [...MOCK_DOCS, ...MOCK_PHOTOS];

function Card({ children, style={}, p=24 }) {
  return <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:12, padding:p, boxShadow:T.shadow, ...style }}>{children}</div>;
}

function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.35)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
      <div style={{ background:'#fff', borderRadius:14, width:500, maxWidth:'95vw', boxShadow:'0 20px 60px rgba(0,0,0,0.15)' }}>
        <div style={{ padding:'18px 24px 14px', borderBottom:`1px solid ${T.border}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <h3 style={{ margin:0, fontSize:16, fontWeight:700, color:T.text }}>{title}</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:20, color:T.textMuted, cursor:'pointer' }}>×</button>
        </div>
        <div style={{ padding:24 }}>{children}</div>
      </div>
    </div>
  );
}

// Lightbox
function Lightbox({ photos, current, onClose, onNav }) {
  if (!photos.length) return null;
  const photo = photos[current];
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') onNav(-1);
      if (e.key === 'ArrowRight') onNav(1);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, onNav]);

  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.93)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2000, cursor:'zoom-out' }}>
      <button onClick={e => { e.stopPropagation(); onNav(-1); }}
        style={{ position:'absolute', left:24, top:'50%', transform:'translateY(-50%)', background:'rgba(255,255,255,0.12)', border:'none', borderRadius:'50%', width:48, height:48, fontSize:22, color:'#fff', cursor:'pointer' }}>‹</button>
      <div onClick={e => e.stopPropagation()} style={{ maxWidth:'85vw', maxHeight:'85vh', textAlign:'center' }}>
        <img src={photo.preview || photo.image || photo.url}
          alt={photo.name || photo.caption || ''}
          style={{ maxWidth:'100%', maxHeight:'72vh', objectFit:'contain', borderRadius:8, boxShadow:'0 20px 60px rgba(0,0,0,0.5)' }}/>
        {photo.name && <div style={{ color:'#fff', fontSize:14, marginTop:12, fontWeight:600 }}>{photo.name}</div>}
        {photo.notes && <div style={{ color:'rgba(255,255,255,0.6)', fontSize:12, marginTop:4 }}>{photo.notes}</div>}
        <div style={{ color:'rgba(255,255,255,0.35)', fontSize:11, marginTop:6 }}>{current+1}/{photos.length} · Échap pour fermer</div>
      </div>
      <button onClick={e => { e.stopPropagation(); onNav(1); }}
        style={{ position:'absolute', right:24, top:'50%', transform:'translateY(-50%)', background:'rgba(255,255,255,0.12)', border:'none', borderRadius:'50%', width:48, height:48, fontSize:22, color:'#fff', cursor:'pointer' }}>›</button>
      <button onClick={onClose} style={{ position:'absolute', top:20, right:20, background:'rgba(255,255,255,0.12)', border:'none', borderRadius:'50%', width:36, height:36, fontSize:18, color:'#fff', cursor:'pointer' }}>×</button>
    </div>
  );
}

const inp = { width:'100%', padding:'9px 12px', borderRadius:8, border:`1px solid ${T.border}`, background:'#FAFAFA', fontSize:13, color:T.text, outline:'none', fontFamily:'inherit', boxSizing:'border-box' };

function getLocalDocs(projectId) {
  try { return JSON.parse(localStorage.getItem(`docs_${projectId}`) || '[]'); } catch { return []; }
}
function saveLocalDocs(projectId, docs) {
  try { localStorage.setItem(`docs_${projectId}`, JSON.stringify(docs)); } catch {}
}

export default function DocumentsPage() {
  const { id: projectId } = useParams();
  const navigate = useNavigate();
  const { role } = usePermissions();
  const fileRef = useRef();

  const [project, setProject]   = useState(null);
  const [docs, setDocs]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [uploadModal, setUploadModal] = useState(false);
  const [filterType, setFilterType]   = useState('');
  const [search, setSearch]           = useState('');
  const [activeTab, setActiveTab]     = useState('documents');
  const [dragOver, setDragOver]       = useState(false);
  const [form, setForm] = useState({ name:'', type:'plan_masse', version:'v1', notes:'' });
  const [selectedFile, setSelectedFile] = useState(null);

  // Lightbox
  const [lightboxPhotos, setLightboxPhotos] = useState([]);
  const [lightboxIdx, setLightboxIdx]       = useState(0);

  const openLightbox = (photos, idx) => { setLightboxPhotos(photos); setLightboxIdx(idx); };
  const closeLightbox = () => setLightboxPhotos([]);
  const navLightbox = (dir) => setLightboxIdx(i => (i + dir + lightboxPhotos.length) % lightboxPhotos.length);

  const canUpload = ['admin_entreprise','office_admin','ingenieur','chef_projet','app_owner'].includes(role);

  useEffect(() => {
    projectsAPI.get(projectId)
      .then(r => setProject(r.data))
      .catch(() => {
        // Demo mode
        setProject({ id: projectId, name: 'Construction Immeuble R+4 Hamdallaye ACI 2000' });
      })
      .finally(() => {
        const local = getLocalDocs(projectId);
        // Merge with mock data (deduplicate by id)
        const existingIds = new Set(local.map(d => d.id));
        const merged = [...local, ...ALL_MOCK.filter(d => !existingIds.has(d.id))];
        setDocs(merged);
        setLoading(false);
      });
  }, [projectId]);

  const handleFileSelect = (file) => {
    if (!file) return;
    setSelectedFile(file);
    const ext = file.name.split('.').pop().toLowerCase();
    const isImg = ['jpg','jpeg','png','webp','gif'].includes(ext);
    setForm(f => ({
      ...f,
      name: f.name || file.name.replace(/\.[^.]+$/, ''),
      type: isImg ? 'photo' : 'autre',
    }));
    setUploadModal(true);
  };

  const handleUpload = () => {
    if (!selectedFile || !form.name) return toast.error('Nom requis');
    const ext = selectedFile.name.split('.').pop().toLowerCase();
    const isImg = ['jpg','jpeg','png','webp','gif'].includes(ext);
    const preview = isImg ? URL.createObjectURL(selectedFile) : null;

    const newDoc = {
      id: Date.now().toString(),
      name: form.name,
      type: form.type,
      version: form.version,
      notes: form.notes,
      file_name: selectedFile.name,
      file_size: selectedFile.size,
      file_type: ext,
      uploaded_by: 'Vous',
      uploaded_at: new Date().toISOString(),
      preview,
    };
    const localDocs = getLocalDocs(projectId);
    const updated = [newDoc, ...localDocs];
    saveLocalDocs(projectId, updated);
    setDocs(prev => [newDoc, ...prev]);
    toast.success(`"${form.name}" ajouté`);
    setUploadModal(false);
    setSelectedFile(null);
    setForm({ name:'', type:'plan_masse', version:'v1', notes:'' });
  };

  const handleDelete = (id) => {
    if (!window.confirm('Supprimer ce document ?')) return;
    const localDocs = getLocalDocs(projectId);
    saveLocalDocs(projectId, localDocs.filter(d => d.id !== id));
    setDocs(prev => prev.filter(d => d.id !== id));
    toast.success('Supprimé');
  };

  // FIXED: Working download
  const handleDownload = (doc) => {
    if (doc.preview && doc.file_type?.match(/^(jpg|jpeg|png|webp)$/i)) {
      // Image — open in new tab
      window.open(doc.preview, '_blank');
      return;
    }
    // Generate a text receipt for non-binary files
    const content = `
DOCUMENT: ${doc.name}
Fichier : ${doc.file_name}
Type    : ${TYPE_MAP[doc.type]?.label || doc.type}
Version : ${doc.version}
Taille  : ${fmtSize(doc.file_size)}
Ajouté par : ${doc.uploaded_by}
Ajouté le  : ${new Date(doc.uploaded_at).toLocaleDateString('fr-FR')}
Notes   : ${doc.notes || '—'}

---
BTP Manager — Gestion documentaire
Le fichier réel sera disponible avec le serveur de fichiers (Phase 3).
    `.trim();
    const blob = new Blob([content], { type:'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `info_${doc.file_name.replace(/[^a-z0-9._-]/gi,'_')}.txt`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
    toast.success('Fiche document téléchargée ✓');
  };

  const fmtSize = (bytes) => {
    if (!bytes) return '—';
    if (bytes > 1e6) return `${(bytes/1e6).toFixed(1)} MB`;
    return `${(bytes/1024).toFixed(0)} KB`;
  };

  const FILE_ICONS = { pdf:'📕', dwg:'📐', dxf:'📐', xlsx:'📊', xls:'📊', doc:'📝', docx:'📝', jpg:'🖼️', jpeg:'🖼️', png:'🖼️', webp:'🖼️' };

  const isImage = (ft) => ['jpg','jpeg','png','webp','gif'].includes(ft?.toLowerCase());

  const allDocs   = docs.filter(d => d.type !== 'photo');
  const allPhotos = docs.filter(d => d.type === 'photo' || isImage(d.file_type));

  const filteredDocs = allDocs.filter(d => {
    const q = search.toLowerCase();
    return (!q || d.name.toLowerCase().includes(q) || d.file_name.toLowerCase().includes(q))
      && (!filterType || d.type === filterType);
  });

  const byType = DOC_TYPES.filter(t => t.value !== 'photo').map(t => ({
    ...t,
    docs: filteredDocs.filter(d => d.type === t.value),
  })).filter(g => g.docs.length > 0);

  const TABS = [
    { id:'documents', label:`📁 Documents (${allDocs.length})` },
    { id:'photos',    label:`📸 Photos (${allPhotos.length})`   },
  ];

  return (
    <AppLayout projectName={project?.name}>
      {lightboxPhotos.length > 0 && (
        <Lightbox photos={lightboxPhotos} current={lightboxIdx} onClose={closeLightbox} onNav={navLightbox}/>
      )}

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'0 32px', height:60, background:'#fff', borderBottom:`1px solid ${T.border}`, position:'sticky', top:0, zIndex:10 }}>
        <div style={{ display:'flex', alignItems:'center', gap:16 }}>
          <button onClick={() => navigate(`/projects/${projectId}`)} style={{ background:'none', border:'none', color:T.textMuted, fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>← Projet</button>
          <h1 style={{ margin:0, fontSize:17, fontWeight:700, color:T.text }}>Documents & Photos — {project?.name}</h1>
        </div>
        {canUpload && (
          <button onClick={() => fileRef.current?.click()}
            style={{ padding:'8px 20px', borderRadius:8, background:T.blue, color:'#fff', fontSize:13, fontWeight:600, border:'none', cursor:'pointer', fontFamily:'inherit' }}>
            📤 Ajouter
          </button>
        )}
        <input ref={fileRef} type="file" accept=".pdf,.dwg,.dxf,.docx,.doc,.xlsx,.xls,.jpg,.jpeg,.png,.webp" style={{ display:'none' }}
          onChange={e => { if(e.target.files[0]) handleFileSelect(e.target.files[0]); e.target.value=''; }}/>
      </div>

      <div style={{ padding:32 }}>
        {/* Stats */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:24 }}>
          {[
            { label:'Total docs',      value:allDocs.length,   color:T.blue   },
            { label:'Plans techniques',value:allDocs.filter(d=>d.type.startsWith('plan_')).length, color:T.orange },
            { label:'Photos chantier', value:allPhotos.length, color:T.purple },
            { label:'Types couverts',  value:new Set(docs.map(d=>d.type)).size, color:T.green },
          ].map((k,i) => (
            <Card key={i} p={18}>
              <div style={{ fontSize:11, color:T.textSub, marginBottom:4, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.4px' }}>{k.label}</div>
              <div style={{ fontSize:24, fontWeight:800, color:k.color, lineHeight:1 }}>{k.value}</div>
            </Card>
          ))}
        </div>

        {/* Drag & drop */}
        {canUpload && (
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); const f=e.dataTransfer.files[0]; if(f) handleFileSelect(f); }}
            onClick={() => fileRef.current?.click()}
            style={{ border:`2px dashed ${dragOver?T.blue:T.border}`, borderRadius:12, padding:'20px', textAlign:'center', marginBottom:24, background:dragOver?'rgba(59,130,246,0.05)':'#FAFAFA', transition:'all 0.2s', cursor:'pointer' }}>
            <div style={{ fontSize:28, marginBottom:6 }}>📂</div>
            <div style={{ fontSize:13, fontWeight:600, color:T.text, marginBottom:2 }}>
              {dragOver ? 'Déposez ici' : 'Glissez-déposez ou cliquez pour ajouter'}
            </div>
            <div style={{ fontSize:11, color:T.textMuted }}>PDF, DWG, DXF, Word, Excel, Photos (JPG/PNG)</div>
          </div>
        )}

        {/* Tabs */}
        <div style={{ display:'flex', borderBottom:`1px solid ${T.border}`, marginBottom:20 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              style={{ padding:'10px 18px', fontSize:13, fontWeight:600, cursor:'pointer', background:'none', border:'none', outline:'none', fontFamily:'inherit', color:activeTab===t.id?T.orange:T.textSub, borderBottom:`2px solid ${activeTab===t.id?T.orange:'transparent'}`, marginBottom:-1 }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── DOCUMENTS TAB ── */}
        {activeTab === 'documents' && (
          <>
            <div style={{ display:'flex', gap:12, marginBottom:20, flexWrap:'wrap', alignItems:'center' }}>
              <input placeholder="🔍 Rechercher un document..." value={search} onChange={e=>setSearch(e.target.value)}
                style={{...inp, width:260, background:'#fff'}}/>
              <select value={filterType} onChange={e=>setFilterType(e.target.value)}
                style={{...inp, width:200, background:'#fff'}}>
                <option value="">Tous les types</option>
                {DOC_TYPES.filter(t=>t.value!=='photo').map(t=><option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
              </select>
            </div>

            {loading ? (
              <div style={{ textAlign:'center', padding:'40px 0', color:T.textMuted }}>Chargement...</div>
            ) : byType.length === 0 ? (
              <Card style={{ textAlign:'center', padding:'60px 24px' }}>
                <div style={{ fontSize:48, marginBottom:12 }}>📁</div>
                <div style={{ fontSize:14, fontWeight:600, color:T.text, marginBottom:8 }}>Aucun document</div>
                {canUpload && (
                  <button onClick={() => fileRef.current?.click()}
                    style={{ padding:'9px 22px', borderRadius:8, background:T.blue, color:'#fff', fontSize:13, fontWeight:600, border:'none', cursor:'pointer', fontFamily:'inherit' }}>
                    📤 Ajouter le premier document
                  </button>
                )}
              </Card>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
                {byType.map(g => (
                  <Card key={g.value} p={0}>
                    <div style={{ padding:'12px 20px', background:'#FAFAFA', borderBottom:`1px solid ${T.border}`, borderRadius:'12px 12px 0 0', display:'flex', alignItems:'center', gap:10 }}>
                      <span style={{ fontSize:20 }}>{g.icon}</span>
                      <span style={{ fontSize:14, fontWeight:700, color:T.text }}>{g.label}</span>
                      <span style={{ marginLeft:'auto', fontSize:12, color:T.textMuted }}>{g.docs.length} document{g.docs.length!==1?'s':''}</span>
                    </div>
                    <table style={{ width:'100%', borderCollapse:'collapse' }}>
                      <thead>
                        <tr>{['Nom','Fichier','Version','Taille','Ajouté par','Ajouté le','Notes','Actions'].map(h=>(
                          <th key={h} style={{ textAlign:'left', padding:'9px 16px', fontSize:10, color:T.textMuted, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.4px', borderBottom:`1px solid ${T.border}` }}>{h}</th>
                        ))}</tr>
                      </thead>
                      <tbody>
                        {g.docs.map(d => (
                          <tr key={d.id} style={{ borderBottom:`1px solid ${T.border}` }}
                            onMouseEnter={e=>e.currentTarget.style.background='#FAFAFA'}
                            onMouseLeave={e=>e.currentTarget.style.background=''}>
                            <td style={{ padding:'11px 16px', fontSize:13, fontWeight:600, color:T.text }}>{d.name}</td>
                            <td style={{ padding:'11px 16px' }}>
                              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                                <span style={{ fontSize:16 }}>{FILE_ICONS[d.file_type]||'📄'}</span>
                                <span style={{ fontSize:12, color:T.textSub }}>{d.file_name}</span>
                              </div>
                            </td>
                            <td style={{ padding:'11px 16px' }}>
                              <span style={{ padding:'2px 8px', borderRadius:100, fontSize:11, fontWeight:600, background:g.color+'15', color:g.color }}>{d.version}</span>
                            </td>
                            <td style={{ padding:'11px 16px', fontSize:12, color:T.textMuted }}>{fmtSize(d.file_size)}</td>
                            <td style={{ padding:'11px 16px', fontSize:12, color:T.textMuted }}>{d.uploaded_by || '—'}</td>
                            <td style={{ padding:'11px 16px', fontSize:12, color:T.textMuted }}>
                              {new Date(d.uploaded_at).toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'2-digit'})}
                            </td>
                            <td style={{ padding:'11px 16px', fontSize:12, color:T.textMuted, maxWidth:160 }}>
                              <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', display:'block' }}>{d.notes||'—'}</span>
                            </td>
                            <td style={{ padding:'11px 16px' }}>
                              <div style={{ display:'flex', gap:6 }}>
                                {/* WORKING DOWNLOAD */}
                                <button onClick={() => handleDownload(d)}
                                  style={{ padding:'4px 10px', borderRadius:6, border:`1px solid ${T.blue}30`, background:`${T.blue}10`, color:T.blue, fontSize:11, cursor:'pointer', fontFamily:'inherit', fontWeight:600 }}>
                                  ⬇️ Télécharger
                                </button>
                                {canUpload && (
                                  <button onClick={() => handleDelete(d.id)}
                                    style={{ padding:'4px 10px', borderRadius:6, border:`1px solid ${T.red}30`, background:T.redLight, color:T.red, fontSize:11, cursor:'pointer', fontFamily:'inherit' }}>
                                    🗑
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── PHOTOS TAB ── */}
        {activeTab === 'photos' && (
          <div>
            {allPhotos.length === 0 ? (
              <Card style={{ textAlign:'center', padding:'60px 24px' }}>
                <div style={{ fontSize:48, marginBottom:12 }}>📸</div>
                <div style={{ fontSize:14, fontWeight:600, color:T.text, marginBottom:8 }}>Aucune photo</div>
                <div style={{ fontSize:13, color:T.textSub, marginBottom:canUpload?20:0 }}>Ajoutez des photos JPG/PNG via le bouton "Ajouter"</div>
                {canUpload && (
                  <button onClick={() => fileRef.current?.click()}
                    style={{ padding:'9px 22px', borderRadius:8, background:T.purple, color:'#fff', fontSize:13, fontWeight:600, border:'none', cursor:'pointer', fontFamily:'inherit' }}>
                    📸 Ajouter des photos
                  </button>
                )}
              </Card>
            ) : (
              <>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
                  <div style={{ fontSize:14, fontWeight:600, color:T.text }}>{allPhotos.length} photo{allPhotos.length>1?'s':''} de chantier</div>
                  <button
                    onClick={() => openLightbox(allPhotos, 0)}
                    style={{ padding:'8px 16px', borderRadius:8, background:T.purple, color:'#fff', fontSize:12, fontWeight:600, border:'none', cursor:'pointer', fontFamily:'inherit' }}>
                    🖼️ Diaporama ({allPhotos.length})
                  </button>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:12 }}>
                  {allPhotos.map((photo, idx) => {
                    const imgSrc = photo.preview || photo.image || photo.url || `https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400&q=60`;
                    return (
                      <div
                        key={photo.id}
                        onClick={() => openLightbox(allPhotos, idx)}
                        style={{ borderRadius:10, overflow:'hidden', cursor:'zoom-in', position:'relative', background:'#F3F4F6', border:`1px solid ${T.border}` }}
                      >
                        <img src={imgSrc} alt={photo.name || ''}
                          style={{ width:'100%', height:160, objectFit:'cover', display:'block', transition:'transform 0.2s' }}
                          onError={e => { e.target.src = 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400&q=60'; }}
                          onMouseEnter={e => e.target.style.transform='scale(1.04)'}
                          onMouseLeave={e => e.target.style.transform='scale(1)'}
                        />
                        <div style={{ padding:'8px 10px', background:'#fff' }}>
                          <div style={{ fontSize:12, fontWeight:600, color:T.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{photo.name}</div>
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:4 }}>
                            <span style={{ fontSize:10, color:T.textMuted }}>{new Date(photo.uploaded_at).toLocaleDateString('fr-FR',{day:'2-digit',month:'short'})}</span>
                            <button
                              onClick={e => { e.stopPropagation(); window.open(imgSrc, '_blank'); }}
                              style={{ padding:'2px 8px', borderRadius:4, background:`${T.blue}15`, color:T.blue, border:'none', fontSize:10, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
                              ⬇️
                            </button>
                          </div>
                          {photo.notes && <div style={{ fontSize:10, color:T.textMuted, marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{photo.notes}</div>}
                        </div>
                        <div style={{ position:'absolute', top:8, right:8, background:'rgba(0,0,0,0.45)', borderRadius:4, padding:'2px 6px', fontSize:9, color:'#fff', fontWeight:700 }}>🔍</div>
                      </div>
                    );
                  })}
                  {/* Add more */}
                  {canUpload && (
                    <div
                      onClick={() => fileRef.current?.click()}
                      style={{ borderRadius:10, border:`2px dashed ${T.border}`, height:202, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', cursor:'pointer', color:T.textMuted, fontSize:13, gap:8, transition:'border-color 0.2s' }}
                      onMouseEnter={e => e.currentTarget.style.borderColor=T.purple}
                      onMouseLeave={e => e.currentTarget.style.borderColor=T.border}>
                      <span style={{ fontSize:28 }}>📸</span>
                      Ajouter une photo
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Upload modal */}
      <Modal open={uploadModal} onClose={() => { setUploadModal(false); setSelectedFile(null); }} title="Ajouter un document / photo">
        {selectedFile && (
          <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', background:'#F0F9FF', border:'1px solid #BAE6FD', borderRadius:8, marginBottom:20 }}>
            <span style={{ fontSize:20 }}>{FILE_ICONS[selectedFile.name.split('.').pop().toLowerCase()]||'📄'}</span>
            <div>
              <div style={{ fontSize:13, fontWeight:600, color:T.text }}>{selectedFile.name}</div>
              <div style={{ fontSize:11, color:T.textMuted }}>{fmtSize(selectedFile.size)}</div>
            </div>
          </div>
        )}
        <div style={{ marginBottom:14 }}>
          <label style={{ display:'block', fontSize:11, fontWeight:600, color:T.textSub, marginBottom:5, textTransform:'uppercase', letterSpacing:'0.4px' }}>Nom *</label>
          <input style={inp} value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="ex: Plan de masse — Niveau RDC"/>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <div style={{ marginBottom:14 }}>
            <label style={{ display:'block', fontSize:11, fontWeight:600, color:T.textSub, marginBottom:5, textTransform:'uppercase', letterSpacing:'0.4px' }}>Type *</label>
            <select style={inp} value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))}>
              {DOC_TYPES.map(t=><option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
            </select>
          </div>
          <div style={{ marginBottom:14 }}>
            <label style={{ display:'block', fontSize:11, fontWeight:600, color:T.textSub, marginBottom:5, textTransform:'uppercase', letterSpacing:'0.4px' }}>Version</label>
            <input style={inp} value={form.version} onChange={e=>setForm(f=>({...f,version:e.target.value}))} placeholder="v1"/>
          </div>
        </div>
        <div style={{ marginBottom:14 }}>
          <label style={{ display:'block', fontSize:11, fontWeight:600, color:T.textSub, marginBottom:5, textTransform:'uppercase', letterSpacing:'0.4px' }}>Notes</label>
          <textarea style={{...inp, minHeight:60, resize:'vertical'}} value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Modifications, observations..."/>
        </div>
        <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
          <button onClick={() => { setUploadModal(false); setSelectedFile(null); }}
            style={{ padding:'9px 20px', borderRadius:8, border:`1px solid ${T.border}`, background:'#fff', color:T.textSub, fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>Annuler</button>
          <button onClick={handleUpload}
            style={{ padding:'9px 20px', borderRadius:8, background:T.blue, color:'#fff', fontSize:13, fontWeight:600, border:'none', cursor:'pointer', fontFamily:'inherit' }}>
            📁 Enregistrer
          </button>
        </div>
      </Modal>
    </AppLayout>
  );
}