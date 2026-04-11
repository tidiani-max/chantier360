"""
users/serializers.py
BTP Manager — Multi-Tenant SaaS
================================
Serializers for:
  - Company (Tenant)
  - User (all 11 roles)
  - Worker (Ouvrier — not a platform user)
  - Auth flows (register, login, OTP, invite)
"""

from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth import authenticate
from .models import Company, User, Worker


# ===========================================================================
# COMPANY
# ===========================================================================

class CompanySerializer(serializers.ModelSerializer):
    """Full company details — visible to app_owner and admin_entreprise."""
    users_count    = serializers.SerializerMethodField()
    projects_count = serializers.SerializerMethodField()

    class Meta:
        model  = Company
        fields = [
            'id', 'name', 'slug', 'country', 'city', 'phone', 'email', 'logo',
            'subscription', 'subscription_end', 'is_active',
            'users_count', 'projects_count', 'created_at',
        ]
        read_only_fields = ['id', 'created_at']

    def get_users_count(self, obj):
        return obj.users.filter(is_active=True).count()

    def get_projects_count(self, obj):
        return obj.projects.count()


class CompanyCreateSerializer(serializers.ModelSerializer):
    """Used by app_owner to create a new tenant company."""
    class Meta:
        model  = Company
        fields = ['name', 'slug', 'country', 'city', 'phone', 'email', 'subscription']

    def validate_slug(self, value):
        if Company.objects.filter(slug=value).exists():
            raise serializers.ValidationError('Ce slug est déjà utilisé.')
        return value


class CompanyMiniSerializer(serializers.ModelSerializer):
    """Lightweight — embedded in UserSerializer."""
    class Meta:
        model  = Company
        fields = ['id', 'name', 'slug', 'subscription']


# ===========================================================================
# WORKER  (Ouvrier — not a platform user)
# ===========================================================================

class WorkerSerializer(serializers.ModelSerializer):
    trade_display = serializers.CharField(source='get_trade_display', read_only=True)

    class Meta:
        model  = Worker
        fields = [
            'id', 'first_name', 'last_name', 'full_name', 'phone',
            'trade', 'trade_display', 'daily_rate', 'id_number',
            'is_active', 'created_at',
        ]
        read_only_fields = ['id', 'full_name', 'created_at']


class WorkerCreateSerializer(serializers.ModelSerializer):
    """Used by Office Admin (C) to create workers."""
    class Meta:
        model  = Worker
        fields = ['first_name', 'last_name', 'phone', 'trade', 'daily_rate', 'id_number']

    def create(self, validated_data):
        # company and created_by injected in the view
        return Worker.objects.create(**validated_data)


# ===========================================================================
# USER — Auth serializers
# ===========================================================================

class RegisterSerializer(serializers.ModelSerializer):
    """
    Self-registration = creates a new Company + Admin Entreprise (B) user.
    The registering user is always admin_entreprise of their own company.
    App Owner (A) is created only via Django management commands (create_superuser).
    """
    password         = serializers.CharField(write_only=True, validators=[validate_password])
    password_confirm = serializers.CharField(write_only=True)
    company_name     = serializers.CharField(max_length=255, write_only=True)
    company_slug     = serializers.SlugField(max_length=100, write_only=True)
    company_country  = serializers.CharField(max_length=100, default='Sénégal', write_only=True)

    class Meta:
        model  = User
        fields = [
            'email', 'full_name', 'phone',
            'company_name', 'company_slug', 'company_country',
            'password', 'password_confirm',
        ]

    def validate_company_slug(self, value):
        if Company.objects.filter(slug=value).exists():
            raise serializers.ValidationError(
                "Ce slug d'entreprise est déjà pris. Choisissez-en un autre."
            )
        return value

    def validate(self, attrs):
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError({'password': 'Les mots de passe ne correspondent pas.'})
        return attrs

    def create(self, validated_data):
        validated_data.pop('password_confirm')
        company_name    = validated_data.pop('company_name')
        company_slug    = validated_data.pop('company_slug')
        company_country = validated_data.pop('company_country', 'Sénégal')

        # 1. Create the tenant company
        company = Company.objects.create(
            name=company_name,
            slug=company_slug,
            country=company_country,
            subscription='trial',
        )

        # 2. Create the director user — always admin_entreprise
        user = User.objects.create_user(
            company=company,
            platform_role='admin_entreprise',
            **validated_data,
        )
        return user


