import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { projectsAPI } from '../../services/api';
import AppLayout from '../../components/layout/AppLayout';
import toast from 'react-hot-toast';

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
  }, [projectId, reportId]);

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

  const updatePendingCaption = (index, caption) => {
    setPendingImages(prev => prev.map((img, i) => i === index ? { ...img, caption } : img));
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
    let ok = 0;
    for (const img of pendingImages) {
      try {
        const fd = new FormData();
        fd.append('image', img.file);
        if (img.caption) fd.append('caption', img.caption);
        await projectsAPI.uploadReportImage(pid, rid, fd);
        ok++;
      } catch {
        toast.error(`Échec upload : ${img.file.name}`);
      }
    }
    setUploadingImages(false);
    if (ok > 0) toast.success(`${ok} photo(s) ajoutée(s)`);
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
        toast.success('Rapport créé avec succès');
      }
      await uploadPendingImages(projectId, savedReportId);
      navigate(`/projects/${projectId}?tab=journal`);
    } catch (err) {
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setLoading(false);
    }
  };

  const totalImages = existingImages.length + pendingImages.length;

  // Visual Helper: Style for inputs on white background
  const inputStyle = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '8px',
    border: '1px solid #D1D5DB',
    backgroundColor: '#fff',
    color: '#111827',
    fontSize: '14px',
    marginTop: '6px'
  };

  return (
    <AppLayout>
      <div style={{ padding: '40px 36px', backgroundColor: '#fff', minHeight: '100vh' }}>
        <div className="animate-fade-in" style={{ maxWidth: 760, margin: '0 auto' }}>

          <div style={{ marginBottom: 32 }}>
            <button onClick={() => navigate(`/projects/${projectId}`)}
              style={{ background: 'none', border: 'none', color: '#6B7280', fontSize: 14, cursor: 'pointer', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
              ← Retour au projet
            </button>
            <h1 style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 32, fontWeight: 800, marginBottom: 4, color: '#111827' }}>
              {isEditing ? '✏️ Modifier le rapport' : '📓 Nouveau rapport journalier'}
            </h1>
            {project && (
              <p style={{ color: '#6B7280', fontSize: 15 }}>Projet : <span style={{ color: '#F59E0B', fontWeight: 600 }}>{project.name}</span></p>
            )}
          </div>

          <form onSubmit={handleSubmit}>

            {/* Date & Météo */}
            <div className="card" style={{ marginBottom: 20, padding: '24px', border: '1px solid #E5E7EB', borderRadius: '12px' }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20, color: '#D97706' }}>
                📅 Date & Conditions météo
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Date du rapport *</label>
                  <input style={inputStyle} type="date" name="report_date" value={form.report_date} onChange={handleChange} required />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Météo</label>
                  <select style={inputStyle} name="weather" value={form.weather} onChange={handleChange}>
                    {WEATHER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Température (°C)</label>
                  <input style={inputStyle} type="number" name="temperature" placeholder="ex: 28"
                    value={form.temperature} onChange={handleChange} min="-30" max="60" />
                </div>
              </div>
            </div>

            {/* Effectifs */}
            <div className="card" style={{ marginBottom: 20, padding: '24px', border: '1px solid #E5E7EB', borderRadius: '12px' }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20, color: '#D97706' }}>
                👷 Effectifs & Avancement
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Ouvriers présents *</label>
                  <input style={inputStyle} type="number" name="workers_count"
                    value={form.workers_count} onChange={handleChange} min="0" required />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Avancement global (%)</label>
                  <div style={{ position: 'relative' }}>
                    <input style={inputStyle} type="number" name="progress_pct" placeholder="ex: 45"
                      value={form.progress_pct} onChange={handleChange} min="0" max="100" />
                  </div>
                  {form.progress_pct !== '' && (
                    <div style={{ height: 6, background: '#F3F4F6', borderRadius: 3, marginTop: 12, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.min(100, form.progress_pct)}%`, background: '#F59E0B', transition: 'width 0.3s' }} />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Travaux */}
            <div className="card" style={{ marginBottom: 20, padding: '24px', border: '1px solid #E5E7EB', borderRadius: '12px' }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20, color: '#D97706' }}>
                🏗️ Travaux réalisés
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Description *</label>
                  <textarea style={{ ...inputStyle, minHeight: 120 }} name="work_done" value={form.work_done} onChange={handleChange} required
                    placeholder="Détaillez les travaux effectués..." />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Matériaux utilisés</label>
                  <textarea style={{ ...inputStyle, minHeight: 80 }} name="materials_used" value={form.materials_used} onChange={handleChange}
                    placeholder="Béton, acier, engins..." />
                </div>
              </div>
            </div>

            {/* Incidents */}
            <div className="card" style={{ marginBottom: 20, padding: '24px', border: '1px solid #E5E7EB', borderRadius: '12px' }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: '#D97706' }}>
                ⚠️ Incidents & Observations
              </h2>
              <textarea style={{ ...inputStyle, minHeight: 100 }} name="incidents" value={form.incidents} onChange={handleChange}
                placeholder="Laisser vide si aucun incident..." />
              {form.incidents && (
                <div style={{ marginTop: 12, padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 8, fontSize: 13, color: '#B91C1C' }}>
                  ⚠️ Un incident sera signalé dans ce rapport
                </div>
              )}
            </div>

            {/* Photos */}
            <div className="card" style={{ marginBottom: 28, padding: '24px', border: '1px solid #E5E7EB', borderRadius: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: '#D97706', margin: 0 }}>
                  📸 Photos ({totalImages})
                </h2>
                <button type="button" onClick={() => fileInputRef.current?.click()}
                  style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #F59E0B', background: '#FFFBEB', color: '#D97706', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  + Ajouter
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFileSelect} style={{ display: 'none' }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 16 }}>
                {existingImages.map(img => (
                  <div key={img.id} style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', border: '1px solid #E5E7EB' }}>
                    <img src={img.image} alt="Report" style={{ width: '100%', height: 120, objectFit: 'cover' }} />
                    <button type="button" onClick={() => removeExisting(img.id)}
                      style={{ position: 'absolute', top: 5, right: 5, background: '#EF4444', border: 'none', borderRadius: '50%', color: '#fff', width: 24, height: 24, cursor: 'pointer' }}>×</button>
                  </div>
                ))}
                {pendingImages.map((img, index) => (
                  <div key={index} style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', border: '2px solid #F59E0B' }}>
                    <img src={img.preview} alt="New" style={{ width: '100%', height: 120, objectFit: 'cover', opacity: 0.7 }} />
                    <button type="button" onClick={() => removePending(index)}
                      style={{ position: 'absolute', top: 5, right: 5, background: '#374151', border: 'none', borderRadius: '50%', color: '#fff', width: 24, height: 24, cursor: 'pointer' }}>×</button>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 12, paddingBottom: 40 }}>
              <button type="button" onClick={() => navigate(`/projects/${projectId}`)}
                style={{ flex: 1, padding: '14px', borderRadius: '8px', border: '1px solid #D1D5DB', background: '#fff', color: '#374151', fontWeight: 600, cursor: 'pointer' }}>
                Annuler
              </button>
              <button type="submit" disabled={loading || uploadingImages}
                style={{ flex: 2, padding: '14px', borderRadius: '8px', border: 'none', background: '#F59E0B', color: '#fff', fontWeight: 700, cursor: 'pointer', opacity: (loading || uploadingImages) ? 0.7 : 1 }}>
                {loading || uploadingImages ? 'Enregistrement...' : (isEditing ? 'Mettre à jour' : 'Créer le rapport')}
              </button>
            </div>

          </form>
        </div>
      </div>
    </AppLayout>
  );
}