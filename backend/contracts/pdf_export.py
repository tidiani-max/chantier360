from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, KeepTogether
)
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
from reportlab.pdfgen import canvas as pdfcanvas
import io

GOLD        = colors.HexColor("#F59E0B")
GOLD_DARK   = colors.HexColor("#D97706")
GOLD_LIGHT  = colors.HexColor("#FEF3C7")
DARK        = colors.HexColor("#0D0D1A")
DARK_2      = colors.HexColor("#1A1A2E")
DARK_3      = colors.HexColor("#16213E")
GRAY        = colors.HexColor("#6B7280")
GRAY_LIGHT  = colors.HexColor("#9CA3AF")
WHITE       = colors.white
SUCCESS     = colors.HexColor("#10B981")

PAGE_W, PAGE_H = A4
MARGIN = 18 * mm


def val(v):
    if not v or str(v).strip().lower() in ("", "null", "none", "non mentionné"):
        return "Non mentionné"
    return str(v)


def clean(text):
    return (str(text)
            .replace("‰", "1/1000")
            .replace("œ", "oe")
            .replace("Œ", "OE")
            .replace("–", "-")
            .replace("—", "-")
            .replace("“", '"')
            .replace("”", '"')
            .replace("‘", "'")
            .replace("’", "'")
            .replace("…", "...")
            .replace("•", "-"))


