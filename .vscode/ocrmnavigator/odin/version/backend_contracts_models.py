from django.db import models
import uuid

class Contract(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey('projects.Project', on_delete=models.CASCADE, related_name='contracts', null=True, blank=True)
    company = models.ForeignKey('users.User', on_delete=models.CASCADE, related_name='contracts')
    file = models.FileField(upload_to='contracts/')
    file_name = models.CharField(max_length=255)
    file_type = models.CharField(max_length=10)  # pdf or docx
    file_size = models.IntegerField(default=0)
    summary = models.JSONField(null=True, blank=True)
    summary_generated_at = models.DateTimeField(null=True, blank=True)
    is_processing = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Contrat'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.file_name} - {self.project.name}"
