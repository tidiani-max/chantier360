// frontend/src/pages/projects/DocumentsPage.js
// Ingénieur (G) + Directeur (B) — plans/DWG/PDF per project with versioning
// Backend: stores in contracts table (file upload) — dedicated model in Phase 3
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
  blue:'#3B82F6', yellow:'#F59E0B', shadow:'0 1px 3px rgba(0,0,0,0.07)',
};

const DOC_TYPES = [
  { value:'plan_masse',     label:'Plan de masse',        icon:'🗺️',  color:'#3B82F6' },
  { value:'plan_facade',    label:'Plan de façade',       icon:'🏛️',  color:'#8B5CF6' },
  { value:'plan_coupe',     label:'Plan de coupe',        icon:'✂️',  color:'#F97316' },
  { value:'plan_fondation', label:'Plan de fondation',    icon:'🏗️',  color:'#10B981' },
  { value:'plan_beton',     label:'Plan béton armé',      icon:'⚙️',  color:'#EF4444' },
  { value:'plan_electricite',label:'Plan électricité',    icon:'⚡',  color:'#F59E0B' },
  { value:'plan_plomberie', label:'Plan plomberie',       icon:'🔧',  color:'#06B6D4' },
  { value:'contrat',        label:'Contrat / Marché',     icon:'📄',  color:'#6B7280' },
  { value:'rapport',        label:'Rapport technique',    icon:'📋',  color:'#EC4899' },
  { value:'autre',          label:'Autre document',       icon:'📁',  color:'#9CA3AF' },
];

const TYPE_MAP = Object.fromEntries(DOC_TYPES.map(t=>[t.value,t]));

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

const inp = { width:'100%', padding:'9px 12px', borderRadius:8, border:`1px solid ${T.border}`, background:'#FAFAFA', fontSize:13, color:T.text, outline:'none', fontFamily:'inherit', boxSizing:'border-box' };

// Documents stored in localStorage per project (backend model Phase 3)
function getDocs(projectId) {
  try { return JSON.parse(localStorage.getItem(`docs_${projectId}`) || '[]'); } catch { return []; }
}
function saveDocs(projectId, docs) {
  try { localStorage.setItem(`docs_${projectId}`, JSON.stringify(docs)); } catch {}
}