class LoginSerializer(serializers.Serializer):
    email    = serializers.EmailField()
    password = serializers.CharField()

    def validate(self, attrs):
        user = authenticate(username=attrs['email'], password=attrs['password'])
        if not user:
            raise serializers.ValidationError(
                {'non_field_errors': ['Email ou mot de passe incorrect.']}
            )
        if not user.is_verified:
            raise serializers.ValidationError(
                {'non_field_errors': ['Veuillez vérifier votre email avant de vous connecter.']}
            )
        if not user.is_active:
            raise serializers.ValidationError(
                {'non_field_errors': ['Ce compte a été désactivé. Contactez votre administrateur.']}
            )
        # Check company subscription (skip for app_owner)
        if user.company and not user.is_app_owner:
            if not user.company.is_active:
                raise serializers.ValidationError(
                    {'non_field_errors': ["L'abonnement de votre entreprise est inactif."]}
                )
        attrs['user'] = user
        return attrs


class OTPVerifySerializer(serializers.Serializer):
    email   = serializers.EmailField()
    code    = serializers.CharField(max_length=6)
    purpose = serializers.ChoiceField(choices=['verify', 'reset'], default='verify')


class ForgotPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField()


class ResetPasswordSerializer(serializers.Serializer):
    email            = serializers.EmailField()
    code             = serializers.CharField(max_length=6)
    new_password     = serializers.CharField(validators=[validate_password])
    confirm_password = serializers.CharField()

    def validate(self, attrs):
        if attrs['new_password'] != attrs['confirm_password']:
            raise serializers.ValidationError({'new_password': 'Les mots de passe ne correspondent pas.'})
        return attrs


class GoogleAuthSerializer(serializers.Serializer):
    token        = serializers.CharField()
    company_name = serializers.CharField(required=False, default='')
    company_slug = serializers.SlugField(required=False, default='')


# ===========================================================================
# USER — Profile & team serializers
# ===========================================================================

class UserSerializer(serializers.ModelSerializer):
    """
    Full user profile — returned after login and on profile requests.
    Includes permission flags so the frontend can show/hide UI elements.
    """
    platform_role_display = serializers.CharField(
        source='get_platform_role_display', read_only=True
    )
    company = CompanyMiniSerializer(read_only=True)
    permissions = serializers.SerializerMethodField()
    dashboard_type = serializers.CharField(read_only=True)

    class Meta:
        model  = User
        fields = [
            'id', 'email', 'full_name', 'phone', 'fonction', 'avatar',
            'platform_role', 'platform_role_display',
            'company',
            'is_verified', 'auth_provider',
            'permissions', 'dashboard_type',
            'created_at',
        ]
        read_only_fields = ['id', 'is_verified', 'auth_provider', 'created_at', 'dashboard_type']

    def get_permissions(self, obj):
        return {
            # Platform-level booleans
            'is_app_owner':           obj.is_app_owner,
            'is_admin_entreprise':    obj.is_admin_entreprise,
            'is_office_admin':        obj.is_office_admin,
            # Action permissions
            'can_create_users':       obj.can_create_users,
            'can_view_all_financials':obj.can_view_all_financials,
            'can_validate_contracts': obj.can_validate_contracts,
            'can_do_attendance':      obj.can_do_attendance,
            'can_write_journal':      obj.can_write_journal,
            'can_manage_qhse':        obj.can_manage_qhse,
            'can_manage_stock':       obj.can_manage_stock,
            'can_manage_documents':   obj.can_manage_documents,
            'is_read_only':           obj.is_read_only,
        }


class UserListSerializer(serializers.ModelSerializer):
    """Lightweight — for listing team members."""
    platform_role_display = serializers.CharField(
        source='get_platform_role_display', read_only=True
    )

    class Meta:
        model  = User
        fields = [
            'id', 'full_name', 'email', 'phone', 'fonction',
            'platform_role', 'platform_role_display',
            'avatar', 'is_active',
        ]


class InviteUserSerializer(serializers.Serializer):
    """
    Used by Office Admin (C) — and Admin Entreprise (B) — to invite team members.

    Roles that can be invited via this endpoint: D → K only.
    Office Admin cannot invite another admin_entreprise.
    Admin Entreprise can also invite office_admin.

    Validated in the view based on the requester's role.
    """
    # Roles available to Office Admin (C) — D→K
    INVITABLE_BY_OFFICE_ADMIN = [
        'chef_projet', 'chef_chantier', 'chef_equipe',
        'ingenieur', 'qhse', 'magasinier', 'comptable', 'client',
    ]
    # Roles available to Admin Entreprise (B) — C→K
    INVITABLE_BY_ADMIN_ENTREPRISE = [
        'office_admin',
        'chef_projet', 'chef_chantier', 'chef_equipe',
        'ingenieur', 'qhse', 'magasinier', 'comptable', 'client',
    ]

    email         = serializers.EmailField()
    full_name     = serializers.CharField()
    platform_role = serializers.ChoiceField(choices=[r[0] for r in User.PLATFORM_ROLE_CHOICES])
    fonction      = serializers.CharField(required=False, default='')
    phone         = serializers.CharField(required=False, default='')