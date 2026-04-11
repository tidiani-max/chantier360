import React, { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { authAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import AuthLayout from '../../components/layout/AuthLayout';

export default function OTPPage() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const { login } = useAuth();
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const refs = useRef([]);

  const email = state?.email || '';
  const purpose = state?.purpose || 'verify';

  useEffect(() => {
    if (!email) navigate('/login');
  }, [email, navigate]);

  useEffect(() => {
    if (countdown > 0) {
      const t = setTimeout(() => setCountdown(c => c - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [countdown]);

  const handleChange = (i, val) => {
    if (!/^\d*$/.test(val)) return;
    const newOtp = [...otp];
    newOtp[i] = val.slice(-1);
    setOtp(newOtp);
    if (val && i < 5) refs.current[i + 1]?.focus();
  };

  const handleKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !otp[i] && i > 0) refs.current[i - 1]?.focus();
  };

  const handlePaste = (e) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setOtp(pasted.split(''));
      refs.current[5]?.focus();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const code = otp.join('');
    if (code.length !== 6) return toast.error('Entrez le code complet à 6 chiffres');
    setLoading(true);
    try {
      const res = await authAPI.verifyOTP({ email, code, purpose });
      if (purpose === 'verify') {
        login(res.data.tokens, res.data.user);
        toast.success('Email vérifié ! Bienvenue sur Chantier360 !');
        navigate('/dashboard');
      } else {
        toast.success('Code vérifié !');
        navigate('/reset-password', { state: { email, code } });
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Code invalide ou expiré');
      setOtp(['', '', '', '', '', '']);
      refs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      await authAPI.resendOTP({ email, purpose });
      toast.success('Nouveau code envoyé !');
      setCountdown(60);
      setOtp(['', '', '', '', '', '']);
      refs.current[0]?.focus();
    } catch { toast.error('Erreur envoi du code'); }
    finally { setResending(false); }
  };

  return (
    <AuthLayout
      title={purpose === 'verify' ? 'Vérifiez votre email' : 'Code de réinitialisation'}
      subtitle={`Un code à 6 chiffres a été envoyé à ${email}`}
    >
      <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:32 }}>
        <div style={{ display:'flex', justifyContent:'center', gap:12 }} onPaste={handlePaste}>
          {otp.map((digit, i) => (
            <input
              key={i}
              ref={el => refs.current[i] = el}
              type="text" inputMode="numeric"
              value={digit}
              onChange={e => handleChange(i, e.target.value)}
              onKeyDown={e => handleKeyDown(i, e)}
              style={{
                width: 52, height: 60,
                textAlign: 'center',
                fontSize: 28, fontWeight: 700,
                fontFamily: 'Bebas Neue',
                background: digit ? 'rgba(245,158,11,0.1)' : 'rgba(255,255,255,0.05)',
                border: `2px solid ${digit ? '#F59E0B' : 'rgba(255,255,255,0.1)'}`,
                borderRadius: 10,
                color: digit ? '#F59E0B' : '#fff',
                outline: 'none',
                transition: 'all 0.2s ease',
                cursor: 'pointer',
              }}
            />
          ))}
        </div>

        <div style={{ textAlign:'center' }}>
          <p style={{ fontSize:13, color:'#6B7280', marginBottom:8 }}>
            Vous n'avez pas reçu le code ?
          </p>
          {countdown > 0 ? (
            <p style={{ fontSize:13, color:'#F59E0B' }}>Renvoyer dans {countdown}s</p>
          ) : (
            <button type="button" onClick={handleResend} disabled={resending}
              style={{ background:'none', border:'none', color:'#F59E0B', cursor:'pointer', fontSize:14, fontWeight:600, fontFamily:'Barlow', textDecoration:'underline' }}>
              {resending ? 'Envoi...' : 'Renvoyer le code'}
            </button>
          )}
        </div>

        <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading || otp.join('').length !== 6}>
          {loading ? 'Vérification...' : 'Vérifier le code →'}
        </button>
      </form>
    </AuthLayout>
  );
}
