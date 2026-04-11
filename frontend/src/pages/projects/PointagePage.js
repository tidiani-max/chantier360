// frontend/src/pages/projects/PointagePage.js
// Chef de chantier (E) / Chef d'équipe (F) — real GPS check-in/out
// Calls /api/projects/:id/attendance/ POST with GPS coords
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { projectsAPI, attendanceAPI, workersAPI } from '../../services/api';
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

const TRADE_ICONS = {
  maconnerie:'🧱', ferraillage:'⚙️', coffrage:'🪵', carrelage:'🔲',
  peinture:'🎨', plomberie:'🔧', electricite:'⚡', menuiserie:'🪚',
  manoeuvre:'👷', conducteur:'🚜', autre:'🔩',
};

function Card({ children, style={}, p=24 }) {
  return <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:12, padding:p, boxShadow:T.shadow, ...style }}>{children}</div>;
}

function GPSIndicator({ status, coords }) {
  const cfg = {
    acquiring: { color:T.yellow, bg:'#FFFBEB', icon:'📡', text:'Acquisition GPS...' },
    ok:        { color:T.green,  bg:'#ECFDF5', icon:'📍', text:`GPS OK · ${coords?.lat?.toFixed(4)}, ${coords?.lng?.toFixed(4)}` },
    denied:    { color:T.red,    bg:'#FEF2F2', icon:'🚫', text:'GPS refusé — activer la localisation' },
    error:     { color:T.orange, bg:'#FFF7ED', icon:'⚠️', text:'Erreur GPS — pointage sans coords' },
  }[status] || { color:T.textMuted, bg:'#F9FAFB', icon:'📍', text:'GPS non activé' };
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 14px', borderRadius:8, background:cfg.bg, border:`1px solid ${cfg.color}30`, fontSize:12, color:cfg.color, fontWeight:500 }}>
      <span>{cfg.icon}</span>{cfg.text}
    </div>
  );
}

