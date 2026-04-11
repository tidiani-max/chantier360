"""
users/views.py
BTP Manager — Multi-Tenant SaaS
================================
All views enforce:
  1. Tenant isolation  — users only see data from their own Company
  2. Role permissions  — actions are gated by platform_role
  3. Spec rules        — Office Admin (C) creates accounts D→K,
                         Admin Entreprise (B) creates C→K,
                         App Owner (A) manages companies
"""

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.conf import settings
import urllib.request
import urllib.error
import json
import secrets
import string

from .models import OTP, Company, Worker
from .serializers import (
    RegisterSerializer, LoginSerializer, UserSerializer,
    OTPVerifySerializer, ResetPasswordSerializer,
    UserListSerializer, InviteUserSerializer,
    CompanySerializer, CompanyCreateSerializer,
    WorkerSerializer, WorkerCreateSerializer,
    GoogleAuthSerializer,
)
from .email_service import send_otp_email

User = get_user_model()


# ─── Helpers ─────────────────────────────────────────────────────────────────

def get_tokens_for_user(user):
    refresh = RefreshToken.for_user(user)
    return {
        'refresh': str(refresh),
        'access':  str(refresh.access_token),
    }


def _require_role(user, *roles):
    """Returns a 403 Response if user's role is not in roles, else None."""
    if user.platform_role not in roles:
        return Response(
            {'detail': f"Accès réservé aux rôles : {', '.join(roles)}."},
            status=status.HTTP_403_FORBIDDEN
        )
    return None


def _same_company_or_403(requesting_user, target_user):
    """Ensure both users belong to the same Company."""
    if requesting_user.company != target_user.company:
        return Response({'detail': 'Accès interdit.'}, status=status.HTTP_403_FORBIDDEN)
    return None


# ===========================================================================
# AUTH ENDPOINTS
# ===========================================================================

