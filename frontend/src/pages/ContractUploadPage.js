import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { projectsAPI } from '../services/api';
import { Sidebar } from './DashboardPage';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

function ContractSummary({ summary, contractId }) {
  if (!summary) return null;
  const s1 = summary.section1 || {};
  const s2 = summary.section2 || {};
  const parties = s1.parties_prenantes || {};
  const perimetre = s1.duree_perimetre || {};
  const admin = s2.infos_administratives || {};
  const finances = s2.conditions_financieres || {};
  const obligations = s2.obligations_parties || {};
  const suivi = s2.suivi_reception || {};
  const clauses = s2.clauses_particulieres || {};

  const Field = ({ label, value }) => (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 14, color: value && value !== 'Non mentionné' ? 'var(--white)' : 'var(--gray-4)', fontStyle: value === 'Non mentionné' ? 'italic' : 'normal' }}>
        {value || 'Non mentionné'}
      </div>
    </div>
  );

  const Section = ({ title, icon, children }) => (
    <div className="card" style={{ marginBottom: 16 }}>
      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span>{icon}</span> {title}
      </h3>
      {children}
    </div>
  );

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24, padding: '14px 20px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 'var(--radius)' }}>
        <span style={{ fontSize: 20 }}>✅</span>
        <span style={{ color: '#10B981', fontWeight: 600 }}>Résumé généré avec succès — 32 points clés extraits</span>
      </div>
      <Section title="1 — Présentation générale" icon="📋">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
          <Field label="Objet du contrat" value={s1.objet_contrat} />
          <Field label="Contexte et objectifs" value={s1.contexte_objectifs} />
          <Field label="Maître d'ouvrage" value={parties.maitre_ouvrage} />
          <Field label="Maître d'oeuvre" value={parties.maitre_oeuvre} />
          <Field label="Entreprise / Groupement" value={parties.entreprise_groupement} />
          <Field label="Sous-traitants" value={parties.sous_traitants} />
          <Field label="Lot(s)" value={perimetre.lots} />
          <Field label="Localisation" value={perimetre.localisation} />
          <Field label="Type de travaux" value={perimetre.type_travaux} />
          <Field label="Délai d'exécution" value={perimetre.delai_execution} />
          <Field label="Date de démarrage" value={perimetre.date_demarrage} />
          <Field label="Ordre de service" value={perimetre.ordre_de_service} />
        </div>
      </Section>
      <Section title="2a — Informations administratives" icon="🏛️">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
          <Field label="Numéro du marché" value={admin.numero_reference} />
          <Field label="N° Approbation DNCMP" value={admin.numero_approbation} />
          <Field label="Type de marché" value={admin.type_marche} />
          <Field label="Mode de passation" value={admin.mode_passation} />
          <Field label="Date de notification" value={admin.date_notification} />
          <Field label="Source de financement" value={admin.source_financement} />
          <Field label="Tribunal compétent" value={admin.tribunal_competent} />
        </div>
      </Section>
      <Section title="2b — Conditions financières" icon="💰">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
          <Field label="Montant HT" value={finances.montant_ht} />
          <Field label="Montant TTC" value={finances.montant_ttc} />
          <Field label="Taux TVA" value={finances.taux_tva} />
          <Field label="Conditions de paiement" value={finances.conditions_paiement} />
          <Field label="Révision des prix" value={finances.revision_prix} />
          <Field label="Caution bonne exécution" value={finances.caution_bonne_execution} />
          <Field label="Retenue de garantie" value={finances.retenue_garantie} />
        </div>
      </Section>
      <Section title="2c — Obligations des parties" icon="📝">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Field label="Obligations du Maître d'ouvrage" value={obligations.maitre_ouvrage} />
          <Field label="Obligations du Maître d'oeuvre" value={obligations.maitre_oeuvre} />
          <Field label="Obligations de l'Entreprise" value={obligations.entreprise} />
        </div>
      </Section>
      <Section title="2d — Suivi et réception" icon="🔍">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
          <Field label="Mécanismes de supervision" value={suivi.supervision} />
          <Field label="Réception provisoire" value={suivi.reception_provisoire} />
          <Field label="Réception définitive" value={suivi.reception_definitive} />
        </div>
      </Section>
      <Section title="2e — Clauses particulières" icon="⚖️">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Field label="Pénalités de retard" value={clauses.penalites_retard} />
          <Field label="Conditions de résiliation" value={clauses.conditions_resiliation} />
          <Field label="Règlement des litiges" value={clauses.reglement_litiges} />
        </div>
      </Section>
    </div>
  );
}

