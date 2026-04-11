import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ email: '', password: '' });

  const handleChange = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleLogin = async (e) => {
  e.preventDefault();
  setLoading(true);
  try {
    const res = await authAPI.login(form);
    login(res.data.tokens, res.data.user);
    toast.success(`Bienvenue, ${res.data.user.full_name} !`);
    navigate('/dashboard');
  } catch (err) {
    const errors = err.response?.data;
    const msg = errors?.non_field_errors?.[0] || '';
    if (msg.includes('vérifier votre email')) {
      toast.error('Compte non vérifié — un nouveau code vous a été envoyé.');
      // Resend OTP automatically then redirect to verify page
      try {
        await authAPI.resendOTP({ email: form.email, purpose: 'verify' });
      } catch {}
      navigate('/verify-email', { state: { email: form.email } });
    } else if (errors?.non_field_errors) {
      toast.error(errors.non_field_errors[0]);
    } else {
      toast.error('Erreur de connexion');
    }
  } finally { setLoading(false); }
};

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: 'var(--dark)' }}>
      {/* Left decorative panel */}
      <div style={{
        flex: 1,
        background: 'linear-gradient(135deg, var(--dark-2) 0%, var(--dark-3) 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 60, position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', bottom: -150, left: -150,
          width: 500, height: 500,
          background: 'radial-gradient(circle, rgba(245,158,11,0.12) 0%, transparent 70%)',
          borderRadius: '50%',
        }}/>
        <div style={{ position: 'relative', zIndex: 1, maxWidth: 380 }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 60 }}>
            <div style={{ width: 40, height: 40, background: 'var(--gold)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1A1A2E" strokeWidth="2.5">
                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
            </div>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22 }}>
              Chantier<span style={{ color: 'var(--gold)' }}>360</span>
            </span>
          </Link>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 36, fontWeight: 800, lineHeight: 1.15, marginBottom: 20 }}>
            Gérez vos chantiers<br />
            <span style={{ color: 'var(--gold)' }}>intelligemment.</span>
          </h2>
          <p style={{ color: 'var(--gray-3)', lineHeight: 1.7, fontSize: 16, marginBottom: 40 }}>
            Analyse automatique des contrats, suivi de projets et gestion documentaire pour les entreprises BTP au Mali.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {['Analyse IA de contrats en 32 points', 'Gestion multi-projets', 'Export PDF et Word', 'Espace entreprise sécurisé'].map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--gray-2)', fontSize: 14 }}>
                <div style={{ width: 20, height: 20, background: 'rgba(245,158,11,0.2)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="var(--gold)" strokeWidth="2">
                    <polyline points="2 6 5 9 10 3"/>
                  </svg>
                </div>
                {f}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right - Login form */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
        <div className="animate-fade-in" style={{ width: '100%', maxWidth: 420 }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 800, marginBottom: 8 }}>Bon retour 👋</h1>
          <p style={{ color: 'var(--gray-3)', marginBottom: 36, fontSize: 15 }}>Connectez-vous à votre espace</p>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="input-group">
              <label className="input-label">Email</label>
              <input className="input-field" name="email" type="email" placeholder="moussa@entreprise.ml"
                value={form.email} onChange={handleChange} required autoFocus />
            </div>
            <div className="input-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="input-label">Mot de passe</label>
                <Link to="/forgot-password" style={{ fontSize: 13, color: 'var(--gold)' }}>Mot de passe oublié ?</Link>
              </div>
              <input className="input-field" name="password" type="password" placeholder="Votre mot de passe"
                value={form.password} onChange={handleChange} required />
            </div>

            <button type="submit" className="btn-primary" disabled={loading} style={{ marginTop: 8 }}>
              {loading ? '⏳ Connexion...' : 'Se connecter'}
            </button>
          </form>

          <div className="divider" style={{ margin: '24px 0' }}>ou</div>

          <button className="btn-secondary" onClick={() => toast('Configurez Google OAuth dans votre .env')}>
            <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            Continuer avec Google
          </button>

          <p style={{ textAlign: 'center', marginTop: 28, color: 'var(--gray-3)', fontSize: 14 }}>
            Pas encore de compte ?{' '}
            <Link to="/register" style={{ color: 'var(--gold)', fontWeight: 500 }}>Créer un compte</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
