// frontend/src/pages/admin/PresencePaiePage.js
// Office Admin (C) — monthly attendance → payroll sheet
// Real data from /api/projects/:id/attendance/summary/ per worker
import React, { useState, useEffect, useCallback } from 'react';
import { projectsAPI, workersAPI, attendanceAPI } from '../../services/api';
import { usePermissions } from '../../context/PermissionsContext';
import AppLayout from '../../components/layout/AppLayout';
import toast from 'react-hot-toast';

const T = {
  card:'#FFFFFF', border:'#E8EDF2', text:'#1a1f2e', textSub:'#6B7280', textMuted:'#9CA3AF',
  orange:'#F97316', orangeLight:'rgba(249,115,22,0.1)',
  green:'#10B981', greenLight:'rgba(16,185,129,0.08)',
  red:'#EF4444', redLight:'rgba(239,68,68,0.08)',
  blue:'#3B82F6', shadow:'0 1px 3px rgba(0,0,0,0.07)',
};

const TRADE_ICONS = { maconnerie:'🧱', ferraillage:'⚙️', coffrage:'🪵', carrelage:'🔲', peinture:'🎨', plomberie:'🔧', electricite:'⚡', menuiserie:'🪚', manoeuvre:'👷', conducteur:'🚜', autre:'🔩' };

function fmtFCFA(n) {
  if (!n||isNaN(parseFloat(n))) return '—';
  const v=parseFloat(n);
  if (v>=1e6) return `${(v/1e6).toFixed(2)} M FCFA`;
  if (v>=1e3) return `${(v/1e3).toFixed(0)} K FCFA`;
  return v.toLocaleString('fr-FR')+' FCFA';
}

function Card({ children, style={}, p=24 }) {
  return <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:12, padding:p, boxShadow:T.shadow, ...style }}>{children}</div>;
}

// Get all days in a month
function getDaysInMonth(year, month) {
  const days = [];
  const date = new Date(year, month-1, 1);
  while (date.getMonth() === month-1) {
    days.push(date.toISOString().slice(0,10));
    date.setDate(date.getDate()+1);
  }
  return days;
}

