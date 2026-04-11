"""
projects/serializers.py
BTP Manager — Multi-Tenant SaaS
================================
Added vs original:
  - AttendanceSerializer        (read — for list/detail views)
  - AttendanceCreateSerializer  (write — for GPS check-in/out POST)
  - ProjectSerializer           + gps fields, progress_pct, computed properties
  - ProjectCreateSerializer     + gps_lat, gps_lng, geofence_radius
  - ProjectListSerializer       + progress_pct, gps, is_delayed, active_workers_today
  - ProjectMemberSerializer     + added_by, user_role
"""

from rest_framework import serializers
from .models import Project, ProjectMember, DailyReport, ReportImage, Incident, Attendance


# ===========================================================================
# INCIDENT
# ===========================================================================

class IncidentSerializer(serializers.ModelSerializer):
    type_display     = serializers.CharField(source='get_type_display',     read_only=True)
    severity_display = serializers.CharField(source='get_severity_display', read_only=True)

    class Meta:
        model  = Incident
        fields = [
            'id', 'type', 'type_display', 'severity', 'severity_display',
            'description', 'impact', 'resolved', 'created_at',
        ]
        read_only_fields = ['id', 'created_at']


# ===========================================================================
# REPORT IMAGE
# ===========================================================================

class ReportImageSerializer(serializers.ModelSerializer):
    class Meta:
        model  = ReportImage
        fields = ['id', 'image', 'caption', 'uploaded_at']
        read_only_fields = ['id', 'uploaded_at']


# ===========================================================================
# DAILY REPORT
# ===========================================================================

class DailyReportSerializer(serializers.ModelSerializer):
    images            = ReportImageSerializer(many=True, read_only=True)
    incidents         = IncidentSerializer(many=True, read_only=True)
    author_name       = serializers.CharField(source='author.full_name',       read_only=True, default='')
    validated_by_name = serializers.CharField(source='validated_by.full_name', read_only=True, default='')

    class Meta:
        model  = DailyReport
        fields = [
            'id', 'project', 'report_date',
            'author', 'author_name',
            'weather', 'temperature',
            'workers_count', 'work_done', 'materials_used',
            'progress_pct',
            'is_validated', 'validated_by', 'validated_by_name', 'validated_at',
            'images', 'incidents',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'author', 'author_name',
            'is_validated', 'validated_by', 'validated_by_name', 'validated_at',
            'created_at', 'updated_at',
        ]


