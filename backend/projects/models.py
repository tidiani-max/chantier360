"""
projects/models.py
BTP Manager — Multi-Tenant SaaS
================================
Key changes from original:
  - Project.company  → FK to Company (not User) — fixes tenant isolation
  - ProjectMember.role → all 11 spec roles (A→K), minus app_owner
  - Attendance model added (GPS geofencing anti-fraud logic)
  - Worker FK added to Attendance (ouvriers are not platform users)
  - get_dashboard_data() utility at bottom of file
"""

from django.db import models
from django.core.validators import MinValueValidator
from django.utils import timezone
import uuid
import math


# ===========================================================================
# PROJECT
# ===========================================================================

class Project(models.Model):
    STATUS_CHOICES = [
        ('planifie',  'Planifié'),
        ('en_cours',  'En cours'),
        ('suspendu',  'Suspendu'),
        ('termine',   'Terminé'),
    ]
    TYPE_CHOICES = [
        ('batiment',       'Bâtiment'),
        ('route',          'Route/VRD'),
        ('aep',            "Adduction d'eau potable (AEP)"),
        ('assainissement', 'Assainissement'),
        ('pont',           'Pont'),
        ('hydraulique',    'Hydraulique'),
        ('electricite',    'Électricité'),
        ('autre',          'Autre'),
    ]

    id           = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # ── Tenant isolation — FK to Company, NOT User ────────────────────────
    company      = models.ForeignKey(
        'users.Company',
        on_delete=models.CASCADE,
        related_name='projects',
        verbose_name='Entreprise',
    )

    # The user who created/manages this project (admin_entreprise or office_admin)
    created_by   = models.ForeignKey(
        'users.User',
        on_delete=models.SET_NULL,
        null=True,
        related_name='projects_created',
        verbose_name='Créé par',
    )

    name            = models.CharField(max_length=255)
    reference       = models.CharField(max_length=100, blank=True)
    project_type    = models.CharField(max_length=20, choices=TYPE_CHOICES, default='batiment')
    status          = models.CharField(max_length=20, choices=STATUS_CHOICES, default='planifie')
    location        = models.CharField(max_length=255, blank=True)

    # GPS coordinates — used for geofencing attendance validation
    gps_lat         = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    gps_lng         = models.DecimalField(max_digits=10, decimal_places=7, null=True, blank=True)
    geofence_radius = models.PositiveIntegerField(
        default=200,
        verbose_name='Rayon de géofencing (mètres)',
        help_text='Alerter si pointage > N mètres du site. Défaut: 200m.'
    )

    description     = models.TextField(blank=True)
    client_name     = models.CharField(max_length=255, blank=True, verbose_name="Maître d'ouvrage")
    client_contact  = models.CharField(max_length=255, blank=True)
    client_email    = models.EmailField(blank=True)
    start_date      = models.DateField(null=True, blank=True)
    end_date        = models.DateField(null=True, blank=True)
    budget          = models.DecimalField(
        max_digits=15, decimal_places=2,
        null=True, blank=True,
        validators=[MinValueValidator(0)],
        verbose_name='Budget prévisionnel (FCFA)',
    )
    actual_expenses = models.DecimalField(
        max_digits=15, decimal_places=2,
        default=0,
        validators=[MinValueValidator(0)],
        verbose_name='Dépenses réelles (FCFA)',
    )
    progress_pct    = models.PositiveSmallIntegerField(default=0, verbose_name='Avancement global (%)')
    created_at      = models.DateTimeField(auto_now_add=True)
    updated_at      = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name        = 'Projet'
        verbose_name_plural = 'Projets'
        ordering            = ['-created_at']

    def __str__(self):
        return f"{self.reference} – {self.name}" if self.reference else self.name

    # ── Computed properties ───────────────────────────────────────────────

    @property
    def contracts_total(self):
        total = 0
        for c in self.contracts.exclude(summary=None):
            try:
                total += float(c.summary.get('montant_total') or 0)
            except (AttributeError, TypeError, ValueError):
                pass
        return round(total, 2)

    @property
    def budget_consumed_pct(self):
        if not self.budget:
            return None
        return round(float(self.actual_expenses) / float(self.budget) * 100, 1)

    @property
    def budget_remaining(self):
        if self.budget is None:
            return None
        return round(float(self.budget) - float(self.actual_expenses), 2)

    @property
    def is_over_budget(self):
        pct = self.budget_consumed_pct
        return pct is not None and pct > 100

    @property
    def is_delayed(self):
        if self.end_date and self.status not in ('termine',):
            return self.end_date < timezone.now().date()
        return False

    @property
    def active_workers_today(self):
        """Count of workers checked in today (used by Director dashboard)."""
        today = timezone.now().date()
        return self.attendances.filter(
            timestamp__date=today,
            check_type='in'
        ).values('worker').distinct().count()


