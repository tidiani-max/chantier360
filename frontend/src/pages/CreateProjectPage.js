import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { projectsAPI } from '../services/api';
import { Sidebar } from './DashboardPage';
import toast from 'react-hot-toast';

export default function CreateProjectPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: '', description: '', project_type: 'batiment',
    location: '', status: 'planifie', start_date: '', end_date: '', budget: ''
  });

  const handleChange = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = { ...form };
      if (!payload.start_date) delete payload.start_date;
      if (!payload.end_date) delete payload.end_date;
      if (!payload.budget) delete payload.budget;
      const res = await projectsAPI.create(payload);
      toast.success('Projet créé avec succès !');
      navigate(`/projects/${res.data.id}`);
    } catch (err) {
      const errors = err.response?.data;
      if (errors) Object.values(errors).flat().forEach(msg => toast.error(msg));
      else toast.error('Erreur lors de la création');
    } finally { setLoading(false); }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--dark)' }}>
      <Sidebar active="projects" />
      <main style={{ marginLeft: 260, flex: 1, padding: '40px 36px' }}>
        <div className="animate-fade-in" style={{ maxWidth: 700 }}>
          <div style={{ marginBottom: 32 }}>
            <button onClick={() => navigate('/projects')} style={{ background: 'none', color: 'var(--gray-3)', fontSize: 14, cursor: 'pointer', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
              ← Retour aux projets
            </button>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 800, marginBottom: 6 }}>Nouveau projet</h1>
            <p style={{ color: 'var(--gray-3)', fontSize: 15 }}>Renseignez les informations de votre chantier</p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="card" style={{ marginBottom: 20 }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, marginBottom: 20, color: 'var(--gold)' }}>
                📋 Informations générales
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="input-group">
                  <label className="input-label">Nom du projet *</label>
                  <input className="input-field" name="name" placeholder="ex: Construction école primaire Koulikoro" value={form.name} onChange={handleChange} required />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div className="input-group">
                    <label className="input-label">Type de travaux *</label>
                    <select className="input-field" name="project_type" value={form.project_type} onChange={handleChange}>
                      <option value="batiment">🏢 Bâtiment</option>
                      <option value="route">🛣️ Route</option>
                      <option value="aep">💧 Adduction d'eau (AEP)</option>
                      <option value="assainissement">🚰 Assainissement</option>
                      <option value="pont">🌉 Pont</option>
                      <option value="autre">🔧 Autre</option>
                    </select>
                  </div>
                  <div className="input-group">
                    <label className="input-label">Statut</label>
                    <select className="input-field" name="status" value={form.status} onChange={handleChange}>
                      <option value="planifie">Planifié</option>
                      <option value="en_cours">En cours</option>
                      <option value="suspendu">Suspendu</option>
                      <option value="termine">Terminé</option>
                    </select>
                  </div>
                </div>
                <div className="input-group">
                  <label className="input-label">Localisation</label>
                  <input className="input-field" name="location" placeholder="ex: Koulikoro, Région de Koulikoro, Mali" value={form.location} onChange={handleChange} />
                </div>
                <div className="input-group">
                  <label className="input-label">Description</label>
                  <textarea className="input-field" name="description" placeholder="Description du projet, objectifs, contexte..." value={form.description} onChange={handleChange}
                    style={{ minHeight: 100, resize: 'vertical' }} />
                </div>
              </div>
            </div>

            <div className="card" style={{ marginBottom: 28 }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, marginBottom: 20, color: 'var(--gold)' }}>
                💰 Informations financières & calendrier
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                <div className="input-group">
                  <label className="input-label">Budget (FCFA)</label>
                  <input className="input-field" name="budget" type="number" placeholder="ex: 150000000" value={form.budget} onChange={handleChange} />
                </div>
                <div className="input-group">
                  <label className="input-label">Date de début</label>
                  <input className="input-field" name="start_date" type="date" value={form.start_date} onChange={handleChange} />
                </div>
                <div className="input-group">
                  <label className="input-label">Date de fin prévue</label>
                  <input className="input-field" name="end_date" type="date" value={form.end_date} onChange={handleChange} />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button type="button" className="btn-secondary" onClick={() => navigate('/projects')}>Annuler</button>
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? '⏳ Création...' : '✅ Créer le projet'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