class DailyReportCreateSerializer(serializers.ModelSerializer):
    incidents = IncidentSerializer(many=True, required=False)

    class Meta:
        model  = DailyReport
        fields = [
            'report_date', 'weather', 'temperature',
            'workers_count', 'work_done', 'materials_used',
            'progress_pct', 'incidents',
        ]

    def validate_progress_pct(self, value):
        if value is not None and not (0 <= value <= 100):
            raise serializers.ValidationError("L'avancement doit être compris entre 0 et 100.")
        return value

    def create(self, validated_data):
        incidents_data = validated_data.pop('incidents', [])
        report = DailyReport.objects.create(**validated_data)
        for inc in incidents_data:
            Incident.objects.create(report=report, **inc)
        return report

    def update(self, instance, validated_data):
        incidents_data = validated_data.pop('incidents', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if incidents_data is not None:
            instance.incidents.all().delete()
            for inc in incidents_data:
                Incident.objects.create(report=instance, **inc)
        return instance


# ===========================================================================
# ATTENDANCE  (GPS Pointage — Anti-Fraud)
# ===========================================================================

class AttendanceSerializer(serializers.ModelSerializer):
    """
    Read serializer — returned after check-in/out and in list/summary views.
    is_off_site=True → frontend shows RED alert on Director dashboard.
    """
    worker_name        = serializers.CharField(source='worker.full_name',        read_only=True)
    worker_trade       = serializers.CharField(source='worker.get_trade_display', read_only=True)
    recorded_by_name   = serializers.CharField(source='recorded_by.full_name',   read_only=True, default='')
    check_type_display = serializers.CharField(source='get_check_type_display',  read_only=True)
    project_name       = serializers.CharField(source='project.name',            read_only=True)

    class Meta:
        model  = Attendance
        fields = [
            'id',
            'worker', 'worker_name', 'worker_trade',
            'project', 'project_name',
            'recorded_by', 'recorded_by_name',
            'check_type', 'check_type_display',
            'timestamp',
            'gps_lat', 'gps_lng',
            'distance_from_site',
            'is_off_site',          # ← RED flag on Director dashboard
            'notes',
            'created_at',
        ]
        read_only_fields = [
            'id', 'worker_name', 'worker_trade',
            'recorded_by', 'recorded_by_name',
            'project_name', 'check_type_display',
            'distance_from_site', 'is_off_site',
            'created_at',
        ]


class AttendanceCreateSerializer(serializers.ModelSerializer):
    """
    Write serializer — used by Chef de Chantier (E) / Chef d'Équipe (F)
    to record a check-in or check-out from the mobile app.

    Required: worker, check_type
    Optional: gps_lat, gps_lng (both or neither), notes, timestamp

    project and recorded_by are injected by the view.
    Geofencing is computed automatically in Attendance.save().
    """

    class Meta:
        model  = Attendance
        fields = ['worker', 'check_type', 'gps_lat', 'gps_lng', 'notes', 'timestamp']
        extra_kwargs = {
            'gps_lat':   {'required': False},
            'gps_lng':   {'required': False},
            'notes':     {'required': False},
            'timestamp': {'required': False},
        }

    def validate_check_type(self, value):
        if value not in ('in', 'out'):
            raise serializers.ValidationError("check_type doit être 'in' ou 'out'.")
        return value

    def validate(self, attrs):
        lat = attrs.get('gps_lat')
        lng = attrs.get('gps_lng')
        if (lat is None) != (lng is None):
            raise serializers.ValidationError(
                'gps_lat et gps_lng doivent être fournis ensemble.'
            )
        return attrs


# ===========================================================================
# CONTRACT SUMMARY (read-only, nested in project)
# ===========================================================================

class ContractSummarySerializer(serializers.Serializer):
    id            = serializers.UUIDField(read_only=True)
    file_name     = serializers.CharField(read_only=True)
    file_type     = serializers.CharField(read_only=True)
    file_size     = serializers.IntegerField(read_only=True)
    is_processing = serializers.BooleanField(read_only=True)
    created_at    = serializers.DateTimeField(read_only=True)
    montant_total = serializers.SerializerMethodField()

    def get_montant_total(self, obj):
        try:
            return obj.summary.get('montant_total') if obj.summary else None
        except AttributeError:
            return None


# ===========================================================================
# PROJECT MEMBER
# ===========================================================================

class ProjectMemberSerializer(serializers.ModelSerializer):
    user_name     = serializers.CharField(source='user.full_name',     read_only=True)
    user_email    = serializers.CharField(source='user.email',         read_only=True)
    user_role     = serializers.CharField(source='user.platform_role', read_only=True)
    role_display  = serializers.CharField(source='get_role_display',   read_only=True)
    added_by_name = serializers.CharField(source='added_by.full_name', read_only=True, default='')

    class Meta:
        model  = ProjectMember
        fields = [
            'id',
            'user', 'user_name', 'user_email', 'user_role',
            'role', 'role_display',
            'added_by', 'added_by_name',
            'added_at',
        ]
        read_only_fields = ['id', 'added_at', 'added_by', 'added_by_name']


# ===========================================================================
# PROJECT — full detail
# ===========================================================================

class ProjectSerializer(serializers.ModelSerializer):
    contracts            = ContractSummarySerializer(many=True, read_only=True)
    members              = ProjectMemberSerializer(many=True, read_only=True)
    contracts_count      = serializers.IntegerField(source='contracts.count', read_only=True)
    contracts_total      = serializers.FloatField(read_only=True)
    budget_remaining     = serializers.FloatField(read_only=True)
    budget_consumed_pct  = serializers.FloatField(read_only=True)
    is_over_budget       = serializers.BooleanField(read_only=True)
    is_delayed           = serializers.BooleanField(read_only=True)
    active_workers_today = serializers.IntegerField(read_only=True)
    status_display       = serializers.CharField(source='get_status_display',       read_only=True)
    project_type_display = serializers.CharField(source='get_project_type_display', read_only=True)
    company_name         = serializers.CharField(source='company.name',             read_only=True)
    created_by_name      = serializers.CharField(source='created_by.full_name',     read_only=True, default='')

    class Meta:
        model  = Project
        fields = [
            'id', 'name', 'reference',
            'project_type', 'project_type_display',
            'status', 'status_display',
            'location', 'description',
            'gps_lat', 'gps_lng', 'geofence_radius',
            'client_name', 'client_contact', 'client_email',
            'start_date', 'end_date',
            'budget', 'actual_expenses', 'progress_pct',
            'contracts_total', 'budget_remaining', 'budget_consumed_pct',
            'is_over_budget', 'is_delayed', 'active_workers_today',
            'contracts_count', 'contracts', 'members',
            'company_name', 'created_by_name',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


# ===========================================================================
# PROJECT — lightweight list
# ===========================================================================

class ProjectListSerializer(serializers.ModelSerializer):
    contracts_count      = serializers.IntegerField(source='contracts.count', read_only=True)
    contracts_total      = serializers.FloatField(read_only=True)
    budget_consumed_pct  = serializers.FloatField(read_only=True)
    is_delayed           = serializers.BooleanField(read_only=True)
    active_workers_today = serializers.IntegerField(read_only=True)
    status_display       = serializers.CharField(source='get_status_display',       read_only=True)
    project_type_display = serializers.CharField(source='get_project_type_display', read_only=True)

    class Meta:
        model  = Project
        fields = [
            'id', 'name', 'reference',
            'project_type', 'project_type_display',
            'status', 'status_display',
            'location', 'client_name',
            'gps_lat', 'gps_lng',
            'start_date', 'end_date',
            'budget', 'actual_expenses', 'progress_pct',
            'contracts_total', 'budget_consumed_pct',
            'is_delayed', 'active_workers_today',
            'contracts_count',
            'created_at',
        ]


# ===========================================================================
# PROJECT — write (create / update)
# ===========================================================================

class ProjectCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Project
        fields = [
            'name', 'reference', 'project_type', 'status',
            'location', 'description',
            'gps_lat', 'gps_lng', 'geofence_radius',
            'client_name', 'client_contact', 'client_email',
            'start_date', 'end_date',
            'budget', 'actual_expenses', 'progress_pct',
        ]

    def validate(self, attrs):
        start  = attrs.get('start_date')
        end    = attrs.get('end_date')
        budget = attrs.get('budget')

        if start and end and end < start:
            raise serializers.ValidationError(
                {'end_date': 'La date de fin doit être postérieure à la date de début.'}
            )
        if budget is not None and budget < 0:
            raise serializers.ValidationError(
                {'budget': 'Le budget ne peut pas être négatif.'}
            )
        return attrs