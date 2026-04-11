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

  const Spinner = () => (
    <span style={{ width:18, height:18, border:'2px solid #0D0D1A', borderTopColor:'transparent', borderRadius:'50%', display:'inline-block', animation:'spin 1s linear infinite' }} />
  );

  return (
    <AuthLayout title="Bon retour" subtitle="Connectez-vous à votre espace Chantier360">
      <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:20 }}>
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
        <div style={{ textAlign:'right', marginTop:-8 }}>
          <Link to="/forgot-password" style={{ fontSize:13, color:'#F59E0B', textDecoration:'none' }}>Mot de passe oublié ?</Link>
        </div>
        {errors.non_field_errors && (
          <div style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:8, padding:'10px 14px', fontSize:14, color:'#EF4444' }}>
            {errors.non_field_errors}
          </div>
        )}
        <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading}>
          {loading ? <><Spinner /> Connexion...</> : 'Se connecter →'}
        </button>
        <p style={{ textAlign:'center', fontSize:14, color:'#6B7280' }}>
          Pas de compte ?{' '}
          <Link to="/register" style={{ color:'#F59E0B', textDecoration:'none', fontWeight:600 }}>Créer un compte</Link>
        </p>
      </form>
    </AuthLayout>
  );
}