export default function ContractUploadPage() {
  const navigate = useNavigate();
  const { tokens } = useAuth();
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [progress, setProgress] = useState({ percent: 0, message: '' });
  const [streamText, setStreamText] = useState('');
  const streamRef = useRef(null);

  useEffect(() => {
    projectsAPI.list().then(res => setProjects(res.data)).catch(() => {});
    return () => { if (streamRef.current) streamRef.current.abort(); };
  }, []);

  const validateAndSetFile = (f) => {
    const valid = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword'];
    if (!valid.includes(f.type) && !f.name.match(/\.(pdf|docx|doc)$/i)) {
      toast.error('Format non supporté. Utilisez PDF ou Word (.docx)');
      return;
    }
    setFile(f);
    setResult(null);
    setStreamText('');
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) validateAndSetFile(f);
  }, []);

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setStreamText('');
    setProgress({ percent: 5, message: '📂 Envoi du fichier...' });

    const formData = new FormData();
    formData.append('file', file);
    if (selectedProject) formData.append('project_id', selectedProject);

    const token = tokens?.access || localStorage.getItem('access_token');

    try {
      const controller = new AbortController();
      streamRef.current = controller;

      const response = await fetch('http://localhost:8000/api/contracts/upload-stream/', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
        signal: controller.signal,
      });

      if (!response.ok) throw new Error('Erreur serveur');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));

            if (data.type === 'progress') {
              setProgress({ percent: data.percent, message: data.message });
            } else if (data.type === 'stream') {
              setStreamText(prev => prev + data.chunk);
            } else if (data.type === 'done') {
              setProgress({ percent: 100, message: '✅ Analyse terminée !' });
              setResult(data.contract);
              toast.success('Contrat analysé avec succès !');
              setLoading(false);
            } else if (data.type === 'error') {
              toast.error(data.message || 'Erreur lors de l\'analyse');
              setLoading(false);
            }
          } catch {}
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        toast.error('Erreur lors de l\'analyse');
      }
      setLoading(false);
    }
  };

  const handleDownloadPDF = () => {
    const token = tokens?.access || localStorage.getItem('access_token');
    fetch(`http://localhost:8000/api/contracts/${result.id}/export-pdf/`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => { if (!res.ok) throw new Error(); return res.blob(); })
      .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `resume_${result.file_name?.replace(/\.[^.]+$/, '') || 'contrat'}.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
      })
      .catch(() => toast.error('Erreur lors du téléchargement'));
  };

  const formatSize = (bytes) => {
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--dark)' }}>
      <Sidebar active="contracts" />
      <main style={{ marginLeft: 260, flex: 1, padding: '40px 36px' }}>
        <div className="animate-fade-in" style={{ maxWidth: 900 }}>
          <div style={{ marginBottom: 32 }}>
            <button onClick={() => navigate('/dashboard')} style={{ background: 'none', color: 'var(--gray-3)', fontSize: 14, cursor: 'pointer', marginBottom: 16 }}>
              ← Retour au dashboard
            </button>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 800, marginBottom: 6 }}>Analyser un contrat</h1>
            <p style={{ color: 'var(--gray-3)', fontSize: 15 }}>Upload votre contrat PDF ou Word — l'IA extrait les 32 points clés automatiquement</p>
          </div>

          {!result ? (
            <div>
              <div className="card" style={{ marginBottom: 20 }}>
                <div className="input-group" style={{ marginBottom: 24 }}>
                  <label className="input-label">Associer à un projet (optionnel)</label>
                  <select className="input-field" value={selectedProject} onChange={e => setSelectedProject(e.target.value)}>
                    <option value="">— Aucun projet —</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>

                <div
                  onDragOver={e => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => !file && !loading && document.getElementById('file-input').click()}
                  style={{
                    border: `2px dashed ${dragging ? 'var(--gold)' : file ? 'var(--success)' : 'var(--dark-border)'}`,
                    borderRadius: 'var(--radius-lg)', padding: '48px 24px', textAlign: 'center',
                    cursor: file || loading ? 'default' : 'pointer',
                    background: dragging ? 'rgba(245,158,11,0.04)' : file ? 'rgba(16,185,129,0.04)' : 'var(--dark-3)',
                    transition: 'all 0.2s', marginBottom: 20,
                  }}>
                  <input id="file-input" type="file" accept=".pdf,.docx,.doc" style={{ display: 'none' }}
                    onChange={e => { if (e.target.files[0]) validateAndSetFile(e.target.files[0]); }} />
                  {file ? (
                    <div>
                      <div style={{ fontSize: 48, marginBottom: 12 }}>{file.name.endsWith('.pdf') ? '📕' : '📘'}</div>
                      <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 4, color: 'var(--success)' }}>{file.name}</div>
                      <div style={{ fontSize: 13, color: 'var(--gray-3)', marginBottom: 12 }}>{formatSize(file.size)}</div>
                      {!loading && (
                        <button onClick={(e) => { e.stopPropagation(); setFile(null); setStreamText(''); }}
                          style={{ background: 'none', color: 'var(--gray-3)', fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}>
                          Changer de fichier
                        </button>
                      )}
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontSize: 56, marginBottom: 16 }}>📂</div>
                      <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
                        {dragging ? 'Déposez le fichier ici' : 'Glissez-déposez votre contrat'}
                      </h3>
                      <p style={{ color: 'var(--gray-3)', fontSize: 14, marginBottom: 16 }}>ou cliquez pour sélectionner</p>
                      <div className="badge badge-gray">PDF ou Word (.docx) — jusqu'à 50MB</div>
                    </div>
                  )}
                </div>

                {!loading && file && (
                  <button className="btn-primary" onClick={handleUpload}>
                    🤖 Analyser avec l'IA
                  </button>
                )}
              </div>

              {/* Streaming progress panel */}
              {loading && (
                <div className="card" style={{ background: 'var(--dark-3)', border: '1px solid rgba(245,158,11,0.2)' }}>
                  {/* Progress bar */}
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: 14, color: 'var(--gold)', fontWeight: 600 }}>{progress.message}</span>
                      <span style={{ fontSize: 13, color: 'var(--gray-3)' }}>{progress.percent}%</span>
                    </div>
                    <div style={{ width: '100%', height: 6, background: 'var(--dark-border)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: 3,
                        background: 'linear-gradient(90deg, var(--gold-dark), var(--gold), var(--gold-light))',
                        width: `${progress.percent}%`,
                        transition: 'width 0.5s ease',
                      }} />
                    </div>
                  </div>

                  {/* Live streaming text */}
                  {streamText && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-4)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                        Génération en temps réel
                      </div>
                      <div style={{
                        background: 'var(--dark)', borderRadius: 'var(--radius)',
                        padding: '16px', maxHeight: 280, overflowY: 'auto',
                        fontFamily: 'monospace', fontSize: 12, lineHeight: 1.6,
                        color: '#10B981', border: '1px solid rgba(16,185,129,0.15)',
                        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                      }}>
                        {streamText}
                        <span style={{ display: 'inline-block', width: 8, height: 14, background: '#10B981', marginLeft: 2, animation: 'pulse 1s ease infinite', verticalAlign: 'text-bottom' }} />
                      </div>
                      <p style={{ fontSize: 12, color: 'var(--gray-4)', marginTop: 8, textAlign: 'center' }}>
                        L'IA analyse votre contrat en temps réel — ne fermez pas cette page
                      </p>
                    </div>
                  )}

                  {!streamText && (
                    <div style={{ textAlign: 'center', padding: '12px 0' }}>
                      <div style={{ width: 36, height: 36, border: '3px solid var(--gold)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
                      <p style={{ color: 'var(--gray-3)', fontSize: 14 }}>Préparation de l'analyse...</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
                <button className="btn-secondary" style={{ width: 'auto', padding: '10px 20px' }}
                  onClick={() => { setResult(null); setFile(null); setStreamText(''); }}>
                  ← Analyser un autre contrat
                </button>
                <button className="btn-primary" style={{ width: 'auto', padding: '10px 20px' }}
                  onClick={handleDownloadPDF}>
                  📥 Télécharger le résumé PDF
                </button>
              </div>
              <ContractSummary summary={result.summary} contractId={result.id} />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
