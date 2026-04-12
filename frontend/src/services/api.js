// frontend/src/services/api.js
import axios from 'axios';

const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

// Ensure /api is ALWAYS appended and there are no double slashes
const API_BASE = `${BASE_URL.replace(/\/$/, '')}/api/`; 

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refresh = localStorage.getItem('refresh_token');
      if (refresh) {
        try {
          // No leading slash for refresh either
          const res = await axios.post(`${API_BASE}auth/token/refresh/`, { refresh });
          localStorage.setItem('access_token', res.data.access);
          original.headers.Authorization = `Bearer ${res.data.access}`;
          return api(original);
        } catch {
          localStorage.clear();
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

// ── Auth ──────────────────────────────────────────────────────────────────────
// ALL LEADING SLASHES REMOVED
export const authAPI = {
  register:       (data) => api.post('auth/register/', data),
  verifyOTP:      (data) => api.post('auth/verify-otp/', data),
  resendOTP:      (data) => api.post('auth/resend-otp/', data),
  login:          (data) => api.post('auth/login/', data),
  forgotPassword: (data) => api.post('auth/forgot-password/', data),
  resetPassword:  (data) => api.post('auth/reset-password/', data),
  googleAuth:     (data) => api.post('auth/google/', data),
  getProfile:     ()     => api.get('auth/profile/'),
  updateProfile:  (data) => api.put('auth/profile/update/', data),
  getDashboard:   (projectId) => api.get('auth/dashboard/', { params: projectId ? { project: projectId } : {} }),
};

// ── Team ──────────────────────────────────────────────────────────────────────
export const teamAPI = {
  list:       (params)   => api.get('auth/team/', { params }),
  invite:     (data)     => api.post('auth/invite/', data),
  update:     (id, data) => api.patch(`auth/team/${id}/`, data),
  deactivate: (id)       => api.delete(`auth/team/${id}/delete/`),
};

// ── Workers ───────────────────────────────────────────────────────────────────
export const workersAPI = {
  list:   (params)   => api.get('auth/workers/', { params }),
  create: (data)     => api.post('auth/workers/', data),
  get:    (id)       => api.get(`auth/workers/${id}/`),
  update: (id, data) => api.patch(`auth/workers/${id}/`, data),
  delete: (id)       => api.delete(`auth/workers/${id}/`),
};

// ── Companies ─────────────────────────────────────────────────────────────────
export const companiesAPI = {
  list:   ()         => api.get('companies/'),
  create: (data)     => api.post('companies/', data),
  get:    (id)       => api.get(`companies/${id}/`),
  update: (id, data) => api.patch(`companies/${id}/`, data),
};

// ── Projects ──────────────────────────────────────────────────────────────────
export const projectsAPI = {
  list:   (params)   => api.get('projects/', { params }),
  create: (data)     => api.post('projects/', data),
  get:    (id)       => api.get(`projects/${id}/`),
  update: (id, data) => api.put(`projects/${id}/`, data),
  patch:  (id, data) => api.patch(`projects/${id}/`, data),
  delete: (id)       => api.delete(`projects/${id}/`),

  getDashboardStats: () => api.get('projects/dashboard/'),
  getBudgetStats:   (id) => api.get(`projects/${id}/budget-stats/`),

  // Members
  getMembers:   (id)          => api.get(`projects/${id}/members/`),
  addMember:    (id, data)    => api.post(`projects/${id}/members/`, data),
  removeMember: (id, userId)  => api.delete(`projects/${id}/members/${userId}/`),

  // Daily reports
  listReports:   (pid)            => api.get(`projects/${pid}/reports/`),
  createReport:  (pid, data)      => api.post(`projects/${pid}/reports/`, data),
  getReport:     (pid, rid)       => api.get(`projects/${pid}/reports/${rid}/`),
  updateReport:  (pid, rid, data) => api.put(`projects/${pid}/reports/${rid}/`, data),
  deleteReport:  (pid, rid)       => api.delete(`projects/${pid}/reports/${rid}/`),
  validateReport:(pid, rid)       => api.post(`projects/${pid}/reports/${rid}/validate/`),

  // Report images
  uploadReportImage: (pid, rid, fd)  => api.post(`projects/${pid}/reports/${rid}/images/`, fd, { headers: { 'Content-Type': 'multipart/form-data' } }),
  deleteReportImage: (pid, rid, iid) => api.delete(`projects/${pid}/reports/${rid}/images/${iid}/`),

  // Incidents
  listIncidents:   (pid, rid)        => api.get(`projects/${pid}/reports/${rid}/incidents/`),
  createIncident:  (pid, rid, data)  => api.post(`projects/${pid}/reports/${rid}/incidents/`, data),
  updateIncident:  (pid, rid, iid, data) => api.patch(`projects/${pid}/reports/${rid}/incidents/${iid}/`, data),
  deleteIncident:  (pid, rid, iid)   => api.delete(`projects/${pid}/reports/${rid}/incidents/${iid}/`),

  // Tasks (Gantt)
  listTasks:   (pid)             => api.get(`projects/${pid}/tasks/`),
  createTask:  (pid, data)       => api.post(`projects/${pid}/tasks/`, data),
  updateTask:  (pid, tid, data)  => api.patch(`projects/${pid}/tasks/${tid}/`, data),
  deleteTask:  (pid, tid)        => api.delete(`projects/${pid}/tasks/${tid}/`),

  // Purchases
  listPurchases:   (pid)              => api.get(`projects/${pid}/purchases/`),
  createPurchase:  (pid, data)        => api.post(`projects/${pid}/purchases/`, data),
  updatePurchase:  (pid, puid, data)  => api.patch(`projects/${pid}/purchases/${puid}/`, data),
  deletePurchase:  (pid, puid)        => api.delete(`projects/${pid}/purchases/${puid}/`),

  // Attendance summary/alerts
  getAttendanceSummary: (pid, date) => api.get(`projects/${pid}/attendance/summary/`, { params: date ? { date } : {} }),
  getAttendanceAlerts:  (pid)       => api.get(`projects/${pid}/attendance/alerts/`),
};

// ── Attendance ────────────────────────────────────────────────────────────────
export const attendanceAPI = {
  list:    (projectId, params) => api.get(`projects/${projectId}/attendance/`, { params }),
  checkin: (projectId, data)   => api.post(`projects/${projectId}/attendance/`, data),
  alerts:  (projectId)         => api.get(`projects/${projectId}/attendance/alerts/`),
  summary: (projectId, date)   => api.get(`projects/${projectId}/attendance/summary/`, { params: date ? { date } : {} }),
};

// ── Contracts ─────────────────────────────────────────────────────────────────
export const contractsAPI = {
  list:         (projectId) => api.get('contracts/', { params: projectId ? { project: projectId } : {} }),
  upload:       (fd)        => api.post('contracts/', fd, { headers: { 'Content-Type': 'multipart/form-data' } }),
  get:          (id)        => api.get(`contracts/${id}/`),
  delete:       (id)        => api.delete(`contracts/${id}/`),
  validate:     (id)        => api.post(`contracts/${id}/validate/`),
  exportPdf:    (id)        => api.get(`contracts/${id}/export-pdf/`, { responseType: 'blob' }),
  exportPdfUrl: (id)        => `${API_BASE}contracts/${id}/export-pdf/`,
};

// ── Reports alias ─────────────────────────────────────────────────────────────
export const reportsAPI = {
  list:   (pid)          => api.get(`projects/${pid}/reports/`),
  create: (pid, data)    => api.post(`projects/${pid}/reports/`, data),
  get:    (pid, rid)     => api.get(`projects/${pid}/reports/${rid}/`),
  update: (pid, rid, d)  => api.put(`projects/${pid}/reports/${rid}/`, d),
  delete: (pid, rid)     => api.delete(`projects/${pid}/reports/${rid}/`),
};

export default api;