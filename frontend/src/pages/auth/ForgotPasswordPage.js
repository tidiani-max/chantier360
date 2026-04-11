import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { authAPI } from '../../services/api';
import AuthLayout from '../../components/layout/AuthLayout';

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await authAPI.forgotPassword({ email });
      toast.success('Code envoyé ! Vérifiez votre email.');
      navigate('/verify-otp', { state: { email, purpose: 'reset' } });
    } catch { toast.error('Erreur lors de l\'envoi'); }
    finally { setLoading(false); }
  };

  return (
    <AuthLayout title="Mot de passe oublié" subtitle="Entrez votre email pour recevoir un code de réinitialisation">
      <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:24 }}>
        <div className="input-group">
          <label className="input-label">Email</label>
          <input type="email" className="input-field" placeholder="votre@email.com"
            value={email} onChange={e => setEmail(e.target.value)} required />
        </div>
        <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading}>
          {loading ? 'Envoi...' : 'Envoyer le code →'}
        </button>
        <p style={{ textAlign:'center', fontSize:14, color:'#6B7280' }}>
          <Link to="/login" style={{ color:'#F59E0B', textDecoration:'none' }}>← Retour à la connexion</Link>
        </p>
      </form>
    </AuthLayout>
  );
}
