"""
users/models.py
BTP Manager — Multi-Tenant SaaS
================================
Tenant isolation is built around the `Company` model.
Every User belongs to exactly one Company.
Projects and Contracts will FK to Company, NOT to User.

Role hierarchy (matches spec A → K exactly):
  Platform-level  : app_owner, admin_entreprise, office_admin
  Project-level   : chef_projet, chef_chantier, chef_equipe,
                    ingenieur, qhse, magasinier, comptable, client
"""

from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin, BaseUserManager
from django.db import models
from django.utils import timezone
from datetime import timedelta
import random
import uuid


# ===========================================================================
# COMPANY  (Tenant — the core of multi-tenancy)
# ===========================================================================

class Company(models.Model):
    """
    One Company = one isolated tenant.
    All users, projects and contracts belong to a Company.
    The App Owner (super admin of the SaaS platform) is the only user
    who can see across companies.
    """
    SUBSCRIPTION_CHOICES = [
        ('trial',       'Essai gratuit'),
        ('starter',     'Starter'),
        ('pro',         'Pro'),
        ('enterprise',  'Enterprise'),
    ]

    id               = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name             = models.CharField(max_length=255, unique=True, verbose_name='Raison sociale')
    slug             = models.SlugField(max_length=100, unique=True)
    country          = models.CharField(max_length=100, default='Sénégal')
    city             = models.CharField(max_length=100, blank=True)
    phone            = models.CharField(max_length=30, blank=True)
    email            = models.EmailField(blank=True)
    logo             = models.URLField(blank=True, null=True)

    # SaaS subscription
    subscription     = models.CharField(
        max_length=20, choices=SUBSCRIPTION_CHOICES, default='trial'
    )
    subscription_end = models.DateField(null=True, blank=True)
    is_active        = models.BooleanField(default=True)

    created_at       = models.DateTimeField(auto_now_add=True)
    updated_at       = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name        = 'Entreprise'
        verbose_name_plural = 'Entreprises'
        ordering            = ['name']

    def __str__(self):
        return self.name

    @property
    def is_subscription_valid(self):
        if self.subscription == 'trial':
            # Trial expires 30 days after creation
            return (timezone.now().date() - self.created_at.date()).days <= 30
        if self.subscription_end:
            return self.subscription_end >= timezone.now().date()
        return True


# ===========================================================================
# USER MANAGER
# ===========================================================================

class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('Email obligatoire')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        """Creates the SaaS platform owner (App Owner). No company required."""
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('is_verified', True)
        extra_fields.setdefault('platform_role', 'app_owner')
        return self.create_user(email, password, **extra_fields)


# ===========================================================================
# USER
# ===========================================================================

