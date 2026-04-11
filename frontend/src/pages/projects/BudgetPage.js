// frontend/src/pages/projects/BudgetPage.js
// Real purchases from /api/projects/:id/purchases/ — comptable creates, directeur sees margins
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { projectsAPI } from '../../services/api';
import { usePermissions } from '../../context/PermissionsContext';
import AppLayout from '../../components/layout/AppLayout';
import toast from 'react-hot-toast';

const T = {
  card:'#FFFFFF', border:'#E8EDF2', text:'#1a1f2e', textSub:'#6B7280', textMuted:'#9CA3AF',
  orange:'#F97316', orangeLight:'rgba(249,115,22,0.1)',
  green:'#10B981', greenLight:'rgba(16,185,129,0.08)',
  red:'#EF4444', redLight:'rgba(239,68,68,0.08)',
  blue:'#3B82F6', yellow:'#F59E0B', shadow:'0 1px 3px rgba(0,0,0,0.07)',
};

const STATUT_CFG = {
  commande:   { label:'Commandé',  color:'#3B82F6', bg:'#EFF6FF' },
  livre:      { label:'Livré',     color:'#10B981', bg:'#ECFDF5' },
  en_attente: { label:'En attente',color:'#F59E0B', bg:'#FFFBEB' },
  annule:     { label:'Annulé',    color:'#EF4444', bg:'#FEF2F2' },
};

function fmtFCFA(n) {
  if (n==null||isNaN(parseFloat(n))) return '—';
  const v=parseFloat(n);
  if (v>=1e9) return `${(v/1e9).toFixed(2)} Mrd`;
  if (v>=1e6) return `${(v/1e6).toFixed(2)} M`;
  if (v>=1e3) return `${(v/1e3).toFixed(0)} K`;
  return v.toLocaleString('fr-FR');
}

function fmtDate(d) { if(!d)return'—'; return new Date(d+'T00:00:00').toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'2-digit'}); }

function Card({ children, style={}, p=24 }) {
  return <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:12, padding:p, boxShadow:T.shadow, ...style }}>{children}</div>;
}

function Pbar({ pct, color=T.orange, h=8 }) {
  return (
    <div style={{ height:h, background:T.border, borderRadius:h, overflow:'hidden' }}>
      <div style={{ height:'100%', width:`${Math.min(100,pct||0)}%`, background:color, borderRadius:h, transition:'width 0.6s' }}/>
    </div>
  );
}

function Modal({ open, onClose, title, children }) {
  if (!open) return null;
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.35)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}>
      <div style={{ background:'#fff', borderRadius:14, width:520, maxWidth:'95vw', maxHeight:'90vh', overflow:'auto', boxShadow:'0 20px 60px rgba(0,0,0,0.15)' }}>
        <div style={{ padding:'18px 24px 14px', borderBottom:`1px solid ${T.border}`, display:'flex', justifyContent:'space-between', alignItems:'center', position:'sticky', top:0, background:'#fff' }}>
          <h3 style={{ margin:0, fontSize:16, fontWeight:700, color:T.text }}>{title}</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:20, color:T.textMuted, cursor:'pointer' }}>×</button>
        </div>
        <div style={{ padding:24 }}>{children}</div>
      </div>
    </div>
  );
}

const inp = {
  width:'100%', padding:'9px 12px', borderRadius:8,
  border:`1px solid ${T.border}`, background:'#FAFAFA',
  fontSize:13, color:T.text, outline:'none', fontFamily:'inherit', boxSizing:'border-box',
};

function Field({ label, children }) {
  return (
    <div style={{ marginBottom:14 }}>
      <label style={{ display:'block', fontSize:11, fontWeight:600, color:T.textSub, marginBottom:5, textTransform:'uppercase', letterSpacing:'0.4px' }}>{label}</label>
      {children}
    </div>
  );
}

const emptyForm = { designation:'', fournisseur:'', quantite:'', unite:'', prix_unitaire:'', date_commande:new Date().toISOString().slice(0,10), date_livraison:'', statut:'commande', notes:'' };