@api_view(['POST'])
@permission_classes([AllowAny])
def register(request):
    """
    POST /api/auth/register/
    Creates a new Company (tenant) + Admin Entreprise user.
    Self-registration is always role=admin_entreprise.
    """
    serializer = RegisterSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.save()
        otp_code = OTP.generate_code()
        OTP.objects.create(user=user, code=otp_code, purpose='verify')
        send_otp_email(user.email, user.full_name, otp_code, 'verify')
        return Response({
            'message': f'Compte créé. Un code de vérification a été envoyé à {user.email}',
            'email':   user.email,
        }, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([AllowAny])
def verify_otp(request):
    """POST /api/auth/verify-otp/"""
    serializer = OTPVerifySerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    email   = serializer.validated_data['email']
    code    = serializer.validated_data['code']
    purpose = serializer.validated_data['purpose']

    try:
        user = User.objects.get(email=email)
        otp  = OTP.objects.filter(
            user=user, code=code, purpose=purpose, is_used=False
        ).order_by('-created_at').first()

        if not otp or not otp.is_valid():
            return Response({'error': 'Code invalide ou expiré'}, status=status.HTTP_400_BAD_REQUEST)

        otp.is_used = True
        otp.save()

        if purpose == 'verify':
            user.is_verified = True
            user.save()
            tokens = get_tokens_for_user(user)
            return Response({
                'message': 'Email vérifié avec succès',
                'tokens':  tokens,
                'user':    UserSerializer(user).data,
            })
        else:
            return Response({
                'message':  'Code validé. Vous pouvez maintenant réinitialiser votre mot de passe.',
                'verified': True,
            })

    except User.DoesNotExist:
        return Response({'error': 'Utilisateur non trouvé'}, status=status.HTTP_404_NOT_FOUND)


@api_view(['POST'])
@permission_classes([AllowAny])
def login(request):
    """POST /api/auth/login/"""
    serializer = LoginSerializer(data=request.data)
    if serializer.is_valid():
        user   = serializer.validated_data['user']
        tokens = get_tokens_for_user(user)
        return Response({
            'message': 'Connexion réussie',
            'tokens':  tokens,
            'user':    UserSerializer(user).data,
        })
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([AllowAny])
def forgot_password(request):
    """POST /api/auth/forgot-password/"""
    email = request.data.get('email')
    if not email:
        return Response({'error': 'Email requis'}, status=status.HTTP_400_BAD_REQUEST)
    try:
        user = User.objects.get(email=email)
        otp_code = OTP.generate_code()
        OTP.objects.create(user=user, code=otp_code, purpose='reset')
        send_otp_email(user.email, user.full_name, otp_code, 'reset')
    except User.DoesNotExist:
        pass  # Don't reveal whether email exists
    return Response({
        'message': f'Si cet email existe, un code a été envoyé à {email}',
        'email':   email,
    })


@api_view(['POST'])
@permission_classes([AllowAny])
def reset_password(request):
    """POST /api/auth/reset-password/"""
    serializer = ResetPasswordSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    email        = serializer.validated_data['email']
    code         = serializer.validated_data['code']
    new_password = serializer.validated_data['new_password']

    try:
        user = User.objects.get(email=email)
        otp  = OTP.objects.filter(
            user=user, code=code, purpose='reset', is_used=False
        ).order_by('-created_at').first()

        if not otp or not otp.is_valid():
            return Response({'error': 'Code invalide ou expiré'}, status=status.HTTP_400_BAD_REQUEST)

        otp.is_used = True
        otp.save()
        user.set_password(new_password)
        user.save()
        return Response({'message': 'Mot de passe réinitialisé avec succès'})

    except User.DoesNotExist:
        return Response({'error': 'Utilisateur non trouvé'}, status=status.HTTP_404_NOT_FOUND)


@api_view(['POST'])
@permission_classes([AllowAny])
def resend_otp(request):
    """POST /api/auth/resend-otp/"""
    email   = request.data.get('email')
    purpose = request.data.get('purpose', 'verify')
    try:
        user = User.objects.get(email=email)
        otp_code = OTP.generate_code()
        OTP.objects.create(user=user, code=otp_code, purpose=purpose)
        send_otp_email(user.email, user.full_name, otp_code, purpose)
        return Response({'message': f'Nouveau code envoyé à {email}'})
    except User.DoesNotExist:
        return Response({'error': 'Utilisateur non trouvé'}, status=status.HTTP_404_NOT_FOUND)


@api_view(['POST'])
@permission_classes([AllowAny])
def google_auth(request):
    """POST /api/auth/google/"""
    token = request.data.get('token')
    if not token:
        return Response({'error': 'Token Google requis'}, status=status.HTTP_400_BAD_REQUEST)
    try:
        url = f'https://oauth2.googleapis.com/tokeninfo?id_token={token}'
        with urllib.request.urlopen(url, timeout=10) as resp:
            idinfo = json.loads(resp.read().decode())

        email     = idinfo.get('email')
        full_name = idinfo.get('name', '')

        if not email:
            return Response({'error': 'Email non trouvé dans le token'}, status=status.HTTP_400_BAD_REQUEST)

        # Existing user — just log in
        try:
            user = User.objects.get(email=email)
            created = False
        except User.DoesNotExist:
            # New user via Google — needs company setup
            company_name = request.data.get('company_name', 'À compléter')
            company_slug = request.data.get('company_slug', email.split('@')[0])

            # Make slug unique
            base_slug = company_slug
            counter   = 1
            while Company.objects.filter(slug=company_slug).exists():
                company_slug = f"{base_slug}-{counter}"
                counter += 1

            company = Company.objects.create(
                name=company_name,
                slug=company_slug,
                subscription='trial',
            )
            user = User.objects.create(
                email=email,
                full_name=full_name,
                company=company,
                platform_role='admin_entreprise',
                auth_provider='google',
                is_verified=True,
                is_active=True,
            )
            user.set_unusable_password()
            user.save()
            created = True

        tokens = get_tokens_for_user(user)
        return Response({
            'message':      'Connexion Google réussie',
            'tokens':       tokens,
            'user':         UserSerializer(user).data,
            'is_new_user':  created,
        })

    except urllib.error.HTTPError:
        return Response({'error': 'Token Google invalide'}, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        return Response({'error': f'Erreur Google: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)


# ===========================================================================
# PROFILE
# ===========================================================================

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def profile(request):
    """GET /api/auth/profile/"""
    return Response(UserSerializer(request.user).data)


@api_view(['PUT', 'PATCH'])
@permission_classes([IsAuthenticated])
def update_profile(request):
    """PUT/PATCH /api/auth/profile/update/"""
    serializer = UserSerializer(request.user, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# ===========================================================================
# TEAM MANAGEMENT
# Spec: Office Admin (C) creates D→K, Admin Entreprise (B) creates C→K
# ===========================================================================

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_team(request):
    """
    GET /api/auth/team/
    Lists all users in the same company.
    Accessible by: admin_entreprise (B), office_admin (C).
    App owner sees all companies via /api/companies/ instead.
    """
    err = _require_role(request.user, 'app_owner', 'admin_entreprise', 'office_admin')
    if err:
        return err

    if request.user.is_app_owner:
        # App owner gets everyone — filtered by company if query param provided
        company_id = request.query_params.get('company')
        qs = User.objects.all() if not company_id else User.objects.filter(company_id=company_id)
    else:
        qs = User.objects.filter(company=request.user.company)

    qs = qs.order_by('platform_role', 'full_name')
    return Response(UserListSerializer(qs, many=True).data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def invite_user(request):
    """
    POST /api/auth/invite/
    Creates a new user account with a temporary password.

    Who can invite whom:
      - admin_entreprise (B) → can create roles C, D, E, F, G, H, I, J, K
      - office_admin (C)     → can create roles D, E, F, G, H, I, J, K only
      - app_owner (A)        → can create anyone (for support/setup)
    """
    requester = request.user

    # Gate: only these three roles can invite
    err = _require_role(requester, 'app_owner', 'admin_entreprise', 'office_admin')
    if err:
        return err

    serializer = InviteUserSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    data          = serializer.validated_data
    invited_role  = data['platform_role']

    # Role permission check — what can the requester invite?
    if requester.is_office_admin:
        allowed_roles = InviteUserSerializer.INVITABLE_BY_OFFICE_ADMIN
        if invited_role not in allowed_roles:
            return Response(
                {'platform_role': [
                    f"L'Administrateur de Bureau ne peut pas créer le rôle '{invited_role}'. "
                    f"Rôles autorisés : {', '.join(allowed_roles)}"
                ]},
                status=status.HTTP_403_FORBIDDEN
            )
    elif requester.is_admin_entreprise:
        allowed_roles = InviteUserSerializer.INVITABLE_BY_ADMIN_ENTREPRISE
        if invited_role not in allowed_roles:
            return Response(
                {'platform_role': [
                    f"Le Directeur ne peut pas créer le rôle '{invited_role}'. "
                    f"Rôles autorisés : {', '.join(allowed_roles)}"
                ]},
                status=status.HTTP_403_FORBIDDEN
            )
    # app_owner has no restrictions

    email = data['email']
    if User.objects.filter(email=email).exists():
        return Response(
            {'email': ['Un utilisateur avec cet email existe déjà.']},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Determine which company the new user belongs to
    if requester.is_app_owner:
        company_id = request.data.get('company_id')
        if not company_id:
            return Response(
                {'company_id': ["company_id requis pour l'App Owner."]},
                status=status.HTTP_400_BAD_REQUEST
            )
        try:
            company = Company.objects.get(id=company_id)
        except Company.DoesNotExist:
            return Response({'company_id': ['Entreprise non trouvée.']}, status=status.HTTP_404_NOT_FOUND)
    else:
        company = requester.company

    # Generate secure temporary password
    alphabet     = string.ascii_letters + string.digits + '!@#$'
    temp_password = ''.join(secrets.choice(alphabet) for _ in range(12))

    new_user = User.objects.create_user(
        email=email,
        password=temp_password,
        full_name=data['full_name'],
        company=company,
        platform_role=invited_role,
        fonction=data.get('fonction', ''),
        phone=data.get('phone', ''),
        is_verified=True,
        is_active=True,
    )

    try:
        send_otp_email(
            email=new_user.email,
            name=new_user.full_name,
            code=temp_password,
            purpose='invite',
        )
    except Exception:
        pass  # Don't block user creation if email fails

    return Response({
        'message':       f'Invitation envoyée à {email}',
        'user':          UserListSerializer(new_user).data,
        'temp_password': temp_password,  # Show in UI so admin can share manually
    }, status=status.HTTP_201_CREATED)


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def update_team_member(request, user_id):
    """
    PATCH /api/auth/team/<user_id>/
    Update role / status of a team member.
    Only admin_entreprise and office_admin (with restrictions).
    """
    err = _require_role(request.user, 'app_owner', 'admin_entreprise', 'office_admin')
    if err:
        return err

    try:
        member = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return Response({'detail': 'Utilisateur non trouvé.'}, status=status.HTTP_404_NOT_FOUND)

    # Tenant isolation — office_admin and admin_entreprise can only edit their own company
    if not request.user.is_app_owner:
        guard = _same_company_or_403(request.user, member)
        if guard:
            return guard

    # Office admin cannot change roles to admin_entreprise or office_admin
    new_role = request.data.get('platform_role')
    if new_role and request.user.is_office_admin:
        if new_role not in InviteUserSerializer.INVITABLE_BY_OFFICE_ADMIN:
            return Response(
                {'platform_role': ["L'Office Admin ne peut pas attribuer ce rôle."]},
                status=status.HTTP_403_FORBIDDEN
            )

    allowed_fields = {'platform_role', 'fonction', 'phone', 'is_active'}
    for field in allowed_fields:
        if field in request.data:
            setattr(member, field, request.data[field])
    member.save()

    return Response(UserListSerializer(member).data)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_team_member(request, user_id):
    """
    DELETE /api/auth/team/<user_id>/
    Soft-delete (deactivate) a team member.
    """
    err = _require_role(request.user, 'app_owner', 'admin_entreprise', 'office_admin')
    if err:
        return err

    try:
        member = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return Response({'detail': 'Utilisateur non trouvé.'}, status=status.HTTP_404_NOT_FOUND)

    if not request.user.is_app_owner:
        guard = _same_company_or_403(request.user, member)
        if guard:
            return guard

    if member == request.user:
        return Response(
            {'detail': 'Vous ne pouvez pas vous supprimer vous-même.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    member.is_active = False
    member.save()
    return Response({'message': f'{member.full_name} désactivé.'})


# ===========================================================================
# WORKER MANAGEMENT (Ouvriers — not platform users)
# Created by Office Admin (C), pointed by Chef de Chantier (E) / Chef d'Équipe (F)
# ===========================================================================

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def workers(request):
    """
    GET  /api/auth/workers/  — List all workers
    POST /api/auth/workers/  — Create a new worker (office_admin only)
    """
    # app_owner can query workers across companies or by company param
    if request.user.is_app_owner:
        if request.method == 'GET':
            company_id = request.query_params.get('company')
            if company_id:
                qs = Worker.objects.filter(company_id=company_id)
            else:
                qs = Worker.objects.all()
            is_active = request.query_params.get('is_active')
            if is_active is not None:
                qs = qs.filter(is_active=is_active.lower() == 'true')
            return Response(WorkerSerializer(qs, many=True).data)
        # app_owner POST — needs company_id
        company_id = request.data.get('company_id')
        if not company_id:
            return Response({'company_id': ['Requis pour App Owner.']}, status=status.HTTP_400_BAD_REQUEST)
        try:
            company = Company.objects.get(id=company_id)
        except Company.DoesNotExist:
            return Response({'company_id': ['Entreprise introuvable.']}, status=status.HTTP_404_NOT_FOUND)
        serializer = WorkerCreateSerializer(data=request.data)
        if serializer.is_valid():
            worker = serializer.save()
            worker.company = company
            worker.created_by = request.user
            worker.save()
            return Response(WorkerSerializer(worker).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
 
    # All non-app_owner roles need a company
    if not request.user.company:
        return Response({'detail': 'Aucune entreprise associée.'}, status=status.HTTP_400_BAD_REQUEST)
 
    if request.method == 'GET':
        err = _require_role(
            request.user,
            'admin_entreprise', 'office_admin',
            'chef_chantier', 'chef_equipe'
        )
        if err:
            return err
 
        qs = Worker.objects.filter(company=request.user.company)
        is_active = request.query_params.get('is_active')
        if is_active is not None:
            qs = qs.filter(is_active=is_active.lower() == 'true')
        trade = request.query_params.get('trade')
        if trade:
            qs = qs.filter(trade=trade)
        return Response(WorkerSerializer(qs, many=True).data)
 
    # POST — create worker
    err = _require_role(request.user, 'admin_entreprise', 'office_admin')
    if err:
        return err
 
    serializer = WorkerCreateSerializer(data=request.data)
    if serializer.is_valid():
        worker = serializer.save()
        worker.company = request.user.company
        worker.created_by = request.user
        worker.save()
        return Response(WorkerSerializer(worker).data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def worker_detail(request, worker_id):
    """
    GET    /api/auth/workers/<worker_id>/
    PATCH  /api/auth/workers/<worker_id>/
    DELETE /api/auth/workers/<worker_id>/
    """
    try:
        worker = Worker.objects.get(id=worker_id, company=request.user.company)
    except Worker.DoesNotExist:
        return Response({'detail': 'Ouvrier non trouvé.'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        return Response(WorkerSerializer(worker).data)

    if request.method == 'PATCH':
        err = _require_role(request.user, 'app_owner', 'admin_entreprise', 'office_admin')
        if err:
            return err
        serializer = WorkerCreateSerializer(worker, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(WorkerSerializer(worker).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    if request.method == 'DELETE':
        err = _require_role(request.user, 'app_owner', 'admin_entreprise', 'office_admin')
        if err:
            return err
        worker.is_active = False
        worker.save()
        return Response({'message': f'{worker.full_name} désactivé.'})


# ===========================================================================
# COMPANY MANAGEMENT (App Owner only — A)
# ===========================================================================

# ─── companies() — add user_count and project_count ─────────────────────────
@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def companies(request):
    """
    GET  /api/companies/  — List all tenant companies (app_owner only)
    POST /api/companies/  — Create a new tenant company (app_owner only)
    """
    err = _require_role(request.user, 'app_owner')
    if err:
        return err
 
    if request.method == 'GET':
        qs = Company.objects.all().order_by('name')
        data = []
        for c in qs:
            company_data = CompanySerializer(c).data
            company_data['users_count']    = c.users.count()
            company_data['projects_count'] = c.projects.count() if hasattr(c, 'projects') else 0
            data.append(company_data)
        return Response(data)
 
    serializer = CompanyCreateSerializer(data=request.data)
    if serializer.is_valid():
        company = serializer.save()
        return Response(CompanySerializer(company).data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
 
 
# ─── company_detail() — add user_count, project_count, recent users ─────────
@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated])
def company_detail(request, company_id):
    """
    GET   /api/companies/<id>/
    PATCH /api/companies/<id>/  — app_owner only
    """
    try:
        company = Company.objects.get(id=company_id)
    except Company.DoesNotExist:
        return Response({'detail': 'Entreprise non trouvée.'}, status=status.HTTP_404_NOT_FOUND)
 
    if not request.user.is_app_owner and request.user.company != company:
        return Response({'detail': 'Accès interdit.'}, status=status.HTTP_403_FORBIDDEN)
 
    if request.method == 'GET':
        data = CompanySerializer(company).data
        data['users_count']    = company.users.count()
        data['projects_count'] = company.projects.count() if hasattr(company, 'projects') else 0
        data['users'] = [
            {
                'id':               str(u.id),
                'full_name':        u.full_name,
                'email':            u.email,
                'platform_role':    u.platform_role,
                'platform_role_display': u.get_platform_role_display(),
                'is_active':        u.is_active,
            }
            for u in company.users.order_by('platform_role', 'full_name')[:20]
        ]
        return Response(data)
 
    err = _require_role(request.user, 'app_owner')
    if err:
        return err
 
    serializer = CompanyCreateSerializer(company, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return Response(CompanySerializer(company).data)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
# ===========================================================================
# DASHBOARD DATA — Role-filtered
# ===========================================================================

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dashboard_data(request):
    """
    GET /api/auth/dashboard/
    Returns role-filtered dashboard data for the authenticated user.
    Calls get_dashboard_data() from projects/models.py.
    """
    from projects.models import get_dashboard_data

    project_id = request.query_params.get('project')
    project    = None

    if project_id:
        from projects.models import Project
        try:
            # Tenant-scope the project lookup
            if request.user.is_app_owner:
                project = Project.objects.get(id=project_id)
            else:
                project = Project.objects.get(id=project_id, company=request.user.company)
        except Project.DoesNotExist:
            return Response({'detail': 'Projet non trouvé.'}, status=status.HTTP_404_NOT_FOUND)

    data = get_dashboard_data(request.user, project=project)
    return Response(data)