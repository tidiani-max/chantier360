import React, { useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import toast from 'react-hot-toast';
import { contractsAPI } from '../../services/api';
import AppLayout from '../../components/layout/AppLayout';

export default function ContractUploadPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('project');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');

  const onDrop = useCallback((accepted) => {
    if (accepted.length > 0) setFile(accepted[0]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 
      'application/pdf': ['.pdf'], 
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'], 
      'application/msword': ['.doc'] 
    },
    maxFiles: 1,
    maxSize: 50 * 1024 * 1024,
    onDropRejected: (files) => {
      if (files[0]?.errors[0]?.code === 'file-too-large') toast.error('Fichier trop volumineux (max 50MB)');
      else toast.error('Format non supporté. Utilisez PDF ou Word (.docx)');
    }
  });

  const handleUpload = async () => {
    if (!file) return toast.error('Sélectionnez un fichier');
    setLoading(true);
    setProgress('Extraction du texte...');
    const formData = new FormData();
    formData.append('file', file);
    if (projectId) formData.append('project_id', projectId);
    try {
      setProgress('Analyse IA en cours... Cela peut prendre quelques secondes.');
      const res = await contractsAPI.upload(formData);
      toast.success('Contrat analysé avec succès !');
      navigate(`/contracts/${res.data.contract.id}`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Erreur lors de l\'analyse');
      setLoading(false);
      setProgress('');
    }
  };

  const formatSize = (bytes) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  };

  return (
    <AppLayout>
      <div style={{ padding:'32px 40px', maxWidth:680, backgroundColor: '#ffffff' }} className="animate-fade-in">
        <div style={{ marginBottom:32 }}>
          <button 
            onClick={() => navigate(projectId ? `/projects/${projectId}` : '/dashboard')} 
            style={{ background:'none', border:'none', color:'#6B7280', cursor:'pointer', fontSize:14, marginBottom:12, fontFamily:'Barlow', display:'flex', alignItems:'center', gap:6 }}
          >
            ← Retour
          </button>
          
          {/* Fixed Title Color */}
          <h1 style={{ fontFamily:'Bebas Neue', fontSize:42, color:'#111827', letterSpacing:1, margin:0 }}>
            Analyser un <span style={{ color:'#F59E0B' }}>Contrat</span>
          </h1>
          <p style={{ color:'#6B7280', margin:'4px 0 0' }}>Uploadez votre contrat — l'IA extrait automatiquement les 32 points clés</p>
        </div>

        {/* Info Card - Darkened text for readability */}
        <div className="card" style={{ marginBottom:24, background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.3)', padding: '20px', borderRadius: '12px' }}>
          <p style={{ fontFamily:'Barlow Condensed', fontSize:14, color:'#D97706', fontWeight:600, letterSpacing:0.5, textTransform:'uppercase', margin:'0 0 12px' }}>
            Ce qui sera extrait automatiquement
          </p>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'4px 20px' }}>
            {['Objet et type de travaux','Maître d\'ouvrage / œuvre','Numéro du marché','Montant HT et TTC','Date de notification','Délai d\'exécution','Mode de passation','Source de financement','Pénalités de retard','Garanties contractuelles','Réception provisoire/définitive','Tribunal compétent'].map(item => (
              <div key={item} style={{ display:'flex', alignItems:'center', gap:6, padding:'3px 0' }}>
                <span style={{ color:'#F59E0B', fontSize:12 }}>✓</span>
                <span style={{ fontSize:13, color:'#4B5563' }}>{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Dropzone - Fixed background and text colors */}
        <div {...getRootProps()} style={{
          border: `2px dashed ${isDragActive ? '#F59E0B' : file ? '#10B981' : '#D1D5DB'}`,
          borderRadius: 12,
          padding: 48, 
          textAlign: 'center', 
          cursor: 'pointer',
          background: isDragActive ? 'rgba(245,158,11,0.05)' : file ? 'rgba(16,185,129,0.05)' : '#F9FAFB',
          transition: 'all 0.2s', 
          marginBottom: 24,
        }}>
          <input {...getInputProps()} />
          {file ? (
            <div>
              <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
              <p style={{ fontFamily:'Barlow Condensed', fontSize: 20, fontWeight: 700, color: '#10B981', margin: '0 0 4px' }}>{file.name}</p>
              <p style={{ fontSize: 13, color: '#6B7280' }}>{formatSize(file.size)}</p>
              <button 
                onClick={(e) => { e.stopPropagation(); setFile(null); }}
                style={{ marginTop: 12, background: 'none', border: '1px solid #EF4444', color: '#EF4444', borderRadius: 6, padding: '4px 12px', cursor: 'pointer', fontSize: 13, fontFamily: 'Barlow' }}
              >
                Changer de fichier
              </button>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 56, marginBottom: 16 }}>{isDragActive ? '📥' : '📄'}</div>
              <p style={{ fontFamily:'Barlow Condensed', fontSize: 20, fontWeight: 600, color: '#111827', margin: '0 0 8px' }}>
                {isDragActive ? 'Déposez le fichier ici' : 'Glissez votre contrat ici'}
              </p>
              <p style={{ fontSize: 14, color: '#6B7280', margin: '0 0 16px' }}>ou cliquez pour sélectionner</p>
              <span style={{ padding: '6px 16px', borderRadius: 100, background: '#E5E7EB', fontSize: 13, color: '#4B5563' }}>
                PDF ou Word (.docx) — Max 50 Mo
              </span>
            </div>
          )}
        </div>

        {/* Loading state */}
        {loading && (
          <div className="card" style={{ textAlign:'center', marginBottom:24, background:'rgba(245,158,11,0.05)', border:'1px solid rgba(245,158,11,0.2)', padding: '20px', borderRadius: '12px' }}>
            <div style={{ width:40, height:40, border:'3px solid #F59E0B', borderTopColor:'transparent', borderRadius:'50%', animation:'spin 1s linear infinite', margin:'0 auto 16px' }} />
            <p style={{ color:'#D97706', fontFamily:'Barlow Condensed', fontSize:16, fontWeight:600, margin:0 }}>{progress}</p>
            <p style={{ color:'#6B7280', fontSize:13, margin:'8px 0 0' }}>Ne fermez pas cette page</p>
          </div>
        )}

        <button 
          onClick={handleUpload} 
          disabled={!file || loading} 
          className="btn btn-primary btn-full btn-lg"
          style={{ width: '100%', padding: '16px', fontSize: '16px', fontWeight: 'bold', cursor: (!file || loading) ? 'not-allowed' : 'pointer' }}
        >
          {loading ? 'Analyse en cours...' : '🤖 Analyser avec l\'IA →'}
        </button>
      </div>
    </AppLayout>
  );
}