export default function BudgetPage() {
  const { id: projectId } = useParams();
  const navigate = useNavigate();
  const { role, canViewFinancials } = usePermissions();

  const [project, setProject]   = useState(null);
  const [stats, setStats]       = useState(null);
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editPurchase, setEditPurchase] = useState(null);
  const [saving, setSaving]     = useState(false);
  const [form, setForm]         = useState(emptyForm);
  const [filterStatut, setFilterStatut] = useState('');
  const [search, setSearch]     = useState('');

  const canCreate = ['admin_entreprise','comptable','app_owner'].includes(role);

  const load = useCallback(async () => {
    try {
      const [pRes, sRes, purRes] = await Promise.all([
        projectsAPI.get(projectId),
        projectsAPI.getBudgetStats(projectId).catch(()=>({data:null})),
        projectsAPI.listPurchases(projectId),
      ]);
      setProject(pRes.data);
      setStats(sRes.data);
      setPurchases(purRes.data || []);
    } catch { toast.error('Erreur chargement'); }
    finally { setLoading(false); }
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditPurchase(null); setForm(emptyForm); setModalOpen(true); };
  const openEdit   = (p) => {
    setEditPurchase(p);
    setForm({
      designation: p.designation, fournisseur: p.fournisseur||'',
      quantite: p.quantite, unite: p.unite||'',
      prix_unitaire: p.prix_unitaire, date_commande: p.date_commande||'',
      date_livraison: p.date_livraison||'', statut: p.statut, notes: p.notes||'',
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.designation || !form.quantite || !form.prix_unitaire || !form.date_commande)
      return toast.error('Désignation, quantité, prix et date requis');
    setSaving(true);
    try {
      const payload = { ...form, quantite: parseFloat(form.quantite), prix_unitaire: parseFloat(form.prix_unitaire) };
      if (!payload.date_livraison) delete payload.date_livraison;
      if (editPurchase) {
        await projectsAPI.updatePurchase(projectId, editPurchase.id, payload);
        toast.success('Achat mis à jour');
      } else {
        await projectsAPI.createPurchase(projectId, payload);
        toast.success('Achat enregistré');
      }
      setModalOpen(false);
      load();
    } catch (err) {
      const errors = err.response?.data;
      if (errors) Object.entries(errors).forEach(([k,v])=>{ const msgs=Array.isArray(v)?v:[v]; msgs.forEach(m=>toast.error(`${k}: ${m}`)); });
      else toast.error('Erreur');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Supprimer cet achat ?')) return;
    try { await projectsAPI.deletePurchase(projectId, id); toast.success('Supprimé'); load(); }
    catch { toast.error('Erreur'); }
  };

  const filtered = purchases.filter(p => {
    const q = search.toLowerCase();
    const matchSearch = !q || p.designation.toLowerCase().includes(q) || (p.fournisseur||'').toLowerCase().includes(q);
    const matchStatut = !filterStatut || p.statut === filterStatut;
    return matchSearch && matchStatut;
  });

  // Totals
  const totalCommandes = filtered.filter(p=>p.statut==='commande').reduce((a,p)=>a+(p.total||0),0);
  const totalLivre     = filtered.filter(p=>p.statut==='livre').reduce((a,p)=>a+(p.total||0),0);
  const totalGlobal    = filtered.reduce((a,p)=>a+(p.total||0),0);
  const budget         = parseFloat(project?.budget||0);
  const expenses       = parseFloat(project?.actual_expenses||0);
  const pctConsumed    = budget>0?Math.min(100,Math.round((expenses/budget)*100)):0;
  const contractsTotal = stats?.contracts_total||0;
  const marge          = contractsTotal>0?contractsTotal-expenses:null;

  return (
    <AppLayout projectName={project?.name}>
      {/* Top bar */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'0 32px', height:60, background:'#fff', borderBottom:`1px solid ${T.border}`, position:'sticky', top:0, zIndex:10 }}>
        <div style={{ display:'flex', alignItems:'center', gap:16 }}>
          <button onClick={()=>navigate(`/projects/${projectId}`)}
            style={{ background:'none', border:'none', color:T.textMuted, fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>← Projet</button>
          <h1 style={{ margin:0, fontSize:17, fontWeight:700, color:T.text }}>Budget & Achats — {project?.name}</h1>
        </div>
        {canCreate && (
          <button onClick={openCreate}
            style={{ padding:'8px 20px', borderRadius:8, background:T.orange, color:'#fff', fontSize:13, fontWeight:600, border:'none', cursor:'pointer', fontFamily:'inherit' }}>
            + Enregistrer un achat
          </button>
        )}
      </div>

      <div style={{ padding:32 }}>
        {/* Budget overview */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:24 }}>
          {[
            { label:'Budget prévisionnel', value:`${fmtFCFA(budget)} FCFA`, color:T.blue   },
            { label:'Dépenses réelles',    value:`${fmtFCFA(expenses)} FCFA`, color:pctConsumed>90?T.red:T.orange, alert:pctConsumed>90 },
            { label:'Total achats filtrés',value:`${fmtFCFA(totalGlobal)} FCFA`, color:T.text },
            ...(canViewFinancials && marge!=null ? [{ label:'Marge nette', value:`${marge>=0?'+':''}${fmtFCFA(marge)} FCFA`, color:marge>=0?T.green:T.red, alert:marge<0 }] : [{ label:'En attente livraison', value:`${fmtFCFA(totalCommandes)} FCFA`, color:T.yellow }]),
          ].map((k,i)=>(
            <Card key={i} p={18}>
              <div style={{ fontSize:11, color:T.textSub, marginBottom:4, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.4px' }}>{k.label}</div>
              <div style={{ fontSize:20, fontWeight:800, color:k.alert?T.red:k.color, lineHeight:1.2, marginBottom:6 }}>{k.value}</div>
              {k.label==='Dépenses réelles'&&budget>0&&<Pbar pct={pctConsumed} color={pctConsumed>90?T.red:T.orange}/>}
            </Card>
          ))}
        </div>

        {/* Budget breakdown cards */}
        {canViewFinancials && budget > 0 && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:24 }}>
            <Card>
              <div style={{ fontSize:13, fontWeight:700, color:T.text, marginBottom:16 }}>📊 Consommation budgétaire</div>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:T.textSub, marginBottom:6 }}>
                <span>Dépenses réelles vs Budget</span><span style={{ fontWeight:700, color:pctConsumed>90?T.red:T.orange }}>{pctConsumed}%</span>
              </div>
              <Pbar pct={pctConsumed} color={pctConsumed>90?T.red:T.orange} h={10}/>
              <div style={{ marginTop:12, fontSize:12, color:T.textMuted }}>
                Reste: {fmtFCFA(budget-expenses)} FCFA · Livré ce mois: {fmtFCFA(totalLivre)} FCFA
              </div>
            </Card>
            {contractsTotal > 0 && (
              <Card>
                <div style={{ fontSize:13, fontWeight:700, color:T.text, marginBottom:16 }}>💡 Marge bénéficiaire nette</div>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div>
                    <div style={{ fontSize:24, fontWeight:800, color:marge>=0?T.green:T.red }}>
                      {marge>=0?'+':''}{fmtFCFA(marge)} FCFA
                    </div>
                    <div style={{ fontSize:12, color:T.textMuted, marginTop:4 }}>
                      Contrats: {fmtFCFA(contractsTotal)} — Dépenses: {fmtFCFA(expenses)}
                    </div>
                  </div>
                  <div style={{ width:64, height:64, borderRadius:'50%', border:`5px solid ${marge>=0?T.green:T.red}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:800, color:marge>=0?T.green:T.red }}>
                    {contractsTotal>0?Math.round(((contractsTotal-expenses)/contractsTotal)*100):0}%
                  </div>
                </div>
              </Card>
            )}
          </div>
        )}

        {/* Filters */}
        <div style={{ display:'flex', gap:12, marginBottom:16, alignItems:'center', flexWrap:'wrap' }}>
          <input placeholder="🔍 Rechercher désignation / fournisseur..." value={search} onChange={e=>setSearch(e.target.value)}
            style={{...inp, width:300, background:'#fff'}}/>
          <div style={{ display:'flex', gap:8 }}>
            {[{value:'',label:'Tous'}, ...Object.entries(STATUT_CFG).map(([v,c])=>({value:v,label:c.label}))].map(f=>(
              <button key={f.value} onClick={()=>setFilterStatut(f.value)}
                style={{ padding:'7px 13px', borderRadius:8, fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit',
                  border:`1px solid ${filterStatut===f.value?T.orange:T.border}`,
                  background:filterStatut===f.value?T.orangeLight:'#fff',
                  color:filterStatut===f.value?T.orange:T.textSub }}>
                {f.label}
              </button>
            ))}
          </div>
          <span style={{ marginLeft:'auto', fontSize:12, color:T.textMuted }}>{filtered.length} ligne{filtered.length!==1?'s':''}</span>
        </div>

        {/* Table */}
        <Card p={0}>
          {loading ? (
            <div style={{ textAlign:'center', padding:'60px 0', color:T.textMuted }}>
              <div style={{ width:32, height:32, border:`3px solid ${T.orange}`, borderTopColor:'transparent', borderRadius:'50%', animation:'spin 1s linear infinite', margin:'0 auto 12px' }}/>
              Chargement...
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign:'center', padding:'60px 24px', color:T.textMuted }}>
              <div style={{ fontSize:40, marginBottom:12 }}>🛒</div>
              <div style={{ fontSize:14 }}>{purchases.length===0?'Aucun achat enregistré':'Aucun résultat pour ce filtre'}</div>
              {canCreate && purchases.length===0 && (
                <button onClick={openCreate} style={{ marginTop:16, padding:'9px 22px', borderRadius:8, background:T.orange, color:'#fff', fontSize:13, fontWeight:600, border:'none', cursor:'pointer', fontFamily:'inherit' }}>
                  + Enregistrer le premier achat
                </button>
              )}
            </div>
          ) : (
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr>{['Date','Désignation','Fournisseur','Qté','Unité', ...(canViewFinancials?['Prix unit.','Total FCFA']:[]), 'Livraison','Statut',''].map(h=>(
                  <th key={h} style={{ textAlign:'left', padding:'10px 14px', fontSize:11, color:T.textMuted, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.4px', borderBottom:`1px solid ${T.border}`, background:'#FAFAFA' }}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {filtered.map(p=>{
                  const sc = STATUT_CFG[p.statut]||STATUT_CFG.commande;
                  return (
                    <tr key={p.id} style={{ borderBottom:`1px solid ${T.border}` }}
                      onMouseEnter={e=>e.currentTarget.style.background='#FAFAFA'}
                      onMouseLeave={e=>e.currentTarget.style.background=''}>
                      <td style={{ padding:'11px 14px', fontSize:12, color:T.textSub, whiteSpace:'nowrap' }}>{fmtDate(p.date_commande)}</td>
                      <td style={{ padding:'11px 14px', fontSize:13, fontWeight:600, color:T.text }}>{p.designation}</td>
                      <td style={{ padding:'11px 14px', fontSize:12, color:T.textSub }}>{p.fournisseur||'—'}</td>
                      <td style={{ padding:'11px 14px', fontSize:12, color:T.textSub, textAlign:'right' }}>{parseFloat(p.quantite).toLocaleString('fr-FR')}</td>
                      <td style={{ padding:'11px 14px', fontSize:12, color:T.textSub }}>{p.unite||'—'}</td>
                      {canViewFinancials&&<>
                        <td style={{ padding:'11px 14px', fontSize:12, color:T.textSub, textAlign:'right' }}>{fmtFCFA(p.prix_unitaire)}</td>
                        <td style={{ padding:'11px 14px', fontSize:13, fontWeight:700, color:T.text, textAlign:'right' }}>{fmtFCFA(p.total)}</td>
                      </>}
                      <td style={{ padding:'11px 14px', fontSize:12, color:T.textSub, whiteSpace:'nowrap' }}>{fmtDate(p.date_livraison)}</td>
                      <td style={{ padding:'11px 14px' }}>
                        <span style={{ padding:'3px 9px', borderRadius:100, fontSize:11, fontWeight:600, color:sc.color, background:sc.bg }}>{sc.label}</span>
                      </td>
                      <td style={{ padding:'11px 14px' }}>
                        {canCreate&&(
                          <div style={{ display:'flex', gap:6 }}>
                            <button onClick={()=>openEdit(p)} style={{ padding:'4px 10px', borderRadius:6, border:`1px solid ${T.border}`, background:'#fff', color:T.textSub, fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>✏️</button>
                            <button onClick={()=>handleDelete(p.id)} style={{ padding:'4px 10px', borderRadius:6, border:`1px solid ${T.red}30`, background:T.redLight, color:T.red, fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>🗑</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {canViewFinancials && filtered.length > 0 && (
                <tfoot>
                  <tr style={{ background:'#FAFAFA', borderTop:`2px solid ${T.border}` }}>
                    <td colSpan={5} style={{ padding:'12px 14px', fontSize:13, fontWeight:700, color:T.text }}>Total</td>
                    <td style={{ padding:'12px 14px', fontSize:12, color:T.textMuted, textAlign:'right' }}>—</td>
                    <td style={{ padding:'12px 14px', fontSize:14, fontWeight:800, color:T.orange, textAlign:'right' }}>{fmtFCFA(totalGlobal)} FCFA</td>
                    <td colSpan={3}/>
                  </tr>
                </tfoot>
              )}
            </table>
          )}
        </Card>
      </div>

      {/* Purchase form modal */}
      <Modal open={modalOpen} onClose={()=>setModalOpen(false)} title={editPurchase?'Modifier l\'achat':'Nouvel achat / bon de commande'}>
        <Field label="Désignation *">
          <input style={inp} value={form.designation} onChange={e=>setForm(f=>({...f,designation:e.target.value}))} placeholder="ex: Béton BPE B25 — 20 m³"/>
        </Field>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <Field label="Fournisseur">
            <input style={inp} value={form.fournisseur} onChange={e=>setForm(f=>({...f,fournisseur:e.target.value}))} placeholder="ex: CIMAF Mali"/>
          </Field>
          <Field label="Statut">
            <select style={inp} value={form.statut} onChange={e=>setForm(f=>({...f,statut:e.target.value}))}>
              {Object.entries(STATUT_CFG).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
            </select>
          </Field>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
          <Field label="Quantité *">
            <input style={inp} type="number" min="0" step="0.01" value={form.quantite} onChange={e=>setForm(f=>({...f,quantite:e.target.value}))} placeholder="20"/>
          </Field>
          <Field label="Unité">
            <input style={inp} value={form.unite} onChange={e=>setForm(f=>({...f,unite:e.target.value}))} placeholder="m³, kg, sac, u..."/>
          </Field>
          <Field label="Prix unitaire (FCFA) *">
            <input style={inp} type="number" min="0" value={form.prix_unitaire} onChange={e=>setForm(f=>({...f,prix_unitaire:e.target.value}))} placeholder="85000"/>
          </Field>
        </div>
        {form.quantite && form.prix_unitaire && (
          <div style={{ marginBottom:14, padding:'10px 14px', background:T.orangeLight, borderRadius:8, fontSize:13, fontWeight:700, color:T.orange }}>
            Total estimé: {fmtFCFA(parseFloat(form.quantite)*parseFloat(form.prix_unitaire))} FCFA
          </div>
        )}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <Field label="Date commande *">
            <input style={inp} type="date" value={form.date_commande} onChange={e=>setForm(f=>({...f,date_commande:e.target.value}))}/>
          </Field>
          <Field label="Date livraison prévue">
            <input style={inp} type="date" value={form.date_livraison} onChange={e=>setForm(f=>({...f,date_livraison:e.target.value}))}/>
          </Field>
        </div>
        <Field label="Notes">
          <textarea style={{...inp,minHeight:60,resize:'vertical'}} value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Observations, conditions de livraison..."/>
        </Field>
        <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:8 }}>
          <button onClick={()=>setModalOpen(false)} style={{ padding:'9px 20px', borderRadius:8, border:`1px solid ${T.border}`, background:'#fff', color:T.textSub, fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>Annuler</button>
          <button onClick={handleSave} disabled={saving} style={{ padding:'9px 20px', borderRadius:8, background:T.orange, color:'#fff', fontSize:13, fontWeight:600, border:'none', cursor:'pointer', fontFamily:'inherit' }}>
            {saving?'Sauvegarde...':editPurchase?'Mettre à jour':'Enregistrer'}
          </button>
        </div>
      </Modal>
    </AppLayout>
  );
}