import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { authAPI } from '../../services/api';
import AuthLayout from '../../components/layout/AuthLayout';

export default function ResetPasswordPage() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const [form, setForm] = useState({ new_password:'', confirm_password:'' });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!state?.email || !state?.code) navigate('/forgot-password');
  }, [state, navigate]);

  const handleChange = (e) => {
    setForm(p => ({ ...p, [e.target.name]: e.target.value }));
    if (errors[e.target.name]) setErrors(p => ({ ...p, [e.target.name]: '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.new_password !== form.confirm_password) {
      return setErrors({ confirm_password: 'Les mots de passe ne correspondent pas' });
    }
    setLoading(true);
    try {
      await authAPI.resetPassword({ email: state.email, code: state.code, ...form });
      toast.success('Mot de passe réinitialisé avec succès !');
      navigate('/login');
    } catch (err) {
      const data = err.response?.data;
      if (data && typeof data === 'object') setErrors(data);
      else toast.error('Erreur lors de la réinitialisation');
    } finally { setLoading(false); }
  };

  return (
    <AuthLayout title="Nouveau mot de passe" subtitle="Choisissez un nouveau mot de passe sécurisé">
      <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:20 }}>
        {[
          { name:'new_password', label:'Nouveau mot de passe', placeholder:'Min. 8 caractères' },
          { name:'confirm_password', label:'Confirmer le mot de passe', placeholder:'••••••••' },
        ].map(f => (
          <div key={f.name} className="input-group">
            <label className="input-label">{f.label}</label>
            <input name={f.name} type="password" className={`input-field ${errors[f.name] ? 'error' : ''}`}
              placeholder={f.placeholder} value={form[f.name]} onChange={handleChange} required minLength={8} />
            {errors[f.name] && <span className="input-error">{errors[f.name]}</span>}
          </div>
        ))}
        <button type="submit" className="btn btn-primary btn-full btn-lg" style={{ marginTop:8 }} disabled={loading}>
          {loading ? 'Mise à jour...' : 'Réinitialiser le mot de passe →'}
        </button>
      </form>
    </AuthLayout>
  );
}
