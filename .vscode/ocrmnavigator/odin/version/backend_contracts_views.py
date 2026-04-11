from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Contract
from .serializers import ContractSerializer
from .ai_service import process_contract_file
from projects.models import Project


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def contract_list(request):
    if request.method == 'GET':
        contracts = Contract.objects.filter(company=request.user)
        project_id = request.query_params.get('project')
        if project_id:
            contracts = contracts.filter(project_id=project_id)
        serializer = ContractSerializer(contracts, many=True)
        return Response(serializer.data)

    elif request.method == 'POST':
        file = request.FILES.get('file')
        project_id = request.data.get('project_id')

        if not file:
            return Response({'error': 'Fichier requis'}, status=status.HTTP_400_BAD_REQUEST)

        file_name = file.name.lower()
        if file_name.endswith('.pdf'):
            file_type = 'pdf'
        elif file_name.endswith('.docx'):
            file_type = 'docx'
        elif file_name.endswith('.doc'):
            file_type = 'doc'
        else:
            return Response(
                {'error': 'Format non supporté. Utilisez PDF ou Word (.docx)'},
                status=status.HTTP_400_BAD_REQUEST
            )

        project = None
        if project_id:
            try:
                project = Project.objects.get(pk=project_id, company=request.user)
            except Project.DoesNotExist:
                return Response({'error': 'Projet non trouvé'}, status=status.HTTP_404_NOT_FOUND)

        contract = Contract.objects.create(
            company=request.user,
            project=project,
            file=file,
            file_name=file.name,
            file_type=file_type,
            file_size=file.size,
            is_processing=True,
        )

        try:
            file_path = contract.file.path
            summary, tokens = process_contract_file(file_path, file_type)
            contract.summary = summary
            contract.is_processing = False
            contract.save()

            return Response({
                'message': 'Contrat analysé avec succès',
                'contract': ContractSerializer(contract).data
            }, status=status.HTTP_201_CREATED)

        except Exception as e:
            contract.is_processing = False
            contract.save()
            return Response(
                {'error': f"Erreur lors de l'analyse: {str(e)}", 'contract_id': str(contract.id)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


@api_view(['GET', 'DELETE'])
@permission_classes([IsAuthenticated])
def contract_detail(request, pk):
    try:
        contract = Contract.objects.get(pk=pk, company=request.user)
    except Contract.DoesNotExist:
        return Response({'error': 'Contrat non trouvé'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        return Response(ContractSerializer(contract).data)
    elif request.method == 'DELETE':
        contract.delete()
        return Response({'message': 'Contrat supprimé'}, status=status.HTTP_204_NO_CONTENT)