# ===========================================================================
# PROJECT MEMBER  (role per project — operational roles D→K)
# ===========================================================================

class ProjectMember(models.Model):
    """
    Assigns a User to a Project with a specific operational role.

    IMPORTANT:
    - app_owner (A) sees all by platform privilege, not via ProjectMember.
    - admin_entreprise (B) sees all projects of his Company, not via ProjectMember.
    - office_admin (C) manages assignments but may also be a member.
    - Roles D→K are assigned here per project.

    Permission matrix (read/edit/full/none) for each module:
    ┌───────────────────┬────────┬────────┬──────────┬─────────┬────────┬──────┬────────────┬─────────┬──────────┬──────┐
    │ Role              │ config │ budget │ planning │ journal │ pointage│ qhse │ documents  │ stock   │ treasury │users │
    ├───────────────────┼────────┼────────┼──────────┼─────────┼────────┼──────┼────────────┼─────────┼──────────┼──────┤
    │ chef_projet    D  │ full   │ read   │ full     │ read    │ read   │ read │ full       │ read    │ read     │ edit │
    │ chef_chantier  E  │ none   │ none   │ none     │ edit    │ full   │ edit │ none       │ none    │ none     │ none │
    │ chef_equipe    F  │ none   │ none   │ none     │ none    │ full   │ none │ none       │ none    │ none     │ none │
    │ ingenieur      G  │ none   │ none   │ read     │ none    │ none   │ none │ full       │ none    │ none     │ none │
    │ qhse           H  │ none   │ none   │ none     │ read    │ none   │ full │ none       │ none    │ read     │ none │
    │ magasinier     I  │ none   │ read   │ none     │ none    │ none   │ none │ none       │ full    │ none     │ none │
    │ comptable      J  │ none   │ full   │ none     │ none    │ none   │ none │ none       │ read    │ full     │ none │
    │ client         K  │ none   │ none   │ read     │ none    │ none   │ none │ none       │ none    │ none     │ none │
    └───────────────────┴────────┴────────┴──────────┴─────────┴────────┴──────┴────────────┴─────────┴──────────┴──────┘
    """

    ROLE_CHOICES = [
        ('chef_projet',   'Chef de Projet'),          # D
        ('chef_chantier', 'Chef de Chantier'),         # E
        ('chef_equipe',   "Chef d'Équipe"),            # F
        ('ingenieur',     "Ingénieur / Bureau d'Études"), # G
        ('qhse',          'Responsable QHSE'),         # H
        ('magasinier',    'Magasinier'),               # I
        ('comptable',     'Comptable / Financier'),    # J
        ('client',        "Client / Maître d'Ouvrage"), # K
    ]

    # Full permission matrix — keyed by role → module → access level
    ROLE_PERMISSIONS = {
        'chef_projet':   {
            'config': 'full',  'budget': 'read',  'planning': 'full',
            'journal': 'read', 'pointage': 'read', 'qhse': 'read',
            'documents': 'full','stock': 'read',  'treasury': 'read', 'users': 'edit',
        },
        'chef_chantier': {
            'config': 'none',  'budget': 'none',  'planning': 'none',
            'journal': 'edit', 'pointage': 'full', 'qhse': 'edit',
            'documents': 'none','stock': 'none',  'treasury': 'none', 'users': 'none',
        },
        'chef_equipe':   {
            'config': 'none',  'budget': 'none',  'planning': 'none',
            'journal': 'none', 'pointage': 'full', 'qhse': 'none',
            'documents': 'none','stock': 'none',  'treasury': 'none', 'users': 'none',
        },
        'ingenieur':     {
            'config': 'none',  'budget': 'none',  'planning': 'read',
            'journal': 'none', 'pointage': 'none', 'qhse': 'none',
            'documents': 'full','stock': 'none',  'treasury': 'none', 'users': 'none',
        },
        'qhse':          {
            'config': 'none',  'budget': 'none',  'planning': 'none',
            'journal': 'read', 'pointage': 'none', 'qhse': 'full',
            'documents': 'none','stock': 'none',  'treasury': 'read', 'users': 'none',
        },
        'magasinier':    {
            'config': 'none',  'budget': 'read',  'planning': 'none',
            'journal': 'none', 'pointage': 'none', 'qhse': 'none',
            'documents': 'none','stock': 'full',  'treasury': 'none', 'users': 'none',
        },
        'comptable':     {
            'config': 'none',  'budget': 'full',  'planning': 'none',
            'journal': 'none', 'pointage': 'none', 'qhse': 'none',
            'documents': 'none','stock': 'read',  'treasury': 'full', 'users': 'none',
        },
        'client':        {
            'config': 'none',  'budget': 'none',  'planning': 'read',
            'journal': 'none', 'pointage': 'none', 'qhse': 'none',
            'documents': 'none','stock': 'none',  'treasury': 'none', 'users': 'none',
        },
    }

    id       = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project  = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='members')
    user     = models.ForeignKey('users.User', on_delete=models.CASCADE, related_name='project_memberships')
    role     = models.CharField(max_length=20, choices=ROLE_CHOICES, default='chef_chantier')
    added_at = models.DateTimeField(auto_now_add=True)
    added_by = models.ForeignKey(
        'users.User', on_delete=models.SET_NULL, null=True,
        related_name='members_added', verbose_name='Ajouté par'
    )

    class Meta:
        unique_together = [('project', 'user')]
        verbose_name    = 'Membre du projet'

    def __str__(self):
        return f"{self.user.full_name} — {self.project.name} ({self.get_role_display()})"

    def get_permissions(self):
        return self.ROLE_PERMISSIONS.get(self.role, {})

    def can(self, module: str) -> bool:
        """True if role has at least 'read' access to the module."""
        return self.get_permissions().get(module, 'none') != 'none'

    def can_write(self, module: str) -> bool:
        """True if role has 'edit' or 'full' access to the module."""
        return self.get_permissions().get(module, 'none') in ('edit', 'full')

    def can_full(self, module: str) -> bool:
        """True if role has 'full' access to the module."""
        return self.get_permissions().get(module, 'none') == 'full'


