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
  const [pendingImages, setPendingImages]     = useState([]); // { file, preview, caption }
  const [existingImages, setExistingImages]   = useState([]); // { id, image, caption }

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
      const errors = err.response?.data;
      if (errors) {
        Object.entries(errors).forEach(([k, v]) => {
          const msgs = Array.isArray(v) ? v : [v];
          msgs.forEach(m => toast.error(`${k} : ${m}`));
        });
      } else {
        toast.error('Erreur lors de la sauvegarde');
      }
    } finally {
      setLoading(false);
    }
  };

  const totalImages = existingImages.length + pendingImages.length;

  return (
    <AppLayout>
      <div style={{ padding: '40px 36px' }}>
        <div className="animate-fade-in" style={{ maxWidth: 760 }}>

          <div style={{ marginBottom: 32 }}>
            <button onClick={() => navigate(`/projects/${projectId}`)}
              style={{ background: 'none', border: 'none', color: 'var(--gray-3)', fontSize: 14, cursor: 'pointer', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
              ← Retour au projet
            </button>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 800, marginBottom: 4 }}>
              {isEditing ? '✏️ Modifier le rapport' : '📓 Nouveau rapport journalier'}
            </h1>
            {project && (
              <p style={{ color: 'var(--gray-3)', fontSize: 15 }}>Projet : <span style={{ color: 'var(--gold)' }}>{project.name}</span></p>
            )}
          </div>

          <form onSubmit={handleSubmit}>

            {/* Date & Météo */}
            <div className="card" style={{ marginBottom: 20 }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, marginBottom: 20, color: 'var(--gold)' }}>
                📅 Date & Conditions météo
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                <div className="input-group">
                  <label className="input-label">Date du rapport *</label>
                  <input className="input-field" type="date" name="report_date" value={form.report_date} onChange={handleChange} required />
                </div>
                <div className="input-group">
                  <label className="input-label">Météo</label>
                  <select className="input-field" name="weather" value={form.weather} onChange={handleChange}>
                    {WEATHER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div className="input-group">
                  <label className="input-label">Température (°C)</label>
                  <input className="input-field" type="number" name="temperature" placeholder="ex: 28"
                    value={form.temperature} onChange={handleChange} min="-30" max="60" />
                </div>
              </div>
            </div>

            {/* Effectifs */}
            <div className="card" style={{ marginBottom: 20 }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, marginBottom: 20, color: 'var(--gold)' }}>
                👷 Effectifs & Avancement
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div className="input-group">
                  <label className="input-label">Nombre d'ouvriers présents *</label>
                  <input className="input-field" type="number" name="workers_count"
                    value={form.workers_count} onChange={handleChange} min="0" required />
                </div>
                <div className="input-group">
                  <label className="input-label">Avancement global (%)</label>
                  <div style={{ position: 'relative' }}>
                    <input className="input-field" type="number" name="progress_pct" placeholder="ex: 45"
                      value={form.progress_pct} onChange={handleChange} min="0" max="100" style={{ paddingRight: 40 }} />
                    <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--gray-3)', fontSize: 14 }}>%</span>
                  </div>
                  {form.progress_pct !== '' && (
                    <div style={{ height: 4, background: 'var(--dark-border)', borderRadius: 2, marginTop: 8, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.min(100, form.progress_pct)}%`, background: 'var(--gold)', borderRadius: 2, transition: 'width 0.3s' }} />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Travaux */}
            <div className="card" style={{ marginBottom: 20 }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, marginBottom: 20, color: 'var(--gold)' }}>
                🏗️ Travaux réalisés
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="input-group">
                  <label className="input-label">Description des travaux réalisés *</label>
                  <textarea className="input-field" name="work_done" value={form.work_done} onChange={handleChange} required
                    placeholder="Décrivez en détail les travaux effectués ce jour : phases, zones concernées, quantités réalisées..."
                    style={{ minHeight: 120, resize: 'vertical', lineHeight: 1.6 }} />
                </div>
                <div className="input-group">
                  <label className="input-label">Matériaux & équipements utilisés</label>
                  <textarea className="input-field" name="materials_used" value={form.materials_used} onChange={handleChange}
                    placeholder="ex: 10 m³ béton B25, 500 kg ferraillage HA12, grue 50T..."
                    style={{ minHeight: 80, resize: 'vertical' }} />
                </div>
              </div>
            </div>

            {/* Incidents */}
            <div className="card" style={{ marginBottom: 20 }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, marginBottom: 20, color: 'var(--gold)' }}>
                ⚠️ Incidents & Observations
              </h2>
              <div className="input-group">
                <label className="input-label">Incidents, problèmes, réserves ou notes importantes</label>
                <textarea className="input-field" name="incidents" value={form.incidents} onChange={handleChange}
                  placeholder="Laisser vide si aucun incident. Sinon : retard de livraison, intempérie, problème technique..."
                  style={{ minHeight: 100, resize: 'vertical' }} />
              </div>
              {form.incidents && (
                <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, fontSize: 13, color: '#FCA5A5' }}>
                  ⚠️ Un incident sera signalé dans ce rapport
                </div>
              )}
            </div>

            {/* Photos */}
            <div className="card" style={{ marginBottom: 28 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: 'var(--gold)', margin: 0 }}>
                  📸 Photos du chantier
                  {totalImages > 0 && (
                    <span style={{ marginLeft: 10, fontSize: 13, fontWeight: 400, color: 'var(--gray-3)' }}>
                      {totalImages} photo{totalImages > 1 ? 's' : ''}
                    </span>
                  )}
                </h2>
                <button type="button" onClick={() => fileInputRef.current?.click()}
                  style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--gold)', background: 'rgba(245,158,11,0.08)', color: 'var(--gold)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  + Ajouter des photos
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFileSelect} style={{ display: 'none' }} />
              </div>

              {totalImages === 0 ? (
                <div onClick={() => fileInputRef.current?.click()}
                  style={{ border: '2px dashed var(--dark-border)', borderRadius: 12, padding: '40px 24px', textAlign: 'center', cursor: 'pointer', transition: 'border-color 0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(245,158,11,0.4)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--dark-border)'}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>📷</div>
                  <p style={{ color: 'var(--gray-3)', fontSize: 14, marginBottom: 4 }}>Cliquez pour ajouter des photos</p>
                  <p style={{ color: 'var(--gray-4)', fontSize: 12 }}>JPG, PNG, WEBP — plusieurs fichiers acceptés</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16 }}>

                  {existingImages.map(img => (
                    <div key={img.id} style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', background: 'var(--dark-3)', border: '1px solid var(--dark-border)' }}>
                      <img src={img.image} alt={img.caption || 'Photo'}
                        style={{ width: '100%', height: 140, objectFit: 'cover', display: 'block' }} />
                      {img.caption && (
                        <div style={{ padding: '6px 10px', fontSize: 12, color: 'var(--gray-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {img.caption}
                        </div>
                      )}
                      <button type="button" onClick={() => removeExisting(img.id)}
                        style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(239,68,68,0.9)', border: 'none', borderRadius: 6, color: '#fff', width: 28, height: 28, cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>
                        ×
                      </button>
                      <span style={{ position: 'absolute', top: 8, left: 8, background: 'rgba(16,185,129,0.85)', borderRadius: 4, fontSize: 10, color: '#fff', padding: '2px 6px', fontWeight: 600 }}>
                        ✓ Enregistrée
                      </span>
                    </div>
                  ))}

                  {pendingImages.map((img, index) => (
                    <div key={index} style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', background: 'var(--dark-3)', border: '1px solid rgba(245,158,11,0.3)' }}>
                      <img src={img.preview} alt="preview"
                        style={{ width: '100%', height: 140, objectFit: 'cover', display: 'block' }} />
                      <div style={{ padding: '6px 10px' }}>
                        <input type="text" placeholder="Légende (optionnel)" value={img.caption}
                          onChange={e => updatePendingCaption(index, e.target.value)}
                          style={{ width: '100%', background: 'none', border: 'none', borderBottom: '1px solid var(--dark-border)', color: 'var(--white)', fontSize: 12, padding: '2px 0', outline: 'none' }} />
                      </div>
                      <button type="button" onClick={() => removePending(index)}
                        style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(239,68,68,0.9)', border: 'none', borderRadius: 6, color: '#fff', width: 28, height: 28, cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>
                        ×
                      </button>
                      <span style={{ position: 'absolute', top: 8, left: 8, background: 'rgba(245,158,11,0.85)', borderRadius: 4, fontSize: 10, color: '#000', padding: '2px 6px', fontWeight: 600 }}>
                        En attente
                      </span>
                    </div>
                  ))}

                  <div onClick={() => fileInputRef.current?.click()}
                    style={{ height: 140, border: '2px dashed var(--dark-border)', borderRadius: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--gray-4)', fontSize: 13, gap: 8, transition: 'border-color 0.2s' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(245,158,11,0.4)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--dark-border)'}>
                    <span style={{ fontSize: 24 }}>+</span>
                    Ajouter
                  </div>
                </div>
              )}

              {pendingImages.length > 0 && (
                <p style={{ marginTop: 12, fontSize: 12, color: 'var(--gray-4)' }}>
                  💡 {pendingImages.length} photo{pendingImages.length > 1 ? 's' : ''} sera{pendingImages.length > 1 ? 'ont' : ''} uploadée{pendingImages.length > 1 ? 's' : ''} à la sauvegarde du rapport.
                </p>
              )}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 12 }}>
              <button type="button" className="btn-secondary" onClick={() => navigate(`/projects/${projectId}`)}>
                Annuler
              </button>
              <button type="submit" className="btn-primary" disabled={loading || uploadingImages}>
                {loading || uploadingImages
                  ? `⏳ ${uploadingImages ? 'Upload photos...' : 'Enregistrement...'}`
                  : isEditing ? '✅ Mettre à jour' : '✅ Créer le rapport'}
              </button>
            </div>

          </form>
        </div>
      </div>
    </AppLayout>
  );
}