class User(AbstractBaseUser, PermissionsMixin):
    """
    Platform roles map exactly to spec sections A → K.

    ┌─────────────────────┬──────────────────────────────────────────────┐
    │ platform_role       │ Spec section                                 │
    ├─────────────────────┼──────────────────────────────────────────────┤
    │ app_owner           │ A — Super Admin of the SaaS platform         │
    │ admin_entreprise    │ B — Directeur / Patron                       │
    │ office_admin        │ C — Administrateur de Bureau / RH            │
    │ chef_projet         │ D — Chef de Projet / Conducteur de Travaux   │
    │ chef_chantier       │ E — Chef de Chantier (Field Manager)         │
    │ chef_equipe         │ F — Chef d'Équipe                            │
    │ ingenieur           │ G — Ingénieur / Bureau d'Études              │
    │ qhse                │ H — Responsable QHSE                         │
    │ magasinier          │ I — Magasinier / Stock Manager               │
    │ comptable           │ J — Comptable / Financier                    │
    │ client              │ K — Client / Maître d'Ouvrage (read-only)    │
    └─────────────────────┴──────────────────────────────────────────────┘
    """

    PLATFORM_ROLE_CHOICES = [
        # ── Platform level ────────────────────────────────────────────────
        ('app_owner',         'App Owner (Super Admin Plateforme)'),   # A
        ('admin_entreprise',  'Administrateur Entreprise (Directeur)'), # B
        ('office_admin',      'Administrateur de Bureau'),              # C
        # ── Operational / Project level ───────────────────────────────────
        ('chef_projet',       'Chef de Projet'),                        # D
        ('chef_chantier',     'Chef de Chantier'),                      # E
        ('chef_equipe',       "Chef d'Équipe"),                         # F
        ('ingenieur',         "Ingénieur / Bureau d'Études"),           # G
        ('qhse',              'Responsable QHSE'),                      # H
        ('magasinier',        'Magasinier / Stock Manager'),            # I
        ('comptable',         'Comptable / Financier'),                  # J
        ('client',            "Client / Maître d'Ouvrage"),             # K
    ]

    id            = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email         = models.EmailField(unique=True)
    full_name     = models.CharField(max_length=255)
    phone         = models.CharField(max_length=30, blank=True)
    fonction      = models.CharField(max_length=100, blank=True, verbose_name='Fonction / Poste')
    avatar        = models.URLField(blank=True, null=True)

    # ── Tenant FK — null only for app_owner ──────────────────────────────
    company       = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        null=True,          # null only for app_owner (no company)
        blank=True,
        related_name='users',
        verbose_name='Entreprise',
    )

    platform_role = models.CharField(
        max_length=20,
        choices=PLATFORM_ROLE_CHOICES,
        default='chef_chantier',
        verbose_name='Rôle sur la plateforme',
    )

    is_active     = models.BooleanField(default=True)
    is_staff      = models.BooleanField(default=False)
    is_verified   = models.BooleanField(default=False)
    auth_provider = models.CharField(
        max_length=20,
        choices=[('email', 'Email'), ('google', 'Google')],
        default='email',
    )
    created_at    = models.DateTimeField(auto_now_add=True)
    updated_at    = models.DateTimeField(auto_now=True)

    USERNAME_FIELD  = 'email'
    REQUIRED_FIELDS = ['full_name']

    objects = UserManager()

    class Meta:
        verbose_name        = 'Utilisateur'
        verbose_name_plural = 'Utilisateurs'

    def __str__(self):
        return f"{self.full_name} ({self.get_platform_role_display()})"

    # ── Role boolean helpers ──────────────────────────────────────────────

    @property
    def is_app_owner(self):
        """SaaS platform super admin — sees everything, manages tenants."""
        return self.platform_role == 'app_owner'

    @property
    def is_admin_entreprise(self):
        """Directeur — sees all projects of his company, validates contracts."""
        return self.platform_role == 'admin_entreprise'

    @property
    def is_office_admin(self):
        """
        RH pivot — creates all user accounts (D→K) and assigns them to projects.
        Per spec: 'C'est le seul qui peut créer des comptes'.
        """
        return self.platform_role == 'office_admin'

    @property
    def is_chef_projet(self):
        return self.platform_role == 'chef_projet'

    @property
    def is_chef_chantier(self):
        return self.platform_role == 'chef_chantier'

    @property
    def is_chef_equipe(self):
        return self.platform_role == 'chef_equipe'

    @property
    def is_ingenieur(self):
        return self.platform_role == 'ingenieur'

    @property
    def is_qhse(self):
        return self.platform_role == 'qhse'

    @property
    def is_magasinier(self):
        return self.platform_role == 'magasinier'

    @property
    def is_comptable(self):
        return self.platform_role == 'comptable'

    @property
    def is_client(self):
        return self.platform_role == 'client'

    # ── Permission helpers (cross-project, platform-level) ───────────────

    @property
    def can_create_users(self):
        """
        Spec: Office Admin (C) is the sole creator of accounts D→K.
        Admin Entreprise (B) can also create office_admins.
        App Owner can do everything.
        """
        return self.platform_role in ('app_owner', 'admin_entreprise', 'office_admin')

    @property
    def can_view_all_financials(self):
        """
        Only Directeur and Comptable see full financial data.
        Chef de Chantier is EXPLICITLY blocked (spec: 'N'a PAS accès aux marges').
        """
        return self.platform_role in ('app_owner', 'admin_entreprise', 'comptable')

    @property
    def can_validate_contracts(self):
        """Spec: 'Le seul à pouvoir valider le Résumé de Contrat généré par l'IA'."""
        return self.platform_role in ('app_owner', 'admin_entreprise')

    @property
    def can_do_attendance(self):
        """GPS pointage — Chef de Chantier (E) and Chef d'Équipe (F)."""
        return self.platform_role in ('app_owner', 'chef_chantier', 'chef_equipe')

    @property
    def can_write_journal(self):
        """Daily site journal — Chef de Chantier and Chef de Projet."""
        return self.platform_role in ('app_owner', 'chef_projet', 'chef_chantier')

    @property
    def can_manage_qhse(self):
        return self.platform_role in ('app_owner', 'qhse', 'chef_chantier')

    @property
    def can_manage_stock(self):
        return self.platform_role in ('app_owner', 'magasinier', 'chef_chantier')

    @property
    def can_manage_documents(self):
        """Plans/DWG versioning — Ingénieur."""
        return self.platform_role in ('app_owner', 'ingenieur', 'chef_projet')

    @property
    def is_read_only(self):
        """Client (K) has zero write access anywhere."""
        return self.platform_role == 'client'

    @property
    def dashboard_type(self):
        """
        Returns which dashboard this user should land on.
        Used by the frontend router.
        """
        _map = {
            'app_owner':        'infrastructure',   # A — tenant management
            'admin_entreprise': 'strategic',        # B — financial/global view
            'office_admin':     'resources',        # C — HR/personnel
            'chef_projet':      'gantt_budget',     # D — planning & budget
            'chef_chantier':    'field_action',     # E — mobile attendance
            'chef_equipe':      'attendance_simple',# F — simplified attendance
            'ingenieur':        'documents',        # G — plans & documents
            'qhse':             'safety',           # H — incidents & checklists
            'magasinier':       'stock',            # I — deliveries & stock
            'comptable':        'treasury',         # J — invoices & cash
            'client':           'progress',         # K — read-only progress
        }
        return _map.get(self.platform_role, 'field_action')