# ===========================================================================
# ATTENDANCE  (Pointage GPS — Anti-Fraud)
# ===========================================================================

class Attendance(models.Model):
    """
    GPS attendance record for a Worker on a Project.

    Geofencing logic:
      - At check-in/out time, the mobile app sends GPS coordinates.
      - Backend calculates distance from project.gps_lat/gps_lng.
      - If distance > project.geofence_radius (default 200m):
          → is_off_site = True
          → Director dashboard shows RED alert 'Hors Site'
      - The record is ALWAYS saved (even if off-site) — we never block,
        we only flag. This is intentional per spec.

    Recorded by: Chef de Chantier (E) or Chef d'Équipe (F).
    """

    CHECK_TYPE_CHOICES = [
        ('in',  'Entrée (Matin)'),
        ('out', 'Sortie (Soir)'),
    ]

    id           = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Who is being pointed — a Worker (not a platform User)
    worker       = models.ForeignKey(
        'users.Worker',
        on_delete=models.CASCADE,
        related_name='attendances',
        verbose_name='Ouvrier',
    )

    # Which project / site
    project      = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name='attendances',
        verbose_name='Projet / Chantier',
    )

    # Who recorded this attendance (Chef de Chantier or Chef d'Équipe)
    recorded_by  = models.ForeignKey(
        'users.User',
        on_delete=models.SET_NULL,
        null=True,
        related_name='attendances_recorded',
        verbose_name='Pointé par',
    )

    check_type   = models.CharField(
        max_length=3,
        choices=CHECK_TYPE_CHOICES,
        verbose_name='Type de pointage',
    )

    # Exact moment of the tap
    timestamp    = models.DateTimeField(default=timezone.now, verbose_name='Horodatage')

    # GPS coordinates at the moment of the tap (from mobile)
    gps_lat      = models.DecimalField(
        max_digits=10, decimal_places=7,
        null=True, blank=True,
        verbose_name='Latitude GPS',
    )
    gps_lng      = models.DecimalField(
        max_digits=10, decimal_places=7,
        null=True, blank=True,
        verbose_name='Longitude GPS',
    )

    # Computed at save time — distance in meters from project GPS
    distance_from_site = models.DecimalField(
        max_digits=8, decimal_places=1,
        null=True, blank=True,
        verbose_name='Distance du site (m)',
    )

    # TRUE if distance > project.geofence_radius → shows RED on Director dashboard
    is_off_site  = models.BooleanField(
        default=False,
        verbose_name='Hors Site',
        help_text='Pointage effectué à plus de N mètres du chantier.',
    )

    notes        = models.CharField(max_length=255, blank=True)
    created_at   = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name        = 'Pointage'
        verbose_name_plural = 'Pointages'
        ordering            = ['-timestamp']
        indexes             = [
            models.Index(fields=['project', 'timestamp']),
            models.Index(fields=['worker', 'timestamp']),
            models.Index(fields=['is_off_site']),
        ]

    def __str__(self):
        flag = ' ⚠️ HORS SITE' if self.is_off_site else ''
        return f"{self.worker.full_name} — {self.get_check_type_display()} — {self.timestamp:%d/%m/%Y %H:%M}{flag}"

    # ── Geofencing calculation ────────────────────────────────────────────

    @staticmethod
    def haversine_distance(lat1, lng1, lat2, lng2) -> float:
        """
        Returns distance in meters between two GPS coordinates.
        Uses the Haversine formula — accurate for short distances.
        """
        R = 6_371_000  # Earth radius in meters

        phi1 = math.radians(float(lat1))
        phi2 = math.radians(float(lat2))
        dphi = math.radians(float(lat2) - float(lat1))
        dlam = math.radians(float(lng2) - float(lng1))

        a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
        return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    def compute_geofence(self):
        """
        Called before save to compute distance and set is_off_site flag.
        Returns early (no flag) if either the attendance or project has no GPS.
        """
        if (
            self.gps_lat is None or self.gps_lng is None
            or self.project.gps_lat is None or self.project.gps_lng is None
        ):
            return  # Cannot compute — no GPS on one side

        distance = self.haversine_distance(
            self.gps_lat, self.gps_lng,
            self.project.gps_lat, self.project.gps_lng,
        )
        self.distance_from_site = round(distance, 1)
        self.is_off_site = distance > float(self.project.geofence_radius)

    def save(self, *args, **kwargs):
        self.compute_geofence()
        super().save(*args, **kwargs)


