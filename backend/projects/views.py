"""
projects/views.py
BTP Manager — Multi-Tenant SaaS
================================
All views enforce:
  1. Tenant isolation  — projects scoped to user.company (FK), never user directly
  2. Role permissions  — gated by ProjectMember.role OR platform_role for B/C
  3. Spec rules        — chef_chantier blocked from financials,
                         client read-only, attendance only by E/F
"""

from django.utils import timezone
from django.db.models import Q, Sum, Count
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import (
    Project, ProjectMember, DailyReport, ReportImage,
    Incident, Task, Purchase, Attendance,
)
from .serializers import (
    ProjectSerializer,
    ProjectListSerializer,
    ProjectCreateSerializer,
    ProjectMemberSerializer,
    DailyReportSerializer,
    DailyReportCreateSerializer,
    ReportImageSerializer,
    IncidentSerializer,
    AttendanceSerializer,
    AttendanceCreateSerializer,
)


# ===========================================================================
# HELPERS
# ===========================================================================

def get_user_project(pk, user):
    """
    Returns a Project the user has access to, scoped to their company.

    Access rules:
      - app_owner (A)         → any project on the platform
      - admin_entreprise (B)  → any project of their company
      - office_admin (C)      → any project of their company
      - D→K                   → only projects they are a ProjectMember of
    """
    if user.platform_role == 'app_owner':
        qs = Project.objects.filter(id=pk)
    elif user.platform_role in ('admin_entreprise', 'office_admin'):
        qs = Project.objects.filter(id=pk, company=user.company)
    else:
        qs = Project.objects.filter(
            id=pk,
            company=user.company,
            members__user=user,
        )

    project = qs.distinct().first()
    if not project:
        from rest_framework.exceptions import NotFound
        raise NotFound('Projet introuvable ou accès refusé.')
    return project


def get_project_role(project, user):
    """
    Returns the user's effective role string for permission checks.

    Platform-level roles (A, B, C) return synthetic role strings
    so downstream checks can use a single role string uniformly.
    """
    if user.platform_role == 'app_owner':
        return 'app_owner'
    if user.platform_role in ('admin_entreprise', 'office_admin'):
        return user.platform_role   # 'admin_entreprise' or 'office_admin'
    membership = project.members.filter(user=user).first()
    return membership.role if membership else None


def can_access_financials(role):
    """
    Per spec: chef_chantier (E) is EXPLICITLY blocked from all financial data.
    chef_equipe (F) also has no financial access.
    """
    BLOCKED = {'chef_chantier', 'chef_equipe', 'ingenieur', 'qhse', 'client', None}
    return role not in BLOCKED


def require_platform_roles(user, *roles):
    """Returns 403 Response if user's platform_role is not in roles, else None."""
    if user.platform_role not in roles:
        return Response(
            {'detail': f"Action réservée aux rôles : {', '.join(roles)}."},
            status=status.HTTP_403_FORBIDDEN,
        )
    return None


