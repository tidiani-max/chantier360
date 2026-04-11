"""
projects/management/commands/seed_data.py
BTP Manager — Multi-Tenant SaaS
================================
Creates one Company (tenant) + all 11 role users + rich demo data.

Run:
    python manage.py seed_data
    python manage.py seed_data --reset
"""

from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import date, timedelta
import random

User = get_user_model()


class Command(BaseCommand):
    help = 'Seed BTP Manager with all 11 roles and demo data'

    def add_arguments(self, parser):
        parser.add_argument(
            '--reset', action='store_true',
            help='Delete all non-superuser data first'
        )

    def handle(self, *args, **options):
        if options['reset']:
            self.stdout.write('🗑  Resetting...')
            from projects.models import Project, DailyReport, ReportImage, Incident, ProjectMember, Task, Purchase, Attendance
            from contracts.models import Contract
            from users.models import Company, Worker
            Attendance.objects.all().delete()
            Purchase.objects.all().delete()
            Task.objects.all().delete()
            Incident.objects.all().delete()
            ReportImage.objects.all().delete()
            DailyReport.objects.all().delete()
            ProjectMember.objects.all().delete()
            Contract.objects.all().delete()
            Project.objects.all().delete()
            Worker.objects.all().delete()
            User.objects.filter(is_superuser=False).delete()
            Company.objects.all().delete()
            self.stdout.write('✅  Done\n')

        self._create_company_and_users()
        self._create_workers()
        self._create_projects()
        self._print_summary()

    # =========================================================================
    # COMPANY + USERS
    # =========================================================================

    def _create_company_and_users(self):
        from users.models import Company

        self.stdout.write('\n🏢  Creating company (tenant)...')
        self.company, _ = Company.objects.get_or_create(
            slug='btp-mali',
            defaults={
                'name':         'BTP Mali Construction SARL',
                'country':      'Mali',
                'city':         'Bamako',
                'phone':        '+223 20 22 33 44',
                'email':        'contact@btpmali.ml',
                'subscription': 'pro',
            }
        )
        self.stdout.write(f'   ✅  {self.company.name}')

        self.stdout.write('\n👤  Creating users (one per role A→K)...')
        self.stdout.write(f'   {"EMAIL":<45} {"PASSWORD":<20} ROLE')
        self.stdout.write('   ' + '-'*80)

        # ── A — App Owner (no company — platform admin) ───────────────────
        self.app_owner = self._make_user(
            'appowner@btpmanager.ml', 'App Owner Platform',
            'app_owner', None, 'Super Admin Plateforme', 'AppOwner2024!'
        )

        # ── B — Admin Entreprise (Directeur) ─────────────────────────────
        self.admin_entreprise = self._make_user(
            'directeur@btpmali.ml', 'Amadou Koné',
            'admin_entreprise', self.company, 'Directeur Général', 'Directeur2024!'
        )

        # ── C — Office Admin (RH / Pivot opérationnel) ───────────────────
        self.office_admin = self._make_user(
            'rh@btpmali.ml', 'Mariama Diallo',
            'office_admin', self.company, 'Responsable RH & Admin', 'OfficeAdmin2024!'
        )

        # ── D — Chef de Projet ───────────────────────────────────────────
        self.chef_projet = self._make_user(
            'chef.projet@btpmali.ml', 'Ibrahim Traoré',
            'chef_projet', self.company, 'Chef de Projet Senior', 'ChefProjet2024!'
        )

        # ── E — Chef de Chantier ─────────────────────────────────────────
        self.chef_chantier = self._make_user(
            'chef.chantier@btpmali.ml', 'Seydou Keïta',
            'chef_chantier', self.company, 'Chef de Chantier', 'Chantier2024!'
        )

        # ── F — Chef d'Équipe ────────────────────────────────────────────
        self.chef_equipe = self._make_user(
            'chef.equipe@btpmali.ml', 'Oumar Coulibaly',
            'chef_equipe', self.company, "Chef d'Équipe Maçonnerie", 'Equipe2024!'
        )

        # ── G — Ingénieur ────────────────────────────────────────────────
        self.ingenieur = self._make_user(
            'ingenieur@btpmali.ml', 'Dr. Moussa Coulibaly',
            'ingenieur', self.company, "Ingénieur Structure / Bureau d'Études", 'Ingenieur2024!'
        )

        # ── H — QHSE ─────────────────────────────────────────────────────
        self.qhse = self._make_user(
            'qhse@btpmali.ml', 'Aminata Sanogo',
            'qhse', self.company, 'Responsable HSE', 'Qhse2024!'
        )

        # ── I — Magasinier ───────────────────────────────────────────────
        self.magasinier = self._make_user(
            'magasin@btpmali.ml', 'Boubacar Dembélé',
            'magasinier', self.company, 'Magasinier Chef', 'Magasin2024!'
        )

        # ── J — Comptable ────────────────────────────────────────────────
        self.comptable = self._make_user(
            'finance@btpmali.ml', 'Fatoumata Sissoko',
            'comptable', self.company, 'DAF / Comptable Principal', 'Finance2024!'
        )

        # ── K — Client ───────────────────────────────────────────────────
        self.client = self._make_user(
            'client@btpmali.ml', 'Col. Mamadou Bah',
            'client', self.company, "Maître d'Ouvrage Délégué", 'Client2024!'
        )

        # Django superuser (for /admin/ access — same as app_owner)
        if not User.objects.filter(email='superadmin@btpmanager.ml').exists():
            User.objects.create_superuser(
                email='superadmin@btpmanager.ml',
                password='SuperAdmin2024!',
                full_name='Super Admin Django',
            )
            self.stdout.write(
                f'   ✅  {"superadmin@btpmanager.ml":<45} {"SuperAdmin2024!":<20} django_superuser'
            )

    def _make_user(self, email, full_name, role, company, fonction, password):
        user, created = User.objects.get_or_create(
            email=email,
            defaults={
                'full_name':     full_name,
                'company':       company,
                'platform_role': role,
                'fonction':      fonction,
                'is_verified':   True,
                'is_active':     True,
            }
        )
        if not created:
            user.company       = company
            user.platform_role = role
            user.fonction      = fonction
        user.set_password(password)
        user.save()
        label = '✅ created' if created else '↩️  updated'
        self.stdout.write(f'   {label}  {email:<45} {password:<20} {role}')
        return user

    # =========================================================================
    # WORKERS (Ouvriers — not platform users)
    # =========================================================================

    def _create_workers(self):
        from users.models import Worker

        self.stdout.write('\n👷  Creating workers (ouvriers)...')
        workers_data = [
            ('Mamadou',   'Coulibaly', '70112233', 'maconnerie',  8_000),
            ('Boubacar',  'Traoré',    '70223344', 'ferraillage', 9_000),
            ('Seydou',    'Diarra',    '70334455', 'coffrage',    8_500),
            ('Moussa',    'Sanogo',    '70445566', 'maconnerie',  8_000),
            ('Ibrahim',   'Keïta',     '70556677', 'manoeuvre',   6_500),
            ('Oumar',     'Bah',       '70667788', 'manoeuvre',   6_500),
            ('Drissa',    'Camara',    '70778899', 'carrelage',   9_500),
            ('Modibo',    'Sissoko',   '70889900', 'peinture',    8_000),
            ('Adama',     'Dembélé',   '70990011', 'plomberie',  10_000),
            ('Cheick',    'Konaté',    '71001122', 'ferraillage', 9_000),
        ]
        self.workers = []
        for first, last, phone, trade, rate in workers_data:
            w, created = Worker.objects.get_or_create(
                first_name=first, last_name=last, company=self.company,
                defaults={
                    'phone':      phone,
                    'trade':      trade,
                    'daily_rate': rate,
                    'is_active':  True,
                    'created_by': self.office_admin,
                }
            )
            self.workers.append(w)
            label = '✅' if created else '↩️ '
            self.stdout.write(f'   {label}  {first} {last} — {trade} — {rate:,} FCFA/jour')

    # =========================================================================
    # PROJECTS
    # =========================================================================

    def _create_projects(self):
        from projects.models import Project, ProjectMember

        self.stdout.write('\n🏗  Creating projects...')

        # ── Project 1: Immeuble R+4 (en cours) ───────────────────────────
        self.p1, _ = Project.objects.get_or_create(
            name='Construction Immeuble R+4 Hamdallaye ACI 2000',
            company=self.company,
            defaults={
                'reference':       'BTP-2024-001',
                'project_type':    'batiment',
                'status':          'en_cours',
                'location':        'Hamdallaye ACI 2000, Bamako',
                'gps_lat':         12.6392000,
                'gps_lng':         -8.0029000,
                'geofence_radius': 200,
                'description':     "Construction d'un immeuble R+4 à usage mixte. Surface : 2 400 m².",
                'client_name':     'SCI Hamdallaye Invest',
                'client_email':    'd.coulibaly@sci-hamdallaye.ml',
                'start_date':      date(2024, 3, 1),
                'end_date':        date(2025, 9, 30),
                'budget':          850_000_000,
                'actual_expenses': 312_500_000,
                'progress_pct':    37,
                'created_by':      self.admin_entreprise,
            }
        )
        self.stdout.write(f'   ✅  {self.p1.name}')

        # Assign all operational roles D→K
        for user, role in [
            (self.chef_projet,   'chef_projet'),
            (self.chef_chantier, 'chef_chantier'),
            (self.chef_equipe,   'chef_equipe'),
            (self.ingenieur,     'ingenieur'),
            (self.qhse,          'qhse'),
            (self.magasinier,    'magasinier'),
            (self.comptable,     'comptable'),
            (self.client,        'client'),
        ]:
            ProjectMember.objects.get_or_create(
                project=self.p1, user=user,
                defaults={'role': role, 'added_by': self.office_admin}
            )

        self._create_tasks(self.p1)
        self._create_reports(self.p1)
        self._create_purchases(self.p1)
        self._create_attendance(self.p1)

        # ── Project 2: Route RN6 (planifié) ──────────────────────────────
        p2, _ = Project.objects.get_or_create(
            name='Réhabilitation Route Nationale RN6 — Ségou/San',
            company=self.company,
            defaults={
                'reference':    'BTP-2024-002',
                'project_type': 'route',
                'status':       'planifie',
                'location':     'Route Nationale 6, Ségou — San, Mali',
                'description':  'Réhabilitation de 45 km de chaussée.',
                'client_name':  'Direction Nationale des Routes',
                'start_date':   date(2025, 2, 1),
                'end_date':     date(2027, 1, 31),
                'budget':       2_400_000_000,
                'actual_expenses': 0,
                'progress_pct': 0,
                'created_by':   self.admin_entreprise,
            }
        )
        self.stdout.write(f'   ✅  {p2.name}')
        for user, role in [(self.chef_projet, 'chef_projet'), (self.comptable, 'comptable'), (self.client, 'client')]:
            ProjectMember.objects.get_or_create(project=p2, user=user, defaults={'role': role, 'added_by': self.office_admin})

        # ── Project 3: AEP Kati (terminé) ────────────────────────────────
        p3, _ = Project.objects.get_or_create(
            name="Adduction d'eau potable — Villages Kati",
            company=self.company,
            defaults={
                'reference':       'BTP-2023-005',
                'project_type':    'aep',
                'status':          'termine',
                'location':        'Kati, Cercle de Kati, Mali',
                'client_name':     'SOMAPEP',
                'start_date':      date(2023, 6, 1),
                'end_date':        date(2024, 2, 28),
                'budget':          185_000_000,
                'actual_expenses': 178_200_000,
                'progress_pct':    100,
                'created_by':      self.admin_entreprise,
            }
        )
        self.stdout.write(f'   ✅  {p3.name}')

        # ── Project 4: Pont Djenné (suspendu) ────────────────────────────
        p4, _ = Project.objects.get_or_create(
            name='Construction Pont sur le Bani — Djenné',
            company=self.company,
            defaults={
                'reference':       'BTP-2024-003',
                'project_type':    'pont',
                'status':          'suspendu',
                'location':        'Djenné, Mopti, Mali',
                'client_name':     'Ministère des Infrastructures',
                'start_date':      date(2024, 2, 1),
                'end_date':        date(2026, 6, 30),
                'budget':          1_200_000_000,
                'actual_expenses': 98_500_000,
                'progress_pct':    8,
                'created_by':      self.admin_entreprise,
            }
        )
        self.stdout.write(f'   ✅  {p4.name}')

    # =========================================================================
    # TASKS
    # =========================================================================

    def _create_tasks(self, project):
        from projects.models import Task

        phases = [
            ('Phase 1 — Fondations',          date(2024, 3, 1),  date(2024, 5, 31),  100, 'termine',  1),
            ('Phase 2 — Gros œuvre RDC',      date(2024, 5, 1),  date(2024, 8, 31),  100, 'termine',  2),
            ('Phase 3 — Gros œuvre R+1',      date(2024, 8, 1),  date(2024, 11, 30), 100, 'termine',  3),
            ('Phase 4 — Gros œuvre R+2',      date(2024, 11, 1), date(2025, 2, 28),   65, 'en_cours', 4),
            ('Phase 5 — Gros œuvre R+3/R+4',  date(2025, 2, 1),  date(2025, 5, 31),    0, 'a_faire',  5),
            ('Phase 6 — Second œuvre',         date(2025, 5, 1),  date(2025, 8, 31),    0, 'a_faire',  6),
            ('Phase 7 — Finitions & réception',date(2025, 8, 1),  date(2025, 9, 30),    0, 'a_faire',  7),
        ]
        for name, start, end, pct, stat, order in phases:
            Task.objects.get_or_create(
                project=project, name=name,
                defaults={
                    'start_date':   start,
                    'end_date':     end,
                    'progress_pct': pct,
                    'status':       stat,
                    'order':        order,
                    'assigned_to':  self.chef_projet,
                }
            )

    # =========================================================================
    # REPORTS
    # =========================================================================

    def _create_reports(self, project):
        from projects.models import DailyReport, Incident

        works = [
            "Ferraillage poteaux R+2 côté nord : 24 poteaux 40x40. 850 kg HA16 posés.",
            "Décoffrage voiles RDC côté sud. Reprise béton sur 3 points. Nettoyage dalle.",
            "Pose canalisations EU/EP sous dallage RDC. 85m PVC DN150. Essai étanchéité.",
            "Ferraillage dalles R+1/R+2. Treillis soudés 20x20 + HA12. Réunion hebdo.",
            "Coulage dalle R+2 : 28m³ béton B25 BPE. Vibration. Cure SIKA.",
            "Maçonnerie parpaings R+2 côté est : 1 200 parpaings. Mortier M10.",
            "Enduit plâtre façade nord 1er étage. 180 m² traités.",
            "Pose menuiseries ALU RDC : 8 fenêtres 120x120, 3 portes-fenêtres 180x240.",
            "Travaux arrêtés 2h suite orage. Reprise 14h. Bâchage coffrage.",
            "Coulage poteaux R+3 : 18 poteaux. 14m³ béton B25.",
        ]
        weather = ['ensoleille','ensoleille','nuageux','pluvieux','ensoleille',
                   'ensoleille','nuageux','ensoleille','orageux','ensoleille']

        base = date.today() - timedelta(days=10)
        for i in range(10):
            d = base + timedelta(days=i)
            if DailyReport.objects.filter(project=project, report_date=d).exists():
                continue
            report = DailyReport.objects.create(
                project=project,
                author=self.chef_chantier,
                report_date=d,
                weather=weather[i],
                temperature=random.randint(27, 38),
                workers_count=random.randint(14, 26),
                work_done=works[i],
                progress_pct=min(100, 32 + i * 2),
                is_validated=(i < 7),
                validated_by=self.chef_projet if i < 7 else None,
                validated_at=timezone.now() if i < 7 else None,
            )
            if i == 3:
                Incident.objects.create(
                    report=report, type='panne', severity='moyen',
                    description='Panne bétonnière principale pendant coulage. Arrêt 2h30.',
                    impact='Retard partiel. Reprise fin de journée.', resolved=True,
                )
            if i == 8:
                Incident.objects.create(
                    report=report, type='intemperie', severity='eleve',
                    description='Orage violent 80 km/h. Arrêt chantier 11h30-14h.',
                    impact='Perte 2h30 production.', resolved=True,
                )

    # =========================================================================
    # PURCHASES
    # =========================================================================

    def _create_purchases(self, project):
        from projects.models import Purchase

        achats = [
            ('Béton BPE B25 — Juillet',      'CIMAF Mali',         22,   'm³',   85_000,  date(2024, 7, 15),  date(2024, 7, 15),  'livre'),
            ('Ferraillage HA16 — Lot 3',      'Aciers du Sahel',   850,   'kg',    1_200,  date(2024, 8, 1),   date(2024, 8, 3),   'livre'),
            ('Parpaings 20x20x40 — 5 000u',  'Briqueterie Bamako',5000,  'u',       320,  date(2024, 9, 10),  date(2024, 9, 15),  'livre'),
            ('Menuiseries ALU — RDC',         'ALU-MALI SARL',       1,   'lot', 4_800_000, date(2024, 10, 5), date(2024, 10, 20), 'livre'),
            ('Ciment CEM II — 200 sacs',      'Diamou Ciments',    200,   'sac',   12_500,  date(2024, 11, 1),  date(2024, 11, 3),  'livre'),
            ('Béton BPE B25 — Décembre',      'CIMAF Mali',         28,   'm³',   85_000,  date(2024, 12, 5),  date(2024, 12, 5),  'livre'),
            ('Béton BPE B30 — Poteaux R+3',   'CIMAF Mali',         14,   'm³',   92_000,  date(2025, 1, 25),  date(2025, 1, 25),  'livre'),
            ('Silicone Sika — 50 cartouches', 'Sika Mali',          50,   'u',      8_500,  date(2025, 2, 1),   None,               'commande'),
        ]
        for desig, fournisseur, qte, unite, pu, d_cmd, d_liv, statut in achats:
            Purchase.objects.get_or_create(
                project=project, designation=desig,
                defaults={
                    'fournisseur':    fournisseur,
                    'quantite':       qte,
                    'unite':          unite,
                    'prix_unitaire':  pu,
                    'date_commande':  d_cmd,
                    'date_livraison': d_liv,
                    'statut':         statut,
                    'created_by':     self.comptable,
                }
            )

    # =========================================================================
    # ATTENDANCE — demo pointage records with GPS
    # =========================================================================

    def _create_attendance(self, project):
        from projects.models import Attendance

        self.stdout.write('\n📍  Creating demo attendance records...')

        # Site GPS: Hamdallaye ACI 2000 — lat 12.6392, lng -8.0029
        # Simulate 3 days of check-ins
        base = date.today() - timedelta(days=2)

        for day_offset in range(3):
            day = base + timedelta(days=day_offset)
            for i, worker in enumerate(self.workers[:6]):
                # Slight GPS variation — most within 200m, one off-site
                if i == 2 and day_offset == 1:
                    # Simulate a fraud: worker ~500m away
                    lat, lng = 12.6440, -8.0029
                else:
                    lat = 12.6392 + random.uniform(-0.0008, 0.0008)
                    lng = -8.0029 + random.uniform(-0.0008, 0.0008)

                # Check-in (morning)
                if not Attendance.objects.filter(
                    worker=worker, project=project,
                    check_type='in', timestamp__date=day
                ).exists():
                    Attendance.objects.create(
                        worker=worker,
                        project=project,
                        recorded_by=self.chef_chantier,
                        check_type='in',
                        timestamp=timezone.make_aware(
                            timezone.datetime(day.year, day.month, day.day, 7, 30 + i * 2)
                        ),
                        gps_lat=lat,
                        gps_lng=lng,
                    )

                # Check-out (evening)
                if not Attendance.objects.filter(
                    worker=worker, project=project,
                    check_type='out', timestamp__date=day
                ).exists():
                    Attendance.objects.create(
                        worker=worker,
                        project=project,
                        recorded_by=self.chef_chantier,
                        check_type='out',
                        timestamp=timezone.make_aware(
                            timezone.datetime(day.year, day.month, day.day, 17, 0 + i * 3)
                        ),
                        gps_lat=lat + random.uniform(-0.0002, 0.0002),
                        gps_lng=lng + random.uniform(-0.0002, 0.0002),
                    )

        off_site = Attendance.objects.filter(project=project, is_off_site=True).count()
        total    = Attendance.objects.filter(project=project).count()
        self.stdout.write(f'   ✅  {total} pointages créés ({off_site} hors-site 🔴)')

    # =========================================================================
    # SUMMARY TABLE
    # =========================================================================

    def _print_summary(self):
        self.stdout.write('\n' + '='*90)
        self.stdout.write('🎉  SEED COMPLETE — 12 test accounts ready\n')
        self.stdout.write('='*90)
        self.stdout.write(f'\n   {"EMAIL":<45} {"PASSWORD":<22} ROLE')
        self.stdout.write('   ' + '-'*90)
        accounts = [
            ('appowner@btpmanager.ml',      'AppOwner2024!',     'app_owner',        'A — Infrastructure SaaS'),
            ('directeur@btpmali.ml',        'Directeur2024!',    'admin_entreprise', 'B — Vue stratégique & financière'),
            ('rh@btpmali.ml',               'OfficeAdmin2024!',  'office_admin',     'C — RH, comptes, assignations'),
            ('chef.projet@btpmali.ml',      'ChefProjet2024!',   'chef_projet',      'D — Gantt, budget, documents'),
            ('chef.chantier@btpmali.ml',    'Chantier2024!',     'chef_chantier',    'E — Pointage GPS, journal'),
            ('chef.equipe@btpmali.ml',      'Equipe2024!',       'chef_equipe',      'F — Pointage simplifié'),
            ('ingenieur@btpmali.ml',        'Ingenieur2024!',    'ingenieur',        'G — Plans & documents'),
            ('qhse@btpmali.ml',             'Qhse2024!',         'qhse',             'H — Sécurité & incidents'),
            ('magasin@btpmali.ml',          'Magasin2024!',      'magasinier',       'I — Stocks & livraisons'),
            ('finance@btpmali.ml',          'Finance2024!',      'comptable',        'J — Trésorerie projet'),
            ('client@btpmali.ml',           'Client2024!',       'client',           'K — Vue lecture seule'),
            ('superadmin@btpmanager.ml',    'SuperAdmin2024!',   'django_admin',     '/admin/ uniquement'),
        ]
        for email, pwd, role, access in accounts:
            self.stdout.write(f'   {email:<45} {pwd:<22} {access}')
        self.stdout.write('\n   🌐  Frontend  : http://localhost:3000')
        self.stdout.write('   ⚙️   Admin     : http://localhost:8000/admin/')
        self.stdout.write('   🔌  API       : http://localhost:8000/api/')
        self.stdout.write('='*90 + '\n')