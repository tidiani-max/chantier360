// frontend/src/pages/reports/RapportsPage.js
// FIXED: Working download buttons, photos gallery, rich mock data for all roles
import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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

const WEATHER_ICONS = { ensoleille:'☀️', nuageux:'☁️', pluvieux:'🌧️', venteux:'💨', orageux:'⛈️' };

// ── Rich mock data for demo / offline mode ─────────────────────────────────
const MOCK_PHOTOS = [
  { id:'ph1', url:'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400&q=80', caption:'Ferraillage poteaux R+2 - côté nord', date:'2025-01-15' },
  { id:'ph2', url:'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&q=80', caption:'Coffrage dalle R+1', date:'2025-01-18' },
  { id:'ph3', url:'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=400&q=80', caption:'Coulage béton B25 - pompage', date:'2025-01-22' },
  { id:'ph4', url:'https://images.unsplash.com/photo-1590479773265-7464e5d48118?w=400&q=80', caption:'Vue d\'ensemble chantier', date:'2025-01-25' },
  { id:'ph5', url:'https://images.unsplash.com/photo-1516156008625-3a9d6067fab5?w=400&q=80', caption:'Maçonnerie parpaings R+2', date:'2025-02-01' },
  { id:'ph6', url:'https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=400&q=80', caption:'Équipe terrain - Sem. 8', date:'2025-02-08' },
  { id:'ph7', url:'https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=400&q=80', caption:'Pose menuiseries ALU RDC', date:'2025-02-12' },
  { id:'ph8', url:'https://images.unsplash.com/photo-1497366216548-37526070297c?w=400&q=80', caption:'Inspection QHSE - sécurité', date:'2025-02-15' },
  { id:'ph9', url:'https://images.unsplash.com/photo-1486325212027-8081e485255e?w=400&q=80', caption:'Enduit façade nord R+1', date:'2025-03-01' },
  { id:'ph10', url:'https://images.unsplash.com/photo-1560179707-f14e90ef3623?w=400&q=80', caption:'Réunion de chantier hebdo', date:'2025-03-05' },
  { id:'ph11', url:'https://images.unsplash.com/photo-1470219556762-1771e7f9427d?w=400&q=80', caption:'Armatures poteaux R+3', date:'2025-03-10' },
  { id:'ph12', url:'https://images.unsplash.com/photo-1429497419816-9ca5cfb4571a?w=400&q=80', caption:'Vue aérienne avancement', date:'2025-03-15' },
];

const MOCK_REPORTS = [
  {
    id:'r1', project_id:'mock-1', project_name:'Construction Immeuble R+4 Hamdallaye ACI 2000',
    project_status:'en_cours', report_date:'2025-04-14', weather:'ensoleille', temperature:34,
    workers_count:22, work_done:'Ferraillage poteaux R+2 côté nord : 24 poteaux 40x40. 850 kg HA16 posés. Mise en place coffrages pour coulage prévu demain.',
    progress_pct:37, is_validated:true,
    incidents:[],
    images: MOCK_PHOTOS.slice(0,3),
  },
  {
    id:'r2', project_id:'mock-1', project_name:'Construction Immeuble R+4 Hamdallaye ACI 2000',
    project_status:'en_cours', report_date:'2025-04-13', weather:'nuageux', temperature:31,
    workers_count:18, work_done:'Décoffrage voiles RDC côté sud. Reprise béton sur 3 points de mauvaise vibration. Nettoyage et préparation dalle pour coulage.',
    progress_pct:36, is_validated:true,
    incidents:[{ id:'i1', type:'panne', severity:'moyen', description:'Panne vibreur béton 2h', resolved:true }],
    images: MOCK_PHOTOS.slice(2,5),
  },
  {
    id:'r3', project_id:'mock-1', project_name:'Construction Immeuble R+4 Hamdallaye ACI 2000',
    project_status:'en_cours', report_date:'2025-04-12', weather:'ensoleille', temperature:36,
    workers_count:25, work_done:'Coulage dalle R+2 : 28m³ béton B25 BPE. Vibration soignée. Cure SIKA appliquée. Début mise en place armatures R+3.',
    progress_pct:35, is_validated:true,
    incidents:[],
    images: MOCK_PHOTOS.slice(4,7),
  },
  {
    id:'r4', project_id:'mock-1', project_name:'Construction Immeuble R+4 Hamdallaye ACI 2000',
    project_status:'en_cours', report_date:'2025-04-11', weather:'pluvieux', temperature:28,
    workers_count:14, work_done:'Travaux arrêtés à 11h30 suite orage violent. Bâchage coffrages. Reprise 14h. Maçonnerie parpaings 480 u posés côté ouest.',
    progress_pct:34, is_validated:false,
    incidents:[{ id:'i2', type:'intemperie', severity:'eleve', description:'Orage 80 km/h — arrêt chantier 2h30', resolved:true }],
    images: MOCK_PHOTOS.slice(6,9),
  },
  {
    id:'r5', project_id:'mock-1', project_name:'Construction Immeuble R+4 Hamdallaye ACI 2000',
    project_status:'en_cours', report_date:'2025-04-10', weather:'ensoleille', temperature:35,
    workers_count:21, work_done:'Pose canalisations EU/EP sous dallage RDC. 85m PVC DN150. Essai étanchéité à la fumée. Pose regards de visite.',
    progress_pct:33, is_validated:true,
    incidents:[],
    images: MOCK_PHOTOS.slice(8,12),
  },
];

