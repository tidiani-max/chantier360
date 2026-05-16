import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { projectsAPI } from '../../services/api';
import AppLayout from '../../components/layout/AppLayout';
import toast from 'react-hot-toast';

// Modern Color Palette Constants
const COLORS = {
  primary: '#F59E0B', // Amber 500
  primaryDark: '#D97706',
  textMain: '#111827',
  textMuted: '#6B7280',
  border: '#E5E7EB',
  bgLight: '#F9FAFB'
};

const WEATHER_OPTIONS = [
  { value: 'ensoleille', label: '☀️ Ensoleillé' },
  { value: 'nuageux',   label: '☁️ Nuageux'   },
  { value: 'pluvieux',  label: '🌧️ Pluvieux'  },
  { value: 'venteux',   label: '💨 Venteux'   },
  { value: 'orageux',   label: '⛈️ Orageux'   },
];

export default function DailyReportFormPage() {
  const { id: projectId, reportId } = useParams();
  const navigate = useNavigate();
  const isEditing = Boolean(reportId);
  const fileInputRef = useRef();

  const [project, setProject]                 = useState(null);
  const [loading, setLoading]                 = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [pendingImages, setPendingImages]     = useState([]); 
  const [existingImages, setExistingImages]   = useState([]); 

  const [form, setForm] = useState({
    report_date:    new Date().toISOString().split('T')[0],
    weather:        'ensoleille',
    temperature:    '',
    workers_count:  0,
    work_done:      '',
    materials_used: '',
    incidents:      '',
    progress_pct:   '',
  });

  useEffect(() => {
    (async () => {
      try {
        const pRes = await projectsAPI.get(projectId);
        setProject(pRes.data);
        if (isEditing) {
          const rRes = await projectsAPI.getReport(projectId, reportId);
          const r = rRes.data;
          setForm({
            report_date:    r.report_date     || '',
            weather:        r.weather         || 'ensoleille',
            temperature:    r.temperature     ?? '',
            workers_count:  r.workers_count   ?? 0,
            work_done:      r.work_done       || '',
            materials_used: r.materials_used  || '',
            incidents:      r.incidents       || '',
            progress_pct:   r.progress_pct    ?? '',
          });
          setExistingImages(r.images || []);
        }
      } catch {
        toast.error('Erreur lors du chargement');
        navigate(`/projects/${projectId}`);
      }
    })();
  }, [projectId, reportId, isEditing, navigate]);

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setForm(f => ({ ...f, [name]: type === 'number' ? (value === '' ? '' : Number(value)) : value }));
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    const newImages = files.map(file => ({ file, preview: URL.createObjectURL(file), caption: '' }));
    setPendingImages(prev => [...prev, ...newImages]);
    e.target.value = '';
  };

  const removePending = (index) => {
    setPendingImages(prev => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const removeExisting = async (imageId) => {
    try {
      await projectsAPI.deleteReportImage(projectId, reportId, imageId);
      setExistingImages(prev => prev.filter(img => img.id !== imageId));
      toast.success('Photo supprimée');
    } catch {
      toast.error('Erreur lors de la suppression');
    }
  };

  const uploadPendingImages = async (pid, rid) => {
    if (!pendingImages.length) return;
    setUploadingImages(true);
    for (const img of pendingImages) {
      try {
        const fd = new FormData();
        fd.append('image', img.file);
        if (img.caption) fd.append('caption', img.caption);
        await projectsAPI.uploadReportImage(pid, rid, fd);
      } catch (err) {
        toast.error(`Échec upload : ${img.file.name}`);
      }
    }
    setUploadingImages(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const payload = { ...form };
    if (payload.temperature === '') delete payload.temperature;
    if (payload.progress_pct === '') delete payload.progress_pct;

    try {
      let savedReportId = reportId;
      if (isEditing) {
        await projectsAPI.updateReport(projectId, reportId, payload);
        toast.success('Rapport mis à jour');
      } else {
        const res = await projectsAPI.createReport(projectId, payload);
        savedReportId = res.data.id;
        toast.success('Rapport créé');
      }
      await uploadPendingImages(projectId, savedReportId);
      navigate(`/projects/${projectId}?tab=journal`);
    } catch (err) {
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setLoading(false);
    }
  };

  // Reusable Component Styles
  const labelStyle = { display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' };
  const inputStyle = {
    width: '100%',
    padding: '12px 14px',
    borderRadius: '8px',
    border: `1px solid ${COLORS.border}`,
    backgroundColor: '#fff',
    color: COLORS.textMain,
    fontSize: '15px',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    outline: 'none',
  };

  return (
    <AppLayout>
      <div style={{ backgroundColor: COLORS.bgLight, minHeight: '100vh', padding: '40px 20px' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          
          {/* Header Section */}
          <div style={{ marginBottom: '32px' }}>
            <button onClick={() => navigate(`/projects/${projectId}`)}
              style={{ background: 'none', border: 'none', color: COLORS.textMuted, fontSize: '14px', fontWeight: '500', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              ← Retour au tableau de bord
            </button>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <div>
                <h1 style={{ fontFamily: 'Inter, sans-serif', fontSize: '28px', fontWeight: '800', color: COLORS.textMain, letterSpacing: '-0.02em' }}>
                  {isEditing ? 'Modifier le rapport' : 'Nouveau rapport journalier'}
                </h1>
                {project && (
                  <p style={{ color: COLORS.textMuted, marginTop: '4px', fontSize: '15px' }}>
                    Chantier: <span style={{ color: COLORS.primaryDark, fontWeight: '600' }}>{project.name}</span>
                  </p>
                )}
              </div>
              <div style={{ color: COLORS.textMuted, fontSize: '13px', fontWeight: '500' }}>ID: {projectId.slice(0,8)}</div>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              {/* Section: Context */}
              <section style={{ backgroundColor: '#fff', borderRadius: '12px', border: `1px solid ${COLORS.border}`, padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <h2 style={{ fontSize: '14px', textTransform: 'uppercase', tracking: '0.05em', color: COLORS.textMuted, marginBottom: '20px', fontWeight: '700' }}>
                  Statut & Environnement
                </h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
                  <div>
                    <label style={labelStyle}>Date du rapport</label>
                    <input style={inputStyle} type="date" name="report_date" value={form.report_date} onChange={handleChange} required />
                  </div>
                  <div>
                    <label style={labelStyle}>Météo</label>
                    <select style={inputStyle} name="weather" value={form.weather} onChange={handleChange}>
                      {WEATHER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Température (°C)</label>
                    <input style={inputStyle} type="number" name="temperature" placeholder="28" value={form.temperature} onChange={handleChange} />
                  </div>
                </div>
              </section>

              {/* Section: Metrics */}
              <section style={{ backgroundColor: '#fff', borderRadius: '12px', border: `1px solid ${COLORS.border}`, padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                  <div>
                    <label style={labelStyle}>Ouvriers sur place</label>
                    <input style={inputStyle} type="number" name="workers_count" value={form.workers_count} onChange={handleChange} min="0" required />
                  </div>
                  <div>
                    <label style={labelStyle}>Avancement global ({form.progress_pct || 0}%)</label>
                    <input style={inputStyle} type="range" name="progress_pct" value={form.progress_pct} onChange={handleChange} min="0" max="100" step="5" />
                    <div style={{ height: '6px', backgroundColor: '#F3F4F6', borderRadius: '10px', marginTop: '12px', overflow: 'hidden' }}>
                      <div style={{ width: `${form.progress_pct}%`, height: '100%', backgroundColor: COLORS.primary, transition: 'width 0.3s ease' }} />
                    </div>
                  </div>
                </div>
              </section>

              {/* Section: Details */}
              <section style={{ backgroundColor: '#fff', borderRadius: '12px', border: `1px solid ${COLORS.border}`, padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div>
                    <label style={labelStyle}>Détails des travaux réalisés</label>
                    <textarea style={{ ...inputStyle, minHeight: '120px', resize: 'vertical' }} name="work_done" value={form.work_done} onChange={handleChange} required placeholder="Décrivez les tâches accomplies aujourd'hui..." />
                  </div>
                  <div>
                    <label style={labelStyle}>Matériaux & Logistique</label>
                    <textarea style={{ ...inputStyle, minHeight: '80px' }} name="materials_used" value={form.materials_used} onChange={handleChange} placeholder="Ex: Livraison de 10m3 de béton, utilisation de la grue..." />
                  </div>
                </div>
              </section>

              {/* Section: Incidents */}
              <section style={{ backgroundColor: form.incidents ? '#FFF7ED' : '#fff', borderRadius: '12px', border: `1px solid ${form.incidents ? '#FED7AA' : COLORS.border}`, padding: '24px' }}>
                <label style={{ ...labelStyle, color: form.incidents ? '#C2410C' : '#374151' }}>⚠️ Observations ou Incidents</label>
                <textarea style={{ ...inputStyle, minHeight: '80px', borderColor: form.incidents ? '#FDBA74' : COLORS.border }} name="incidents" value={form.incidents} onChange={handleChange} placeholder="Signalez tout retard ou incident technique ici..." />
              </section>

              {/* Section: Media Gallery */}
              <section style={{ backgroundColor: '#fff', borderRadius: '12px', border: `1px solid ${COLORS.border}`, padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: '700' }}>Photos du chantier ({existingImages.length + pendingImages.length})</h3>
                  <button type="button" onClick={() => fileInputRef.current?.click()}
                    style={{ fontSize: '13px', fontWeight: '600', color: COLORS.primaryDark, backgroundColor: '#FEF3C7', padding: '6px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer' }}>
                    + Ajouter des photos
                  </button>
                  <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFileSelect} style={{ display: 'none' }} />
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '12px' }}>
                  {existingImages.map(img => (
                    <div key={img.id} style={{ position: 'relative', height: '140px', borderRadius: '8px', overflow: 'hidden', border: `1px solid ${COLORS.border}` }}>
                      <img src={img.image} alt="Site" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <button type="button" onClick={() => removeExisting(img.id)} style={{ position: 'absolute', top: '5px', right: '5px', background: 'rgba(239, 68, 68, 0.9)', color: '#fff', border: 'none', borderRadius: '4px', width: '20px', height: '20px', cursor: 'pointer', fontSize: '12px' }}>✕</button>
                    </div>
                  ))}
                  {pendingImages.map((img, idx) => (
                    <div key={idx} style={{ position: 'relative', height: '140px', borderRadius: '8px', overflow: 'hidden', border: `2px dashed ${COLORS.primary}` }}>
                      <img src={img.preview} alt="New" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.6 }} />
                      <div style={{ position: 'absolute', bottom: '0', width: '100%', background: 'rgba(0,0,0,0.5)', color: '#fff', fontSize: '10px', textAlign: 'center', padding: '2px' }}>EN ATTENTE</div>
                      <button type="button" onClick={() => removePending(idx)} style={{ position: 'absolute', top: '5px', right: '5px', background: '#374151', color: '#fff', border: 'none', borderRadius: '4px', width: '20px', height: '20px', cursor: 'pointer' }}>✕</button>
                    </div>
                  ))}
                </div>
              </section>

              {/* Form Actions */}
              <div style={{ display: 'flex', gap: '16px', marginTop: '12px', paddingBottom: '60px' }}>
                <button type="button" onClick={() => navigate(`/projects/${projectId}`)}
                  style={{ flex: 1, padding: '14px', borderRadius: '10px', border: `1px solid ${COLORS.border}`, background: '#fff', color: '#4B5563', fontWeight: '600', cursor: 'pointer' }}>
                  Annuler
                </button>
                <button type="submit" disabled={loading || uploadingImages}
                  style={{ flex: 2, padding: '14px', borderRadius: '10px', border: 'none', background: COLORS.primary, color: '#fff', fontWeight: '700', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(245, 158, 11, 0.2)' }}>
                  {loading || uploadingImages ? 'Traitement en cours...' : (isEditing ? 'Enregistrer les modifications' : 'Publier le rapport')}
                </button>
              </div>

            </div>
          </form>
        </div>
      </div>
    </AppLayout>
  );
}