# ===========================================================================
# WORKER (Ouvrier)
# ===========================================================================

class Worker(models.Model):
    """
    Ouvriers are NOT platform users — they don't log in.
    They are created by the Office Admin and pointed by Chef de Chantier/Équipe.
    """
    TRADE_CHOICES = [
        ('maconnerie',    'Maçonnerie'),
        ('ferraillage',   'Ferraillage'),
        ('coffrage',      'Coffrage'),
        ('carrelage',     'Carrelage'),
        ('peinture',      'Peinture'),
        ('plomberie',     'Plomberie'),
        ('electricite',   'Électricité'),
        ('menuiserie',    'Menuiserie'),
        ('manoeuvre',     'Manœuvre'),
        ('conducteur',    'Conducteur d\'engin'),
        ('autre',         'Autre'),
    ]

    id           = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company      = models.ForeignKey(
        Company, on_delete=models.CASCADE, related_name='workers'
    )
    first_name   = models.CharField(max_length=100)
    last_name    = models.CharField(max_length=100)
    phone        = models.CharField(max_length=30, blank=True)
    trade        = models.CharField(max_length=20, choices=TRADE_CHOICES, default='manoeuvre')
    daily_rate   = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True,
        verbose_name='Taux journalier (FCFA)'
    )
    id_number    = models.CharField(max_length=50, blank=True, verbose_name="N° CNI / Pièce d'identité")
    is_active    = models.BooleanField(default=True)
    created_by   = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, related_name='workers_created'
    )
    created_at   = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name        = 'Ouvrier'
        verbose_name_plural = 'Ouvriers'
        ordering            = ['last_name', 'first_name']

    def __str__(self):
        return f"{self.first_name} {self.last_name} ({self.get_trade_display()})"

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}"


# ===========================================================================
# OTP
# ===========================================================================

class OTP(models.Model):
    PURPOSE_CHOICES = [
        ('verify', 'Vérification email'),
        ('reset',  'Réinitialisation mot de passe'),
        ('invite', 'Invitation membre'),
    ]
    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user       = models.ForeignKey(User, on_delete=models.CASCADE, related_name='otps')
    code       = models.CharField(max_length=6)
    purpose    = models.CharField(max_length=20, choices=PURPOSE_CHOICES)
    is_used    = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()

    class Meta:
        verbose_name = 'OTP'

    def __str__(self):
        return f"OTP {self.code} pour {self.user.email} ({self.purpose})"

    @staticmethod
    def generate_code():
        return str(random.randint(100000, 999999))

    def is_valid(self):
        return not self.is_used and timezone.now() < self.expires_at

    def save(self, *args, **kwargs):
        if not self.expires_at:
            self.expires_at = timezone.now() + timedelta(minutes=15)
        super().save(*args, **kwargs)