# ===========================================================================
# PROJECTS — list & create
# ===========================================================================

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def project_list(request):
    """
    GET  /api/projects/   — list accessible projects
    POST /api/projects/   — create (admin_entreprise, office_admin, app_owner)
    """
    user = request.user

    if request.method == 'GET':
        if user.platform_role == 'app_owner':
            qs = Project.objects.all()
        elif user.platform_role in ('admin_entreprise', 'office_admin'):
            qs = Project.objects.filter(company=user.company)
        else:
            # D→K: only projects they're a member of, within their company
            qs = Project.objects.filter(
                company=user.company,
                members__user=user,
            )

        qs = qs.distinct()

        # Filters
        status_filter = request.query_params.get('status')
        type_filter   = request.query_params.get('type')
        search        = request.query_params.get('search')

        if status_filter:
            qs = qs.filter(status=status_filter)
        if type_filter:
            qs = qs.filter(project_type=type_filter)
        if search:
            qs = qs.filter(
                Q(name__icontains=search) |
                Q(reference__icontains=search) |
                Q(location__icontains=search)
            )

        return Response(ProjectListSerializer(qs, many=True).data)

    # POST — create project
    err = require_platform_roles(user, 'app_owner', 'admin_entreprise', 'office_admin')
    if err:
        return err

    if not user.company and user.platform_role != 'app_owner':
        return Response({'detail': 'Aucune entreprise associée.'}, status=status.HTTP_400_BAD_REQUEST)

    serializer = ProjectCreateSerializer(data=request.data)
    if serializer.is_valid():
        # Determine company: app_owner may pass company_id explicitly
        if user.platform_role == 'app_owner':
            from users.models import Company
            company_id = request.data.get('company_id')
            if not company_id:
                return Response({'company_id': ['Requis pour l\'App Owner.']}, status=status.HTTP_400_BAD_REQUEST)
            try:
                company = Company.objects.get(id=company_id)
            except Company.DoesNotExist:
                return Response({'company_id': ['Entreprise introuvable.']}, status=status.HTTP_404_NOT_FOUND)
        else:
            company = user.company

        project = serializer.save(company=company, created_by=user)
        return Response(ProjectSerializer(project).data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# ===========================================================================
# PROJECTS — detail
# ===========================================================================

@api_view(['GET', 'PUT', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def project_detail(request, pk):
    """
    GET    — all members with access
    PUT/PATCH/DELETE — admin_entreprise, office_admin, app_owner only
    """
    project = get_user_project(pk, request.user)
    role    = get_project_role(project, request.user)

    if request.method == 'GET':
        return Response(ProjectSerializer(project).data)

    # Mutations: only platform-level admins
    if role not in ('app_owner', 'admin_entreprise', 'office_admin'):
        return Response(
            {'detail': "Modification réservée aux administrateurs."},
            status=status.HTTP_403_FORBIDDEN,
        )

    if request.method in ('PUT', 'PATCH'):
        partial    = request.method == 'PATCH'
        serializer = ProjectCreateSerializer(project, data=request.data, partial=partial)
        if serializer.is_valid():
            serializer.save()
            project.refresh_from_db()
            return Response(ProjectSerializer(project).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    if request.method == 'DELETE':
        # Only admin_entreprise and app_owner can delete — not office_admin
        if role not in ('app_owner', 'admin_entreprise'):
            return Response({'detail': 'Suppression réservée au Directeur.'}, status=status.HTTP_403_FORBIDDEN)
        project.delete()
        return Response({'message': 'Projet supprimé.'}, status=status.HTTP_204_NO_CONTENT)


# ===========================================================================
# PROJECTS — budget stats
# ===========================================================================

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def project_budget_stats(request, pk):
    """
    GET /api/projects/<id>/budget-stats/
    Per spec: chef_chantier (E) and chef_equipe (F) are BLOCKED.
    """
    project = get_user_project(pk, request.user)
    role    = get_project_role(project, request.user)

    if not can_access_financials(role):
        return Response(
            {'detail': 'Accès aux données financières non autorisé pour votre rôle.'},
            status=status.HTTP_403_FORBIDDEN,
        )

    contracts_total = 0
    for c in project.contracts.exclude(summary=None):
        try:
            contracts_total += float(c.summary.get('montant_total') or 0)
        except (AttributeError, TypeError, ValueError):
            pass

    budget  = float(project.budget) if project.budget is not None else None
    actual  = float(project.actual_expenses)

    purchases_qs    = project.purchases.all()
    purchases_total = sum(p.total for p in purchases_qs)
    purchases_by_status = {
        item['statut']: item['count']
        for item in purchases_qs.values('statut').annotate(count=Count('id'))
    }

    tasks_summary = [
        {
            'id':           str(t.id),
            'name':         t.name,
            'status':       t.status,
            'progress_pct': t.progress_pct,
            'start_date':   str(t.start_date) if t.start_date else None,
            'end_date':     str(t.end_date)   if t.end_date   else None,
            'is_delayed':   t.is_delayed,
        }
        for t in project.tasks.filter(parent=None).order_by('order')
    ]

    return Response({
        'project_id':          str(project.id),
        'project_name':        project.name,
        'budget':              budget,
        'actual_expenses':     actual,
        'contracts_total':     round(contracts_total, 2),
        'purchases_total':     round(purchases_total, 2),
        'budget_remaining':    round(budget - actual, 2) if budget is not None else None,
        'budget_consumed_pct': round(actual / budget * 100, 1) if budget else None,
        'contracts_count':     project.contracts.count(),
        'daily_reports_count': project.daily_reports.count(),
        'purchases_by_status': purchases_by_status,
        'tasks':               tasks_summary,
    })


# ===========================================================================
# PROJECT MEMBERS
# ===========================================================================

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def project_members(request, pk):
    """
    GET  — all roles with at least read access can see members
    POST — office_admin (C), admin_entreprise (B), app_owner (A)
    """
    project = get_user_project(pk, request.user)
    role    = get_project_role(project, request.user)

    if request.method == 'GET':
        return Response(ProjectMemberSerializer(project.members.all(), many=True).data)

    if role not in ('app_owner', 'admin_entreprise', 'office_admin'):
        return Response({'detail': 'Réservé aux administrateurs.'}, status=status.HTTP_403_FORBIDDEN)

    # Validate the invited user belongs to the same company
    user_id = request.data.get('user')
    if user_id:
        from users.models import User as UserModel
        try:
            target = UserModel.objects.get(id=user_id)
            if target.company != request.user.company and not request.user.is_app_owner:
                return Response(
                    {'user': ["Cet utilisateur n'appartient pas à votre entreprise."]},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        except UserModel.DoesNotExist:
            return Response({'user': ['Utilisateur introuvable.']}, status=status.HTTP_404_NOT_FOUND)

    serializer = ProjectMemberSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save(project=project, added_by=request.user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def remove_project_member(request, pk, user_pk):
    project = get_user_project(pk, request.user)
    role    = get_project_role(project, request.user)

    if role not in ('app_owner', 'admin_entreprise', 'office_admin'):
        return Response({'detail': 'Réservé aux administrateurs.'}, status=status.HTTP_403_FORBIDDEN)

    member = get_object_or_404(ProjectMember, project=project, user_id=user_pk)
    member.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


# ===========================================================================
# ATTENDANCE (Pointage GPS — Anti-Fraud)
# Recorded by: Chef de Chantier (E) or Chef d'Équipe (F)
# ===========================================================================

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def attendance_list(request, pk):
    """
    GET  /api/projects/<id>/attendance/
         Accessible by: B (all alerts), C, D, E, F (own project)
    POST /api/projects/<id>/attendance/
         Only E (chef_chantier) and F (chef_equipe) can record attendance.
         Body: { worker, check_type, gps_lat, gps_lng, notes }
    """
    project = get_user_project(pk, request.user)
    role    = get_project_role(project, request.user)

    if request.method == 'GET':
        # Who can view attendance
        allowed_read = {
            'app_owner', 'admin_entreprise', 'office_admin',
            'chef_projet', 'chef_chantier', 'chef_equipe',
        }
        if role not in allowed_read:
            return Response({'detail': 'Accès non autorisé.'}, status=status.HTTP_403_FORBIDDEN)

        qs = project.attendances.select_related('worker', 'recorded_by')

        # Filter by date
        date_str = request.query_params.get('date')
        if date_str:
            qs = qs.filter(timestamp__date=date_str)
        else:
            # Default: today
            qs = qs.filter(timestamp__date=timezone.now().date())

        # Filter: only off-site alerts
        off_site = request.query_params.get('off_site')
        if off_site == 'true':
            qs = qs.filter(is_off_site=True)

        # Filter by worker
        worker_id = request.query_params.get('worker')
        if worker_id:
            qs = qs.filter(worker_id=worker_id)

        return Response(AttendanceSerializer(qs, many=True).data)

    # POST — record attendance
    # Only chef_chantier (E) and chef_equipe (F) per spec
    if role not in ('chef_chantier', 'chef_equipe', 'app_owner', 'admin_entreprise'):
        return Response(
            {'detail': 'Le pointage est réservé au Chef de Chantier et au Chef d\'Équipe.'},
            status=status.HTTP_403_FORBIDDEN,
        )

    serializer = AttendanceCreateSerializer(data=request.data)
    if serializer.is_valid():
        # Validate worker belongs to same company
        worker = serializer.validated_data['worker']
        if worker.company != request.user.company and not request.user.is_app_owner:
            return Response(
                {'worker': ["Cet ouvrier n'appartient pas à votre entreprise."]},
                status=status.HTTP_400_BAD_REQUEST,
            )

        attendance = serializer.save(
            project=project,
            recorded_by=request.user,
        )
        # Geofence is computed in Attendance.save() automatically

        response_data = AttendanceSerializer(attendance).data
        # Add alert message for frontend
        if attendance.is_off_site:
            response_data['alert'] = (
                f"⚠️ HORS SITE — Ouvrier pointé à {attendance.distance_from_site}m du chantier "
                f"(limite : {project.geofence_radius}m). Alerte envoyée au Directeur."
            )
        return Response(response_data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def attendance_off_site_alerts(request, pk):
    """
    GET /api/projects/<id>/attendance/alerts/
    Returns all off-site attendance records for today.
    Used by Director dashboard (B) — red alerts panel.
    """
    project = get_user_project(pk, request.user)
    role    = get_project_role(project, request.user)

    if role not in ('app_owner', 'admin_entreprise', 'office_admin', 'chef_projet'):
        return Response({'detail': 'Accès réservé aux administrateurs.'}, status=status.HTTP_403_FORBIDDEN)

    today = timezone.now().date()
    alerts = project.attendances.filter(
        is_off_site=True,
        timestamp__date=today,
    ).select_related('worker', 'recorded_by').order_by('-timestamp')

    return Response({
        'project_id':    str(project.id),
        'project_name':  project.name,
        'date':          str(today),
        'alerts_count':  alerts.count(),
        'alerts':        AttendanceSerializer(alerts, many=True).data,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def attendance_summary(request, pk):
    """
    GET /api/projects/<id>/attendance/summary/?date=YYYY-MM-DD
    Daily summary: workers in, workers out, off-site count.
    Used by Chef de Chantier mobile dashboard.
    """
    project = get_user_project(pk, request.user)
    role    = get_project_role(project, request.user)

    allowed = {'app_owner', 'admin_entreprise', 'office_admin', 'chef_projet', 'chef_chantier', 'chef_equipe'}
    if role not in allowed:
        return Response({'detail': 'Accès non autorisé.'}, status=status.HTTP_403_FORBIDDEN)

    date_str = request.query_params.get('date', str(timezone.now().date()))
    qs = project.attendances.filter(timestamp__date=date_str)

    workers_in     = qs.filter(check_type='in').values('worker').distinct().count()
    workers_out    = qs.filter(check_type='out').values('worker').distinct().count()
    off_site_count = qs.filter(is_off_site=True).count()

    # List of workers pointed today with their status
    from users.models import Worker
    workers_today = []
    for worker_id in qs.values_list('worker_id', flat=True).distinct():
        try:
            worker     = Worker.objects.get(id=worker_id)
            checked_in  = qs.filter(worker=worker, check_type='in').exists()
            checked_out = qs.filter(worker=worker, check_type='out').exists()
            any_off_site = qs.filter(worker=worker, is_off_site=True).exists()
            workers_today.append({
                'worker_id':    str(worker.id),
                'worker_name':  worker.full_name,
                'trade':        worker.get_trade_display(),
                'checked_in':   checked_in,
                'checked_out':  checked_out,
                'is_off_site':  any_off_site,
            })
        except Worker.DoesNotExist:
            pass

    return Response({
        'project_id':    str(project.id),
        'project_name':  project.name,
        'date':          date_str,
        'workers_in':    workers_in,
        'workers_out':   workers_out,
        'off_site_alerts': off_site_count,
        'workers_today': workers_today,
    })


# ===========================================================================
# DAILY REPORTS — list & create
# ===========================================================================

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def daily_report_list(request, pk):
    project = get_user_project(pk, request.user)
    role    = get_project_role(project, request.user)

    if request.method == 'GET':
        reports = project.daily_reports.select_related(
            'author', 'validated_by'
        ).prefetch_related('images', 'incidents')
        return Response(DailyReportSerializer(reports, many=True).data)

    # Write: chef_chantier (E) and up — but NOT client (K) or ingenieur (G)
    write_roles = {
        'app_owner', 'admin_entreprise', 'office_admin',
        'chef_projet', 'chef_chantier',
    }
    if role not in write_roles:
        return Response({'detail': 'Droits insuffisants pour créer un rapport.'}, status=status.HTTP_403_FORBIDDEN)

    serializer = DailyReportCreateSerializer(data=request.data)
    if serializer.is_valid():
        report = serializer.save(project=project, author=request.user)
        return Response(DailyReportSerializer(report).data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'PUT', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def daily_report_detail(request, pk, report_pk):
    project = get_user_project(pk, request.user)
    report  = get_object_or_404(DailyReport, id=report_pk, project=project)
    role    = get_project_role(project, request.user)

    if request.method == 'GET':
        return Response(DailyReportSerializer(report).data)

    is_author = report.author == request.user
    is_admin  = role in ('app_owner', 'admin_entreprise', 'office_admin')

    if not (is_author or is_admin):
        return Response(
            {'detail': "Seul l'auteur ou un administrateur peut modifier ce rapport."},
            status=status.HTTP_403_FORBIDDEN,
        )
    if report.is_validated and not is_admin:
        return Response(
            {'detail': 'Ce rapport est validé et ne peut plus être modifié.'},
            status=status.HTTP_403_FORBIDDEN,
        )

    if request.method in ('PUT', 'PATCH'):
        partial    = request.method == 'PATCH'
        serializer = DailyReportCreateSerializer(report, data=request.data, partial=partial)
        if serializer.is_valid():
            serializer.save()
            report.refresh_from_db()
            return Response(DailyReportSerializer(report).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    report.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def validate_report(request, pk, report_pk):
    """
    POST /api/projects/<id>/reports/<report_id>/validate/
    Only Chef de Projet (D) and above can validate.
    Per spec: validation by chef_projet or admin_entreprise.
    """
    project = get_user_project(pk, request.user)
    role    = get_project_role(project, request.user)

    validate_roles = {'app_owner', 'admin_entreprise', 'office_admin', 'chef_projet'}
    if role not in validate_roles:
        return Response(
            {'detail': 'Seul le Chef de Projet ou un administrateur peut valider un rapport.'},
            status=status.HTTP_403_FORBIDDEN,
        )

    report = get_object_or_404(DailyReport, id=report_pk, project=project)
    if report.is_validated:
        return Response({'detail': 'Ce rapport est déjà validé.'}, status=status.HTTP_400_BAD_REQUEST)

    report.is_validated = True
    report.validated_by = request.user
    report.validated_at = timezone.now()
    report.save()

    return Response(DailyReportSerializer(report).data)


# ===========================================================================
# REPORT IMAGES
# ===========================================================================

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def report_images(request, pk, report_pk):
    project = get_user_project(pk, request.user)
    report  = get_object_or_404(DailyReport, id=report_pk, project=project)
    role    = get_project_role(project, request.user)

    if request.method == 'GET':
        return Response(ReportImageSerializer(report.images.all(), many=True).data)

    is_author = report.author == request.user
    is_admin  = role in ('app_owner', 'admin_entreprise', 'office_admin')

    if not (is_author or is_admin):
        return Response({'detail': 'Droits insuffisants.'}, status=status.HTTP_403_FORBIDDEN)
    if report.is_validated and not is_admin:
        return Response(
            {'detail': "Rapport validé — impossible d'ajouter des photos."},
            status=status.HTTP_403_FORBIDDEN,
        )

    files = (
        request.FILES.getlist('images')
        or ([request.FILES.get('image')] if request.FILES.get('image') else [])
    )
    if not files:
        return Response({'detail': 'Aucun fichier fourni.'}, status=status.HTTP_400_BAD_REQUEST)

    created = []
    for f in files:
        img = ReportImage.objects.create(
            report=report,
            image=f,
            caption=request.data.get('caption', ''),
        )
        created.append(ReportImageSerializer(img).data)

    return Response(created, status=status.HTTP_201_CREATED)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_report_image(request, pk, report_pk, image_pk):
    project = get_user_project(pk, request.user)
    report  = get_object_or_404(DailyReport, id=report_pk, project=project)
    image   = get_object_or_404(ReportImage, id=image_pk, report=report)
    role    = get_project_role(project, request.user)

    is_author = report.author == request.user
    is_admin  = role in ('app_owner', 'admin_entreprise', 'office_admin')

    if not (is_author or is_admin):
        return Response({'detail': 'Droits insuffisants.'}, status=status.HTTP_403_FORBIDDEN)

    image.image.delete(save=False)
    image.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


# ===========================================================================
# INCIDENTS
# ===========================================================================

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def report_incidents(request, pk, report_pk):
    project = get_user_project(pk, request.user)
    report  = get_object_or_404(DailyReport, id=report_pk, project=project)
    role    = get_project_role(project, request.user)

    if request.method == 'GET':
        return Response(IncidentSerializer(report.incidents.all(), many=True).data)

    # Write: chef_chantier, qhse, and admins
    write_roles = {
        'app_owner', 'admin_entreprise', 'office_admin',
        'chef_projet', 'chef_chantier', 'qhse',
    }
    if role not in write_roles:
        return Response({'detail': 'Droits insuffisants.'}, status=status.HTTP_403_FORBIDDEN)

    serializer = IncidentSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save(report=report)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def report_incident_detail(request, pk, report_pk, incident_pk):
    project  = get_user_project(pk, request.user)
    report   = get_object_or_404(DailyReport, id=report_pk, project=project)
    incident = get_object_or_404(Incident, id=incident_pk, report=report)
    role     = get_project_role(project, request.user)

    write_roles = {'app_owner', 'admin_entreprise', 'chef_projet', 'chef_chantier', 'qhse'}
    if role not in write_roles:
        return Response({'detail': 'Droits insuffisants.'}, status=status.HTTP_403_FORBIDDEN)

    if request.method == 'PATCH':
        serializer = IncidentSerializer(incident, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    incident.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


# ===========================================================================
# TASKS (Gantt Planning)
# ===========================================================================

def serialize_task(task):
    return {
        'id':           str(task.id),
        'name':         task.name,
        'description':  task.description,
        'status':       task.status,
        'start_date':   str(task.start_date) if task.start_date else None,
        'end_date':     str(task.end_date)   if task.end_date   else None,
        'progress_pct': task.progress_pct,
        'order':        task.order,
        'is_delayed':   task.is_delayed,
        'parent':       str(task.parent_id) if task.parent_id else None,
        'assigned_to':  task.assigned_to.full_name if task.assigned_to else None,
        'subtasks': [
            {
                'id':           str(s.id),
                'name':         s.name,
                'status':       s.status,
                'progress_pct': s.progress_pct,
                'start_date':   str(s.start_date) if s.start_date else None,
                'end_date':     str(s.end_date)   if s.end_date   else None,
                'is_delayed':   s.is_delayed,
            }
            for s in task.subtasks.all().order_by('order')
        ],
    }


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def task_list(request, pk):
    project = get_user_project(pk, request.user)
    role    = get_project_role(project, request.user)

    if request.method == 'GET':
        tasks = project.tasks.filter(parent=None).prefetch_related('subtasks').order_by('order')
        return Response([serialize_task(t) for t in tasks])

    # Write: chef_projet (D) and admins
    write_roles = {'app_owner', 'admin_entreprise', 'office_admin', 'chef_projet'}
    if role not in write_roles:
        return Response({'detail': 'Droits insuffisants pour créer une tâche.'}, status=status.HTTP_403_FORBIDDEN)

    data = request.data
    task = Task.objects.create(
        project=project,
        name=data.get('name', ''),
        description=data.get('description', ''),
        status=data.get('status', 'a_faire'),
        start_date=data.get('start_date') or None,
        end_date=data.get('end_date') or None,
        progress_pct=int(data.get('progress_pct', 0)),
        order=int(data.get('order', 0)),
        parent_id=data.get('parent') or None,
        assigned_to_id=data.get('assigned_to') or None,
    )
    return Response(serialize_task(task), status=status.HTTP_201_CREATED)


@api_view(['GET', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def task_detail(request, pk, task_pk):
    project = get_user_project(pk, request.user)
    task    = get_object_or_404(Task, id=task_pk, project=project)
    role    = get_project_role(project, request.user)

    if request.method == 'GET':
        return Response(serialize_task(task))

    write_roles = {'app_owner', 'admin_entreprise', 'office_admin', 'chef_projet'}
    if role not in write_roles:
        return Response({'detail': 'Droits insuffisants.'}, status=status.HTTP_403_FORBIDDEN)

    if request.method == 'PATCH':
        data = request.data
        for field in ('name', 'description', 'status', 'start_date', 'end_date', 'progress_pct', 'order'):
            if field in data:
                setattr(task, field, data[field] if data[field] != '' else None)
        task.save()
        task.refresh_from_db()
        return Response(serialize_task(task))

    task.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


# ===========================================================================
# PURCHASES
# chef_chantier (E) is blocked — no financial data per spec
# ===========================================================================

def serialize_purchase(p, include_price=True):
    data = {
        'id':             str(p.id),
        'designation':    p.designation,
        'fournisseur':    p.fournisseur,
        'quantite':       float(p.quantite),
        'unite':          p.unite,
        'date_commande':  str(p.date_commande),
        'date_livraison': str(p.date_livraison) if p.date_livraison else None,
        'statut':         p.statut,
        'notes':          p.notes,
        'created_by':     p.created_by.full_name if p.created_by else None,
        'created_at':     p.created_at.isoformat(),
    }
    if include_price:
        data['prix_unitaire'] = float(p.prix_unitaire)
        data['total']         = p.total
    return data


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def purchase_list(request, pk):
    project = get_user_project(pk, request.user)
    role    = get_project_role(project, request.user)

    # chef_chantier (E) — blocked entirely per spec
    if role == 'chef_chantier':
        return Response(
            {'detail': 'Accès aux achats non autorisé pour le Chef de Chantier.'},
            status=status.HTTP_403_FORBIDDEN,
        )

    read_roles = {'app_owner', 'admin_entreprise', 'office_admin', 'chef_projet', 'comptable', 'magasinier'}
    if role not in read_roles:
        return Response({'detail': 'Accès non autorisé.'}, status=status.HTTP_403_FORBIDDEN)

    if request.method == 'GET':
        purchases = project.purchases.select_related('created_by').order_by('-date_commande')
        # magasinier sees no prices per spec — only quantities and delivery info
        show_price = role not in ('magasinier',)
        return Response([serialize_purchase(p, include_price=show_price) for p in purchases])

    # Write: comptable (J) and admins
    write_roles = {'app_owner', 'admin_entreprise', 'comptable'}
    if role not in write_roles:
        return Response({'detail': 'Création réservée au Comptable ou à l\'administrateur.'}, status=status.HTTP_403_FORBIDDEN)

    data = request.data
    try:
        purchase = Purchase.objects.create(
            project=project,
            created_by=request.user,
            designation=data['designation'],
            fournisseur=data.get('fournisseur', ''),
            quantite=float(data['quantite']),
            unite=data.get('unite', ''),
            prix_unitaire=float(data['prix_unitaire']),
            date_commande=data['date_commande'],
            date_livraison=data.get('date_livraison') or None,
            statut=data.get('statut', 'commande'),
            notes=data.get('notes', ''),
        )
        return Response(serialize_purchase(purchase), status=status.HTTP_201_CREATED)
    except (KeyError, ValueError) as e:
        return Response({'detail': f'Champ requis manquant ou invalide: {e}'}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def purchase_detail(request, pk, purchase_pk):
    project  = get_user_project(pk, request.user)
    purchase = get_object_or_404(Purchase, id=purchase_pk, project=project)
    role     = get_project_role(project, request.user)

    if role == 'chef_chantier':
        return Response({'detail': 'Accès non autorisé.'}, status=status.HTTP_403_FORBIDDEN)

    read_roles = {'app_owner', 'admin_entreprise', 'office_admin', 'chef_projet', 'comptable', 'magasinier'}
    if role not in read_roles:
        return Response({'detail': 'Accès non autorisé.'}, status=status.HTTP_403_FORBIDDEN)

    show_price = role not in ('magasinier',)

    if request.method == 'GET':
        return Response(serialize_purchase(purchase, include_price=show_price))

    write_roles = {'app_owner', 'admin_entreprise', 'comptable'}
    if role not in write_roles:
        return Response({'detail': 'Modification réservée au Comptable.'}, status=status.HTTP_403_FORBIDDEN)

    if request.method == 'PATCH':
        data      = request.data
        updatable = (
            'designation', 'fournisseur', 'quantite', 'unite', 'prix_unitaire',
            'date_commande', 'date_livraison', 'statut', 'notes',
        )
        for field in updatable:
            if field in data:
                setattr(purchase, field, data[field] if data[field] != '' else None)
        purchase.save()
        return Response(serialize_purchase(purchase))

    purchase.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


# ===========================================================================
# DASHBOARD STATS
# ===========================================================================

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dashboard_stats(request):
    """
    GET /api/projects/dashboard/
    Returns role-aware summary stats using get_dashboard_data().
    """
    from .models import get_dashboard_data

    project_id = request.query_params.get('project')
    project    = None

    if project_id:
        try:
            project = get_user_project(project_id, request.user)
        except Exception:
            return Response({'detail': 'Projet introuvable.'}, status=status.HTTP_404_NOT_FOUND)

    return Response(get_dashboard_data(request.user, project=project))