export default function PointagePage() {
  const { id: projectId } = useParams();
  const navigate = useNavigate();
  const { role } = usePermissions();

  const [project, setProject]   = useState(null);
  const [workers, setWorkers]   = useState([]);
  const [summary, setSummary]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [gpsStatus, setGpsStatus] = useState('idle'); // idle|acquiring|ok|denied|error
  const [gpsCoords, setGpsCoords] = useState(null);
  const [checkingIn, setCheckingIn] = useState({}); // workerId → loading
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0,10));

  const canPoint = ['chef_chantier','chef_equipe','app_owner','admin_entreprise'].includes(role);

  const load = useCallback(async () => {
    try {
      const [pRes, wRes, sumRes] = await Promise.all([
        projectsAPI.get(projectId),
        workersAPI.list({ is_active: true }),
        attendanceAPI.summary(projectId, selectedDate).catch(()=>({data:null})),
      ]);
      setProject(pRes.data);
      setWorkers(wRes.data || []);
      setSummary(sumRes.data);
    } catch { toast.error('Erreur chargement'); }
    finally { setLoading(false); }
  }, [projectId, selectedDate]);

  useEffect(() => { load(); }, [load]);

  // Acquire GPS on mount
  useEffect(() => {
    if (!canPoint) return;
    setGpsStatus('acquiring');
    if (!navigator.geolocation) { setGpsStatus('error'); return; }
    navigator.geolocation.getCurrentPosition(
      pos => {
        setGpsCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGpsStatus('ok');
      },
      err => setGpsStatus(err.code===1?'denied':'error'),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [canPoint]);

  const handlePoint = async (worker, checkType) => {
    if (!canPoint) return;
    const key = `${worker.id}_${checkType}`;
    setCheckingIn(c => ({ ...c, [key]: true }));
    try {
      const payload = { worker: worker.id, check_type: checkType };
      if (gpsCoords && gpsStatus === 'ok') {
        payload.gps_lat = gpsCoords.lat;
        payload.gps_lng = gpsCoords.lng;
      }
      const res = await attendanceAPI.checkin(projectId, payload);
      const data = res.data;
      if (data.alert) {
        toast.error(data.alert, { duration: 6000, icon: '🔴' });
      } else {
        toast.success(`${worker.first_name} ${worker.last_name} — ${checkType==='in'?'Entrée':'Sortie'} enregistrée ✅`);
      }
      // Refresh summary
      const sumRes = await attendanceAPI.summary(projectId, selectedDate).catch(()=>({data:null}));
      setSummary(sumRes.data);
    } catch (err) {
      const msg = err.response?.data?.detail || 'Erreur pointage';
      toast.error(msg);
    } finally {
      setCheckingIn(c => { const n={...c}; delete n[key]; return n; });
    }
  };

  // Build worker status from summary
  const workerStatus = {};
  (summary?.workers_today || []).forEach(w => {
    workerStatus[w.worker_id] = w;
  });

  const today = new Date().toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'});

  return (
    <AppLayout projectName={project?.name}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'0 32px', height:60, background:'#fff', borderBottom:`1px solid ${T.border}`, position:'sticky', top:0, zIndex:10 }}>
        <div style={{ display:'flex', alignItems:'center', gap:16 }}>
          <button onClick={()=>navigate(`/projects/${projectId}`)} style={{ background:'none', border:'none', color:T.textMuted, fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>← Projet</button>
          <h1 style={{ margin:0, fontSize:17, fontWeight:700, color:T.text }}>Pointage GPS — {project?.name}</h1>
        </div>
        <div style={{ display:'flex', gap:12, alignItems:'center' }}>
          <input type="date" value={selectedDate} onChange={e=>setSelectedDate(e.target.value)}
            style={{ padding:'7px 12px', borderRadius:8, border:`1px solid ${T.border}`, fontSize:13, color:T.text, outline:'none', fontFamily:'inherit' }}/>
          <GPSIndicator status={gpsStatus} coords={gpsCoords}/>
        </div>
      </div>

      <div style={{ padding:32 }}>
        {/* Date + summary */}
        <Card style={{ marginBottom:24 }} p={20}>
          <div style={{ fontSize:13, color:T.textSub, marginBottom:12, fontWeight:500 }}>
            {selectedDate===new Date().toISOString().slice(0,10)?`Aujourd'hui — ${today}`:selectedDate}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:0, borderTop:`1px solid ${T.border}`, paddingTop:16 }}>
            {[
              [summary?.workers_in||0,        'Entrées',          T.green ],
              [summary?.workers_out||0,        'Sorties',          T.blue  ],
              [summary?.off_site_alerts||0,    'Hors-site 🔴',    summary?.off_site_alerts>0?T.red:T.textMuted ],
              [workers.length,                 'Ouvriers actifs',  T.orange],
            ].map(([v,l,c],i)=>(
              <div key={i} style={{ textAlign:'center', borderRight:i<3?`1px solid ${T.border}`:'none', padding:'0 16px' }}>
                <div style={{ fontSize:28, fontWeight:800, color:c }}>{v}</div>
                <div style={{ fontSize:11, color:T.textSub, marginTop:2 }}>{l}</div>
              </div>
            ))}
          </div>
        </Card>

        {!canPoint && (
          <div style={{ padding:'12px 16px', background:'#FFFBEB', border:'1px solid #FDE68A', borderRadius:8, fontSize:13, color:'#92400E', marginBottom:20 }}>
            ⚠️ Le pointage est réservé au Chef de Chantier et au Chef d'Équipe.
          </div>
        )}

        {loading ? (
          <div style={{ textAlign:'center', padding:'40px 0', color:T.textMuted }}>Chargement...</div>
        ) : workers.length === 0 ? (
          <Card style={{ textAlign:'center', padding:'60px 24px' }}>
            <div style={{ fontSize:40, marginBottom:12 }}>👷</div>
            <div style={{ fontSize:14, color:T.textSub }}>Aucun ouvrier enregistré — ajoutez des ouvriers via le module Ressources</div>
          </Card>
        ) : (
          <div>
            {/* Workers grid */}
            <div style={{ marginBottom:16, fontSize:14, fontWeight:700, color:T.text }}>
              Ouvriers ({workers.length}) — Cliquez pour pointer entrée ou sortie
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:14 }}>
              {workers.map(w => {
                const ws = workerStatus[w.id];
                const checkedIn  = ws?.checked_in  || false;
                const checkedOut = ws?.checked_out || false;
                const isOffSite  = ws?.is_off_site || false;
                const inKey  = `${w.id}_in`;
                const outKey = `${w.id}_out`;

                return (
                  <Card key={w.id} p={16} style={{
                    border:`1px solid ${isOffSite?T.red:checkedIn?T.green:T.border}`,
                    background:isOffSite?T.redLight:checkedIn?'#F0FDF4':T.card,
                    position:'relative',
                  }}>
                    {isOffSite && (
                      <div style={{ position:'absolute', top:10, right:10, padding:'2px 8px', borderRadius:100, background:T.red, color:'#fff', fontSize:10, fontWeight:700 }}>
                        🔴 HORS-SITE
                      </div>
                    )}
                    <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:14 }}>
                      <div style={{ width:44, height:44, borderRadius:10, background:T.orangeLight, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, flexShrink:0 }}>
                        {TRADE_ICONS[w.trade]||'👷'}
                      </div>
                      <div>
                        <div style={{ fontSize:14, fontWeight:700, color:T.text }}>{w.first_name} {w.last_name}</div>
                        <div style={{ fontSize:11, color:T.textSub }}>{w.trade_display || w.trade}</div>
                      </div>
                    </div>

                    {/* Status indicators */}
                    <div style={{ display:'flex', gap:6, marginBottom:12 }}>
                      <div style={{ flex:1, padding:'5px 0', borderRadius:6, background:checkedIn?T.greenLight:T.border, textAlign:'center', fontSize:11, fontWeight:600, color:checkedIn?T.green:T.textMuted }}>
                        {checkedIn?'✅ Entré':'— Absent'}
                      </div>
                      <div style={{ flex:1, padding:'5px 0', borderRadius:6, background:checkedOut?T.blueLight||'#EFF6FF':T.border, textAlign:'center', fontSize:11, fontWeight:600, color:checkedOut?T.blue:T.textMuted }}>
                        {checkedOut?'🚪 Sorti':'— Pas sorti'}
                      </div>
                    </div>

                    {/* Action buttons */}
                    {canPoint && (
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                        <button
                          onClick={() => handlePoint(w, 'in')}
                          disabled={!!checkingIn[inKey]}
                          style={{ padding:'8px 0', borderRadius:8, background:checkedIn?T.greenLight:T.green, color:checkedIn?T.green:'#fff', border:`1px solid ${T.green}30`, fontSize:12, fontWeight:600, cursor:checkingIn[inKey]?'wait':'pointer', fontFamily:'inherit' }}>
                          {checkingIn[inKey]?'...':'▶ Entrée'}
                        </button>
                        <button
                          onClick={() => handlePoint(w, 'out')}
                          disabled={!!checkingIn[outKey]}
                          style={{ padding:'8px 0', borderRadius:8, background:checkedOut?T.blueLight||'#EFF6FF':T.blue, color:checkedOut?T.blue:'#fff', border:`1px solid ${T.blue}30`, fontSize:12, fontWeight:600, cursor:checkingIn[outKey]?'wait':'pointer', fontFamily:'inherit' }}>
                          {checkingIn[outKey]?'...':'◼ Sortie'}
                        </button>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>

            {/* Off-site alerts */}
            {(summary?.off_site_alerts||0) > 0 && (
              <Card style={{ marginTop:24, border:`1px solid ${T.red}30`, background:T.redLight }}>
                <div style={{ fontSize:13, fontWeight:700, color:T.red, marginBottom:12 }}>
                  🔴 Alertes pointage hors-site — {summary.off_site_alerts} détectée{summary.off_site_alerts>1?'s':''}
                </div>
                {(summary.workers_today||[]).filter(w=>w.is_off_site).map(w=>(
                  <div key={w.worker_id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 0', borderBottom:`1px solid ${T.red}20` }}>
                    <span style={{ fontSize:16 }}>⚠️</span>
                    <div style={{ flex:1, fontSize:13, color:T.text }}>{w.worker_name}</div>
                    <span style={{ fontSize:11, color:T.red, fontWeight:600 }}>Hors périmètre du chantier</span>
                  </div>
                ))}
                <div style={{ marginTop:10, fontSize:12, color:T.red }}>Le Directeur sera notifié automatiquement.</div>
              </Card>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}