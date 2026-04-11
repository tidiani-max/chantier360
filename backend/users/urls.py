"""
users/urls.py
BTP Manager — Multi-Tenant SaaS
================================
All auth, team, worker, company, and dashboard endpoints.
"""

from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from . import views

urlpatterns = [
    # ── Auth ─────────────────────────────────────────────────────────────
    path('register/',         views.register,         name='register'),
    path('verify-otp/',       views.verify_otp,       name='verify-otp'),
    path('resend-otp/',       views.resend_otp,        name='resend-otp'),
    path('login/',            views.login,             name='login'),
    path('forgot-password/',  views.forgot_password,   name='forgot-password'),
    path('reset-password/',   views.reset_password,    name='reset-password'),
    path('google/',           views.google_auth,       name='google-auth'),
    path('token/refresh/',    TokenRefreshView.as_view(), name='token-refresh'),

    # ── Profile ──────────────────────────────────────────────────────────
    path('profile/',          views.profile,           name='profile'),
    path('profile/update/',   views.update_profile,    name='update-profile'),

    # ── Dashboard (role-filtered data) ───────────────────────────────────
    path('dashboard/',        views.dashboard_data,    name='dashboard-data'),

    # ── Team management ──────────────────────────────────────────────────
    # B (admin_entreprise) and C (office_admin) can invite and manage D→K
    path('team/',                        views.list_team,          name='team-list'),
    path('invite/',                      views.invite_user,         name='invite-user'),
    path('team/<uuid:user_id>/',         views.update_team_member,  name='team-member-update'),
    path('team/<uuid:user_id>/delete/',  views.delete_team_member,  name='team-member-delete'),

    # ── Workers (Ouvriers — not platform users) ───────────────────────────
    # Created by C (office_admin), pointed by E (chef_chantier) / F (chef_equipe)
    path('workers/',                     views.workers,             name='workers-list'),
    path('workers/<uuid:worker_id>/',    views.worker_detail,       name='worker-detail'),
]