# ===========================================================================
# DAILY REPORT  (Journal de chantier)
# ===========================================================================

class DailyReport(models.Model):
    WEATHER_CHOICES = [
        ('ensoleille', 'Ensoleillé'),
        ('nuageux',    'Nuageux'),
        ('pluvieux',   'Pluvieux'),
        ('venteux',    'Venteux'),
        ('orageux',    'Orageux'),
    ]

    id             = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project        = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='daily_reports')
    author         = models.ForeignKey('users.User', on_delete=models.SET_NULL, null=True, related_name='daily_reports')
    report_date    = models.DateField()
    weather        = models.CharField(max_length=20, choices=WEATHER_CHOICES, blank=True)
    temperature    = models.SmallIntegerField(null=True, blank=True)
    workers_count  = models.PositiveSmallIntegerField(default=0)
    work_done      = models.TextField()
    materials_used = models.TextField(blank=True)
    progress_pct   = models.PositiveSmallIntegerField(null=True, blank=True)
    is_validated   = models.BooleanField(default=False)
    validated_by   = models.ForeignKey(
        'users.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='validated_reports'
    )
    validated_at   = models.DateTimeField(null=True, blank=True)
    created_at     = models.DateTimeField(auto_now_add=True)
    updated_at     = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name    = 'Journal de chantier'
        ordering        = ['-report_date']
        unique_together = [('project', 'report_date')]

    def __str__(self):
        return f"Rapport {self.report_date} – {self.project.name}"