export default function PresencePaiePage() {
  const { role } = usePermissions();

  const today   = new Date();
  const [year, setYear]   = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()+1);

  const [projects, setProjects]           = useState([]);
  const [workers, setWorkers]             = useState([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [presenceData, setPresenceData]   = useState({}); // workerId → days present
  const [loading, setLoading]             = useState(false);
  const [loadingInit, setLoadingInit]     = useState(true);
  const [validated, setValidated]         = useState(false);

  useEffect(() => {
    Promise.all([
      projectsAPI.list().catch(()=>({data:[]})),
      workersAPI.list({ is_active: true }).catch(()=>({data:[]})),
    ]).then(([pRes, wRes]) => {
      setProjects(pRes.data||[]);
      setWorkers(wRes.data||[]);
      if (pRes.data?.length > 0) setSelectedProject(pRes.data[0].id);
    }).finally(() => setLoadingInit(false));
  }, []);

  const loadAttendance = useCallback(async () => {
    if (!selectedProject) return;
    setLoading(true);
    const days = getDaysInMonth(year, month);
    const data = {};

    try {
      // Fetch attendance summary for each day
      const results = await Promise.all(
        days.map(day =>
          attendanceAPI.summary(selectedProject, day)
            .then(r => ({ day, workers: r.data?.workers_today||[] }))
            .catch(() => ({ day, workers: [] }))
        )
      );

      // Build presence map: workerId → array of days present
      results.forEach(({ day, workers: dayWorkers }) => {
        dayWorkers.forEach(w => {
          if (w.checked_in) {
            if (!data[w.worker_id]) data[w.worker_id] = { name: w.worker_name, days: [] };
            data[w.worker_id].days.push(day);
          }
        });
      });

      setPresenceData(data);
    } catch {
      toast.error('Erreur chargement présences');
    } finally {
      setLoading(false);
    }
  }, [selectedProject, year, month]);

  useEffect(() => {
    if (selectedProject) loadAttendance();
  }, [loadAttendance]);

  const monthName = new Date(year, month-1, 1).toLocaleDateString('fr-FR',{month:'long',year:'numeric'});

  // Build payroll table
  const payrollRows = workers.map(w => {
    const presence = presenceData[w.id] || { days: [] };
    const daysPresent = presence.days.length;
    const dailyRate   = parseFloat(w.daily_rate||0);
    const salary      = daysPresent * dailyRate;
    return { ...w, daysPresent, salary };
  });

  const totalDays   = payrollRows.reduce((a,r) => a+r.daysPresent, 0);
  const totalSalary = payrollRows.reduce((a,r) => a+r.salary, 0);
  const present     = payrollRows.filter(r => r.daysPresent > 0).length;

  // Working days in month (Mon-Sat, skip Sun)
  const workDays = getDaysInMonth(year, month).filter(d => new Date(d+'T12:00:00').getDay() !== 0).length;

  const handleExportCSV = () => {
    const rows = [
      ['Nom', 'Métier', 'Jours présents', 'Taux journalier (FCFA)', 'Salaire total (FCFA)'],
      ...payrollRows.map(r => [r.full_name||`${r.first_name} ${r.last_name}`, r.trade_display||r.trade, r.daysPresent, r.daily_rate||0, r.salary]),
      ['', '', '', 'TOTAL', totalSalary],
    ];
    const csv = rows.map(r => r.join(';')).join('\n');
    const blob = new Blob(['\ufeff'+csv], { type:'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `paie_${monthName.replace(' ','_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Export CSV téléchargé');
  };

  const MONTHS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

  return (
    <AppLayout>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'0 32px', height:60, background:'#fff', borderBottom:`1px solid ${T.border}`, position:'sticky', top:0, zIndex:10 }}>
        <h1 style={{ margin:0, fontSize:17, fontWeight:700, color:T.text }}>📋 Rapports de Présence & Paie</h1>
        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
          <select value={month} onChange={e=>setMonth(Number(e.target.value))}
            style={{ padding:'7px 12px', borderRadius:8, border:`1px solid ${T.border}`, fontSize:13, color:T.text, outline:'none', fontFamily:'inherit' }}>
            {MONTHS.map((m,i)=><option key={i+1} value={i+1}>{m}</option>)}
          </select>
          <select value={year} onChange={e=>setYear(Number(e.target.value))}
            style={{ padding:'7px 12px', borderRadius:8, border:`1px solid ${T.border}`, fontSize:13, color:T.text, outline:'none', fontFamily:'inherit' }}>
            {[2023,2024,2025,2026].map(y=><option key={y} value={y}>{y}</option>)}
          </select>
          <select value={selectedProject} onChange={e=>setSelectedProject(e.target.value)}
            style={{ padding:'7px 12px', borderRadius:8, border:`1px solid ${T.border}`, fontSize:13, color:T.text, outline:'none', fontFamily:'inherit', maxWidth:220 }}>
            <option value="">— Tous les projets —</option>
            {projects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button onClick={handleExportCSV}
            style={{ padding:'8px 16px', borderRadius:8, background:T.green, color:'#fff', fontSize:12, fontWeight:600, border:'none', cursor:'pointer', fontFamily:'inherit' }}>
            📥 Export CSV
          </button>
        </div>
      </div>

      <div style={{ padding:32 }}>
        {/* Month header */}
        <div style={{ marginBottom:24, padding:'16px 24px', background:'linear-gradient(135deg, #1a1f2e 0%, #2d3748 100%)', borderRadius:12, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <div style={{ fontSize:22, fontWeight:800, color:'#fff', marginBottom:4 }}>
              Fiche de paie — {monthName.charAt(0).toUpperCase()+monthName.slice(1)}
            </div>
            <div style={{ fontSize:13, color:'rgba(255,255,255,0.6)' }}>
              {workDays} jours ouvrables · {present} ouvriers actifs
            </div>
          </div>
          {validated ? (
            <div style={{ padding:'8px 18px', borderRadius:8, background:'rgba(16,185,129,0.2)', border:'1px solid rgba(16,185,129,0.4)', color:'#10B981', fontSize:13, fontWeight:600 }}>
              ✅ Fiche validée
            </div>
          ) : (
            <button onClick={() => { setValidated(true); toast.success('Fiche de paie validée !'); }}
              style={{ padding:'8px 18px', borderRadius:8, background:'rgba(249,115,22,0.2)', border:'1px solid rgba(249,115,22,0.4)', color:'#F97316', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
              Valider la fiche
            </button>
          )}
        </div>

        {/* KPIs */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:24 }}>
          {[
            { label:'Ouvriers actifs',    value:workers.length,         color:T.orange },
            { label:'Présences totales',  value:totalDays,              color:T.blue   },
            { label:'Jours ouvrables',    value:workDays,               color:T.textSub },
            { label:'Masse salariale',    value:fmtFCFA(totalSalary),   color:T.green  },
          ].map((k,i)=>(
            <Card key={i} p={18}>
              <div style={{ fontSize:11, color:T.textSub, marginBottom:4, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.4px' }}>{k.label}</div>
              <div style={{ fontSize:k.label==='Masse salariale'?18:28, fontWeight:800, color:k.color, lineHeight:1 }}>{k.value}</div>
            </Card>
          ))}
        </div>

        {/* Payroll table */}
        <Card p={0}>
          <div style={{ padding:'14px 20px', borderBottom:`1px solid ${T.border}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div style={{ fontSize:14, fontWeight:700, color:T.text }}>Détail par ouvrier</div>
            {loading && <div style={{ fontSize:12, color:T.textMuted }}>Chargement des présences...</div>}
          </div>
          {loadingInit ? (
            <div style={{ textAlign:'center', padding:'60px 0', color:T.textMuted }}>
              <div style={{ width:32, height:32, border:`3px solid ${T.orange}`, borderTopColor:'transparent', borderRadius:'50%', animation:'spin 1s linear infinite', margin:'0 auto 12px' }}/>
              Initialisation...
            </div>
          ) : workers.length === 0 ? (
            <div style={{ textAlign:'center', padding:'60px 24px', color:T.textMuted }}>
              <div style={{ fontSize:40, marginBottom:12 }}>👷</div>
              <div style={{ fontSize:14 }}>Aucun ouvrier enregistré</div>
            </div>
          ) : (
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr>{['Ouvrier','Métier','Jours présents',`Taux/jour (FCFA)`,`Salaire ${MONTHS[month-1]} (FCFA)`,'Présence %','Statut'].map(h=>(
                  <th key={h} style={{ textAlign:'left', padding:'10px 16px', fontSize:11, color:T.textMuted, fontWeight:600, textTransform:'uppercase', letterSpacing:'0.4px', borderBottom:`1px solid ${T.border}`, background:'#FAFAFA' }}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {payrollRows.map(r => {
                  const pct = workDays > 0 ? Math.round((r.daysPresent/workDays)*100) : 0;
                  return (
                    <tr key={r.id} style={{ borderBottom:`1px solid ${T.border}` }}
                      onMouseEnter={e=>e.currentTarget.style.background='#FAFAFA'}
                      onMouseLeave={e=>e.currentTarget.style.background=''}>
                      <td style={{ padding:'12px 16px' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                          <div style={{ width:34, height:34, borderRadius:10, background:T.orangeLight, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>
                            {TRADE_ICONS[r.trade]||'👷'}
                          </div>
                          <div style={{ fontSize:13, fontWeight:600, color:T.text }}>{r.full_name||`${r.first_name} ${r.last_name}`}</div>
                        </div>
                      </td>
                      <td style={{ padding:'12px 16px', fontSize:12, color:T.textSub }}>{r.trade_display||r.trade}</td>
                      <td style={{ padding:'12px 16px', fontSize:15, fontWeight:800, color:r.daysPresent>0?T.blue:T.textMuted, textAlign:'center' }}>
                        {loading ? '...' : r.daysPresent}
                      </td>
                      <td style={{ padding:'12px 16px', fontSize:13, color:T.textSub }}>{r.daily_rate?parseFloat(r.daily_rate).toLocaleString('fr-FR'):'—'}</td>
                      <td style={{ padding:'12px 16px', fontSize:14, fontWeight:800, color:r.salary>0?T.green:T.textMuted }}>
                        {r.salary>0?parseFloat(r.salary).toLocaleString('fr-FR'):'—'}
                      </td>
                      <td style={{ padding:'12px 16px', width:120 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                          <div style={{ flex:1, height:6, background:T.border, borderRadius:3, overflow:'hidden' }}>
                            <div style={{ height:'100%', width:`${pct}%`, background:pct>=80?T.green:pct>=50?T.orange:T.red, borderRadius:3 }}/>
                          </div>
                          <span style={{ fontSize:11, color:T.textSub, minWidth:28 }}>{pct}%</span>
                        </div>
                      </td>
                      <td style={{ padding:'12px 16px' }}>
                        <span style={{ padding:'3px 9px', borderRadius:100, fontSize:11, fontWeight:600,
                          color:pct>=80?T.green:pct>=50?T.orange:T.red,
                          background:pct>=80?T.greenLight:pct>=50?T.orangeLight:T.redLight }}>
                          {pct>=80?'Régulier':pct>=50?'Partiel':'Absent'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ background:'#F9FAFB', borderTop:`2px solid ${T.border}` }}>
                  <td colSpan={2} style={{ padding:'12px 16px', fontSize:13, fontWeight:700, color:T.text }}>TOTAL</td>
                  <td style={{ padding:'12px 16px', fontSize:15, fontWeight:800, color:T.blue, textAlign:'center' }}>{totalDays}</td>
                  <td style={{ padding:'12px 16px' }}>—</td>
                  <td style={{ padding:'12px 16px', fontSize:15, fontWeight:800, color:T.green }}>
                    {totalSalary.toLocaleString('fr-FR')} FCFA
                  </td>
                  <td colSpan={2}/>
                </tr>
              </tfoot>
            </table>
          )}
        </Card>
      </div>
    </AppLayout>
  );
}