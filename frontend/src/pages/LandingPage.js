import React from 'react';
import { Link } from 'react-router-dom';

export default function LandingPage() {
  return (
    <div style={{ minHeight: '100vh', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

      {/* Background image with overlay */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0,
        backgroundImage: `url('/hero-bg.webp')`,
        backgroundSize: 'cover', backgroundPosition: 'center',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(135deg, rgba(13,13,26,0.92) 0%, rgba(26,26,46,0.85) 50%, rgba(13,13,26,0.95) 100%)',
        }} />
        {/* Golden grain overlay */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse at 30% 50%, rgba(245,158,11,0.08) 0%, transparent 60%), radial-gradient(ellipse at 70% 20%, rgba(245,158,11,0.05) 0%, transparent 50%)',
        }} />
      </div>

      {/* Nav */}
      <nav style={{ position: 'relative', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px 48px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 40, height: 40,
            background: 'linear-gradient(135deg, #F59E0B, #D97706)',
            borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, fontWeight: 900, color: '#0D0D1A', fontFamily: 'Bebas Neue'
          }}>C</div>
          <span style={{ fontFamily: 'Bebas Neue', fontSize: 26, letterSpacing: 2, color: '#fff' }}>
            CHANTIER<span style={{ color: '#F59E0B' }}>360</span>
          </span>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <Link to="/login" className="btn btn-ghost btn-sm">Se connecter</Link>
          <Link to="/register" className="btn btn-primary btn-sm">Créer un compte</Link>
        </div>
      </nav>

      {/* Hero */}
      <main style={{ position: 'relative', zIndex: 10, flex: 1, display: 'flex', alignItems: 'center', padding: '0 48px 80px' }}>
        <div style={{ maxWidth: 680 }} className="animate-fade-in">

          {/* Badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)',
            borderRadius: 100, padding: '6px 16px', marginBottom: 32,
          }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#F59E0B', animation: 'pulse 2s ease infinite' }} />
            <span style={{ fontFamily: 'Barlow Condensed', fontSize: 13, color: '#F59E0B', fontWeight: 600, letterSpacing: 1 }}>
              PLATEFORME BTP — MALI
            </span>
          </div>

          <h1 style={{
            fontFamily: 'Bebas Neue',
            fontSize: 'clamp(52px, 7vw, 90px)',
            lineHeight: 0.95,
            letterSpacing: 2,
            color: '#fff',
            marginBottom: 24,
          }}>
            GÉREZ VOS<br />
            <span style={{ color: '#F59E0B' }}>CHANTIERS</span><br />
            AVEC PRÉCISION
          </h1>

          <p style={{
            fontSize: 18, color: '#9CA3AF', lineHeight: 1.7,
            marginBottom: 40, maxWidth: 520,
            fontWeight: 300,
          }}>
            La plateforme intelligente de gestion de projets BTP pour les entreprises maliennes.
            Analysez vos contrats, suivez vos chantiers et maîtrisez vos délais.
          </p>

          {/* Features */}
          <div style={{ display: 'flex', gap: 24, marginBottom: 48, flexWrap: 'wrap' }}>
            {[
              { icon: '📄', label: 'Analyse IA des contrats' },
              { icon: '📊', label: 'Suivi de chantier' },
              { icon: '🔒', label: 'Multi-entreprises' },
            ].map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 18 }}>{f.icon}</span>
                <span style={{ fontFamily: 'Barlow Condensed', fontSize: 14, color: '#D1D5DB', fontWeight: 500 }}>{f.label}</span>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <Link to="/register" className="btn btn-primary btn-lg" style={{ minWidth: 200 }}>
              Commencer gratuitement →
            </Link>
            <Link to="/login" className="btn btn-outline btn-lg">
              Se connecter
            </Link>
          </div>
        </div>
      </main>

      {/* Bottom bar */}
      <div style={{ position: 'relative', zIndex: 10, borderTop: '1px solid rgba(255,255,255,0.06)', padding: '16px 48px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: 'Barlow', fontSize: 13, color: '#4B5563' }}>© 2025 Chantier360 — Tous droits réservés</span>
        <span style={{ fontFamily: 'Barlow Condensed', fontSize: 13, color: '#F59E0B', letterSpacing: 1 }}>MALI BTP</span>
      </div>
    </div>
  );
}