# ===========================================================================
# REPORT IMAGE
# ===========================================================================

class ReportImage(models.Model):
    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    report      = models.ForeignKey(DailyReport, on_delete=models.CASCADE, related_name='images')
    image       = models.ImageField(upload_to='reports/images/%Y/%m/')
    caption     = models.CharField(max_length=255, blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['uploaded_at']


# ===========================================================================
# INCIDENT
# ===========================================================================

class Incident(models.Model):
    TYPE_CHOICES = [
        ('intemperie', 'Intempérie'),
        ('panne',      'Panne machine'),
        ('accident',   'Accident de travail'),
        ('retard',     'Retard livraison'),
        ('securite',   'Problème sécurité'),
        ('autre',      'Autre'),
    ]
    SEVERITY_CHOICES = [
        ('faible',   'Faible'),
        ('moyen',    'Moyen'),
        ('eleve',    'Élevé'),
        ('critique', 'Critique'),
    ]

    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    report      = models.ForeignKey(DailyReport, on_delete=models.CASCADE, related_name='incidents')
    type        = models.CharField(max_length=20, choices=TYPE_CHOICES)
    severity    = models.CharField(max_length=10, choices=SEVERITY_CHOICES, default='moyen')
    description = models.TextField()
    impact      = models.TextField(blank=True)
    resolved    = models.BooleanField(default=False)
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']


# ===========================================================================
# TASK  (Planning / Gantt)
# ===========================================================================

class Task(models.Model):
    STATUS_CHOICES = [
        ('a_faire',   'À faire'),
        ('en_cours',  'En cours'),
        ('termine',   'Terminé'),
        ('en_retard', 'En retard'),
        ('suspendu',  'Suspendu'),
    ]

    id           = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project      = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='tasks')
    parent       = models.ForeignKey('self', null=True, blank=True, on_delete=models.CASCADE, related_name='subtasks')
    name         = models.CharField(max_length=255)
    description  = models.TextField(blank=True)
    status       = models.CharField(max_length=20, choices=STATUS_CHOICES, default='a_faire')
    start_date   = models.DateField(null=True, blank=True)
    end_date     = models.DateField(null=True, blank=True)
    progress_pct = models.PositiveSmallIntegerField(default=0)
    assigned_to  = models.ForeignKey(
        'users.User', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='tasks'
    )
    order        = models.PositiveSmallIntegerField(default=0)
    created_at   = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['order', 'start_date']

    def __str__(self):
        return f"{self.project.name} — {self.name}"

    @property
    def is_delayed(self):
        if self.end_date and self.status not in ('termine',):
            return self.end_date < timezone.now().date()
        return False


# ===========================================================================
# PURCHASE  (Registre des achats / Bons de commande)
# ===========================================================================

class Purchase(models.Model):
    STATUS_CHOICES = [
        ('commande',   'Commandé'),
        ('livre',      'Livré'),
        ('annule',     'Annulé'),
        ('en_attente', 'En attente'),
    ]

    id              = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project         = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='purchases')
    created_by      = models.ForeignKey('users.User', on_delete=models.SET_NULL, null=True, related_name='purchases')
    designation     = models.CharField(max_length=255)
    fournisseur     = models.CharField(max_length=255, blank=True)
    quantite        = models.DecimalField(max_digits=12, decimal_places=2)
    unite           = models.CharField(max_length=50, blank=True)
    prix_unitaire   = models.DecimalField(max_digits=12, decimal_places=2)
    date_commande   = models.DateField()
    date_livraison  = models.DateField(null=True, blank=True)
    statut          = models.CharField(max_length=20, choices=STATUS_CHOICES, default='commande')
    notes           = models.TextField(blank=True)
    created_at      = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-date_commande']

    def __str__(self):
        return f"{self.designation} — {self.project.name}"

    @property
    def total(self):
        return round(float(self.quantite) * float(self.prix_unitaire), 2)


# ===========================================================================
# get_dashboard_data()  — Role-filtered data utility
# ===========================================================================