function Card({ children, style={}, p=24 }) {
  return <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:12, padding:p, boxShadow:T.shadow, ...style }}>{children}</div>;
}

function Pbar({ pct, color=T.orange, h=6 }) {
  return (
    <div style={{ height:h, background:T.border, borderRadius:h, overflow:'hidden' }}>
      <div style={{ height:'100%', width:`${Math.min(100,pct||0)}%`, background:color, borderRadius:h, transition:'width 0.6s' }}/>
    </div>
  );
}

// ── Photo lightbox ──────────────────────────────────────────────────────────
function Lightbox({ photos, current, onClose, onNav }) {
  if (!photos.length) return null;
  const photo = photos[current];
  if (!photo) return null;

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
    <div
      onClick={onClose}
      style={{
        position:'fixed', inset:0, background:'rgba(0,0,0,0.92)',
        display:'flex', alignItems:'center', justifyContent:'center',
        zIndex:2000, cursor:'zoom-out',
      }}
    >
      <button
        onClick={(e) => { e.stopPropagation(); onNav(-1); }}
        style={{ position:'absolute', left:24, top:'50%', transform:'translateY(-50%)', background:'rgba(255,255,255,0.12)', border:'none', borderRadius:'50%', width:48, height:48, fontSize:20, color:'#fff', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}
      >‹</button>

      <div onClick={e => e.stopPropagation()} style={{ maxWidth:'85vw', maxHeight:'85vh', textAlign:'center' }}>
        <img
          src={photo.url || photo.image}
          alt={photo.caption || 'Photo chantier'}
          style={{ maxWidth:'100%', maxHeight:'75vh', objectFit:'contain', borderRadius:8, boxShadow:'0 20px 60px rgba(0,0,0,0.5)' }}
        />
        {photo.caption && (
          <div style={{ color:'#fff', fontSize:14, marginTop:12, opacity:0.85 }}>{photo.caption}</div>
        )}
        <div style={{ color:'rgba(255,255,255,0.4)', fontSize:12, marginTop:4 }}>
          {current+1} / {photos.length} · Échap pour fermer · ← → pour naviguer
        </div>
      </div>

      <button
        onClick={(e) => { e.stopPropagation(); onNav(1); }}
        style={{ position:'absolute', right:24, top:'50%', transform:'translateY(-50%)', background:'rgba(255,255,255,0.12)', border:'none', borderRadius:'50%', width:48, height:48, fontSize:20, color:'#fff', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}
      >›</button>

      <button
        onClick={onClose}
        style={{ position:'absolute', top:20, right:20, background:'rgba(255,255,255,0.12)', border:'none', borderRadius:'50%', width:36, height:36, fontSize:18, color:'#fff', cursor:'pointer' }}
      >×</button>
    </div>
  );
}

// ── PDF generation (client-side) ────────────────────────────────────────────
function generateReportPDF(report) {
  const content = `
RAPPORT JOURNALIER DE CHANTIER
==============================
Projet      : ${report.project_name}
Date        : ${new Date(report.report_date+'T00:00:00').toLocaleDateString('fr-FR',{weekday:'long',day:'2-digit',month:'long',year:'numeric'})}
Météo       : ${report.weather} ${WEATHER_ICONS[report.weather]||''}  ${report.temperature ? report.temperature+'°C' : ''}
Ouvriers    : ${report.workers_count}
Avancement  : ${report.progress_pct || '—'}%
Validé      : ${report.is_validated ? '✓ OUI' : '✗ NON'}

TRAVAUX RÉALISÉS
----------------
${report.work_done}

INCIDENTS (${report.incidents?.length || 0})
-----------
${report.incidents?.length > 0
  ? report.incidents.map(i => `• [${i.severity.toUpperCase()}] ${i.description} — ${i.resolved ? 'Résolu' : 'En cours'}`).join('\n')
  : 'Aucun incident signalé.'
}

PHOTOS : ${report.images?.length || 0} photo(s) jointe(s)
${report.images?.length > 0 ? report.images.map(p => `• ${p.caption || 'Photo sans légende'}`).join('\n') : ''}

---
Généré par BTP Manager — ${new Date().toLocaleDateString('fr-FR')}
  `.trim();

  const blob = new Blob([content], { type:'text/plain;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `Rapport_${report.project_name.slice(0,30).replace(/\s+/g,'-')}_${report.report_date}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast.success('Rapport téléchargé ✓');
}

export default function RapportsPage() {
  const navigate = useNavigate();
  const { role } = usePermissions();

  const [projects, setProjects]     = useState([]);
  const [allReports, setAllReports] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState('');
  const [filterProject, setFilterProject] = useState('');
  const [filterValidated, setFilterValidated] = useState('');
  const [activeTab, setActiveTab]   = useState('list');

  // Lightbox state
  const [lightboxPhotos, setLightboxPhotos] = useState([]);
  const [lightboxIdx, setLightboxIdx]       = useState(0);

  const openLightbox = (photos, idx) => {
    setLightboxPhotos(photos);
    setLightboxIdx(idx);
  };
  const closeLightbox = () => setLightboxPhotos([]);
  const navLightbox = (dir) => setLightboxIdx(i => (i + dir + lightboxPhotos.length) % lightboxPhotos.length);

  const load = useCallback(async () => {
    try {
      const pRes = await projectsAPI.list();
      const prjs = pRes.data || [];

      if (prjs.length === 0) {
        // Demo mode — use mock data
        setProjects([{ id:'mock-1', name:'Construction Immeuble R+4 Hamdallaye ACI 2000', status:'en_cours' }]);
        setAllReports(MOCK_REPORTS);
        setLoading(false);
        return;
      }

      setProjects(prjs);
      const reportArrays = await Promise.all(
        prjs.map(p =>
          projectsAPI.listReports(p.id)
            .then(r => (r.data||[]).map(rep => ({
              ...rep,
              project_name: p.name,
              project_id: p.id,
              project_status: p.status,
            })))
            .catch(() => [])
        )
      );
      const flat = reportArrays.flat().sort((a,b) => b.report_date.localeCompare(a.report_date));
      setAllReports(flat.length > 0 ? flat : MOCK_REPORTS);
    } catch {
      toast.error('Erreur chargement — affichage données de démonstration');
      setAllReports(MOCK_REPORTS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = allReports.filter(r => {
    const q = search.toLowerCase();
    const matchSearch = !q || r.project_name.toLowerCase().includes(q) || r.work_done?.toLowerCase().includes(q);
    const matchProject = !filterProject || String(r.project_id) === String(filterProject);
    const matchVal = filterValidated === '' ? true : filterValidated === 'true' ? r.is_validated : !r.is_validated;
    return matchSearch && matchProject && matchVal;
  });

  // Collect ALL photos across all reports
  const allPhotos = allReports.flatMap(r =>
    (r.images || []).map(img => ({
      ...img,
      url: img.url || img.image,
      report_date: r.report_date,
      project_name: r.project_name,
    }))
  );

  // Stats
  const total      = allReports.length;
  const validated  = allReports.filter(r => r.is_validated).length;
  const withInc    = allReports.filter(r => (r.incidents||[]).length > 0).length;
  const avgWorkers = total > 0 ? Math.round(allReports.reduce((a,r) => a+(r.workers_count||0), 0) / total) : 0;

  // Group by project
  const byProject = projects.map(p => {
    const reps = allReports.filter(r => String(r.project_id) === String(p.id));
    const lastRep = reps[0];
    return {
      ...p,
      reports_count: reps.length,
      validated_count: reps.filter(r => r.is_validated).length,
      last_report_date: lastRep?.report_date,
      last_progress: lastRep?.progress_pct,
      photos_count: reps.reduce((a,r) => a + (r.images?.length||0), 0),
      incidents_count: reps.reduce((a,r) => a + (r.incidents?.length||0), 0),
    };
  }).filter(p => p.reports_count > 0);

  const canValidate = ['admin_entreprise','chef_projet','app_owner'].includes(role);

  const handleValidate = async (projectId, reportId) => {
    if (String(projectId).startsWith('mock-')) {
      toast('Validation non disponible en mode démo', { icon:'ℹ️' }); return;
    }
    try {
      await projectsAPI.validateReport(projectId, reportId);
      toast.success('Rapport validé');
      load();
    } catch { toast.error('Erreur validation'); }
  };

  const TABS = [
    { id:'list',      label:`📋 Rapports (${total})`         },
    { id:'photos',    label:`📸 Photos (${allPhotos.length})` },
    { id:'byproject', label:'🏗️ Par projet'                  },
    { id:'stats',     label:'📊 Statistiques'               },
  ];

  return (
    <AppLayout>
      {/* Lightbox */}
      {lightboxPhotos.length > 0 && (
        <Lightbox photos={lightboxPhotos} current={lightboxIdx} onClose={closeLightbox} onNav={navLightbox}/>
      )}

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'0 32px', height:60, background:'#fff', borderBottom:`1px solid ${T.border}`, position:'sticky', top:0, zIndex:10 }}>
        <h1 style={{ margin:0, fontSize:17, fontWeight:700, color:T.text }}>📈 Rapports & Journaux de chantier</h1>
        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
          <div style={{ fontSize:12, color:T.textMuted }}>{total} rapport{total!==1?'s':''} · {allPhotos.length} photos</div>
          {/* Export all reports as zip-like text */}
          <button
            onClick={() => {
              if (filtered.length === 0) return;
              const content = filtered.map(r => `=== ${r.project_name} — ${r.report_date} ===\n${r.work_done}\nOuvriers: ${r.workers_count} | Avancement: ${r.progress_pct||0}%\nIncidents: ${(r.incidents||[]).length}\n`).join('\n');
              const blob = new Blob([content], { type:'text/plain;charset=utf-8' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url; a.download = 'Tous_Rapports_BTP.txt';
              document.body.appendChild(a); a.click();
              document.body.removeChild(a); URL.revokeObjectURL(url);
              toast.success(`${filtered.length} rapport${filtered.length>1?'s':''} exporté${filtered.length>1?'s':''}`);
            }}
            style={{ padding:'7px 14px', borderRadius:8, background:T.orangeLight, color:T.orange, border:`1px solid ${T.orange}30`, fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}
          >
            ⬇️ Exporter tout
          </button>
        </div>
      </div>

      <div style={{ padding:32 }}>
        {/* KPIs */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:24 }}>
          {[
            { label:'Total rapports',      value:total,                  color:T.orange  },
            { label:'Validés',             value:`${validated}/${total}`, color:T.green  },
            { label:'Avec incidents',      value:withInc,                 color:withInc>0?T.red:T.textMuted },
            { label:'Moy. ouvriers/jour',  value:avgWorkers,              color:T.blue   },
          ].map((k,i)=>(
            <Card key={i} p={18}>
              <div style={{ fontSize:11, color:T.textSub, marginBottom:4, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.4px' }}>{k.label}</div>
              <div style={{ fontSize:28, fontWeight:800, color:k.color, lineHeight:1 }}>{k.value}</div>
            </Card>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', borderBottom:`1px solid ${T.border}`, marginBottom:20 }}>
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setActiveTab(t.id)}
              style={{ padding:'10px 18px', fontSize:13, fontWeight:600, cursor:'pointer', background:'none', border:'none', outline:'none', fontFamily:'inherit', color:activeTab===t.id?T.orange:T.textSub, borderBottom:`2px solid ${activeTab===t.id?T.orange:'transparent'}`, marginBottom:-1 }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── LIST TAB ── */}
        {activeTab === 'list' && (
          <>
            <div style={{ display:'flex', gap:12, marginBottom:16, alignItems:'center', flexWrap:'wrap' }}>
              <input placeholder="🔍 Rechercher..." value={search} onChange={e=>setSearch(e.target.value)}
                style={{ padding:'8px 12px', borderRadius:8, border:`1px solid ${T.border}`, background:'#fff', fontSize:13, color:T.text, outline:'none', fontFamily:'inherit', width:240 }}/>
              <select value={filterProject} onChange={e=>setFilterProject(e.target.value)}
                style={{ padding:'8px 12px', borderRadius:8, border:`1px solid ${T.border}`, background:'#fff', fontSize:13, color:T.text, outline:'none', fontFamily:'inherit' }}>
                <option value="">Tous les projets</option>
                {projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <select value={filterValidated} onChange={e=>setFilterValidated(e.target.value)}
                style={{ padding:'8px 12px', borderRadius:8, border:`1px solid ${T.border}`, background:'#fff', fontSize:13, color:T.text, outline:'none', fontFamily:'inherit' }}>
                <option value="">Tous statuts</option>
                <option value="true">Validés</option>
                <option value="false">En attente</option>
              </select>
              <span style={{ marginLeft:'auto', fontSize:12, color:T.textMuted }}>{filtered.length} résultat{filtered.length!==1?'s':''}</span>
            </div>

            {loading ? (
              <div style={{ textAlign:'center', padding:'40px 0', color:T.textMuted }}>
                <div style={{ width:32, height:32, border:`3px solid ${T.orange}`, borderTopColor:'transparent', borderRadius:'50%', animation:'spin 1s linear infinite', margin:'0 auto 12px' }}/>
                Chargement...
              </div>
            ) : filtered.length === 0 ? (
              <Card style={{ textAlign:'center', padding:'60px 24px' }}>
                <div style={{ fontSize:40, marginBottom:12 }}>📓</div>
                <div style={{ fontSize:14, color:T.textSub }}>Aucun rapport trouvé</div>
              </Card>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                {filtered.map(r => {
                  const photos = r.images || [];
                  return (
                    <Card key={r.id} p={0}>
                      <div style={{ padding:'14px 20px', display:'flex', alignItems:'flex-start', gap:16 }}>
                        {/* Date */}
                        <div style={{ textAlign:'center', flexShrink:0, width:52, paddingTop:2 }}>
                          <div style={{ fontSize:24, fontWeight:800, color:T.orange, lineHeight:1 }}>
                            {new Date(r.report_date+'T00:00:00').getDate()}
                          </div>
                          <div style={{ fontSize:10, color:T.textMuted, textTransform:'uppercase' }}>
                            {new Date(r.report_date+'T00:00:00').toLocaleDateString('fr-FR',{month:'short'})}
                          </div>
                          <div style={{ fontSize:20, marginTop:4 }}>{WEATHER_ICONS[r.weather]||'📅'}</div>
                        </div>

                        {/* Content */}
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:5, flexWrap:'wrap' }}>
                            <span style={{ fontSize:13, fontWeight:600, color:T.textSub }}>{r.project_name}</span>
                            {r.is_validated
                              ? <span style={{ padding:'2px 8px', borderRadius:100, fontSize:11, fontWeight:600, background:T.greenLight, color:T.green }}>✅ Validé</span>
                              : <span style={{ padding:'2px 8px', borderRadius:100, fontSize:11, fontWeight:600, background:T.orangeLight, color:T.orange }}>⏳ En attente</span>
                            }
                            {(r.incidents||[]).length > 0 && (
                              <span style={{ padding:'2px 8px', borderRadius:100, fontSize:11, fontWeight:600, background:T.redLight, color:T.red }}>
                                ⚠️ {r.incidents.length} incident{r.incidents.length>1?'s':''}
                              </span>
                            )}
                          </div>
                          <p style={{ fontSize:13, color:T.text, margin:'0 0 8px', lineHeight:1.5, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>
                            {r.work_done}
                          </p>
                          <div style={{ display:'flex', gap:16, fontSize:12, color:T.textSub, marginBottom:photos.length > 0 ? 10 : 0 }}>
                            <span>👷 {r.workers_count} ouvriers</span>
                            {r.progress_pct != null && <span>📊 {r.progress_pct}% avancement</span>}
                            {r.temperature && <span>🌡️ {r.temperature}°C</span>}
                            {photos.length > 0 && (
                              <span style={{ color:T.purple, fontWeight:600 }}>📸 {photos.length} photo{photos.length>1?'s':''}</span>
                            )}
                          </div>

                          {/* Photo thumbnails */}
                          {photos.length > 0 && (
                            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                              {photos.slice(0,5).map((photo, idx) => (
                                <div
                                  key={photo.id || idx}
                                  onClick={(e) => { e.stopPropagation(); openLightbox(photos, idx); }}
                                  style={{ position:'relative', cursor:'zoom-in' }}
                                >
                                  <img
                                    src={photo.url || photo.image}
                                    alt={photo.caption || 'Photo chantier'}
                                    style={{ width:64, height:48, objectFit:'cover', borderRadius:6, border:`1px solid ${T.border}`, display:'block' }}
                                    onError={e => { e.target.src = 'https://via.placeholder.com/64x48?text=📷'; }}
                                  />
                                  {idx === 4 && photos.length > 5 && (
                                    <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.55)', borderRadius:6, display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, color:'#fff' }}>
                                      +{photos.length-5}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        <div style={{ display:'flex', flexDirection:'column', gap:6, flexShrink:0 }}>
                          {/* VIEW */}
                          {!String(r.project_id).startsWith('mock-') ? (
                            <Link to={`/projects/${r.project_id}/reports/${r.id}`}
                              style={{ padding:'6px 14px', borderRadius:7, border:`1px solid ${T.border}`, background:'#fff', color:T.textSub, fontSize:12, textDecoration:'none', fontWeight:500, display:'block', textAlign:'center' }}>
                              Voir
                            </Link>
                          ) : (
                            <button
                              onClick={() => toast('Détail disponible avec le backend connecté', { icon:'ℹ️' })}
                              style={{ padding:'6px 14px', borderRadius:7, border:`1px solid ${T.border}`, background:'#fff', color:T.textSub, fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>
                              Voir
                            </button>
                          )}

                          {/* DOWNLOAD — always works */}
                          <button
                            onClick={() => generateReportPDF(r)}
                            style={{ padding:'6px 14px', borderRadius:7, background:T.blue, color:'#fff', fontSize:12, fontWeight:600, border:'none', cursor:'pointer', fontFamily:'inherit' }}>
                            ⬇️ Télécharger
                          </button>

                          {/* PHOTOS */}
                          {photos.length > 0 && (
                            <button
                              onClick={() => openLightbox(photos, 0)}
                              style={{ padding:'6px 14px', borderRadius:7, background:`${T.purple}15`, color:T.purple, fontSize:12, fontWeight:600, border:`1px solid ${T.purple}30`, cursor:'pointer', fontFamily:'inherit' }}>
                              📸 Photos ({photos.length})
                            </button>
                          )}

                          {/* VALIDATE */}
                          {canValidate && !r.is_validated && (
                            <button onClick={() => handleValidate(r.project_id, r.id)}
                              style={{ padding:'6px 14px', borderRadius:7, background:T.green, color:'#fff', fontSize:12, fontWeight:600, border:'none', cursor:'pointer', fontFamily:'inherit' }}>
                              ✅ Valider
                            </button>
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                })}
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
                <div style={{ fontSize:14, color:T.textSub }}>Aucune photo disponible</div>
                <div style={{ fontSize:12, color:T.textMuted, marginTop:6 }}>Les photos sont ajoutées lors de la création des rapports journaliers</div>
              </Card>
            ) : (
              <>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
                  <div style={{ fontSize:14, fontWeight:600, color:T.text }}>
                    {allPhotos.length} photo{allPhotos.length>1?'s':''} de chantier
                  </div>
                  <button
                    onClick={() => openLightbox(allPhotos, 0)}
                    style={{ padding:'8px 16px', borderRadius:8, background:T.purple, color:'#fff', fontSize:12, fontWeight:600, border:'none', cursor:'pointer', fontFamily:'inherit' }}>
                    🖼️ Diaporama complet
                  </button>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:12 }}>
                  {allPhotos.map((photo, idx) => (
                    <div
                      key={photo.id || idx}
                      onClick={() => openLightbox(allPhotos, idx)}
                      style={{ borderRadius:10, overflow:'hidden', cursor:'zoom-in', position:'relative', background:'#F3F4F6', border:`1px solid ${T.border}` }}
                    >
                      <img
                        src={photo.url}
                        alt={photo.caption || 'Photo chantier'}
                        style={{ width:'100%', height:160, objectFit:'cover', display:'block', transition:'transform 0.2s' }}
                        onError={e => { e.target.src = `https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400&q=60`; }}
                        onMouseEnter={e => e.target.style.transform = 'scale(1.04)'}
                        onMouseLeave={e => e.target.style.transform = 'scale(1)'}
                      />
                      {photo.caption && (
                        <div style={{ padding:'6px 10px', fontSize:11, color:T.text, fontWeight:500, background:'#fff', borderTop:`1px solid ${T.border}` }}>
                          {photo.caption}
                        </div>
                      )}
                      {photo.project_name && (
                        <div style={{ padding:'3px 10px 6px', fontSize:10, color:T.textMuted, background:'#fff' }}>
                          📅 {photo.report_date || photo.date}
                        </div>
                      )}
                      <div style={{ position:'absolute', top:8, right:8, background:'rgba(0,0,0,0.5)', borderRadius:4, padding:'2px 6px', fontSize:9, color:'#fff', fontWeight:700 }}>
                        🔍
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── BY PROJECT TAB ── */}
        {activeTab === 'byproject' && (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(320px,1fr))', gap:16 }}>
            {byProject.length === 0 ? (
              <Card style={{ gridColumn:'1/-1', textAlign:'center', padding:'60px 24px' }}>
                <div style={{ fontSize:40, marginBottom:12 }}>📁</div>
                <div style={{ fontSize:14, color:T.textSub }}>Aucun rapport disponible</div>
              </Card>
            ) : byProject.map(p => (
              <Card key={p.id}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14 }}>
                  <div style={{ fontSize:14, fontWeight:700, color:T.text, flex:1, marginRight:8 }}>{p.name}</div>
                  <span style={{ padding:'2px 9px', borderRadius:100, fontSize:11, fontWeight:600, flexShrink:0,
                    color:p.status==='termine'?T.green:p.status==='en_cours'?T.orange:T.textSub,
                    background:p.status==='termine'?T.greenLight:p.status==='en_cours'?T.orangeLight:'#F3F4F6' }}>
                    {p.status==='termine'?'Terminé':p.status==='en_cours'?'En cours':p.status==='planifie'?'Planifié':'Suspendu'}
                  </span>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:14 }}>
                  {[
                    ['Rapports',   p.reports_count,   T.orange ],
                    ['Validés',    p.validated_count,  T.green  ],
                    ['Incidents',  p.incidents_count,  p.incidents_count>0?T.red:T.textMuted ],
                    ['Photos',     p.photos_count,     T.purple ],
                  ].map(([l,v,c]) => (
                    <div key={l} style={{ padding:'8px 10px', background:'#F9FAFB', borderRadius:8 }}>
                      <div style={{ fontSize:10, color:T.textMuted, textTransform:'uppercase', letterSpacing:'0.4px', marginBottom:2 }}>{l}</div>
                      <div style={{ fontSize:16, fontWeight:700, color:c }}>{v}</div>
                    </div>
                  ))}
                </div>
                {p.last_progress != null && (
                  <>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:T.textSub, marginBottom:4 }}>
                      <span>Avancement</span>
                      <span style={{ fontWeight:700, color:T.orange }}>{p.last_progress}%</span>
                    </div>
                    <Pbar pct={p.last_progress}/>
                  </>
                )}
                {/* Photo preview strip */}
                {(() => {
                  const projPhotos = allReports.filter(r => String(r.project_id) === String(p.id)).flatMap(r => r.images||[]).slice(0,4);
                  if (projPhotos.length === 0) return null;
                  return (
                    <div style={{ display:'flex', gap:4, marginTop:12 }}>
                      {projPhotos.map((photo, idx) => (
                        <img key={photo.id||idx} src={photo.url||photo.image}
                          alt="" style={{ width:48, height:36, objectFit:'cover', borderRadius:4, cursor:'pointer', border:`1px solid ${T.border}` }}
                          onClick={() => openLightbox(projPhotos, idx)}
                          onError={e => { e.target.style.display='none'; }}
                        />
                      ))}
                    </div>
                  );
                })()}
                <div style={{ display:'flex', gap:8, marginTop:12 }}>
                  {!String(p.id).startsWith('mock-') ? (
                    <Link to={`/projects/${p.id}`}
                      style={{ flex:1, display:'block', padding:'8px 0', borderRadius:8, border:`1px solid ${T.border}`, background:'#fff', color:T.textSub, fontSize:12, fontWeight:500, textDecoration:'none', textAlign:'center' }}>
                      Voir le projet →
                    </Link>
                  ) : (
                    <button
                      onClick={() => navigate('/projects')}
                      style={{ flex:1, padding:'8px 0', borderRadius:8, border:`1px solid ${T.border}`, background:'#fff', color:T.textSub, fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>
                      Voir le projet →
                    </button>
                  )}
                  <button
                    onClick={() => {
                      const reps = allReports.filter(r => String(r.project_id) === String(p.id));
                      const content = reps.map(r => `=== ${r.report_date} ===\n${r.work_done}\nOuvriers: ${r.workers_count}\n`).join('\n');
                      const blob = new Blob([content], { type:'text/plain;charset=utf-8' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url; a.download = `Rapports_${p.name.slice(0,20)}.txt`;
                      document.body.appendChild(a); a.click();
                      document.body.removeChild(a); URL.revokeObjectURL(url);
                      toast.success('Rapport exporté ✓');
                    }}
                    style={{ padding:'8px 12px', borderRadius:8, background:T.blueLight||'#EFF6FF', color:T.blue, border:`1px solid ${T.blue}30`, fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
                    ⬇️
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* ── STATS TAB ── */}
        {activeTab === 'stats' && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
            <Card>
              <div style={{ fontSize:14, fontWeight:700, color:T.text, marginBottom:20 }}>📊 Météo des chantiers</div>
              {Object.entries(WEATHER_ICONS).map(([w, icon]) => {
                const count = allReports.filter(r => r.weather === w).length;
                const pct = total > 0 ? Math.round((count/total)*100) : 0;
                return (
                  <div key={w} style={{ display:'flex', alignItems:'center', gap:12, marginBottom:10 }}>
                    <span style={{ fontSize:18, width:24, textAlign:'center' }}>{icon}</span>
                    <span style={{ flex:1, fontSize:13, color:T.text, textTransform:'capitalize' }}>{w}</span>
                    <div style={{ width:120, height:8, background:T.border, borderRadius:4, overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${pct}%`, background:T.orange, borderRadius:4 }}/>
                    </div>
                    <span style={{ fontSize:12, color:T.textSub, width:70, textAlign:'right' }}>{count} ({pct}%)</span>
                  </div>
                );
              })}
            </Card>

            <Card>
              <div style={{ fontSize:14, fontWeight:700, color:T.text, marginBottom:20 }}>👷 Présences par semaine</div>
              {(() => {
                const byWeek = {};
                allReports.forEach(r => {
                  const d = new Date(r.report_date+'T00:00:00');
                  const week = `Sem. ${Math.ceil(d.getDate()/7)} — ${d.toLocaleDateString('fr-FR',{month:'short',year:'2-digit'})}`;
                  if (!byWeek[week]) byWeek[week] = { count:0, workers:0 };
                  byWeek[week].count++;
                  byWeek[week].workers += r.workers_count || 0;
                });
                const weeks = Object.entries(byWeek).slice(-6);
                const maxW = Math.max(...weeks.map(([,v]) => v.workers), 1);
                return weeks.length === 0 ? (
                  <div style={{ color:T.textMuted, fontSize:13, textAlign:'center', padding:'20px 0' }}>Pas de données</div>
                ) : weeks.map(([w, v]) => (
                  <div key={w} style={{ display:'flex', alignItems:'center', gap:12, marginBottom:10 }}>
                    <span style={{ fontSize:12, color:T.textSub, width:80, flexShrink:0 }}>{w}</span>
                    <div style={{ flex:1, height:18, background:T.border, borderRadius:3, overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${(v.workers/maxW)*100}%`, background:T.blue, borderRadius:3 }}/>
                    </div>
                    <span style={{ fontSize:12, color:T.textSub, width:90, textAlign:'right', flexShrink:0 }}>{v.workers} présences</span>
                  </div>
                ));
              })()}
            </Card>

            {/* Photos summary */}
            <Card style={{ gridColumn:'1/-1' }}>
              <div style={{ fontSize:14, fontWeight:700, color:T.text, marginBottom:16 }}>📸 Galerie récente — {allPhotos.length} photos</div>
              {allPhotos.length === 0 ? (
                <div style={{ textAlign:'center', padding:'20px 0', color:T.textMuted, fontSize:13 }}>Aucune photo dans les rapports</div>
              ) : (
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  {allPhotos.slice(0,12).map((photo, idx) => (
                    <img key={photo.id||idx} src={photo.url||photo.image}
                      alt={photo.caption || ''}
                      onClick={() => openLightbox(allPhotos, idx)}
                      style={{ width:80, height:60, objectFit:'cover', borderRadius:6, cursor:'zoom-in', border:`1px solid ${T.border}`, transition:'transform 0.15s' }}
                      onError={e => { e.target.style.display = 'none'; }}
                      onMouseEnter={e => e.target.style.transform = 'scale(1.08)'}
                      onMouseLeave={e => e.target.style.transform = 'scale(1)'}
                    />
                  ))}
                  {allPhotos.length > 12 && (
                    <div
                      onClick={() => setActiveTab('photos')}
                      style={{ width:80, height:60, borderRadius:6, background:T.border, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', fontSize:12, fontWeight:700, color:T.textSub, flexDirection:'column', gap:2 }}>
                      <span>+{allPhotos.length-12}</span>
                      <span style={{ fontSize:10 }}>voir tout</span>
                    </div>
                  )}
                </div>
              )}
            </Card>
          </div>
        )}
      </div>
    </AppLayout>
  );
}