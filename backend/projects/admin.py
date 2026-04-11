from django.contrib import admin
from .models import Project, ProjectMember, DailyReport, ReportImage, Incident


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display   = ['name', 'reference', 'status', 'project_type', 'company', 'created_at']
    list_filter    = ['status', 'project_type']
    search_fields  = ['name', 'reference', 'location']
    raw_id_fields  = ['company']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(ProjectMember)
class ProjectMemberAdmin(admin.ModelAdmin):
    list_display  = ['user', 'project', 'role', 'added_at']
    list_filter   = ['role']
    raw_id_fields = ['user', 'project']


class IncidentInline(admin.TabularInline):
    model  = Incident
    extra  = 0
    fields = ['type', 'severity', 'description', 'resolved']


class ReportImageInline(admin.TabularInline):
    model           = ReportImage
    extra           = 0
    fields          = ['image', 'caption', 'uploaded_at']
    readonly_fields = ['uploaded_at']


@admin.register(DailyReport)
class DailyReportAdmin(admin.ModelAdmin):
    list_display   = ['report_date', 'project', 'author', 'workers_count', 'progress_pct', 'is_validated']
    list_filter    = ['is_validated', 'weather']
    search_fields  = ['project__name', 'author__full_name']
    raw_id_fields  = ['project', 'author', 'validated_by']
    inlines        = [ReportImageInline, IncidentInline]
    date_hierarchy = 'report_date'
    readonly_fields = ['created_at', 'updated_at', 'validated_at']


@admin.register(Incident)
class IncidentAdmin(admin.ModelAdmin):
    list_display = ['report', 'type', 'severity', 'resolved', 'created_at']
    list_filter  = ['type', 'severity', 'resolved']