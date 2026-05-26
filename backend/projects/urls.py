# backend/projects/urls.py
# Added: archive endpoint, archived list endpoint

from django.urls import path
from . import views

urlpatterns = [
    # ── Projects ──────────────────────────────────────────────────────────
    path('',               views.project_list,   name='project-list'),
    path('dashboard/',     views.dashboard_stats, name='dashboard-stats'),

    # SOFT DELETE
    path('archived/',      views.project_archived_list, name='project-archived-list'),
    path('<uuid:pk>/archive/', views.project_archive,   name='project-archive'),

    path('<uuid:pk>/',     views.project_detail,  name='project-detail'),
    path('<uuid:pk>/budget-stats/', views.project_budget_stats, name='project-budget-stats'),

    # ── Members ───────────────────────────────────────────────────────────
    path('<uuid:pk>/members/',            views.project_members,       name='project-members'),
    path('<uuid:pk>/members/<uuid:user_pk>/', views.remove_project_member, name='remove-project-member'),

    # ── Attendance ────────────────────────────────────────────────────────
    path('<uuid:pk>/attendance/',          views.attendance_list,            name='attendance-list'),
    path('<uuid:pk>/attendance/alerts/',   views.attendance_off_site_alerts, name='attendance-alerts'),
    path('<uuid:pk>/attendance/summary/',  views.attendance_summary,         name='attendance-summary'),

    # ── Daily Reports ─────────────────────────────────────────────────────
    path('<uuid:pk>/reports/',                            views.daily_report_list,    name='daily-report-list'),
    path('<uuid:pk>/reports/<uuid:report_pk>/',           views.daily_report_detail,  name='daily-report-detail'),
    path('<uuid:pk>/reports/<uuid:report_pk>/validate/',  views.validate_report,      name='validate-report'),

    # ── Report Images ─────────────────────────────────────────────────────
    path('<uuid:pk>/reports/<uuid:report_pk>/images/',              views.report_images,       name='report-images'),
    path('<uuid:pk>/reports/<uuid:report_pk>/images/<uuid:image_pk>/', views.delete_report_image, name='delete-report-image'),

    # ── Incidents ─────────────────────────────────────────────────────────
    path('<uuid:pk>/reports/<uuid:report_pk>/incidents/',                   views.report_incidents,       name='report-incidents'),
    path('<uuid:pk>/reports/<uuid:report_pk>/incidents/<uuid:incident_pk>/',views.report_incident_detail, name='report-incident-detail'),

    # ── Tasks (Gantt) ─────────────────────────────────────────────────────
    path('<uuid:pk>/tasks/',             views.task_list,   name='task-list'),
    path('<uuid:pk>/tasks/<uuid:task_pk>/', views.task_detail, name='task-detail'),

    # ── Purchases ─────────────────────────────────────────────────────────
    path('<uuid:pk>/purchases/',                  views.purchase_list,   name='purchase-list'),
    path('<uuid:pk>/purchases/<uuid:purchase_pk>/', views.purchase_detail, name='purchase-detail'),
]
