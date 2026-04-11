from django.contrib import admin
from .models import Contract

@admin.register(Contract)
class ContractAdmin(admin.ModelAdmin):
    list_display = ['file_name', 'company', 'project', 'is_processing', 'created_at']