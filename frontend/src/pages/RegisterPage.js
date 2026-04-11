import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authAPI } from '../services/api';
import toast from 'react-hot-toast';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1=form, 2=otp
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [form, setForm] = useState({ full_name: '', company_name: '', email: '', password: '', password_confirm: '' });
  const [otp, setOtp] = useState(['', '', '', '', '', '']);

  const handleChange = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleRegister = async (e) => {
    e.preventDefault();
    if (form.password !== form.password_confirm) { toast.error('Les mots de passe ne correspondent pas'); return; }
    setLoading(true);
    try {
      await authAPI.register(form);
      setEmail(form.email);
      toast.success('Code envoyé à votre email !');
      setStep(2);
    } catch (err) {
      const errors = err.response?.data;
      if (errors) {
        Object.values(errors).flat().forEach(msg => toast.error(msg));
      } else {
        toast.error('Erreur lors de l\'inscription');
      }
    } finally { setLoading(false); }
  };

  const handleOTPChange = (i, val) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...otp];
    next[i] = val;
    setOtp(next);
    if (val && i < 5) document.getElementById(`otp-${i+1}`)?.focus();
  };

  const handleOTPKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !otp[i] && i > 0) document.getElementById(`otp-${i-1}`)?.focus();
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    const code = otp.join('');
    if (code.length !== 6) { toast.error('Entrez le code à 6 chiffres'); return; }
    setLoading(true);
    try {
      await authAPI.verifyOTP({ email, code, purpose: 'verify' });
      toast.success('Compte vérifié ! Vous pouvez vous connecter.');
      navigate('/login');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Code invalide ou expiré');
    } finally { setLoading(false); }
  };

  const handleResend = async () => {
    try {
      await authAPI.resendOTP({ email, purpose: 'verify' });
      toast.success('Nouveau code envoyé !');
    } catch { toast.error('Erreur lors du renvoi'); }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: 'var(--dark)' }}>
      {/* Left panel */}
      <div style={{
        flex: 1, display: 'none',
        background: 'linear-gradient(135deg, var(--dark-2) 0%, var(--dark-3) 100%)',
        alignItems: 'center', justifyContent: 'center',
        padding: 60,
        position: 'relative', overflow: 'hidden',
      }} className="left-panel">
        <div style={{
          position: 'absolute', top: -100, right: -100,
          width: 400, height: 400,
          background: 'radial-gradient(circle, rgba(245,158,11,0.15) 0%, transparent 70%)',
          borderRadius: '50%',
        }}/>
        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 64, marginBottom: 24 }}>🏗️</div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 800, marginBottom: 16 }}>
            Rejoignez <span style={{ color: 'var(--gold)' }}>Chantier360</span>
          </h2>
          <p style={{ color: 'var(--gray-3)', lineHeight: 1.7, fontSize: 16 }}>
            La plateforme qui révolutionne la gestion des projets BTP au Mali.
          </p>
        </div>
      </div>

      {/* Right panel - Form */}
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '40px 24px',
      }}>
        <div className="animate-fade-in" style={{ width: '100%', maxWidth: 440 }}>
          {/* Logo */}
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 40 }}>
            <div style={{ width: 36, height: 36, background: 'var(--gold)', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1A1A2E" strokeWidth="2.5">
                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22"/>
              </svg>
            </div>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 20 }}>
              Chantier<span style={{ color: 'var(--gold)' }}>360</span>
            </span>
          </Link>

          {step === 1 ? (
            <>
              <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Créer un compte</h1>
              <p style={{ color: 'var(--gray-3)', marginBottom: 32, fontSize: 15 }}>Commencez à gérer vos projets BTP</p>

              <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="input-group">
                  <label className="input-label">Nom complet *</label>
                  <input className="input-field" name="full_name" placeholder="Moussa Traoré" value={form.full_name} onChange={handleChange} required />
                </div>
                <div className="input-group">
                  <label className="input-label">Nom de l'entreprise *</label>
                  <input className="input-field" name="company_name" placeholder="SEEBA Construction SARL" value={form.company_name} onChange={handleChange} required />
                </div>
                <div className="input-group">
                  <label className="input-label">Email *</label>
                  <input className="input-field" name="email" type="email" placeholder="moussa@seeba.ml" value={form.email} onChange={handleChange} required />
                </div>
                <div className="input-group">
                  <label className="input-label">Mot de passe *</label>
                  <input className="input-field" name="password" type="password" placeholder="8 caractères minimum" value={form.password} onChange={handleChange} required minLength={8} />
                </div>
                <div className="input-group">
                  <label className="input-label">Confirmer le mot de passe *</label>
                  <input className="input-field" name="password_confirm" type="password" placeholder="Répétez le mot de passe" value={form.password_confirm} onChange={handleChange} required />
                </div>

                <button type="submit" className="btn-primary" disabled={loading} style={{ marginTop: 8 }}>
                  {loading ? <span className="animate-spin">⏳</span> : null}
                  {loading ? 'Création en cours...' : 'Créer mon compte'}
                </button>
              </form>

              <div className="divider" style={{ margin: '24px 0' }}>ou</div>

              <button className="btn-secondary" onClick={() => toast('Google OAuth — configurez vos credentials dans .env')}>
                <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                Continuer avec Google
              </button>

              <p style={{ textAlign: 'center', marginTop: 24, color: 'var(--gray-3)', fontSize: 14 }}>
                Déjà un compte ?{' '}
                <Link to="/login" style={{ color: 'var(--gold)', fontWeight: 500 }}>Se connecter</Link>
              </p>
            </>
          ) : (
            <>
              <div style={{ textAlign: 'center', marginBottom: 32 }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>📧</div>
                <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Vérifiez votre email</h1>
                <p style={{ color: 'var(--gray-3)', fontSize: 15 }}>
                  Code envoyé à <strong style={{ color: 'var(--white)' }}>{email}</strong>
                </p>
              </div>

              <form onSubmit={handleVerify}>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 32 }}>
                  {otp.map((digit, i) => (
                    <input key={i} id={`otp-${i}`}
                      type="text" maxLength={1} value={digit}
                      onChange={e => handleOTPChange(i, e.target.value)}
                      onKeyDown={e => handleOTPKeyDown(i, e)}
                      style={{
                        width: 52, height: 60,
                        textAlign: 'center',
                        fontSize: 24, fontWeight: 700,
                        background: 'var(--dark-3)',
                        border: `2px solid ${digit ? 'var(--gold)' : 'var(--dark-border)'}`,
                        borderRadius: 'var(--radius)',
                        color: 'var(--white)',
                        transition: 'border-color 0.2s',
                        outline: 'none',
                      }}
                    />
                  ))}
                </div>

                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? 'Vérification...' : 'Vérifier mon compte'}
                </button>
              </form>

              <div style={{ textAlign: 'center', marginTop: 24 }}>
                <p style={{ color: 'var(--gray-3)', fontSize: 14 }}>
                  Pas reçu le code ?{' '}
                  <button onClick={handleResend} style={{ background: 'none', color: 'var(--gold)', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
                    Renvoyer
                  </button>
                </p>
                <button onClick={() => setStep(1)} style={{ background: 'none', color: 'var(--gray-4)', fontSize: 13, marginTop: 8, cursor: 'pointer' }}>
                  ← Modifier mon email
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
