"""
contracts/models.py
BTP Manager — Multi-Tenant SaaS
================================
Key fix: company FK now points to Company (tenant), not User.
This ensures contract data is isolated per tenant and survives
director account changes.
"""

from django.db import models
import uuid


class Contract(models.Model):
    id      = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # ── Tenant FK — points to Company, NOT User ────────────────────────
    company = models.ForeignKey(
        'users.Company',
        on_delete=models.CASCADE,
        related_name='contracts',
        verbose_name='Entreprise',
    )

    # Who uploaded this contract (admin_entreprise or office_admin)
    uploaded_by = models.ForeignKey(
        'users.User',
        on_delete=models.SET_NULL,
        null=True,
        related_name='contracts_uploaded',
        verbose_name='Uploadé par',
    )

    # Optional link to a project — can be assigned after upload
    project = models.ForeignKey(
        'projects.Project',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='contracts',
        verbose_name='Projet associé',
    )

    file       = models.FileField(upload_to='contracts/')
    file_name  = models.CharField(max_length=255)
    file_type  = models.CharField(max_length=10)   # 'pdf' or 'docx'
    file_size  = models.IntegerField(default=0)

    # AI-generated summary — validated by admin_entreprise only (spec: section B)
    summary              = models.JSONField(null=True, blank=True)
    summary_generated_at = models.DateTimeField(null=True, blank=True)
    is_processing        = models.BooleanField(default=False)

    # Validation by Directeur (admin_entreprise)
    is_validated         = models.BooleanField(default=False)
    validated_by         = models.ForeignKey(
        'users.User',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='contracts_validated',
        verbose_name='Validé par',
    )
    validated_at         = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Contrat'
        ordering     = ['-created_at']

    def __str__(self):
        project_name = self.project.name if self.project else 'Sans projet'
        return f"{self.file_name} — {project_name}"