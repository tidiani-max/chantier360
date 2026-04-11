import React from 'react';
import { Link } from 'react-router-dom';

export default function AuthLayout({ children, title, subtitle }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', position: 'relative', overflow: 'hidden' }}>
      {/* Left panel - image */}
      <div style={{
        flex: 1, display: 'none', position: 'relative',
        backgroundImage: `url('/hero-bg.webp')`,
        backgroundSize: 'cover', backgroundPosition: 'center',
      }} className="auth-left-panel">
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(135deg, rgba(13,13,26,0.7) 0%, rgba(245,158,11,0.15) 100%)',
        }} />
        <div style={{ position: 'relative', zIndex: 2, padding: 48, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}>
            <div style={{ width: 40, height: 40, background: 'linear-gradient(135deg, #F59E0B, #D97706)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 900, color: '#0D0D1A', fontFamily: 'Bebas Neue' }}>C</div>
            <span style={{ fontFamily: 'Bebas Neue', fontSize: 26, letterSpacing: 2, color: '#fff' }}>CHANTIER<span style={{ color: '#F59E0B' }}>360</span></span>
          </Link>
          <div>
            <h2 style={{ fontFamily: 'Bebas Neue', fontSize: 52, color: '#fff', lineHeight: 1, marginBottom: 16 }}>
              LA GESTION BTP<br /><span style={{ color: '#F59E0B' }}>INTELLIGENTE</span>
            </h2>
            <p style={{ color: '#9CA3AF', fontSize: 16, lineHeight: 1.6 }}>
              Analysez vos contrats, suivez vos chantiers et gérez vos projets de construction au Mali.
            </p>
          </div>
        </div>
      </div>

      {/* Right panel - form */}
      <div style={{
        width: '100%', maxWidth: 480,
        background: '#0D0D1A',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        padding: '48px 40px',
        position: 'relative',
        borderLeft: '1px solid rgba(255,255,255,0.06)',
      }}>
        {/* Top logo for mobile */}
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', marginBottom: 40 }}>
          <div style={{ width: 34, height: 34, background: 'linear-gradient(135deg, #F59E0B, #D97706)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 900, color: '#0D0D1A', fontFamily: 'Bebas Neue' }}>C</div>
          <span style={{ fontFamily: 'Bebas Neue', fontSize: 22, letterSpacing: 2, color: '#fff' }}>CHANTIER<span style={{ color: '#F59E0B' }}>360</span></span>
        </Link>

        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontFamily: 'Bebas Neue', fontSize: 38, letterSpacing: 1, color: '#fff', marginBottom: 8 }}>{title}</h1>
          <p style={{ color: '#6B7280', fontSize: 15 }}>{subtitle}</p>
        </div>

        {children}
      </div>

      <style>{`
        @media (min-width: 900px) {
          .auth-left-panel { display: block !important; }
        }
      `}</style>
    </div>
  );
}
