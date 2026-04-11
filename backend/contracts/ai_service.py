import anthropic
import json
import re
import unicodedata
import pytesseract
from pdf2image import convert_from_path
from django.conf import settings
import pdfplumber
import os

# ==========================================================
# CONFIGURATION SYSTÈME (MAC HOBREBREW)
# ==========================================================
# Chemin par défaut de Tesseract installé via Homebrew sur Apple Silicon
pytesseract.pytesseract.tesseract_cmd = r'/opt/homebrew/bin/tesseract'

# ==========================================================
# EXTRACTION DE TEXTE
# ==========================================================

def extract_text_with_ocr(file_path):
    """
    Analyse le PDF page par page. Si une page contient peu de texte 
    (cas d'un scan), déclenche l'OCR Tesseract.
    """
    full_text = []
    try:
        with pdfplumber.open(file_path) as pdf:
            for i, page in enumerate(pdf.pages):
                page_text = page.extract_text() or ""
                
                # SEUIL : Si moins de 150 caractères, on considère que c'est une image
                if len(page_text.strip()) < 150:
                    # Conversion de la page en image (DPI 300 pour la précision)
                    images = convert_from_path(file_path, first_page=i+1, last_page=i+1)
                    if images:
                        ocr_text = pytesseract.image_to_string(images[0], lang='fra')
                        page_text = ocr_text
                
                full_text.append(f"--- PAGE {i+1} ---\n{page_text}")
    except Exception as e:
        raise Exception(f"Erreur lors de l'extraction OCR : {str(e)}")
    
    return "\n".join(full_text)

# Alias pour la compatibilité avec views.py
extract_text_from_pdf = extract_text_with_ocr

def extract_text_from_docx(file_path):
    """
    Placeholder pour l'extraction DOCX (à adapter selon votre lib habituelle, 
    par exemple python-docx ou docx2txt).
    """
    # Exemple minimal :
    # import docx2txt
    # return docx2txt.process(file_path)
    return "Contenu DOCX non implémenté"

# ==========================================================
# TRAITEMENT DU CONTEXTE (ANTI-TUNNELING & DIVERSITÉ)
# ==========================================================

def normalize(text):
    """Supprime les accents et met en minuscule pour faciliter la recherche."""
    return ''.join(
        c for c in unicodedata.normalize('NFD', text)
        if unicodedata.category(c) != 'Mn'
    ).lower()

def build_contract_context(text):
    """
    Optimise le texte pour l'IA : garde le début (données admin) 
    et extrait les zones riches en mots-clés dans le reste du document.
    """
    KEYWORDS = {
        "maitre", "ouvrage", "entrepreneur", "titulaire", "montant", "prix", 
        "fcfa", "xof", "eur", "tva", "exonere", "delai", "notification", 
        "signature", "approbation", "dnh", "kfw", "n°", "reference"
    }
    
    lines = text.split("\n")
    included = set()
    result_lines = []
    context_window = 12 # Lignes de contexte autour du mot-clé

    # 1. On garde toujours les 50 premières pages (coeur du contrat)
    header_end_marker = "--- PAGE 51 ---"
    if header_end_marker in text:
        header_content = text.split(header_end_marker)[0]
    else:
        header_content = text[:60000] # Sécurité si document court

    # 2. On scanne le reste pour trouver des extraits pertinents (Annexes, Arrêtés)
    for i, line in enumerate(lines):
        norm_line = normalize(line)
        if any(kw in norm_line for kw in KEYWORDS):
            start = max(0, i - context_window)
            end = min(len(lines), i + context_window + 1)
            for j in range(start, end):
                if j not in included:
                    result_lines.append(lines[j])
                    included.add(j)

    final_context = header_content + "\n\n=== EXTRAITS PERTINENTS DES ANNEXES ===\n" + "\n".join(result_lines)
    return final_context[:180000] # Limite Claude pour éviter les erreurs de token

# ==========================================================
# LOGIQUE IA & JSON REPAIR
# ==========================================================

def _clean_response(text):
    """Extrait le bloc JSON pur d'une réponse de l'IA."""
    match = re.search(r'(\{.*\})', text, re.DOTALL)
    return match.group(1) if match else text

def _parse_json_with_repair(client, json_str):
    """Tente de parser le JSON. En cas d'erreur, demande à l'IA de le réparer."""
    try:
        return json.loads(json_str)
    except json.JSONDecodeError:
        repair_message = client.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=4000,
            system="Tu es un expert en réparation de JSON. Réponds UNIQUEMENT avec le code JSON corrigé.",
            messages=[{"role": "user", "content": f"Répare ce JSON invalide : {json_str}"}]
        )
        return json.loads(_clean_response(repair_message.content[0].text))

SUMMARY_PROMPT = """Tu es un expert juridique spécialisé en marchés publics BTP.
Analyse le document fourni pour extraire les informations clés. 
IMPORTANT : 
- Si la page de garde est incomplète, cherche dans la 'Notification d'Attribution' ou l' 'Acte d'Engagement'.
- Le numéro de marché est souvent sur un tampon (ex: 000123/DNH).
- Identifie si le marché est Hors Taxe (HT) ou Toutes Taxes Comprises (TTC).

DOCUMENT :
{contract_text}

Retourne UNIQUEMENT un JSON structuré avec 'section1' (données générales) et 'section2' (données financières)."""

def process_contract_file(file_path, file_type):
    """Point d'entrée principal pour le traitement d'un fichier."""
    # 1. Extraction
    if file_type == 'pdf':
        text = extract_text_with_ocr(file_path)
    else:
        text = extract_text_from_docx(file_path)

    # 2. Préparation du contexte
    contract_context = build_contract_context(text)
    
    # 3. Appel API Anthropic
    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    
    message = client.messages.create(
        model="claude-3-5-sonnet-20241022",
        max_tokens=8192,
        system="Tu es un expert juridique BTP. Réponds UNIQUEMENT en JSON.",
        messages=[{"role": "user", "content": SUMMARY_PROMPT.format(contract_text=contract_context)}]
    )

    # 4. Nettoyage et Parsing
    raw_json = _clean_response(message.content[0].text)
    summary_data = _parse_json_with_repair(client, raw_json)
    
    total_tokens = message.usage.input_tokens + message.usage.output_tokens
    
    return summary_data, total_tokens