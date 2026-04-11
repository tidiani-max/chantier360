import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { authAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import AuthLayout from '../../components/layout/AuthLayout';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    setForm(p => ({ ...p, [e.target.name]: e.target.value }));
    if (errors[e.target.name]) setErrors(p => ({ ...p, [e.target.name]: '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await authAPI.login(form);
      login(res.data.tokens, res.data.user);
      toast.success('Connexion réussie !');
      navigate('/dashboard');
    } catch (err) {
      const data = err.response?.data;
      if (data && typeof data === 'object') setErrors(data);
      else toast.error('Email ou mot de passe incorrect');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = () => {
    toast('Google OAuth non configuré. Ajoutez REACT_APP_GOOGLE_CLIENT_ID dans frontend/.env', { icon: 'ℹ️' });
  };

  const Spinner = () => (
    <span style={{ width: 18, height: 18, border: '2px solid #0D0D1A', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin 1s linear infinite' }} />
  );

  return (
    <AuthLayout title="Bon retour" subtitle="Connectez-vous à votre espace Chantier360">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div className="input-group">
          <label className="input-label">Email</label>
          <input name="email" type="email" className={`input-field ${errors.email ? 'error' : ''}`}
            placeholder="votre@email.com" value={form.email} onChange={handleChange} required />
          {errors.email && <span className="input-error">{errors.email}</span>}
        </div>
        <div className="input-group">
          <label className="input-label">Mot de passe</label>
          <input name="password" type="password" className={`input-field ${errors.password ? 'error' : ''}`}
            placeholder="••••••••" value={form.password} onChange={handleChange} required />
          {errors.password && <span className="input-error">{errors.password}</span>}
        </div>
        <div style={{ textAlign: 'right', marginTop: -8 }}>
          <Link to="/forgot-password" style={{ fontSize: 13, color: '#F59E0B', textDecoration: 'none' }}>Mot de passe oublié ?</Link>
        </div>
        {errors.non_field_errors && (
          <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', fontSize: 14, color: '#EF4444' }}>
            {errors.non_field_errors}
          </div>
        )}
        <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading}>
          {loading ? <><Spinner /> Connexion...</> : 'Se connecter →'}
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.07)' }} />
          <span style={{ fontSize: 13, color: '#6B7280' }}>ou</span>
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.07)' }} />
        </div>
        <button type="button" className="btn btn-ghost btn-full" onClick={handleGoogle}>
          <svg width="18" height="18" viewBox="0 0 24 24" style={{ marginRight: 8 }}>
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continuer avec Google
        </button>
        <p style={{ textAlign: 'center', fontSize: 14, color: '#6B7280' }}>
          Pas de compte ?{' '}
          <Link to="/register" style={{ color: '#F59E0B', textDecoration: 'none', fontWeight: 600 }}>Créer un compte</Link>
        </p>
      </form>
    </AuthLayout>
  );
}