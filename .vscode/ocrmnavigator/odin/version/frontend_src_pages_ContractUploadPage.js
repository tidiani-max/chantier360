import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { contractsAPI, projectsAPI } from '../services/api';
import { Sidebar } from './DashboardPage';
import toast from 'react-hot-toast';

function ContractSummary({ summary }) {
  if (!summary) return null;
  const s1 = summary.section1 || {};
  const s2 = summary.section2 || {};

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

      <Section title="1 — Présentation générale et contexte" icon="📋">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
          <Field label="Objet du contrat" value={s1.objet_contrat} />
          <Field label="Contexte et objectifs" value={s1.contexte_objectifs} />
          {s1.parties_prenantes && <>
            <Field label="Maître d'ouvrage" value={s1.parties_prenantes.maitre_ouvrage} />
            <Field label="Maître d'œuvre" value={s1.parties_prenantes.maitre_oeuvre} />
            <Field label="Entreprise / Groupement" value={s1.parties_prenantes.entreprise_groupement} />
            <Field label="Sous-traitants" value={s1.parties_prenantes.sous_traitants} />
          </>}
          {s1.duree_perimetre && <>
            <Field label="Lot(s) concerné(s)" value={s1.duree_perimetre.lots} />
            <Field label="Localisation" value={s1.duree_perimetre.localisation} />
            <Field label="Type de travaux" value={s1.duree_perimetre.type_travaux} />
            <Field label="Délai d'exécution" value={s1.duree_perimetre.delai_execution} />
            <Field label="Date de démarrage" value={s1.duree_perimetre.date_demarrage} />
            <Field label="Ordre de service" value={s1.duree_perimetre.ordre_de_service} />
          </>}
        </div>
      </Section>

      {s2.infos_administratives && (
        <Section title="2a — Informations administratives" icon="🏛️">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
            <Field label="Numéro / Référence" value={s2.infos_administratives.numero_reference} />
            <Field label="N° Approbation DNCMP" value={s2.infos_administratives.numero_approbation} />
            <Field label="Type de marché" value={s2.infos_administratives.type_marche} />
            <Field label="Mode de passation" value={s2.infos_administratives.mode_passation} />
            <Field label="Date de notification" value={s2.infos_administratives.date_notification} />
            <Field label="Source de financement" value={s2.infos_administratives.source_financement} />
            <Field label="Tribunal compétent" value={s2.infos_administratives.tribunal_competent} />
          </div>
        </Section>
      )}

      {s2.conditions_financieres && (
        <Section title="2b — Conditions financières" icon="💰">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
            <Field label="Montant HT" value={s2.conditions_financieres.montant_ht} />
            <Field label="Montant TTC" value={s2.conditions_financieres.montant_ttc} />
            <Field label="Taux TVA" value={s2.conditions_financieres.taux_tva} />
            <Field label="Conditions de paiement" value={s2.conditions_financieres.conditions_paiement} />
            <Field label="Révision des prix" value={s2.conditions_financieres.revision_prix} />
            <Field label="Caution bonne exécution" value={s2.conditions_financieres.caution_bonne_execution} />
            <Field label="Retenue de garantie" value={s2.conditions_financieres.retenue_garantie} />
          </div>
        </Section>
      )}

      {s2.obligations_parties && (
        <Section title="2c — Obligations des parties" icon="📝">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Field label="Obligations du Maître d'ouvrage" value={s2.obligations_parties.maitre_ouvrage} />
            <Field label="Obligations du Maître d'œuvre" value={s2.obligations_parties.maitre_oeuvre} />
            <Field label="Obligations de l'Entreprise" value={s2.obligations_parties.entreprise} />
            <Field label="Obligations des Sous-traitants" value={s2.obligations_parties.sous_traitants} />
          </div>
        </Section>
      )}

      {s2.suivi_reception && (
        <Section title="2d — Suivi et réception" icon="🔍">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
            <Field label="Mécanismes de supervision" value={s2.suivi_reception.supervision} />
            <Field label="Réception provisoire" value={s2.suivi_reception.reception_provisoire} />
            <Field label="Réception définitive" value={s2.suivi_reception.reception_definitive} />
          </div>
        </Section>
      )}

      {s2.clauses_particulieres && (
        <Section title="2e — Clauses particulières" icon="⚖️">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Field label="Pénalités de retard" value={s2.clauses_particulieres.penalites_retard} />
            <Field label="Conditions de résiliation" value={s2.clauses_particulieres.conditions_resiliation} />
            <Field label="Règlement des litiges" value={s2.clauses_particulieres.reglement_litiges} />
          </div>
        </Section>
      )}
    </div>
  );
}