class NumberedCanvas(pdfcanvas.Canvas):
    def __init__(self, *args, **kwargs):
        pdfcanvas.Canvas.__init__(self, *args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for i, state in enumerate(self._saved_page_states):
            self.__dict__.update(state)
            self._draw_footer(i + 1, num_pages)
            pdfcanvas.Canvas.showPage(self)
        pdfcanvas.Canvas.save(self)

    def _draw_footer(self, page_num, page_count):
        self.setFillColor(DARK_2)
        self.rect(0, 0, PAGE_W, 14 * mm, fill=1, stroke=0)
        self.setFillColor(GOLD)
        self.rect(0, 13.5 * mm, PAGE_W, 1, fill=1, stroke=0)
        self.setFillColor(GRAY)
        self.setFont("Helvetica", 7.5)
        self.drawString(MARGIN, 5 * mm, "Chantier360 - Plateforme de gestion BTP Mali")
        self.drawRightString(PAGE_W - MARGIN, 5 * mm, "Document confidentiel")
        self.setFillColor(GOLD)
        self.setFont("Helvetica-Bold", 8)
        self.drawCentredString(PAGE_W / 2, 5 * mm, f"{page_num} / {page_count}")


def build_contract_pdf(contract) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        leftMargin=MARGIN, rightMargin=MARGIN,
        topMargin=MARGIN, bottomMargin=22 * mm,
        title=f"Resume Contrat - {contract.file_name}",
        author="Chantier360",
    )

    s_label = ParagraphStyle("Label",
        fontName="Helvetica-Bold", fontSize=7.5,
        textColor=GOLD_DARK, spaceAfter=2, leading=10,
        letterSpacing=0.5)
    s_value = ParagraphStyle("Value",
        fontName="Helvetica", fontSize=9.5,
        textColor=DARK, spaceAfter=6, leading=13)
    s_value_none = ParagraphStyle("ValueNone",
        fontName="Helvetica-Oblique", fontSize=9,
        textColor=GRAY, spaceAfter=6, leading=13)
    s_section_title = ParagraphStyle("SectionTitle",
        fontName="Helvetica-Bold", fontSize=11,
        textColor=WHITE, spaceAfter=0, leading=14)
    s_footer_note = ParagraphStyle("FooterNote",
        fontName="Helvetica-Oblique", fontSize=8,
        textColor=GRAY, alignment=TA_CENTER, leading=11)

    story = []
    summary   = contract.summary or {}
    s1        = summary.get("section1", {})
    s2        = summary.get("section2", {})
    parties   = s1.get("parties_prenantes", {})
    perimetre = s1.get("duree_perimetre", {})
    admin     = s2.get("infos_administratives", {})
    finances  = s2.get("conditions_financieres", {})
    oblig     = s2.get("obligations_parties", {})
    suivi     = s2.get("suivi_reception", {})
    clauses   = s2.get("clauses_particulieres", {})

    content_w = PAGE_W - 2 * MARGIN

    header_inner = [[
        Table([[Paragraph("<b>C</b>", ParagraphStyle("LogoLetter",
            fontName="Helvetica-Bold", fontSize=26, textColor=GOLD,
            alignment=TA_CENTER))]],
            colWidths=[14*mm], rowHeights=[14*mm],
            style=TableStyle([
                ("BACKGROUND", (0,0), (-1,-1), DARK_3),
                ("ALIGN", (0,0), (-1,-1), "CENTER"),
                ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
            ])),
        Table([
            [Paragraph('CHANTIER<font color="#F59E0B">360</font>',
                ParagraphStyle("Brand", fontName="Helvetica-Bold",
                    fontSize=20, textColor=WHITE, leading=22))],
            [Paragraph("RESUME DE CONTRAT BTP",
                ParagraphStyle("Sub", fontName="Helvetica",
                    fontSize=9, textColor=GOLD, leading=12))],
        ], colWidths=[content_w - 40*mm],
        style=TableStyle([
            ("LEFTPADDING", (0,0), (-1,-1), 0),
            ("RIGHTPADDING", (0,0), (-1,-1), 0),
            ("TOPPADDING", (0,0), (-1,-1), 0),
            ("BOTTOMPADDING", (0,0), (-1,-1), 2),
        ])),
        Table([
            [Paragraph("DOCUMENT", ParagraphStyle("BadgeTop",
                fontName="Helvetica-Bold", fontSize=7,
                textColor=GOLD, alignment=TA_CENTER))],
            [Paragraph("CONFIDENTIEL", ParagraphStyle("BadgeBot",
                fontName="Helvetica-Bold", fontSize=7,
                textColor=GRAY_LIGHT, alignment=TA_CENTER))],
        ], colWidths=[30*mm],
        style=TableStyle([
            ("BACKGROUND", (0,0), (-1,-1), DARK_3),
            ("ALIGN", (0,0), (-1,-1), "CENTER"),
            ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
            ("TOPPADDING", (0,0), (-1,-1), 6),
            ("BOTTOMPADDING", (0,0), (-1,-1), 6),
        ])),
    ]]
    header_table = Table(header_inner,
        colWidths=[16*mm, content_w - 50*mm, 32*mm])
    header_table.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), DARK),
        ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
        ("LEFTPADDING", (0,0), (-1,-1), 10),
        ("RIGHTPADDING", (0,0), (-1,-1), 10),
        ("TOPPADDING", (0,0), (-1,-1), 14),
        ("BOTTOMPADDING", (0,0), (-1,-1), 14),
        ("LINEBELOW", (0,0), (-1,0), 2, GOLD),
    ]))
    story.append(header_table)

    fname_table = Table([[
        Paragraph(f"Fichier : {clean(contract.file_name)}",
            ParagraphStyle("FName", fontName="Helvetica", fontSize=8.5,
                textColor=GRAY_LIGHT, leading=11)),
        Paragraph(f"Type : {contract.file_type.upper()}",
            ParagraphStyle("FType", fontName="Helvetica-Bold", fontSize=8.5,
                textColor=GOLD, leading=11, alignment=TA_RIGHT)),
    ]], colWidths=[content_w * 0.7, content_w * 0.3])
    fname_table.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), DARK_3),
        ("TOPPADDING", (0,0), (-1,-1), 6),
        ("BOTTOMPADDING", (0,0), (-1,-1), 6),
        ("LEFTPADDING", (0,0), (-1,-1), 10),
        ("RIGHTPADDING", (0,0), (-1,-1), 10),
    ]))
    story.append(fname_table)
    story.append(Spacer(1, 5*mm))

    def section_header(number, title, color=GOLD):
        header = Table([[
            Paragraph(f"<b>{number}</b>",
                ParagraphStyle("SecNum", fontName="Helvetica-Bold",
                    fontSize=13, textColor=color, leading=16)),
            Paragraph(f"<b>{title}</b>", s_section_title),
        ]], colWidths=[10*mm, content_w - 10*mm])
        header.setStyle(TableStyle([
            ("BACKGROUND", (0,0), (-1,-1), DARK),
            ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
            ("TOPPADDING", (0,0), (-1,-1), 9),
            ("BOTTOMPADDING", (0,0), (-1,-1), 9),
            ("LEFTPADDING", (0,0), (0,0), 10),
            ("LEFTPADDING", (1,0), (1,0), 4),
            ("LINEBELOW", (0,0), (-1,-1), 2, color),
        ]))
        story.append(KeepTogether([header, Spacer(1, 3*mm)]))

    def two_col_fields(pairs):
        rows = []
        for i in range(0, len(pairs), 2):
            lbl1, raw1 = pairs[i]
            lbl2, raw2 = pairs[i+1] if i+1 < len(pairs) else ("", "")
            v1 = val(raw1)
            v2 = val(raw2)
            cell1 = Table(
                [[Paragraph(clean(lbl1), s_label)],
                 [Paragraph(clean(v1), s_value_none if v1 == "Non mentionné" else s_value)]],
                colWidths=[(content_w/2) - 4*mm])
            cell1.setStyle(TableStyle([("LEFTPADDING",(0,0),(-1,-1),0),("RIGHTPADDING",(0,0),(-1,-1),0),("TOPPADDING",(0,0),(-1,-1),0),("BOTTOMPADDING",(0,0),(-1,-1),0)]))
            cell2 = Table(
                [[Paragraph(clean(lbl2), s_label)],
                 [Paragraph(clean(v2), s_value_none if v2 == "Non mentionné" else s_value)]],
                colWidths=[(content_w/2) - 4*mm])
            cell2.setStyle(TableStyle([("LEFTPADDING",(0,0),(-1,-1),0),("RIGHTPADDING",(0,0),(-1,-1),0),("TOPPADDING",(0,0),(-1,-1),0),("BOTTOMPADDING",(0,0),(-1,-1),0)]))
            rows.append([cell1, cell2])
        if not rows:
            return
        grid = Table(rows, colWidths=[content_w/2, content_w/2])
        grid.setStyle(TableStyle([
            ("BACKGROUND", (0,0), (-1,-1), WHITE),
            ("VALIGN", (0,0), (-1,-1), "TOP"),
            ("LEFTPADDING", (0,0), (-1,-1), 8),
            ("RIGHTPADDING", (0,0), (-1,-1), 8),
            ("TOPPADDING", (0,0), (-1,-1), 7),
            ("BOTTOMPADDING", (0,0), (-1,-1), 7),
            ("LINEBELOW", (0,0), (-1,-2), 0.3, colors.HexColor("#E5E7EB")),
            ("LINEBEFORE", (1,0), (1,-1), 0.3, colors.HexColor("#E5E7EB")),
        ]))
        story.append(grid)
        story.append(Spacer(1, 3*mm))

    def full_field(label, value):
        v = val(value)
        container = Table([
            [Paragraph(clean(label), s_label)],
            [Paragraph(clean(v), s_value_none if v == "Non mentionné" else s_value)],
        ], colWidths=[content_w])
        container.setStyle(TableStyle([
            ("BACKGROUND", (0,0), (-1,-1), WHITE),
            ("LEFTPADDING", (0,0), (-1,-1), 8),
            ("RIGHTPADDING", (0,0), (-1,-1), 8),
            ("TOPPADDING", (0,0), (-1,-1), 7),
            ("BOTTOMPADDING", (0,0), (-1,-1), 7),
            ("LINEBELOW", (0,0), (-1,-1), 0.3, colors.HexColor("#E5E7EB")),
        ]))
        story.append(container)

    def highlight_field(label, value):
        v = val(value)
        container = Table([
            [Paragraph(clean(label), ParagraphStyle("HLabel",
                fontName="Helvetica-Bold", fontSize=7.5,
                textColor=GOLD_DARK, leading=10))],
            [Paragraph(clean(v), ParagraphStyle("HValue",
                fontName="Helvetica-Bold", fontSize=10.5,
                textColor=DARK if v != "Non mentionné" else GRAY, leading=13))],
        ], colWidths=[(content_w/2) - 4*mm])
        container.setStyle(TableStyle([
            ("BACKGROUND", (0,0), (-1,-1), GOLD_LIGHT),
            ("LEFTPADDING", (0,0), (-1,-1), 10),
            ("RIGHTPADDING", (0,0), (-1,-1), 10),
            ("TOPPADDING", (0,0), (-1,-1), 8),
            ("BOTTOMPADDING", (0,0), (-1,-1), 8),
            ("LINEBELOW", (0,0), (-1,-1), 1.5, GOLD),
        ]))
        return container

    section_header("1", "PRESENTATION GENERALE ET CONTEXTE")
    full_field("Objet du contrat", s1.get("objet_contrat"))
    full_field("Contexte et objectifs", s1.get("contexte_objectifs"))
    story.append(Spacer(1, 2*mm))
    two_col_fields([
        ("Maitre d ouvrage",        parties.get("maitre_ouvrage")),
        ("Maitre d oeuvre",         parties.get("maitre_oeuvre")),
        ("Entreprise / Groupement", parties.get("entreprise_groupement")),
        ("Sous-traitants",          parties.get("sous_traitants")),
        ("Lot(s) concerne(s)",      perimetre.get("lots")),
        ("Localisation",            perimetre.get("localisation")),
        ("Type de travaux",         perimetre.get("type_travaux")),
        ("Delai d execution",       perimetre.get("delai_execution")),
        ("Date de demarrage",       perimetre.get("date_demarrage")),
        ("Ordre de service",        perimetre.get("ordre_de_service")),
    ])

    section_header("2A", "INFORMATIONS ADMINISTRATIVES")
    two_col_fields([
        ("Numero du marche",       admin.get("numero_reference")),
        ("N Approbation DNCMP",    admin.get("numero_approbation")),
        ("Type de marche",         admin.get("type_marche")),
        ("Mode de passation",      admin.get("mode_passation")),
        ("Date de notification",   admin.get("date_notification")),
        ("Source de financement",  admin.get("source_financement")),
        ("Tribunal competent",     admin.get("tribunal_competent")),
    ])

    section_header("2B", "CONDITIONS FINANCIERES", color=SUCCESS)
    fin_row = Table([[
        highlight_field("Montant HT", finances.get("montant_ht")),
        Spacer(8*mm, 1),
        highlight_field("Montant TTC", finances.get("montant_ttc")),
    ]], colWidths=[(content_w/2)-4*mm, 8*mm, (content_w/2)-4*mm])
    fin_row.setStyle(TableStyle([
        ("VALIGN", (0,0), (-1,-1), "TOP"),
        ("LEFTPADDING", (0,0), (-1,-1), 0),
        ("RIGHTPADDING", (0,0), (-1,-1), 0),
        ("TOPPADDING", (0,0), (-1,-1), 0),
        ("BOTTOMPADDING", (0,0), (-1,-1), 0),
    ]))
    story.append(fin_row)
    story.append(Spacer(1, 3*mm))
    two_col_fields([
        ("Taux TVA",                finances.get("taux_tva")),
        ("Revision des prix",       finances.get("revision_prix")),
        ("Caution bonne execution", finances.get("caution_bonne_execution")),
        ("Retenue de garantie",     finances.get("retenue_garantie")),
    ])
    full_field("Conditions de paiement", finances.get("conditions_paiement"))

    section_header("2C", "OBLIGATIONS DES PARTIES")
    full_field("Obligations du Maitre d ouvrage", oblig.get("maitre_ouvrage"))
    full_field("Obligations du Maitre d oeuvre",  oblig.get("maitre_oeuvre"))
    full_field("Obligations de l Entreprise",     oblig.get("entreprise"))

    section_header("2D", "SUIVI ET RECEPTION")
    two_col_fields([
        ("Reception provisoire", suivi.get("reception_provisoire")),
        ("Reception definitive", suivi.get("reception_definitive")),
    ])
    full_field("Mecanismes de supervision", suivi.get("supervision"))

    section_header("2E", "CLAUSES PARTICULIERES")
    full_field("Penalites de retard",       clauses.get("penalites_retard"))
    full_field("Conditions de resiliation", clauses.get("conditions_resiliation"))
    full_field("Reglement des litiges",     clauses.get("reglement_litiges"))

    story.append(Spacer(1, 6*mm))
    story.append(HRFlowable(width="100%", thickness=0.5, color=GRAY))
    story.append(Spacer(1, 3*mm))
    story.append(Paragraph(
        "Ce document est un resume genere automatiquement par l IA Chantier360. "
        "Les dispositions du contrat original font foi en cas de divergence.",
        s_footer_note))

    doc.build(story, canvasmaker=NumberedCanvas)
    buffer.seek(0)
    return buffer.read()