def get_dashboard_data(user, project=None):
    """
    Returns a dict of data filtered by the user's role.
    Called by views to build role-specific dashboard payloads.

    Rules enforced:
      - chef_chantier (E): NO budget, NO marges, NO unit prices
      - chef_equipe   (F): ONLY his workers' attendance list
      - client        (K): ONLY progress_pct, photos, PV
      - comptable     (J): Full treasury, no operational data
      - admin_entreprise (B): Everything consolidated across all projects

    Args:
        user    : User instance (authenticated)
        project : Project instance (optional — None for company-wide views)

    Returns:
        dict with keys relevant to the user's dashboard type
    """
    from django.db.models import Sum, Count, Q

    role = user.platform_role
    today = timezone.now().date()
    data = {'dashboard_type': user.dashboard_type, 'role': role}

    # ── A — App Owner: full infrastructure view ───────────────────────────
    if role == 'app_owner':
        from users.models import Company
        data['companies_count']     = Company.objects.count()
        data['active_companies']    = Company.objects.filter(is_active=True).count()
        data['total_users']         = user.__class__.objects.count()
        data['total_projects']      = Project.objects.count()
        return data

    # All roles below require a company
    if not user.company:
        return data

    company_projects = Project.objects.filter(company=user.company)

    # ── B — Directeur: strategic & financial consolidation ────────────────
    if role == 'admin_entreprise':
        data['projects_total']      = company_projects.count()
        data['projects_en_cours']   = company_projects.filter(status='en_cours').count()
        data['projects_retard']     = [p for p in company_projects if p.is_delayed]
        data['budget_total']        = company_projects.aggregate(t=Sum('budget'))['t'] or 0
        data['expenses_total']      = company_projects.aggregate(t=Sum('actual_expenses'))['t'] or 0
        data['active_workers_now']  = sum(p.active_workers_today for p in company_projects)
        data['off_site_alerts']     = Attendance.objects.filter(
            project__company=user.company,
            is_off_site=True,
            timestamp__date=today,
        ).count()
        data['projects_list']       = list(company_projects.values(
            'id', 'name', 'status', 'progress_pct', 'budget',
            'actual_expenses', 'gps_lat', 'gps_lng', 'location',
        ))
        # Marges: budget - actual_expenses per project
        data['marges'] = [
            {
                'project': p.name,
                'marge': p.budget_remaining,
                'pct_consomme': p.budget_consumed_pct,
            }
            for p in company_projects if p.budget
        ]
        return data

    # ── C — Office Admin: HR & resources view ────────────────────────────
    if role == 'office_admin':
        from users.models import Worker
        data['team_count']          = user.__class__.objects.filter(company=user.company).count()
        data['workers_count']       = Worker.objects.filter(company=user.company, is_active=True).count()
        data['projects_list']       = list(company_projects.values('id', 'name', 'status'))
        data['attendance_today']    = Attendance.objects.filter(
            project__company=user.company,
            timestamp__date=today
        ).count()
        return data

    # ── Project-scoped roles (D→K) ────────────────────────────────────────
    # Determine which project(s) to scope to
    if project:
        scoped_projects = [project]
    else:
        member_project_ids = user.project_memberships.values_list('project_id', flat=True)
        scoped_projects = list(Project.objects.filter(id__in=member_project_ids))

    # ── D — Chef de Projet: Gantt & budget ───────────────────────────────
    if role == 'chef_projet':
        for p in scoped_projects:
            data.setdefault('projects', []).append({
                'id':            str(p.id),
                'name':          p.name,
                'status':        p.status,
                'progress_pct':  p.progress_pct,
                'budget':        float(p.budget) if p.budget else None,
                'actual_expenses': float(p.actual_expenses),
                'budget_remaining': p.budget_remaining,
                'is_delayed':    p.is_delayed,
                'tasks':         list(p.tasks.values(
                    'id', 'name', 'status', 'start_date', 'end_date', 'progress_pct'
                )),
            })
        return data

    # ── E — Chef de Chantier: field action — NO financials ───────────────
    if role == 'chef_chantier':
        for p in scoped_projects:
            today_attendance = Attendance.objects.filter(
                project=p, timestamp__date=today
            )
            data.setdefault('projects', []).append({
                'id':              str(p.id),
                'name':            p.name,
                'location':        p.location,
                'gps_lat':         str(p.gps_lat) if p.gps_lat else None,
                'gps_lng':         str(p.gps_lng) if p.gps_lng else None,
                'progress_pct':    p.progress_pct,
                # ⛔ NO budget, NO marges, NO prix_unitaire
                'workers_in_today':  today_attendance.filter(check_type='in').count(),
                'workers_out_today': today_attendance.filter(check_type='out').count(),
                'off_site_today':    today_attendance.filter(is_off_site=True).count(),
                'last_report':       str(
                    p.daily_reports.order_by('-report_date').values_list('report_date', flat=True).first()
                ),
            })
        return data

    # ── F — Chef d'Équipe: simplified attendance only ─────────────────────
    if role == 'chef_equipe':
        for p in scoped_projects:
            from users.models import Worker
            # Only workers assigned to this project today
            data.setdefault('projects', []).append({
                'id':           str(p.id),
                'name':         p.name,
                'workers_today': list(
                    Attendance.objects.filter(project=p, timestamp__date=today)
                    .values('worker__id', 'worker__first_name', 'worker__last_name',
                            'check_type', 'timestamp', 'is_off_site')
                ),
            })
        return data

    # ── G — Ingénieur: documents only ────────────────────────────────────
    if role == 'ingenieur':
        for p in scoped_projects:
            data.setdefault('projects', []).append({
                'id':   str(p.id),
                'name': p.name,
                # Documents/plans will come from a future Document model
                # For now expose contracts (which contain the uploaded files)
                'contracts': list(p.contracts.values('id', 'file_name', 'file_type', 'created_at')),
            })
        return data

    # ── H — QHSE: incidents & safety ────────────────────────────────────
    if role == 'qhse':
        for p in scoped_projects:
            incidents = Incident.objects.filter(report__project=p)
            data.setdefault('projects', []).append({
                'id':                str(p.id),
                'name':              p.name,
                'incidents_total':   incidents.count(),
                'incidents_open':    incidents.filter(resolved=False).count(),
                'incidents_critical': incidents.filter(severity='critique', resolved=False).count(),
                'recent_incidents':  list(incidents.order_by('-created_at')[:5].values(
                    'type', 'severity', 'description', 'resolved', 'created_at'
                )),
            })
        return data

    # ── I — Magasinier: stock & purchases ────────────────────────────────
    if role == 'magasinier':
        for p in scoped_projects:
            data.setdefault('projects', []).append({
                'id':              str(p.id),
                'name':            p.name,
                'purchases':       list(p.purchases.values(
                    'id', 'designation', 'quantite', 'unite', 'statut',
                    'date_commande', 'date_livraison', 'fournisseur'
                    # ⛔ NO prix_unitaire exposed to magasinier (not his scope)
                )),
                'pending_orders':  p.purchases.filter(statut='commande').count(),
            })
        return data

    # ── J — Comptable: full treasury ─────────────────────────────────────
    if role == 'comptable':
        for p in scoped_projects:
            purchases = p.purchases.all()
            data.setdefault('projects', []).append({
                'id':               str(p.id),
                'name':             p.name,
                'budget':           float(p.budget) if p.budget else None,
                'actual_expenses':  float(p.actual_expenses),
                'budget_remaining': p.budget_remaining,
                'purchases_total':  sum(pu.total for pu in purchases),
                'purchases':        list(purchases.values(
                    'id', 'designation', 'fournisseur', 'quantite',
                    'prix_unitaire', 'statut', 'date_commande',
                )),
                'contracts_total':  p.contracts_total,
            })
        return data

    # ── K — Client: read-only progress view ──────────────────────────────
    if role == 'client':
        for p in scoped_projects:
            data.setdefault('projects', []).append({
                'id':            str(p.id),
                'name':          p.name,
                'status':        p.status,
                'progress_pct':  p.progress_pct,
                # ⛔ NO budget, NO expenses, NO team info
                'validated_reports': list(
                    p.daily_reports.filter(is_validated=True)
                    .order_by('-report_date')
                    .values('report_date', 'work_done', 'progress_pct', 'weather')
                ),
                'photos': list(
                    ReportImage.objects.filter(report__project=p)
                    .order_by('-uploaded_at')[:20]
                    .values('image', 'caption', 'uploaded_at')
                ),
            })
        return data

    return data