export default function ContractUploadPage() {
  const navigate = useNavigate();
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState('');

  useEffect(() => {
    projectsAPI.list().then(res => setProjects(res.data)).catch(() => {});
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) validateAndSetFile(f);
  }, []);

  const validateAndSetFile = (f) => {
    const validTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword'];
    if (!validTypes.includes(f.type) && !f.name.match(/\.(pdf|docx|doc)$/i)) {
      toast.error('Format non supporté. Utilisez PDF ou Word (.docx)');
      return;
    }
    setFile(f);
    setResult(null);
  };

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);
    if (selectedProject) formData.append('project_id', selectedProject);
    try {
      const res = await contractsAPI.upload(formData);
      setResult(res.data.contract);
      toast.success('Contrat analysé avec succès !');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erreur lors de l\'analyse');
    } finally { setLoading(false); }
  };

  const formatSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
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
            <div className="card">
              {/* Project selector */}
              <div className="input-group" style={{ marginBottom: 24 }}>
                <label className="input-label">Associer à un projet (optionnel)</label>
                <select className="input-field" value={selectedProject} onChange={e => setSelectedProject(e.target.value)}>
                  <option value="">— Aucun projet —</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              {/* Drop zone */}
              <div
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => !file && document.getElementById('file-input').click()}
                style={{
                  border: `2px dashed ${dragging ? 'var(--gold)' : file ? 'var(--success)' : 'var(--dark-border)'}`,
                  borderRadius: 'var(--radius-lg)',
                  padding: '56px 24px',
                  textAlign: 'center',
                  cursor: file ? 'default' : 'pointer',
                  background: dragging ? 'rgba(245,158,11,0.04)' : file ? 'rgba(16,185,129,0.04)' : 'var(--dark-3)',
                  transition: 'all 0.2s',
                }}>
                <input id="file-input" type="file" accept=".pdf,.docx,.doc" style={{ display: 'none' }}
                  onChange={e => { if (e.target.files[0]) validateAndSetFile(e.target.files[0]); }} />

                {file ? (
                  <div>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>
                      {file.name.endsWith('.pdf') ? '📕' : '📘'}
                    </div>
                    <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 4, color: 'var(--success)' }}>{file.name}</div>
                    <div style={{ fontSize: 13, color: 'var(--gray-3)', marginBottom: 16 }}>{formatSize(file.size)}</div>
                    <button onClick={(e) => { e.stopPropagation(); setFile(null); }}
                      style={{ background: 'none', color: 'var(--gray-3)', fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}>
                      Changer de fichier
                    </button>
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

              {file && (
                <div style={{ marginTop: 20 }}>
                  {loading ? (
                    <div style={{ textAlign: 'center', padding: '20px 0' }}>
                      <div style={{ fontSize: 32, marginBottom: 12 }} className="animate-pulse">🤖</div>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Analyse en cours...</div>
                      <p style={{ color: 'var(--gray-3)', fontSize: 14 }}>L'IA extrait les 32 points clés de votre contrat</p>
                      <div style={{ width: '100%', height: 4, background: 'var(--dark-border)', borderRadius: 2, marginTop: 20, overflow: 'hidden' }}>
                        <div style={{ height: '100%', background: 'var(--gold)', width: '60%', borderRadius: 2, animation: 'shimmer 1.5s ease infinite', backgroundSize: '200% 100%', backgroundImage: 'linear-gradient(90deg, var(--gold-dark), var(--gold-light), var(--gold-dark))' }} />
                      </div>
                    </div>
                  ) : (
                    <button className="btn-primary" onClick={handleUpload}>
                      🤖 Analyser avec l'IA
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
                <button className="btn-secondary" style={{ width: 'auto', padding: '10px 20px' }} onClick={() => { setResult(null); setFile(null); }}>
                  ← Analyser un autre contrat
                </button>
                <button className="btn-primary" style={{ width: 'auto', padding: '10px 20px' }}
                  onClick={() => toast('Export PDF — à venir dans la prochaine version')}>
                  📥                 </button>
              </div>
              <ContractSummary summary={result.summary} />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
