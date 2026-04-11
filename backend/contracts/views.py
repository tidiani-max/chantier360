from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.http import HttpResponse, StreamingHttpResponse
import json

from .models import Contract
from .serializers import ContractSerializer
from .ai_service import process_contract_file, build_contract_context, SUMMARY_PROMPT, extract_text_from_pdf, extract_text_from_docx
from .pdf_export import build_contract_pdf
from projects.models import Project


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def contract_list(request):
    if request.method == 'GET':
        contracts = Contract.objects.filter(company=request.user)
        project_id = request.query_params.get('project')
        if project_id:
            contracts = contracts.filter(project_id=project_id)
        return Response(ContractSerializer(contracts, many=True).data)

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
            return Response({'error': 'Format non supporté'}, status=status.HTTP_400_BAD_REQUEST)

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
            summary, _ = process_contract_file(contract.file.path, file_type)
            contract.summary = summary
            contract.is_processing = False
            contract.save()
            return Response({
                'message': 'Contrat analysé avec succès',
                'contract': ContractSerializer(contract).data
            }, status=status.HTTP_201_CREATED)
        except Exception as e:
            import traceback; traceback.print_exc()
            contract.is_processing = False
            contract.save()
            return Response(
                {'error': f"Erreur lors de l'analyse: {str(e)}", 'contract_id': str(contract.id)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def contract_upload_stream(request):
    """Upload contract and stream AI analysis progress via SSE."""
    from django.conf import settings
    import anthropic

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
        return Response({'error': 'Format non supporté'}, status=status.HTTP_400_BAD_REQUEST)

    project = None
    if project_id:
        try:
            project = Project.objects.get(pk=project_id, company=request.user)
        except Project.DoesNotExist:
            return Response({'error': 'Projet non trouvé'}, status=status.HTTP_404_NOT_FOUND)

    # Save contract record
    contract = Contract.objects.create(
        company=request.user,
        project=project,
        file=file,
        file_name=file.name,
        file_type=file_type,
        file_size=file.size,
        is_processing=True,
    )

    def event_stream():
        try:
            # Step 1
            yield f"data: {json.dumps({'type': 'progress', 'message': '📄 Extraction du texte...', 'percent': 10})}\n\n"

            
            if file_type == 'pdf':
                text = extract_text_from_pdf(contract.file.path)
            else:
                text = extract_text_from_docx(contract.file.path)

            if not text.strip():
                yield f"data: {json.dumps({'type': 'error', 'message': 'Impossible d extraire le texte'})}\n\n"
                return

            # Step 2
            yield f"data: {json.dumps({'type': 'progress', 'message': '🔍 Analyse des clauses contractuelles...', 'percent': 25})}\n\n"
            chunked_text = build_contract_context(text)

            # Step 3 — stream from Claude
            yield f"data: {json.dumps({'type': 'progress', 'message': '🤖 L IA analyse votre contrat...', 'percent': 40})}\n\n"

            client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
            full_response = ""

            with client.messages.stream(
                model="claude-sonnet-4-6",
                max_tokens=16000,
                system="Tu es un expert juridique. Réponds UNIQUEMENT avec du JSON valide et complet. Ne tronque jamais ta réponse.",
                messages=[{"role": "user", "content": SUMMARY_PROMPT.format(contract_text=chunked_text)}]
            ) as stream:
                char_count = 0
                for text_chunk in stream.text_stream:
                    full_response += text_chunk
                    char_count += len(text_chunk)

                    # Send streaming text to frontend
                    yield f"data: {json.dumps({'type': 'stream', 'chunk': text_chunk})}\n\n"

                    # Update progress based on chars received
                    if char_count > 500:
                        percent = min(90, 40 + int((char_count / 8000) * 50))
                        yield f"data: {json.dumps({'type': 'progress', 'message': '🤖 Extraction des clauses en cours...', 'percent': percent})}\n\n"

            # Step 4 — parse JSON
            yield f"data: {json.dumps({'type': 'progress', 'message': '✅ Finalisation du résumé...', 'percent': 95})}\n\n"

            clean_text = full_response.strip()
            clean_text = __import__('re').sub(r'```json?\n?', '', clean_text)
            clean_text = clean_text.replace('```', '').strip()

            from .ai_service import _parse_json_with_repair
            _repair_client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
            summary_data = _parse_json_with_repair(_repair_client, clean_text)

            # Save to DB
            contract.summary = summary_data
            contract.is_processing = False
            contract.save()

            # Send final result
            yield f"data: {json.dumps({'type': 'done', 'percent': 100, 'contract': ContractSerializer(contract).data})}\n\n"

        except Exception as e:
            import traceback
            traceback.print_exc()
            contract.is_processing = False
            contract.save()
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    response = StreamingHttpResponse(event_stream(), content_type='text/event-stream')
    response['Cache-Control'] = 'no-cache'
    response['X-Accel-Buffering'] = 'no'
    return response


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


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def contract_export_pdf(request, pk):
    try:
        contract = Contract.objects.get(pk=pk, company=request.user)
    except Contract.DoesNotExist:
        return Response({'error': 'Contrat non trouvé'}, status=status.HTTP_404_NOT_FOUND)

    if not contract.summary:
        return Response({'error': 'Aucun résumé disponible'}, status=status.HTTP_400_BAD_REQUEST)

    pdf_bytes = build_contract_pdf(contract)
    filename = f"resume_{contract.file_name.rsplit('.', 1)[0]}.pdf"
    response = HttpResponse(pdf_bytes, content_type='application/pdf')
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    return response