export default function DocumentsPage() {
  const { id: projectId } = useParams();
  const navigate = useNavigate();
  const { role } = usePermissions();
  const fileRef = useRef();

  const [project, setProject]     = useState(null);
  const [docs, setDocs]           = useState([]);
  const [loading, setLoading]     = useState(true);
  const [uploadModal, setUploadModal] = useState(false);
  const [filterType, setFilterType]   = useState('');
  const [search, setSearch]           = useState('');
  const [dragOver, setDragOver]       = useState(false);
  const [form, setForm]               = useState({ name:'', type:'plan_masse', version:'v1', notes:'' });
  const [selectedFile, setSelectedFile] = useState(null);

  const canUpload = ['admin_entreprise','office_admin','ingenieur','chef_projet','app_owner'].includes(role);

  useEffect(() => {
    projectsAPI.get(projectId)
      .then(r => setProject(r.data))
      .catch(() => { toast.error('Projet introuvable'); navigate('/projects'); })
      .finally(() => {
        setDocs(getDocs(projectId));
        setLoading(false);
      });
  }, [projectId]);

  const handleFileSelect = (file) => {
    if (!file) return;
    setSelectedFile(file);
    // Auto-fill name from filename
    const name = file.name.replace(/\.[^.]+$/, '');
    setForm(f => ({ ...f, name: f.name || name }));
    setUploadModal(true);
  };

  const handleUpload = () => {
    if (!selectedFile || !form.name) return toast.error('Nom requis');
    const newDoc = {
      id: Date.now().toString(),
      name: form.name,
      type: form.type,
      version: form.version,
      notes: form.notes,
      file_name: selectedFile.name,
      file_size: selectedFile.size,
      file_type: selectedFile.name.split('.').pop().toLowerCase(),
      uploaded_by: 'Vous',
      uploaded_at: new Date().toISOString(),
    };
    const updated = [newDoc, ...docs];
    setDocs(updated);
    saveDocs(projectId, updated);
    toast.success(`"${form.name}" ajouté`);
    setUploadModal(false);
    setSelectedFile(null);
    setForm({ name:'', type:'plan_masse', version:'v1', notes:'' });
  };

  const handleDelete = (id) => {
    if (!window.confirm('Supprimer ce document ?')) return;
    const updated = docs.filter(d => d.id !== id);
    setDocs(updated);
    saveDocs(projectId, updated);
    toast.success('Document supprimé');
  };

  const filtered = docs.filter(d => {
    const q = search.toLowerCase();
    const matchSearch = !q || d.name.toLowerCase().includes(q) || d.file_name.toLowerCase().includes(q);
    const matchType = !filterType || d.type === filterType;
    return matchSearch && matchType;
  });

  // Group by type
  const byType = DOC_TYPES.map(t => ({
    ...t,
    docs: filtered.filter(d => d.type === t.value),
  })).filter(g => g.docs.length > 0);

  const fmtSize = (bytes) => {
    if (!bytes) return '—';
    if (bytes > 1e6) return `${(bytes/1e6).toFixed(1)} MB`;
    return `${(bytes/1024).toFixed(0)} KB`;
  };

  const FILE_ICONS = { pdf:'📕', dwg:'📐', dxf:'📐', xlsx:'📊', xls:'📊', doc:'📝', docx:'📝', jpg:'🖼️', jpeg:'🖼️', png:'🖼️' };

  return (
    <AppLayout projectName={project?.name}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'0 32px', height:60, background:'#fff', borderBottom:`1px solid ${T.border}`, position:'sticky', top:0, zIndex:10 }}>
        <div style={{ display:'flex', alignItems:'center', gap:16 }}>
          <button onClick={() => navigate(`/projects/${projectId}`)} style={{ background:'none', border:'none', color:T.textMuted, fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>← Projet</button>
          <h1 style={{ margin:0, fontSize:17, fontWeight:700, color:T.text }}>Documents & Plans — {project?.name}</h1>
        </div>
        {canUpload && (
          <button onClick={() => fileRef.current?.click()}
            style={{ padding:'8px 20px', borderRadius:8, background:T.blue, color:'#fff', fontSize:13, fontWeight:600, border:'none', cursor:'pointer', fontFamily:'inherit' }}>
            📤 Ajouter un document
          </button>
        )}
        <input ref={fileRef} type="file" accept=".pdf,.dwg,.dxf,.docx,.doc,.xlsx,.xls,.jpg,.jpeg,.png" style={{ display:'none' }}
          onChange={e => { if(e.target.files[0]) handleFileSelect(e.target.files[0]); e.target.value=''; }}/>
      </div>

      <div style={{ padding:32 }}>
        {/* Stats */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:24 }}>
          {[
            { label:'Total documents', value:docs.length,                                            color:T.blue   },
            { label:'Plans techniques', value:docs.filter(d=>d.type.startsWith('plan_')).length,    color:T.orange },
            { label:'Dernière mise à jour', value:docs.length>0?new Date(docs[0].uploaded_at).toLocaleDateString('fr-FR',{day:'2-digit',month:'short'}):'—', color:T.green },
            { label:'Types de documents', value:new Set(docs.map(d=>d.type)).size,                   color:T.purple||'#8B5CF6' },
          ].map((k,i)=>(
            <Card key={i} p={18}>
              <div style={{ fontSize:11, color:T.textSub, marginBottom:4, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.4px' }}>{k.label}</div>
              <div style={{ fontSize:24, fontWeight:800, color:k.color, lineHeight:1 }}>{k.value}</div>
            </Card>
          ))}
        </div>

        {/* Drag & drop zone */}
        {canUpload && (
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); const f=e.dataTransfer.files[0]; if(f) handleFileSelect(f); }}
            style={{ border:`2px dashed ${dragOver?T.blue:T.border}`, borderRadius:12, padding:'24px', textAlign:'center', marginBottom:24, background:dragOver?T.blueLight:'#FAFAFA', transition:'all 0.2s', cursor:'pointer' }}
            onClick={() => fileRef.current?.click()}
          >
            <div style={{ fontSize:36, marginBottom:8 }}>📂</div>
            <div style={{ fontSize:14, fontWeight:600, color:T.text, marginBottom:4 }}>
              {dragOver ? 'Déposez le fichier ici' : 'Glissez-déposez un document ou cliquez'}
            </div>
            <div style={{ fontSize:12, color:T.textMuted }}>PDF, DWG, DXF, Word, Excel, Images</div>
          </div>
        )}

        {/* Filters */}
        <div style={{ display:'flex', gap:12, marginBottom:20, flexWrap:'wrap', alignItems:'center' }}>
          <input placeholder="🔍 Rechercher un document..." value={search} onChange={e=>setSearch(e.target.value)}
            style={{...inp, width:260, background:'#fff'}}/>
          <select value={filterType} onChange={e=>setFilterType(e.target.value)}
            style={{...inp, width:200, background:'#fff'}}>
            <option value="">Tous les types</option>
            {DOC_TYPES.map(t=><option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
          </select>
        </div>

        {loading ? (
          <div style={{ textAlign:'center', padding:'40px 0', color:T.textMuted }}>Chargement...</div>
        ) : docs.length === 0 ? (
          <Card style={{ textAlign:'center', padding:'60px 24px' }}>
            <div style={{ fontSize:48, marginBottom:12 }}>📁</div>
            <div style={{ fontSize:14, fontWeight:600, color:T.text, marginBottom:8 }}>Aucun document</div>
            <div style={{ fontSize:13, color:T.textSub, marginBottom:canUpload?20:0 }}>Ajoutez des plans et documents techniques pour ce projet</div>
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
                    <tr>{['Nom','Fichier','Version','Taille','Ajouté le','Notes',''].map(h=>(
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
                        <td style={{ padding:'11px 16px', fontSize:12, color:T.textMuted }}>{new Date(d.uploaded_at).toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'2-digit'})}</td>
                        <td style={{ padding:'11px 16px', fontSize:12, color:T.textMuted, maxWidth:180 }}>
                          <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', display:'block' }}>{d.notes||'—'}</span>
                        </td>
                        <td style={{ padding:'11px 16px' }}>
                          {canUpload && (
                            <button onClick={() => handleDelete(d.id)}
                              style={{ padding:'4px 10px', borderRadius:6, border:`1px solid ${T.red}30`, background:T.redLight, color:T.red, fontSize:11, cursor:'pointer', fontFamily:'inherit' }}>🗑</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Upload modal */}
      <Modal open={uploadModal} onClose={() => { setUploadModal(false); setSelectedFile(null); }} title="Ajouter un document">
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
          <label style={{ display:'block', fontSize:11, fontWeight:600, color:T.textSub, marginBottom:5, textTransform:'uppercase', letterSpacing:'0.4px' }}>Nom du document *</label>
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
          <textarea style={{...inp, minHeight:60, resize:'vertical'}} value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Modifications par rapport à la version précédente..."/>
        </div>
        <div style={{ padding:'10px 14px', background:'#FFFBEB', border:'1px solid #FDE68A', borderRadius:8, fontSize:12, color:'#92400E', marginBottom:16 }}>
          ℹ️ Le stockage des fichiers sera disponible avec le serveur de fichiers en Phase 3. Les métadonnées sont enregistrées localement.
        </div>
        <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
          <button onClick={() => { setUploadModal(false); setSelectedFile(null); }} style={{ padding:'9px 20px', borderRadius:8, border:`1px solid ${T.border}`, background:'#fff', color:T.textSub, fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>Annuler</button>
          <button onClick={handleUpload} style={{ padding:'9px 20px', borderRadius:8, background:T.blue, color:'#fff', fontSize:13, fontWeight:600, border:'none', cursor:'pointer', fontFamily:'inherit' }}>
            📁 Enregistrer
          </button>
        </div>
      </Modal>
    </AppLayout>
  );
}