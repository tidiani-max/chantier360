// frontend/src/App.js — Fixed: AccessDenied loop, stock route, new roles
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { PermissionsProvider, usePermissions } from './context/PermissionsContext';
import { GoogleOAuthProvider } from '@react-oauth/google';

// ── Auth ──────────────────────────────────────────────────────────────────────
import LandingPage        from './pages/LandingPage';
import LoginPage          from './pages/auth/LoginPage';
import RegisterPage       from './pages/auth/RegisterPage';
import OTPVerifyPage      from './pages/auth/OTPPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import ResetPasswordPage  from './pages/auth/ResetPasswordPage';

// ── Core ──────────────────────────────────────────────────────────────────────
import DashboardPage       from './pages/dashboard/DashboardPage';
import ProjectsPage        from './pages/projects/ProjectsPage';
import CreateProjectPage   from './pages/projects/CreateProjectPage';
import ProjectDetailPage   from './pages/projects/ProjectDetailPage';
import DailyReportFormPage from './pages/projects/Dailyreportformpage';
import ContractUploadPage  from './pages/contracts/ContractUploadPage';
import ContractDetailPage  from './pages/contracts/ContractDetailPage';

// ── Phase 2: Project modules ──────────────────────────────────────────────────
import ProjectPickerPage from './pages/projects/ProjectPickerPage';
import PlanningPage      from './pages/projects/PlanningPage';
import BudgetPage        from './pages/projects/BudgetPage';
import QHSEPage          from './pages/projects/QHSEPage';
import PointagePage      from './pages/projects/PointagePage';
import DocumentsPage     from './pages/projects/DocumentsPage';
import RapportsPage      from './pages/reports/RapportsPage';

// ── Finance ───────────────────────────────────────────────────────────────────
import TresoreriePage from './pages/finance/TresoreriePage';

// ── Admin / HR ────────────────────────────────────────────────────────────────
import CompaniesPage    from './pages/admin/CompaniesPage';
import TeamPage         from './pages/admin/TeamPage';
import WorkersPage      from './pages/admin/WorkersPage';
import InventairePage   from './pages/admin/InventairePage';
import PresencePaiePage from './pages/admin/PresencePaiePage';
import { AbonnementsPage, UsersAllPage, MonitoringPage, LogsPage } from './pages/admin/AppOwnerPages';

// ── Settings ──────────────────────────────────────────────────────────────────
import ParametresPage from './pages/settings/ParametresPage';

// ─── Spinner ──────────────────────────────────────────────────────────────────
function Spinner() {
  return (
    <div style={{ display:'flex', minHeight:'100vh', alignItems:'center', justifyContent:'center', background:'#0D0D1A' }}>
      <div style={{ width:36, height:36, border:'3px solid #F59E0B', borderTopColor:'transparent', borderRadius:'50%', animation:'spin 1s linear infinite' }}/>
    </div>
  );
}

// ─── FIXED: AccessDenied — no longer calls history.back() which caused loops ──
function AccessDenied() {
  const navigate = useNavigate();
  return (
    <div style={{ display:'flex', minHeight:'100vh', alignItems:'center', justifyContent:'center', background:'#F8F9FA', flexDirection:'column', gap:16 }}>
      <div style={{ fontSize:48 }}>🔒</div>
      <h2 style={{ color:'#1a1f2e', fontSize:22, fontWeight:700, margin:0 }}>Accès restreint</h2>
      <p style={{ color:'#6B7280', fontSize:14, margin:0, textAlign:'center', maxWidth:320 }}>
        Vous n'avez pas les droits pour accéder à cette section.
      </p>
      {/* FIXED: navigate('/dashboard') instead of window.history.back() */}
      <button
        onClick={() => navigate('/dashboard', { replace: true })}
        style={{ padding:'10px 24px', borderRadius:8, background:'#F97316', border:'none', color:'#fff', cursor:'pointer', fontSize:14, fontWeight:600, fontFamily:'inherit' }}
      >
        ← Retour au tableau de bord
      </button>
    </div>
  );
}

