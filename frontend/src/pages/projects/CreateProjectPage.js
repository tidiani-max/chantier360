import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { projectsAPI } from '../../services/api';
import AppLayout from '../../components/layout/AppLayout';

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
      <span style={{ fontSize: 12, color: '#DC2626', marginTop: 4, display: 'block', fontWeight: 500 }}>
        {Array.isArray(errors[name]) ? errors[name][0] : errors[name]}
      </span>
    ) : null;

  // Reusable style for inputs to ensure visibility on white background
  const inputStyle = {
    width: '100%',
    padding: '12px',
    borderRadius: '8px',
    border: '1px solid #D1D5DB', // Mid-gray border
    backgroundColor: '#FFFFFF',
    color: '#111827', // Near black text
    fontSize: '14px',
    marginTop: '6px',
    boxSizing: 'border-box'
  };

  const labelStyle = {
    fontSize: '14px',
    fontWeight: '600',
    color: '#374151', // Dark gray
    display: 'block'
  };

  return (
    <AppLayout>
      <div style={{ padding: '32px 40px', maxWidth: 700, backgroundColor: '#FFFFFF' }} className="animate-fade-in">

        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <button
            onClick={() => navigate('/projects')}
            style={{ background: 'none', border: 'none', color: '#6B7280', cursor: 'pointer', fontSize: 14, marginBottom: 12, fontFamily: 'Barlow', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            ← Retour aux projets
          </button>
          {/* Changed color from #fff to #111827 */}
          <h1 style={{ fontFamily: 'Bebas Neue', fontSize: 42, color: '#111827', letterSpacing: 1, margin: 0 }}>
            Nouveau <span style={{ color: '#F59E0B' }}>Projet</span>
          </h1>
          <p style={{ color: '#6B7280', margin: '4px 0 0' }}>Remplissez les informations de votre projet</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="card" style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: 24, 
            padding: '24px', 
            border: '1px solid #E5E7EB', 
            borderRadius: '12px',
            backgroundColor: '#FDFDFD' 
          }}>

            {/* Nom */}
            <div className="input-group">
              <label style={labelStyle}>Nom du projet *</label>
              <input
                name="name"
                style={{...inputStyle, borderColor: errors.name ? '#EF4444' : '#D1D5DB'}}
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
                <label style={labelStyle}>Type de travaux *</label>
                <select name="project_type" style={inputStyle} value={form.project_type} onChange={handleChange}>
                  {PROJECT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <FieldError name="project_type" />
              </div>
              <div className="input-group">
                <label style={labelStyle}>Statut</label>
                <select name="status" style={inputStyle} value={form.status} onChange={handleChange}>
                  {STATUS_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
                <FieldError name="status" />
              </div>
            </div>

            {/* Localisation */}
            <div className="input-group">
              <label style={labelStyle}>Localisation</label>
              <input
                name="location"
                style={inputStyle}
                placeholder="Ex: Bamako, Commune IV, Mali"
                value={form.location}
                onChange={handleChange}
              />
            </div>

            {/* Description */}
            <div className="input-group">
              <label style={labelStyle}>Description</label>
              <textarea
                name="description"
                style={{ ...inputStyle, minHeight: '100px', resize: 'vertical' }}
                placeholder="Description du projet, objectifs, contexte..."
                value={form.description}
                onChange={handleChange}
                rows={4}
              />
            </div>

            {/* Dates */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <div className="input-group">
                <label style={labelStyle}>Date de début</label>
                <input name="start_date" type="date" style={inputStyle} value={form.start_date} onChange={handleChange} />
              </div>
              <div className="input-group">
                <label style={labelStyle}>Date de fin prévue</label>
                <input name="end_date" type="date" style={inputStyle} value={form.end_date} onChange={handleChange} />
                <FieldError name="end_date" />
              </div>
            </div>

            {/* Budget */}
            <div className="input-group">
              <label style={labelStyle}>Budget prévisionnel (FCFA)</label>
              <input
                name="budget"
                type="number"
                style={inputStyle}
                placeholder="Ex: 50 000 000"
                value={form.budget}
                onChange={handleChange}
                min="0"
              />
              <FieldError name="budget" />
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 12, paddingTop: 8 }}>
              <button 
                type="submit" 
                disabled={loading} 
                style={{ 
                  flex: 2, 
                  padding: '14px', 
                  borderRadius: '8px', 
                  border: 'none', 
                  background: '#F59E0B', 
                  color: '#FFFFFF', 
                  fontWeight: '700', 
                  fontSize: '16px',
                  cursor: loading ? 'not-allowed' : 'pointer' 
                }}
              >
                {loading ? '⏳ Création...' : '✓ Créer le projet'}
              </button>
              <button 
                type="button" 
                onClick={() => navigate('/projects')}
                style={{ 
                  flex: 1, 
                  padding: '14px', 
                  borderRadius: '8px', 
                  border: '1px solid #D1D5DB', 
                  background: '#FFFFFF', 
                  color: '#374151', 
                  fontWeight: '600',
                  cursor: 'pointer' 
                }}
              >
                Annuler
              </button>
            </div>
          </div>
        </form>
      </div>
    </AppLayout>
  ); 
}