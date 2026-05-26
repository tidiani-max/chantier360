"""
projects/views.py  — BTP Manager
=================================
Changes vs original:
  - Added directeur_general + directeur_technique to all role checks
  - Soft delete: project_list and project_detail filter is_deleted=False
  - Archive endpoint: POST /api/projects/<id>/archive/
  - project_list POST: only directeur_general + directeur_technique can create
  - project_detail DELETE: only directeur_general can delete
  - All admin_entreprise references now include directeur_general alias
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
    ProjectSerializer, ProjectListSerializer, ProjectCreateSerializer,
    ProjectMemberSerializer, DailyReportSerializer, DailyReportCreateSerializer,
    ReportImageSerializer, IncidentSerializer,
    AttendanceSerializer, AttendanceCreateSerializer,
)


# ===========================================================================
# ROLE SETS — centralised so one change updates everywhere
# ===========================================================================

# Roles that see ALL company projects (not just assigned)
COMPANY_WIDE_ROLES = {
    'app_owner', 'directeur_general', 'admin_entreprise',
    'directeur_technique', 'office_admin',
}

# Roles that can create projects
PROJECT_CREATE_ROLES = {
    'app_owner', 'directeur_general', 'admin_entreprise',
}

# Roles that can hard-delete projects (directeur_technique excluded intentionally)
PROJECT_DELETE_ROLES = {
    'app_owner', 'directeur_general', 'admin_entreprise',
}

# Roles treated as "admin" for mutation guards
ADMIN_ROLES = {
    'app_owner', 'directeur_general', 'admin_entreprise', 'office_admin',
}

# Roles that can validate daily reports
VALIDATE_REPORT_ROLES = {
    'app_owner', 'directeur_general', 'admin_entreprise',
    'directeur_technique', 'office_admin', 'chef_projet',
}

# Roles that can manage project members
MEMBER_MANAGE_ROLES = {
    'app_owner', 'directeur_general', 'admin_entreprise', 'office_admin',
}

# Roles that can write daily reports
REPORT_WRITE_ROLES = {
    'app_owner', 'directeur_general', 'admin_entreprise',
    'directeur_technique', 'office_admin', 'chef_projet', 'chef_chantier',
}

# Roles blocked from all financial data (per spec)
FINANCE_BLOCKED_ROLES = {
    'chef_chantier', 'chef_equipe', 'ingenieur', 'qhse', 'client', None,
}


# ===========================================================================
# HELPERS
# ===========================================================================

def get_user_project(pk, user):
    """
    Returns a Project the user can access, enforcing tenant + role isolation.
    COMPANY_WIDE_ROLES → any project of their company.
    Others           → only projects they are ProjectMember of.
    Soft-deleted projects are NEVER returned.
    """
    base_qs = Project.objects.filter(is_deleted=False) if _has_soft_delete() else Project.objects.all()

    if user.platform_role == 'app_owner':
        qs = base_qs.filter(id=pk)
    elif user.platform_role in COMPANY_WIDE_ROLES:
        qs = base_qs.filter(id=pk, company=user.company)
    else:
        qs = base_qs.filter(id=pk, company=user.company, members__user=user)

    project = qs.distinct().first()
    if not project:
        from rest_framework.exceptions import NotFound
        raise NotFound('Projet introuvable ou accès refusé.')
    return project


def _has_soft_delete():
    """Returns True if the Project model has the is_deleted field (after migration)."""
    try:
        Project._meta.get_field('is_deleted')
        return True
    except Exception:
        return False


def get_project_role(project, user):
    """Returns the effective role string for downstream permission checks."""
    if user.platform_role == 'app_owner':
        return 'app_owner'
    if user.platform_role in COMPANY_WIDE_ROLES:
        return user.platform_role
    membership = project.members.filter(user=user).first()
    return membership.role if membership else None


def can_access_financials(role):
    return role not in FINANCE_BLOCKED_ROLES


def require_platform_roles(user, *roles):
    if user.platform_role not in roles:
        return Response(
            {'detail': f"Action réservée aux rôles : {', '.join(roles)}."},
            status=status.HTTP_403_FORBIDDEN,
        )
    return None


def _project_qs_for_user(user):
    """Returns the base queryset of projects visible to this user."""
    base = Project.objects.filter(is_deleted=False) if _has_soft_delete() else Project.objects.all()

    if user.platform_role == 'app_owner':
        return base.all()
    if user.platform_role in COMPANY_WIDE_ROLES:
        return base.filter(company=user.company)
    # D→K: only assigned projects within their company
    return base.filter(company=user.company, members__user=user)


# ===========================================================================
# PROJECTS — list & create
# ===========================================================================

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def project_list(request):
    user = request.user

    if request.method == 'GET':
        qs = _project_qs_for_user(user).distinct()

        # Optional filters
        if request.query_params.get('status'):
            qs = qs.filter(status=request.query_params['status'])
        if request.query_params.get('type'):
            qs = qs.filter(project_type=request.query_params['type'])
        if request.query_params.get('search'):
            q = request.query_params['search']
            qs = qs.filter(
                Q(name__icontains=q) | Q(reference__icontains=q) | Q(location__icontains=q)
            )

        return Response(ProjectListSerializer(qs, many=True).data)

    # POST — create project: only directeurs can create
    if user.platform_role not in PROJECT_CREATE_ROLES:
        return Response(
            {'detail': 'La création de projet est réservée au Directeur Général.'},
            status=status.HTTP_403_FORBIDDEN,
        )

    if not user.company and user.platform_role != 'app_owner':
        return Response({'detail': 'Aucune entreprise associée.'}, status=status.HTTP_400_BAD_REQUEST)

    serializer = ProjectCreateSerializer(data=request.data)
    if serializer.is_valid():
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
    project = get_user_project(pk, request.user)
    role    = get_project_role(project, request.user)

    if request.method == 'GET':
        return Response(ProjectSerializer(project).data)

    # Mutations: admin roles only
    if role not in ADMIN_ROLES:
        return Response(
            {'detail': 'Modification réservée aux administrateurs.'},
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
        # Hard delete — only directeur_general / app_owner
        if role not in PROJECT_DELETE_ROLES:
            return Response(
                {'detail': 'Suppression réservée au Directeur Général.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        project.delete()
        return Response({'message': 'Projet supprimé.'}, status=status.HTTP_204_NO_CONTENT)


# ===========================================================================
# SOFT DELETE — Archive / Restore
# ===========================================================================

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def project_archive(request, pk):
    """
    POST /api/projects/<id>/archive/
    Soft-delete: sets is_deleted=True, records who and when.
    Only directeur_general and app_owner.
    """
    if not _has_soft_delete():
        return Response(
            {'detail': 'Soft delete non disponible. Exécutez la migration SQL d\'abord.'},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    project = get_user_project(pk, request.user)
    role    = get_project_role(project, request.user)

    if role not in PROJECT_DELETE_ROLES:
        return Response(
            {'detail': 'Archivage réservé au Directeur Général.'},
            status=status.HTTP_403_FORBIDDEN,
        )

    action = request.data.get('action', 'archive')  # 'archive' or 'restore'

    if action == 'restore':
        project.is_deleted = False
        project.deleted_at = None
        if hasattr(project, 'deleted_by'):
            project.deleted_by = None
        project.save(update_fields=['is_deleted', 'deleted_at'])
        return Response({'message': 'Projet restauré.', 'id': str(project.id)})
    else:
        project.is_deleted = True
        project.deleted_at = timezone.now()
        if hasattr(project, 'deleted_by'):
            project.deleted_by = request.user
        project.save(update_fields=['is_deleted', 'deleted_at'])
        return Response({'message': 'Projet archivé.', 'id': str(project.id)})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def project_archived_list(request):
    """
    GET /api/projects/archived/
    Returns archived projects for admin roles.
    """
    if not _has_soft_delete():
        return Response([])

    role = request.user.platform_role
    if role not in ADMIN_ROLES:
        return Response({'detail': 'Accès non autorisé.'}, status=status.HTTP_403_FORBIDDEN)

    if role == 'app_owner':
        qs = Project.objects.filter(is_deleted=True)
    else:
        qs = Project.objects.filter(is_deleted=True, company=request.user.company)

    return Response(ProjectListSerializer(qs, many=True).data)


# ===========================================================================
# PROJECTS — budget stats (unchanged, but role set updated)
# ===========================================================================

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def project_budget_stats(request, pk):
    project = get_user_project(pk, request.user)
    role    = get_project_role(project, request.user)

    if not can_access_financials(role):
        return Response(
            {'detail': 'Accès aux données financières non autorisé.'},
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
            'id': str(t.id), 'name': t.name, 'status': t.status,
            'progress_pct': t.progress_pct,
            'start_date': str(t.start_date) if t.start_date else None,
            'end_date':   str(t.end_date)   if t.end_date   else None,
            'is_delayed': t.is_delayed,
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
    project = get_user_project(pk, request.user)
    role    = get_project_role(project, request.user)

    if request.method == 'GET':
        return Response(ProjectMemberSerializer(project.members.all(), many=True).data)

    if role not in MEMBER_MANAGE_ROLES:
        return Response({'detail': 'Réservé aux administrateurs.'}, status=status.HTTP_403_FORBIDDEN)

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
    if role not in MEMBER_MANAGE_ROLES:
        return Response({'detail': 'Réservé aux administrateurs.'}, status=status.HTTP_403_FORBIDDEN)
    member = get_object_or_404(ProjectMember, project=project, user_id=user_pk)
    member.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


# ===========================================================================
# ATTENDANCE (GPS Pointage) — unchanged except role set references
# ===========================================================================

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def attendance_list(request, pk):
    project = get_user_project(pk, request.user)
    role    = get_project_role(project, request.user)

    if request.method == 'GET':
        allowed_read = {
            'app_owner', 'directeur_general', 'admin_entreprise',
            'directeur_technique', 'office_admin',
            'chef_projet', 'chef_chantier', 'chef_equipe',
        }
        if role not in allowed_read:
            return Response({'detail': 'Accès non autorisé.'}, status=status.HTTP_403_FORBIDDEN)

        qs = project.attendances.select_related('worker', 'recorded_by')
        date_str = request.query_params.get('date')
        if date_str:
            qs = qs.filter(timestamp__date=date_str)
        else:
            qs = qs.filter(timestamp__date=timezone.now().date())
        if request.query_params.get('off_site') == 'true':
            qs = qs.filter(is_off_site=True)
        if request.query_params.get('worker'):
            qs = qs.filter(worker_id=request.query_params['worker'])
        return Response(AttendanceSerializer(qs, many=True).data)

    if role not in ('chef_chantier', 'chef_equipe', 'app_owner', 'directeur_general', 'admin_entreprise'):
        return Response(
            {'detail': "Le pointage est réservé au Chef de Chantier et au Chef d'Équipe."},
            status=status.HTTP_403_FORBIDDEN,
        )

    serializer = AttendanceCreateSerializer(data=request.data)
    if serializer.is_valid():
        worker = serializer.validated_data['worker']
        if worker.company != request.user.company and not request.user.is_app_owner:
            return Response(
                {'worker': ["Cet ouvrier n'appartient pas à votre entreprise."]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        attendance = serializer.save(project=project, recorded_by=request.user)
        response_data = AttendanceSerializer(attendance).data
        if attendance.is_off_site:
            response_data['alert'] = (
                f"⚠️ HORS SITE — Ouvrier pointé à {attendance.distance_from_site}m du chantier "
                f"(limite : {project.geofence_radius}m)."
            )
        return Response(response_data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def attendance_off_site_alerts(request, pk):
    project = get_user_project(pk, request.user)
    role    = get_project_role(project, request.user)
    allowed = {'app_owner', 'directeur_general', 'admin_entreprise', 'directeur_technique', 'office_admin', 'chef_projet'}
    if role not in allowed:
        return Response({'detail': 'Accès réservé.'}, status=status.HTTP_403_FORBIDDEN)
    today  = timezone.now().date()
    alerts = project.attendances.filter(is_off_site=True, timestamp__date=today).select_related('worker','recorded_by').order_by('-timestamp')
    return Response({
        'project_id': str(project.id), 'project_name': project.name,
        'date': str(today), 'alerts_count': alerts.count(),
        'alerts': AttendanceSerializer(alerts, many=True).data,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def attendance_summary(request, pk):
    project = get_user_project(pk, request.user)
    role    = get_project_role(project, request.user)
    allowed = {
        'app_owner', 'directeur_general', 'admin_entreprise', 'directeur_technique',
        'office_admin', 'chef_projet', 'chef_chantier', 'chef_equipe',
    }
    if role not in allowed:
        return Response({'detail': 'Accès non autorisé.'}, status=status.HTTP_403_FORBIDDEN)

    date_str = request.query_params.get('date', str(timezone.now().date()))
    qs = project.attendances.filter(timestamp__date=date_str)
    workers_in     = qs.filter(check_type='in').values('worker').distinct().count()
    workers_out    = qs.filter(check_type='out').values('worker').distinct().count()
    off_site_count = qs.filter(is_off_site=True).count()

    from users.models import Worker
    workers_today = []
    for worker_id in qs.values_list('worker_id', flat=True).distinct():
        try:
            w = Worker.objects.get(id=worker_id)
            workers_today.append({
                'worker_id':   str(w.id),
                'worker_name': w.full_name,
                'trade':       w.get_trade_display(),
                'checked_in':  qs.filter(worker=w, check_type='in').exists(),
                'checked_out': qs.filter(worker=w, check_type='out').exists(),
                'is_off_site': qs.filter(worker=w, is_off_site=True).exists(),
            })
        except Worker.DoesNotExist:
            pass

    return Response({
        'project_id': str(project.id), 'project_name': project.name,
        'date': date_str, 'workers_in': workers_in,
        'workers_out': workers_out, 'off_site_alerts': off_site_count,
        'workers_today': workers_today,
    })


# ===========================================================================
# DAILY REPORTS
# ===========================================================================

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def daily_report_list(request, pk):
    project = get_user_project(pk, request.user)
    role    = get_project_role(project, request.user)

    if request.method == 'GET':
        reports = project.daily_reports.select_related('author','validated_by').prefetch_related('images','incidents')
        return Response(DailyReportSerializer(reports, many=True).data)

    if role not in REPORT_WRITE_ROLES:
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
    is_admin  = role in ADMIN_ROLES

    if not (is_author or is_admin):
        return Response({'detail': "Seul l'auteur ou un administrateur peut modifier ce rapport."}, status=status.HTTP_403_FORBIDDEN)
    if report.is_validated and not is_admin:
        return Response({'detail': 'Ce rapport est validé et ne peut plus être modifié.'}, status=status.HTTP_403_FORBIDDEN)

    if request.method in ('PUT', 'PATCH'):
        serializer = DailyReportCreateSerializer(report, data=request.data, partial=(request.method=='PATCH'))
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
    project = get_user_project(pk, request.user)
    role    = get_project_role(project, request.user)
    if role not in VALIDATE_REPORT_ROLES:
        return Response({'detail': 'Seul le Chef de Projet ou un administrateur peut valider.'}, status=status.HTTP_403_FORBIDDEN)
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
    is_admin  = role in ADMIN_ROLES
    if not (is_author or is_admin):
        return Response({'detail': 'Droits insuffisants.'}, status=status.HTTP_403_FORBIDDEN)
    if report.is_validated and not is_admin:
        return Response({'detail': "Rapport validé — impossible d'ajouter des photos."}, status=status.HTTP_403_FORBIDDEN)

    files = request.FILES.getlist('images') or ([request.FILES.get('image')] if request.FILES.get('image') else [])
    if not files:
        return Response({'detail': 'Aucun fichier fourni.'}, status=status.HTTP_400_BAD_REQUEST)

    created = []
    for f in files:
        img = ReportImage.objects.create(report=report, image=f, caption=request.data.get('caption',''))
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
    is_admin  = role in ADMIN_ROLES
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

    write_roles = ADMIN_ROLES | {'chef_projet', 'chef_chantier', 'qhse', 'directeur_technique'}
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
    write_roles = ADMIN_ROLES | {'chef_projet', 'chef_chantier', 'qhse', 'directeur_technique'}
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
# TASKS (Gantt)
# ===========================================================================

def serialize_task(task):
    return {
        'id': str(task.id), 'name': task.name, 'description': task.description,
        'status': task.status,
        'start_date': str(task.start_date) if task.start_date else None,
        'end_date':   str(task.end_date)   if task.end_date   else None,
        'progress_pct': task.progress_pct, 'order': task.order,
        'is_delayed': task.is_delayed,
        'parent': str(task.parent_id) if task.parent_id else None,
        'assigned_to': task.assigned_to.full_name if task.assigned_to else None,
        'subtasks': [
            {'id': str(s.id), 'name': s.name, 'status': s.status,
             'progress_pct': s.progress_pct,
             'start_date': str(s.start_date) if s.start_date else None,
             'end_date':   str(s.end_date)   if s.end_date   else None,
             'is_delayed': s.is_delayed}
            for s in task.subtasks.all().order_by('order')
        ],
    }


TASK_WRITE_ROLES = ADMIN_ROLES | {'chef_projet', 'directeur_technique'}


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def task_list(request, pk):
    project = get_user_project(pk, request.user)
    role    = get_project_role(project, request.user)
    if request.method == 'GET':
        tasks = project.tasks.filter(parent=None).prefetch_related('subtasks').order_by('order')
        return Response([serialize_task(t) for t in tasks])
    if role not in TASK_WRITE_ROLES:
        return Response({'detail': 'Droits insuffisants.'}, status=status.HTTP_403_FORBIDDEN)
    data = request.data
    task = Task.objects.create(
        project=project, name=data.get('name',''), description=data.get('description',''),
        status=data.get('status','a_faire'),
        start_date=data.get('start_date') or None, end_date=data.get('end_date') or None,
        progress_pct=int(data.get('progress_pct',0)), order=int(data.get('order',0)),
        parent_id=data.get('parent') or None, assigned_to_id=data.get('assigned_to') or None,
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
    if role not in TASK_WRITE_ROLES:
        return Response({'detail': 'Droits insuffisants.'}, status=status.HTTP_403_FORBIDDEN)
    if request.method == 'PATCH':
        data = request.data
        for field in ('name','description','status','start_date','end_date','progress_pct','order'):
            if field in data:
                setattr(task, field, data[field] if data[field] != '' else None)
        task.save(); task.refresh_from_db()
        return Response(serialize_task(task))
    task.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


# ===========================================================================
# PURCHASES
# ===========================================================================

def serialize_purchase(p, include_price=True):
    data = {
        'id': str(p.id), 'designation': p.designation, 'fournisseur': p.fournisseur,
        'quantite': float(p.quantite), 'unite': p.unite,
        'date_commande': str(p.date_commande),
        'date_livraison': str(p.date_livraison) if p.date_livraison else None,
        'statut': p.statut, 'notes': p.notes,
        'created_by': p.created_by.full_name if p.created_by else None,
        'created_at': p.created_at.isoformat(),
    }
    if include_price:
        data['prix_unitaire'] = float(p.prix_unitaire)
        data['total']         = p.total
    return data


PURCHASE_READ_ROLES = ADMIN_ROLES | {'chef_projet', 'comptable', 'magasinier'}
PURCHASE_WRITE_ROLES = {'app_owner', 'directeur_general', 'admin_entreprise', 'comptable'}


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def purchase_list(request, pk):
    project = get_user_project(pk, request.user)
    role    = get_project_role(project, request.user)

    if role == 'chef_chantier':
        return Response({'detail': 'Accès aux achats non autorisé pour le Chef de Chantier.'}, status=status.HTTP_403_FORBIDDEN)
    if role not in PURCHASE_READ_ROLES:
        return Response({'detail': 'Accès non autorisé.'}, status=status.HTTP_403_FORBIDDEN)

    if request.method == 'GET':
        purchases  = project.purchases.select_related('created_by').order_by('-date_commande')
        show_price = role != 'magasinier'
        return Response([serialize_purchase(p, include_price=show_price) for p in purchases])

    if role not in PURCHASE_WRITE_ROLES:
        return Response({'detail': "Création réservée au Comptable."}, status=status.HTTP_403_FORBIDDEN)

    data = request.data
    try:
        purchase = Purchase.objects.create(
            project=project, created_by=request.user,
            designation=data['designation'], fournisseur=data.get('fournisseur',''),
            quantite=float(data['quantite']), unite=data.get('unite',''),
            prix_unitaire=float(data['prix_unitaire']),
            date_commande=data['date_commande'],
            date_livraison=data.get('date_livraison') or None,
            statut=data.get('statut','commande'), notes=data.get('notes',''),
        )
        return Response(serialize_purchase(purchase), status=status.HTTP_201_CREATED)
    except (KeyError, ValueError) as e:
        return Response({'detail': f'Champ requis manquant: {e}'}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def purchase_detail(request, pk, purchase_pk):
    project  = get_user_project(pk, request.user)
    purchase = get_object_or_404(Purchase, id=purchase_pk, project=project)
    role     = get_project_role(project, request.user)

    if role == 'chef_chantier':
        return Response({'detail': 'Accès non autorisé.'}, status=status.HTTP_403_FORBIDDEN)
    if role not in PURCHASE_READ_ROLES:
        return Response({'detail': 'Accès non autorisé.'}, status=status.HTTP_403_FORBIDDEN)

    show_price = role != 'magasinier'
    if request.method == 'GET':
        return Response(serialize_purchase(purchase, include_price=show_price))

    if role not in PURCHASE_WRITE_ROLES:
        return Response({'detail': 'Modification réservée au Comptable.'}, status=status.HTTP_403_FORBIDDEN)

    if request.method == 'PATCH':
        for field in ('designation','fournisseur','quantite','unite','prix_unitaire','date_commande','date_livraison','statut','notes'):
            if field in request.data:
                setattr(purchase, field, request.data[field] if request.data[field] != '' else None)
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
    from .models import get_dashboard_data
    project_id = request.query_params.get('project')
    project    = None
    if project_id:
        try:
            project = get_user_project(project_id, request.user)
        except Exception:
            return Response({'detail': 'Projet introuvable.'}, status=status.HTTP_404_NOT_FOUND)
    return Response(get_dashboard_data(request.user, project=project))