// ─── Guards ───────────────────────────────────────────────────────────────────
function PrivateRoute({ children, module, roles }) {
  const { user, loading } = useAuth();
  const { can, role }     = usePermissions();
  if (loading) return <Spinner/>;
  if (!user)   return <Navigate to="/login" replace/>;
  if (roles && !roles.includes(role)) return <AccessDenied/>;
  if (module && !can(module))          return <AccessDenied/>;
  return children;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Navigate to="/dashboard" replace/> : children;
}

// ─── Roles that can see projects (not app_owner — he sees companies only) ─────
const PROJECT_ROLES = [
  'directeur_general', 'admin_entreprise', 'directeur_technique',
  'office_admin', 'chef_projet', 'chef_chantier', 'chef_equipe',
  'ingenieur', 'qhse', 'magasinier', 'comptable', 'client',
];

// ─── Roles that can create/edit projects ─────────────────────────────────────
const PROJECT_CREATE_ROLES = ['directeur_general', 'admin_entreprise', 'app_owner'];

// ─── Roles that see finance ───────────────────────────────────────────────────
const FINANCE_ROLES = [
  'directeur_general', 'admin_entreprise', 'comptable', 'app_owner',
];

// ─── Routes ───────────────────────────────────────────────────────────────────
function AppRoutes() {
  return (
    <Routes>
      {/* ── Public ─────────────────────────────────────────────────────── */}
      <Route path="/"                element={<LandingPage/>}/>
      <Route path="/login"           element={<PublicRoute><LoginPage/></PublicRoute>}/>
      <Route path="/register"        element={<PublicRoute><RegisterPage/></PublicRoute>}/>
      <Route path="/verify-otp"      element={<PublicRoute><OTPVerifyPage/></PublicRoute>}/>
      <Route path="/forgot-password" element={<PublicRoute><ForgotPasswordPage/></PublicRoute>}/>
      <Route path="/reset-password"  element={<PublicRoute><ResetPasswordPage/></PublicRoute>}/>

      {/* ── Dashboard — all authenticated users ────────────────────────── */}
      <Route path="/dashboard" element={<PrivateRoute><DashboardPage/></PrivateRoute>}/>

      {/* ── App Owner only ─────────────────────────────────────────────── */}
      <Route path="/companies"     element={<PrivateRoute roles={['app_owner']}><CompaniesPage/></PrivateRoute>}/>
      <Route path="/users"         element={<PrivateRoute roles={['app_owner']}><UsersAllPage/></PrivateRoute>}/>
      <Route path="/subscriptions" element={<PrivateRoute roles={['app_owner']}><AbonnementsPage/></PrivateRoute>}/>
      <Route path="/monitoring"    element={<PrivateRoute roles={['app_owner']}><MonitoringPage/></PrivateRoute>}/>
      <Route path="/logs"          element={<PrivateRoute roles={['app_owner']}><LogsPage/></PrivateRoute>}/>

      {/* ── Projects list — all except app_owner ───────────────────────── */}
      <Route path="/projects" element={
        <PrivateRoute roles={PROJECT_ROLES}>
          <ProjectsPage/>
        </PrivateRoute>
      }/>

      {/* ── Create project — directeur only ────────────────────────────── */}
      <Route path="/projects/new" element={
        <PrivateRoute roles={PROJECT_CREATE_ROLES}>
          <CreateProjectPage/>
        </PrivateRoute>
      }/>

      {/* ── Project detail — all project roles ─────────────────────────── */}
      <Route path="/projects/:id" element={
        <PrivateRoute roles={PROJECT_ROLES}>
          <ProjectDetailPage/>
        </PrivateRoute>
      }/>

      {/* ── Project-scoped modules ─────────────────────────────────────── */}
      <Route path="/projects/:id/planning"  element={<PrivateRoute module="planning"><PlanningPage/></PrivateRoute>}/>
      <Route path="/projects/:id/budget"    element={<PrivateRoute module="budget"><BudgetPage/></PrivateRoute>}/>
      <Route path="/projects/:id/qhse"      element={<PrivateRoute module="qhse"><QHSEPage/></PrivateRoute>}/>
      <Route path="/projects/:id/documents" element={<PrivateRoute module="documents"><DocumentsPage/></PrivateRoute>}/>
      <Route path="/projects/:id/pointage"  element={
        <PrivateRoute roles={['chef_chantier','chef_equipe','admin_entreprise','directeur_general','app_owner']}>
          <PointagePage/>
        </PrivateRoute>
      }/>

      {/* Daily reports */}
      <Route path="/projects/:id/reports/new"       element={<PrivateRoute module="journal"><DailyReportFormPage/></PrivateRoute>}/>
      <Route path="/projects/:id/reports/:reportId" element={<PrivateRoute module="journal"><DailyReportFormPage/></PrivateRoute>}/>

      {/* ── Global module routes — project picker ──────────────────────── */}
      <Route path="/planning"  element={<PrivateRoute module="planning"><ProjectPickerPage module="planning"/></PrivateRoute>}/>
      <Route path="/budget"    element={<PrivateRoute module="budget"><ProjectPickerPage module="budget"/></PrivateRoute>}/>
      <Route path="/qhse"      element={<PrivateRoute module="qhse"><ProjectPickerPage module="qhse"/></PrivateRoute>}/>
      <Route path="/documents" element={<PrivateRoute module="documents"><ProjectPickerPage module="documents"/></PrivateRoute>}/>
      <Route path="/pointage"  element={
        <PrivateRoute roles={['chef_chantier','chef_equipe','admin_entreprise','directeur_general','app_owner']}>
          <ProjectPickerPage module="pointage"/>
        </PrivateRoute>
      }/>

      {/* ── FIXED: Stock — uses stock module, not budget ────────────────── */}
      <Route path="/stock" element={
        <PrivateRoute module="stock">
          <ProjectPickerPage module="stock"/>
        </PrivateRoute>
      }/>

      {/* ── Finance — directeur + comptable ────────────────────────────── */}
      <Route path="/treasury" element={
        <PrivateRoute roles={FINANCE_ROLES}>
          <TresoreriePage/>
        </PrivateRoute>
      }/>

      {/* ── Rapports ───────────────────────────────────────────────────── */}
      <Route path="/reports" element={<PrivateRoute module="reports"><RapportsPage/></PrivateRoute>}/>

      {/* ── Contracts ──────────────────────────────────────────────────── */}
      <Route path="/contracts/upload" element={<PrivateRoute><ContractUploadPage/></PrivateRoute>}/>
      <Route path="/contracts/:id"    element={<PrivateRoute><ContractDetailPage/></PrivateRoute>}/>

      {/* ── Team & HR ──────────────────────────────────────────────────── */}
      <Route path="/team" element={
        <PrivateRoute roles={['app_owner','directeur_general','admin_entreprise','directeur_technique','office_admin','chef_projet']}>
          <TeamPage/>
        </PrivateRoute>
      }/>
      <Route path="/workers"    element={<PrivateRoute roles={['directeur_general','admin_entreprise','office_admin']}><WorkersPage/></PrivateRoute>}/>
      <Route path="/inventory"  element={<PrivateRoute roles={['directeur_general','admin_entreprise','office_admin']}><InventairePage/></PrivateRoute>}/>
      <Route path="/attendance" element={<PrivateRoute roles={['office_admin','directeur_general','admin_entreprise']}><PresencePaiePage/></PrivateRoute>}/>

      {/* ── Settings — all roles ───────────────────────────────────────── */}
      <Route path="/settings" element={<PrivateRoute><ParametresPage/></PrivateRoute>}/>

      {/* ── Catch-all — go to dashboard (NOT history.back) ─────────────── */}
      <Route path="*" element={<Navigate to="/dashboard" replace/>}/>
    </Routes>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID || 'missing-client-id';
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <AuthProvider>
        <PermissionsProvider>
          <BrowserRouter>
            <Toaster
              position="top-right"
              toastOptions={{
                style: { background:'#1A1A2E', color:'#fff', border:'1px solid rgba(245,158,11,0.2)', fontSize:14 },
                success: { iconTheme: { primary:'#10B981', secondary:'#fff' } },
                error:   { iconTheme: { primary:'#EF4444', secondary:'#fff' } },
              }}
            />
            <AppRoutes />
          </BrowserRouter>
        </PermissionsProvider>
      </AuthProvider>
    </GoogleOAuthProvider>
  );
}
