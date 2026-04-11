from rest_framework import serializers
from .models import Contract


class ContractSerializer(serializers.ModelSerializer):
    project_name = serializers.CharField(source='project.name', read_only=True)
    company_name = serializers.CharField(source='company.full_name', read_only=True)

    class Meta:
        model = Contract
        fields = [
            'id', 'project', 'project_name', 'company_name',
            'file_name', 'file_type', 'file_size',
            'is_processing', 'summary', 'summary_generated_at', 'created_at'
        ]
        read_only_fields = [
            'id', 'project_name', 'company_name',
            'is_processing', 'summary', 'summary_generated_at', 'created_at'
        ]