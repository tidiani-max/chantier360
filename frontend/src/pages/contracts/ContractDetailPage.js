// frontend/src/pages/contracts/ContractDetailPage.js
import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { contractsAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../context/PermissionsContext';
import AppLayout from '../../components/layout/AppLayout';
import toast from 'react-hot-toast';

const T = {
  bg:'#F8F9FA', card:'#FFFFFF', border:'#E8EDF2',
  text:'#1a1f2e', textSub:'#6B7888', textMuted:'#A0ADB8',
  orange:'#F97316', green:'#10B981', red:'#EF4444', blue:'#3B82F6',
  shadow:'0 1px 3px rgba(0,0,0,0.06)',
};

function Card({ children, style={} }) {
  return (
    <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:12, padding:24, boxShadow:T.shadow, ...style }}>
      {children}
    </div>
  );
}

export default function ContractDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { role } = usePermissions();

  const [contract, setContract] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    contractsAPI.get(id)
      .then(r => setContract(r.data))
      .catch(() => toast.error('Contrat introuvable.'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleDelete = async () => {
    if (!window.confirm('Supprimer ce contrat ?')) return;
    try {
      await contractsAPI.delete(id);
      toast.success('Contrat supprimé.');
      navigate('/contracts/upload');
    } catch {
      toast.error('Erreur lors de la suppression.');
    }
  };

  const canValidate = ['admin_entreprise', 'app_owner'].includes(role);

  return (
    <AppLayout>
      {/* Top bar */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'0 32px', height:60, background:'#fff', borderBottom:`1px solid ${T.border}`, position:'sticky', top:0, zIndex:10 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <Link to="/contracts/upload" style={{ fontSize:13, color:T.textSub, textDecoration:'none' }}>← Contrats</Link>
          <span style={{ color:T.border }}>/</span>
          <span style={{ fontSize:14, fontWeight:600, color:T.text }}>{contract?.file_name || 'Contrat'}</span>
        </div>
        <div style={{ display:'flex', gap:10 }}>
          {contract && (
            <a href={contractsAPI.exportPdfUrl(id)} target="_blank" rel="noopener noreferrer"
              style={{ padding:'8px 16px', borderRadius:7, border:`1px solid ${T.border}`, background:T.card, color:T.textSub, fontSize:13, fontWeight:500, textDecoration:'none' }}>
              📥 Télécharger PDF
            </a>
          )}
          {canValidate && contract && !contract.is_validated && (
            <button onClick={() => contractsAPI.validate(id).then(() => { toast.success('Contrat validé !'); setContract(p => ({...p, is_validated:true})); })}
              style={{ padding:'8px 18px', borderRadius:7, background:T.green, color:'#fff', fontSize:13, fontWeight:600, border:'none', cursor:'pointer' }}>
              ✓ Valider le résumé IA
            </button>
          )}
        </div>
      </div>

      <div style={{ padding:32 }}>
        {loading ? (
          <div style={{ textAlign:'center', paddingTop:80 }}>
            <div style={{ width:36, height:36, border:`3px solid ${T.orange}`, borderTopColor:'transparent', borderRadius:'50%', animation:'spin 1s linear infinite', margin:'0 auto' }}/>
          </div>
        ) : !contract ? (
          <Card>
            <div style={{ textAlign:'center', padding:'48px 0', color:T.textMuted }}>
              <div style={{ fontSize:36, marginBottom:12 }}>📄</div>
              <div style={{ fontSize:15 }}>Contrat introuvable.</div>
              <Link to="/contracts/upload" style={{ color:T.orange, fontSize:13, marginTop:12, display:'inline-block' }}>← Retour aux contrats</Link>
            </div>
          </Card>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
            {/* File info */}
            <Card>
              <h3 style={{ margin:'0 0 16px', fontSize:14, fontWeight:600, color:T.text }}>Informations du fichier</h3>
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                {[
                  ['Nom du fichier', contract.file_name],
                  ['Type',           contract.file_type?.toUpperCase()],
                  ['Taille',         contract.file_size ? `${(contract.file_size/1024).toFixed(1)} KB` : '—'],
                  ['Projet',         contract.project ? <Link to={`/projects/${contract.project}`} style={{ color:T.orange }}>Voir le projet</Link> : 'Non assigné'],
                  ['Uploadé le',     new Date(contract.created_at).toLocaleDateString('fr-FR', { day:'2-digit', month:'long', year:'numeric' })],
                  ['Statut',         contract.is_validated
                    ? <span style={{ color:T.green, fontWeight:600 }}>✓ Validé</span>
                    : <span style={{ color:T.orange, fontWeight:600 }}>En attente de validation</span>
                  ],
                ].map(([k,v],i) => (
                  <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:`1px solid ${T.border}`, fontSize:13 }}>
                    <span style={{ color:T.textSub }}>{k}</span>
                    <span style={{ color:T.text, fontWeight:500 }}>{v}</span>
                  </div>
                ))}
              </div>

              {/* Danger zone */}
              <div style={{ marginTop:24, paddingTop:20, borderTop:`1px solid ${T.border}` }}>
                <button onClick={handleDelete}
                  style={{ padding:'8px 16px', borderRadius:7, border:`1px solid ${T.red}`, background:'transparent', color:T.red, fontSize:12, fontWeight:600, cursor:'pointer' }}>
                  🗑 Supprimer ce contrat
                </button>
              </div>
            </Card>

            {/* AI Summary */}
            <Card>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
                <h3 style={{ margin:0, fontSize:14, fontWeight:600, color:T.text }}>Résumé IA</h3>
                {contract.is_processing && (
                  <span style={{ fontSize:11, color:T.orange, background:'rgba(249,115,22,0.1)', padding:'3px 10px', borderRadius:100 }}>⏳ En traitement…</span>
                )}
                {!contract.is_processing && !contract.summary && (
                  <span style={{ fontSize:11, color:T.textMuted }}>Non généré</span>
                )}
              </div>

              {contract.summary ? (
                <div>
                  {/* Key summary fields */}
                  {Object.entries(contract.summary).map(([k, v]) => v && (
                    <div key={k} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:`1px solid ${T.border}`, fontSize:13 }}>
                      <span style={{ color:T.textSub, textTransform:'capitalize' }}>{k.replace(/_/g,' ')}</span>
                      <span style={{ color:T.text, fontWeight:500, maxWidth:260, textAlign:'right' }}>{String(v)}</span>
                    </div>
                  ))}

                  {/* Validation note — only director can validate */}
                  {!contract.is_validated && (
                    <div style={{ marginTop:16, padding:12, background:'rgba(249,115,22,0.08)', border:'1px solid rgba(249,115,22,0.2)', borderRadius:8, fontSize:12, color:T.orange }}>
                      {canValidate
                        ? '⚠ Ce résumé IA attend votre validation. Vérifiez les informations avant de valider.'
                        : 'ℹ Ce résumé attend la validation du Directeur.'
                      }
                    </div>
                  )}
                  {contract.is_validated && (
                    <div style={{ marginTop:16, padding:12, background:'rgba(16,185,129,0.08)', border:'1px solid rgba(16,185,129,0.2)', borderRadius:8, fontSize:12, color:T.green }}>
                      ✓ Résumé validé par le Directeur.
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ textAlign:'center', padding:'32px 0', color:T.textMuted }}>
                  <div style={{ fontSize:32, marginBottom:8 }}>🤖</div>
                  <div style={{ fontSize:13 }}>
                    {contract.is_processing ? 'Analyse IA en cours…' : 'Aucun résumé disponible.'}
                  </div>
                </div>
              )}
            </Card>
          </div>
        )}
      </div>
    </AppLayout>
  );
}