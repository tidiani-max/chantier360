import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authAPI } from '../services/api';
import toast from 'react-hot-toast';

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [passwords, setPasswords] = useState({ new_password: '', confirm_password: '' });

  const handleSendOTP = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await authAPI.forgotPassword({ email });
      toast.success('Code envoyé à votre email');
      setStep(2);
    } catch { toast.error('Erreur lors de l\'envoi'); }
    finally { setLoading(false); }
  };

  const handleOTPChange = (i, val) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...otp];
    next[i] = val;
    setOtp(next);
    if (val && i < 5) document.getElementById(`otp-r-${i+1}`)?.focus();
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    const code = otp.join('');
    if (code.length !== 6) { toast.error('Entrez le code complet'); return; }
    setLoading(true);
    try {
      await authAPI.verifyOTP({ email, code, purpose: 'reset' });
      setStep(3);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Code invalide');
    } finally { setLoading(false); }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (passwords.new_password !== passwords.confirm_password) { toast.error('Les mots de passe ne correspondent pas'); return; }
    setLoading(true);
    try {
      await authAPI.resetPassword({ email, code: otp.join(''), ...passwords });
      toast.success('Mot de passe réinitialisé avec succès !');
      navigate('/login');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erreur lors de la réinitialisation');
    } finally { setLoading(false); }
  };

  const steps = ['Email', 'Code OTP', 'Nouveau mot de passe'];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div className="animate-fade-in" style={{ width: '100%', maxWidth: 440 }}>
        {/* Logo */}
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 40, justifyContent: 'center' }}>
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

        {/* Progress steps */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 40 }}>
          {steps.map((s, i) => (
            <React.Fragment key={i}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: i + 1 <= step ? 'var(--gold)' : 'var(--dark-3)',
                  border: `2px solid ${i + 1 <= step ? 'var(--gold)' : 'var(--dark-border)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 700,
                  color: i + 1 <= step ? 'var(--dark)' : 'var(--gray-4)',
                  transition: 'all 0.3s',
                }}>
                  {i + 1 < step ? '✓' : i + 1}
                </div>
                <span style={{ fontSize: 11, color: i + 1 <= step ? 'var(--gold)' : 'var(--gray-4)', whiteSpace: 'nowrap' }}>{s}</span>
              </div>
              {i < steps.length - 1 && (
                <div style={{ flex: 1, height: 2, background: i + 1 < step ? 'var(--gold)' : 'var(--dark-border)', margin: '0 8px', marginBottom: 22, transition: 'background 0.3s' }} />
              )}
            </React.Fragment>
          ))}
        </div>

        <div className="card">
          {step === 1 && (
            <>
              <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 800, marginBottom: 8 }}>Mot de passe oublié ?</h1>
              <p style={{ color: 'var(--gray-3)', marginBottom: 28, fontSize: 14 }}>Entrez votre email pour recevoir un code de réinitialisation</p>
              <form onSubmit={handleSendOTP} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="input-group">
                  <label className="input-label">Email</label>
                  <input className="input-field" type="email" placeholder="votre@email.com" value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
                </div>
                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? 'Envoi...' : 'Envoyer le code'}
                </button>
              </form>
            </>
          )}

          {step === 2 && (
            <>
              <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 800, marginBottom: 8 }}>Entrez le code</h1>
              <p style={{ color: 'var(--gray-3)', marginBottom: 28, fontSize: 14 }}>Code envoyé à <strong style={{ color: 'var(--white)' }}>{email}</strong></p>
              <form onSubmit={handleVerifyOTP}>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 28 }}>
                  {otp.map((digit, i) => (
                    <input key={i} id={`otp-r-${i}`} type="text" maxLength={1} value={digit}
                      onChange={e => handleOTPChange(i, e.target.value)}
                      onKeyDown={e => { if (e.key === 'Backspace' && !otp[i] && i > 0) document.getElementById(`otp-r-${i-1}`)?.focus(); }}
                      style={{
                        width: 48, height: 56, textAlign: 'center', fontSize: 22, fontWeight: 700,
                        background: 'var(--dark-3)', border: `2px solid ${digit ? 'var(--gold)' : 'var(--dark-border)'}`,
                        borderRadius: 'var(--radius)', color: 'var(--white)', outline: 'none', transition: 'border-color 0.2s',
                      }}
                    />
                  ))}
                </div>
                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? 'Vérification...' : 'Valider le code'}
                </button>
              </form>
            </>
          )}

          {step === 3 && (
            <>
              <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 800, marginBottom: 8 }}>Nouveau mot de passe</h1>
              <p style={{ color: 'var(--gray-3)', marginBottom: 28, fontSize: 14 }}>Choisissez un nouveau mot de passe sécurisé</p>
              <form onSubmit={handleResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="input-group">
                  <label className="input-label">Nouveau mot de passe</label>
                  <input className="input-field" type="password" placeholder="8 caractères minimum"
                    value={passwords.new_password} onChange={e => setPasswords(p => ({ ...p, new_password: e.target.value }))} required minLength={8} />
                </div>
                <div className="input-group">
                  <label className="input-label">Confirmer le mot de passe</label>
                  <input className="input-field" type="password" placeholder="Répétez le mot de passe"
                    value={passwords.confirm_password} onChange={e => setPasswords(p => ({ ...p, confirm_password: e.target.value }))} required />
                </div>
                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? 'Réinitialisation...' : 'Réinitialiser le mot de passe'}
                </button>
              </form>
            </>
          )}
        </div>

        <p style={{ textAlign: 'center', marginTop: 24, fontSize: 14, color: 'var(--gray-3)' }}>
          <Link to="/login" style={{ color: 'var(--gold)' }}>← Retour à la connexion</Link>
        </p>
      </div>
    </div>
  );
}
