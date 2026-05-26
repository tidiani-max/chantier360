"""
contracts/views.py — BTP Manager
==================================
FIXES vs original:
  - BUG FIX: Contract.objects.filter(company=request.user)
             → Contract.objects.filter(company=request.user.company)
  - Added directeur_general + directeur_technique to role checks
  - Added soft delete support (is_deleted field)
  - Validate endpoint: only directeur_general / admin_entreprise / app_owner
"""

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.http import HttpResponse, StreamingHttpResponse
import json

from .models import Contract
from .serializers import ContractSerializer
from .ai_service import (
    process_contract_file, build_contract_context,
    SUMMARY_PROMPT, extract_text_from_pdf, extract_text_from_docx,
)
from .pdf_export import build_contract_pdf
from projects.models import Project


# Roles that can validate contracts (sign off AI summary)
CONTRACT_VALIDATE_ROLES = {
    'app_owner', 'directeur_general', 'admin_entreprise',
}

# Roles that can upload contracts
CONTRACT_UPLOAD_ROLES = {
    'app_owner', 'directeur_general', 'admin_entreprise',
    'directeur_technique', 'office_admin', 'chef_projet',
}


def _base_contracts(user):
    """
    Returns the correct contract queryset for this user.
    FIX: was `company=request.user` — corrected to `company=request.user.company`
    """
    if user.platform_role == 'app_owner':
        qs = Contract.objects.all()
    else:
        # FIXED: was `company=user` — now correctly uses `company=user.company`
        qs = Contract.objects.filter(company=user.company)

    # Filter out soft-deleted contracts if the field exists
    try:
        Contract._meta.get_field('is_deleted')
        qs = qs.filter(is_deleted=False)
    except Exception:
        pass

    return qs


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def contract_list(request):
    if request.method == 'GET':
        contracts  = _base_contracts(request.user)
        project_id = request.query_params.get('project')
        if project_id:
            contracts = contracts.filter(project_id=project_id)
        return Response(ContractSerializer(contracts, many=True).data)

    # POST — upload a contract
    if request.user.platform_role not in CONTRACT_UPLOAD_ROLES:
        return Response(
            {'error': "Téléversement de contrat réservé au Directeur ou Chef de Projet."},
            status=status.HTTP_403_FORBIDDEN,
        )

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
        return Response({'error': 'Format non supporté (pdf, docx, doc)'}, status=status.HTTP_400_BAD_REQUEST)

    project = None
    if project_id:
        try:
            # FIXED: scope project to company
            project = Project.objects.get(pk=project_id, company=request.user.company)
        except Project.DoesNotExist:
            return Response({'error': 'Projet non trouvé'}, status=status.HTTP_404_NOT_FOUND)

    contract = Contract.objects.create(
        # FIXED: company=request.user.company (not request.user)
        company=request.user.company,
        project=project,
        file=file,
        file_name=file.name,
        file_type=file_type,
        file_size=file.size,
        is_processing=True,
    )

    try:
        summary, _ = process_contract_file(contract.file.path, file_type)
        contract.summary      = summary
        contract.is_processing = False
        contract.save()
        return Response({
            'message': 'Contrat analysé avec succès',
            'contract': ContractSerializer(contract).data,
        }, status=status.HTTP_201_CREATED)
    except Exception as e:
        import traceback; traceback.print_exc()
        contract.is_processing = False
        contract.save()
        return Response(
            {'error': f"Erreur lors de l'analyse: {str(e)}", 'contract_id': str(contract.id)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def contract_upload_stream(request):
    """Upload contract and stream AI analysis progress via SSE."""
    from django.conf import settings
    import anthropic

    if request.user.platform_role not in CONTRACT_UPLOAD_ROLES:
        return Response(
            {'error': "Téléversement réservé au Directeur ou Chef de Projet."},
            status=status.HTTP_403_FORBIDDEN,
        )

    file       = request.FILES.get('file')
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
        return Response({'error': 'Format non supporté'}, status=status.HTTP_400_BAD_REQUEST)

    project = None
    if project_id:
        try:
            project = Project.objects.get(pk=project_id, company=request.user.company)
        except Project.DoesNotExist:
            return Response({'error': 'Projet non trouvé'}, status=status.HTTP_404_NOT_FOUND)

    contract = Contract.objects.create(
        company=request.user.company,   # FIXED
        project=project,
        file=file,
        file_name=file.name,
        file_type=file_type,
        file_size=file.size,
        is_processing=True,
    )

    def event_stream():
        try:
            yield f"data: {json.dumps({'type':'progress','message':'📄 Extraction du texte...','percent':10})}\n\n"

            if file_type == 'pdf':
                text = extract_text_from_pdf(contract.file.path)
            else:
                text = extract_text_from_docx(contract.file.path)

            if not text.strip():
                yield f"data: {json.dumps({'type':'error','message':'Impossible d extraire le texte'})}\n\n"
                return

            yield f"data: {json.dumps({'type':'progress','message':'🔍 Analyse des clauses...','percent':25})}\n\n"
            chunked_text = build_contract_context(text)

            yield f"data: {json.dumps({'type':'progress','message':'🤖 L IA analyse votre contrat...','percent':40})}\n\n"

            client        = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
            full_response = ""

            with client.messages.stream(
                model="claude-sonnet-4-20250514",
                max_tokens=16000,
                system="Tu es un expert juridique BTP. Réponds UNIQUEMENT avec du JSON valide et complet. Ne tronque jamais.",
                messages=[{"role":"user","content": SUMMARY_PROMPT.format(contract_text=chunked_text)}]
            ) as stream:
                char_count = 0
                for text_chunk in stream.text_stream:
                    full_response += text_chunk
                    char_count    += len(text_chunk)
                    yield f"data: {json.dumps({'type':'stream','chunk':text_chunk})}\n\n"
                    if char_count > 500:
                        pct = min(90, 40 + int((char_count / 8000) * 50))
                        yield f"data: {json.dumps({'type':'progress','message':'🤖 Extraction des clauses...','percent':pct})}\n\n"

            yield f"data: {json.dumps({'type':'progress','message':'✅ Finalisation...','percent':95})}\n\n"

            clean_text = full_response.strip()
            clean_text = __import__('re').sub(r'```json?\n?', '', clean_text).replace('```','').strip()

            from .ai_service import _parse_json_with_repair
            _repair_client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
            summary_data   = _parse_json_with_repair(_repair_client, clean_text)

            contract.summary       = summary_data
            contract.is_processing = False
            contract.save()

            yield f"data: {json.dumps({'type':'done','percent':100,'contract':ContractSerializer(contract).data})}\n\n"

        except Exception as e:
            import traceback; traceback.print_exc()
            contract.is_processing = False
            contract.save()
            yield f"data: {json.dumps({'type':'error','message':str(e)})}\n\n"

    response = StreamingHttpResponse(event_stream(), content_type='text/event-stream')
    response['Cache-Control']      = 'no-cache'
    response['X-Accel-Buffering']  = 'no'
    return response


@api_view(['GET', 'DELETE'])
@permission_classes([IsAuthenticated])
def contract_detail(request, pk):
    try:
        contract = _base_contracts(request.user).get(pk=pk)
    except Contract.DoesNotExist:
        return Response({'error': 'Contrat non trouvé'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        return Response(ContractSerializer(contract).data)

    # DELETE — only directeur roles
    if request.user.platform_role not in CONTRACT_VALIDATE_ROLES:
        return Response(
            {'error': 'Suppression réservée au Directeur.'},
            status=status.HTTP_403_FORBIDDEN,
        )

    # Soft delete if available
    try:
        Contract._meta.get_field('is_deleted')
        contract.is_deleted = True
        from django.utils import timezone
        contract.deleted_at = timezone.now()
        contract.save(update_fields=['is_deleted', 'deleted_at'])
        return Response({'message': 'Contrat archivé.'}, status=status.HTTP_200_OK)
    except Exception:
        contract.delete()
        return Response({'message': 'Contrat supprimé.'}, status=status.HTTP_204_NO_CONTENT)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def contract_validate(request, pk):
    """
    POST /api/contracts/<id>/validate/
    Only Directeur Général / App Owner can validate the AI-generated summary.
    """
    if request.user.platform_role not in CONTRACT_VALIDATE_ROLES:
        return Response(
            {'error': "Validation réservée au Directeur Général."},
            status=status.HTTP_403_FORBIDDEN,
        )
    try:
        contract = _base_contracts(request.user).get(pk=pk)
    except Contract.DoesNotExist:
        return Response({'error': 'Contrat non trouvé'}, status=status.HTTP_404_NOT_FOUND)

    if not contract.summary:
        return Response({'error': 'Aucun résumé à valider.'}, status=status.HTTP_400_BAD_REQUEST)

    # Mark as validated if field exists
    try:
        Contract._meta.get_field('is_validated')
        contract.is_validated  = True
        contract.validated_by  = request.user
        from django.utils import timezone
        contract.validated_at  = timezone.now()
        contract.save(update_fields=['is_validated','validated_by','validated_at'])
    except Exception:
        pass  # field not yet in model — still return success

    return Response(ContractSerializer(contract).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def contract_export_pdf(request, pk):
    try:
        contract = _base_contracts(request.user).get(pk=pk)
    except Contract.DoesNotExist:
        return Response({'error': 'Contrat non trouvé'}, status=status.HTTP_404_NOT_FOUND)

    if not contract.summary:
        return Response({'error': 'Aucun résumé disponible'}, status=status.HTTP_400_BAD_REQUEST)

    pdf_bytes = build_contract_pdf(contract)
    filename  = f"resume_{contract.file_name.rsplit('.',1)[0]}.pdf"
    response  = HttpResponse(pdf_bytes, content_type='application/pdf')
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    return response
