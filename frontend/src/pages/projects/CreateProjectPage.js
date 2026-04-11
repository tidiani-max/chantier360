import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { projectsAPI } from '../../services/api';
import AppLayout from '../../components/layout/AppLayout';

// ✅ Valeurs alignées avec TYPE_CHOICES du modèle Django
const PROJECT_TYPES = [
  { value: 'batiment',       label: '🏗️ Bâtiment'                    },
  { value: 'route',          label: '🛣️ Route / VRD'                  },
  { value: 'aep',            label: "💧 Adduction d'eau potable (AEP)" },
  { value: 'assainissement', label: '🚰 Assainissement'                },
  { value: 'pont',           label: '🌉 Pont'                          },
  { value: 'hydraulique',    label: '🌊 Hydraulique'                   },
  { value: 'electricite',    label: '⚡ Électricité'                   },
  { value: 'autre',          label: '📦 Autre'                         },
];

const STATUS_OPTIONS = [
  { value: 'planifie', label: 'Planifié'  },
  { value: 'en_cours', label: 'En cours'  },
  { value: 'suspendu', label: 'Suspendu'  },
  { value: 'termine',  label: 'Terminé'   },
];

export default function CreateProjectPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '', description: '', project_type: 'batiment',
    location: '', status: 'planifie',
    start_date: '', end_date: '', budget: '',
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    setForm(p => ({ ...p, [e.target.name]: e.target.value }));
    if (errors[e.target.name]) setErrors(p => ({ ...p, [e.target.name]: '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});
    setLoading(true);

    const payload = { ...form };
    if (!payload.start_date) delete payload.start_date;
    if (!payload.end_date)   delete payload.end_date;
    if (!payload.budget)     delete payload.budget;

    try {
      const res = await projectsAPI.create(payload);
      toast.success('Projet créé avec succès !');
      navigate(`/projects/${res.data.id}`);
    } catch (err) {
      const data = err.response?.data;
      if (data && typeof data === 'object') {
        // Affiche les erreurs de champ inline + toast pour les erreurs non-champ
        setErrors(data);
        const nonField = data.non_field_errors || data.detail;
        if (nonField) toast.error(Array.isArray(nonField) ? nonField[0] : nonField);
        else toast.error('Corrigez les erreurs dans le formulaire.');
      } else {
        toast.error('Erreur lors de la création du projet.');
      }
    } finally {
      setLoading(false);
    }
  };

  const FieldError = ({ name }) =>
    errors[name] ? (
      <span style={{ fontSize: 12, color: '#EF4444', marginTop: 4, display: 'block' }}>
        {Array.isArray(errors[name]) ? errors[name][0] : errors[name]}
      </span>
    ) : null;

  return (
    <AppLayout>
      <div style={{ padding: '32px 40px', maxWidth: 700 }} className="animate-fade-in">

        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <button
            onClick={() => navigate('/projects')}
            style={{ background: 'none', border: 'none', color: '#6B7280', cursor: 'pointer', fontSize: 14, marginBottom: 12, fontFamily: 'Barlow', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            ← Retour aux projets
          </button>
          <h1 style={{ fontFamily: 'Bebas Neue', fontSize: 42, color: '#fff', letterSpacing: 1, margin: 0 }}>
            Nouveau <span style={{ color: '#F59E0B' }}>Projet</span>
          </h1>
          <p style={{ color: '#6B7280', margin: '4px 0 0' }}>Remplissez les informations de votre projet</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

            {/* Nom */}
            <div className="input-group">
              <label className="input-label">Nom du projet *</label>
              <input
                name="name"
                className={`input-field${errors.name ? ' error' : ''}`}
                placeholder="Ex: Construction école Bamako Coura"
                value={form.name}
                onChange={handleChange}
                required
              />
              <FieldError name="name" />
            </div>

            {/* Type + Statut */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <div className="input-group">
                <label className="input-label">Type de travaux *</label>
                <select name="project_type" className="input-field" value={form.project_type} onChange={handleChange}>
                  {PROJECT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <FieldError name="project_type" />
              </div>
              <div className="input-group">
                <label className="input-label">Statut</label>
                <select name="status" className="input-field" value={form.status} onChange={handleChange}>
                  {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
                <FieldError name="status" />
              </div>
            </div>

            {/* Localisation */}
            <div className="input-group">
              <label className="input-label">Localisation</label>
              <input
                name="location"
                className="input-field"
                placeholder="Ex: Bamako, Commune IV, Mali"
                value={form.location}
                onChange={handleChange}
              />
            </div>

            {/* Description */}
            <div className="input-group">
              <label className="input-label">Description</label>
              <textarea
                name="description"
                className="input-field"
                placeholder="Description du projet, objectifs, contexte..."
                value={form.description}
                onChange={handleChange}
                rows={4}
                style={{ resize: 'vertical' }}
              />
            </div>

            {/* Dates */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <div className="input-group">
                <label className="input-label">Date de début</label>
                <input name="start_date" type="date" className="input-field" value={form.start_date} onChange={handleChange} />
              </div>
              <div className="input-group">
                <label className="input-label">Date de fin prévue</label>
                <input name="end_date" type="date" className="input-field" value={form.end_date} onChange={handleChange} />
                <FieldError name="end_date" />
              </div>
            </div>

            {/* Budget */}
            <div className="input-group">
              <label className="input-label">Budget prévisionnel (FCFA)</label>
              <input
                name="budget"
                type="number"
                className="input-field"
                placeholder="Ex: 50 000 000"
                value={form.budget}
                onChange={handleChange}
                min="0"
              />
              <FieldError name="budget" />
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 12, paddingTop: 8 }}>
              <button type="submit" className="btn btn-primary btn-lg" disabled={loading} style={{ flex: 1 }}>
                {loading ? '⏳ Création en cours...' : '✓ Créer le projet'}
              </button>
              <button type="button" className="btn btn-ghost btn-lg" onClick={() => navigate('/projects')}>
                Annuler
              </button>
            </div>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}