import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { authAPI } from '../services/api';
import toast from 'react-hot-toast';

export default function VerifyEmailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const email = location.state?.email || '';
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);

  const handleOTPChange = (i, val) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...otp];
    next[i] = val;
    setOtp(next);
    if (val && i < 5) document.getElementById(`otp-v-${i+1}`)?.focus();
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    const code = otp.join('');
    if (code.length !== 6) { toast.error('Entrez le code à 6 chiffres'); return; }
    setLoading(true);
    try {
      await authAPI.verifyOTP({ email, code, purpose: 'verify' });
      toast.success('Email vérifié ! Vous pouvez vous connecter.');
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

  if (!email) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--dark)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: 'var(--gray-3)', marginBottom: 16 }}>Aucun email trouvé.</p>
          <Link to="/login" style={{ color: 'var(--gold)' }}>← Retour à la connexion</Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div className="animate-fade-in" style={{ width: '100%', maxWidth: 440 }}>
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

        <div className="card">
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📧</div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 800, marginBottom: 8 }}>
              Vérifiez votre email
            </h1>
            <p style={{ color: 'var(--gray-3)', fontSize: 15 }}>
              Code envoyé à <strong style={{ color: 'var(--white)' }}>{email}</strong>
            </p>
          </div>

          <form onSubmit={handleVerify}>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 32 }}>
              {otp.map((digit, i) => (
                <input key={i} id={`otp-v-${i}`}
                  type="text" maxLength={1} value={digit}
                  onChange={e => handleOTPChange(i, e.target.value)}
                  onKeyDown={e => { if (e.key === 'Backspace' && !otp[i] && i > 0) document.getElementById(`otp-v-${i-1}`)?.focus(); }}
                  style={{
                    width: 52, height: 60,
                    textAlign: 'center', fontSize: 24, fontWeight: 700,
                    background: 'var(--dark-3)',
                    border: `2px solid ${digit ? 'var(--gold)' : 'var(--dark-border)'}`,
                    borderRadius: 'var(--radius)', color: 'var(--white)',
                    outline: 'none', transition: 'border-color 0.2s',
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
          </div>
        </div>

        <p style={{ textAlign: 'center', marginTop: 24, fontSize: 14 }}>
          <Link to="/login" style={{ color: 'var(--gold)' }}>← Retour à la connexion</Link>
        </p>
      </div>
    </div>
  );
}
