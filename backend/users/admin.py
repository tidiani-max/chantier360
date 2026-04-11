"""
users/admin.py
BTP Manager — Multi-Tenant SaaS
================================
Admin for: Company, User (all 11 roles), Worker, OTP
"""

from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.utils.html import format_html
from .models import Company, User, Worker, OTP


# ===========================================================================
# COMPANY (Tenant)
# ===========================================================================

@admin.register(Company)
class CompanyAdmin(admin.ModelAdmin):
    list_display  = ['name', 'slug', 'country', 'subscription', 'is_active',
                     'users_count', 'created_at']
    list_filter   = ['subscription', 'is_active', 'country']
    search_fields = ['name', 'slug', 'email']
    ordering      = ['name']
    readonly_fields = ['id', 'created_at', 'updated_at']

    fieldsets = (
        ('Identité',      {'fields': ('id', 'name', 'slug', 'country', 'city', 'logo')}),
        ('Contact',       {'fields': ('phone', 'email')}),
        ('Abonnement',    {'fields': ('subscription', 'subscription_end', 'is_active')}),
        ('Métadonnées',   {'fields': ('created_at', 'updated_at')}),
    )

    def users_count(self, obj):
        count = obj.users.filter(is_active=True).count()
        return format_html('<b>{}</b>', count)
    users_count.short_description = 'Utilisateurs actifs'


# ===========================================================================
# USER
# ===========================================================================

@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display  = [
        'email', 'full_name', 'company_link',
        'role_badge', 'is_verified', 'is_active', 'auth_provider', 'created_at',
    ]
    list_filter   = [
        'platform_role', 'is_verified', 'is_active',
        'auth_provider', 'is_staff', 'company__subscription',
    ]
    search_fields = ['email', 'full_name', 'company__name', 'phone']
    ordering      = ['-created_at']
    readonly_fields = ['id', 'created_at', 'updated_at', 'dashboard_type']

    fieldsets = (
        (None, {
            'fields': ('email', 'password')
        }),
        ('Informations personnelles', {
            'fields': ('full_name', 'phone', 'fonction', 'avatar')
        }),
        ('Entreprise & Rôle', {
            'fields': ('company', 'platform_role', 'dashboard_type')
        }),
        ('Permissions plateforme', {
            'fields': ('is_active', 'is_staff', 'is_superuser', 'is_verified', 'auth_provider')
        }),
        ('Métadonnées', {
            'fields': ('id', 'created_at', 'updated_at'),
            'classes': ('collapse',),
        }),
    )

    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': (
                'email', 'full_name', 'phone',
                'company', 'platform_role',
                'password1', 'password2',
            ),
        }),
    )

    # ── Custom display columns ────────────────────────────────────────────

    def company_link(self, obj):
        if obj.company:
            return format_html(
                '<a href="/admin/users/company/{}/change/">{}</a>',
                obj.company.id, obj.company.name
            )
        return format_html('<span style="color:#999">—</span>')
    company_link.short_description = 'Entreprise'

    def role_badge(self, obj):
        colors = {
            'app_owner':        '#1a1a2e',
            'admin_entreprise': '#16213e',
            'office_admin':     '#0f3460',
            'chef_projet':      '#533483',
            'chef_chantier':    '#e94560',
            'chef_equipe':      '#f5a623',
            'ingenieur':        '#2196f3',
            'qhse':             '#ff5722',
            'magasinier':       '#4caf50',
            'comptable':        '#009688',
            'client':           '#9e9e9e',
        }
        color = colors.get(obj.platform_role, '#999')
        return format_html(
            '<span style="background:{};color:#fff;padding:2px 8px;'
            'border-radius:4px;font-size:11px;font-weight:600">{}</span>',
            color, obj.get_platform_role_display()
        )
    role_badge.short_description = 'Rôle'


# ===========================================================================
# WORKER (Ouvrier)
# ===========================================================================

@admin.register(Worker)
class WorkerAdmin(admin.ModelAdmin):
    list_display  = [
        'full_name', 'company', 'trade_display',
        'phone', 'daily_rate', 'is_active', 'created_at',
    ]
    list_filter   = ['trade', 'is_active', 'company']
    search_fields = ['first_name', 'last_name', 'phone', 'id_number', 'company__name']
    ordering      = ['last_name', 'first_name']
    readonly_fields = ['id', 'created_at', 'created_by']

    fieldsets = (
        ('Identité',     {'fields': ('id', 'first_name', 'last_name', 'phone', 'id_number')}),
        ('Métier',       {'fields': ('trade', 'daily_rate')}),
        ('Entreprise',   {'fields': ('company', 'is_active')}),
        ('Audit',        {'fields': ('created_by', 'created_at'), 'classes': ('collapse',)}),
    )

    def trade_display(self, obj):
        return obj.get_trade_display()
    trade_display.short_description = 'Corps de métier'


# ===========================================================================
# OTP
# ===========================================================================

@admin.register(OTP)
class OTPAdmin(admin.ModelAdmin):
    list_display  = ['user', 'code', 'purpose', 'is_used', 'is_valid_display', 'created_at', 'expires_at']
    list_filter   = ['purpose', 'is_used']
    search_fields = ['user__email', 'code']
    ordering      = ['-created_at']
    readonly_fields = ['id', 'created_at']

    def is_valid_display(self, obj):
        valid = obj.is_valid()
        color = '#4caf50' if valid else '#f44336'
        label = 'Valide' if valid else 'Expiré'
        return format_html(
            '<span style="color:{};font-weight:600">{}</span>', color, label
        )
    is_valid_display.short_description = 'Statut'