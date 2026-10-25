"""TerraShift AI — Senior Design Project Report (100-Page PDF Generator).

Compiles the university senior thesis into a publication-grade, professionally styled
PDF report using ReportLab, meeting the 100-page university defense requirement.

Title:
TerraShift AI: An AI-Assisted Geospatial Platform for Satellite-Based Land-Surface
Change Detection and Environmental Monitoring in Saudi Arabia

Subtitle:
A Comparative Evaluation of AlphaEarth Foundation-Model Embeddings,
Deep-Learning Segmentation, and Multispectral Change Analysis
"""

import os
import re
import sys
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.pdfgen import canvas
from reportlab.platypus import (
    HRFlowable,
    Image,
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

ROOT = Path(__file__).resolve().parent.parent
LATEX_DIR = ROOT / "reports" / "senior_project" / "latex"
FIG_DIR = ROOT / "reports" / "senior_project" / "figures"
DIAG_DIR = ROOT / "reports" / "visual_diagnostics"
OUTPUT_PDF = ROOT / "reports" / "senior_project" / "TerraShift_Senior_Project_Report.pdf"

sys.path.insert(0, str(Path(__file__).resolve().parent))
from report_data import (
    ALJOUF_CASE_STUDY_ROWS,
    ALKHARJ_CASE_STUDY_ROWS,
    API_ENDPOINTS_ROWS,
    APPENDIX_B_SCORECARD_ROWS,
    COMPONENT_INTERACTION_ROWS,
    CONFUSION_MATRIX_ALJOUF_ROWS,
    CONFUSION_MATRIX_ALKHARJ_ROWS,
    CONFUSION_MATRIX_JEDDAH_ROWS,
    CONFUSION_MATRIX_RIYADH_ROWS,
    DEFENSE_QA_PAIRS,
    DEPLOYMENT_ENV_ROWS,
    DEPLOYMENT_PREREQS_ROWS,
    JEDDAH_CASE_STUDY_ROWS,
    LOCALIZATION_SENSITIVITY_ROWS,
    RIYADH_CASE_STUDY_ROWS,
    SSE_STATE_TRANSITIONS_ROWS,
    VERIFICATION_CHECKLIST_ROWS,
)


class NumberedCanvas(canvas.Canvas):
    """Two-pass canvas to dynamically compute and print 'Page X of Y' in footers,
    along with running chapter headers and university watermark rules."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, total_pages: int):
        # Suppress headers and footers on the cover page (Page 1)
        if self._pageNumber == 1:
            return

        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#555555"))

        # Running Header (Pages >= 2)
        self.setStrokeColor(colors.HexColor("#D0D7DE"))
        self.setLineWidth(0.5)
        self.line(54, A4[1] - 40, A4[0] - 54, A4[1] - 40)

        header_text = "TerraShift AI — Senior Design Project Report (Academic Year 2025–2026)"
        if self._pageNumber <= 13:
            header_text = "TerraShift AI — Front Matter"
        self.drawString(54, A4[1] - 35, header_text)
        self.drawRightString(A4[0] - 54, A4[1] - 35, "College of Computer & Information Sciences")

        # Running Footer
        self.line(54, 42, A4[0] - 54, 42)
        footer_caption = "Omar Ayyash (ID: S22107722) · Kingdom of Saudi Arabia · Vision 2030 Geospatial AI Monitoring"
        self.drawString(54, 30, footer_caption)

        page_str = f"Page {self._pageNumber} of {total_pages}"
        self.drawRightString(A4[0] - 54, 30, page_str)

        self.restoreState()


def get_custom_styles():
    styles = getSampleStyleSheet()

    navy = colors.HexColor("#1B365D")
    emerald = colors.HexColor("#0B6623")
    charcoal = colors.HexColor("#222222")

    styles.add(
        ParagraphStyle(
            "CoverUniv",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=12,
            leading=16,
            alignment=TA_CENTER,
            textColor=navy,
            spaceAfter=4,
        )
    )
    styles.add(
        ParagraphStyle(
            "CoverTitle",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=24,
            leading=28,
            alignment=TA_CENTER,
            textColor=navy,
            spaceAfter=12,
        )
    )
    styles.add(
        ParagraphStyle(
            "CoverSubtitle",
            parent=styles["Normal"],
            fontName="Helvetica-Oblique",
            fontSize=13,
            leading=18,
            alignment=TA_CENTER,
            textColor=emerald,
            spaceAfter=24,
        )
    )
    styles.add(
        ParagraphStyle(
            "CoverMeta",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=10.5,
            leading=15,
            alignment=TA_CENTER,
            textColor=charcoal,
            spaceAfter=6,
        )
    )

    styles.add(
        ParagraphStyle(
            "ReportChapTitle",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=22.5,
            leading=28.0,
            textColor=navy,
            spaceBefore=24,
            spaceAfter=18,
            keepWithNext=True,
        )
    )
    styles.add(
        ParagraphStyle(
            "ReportSecTitle",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=14.5,
            leading=20.0,
            textColor=navy,
            spaceBefore=20,
            spaceAfter=10,
            keepWithNext=True,
        )
    )
    styles.add(
        ParagraphStyle(
            "ReportSubSecTitle",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=12.5,
            leading=17.5,
            textColor=emerald,
            spaceBefore=16,
            spaceAfter=8,
            keepWithNext=True,
        )
    )
    styles.add(
        ParagraphStyle(
            "ReportBody",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=11.0,
            leading=18.5,
            alignment=TA_JUSTIFY,
            textColor=charcoal,
            spaceAfter=10.0,
        )
    )
    styles.add(
        ParagraphStyle(
            "ReportBodyIndent",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=11.0,
            leading=18.5,
            alignment=TA_JUSTIFY,
            firstLineIndent=20,
            textColor=charcoal,
            spaceAfter=10.0,
        )
    )
    styles.add(
        ParagraphStyle(
            "ReportEquation",
            parent=styles["Normal"],
            fontName="Courier-Oblique",
            fontSize=10.0,
            leading=15.0,
            alignment=TA_CENTER,
            textColor=colors.HexColor("#0D233A"),
            spaceBefore=8,
            spaceAfter=9,
        )
    )
    styles.add(
        ParagraphStyle(
            "CalloutBoxText",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=9.5,
            leading=14.5,
            textColor=colors.HexColor("#1A2E40"),
        )
    )
    styles.add(
        ParagraphStyle(
            "TableHead",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=8.5,
            leading=11.5,
            textColor=colors.white,
            alignment=TA_CENTER,
        )
    )
    styles.add(
        ParagraphStyle(
            "TableCell",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=8.5,
            leading=11.5,
            textColor=charcoal,
        )
    )
    styles.add(
        ParagraphStyle(
            "TableCellBold",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=8.5,
            leading=11.5,
            textColor=charcoal,
        )
    )
    styles.add(
        ParagraphStyle(
            "TableCellRight",
            parent=styles["Normal"],
            fontName="Helvetica",
            fontSize=8.5,
            leading=11.5,
            alignment=TA_RIGHT,
            textColor=charcoal,
        )
    )
    styles.add(
        ParagraphStyle(
            "TableCaption",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=9.5,
            leading=13,
            alignment=TA_CENTER,
            textColor=navy,
            spaceBefore=8,
            spaceAfter=5,
        )
    )
    styles.add(
        ParagraphStyle(
            "CodeListing",
            parent=styles["Normal"],
            fontName="Courier",
            fontSize=8.0,
            leading=11,
            textColor=colors.HexColor("#1A365D"),
        )
    )

    return styles


ALLOWED_TAGS = {"b", "i", "u", "font", "super", "sub", "para"}


def replace_braced_command(text: str, cmd: str, open_tag: str, close_tag: str) -> str:
    """Find occurrences of \\cmd{...} with balanced braces and replace with open_tag + inner + close_tag."""
    prefix = "\\" + cmd + "{"
    while prefix in text:
        idx = text.find(prefix)
        start_brace = idx + len(prefix) - 1
        depth = 1
        pos = start_brace + 1
        while pos < len(text) and depth > 0:
            if text[pos] == "{":
                depth += 1
            elif text[pos] == "}":
                depth -= 1
            pos += 1
        if depth == 0:
            inner = text[start_brace + 1 : pos - 1]
            text = text[:idx] + open_tag + inner + close_tag + text[pos:]
        else:
            text = text[:idx] + text[start_brace + 1 :]
    return text


def sanitize_reportlab_html(text: str) -> str:
    """Ensure text is strictly safe for ReportLab Paragraph parser.

    - Escapes unescaped &
    - Escapes < and > that are not part of allowed tags
    - Enforces proper LIFO nesting of tags and auto-closes unclosed tags
    """
    text = re.sub(r"&(?!([a-zA-Z]+|#\d+|#x[0-9a-fA-F]+);)", "&amp;", text)
    tag_pattern = re.compile(r"</?([a-zA-Z]+)(?:\s+[^>]*)?>")

    pos = 0
    clean_parts = []
    tag_stack = []

    for m in tag_pattern.finditer(text):
        raw_text = text[pos : m.start()]
        raw_text = raw_text.replace("<", "&lt;").replace(">", "&gt;")
        clean_parts.append(raw_text)

        full_tag = m.group(0)
        tag_name = m.group(1).lower()
        is_closing = full_tag.startswith("</")
        is_self_closing = full_tag.endswith("/>")

        if tag_name not in ALLOWED_TAGS and tag_name != "br":
            clean_parts.append(full_tag.replace("<", "&lt;").replace(">", "&gt;"))
        elif is_self_closing or tag_name == "br":
            clean_parts.append(full_tag)
        elif not is_closing:
            tag_stack.append(tag_name)
            clean_parts.append(full_tag)
        else:
            if tag_name in tag_stack:
                while tag_stack and tag_stack[-1] != tag_name:
                    top = tag_stack.pop()
                    clean_parts.append(f"</{top}>")
                if tag_stack and tag_stack[-1] == tag_name:
                    tag_stack.pop()
                    clean_parts.append(f"</{tag_name}>")
        pos = m.end()

    raw_text = text[pos:].replace("<", "&lt;").replace(">", "&gt;")
    clean_parts.append(raw_text)

    while tag_stack:
        top = tag_stack.pop()
        clean_parts.append(f"</{top}>")

    return "".join(clean_parts)


def clean_latex_math(text: str) -> str:
    """Transform LaTeX math, citations, and formatting to styled plain text/ReportLab tags."""
    text = re.sub(r"\\citep\{([^}]+)\}", r"[\1]", text)
    text = re.sub(r"\\cite\{([^}]+)\}", r"[\1]", text)
    text = re.sub(r"\\citet\{([^}]+)\}", r"\1", text)
    text = re.sub(r"\\ref\{([^}]+)\}", r"[\1]", text)
    text = re.sub(r"\\label\{([^}]+)\}", "", text)

    text = text.replace(r"\text{km}^2", "km²")
    text = text.replace(r"\text{ km}^2", " km²")
    text = text.replace(r"\text{km}^{2}", "km²")
    text = text.replace(r"\text{m}^2", "m²")
    text = text.replace(r"\text{m}", "m")
    text = text.replace(r"\text{s}", "s")
    text = text.replace(r"\text{NDBI}", "NDBI")
    text = text.replace(r"\text{NDVI}", "NDVI")
    text = text.replace(r"\text{built}", "built")
    text = text.replace(r"\text{crops}", "crops")
    text = text.replace(r"\text{cosine}", "cosine")
    text = text.replace(r"\text{change}", "change")

    text = replace_braced_command(text, "text", "", "")
    text = replace_braced_command(text, "textbf", "<b>", "</b>")
    text = replace_braced_command(text, "textit", "<i>", "</i>")
    text = replace_braced_command(text, "emph", "<i>", "</i>")
    text = replace_braced_command(text, "texttt", "<font face='Courier'>", "</font>")

    text = re.sub(r"\*\*([^*]+)\*\*", r"<b>\1</b>", text)

    text = text.replace(r"\Delta", "Δ")
    text = text.replace(r"\tau", "τ")
    text = text.replace(r"\rho", "ρ")
    text = text.replace(r"\lambda", "λ")
    text = text.replace(r"\phi", "φ")
    text = text.replace(r"\theta", "θ")
    text = text.replace(r"\sigma", "σ")
    text = text.replace(r"\alpha", "α")
    text = text.replace(r"\epsilon", "ε")
    text = text.replace(r"\mu", "μ")
    text = text.replace(r"\in", "∈")
    text = text.replace(r"\ge", "≥")
    text = text.replace(r"\le", "≤")
    text = text.replace(r"\times", "×")
    text = text.replace(r"\pm", "±")
    text = text.replace(r"\neq", "≠")
    text = text.replace(r"\approx", "≈")
    text = text.replace(r"\equiv", "≡")
    text = text.replace(r"\land", "∧")
    text = text.replace(r"\lor", "∨")
    text = text.replace(r"\to", "→")
    text = text.replace(r"\dots", "...")
    text = text.replace(r"\cdot", "·")
    text = text.replace(r"\%", "%")
    text = text.replace(r"\_", "_")
    text = text.replace(r"\&", "&")
    text = text.replace(r"\norm{", "||")
    text = text.replace(r"}_2", "||₂")
    text = text.replace(r"_{dist}", " (dist)")
    text = text.replace(r"_{sim}", " (sim)")
    text = text.replace(r"^{T_1}", " (T1)")
    text = text.replace(r"^{T_2}", " (T2)")
    text = text.replace(r"^{63}", "⁶³")
    text = text.replace(r"^2", "²")
    text = text.replace(r"^3", "³")
    text = text.replace(r"\R^{64}", "ℝ⁶⁴")
    text = text.replace(r"\R^{257}", "ℝ²⁵⁷")
    text = text.replace(r"\mathbb{S}^{63}", "𝕊⁶³")
    text = text.replace(r"\mathbb{R}", "ℝ")
    text = text.replace(r"\bm{", "")
    text = text.replace(r"\mathcal{P}", "P(alerts)")
    text = text.replace(r"\mathcal{R}", "R(ground_truth)")

    text = text.replace("$", "")
    text = text.replace("{", "").replace("}", "")

    return sanitize_reportlab_html(text)


def create_callout_box(title: str, text: str, styles, width: float = 487) -> Table:
    """Render a styled colored alert/callout box with left vertical accent bar."""
    content = [
        Paragraph(f"<b>{title}</b>", styles["ReportSubSecTitle"]),
        Spacer(1, 3),
        Paragraph(clean_latex_math(text), styles["CalloutBoxText"]),
    ]
    t = Table([[content]], colWidths=[width])
    t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F0F4F8")),
                ("LINEBEFORE", (0, 0), (0, -1), 3.5, colors.HexColor("#1B365D")),
                ("LEFTPADDING", (0, 0), (-1, -1), 12),
                ("RIGHTPADDING", (0, 0), (-1, -1), 12),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    return t


def create_algorithm_box(title: str, steps: list[str], styles, width: float = 487) -> Table:
    """Render a formal algorithmic specification block with border and line styling."""
    content = [
        Paragraph(f"<b>{title}</b>", styles["ReportSubSecTitle"]),
        Spacer(1, 3),
        HRFlowable(width="100%", thickness=1, color=colors.HexColor("#1B365D"), spaceAfter=5, spaceBefore=2),
    ]
    for step in steps:
        content.append(Paragraph(clean_latex_math(step), styles["CodeListing"]))
    content.append(Spacer(1, 3))
    content.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#CBD5E1"), spaceAfter=3, spaceBefore=3))

    t = Table([[content]], colWidths=[width])
    t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F8FAFC")),
                ("BOX", (0, 0), (-1, -1), 1.0, colors.HexColor("#1B365D")),
                ("LEFTPADDING", (0, 0), (-1, -1), 12),
                ("RIGHTPADDING", (0, 0), (-1, -1), 12),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    return t


def create_takeaway_box(title: str, items: list[str], styles, width: float = 487) -> Table:
    """Render a styled defense takeaway / chapter summary box."""
    content = [
        Paragraph(f"<b>{title}</b>", styles["ReportSubSecTitle"]),
        Spacer(1, 4),
    ]
    for item in items:
        content.append(Paragraph(f"• {clean_latex_math(item)}", styles["CalloutBoxText"]))
        content.append(Spacer(1, 2))

    t = Table([[content]], colWidths=[width])
    t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F0FDF4")),
                ("LINEBEFORE", (0, 0), (0, -1), 3.5, colors.HexColor("#0B6623")),
                ("LEFTPADDING", (0, 0), (-1, -1), 12),
                ("RIGHTPADDING", (0, 0), (-1, -1), 12),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    return t


def create_styled_table(rows: list[list[str]], styles, col_widths: list[float] | None = None) -> Table:
    """Render a structured 2D array of strings as a formal styled ReportLab Table."""
    num_cols = len(rows[0])
    if col_widths is None:
        col_w = 487 / num_cols
        col_widths = [col_w] * num_cols

    table_data = []
    # Header row
    table_data.append([Paragraph(clean_latex_math(c), styles["TableHead"]) for c in rows[0]])
    # Data rows
    for r in rows[1:]:
        table_data.append([Paragraph(clean_latex_math(c), styles["TableCell"]) for c in r])

    t = Table(table_data, colWidths=col_widths)
    t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1B365D")),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#D0D7DE")),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8F9FA")]),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ]
        )
    )
    return t


def create_figure_plate(img_path: Path, caption: str, styles, max_width: float = 485.0, max_height: float = 230.0) -> list:
    """Embed a high-resolution PNG figure with aspect-preserving scaling and formal academic caption."""
    if not img_path.exists():
        return []
    from PIL import Image as PILImage
    with PILImage.open(img_path) as im:
        w, h = im.size
    scale = min(max_width / max(w, 1), max_height / max(h, 1))
    disp_w = w * scale
    disp_h = h * scale
    rl_img = Image(str(img_path), width=disp_w, height=disp_h)
    rl_img.hAlign = "CENTER"
    cap_p = Paragraph(clean_latex_math(caption), styles["TableCaption"])
    box = Table([[rl_img], [cap_p]], colWidths=[487])
    box.setStyle(
        TableStyle(
            [
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#FAFBFD")),
                ("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor("#CBD5E1")),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    return [Spacer(1, 6), KeepTogether([box]), Spacer(1, 8)]


def render_defense_qa_section(qa_pairs: list[tuple[str, str]], styles) -> list:
    """Render the 10 senior project defense questions and answers as styled cards."""
    elements = []
    elements.append(
        Paragraph(
            "8.8 Senior Project Defense Examination: Ten Rigorous Committee Questions & Definitive Answers",
            styles["ReportSecTitle"],
        )
    )
    elements.append(Spacer(1, 6))
    intro_p = "To demonstrate exhaustive mastery of both theoretical remote sensing principles and full-stack software engineering, this section presents ten challenging scientific and architectural questions formulated by the Senior Project Examination Committee, accompanied by rigorous, evidence-grounded answers."
    elements.append(Paragraph(intro_p, styles["ReportBodyIndent"]))
    elements.append(Spacer(1, 10))

    for idx, (q, a) in enumerate(qa_pairs, start=1):
        q_clean = clean_latex_math(q)
        a_clean = clean_latex_math(a)
        content = [
            Paragraph(f"<b>{q_clean}</b>", styles["ReportSubSecTitle"]),
            Spacer(1, 3),
            Paragraph(a_clean, styles["CalloutBoxText"]),
        ]
        t = Table([[content]], colWidths=[487])
        t.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F0F4F8")),
                    ("LINEBEFORE", (0, 0), (0, -1), 3.5, colors.HexColor("#1B365D")),
                    ("LEFTPADDING", (0, 0), (-1, -1), 12),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 12),
                    ("TOPPADDING", (0, 0), (-1, -1), 8),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                ]
            )
        )
        elements.append(t)
        elements.append(Spacer(1, 8))
    return elements


CHAPTER_OVERVIEWS = {
    1: (
        "Chapter 1 Executive Overview: Problem Statement, Research Question, and Vision 2030 Foundations",
        "This opening chapter establishes the operational and scientific context of TerraShift AI within the ambitious framework of Saudi Vision 2030 and the Saudi Green Initiative. We examine the extreme remote sensing challenges imposed by hyper-arid desert terrain—including extreme solar zenith shifts, low dynamic contrast between regolith and concrete, and sabkha moisture fluctuations. We formalize the central research question: Can a physics-guided hybrid architecture combining bitemporal Siamese deep learning, Google AlphaEarth V1 foundation embeddings, and Sentinel-2 L2A physical spectral guards reliably distinguish real urban and agricultural changes from desert background noise using modest CPU hardware? Finally, we articulate five rigorous research objectives and define the Senior Project Defense Readiness Gate Matrix.",
    ),
    2: (
        "Chapter 2 Executive Overview: Classical Paradigms, Siamese Networks, and Foundation Models",
        "This chapter surveys over four decades of remote sensing change detection literature, tracing the algorithmic lineage from classical univariate image differencing and Change Vector Analysis (CVA) to modern deep learning and foundation models. We contrast early-fusion versus late-fusion Siamese convolutional architectures (FC-Siam-diff, FC-Siam-conc) and examine the mathematical implications of weight sharing. We evaluate emerging planetary foundation models—specifically Google AlphaEarth V1 64-D annual embeddings and Dynamic World V1 land-cover probabilities—as well as recent Chinese foundation architectures (SIGMAE, GenCD, CSD-Net, SEED, BTC). The chapter concludes with a 10-system literature comparison matrix and formalizes the three research gaps addressed by this thesis.",
    ),
    3: (
        "Chapter 3 Executive Overview: Stakeholder Requirements, Technical Specifications, and Readiness Gates",
        "This chapter formalizes the functional and non-functional requirements governing TerraShift AI, derived from comprehensive stakeholder analysis across municipal planners, environmental compliance auditors (NCEC, MEWA), and giga-project infrastructure developers (ROSHN). We specify 8 core functional requirements (multispectral acquisition, Siamese inference, AlphaEarth integration, physical spectral filtering, streaming telemetry, interactive cartography, polygonization, and GeoJSON reporting) and 6 non-functional requirements (CPU compute efficiency, sub-2s latency, memory bounds under 500 MB, WCAG AA accessibility, zero cloud keys on client, and complete offline reproducibility). We present the strict Defense Readiness Gate Matrix enforcing university academic standards.",
    ),
    4: (
        "Chapter 4 Executive Overview: Sentinel-2 Multi-Spectral Data, Atmospheric Correction, and Ground Truth",
        "This chapter details the data engineering pipelines feeding TerraShift AI. We analyze the 13 multispectral bands of the Copernicus Sentinel-2 MSI instrument, contrasting Level-1C Top-Of-Atmosphere (TOA) radiance against Level-2A Bottom-Of-Atmosphere (BOA) surface reflectance processed via Sen2Cor. We detail our Scene Classification Layer (SCL) quality filtering algorithm for snow, cloud, and cirrus removal. We describe the authenticated Google Earth Engine extraction pipeline ('project=terrashift', allow_synthetic=False) for Google AlphaEarth V1 64-D latent embeddings and Dynamic World V1 probability cubes. Finally, we formalize the Saudi Reference Benchmark Corridors: 91.19 km² across Riyadh, Jeddah, Al-Jouf, and held-out Al-Kharj, containing 19 coarse parcel-level events and 4 undisturbed negative control zones.",
    ),
    5: (
        "Chapter 5 Executive Overview: Full-Stack Architecture, Streaming Inference, and CPU Optimization",
        "This chapter outlines the complete full-stack architectural implementation of TerraShift AI. We present the microservices topology decoupling the Next.js 16 (App Router) presentation layer from the Python FastAPI machine learning engine. We formalize the Server-Sent Events (SSE) streaming pipeline delivering real-time progress telemetry across acquisition, inference, physical filtering, and polygonization stages. We detail our windowed STAC Cloud-Optimized GeoTIFF (COG) HTTP range reader that fetches sub-meter regional bounding boxes without transferring entire multi-gigabyte satellite granules. Finally, we provide hardware profiling proving pure compute execution of 1.485s and a peak RAM footprint of 301 MB on commodity CPU hardware.",
    ),
    6: (
        "Chapter 6 Executive Overview: Neural Network Architecture, AlphaEarth Models, and Spectral Guards",
        "This chapter presents the mathematical formulation and neural network architecture of TerraShift AI. We derive the Siamese U-Net encoder-decoder network, detailing weight-shared convolutions and multi-scale skip feature difference concatenation. We formulate the compound loss function combining weighted Binary Cross-Entropy with Soft Dice Loss to conquer severe spatial class imbalance. We specify the AlphaEarth V1 and Dynamic World V1 foundation model paradigms and prove the geometric equivalence between cosine dissimilarity and squared Euclidean distance on the unit hypersphere. Finally, we formulate the directional physical spectral guard equations (ΔNDBI ≥ +0.04, |ΔNDVI| ≥ 0.10) and exact WGS84 geodesic clipping that eliminate false alarms caused by regolith albedo drift.",
    ),
    7: (
        "Chapter 7 Executive Overview: Localization-Aware 1-to-1 Matching, Pooled vs. Macro Metrics, and Sensitivity Auditing",
        "This chapter details our rigorous empirical evaluation methodology designed to prevent both polygon fragmentation inflation and sprawling-polygon gaming. We formulate a Localization-Aware Greedy 1-to-1 Bipartite Event-Matching Protocol requiring both physical parcel coverage (RoC ≥ 0.08 or Area ≥ 3,500 m²) and localization purity (PoC ≥ 0.15 and IoU ≥ 0.05, or PoC ≥ 0.30). We define both Pooled (micro) and Corridor Macro-Averaged Precision, Recall, and F1 side-by-side, along with a 4-regime Localization Threshold Sensitivity Sweep (Relaxed, Standard, Moderate, Strict) and Negative Control Zone auditing.",
    ),
    8: (
        "Chapter 8 Executive Overview: Empirical Results, Multi-Model Leaderboard, and Visual Satellite Plates",
        "This chapter delivers the central empirical findings of this thesis. We present reproduction results on the academic OSCD benchmark, followed by the authenticated v6.1 Saudi Deployment Multi-Model Benchmark Leaderboard evaluating all 7 candidate paradigms across 91.19 km² and 19 reference events. We show why TerraShift v6.0 Hybrid (Siamese + AlphaEarth + L2A) achieves Rank #1 with 79.2% Pooled Event F1 (82.5% Macro F1), 65.5% Pooled Precision (70.1% Macro Precision), 100.0% Recall, and 0 Negative Zone hits, while TerraShift v5.1 achieves Rank #2 (53.5% Pooled F1 / 64.1% Macro F1) with 5-day L2A autonomy. Conversely, we prove that standalone Google AlphaEarth V1 achieves only 27.0% Pooled F1 (with 90 false alarms and 23 Negative Control Zone hits) and standalone Dynamic World V1 achieves only 19.7% Pooled F1.",
    ),
    9: (
        "Chapter 9 Executive Overview: Scientific Conclusions, Vision 2030 Impact, and Future Roadmap",
        "The concluding chapter synthesizes the core scientific findings of this senior design project and directly answers our central research question with empirical proof. We demonstrate that neither deep learning alone nor standalone global foundation models (AlphaEarth / Dynamic World) are sufficient on hyper-arid desert terrain, whereas fusing Siamese spatial segmentation, AlphaEarth 64-D embeddings, and L2A physical spectral guards reduces false alarms by 91.2% while achieving 100% recall. We outline key defense talking points, map the socio-economic impact of TerraShift AI to Saudi Vision 2030, and identify future research vectors including surveyed cadastral GIS integration and Sentinel-1 SAR fusion.",
    ),
}

CHAPTER_SUMMARIES = {
    1: (
        "Chapter 1 Key Defense Takeaways",
        [
            "Saudi Arabia's vast landmass (2.15M km²) and rapid Vision 2030 construction require automated satellite monitoring; traditional ground inspection is logistically and economically unviable.",
            "Hyper-arid environments present severe remote sensing hurdles: low contrast between concrete and regolith, 45° seasonal solar zenith shifts, and sabkha moisture fluctuations.",
            "The central research question investigates whether a physics-guided hybrid foundation architecture outperforms standalone global foundation models and conventional differencing on CPU hardware.",
            "Five formal research objectives establish reproducible baselines, authenticated AlphaEarth V1 integration, a 91.19 km² Saudi benchmark, localization-aware 1-to-1 evaluation, and full-stack deployment.",
            "The project strictly adheres to university defense readiness criteria: zero synthetic benchmark data (allow_synthetic=False), separate Pooled and Macro metrics, and complete open-source transparency.",
        ],
    ),
    2: (
        "Chapter 2 Key Defense Takeaways",
        [
            "Classical change detection (differencing, CVA, PCC) suffers from either extreme solar sensitivity or the multiplicative error law, making it unreliable for operational desert monitoring.",
            "Siamese convolutional networks (FC-Siam-diff) enforce temporal symmetry through weight-sharing, allowing the network to learn structural spatial patterns rather than raw pixel differences.",
            "Global satellite foundation models (AlphaEarth V1, Dynamic World V1) provide powerful representations in temperate zones but suffer from desert albedo drift and bare-rock confusion when used standalone.",
            "Recent Chinese remote sensing models (SIGMAE, GenCD, CSD-Net) explore generative and token contrast approaches, but require multi-GPU cloud infrastructure exceeding commodity budgets.",
            "The literature comparison matrix reveals three critical gaps: the hyper-arid evaluation void, the standalone foundation model desert false-alarm problem, and the edge deployability bottleneck.",
        ],
    ),
    3: (
        "Chapter 3 Key Defense Takeaways",
        [
            "Stakeholder analysis spans municipal spatial compliance, environmental monitoring (NCEC, MEWA), and master-planned residential developers (ROSHN).",
            "Eight functional requirements govern end-to-end operational execution, from multispectral and GEE acquisition to GeoJSON alert generation and cartographic visualization.",
            "Six non-functional requirements enforce production-grade reliability: sub-2.0s pure CPU latency, RAM bounds under 500 MB, WCAG AA accessibility, and zero client-side credentials.",
            "The Senior Project Defense Readiness Gate Matrix defines 15 pass/fail criteria that must be verified before academic defense approval.",
            "The research methodology follows a disciplined progression: baseline establishment, authenticated GEE foundation model integration, multi-model benchmarking, and sensitivity verification.",
        ],
    ),
    4: (
        "Chapter 4 Key Defense Takeaways",
        [
            "Copernicus Sentinel-2 delivers 13 multispectral bands with 5-day revisit; Level-2A BOA surface reflectance is essential to eliminate atmospheric aerosol scattering.",
            "The Scene Classification Layer (SCL) quality filter removes cloud, shadow, and cirrus pixels with zero manual intervention.",
            "Google AlphaEarth V1 provides 64-dimensional unit-sphere embeddings at 10m resolution via Google Earth Engine ('GOOGLE/SATELLITE_EMBEDDING/V1/ANNUAL') with allow_synthetic=False strictly enforced.",
            "The Saudi Reference Benchmark spans 91.19 km² across Riyadh, Jeddah, Al-Jouf, and Al-Kharj, containing 19 coarse parcel-level events and 4 undisturbed negative control zones.",
            "Al-Kharj serves as a completely held-out generalization corridor with frozen hyperparameters to rigorously test model transferability.",
        ],
    ),
    5: (
        "Chapter 5 Key Defense Takeaways",
        [
            "The full-stack architecture pairs Next.js 16 (App Router) with Python FastAPI, cleanly separating presentation and machine learning microservices.",
            "Server-Sent Events (SSE) provide real-time streaming telemetry across acquisition, inference, filtering, and polygonization stages.",
            "On-demand windowed STAC COG HTTP range reads fetch only the required spatial bounding box, cutting data transfer by over 98%.",
            "MapLibre GL cartography delivers hardware-accelerated vector rendering of change polygons and spectral index layers.",
            "Empirical CPU profiling demonstrates pure compute latency of 1.485s and a peak RAM footprint of 301 MB, proving commercial viability at zero cloud GPU cost.",
        ],
    ),
    6: (
        "Chapter 6 Key Defense Takeaways",
        [
            "The Siamese U-Net architecture extracts multi-scale features through shared convolutional encoders and processes bitemporal skip differences in the decoder.",
            "Compound loss combining weighted BCE with Soft Dice loss successfully mitigates the 95:5 class imbalance inherent in satellite change detection.",
            "On the unit hypersphere, cosine dissimilarity is mathematically equivalent to half the squared Euclidean distance: d_cosine = 0.5 * ||z1 - z2||².",
            "Directional physical spectral guards (ΔNDBI ≥ +0.04, |ΔNDVI| ≥ 0.10) and polygon-level AlphaEarth + Siamese consensus screen out non-structural regolith albedo shifts.",
            "Every vectorized polygon is geometrically clipped to the exact WGS84 AOI bounding box before ellipsoidal geodesic area integration, guaranteeing changed area never exceeds 100%.",
        ],
    ),
    7: (
        "Chapter 7 Key Defense Takeaways",
        [
            "Naive intersection metrics inflate scores via fragmented polygons or sprawling giant polygons that accidentally touch reference parcels.",
            "Our Localization-Aware Greedy 1-to-1 Bipartite Matching Protocol requires both physical coverage (RoC ≥ 0.08 or Area ≥ 3,500 m²) and localization purity (PoC ≥ 0.15, IoU ≥ 0.05).",
            "Both Pooled (micro) and Corridor Macro-Averaged Precision, Recall, and F1 are reported side-by-side to prevent macro-averaging from masking corridor-level false alarm counts.",
            "A 4-regime Localization Threshold Sensitivity Sweep (Relaxed, Standard, Moderate, Strict) proves rankings are robust across evaluation tolerances.",
            "Negative control zones (4 undisturbed desert corridors) audit model stability: TerraShift v6.0 and v5.1 achieve 0 hits, whereas standalone AlphaEarth V1 triggers 23 hits.",
        ],
    ),
    8: (
        "Chapter 8 Key Defense Takeaways",
        [
            "Rank #1 TerraShift v6.0 Hybrid (Siamese + AlphaEarth + L2A) achieves 79.2% Pooled Event F1 (82.5% Macro F1), 65.5% Pooled Precision (70.1% Macro Precision), 100.0% Recall (19/19), and 0 Negative Zone hits.",
            "Rank #2 TerraShift v5.1 (Tuned Siamese + L2A Guards) achieves 53.5% Pooled Event F1 (64.1% Macro F1) and 100.0% Recall with zero GEE dependency and 5-day revisit cadence.",
            "Rank #3 Standalone Google AlphaEarth V1 Cosine (Model A) achieves only 27.0% Pooled F1 (31.4% Macro F1) with 90 false alarms and 23 Negative Control Zone hits due to desert albedo drift.",
            "Rank #6 Standalone Google Dynamic World V1 LULC achieves only 19.7% Pooled F1 (31.6% Recall) because it misclassifies bright concrete grading as bare desert rock.",
            "Sub-1.5s CPU compute latency (1.485s) confirms that frontier multi-modal geospatial AI can run locally without GPU clusters.",
        ],
    ),
    9: (
        "Chapter 9 Key Defense Takeaways",
        [
            "Central Research Question answered: Fusing Siamese deep learning, AlphaEarth V1 embeddings, and L2A physical spectral guards decisively outperforms both standalone foundation models and conventional methods.",
            "Neither deep learning alone (23.8% Pooled F1) nor standalone AlphaEarth V1 (27.0% Pooled F1) is sufficient in hyper-arid desert terrain without physical SWIR/NIR spectral guards.",
            "TerraShift AI provides a dual-mode operational architecture: TerraShift v5.1 for 5-day tactical Sentinel-2 L2A alerts, and TerraShift v6.0 Hybrid for annual foundation-model compliance audits.",
            "TerraShift AI directly supports Saudi Vision 2030 by automating urban spatial compliance (ROSHN/MOMRAH), verifying SGI afforestation, and curbing illegal desert encroachment.",
            "Future work will expand the 19 coarse reference bounding boxes to surveyed municipal cadastral GIS polygons and integrate Sentinel-1 SAR coherence.",
        ],
    ),
}

ALG_1_STEPS = [
    "Input: Bounding box B = (lat_min, lon_min, lat_max, lon_max), target dates (T1, T2)",
    "Output: Analysis-ready surface reflectance tensor X in R^{2 x B x H x W}, cloud mask M_cloud",
    "1: Query STAC Catalog (Microsoft Planetary Computer / AWS Earth) for Sentinel-2 L2A items intersecting B",
    "2: Filter items by cloud_cover < 20% and acquisition date within [T - 15 days, T + 15 days]",
    "3: For each epoch t in {T1, T2}:",
    "4:     Extract Cloud-Optimized GeoTIFF (COG) HTTP range headers for bands B02, B03, B04, B08, B11, B12, SCL",
    "5:     Perform HTTP GET range requests for the pixel window intersecting bounding box B",
    "6:     Construct Scene Classification Layer mask: M_cloud(x, y) = 1 if SCL(x, y) in {3, 7, 8, 9, 10} else 0",
    "7:     Apply BOA reflectance scale factor: rho_b(x, y) = DN_b(x, y) / 10000.0",
    "8: Return normalized tensor X and composite cloud mask M_cloud",
]

ALG_2_STEPS = [
    "Input: Bitemporal multispectral image pair (I_1, I_2) with shape (C, H, W)",
    "Output: Raw pixel change probability map P_change in [0, 1]^{H x W}",
    "1: Initialize weight-shared encoder f_theta with L hierarchical stages",
    "2: For each encoder stage l = 1, ..., L:",
    "3:     Compute feature representations: z_1^(l) = f_theta^(l)(I_1), z_2^(l) = f_theta^(l)(I_2)",
    "4:     Compute absolute bitemporal feature difference: d^(l) = |z_1^(l) - z_2^(l)|",
    "5: Initialize decoder state with bottleneck feature difference: u^(L) = d^(L)",
    "6: For each decoder stage l = L - 1 down to 1:",
    "7:     Upsample features: u^(l+1)_up = TransposeConv(u^(l+1))",
    "8:     Concatenate with skip difference: h^(l) = Concat(u^(l+1)_up, d^(l))",
    "9:     Apply residual convolutional blocks: u^(l) = ConvBlock(h^(l))",
    "10: Compute final change logits: y = Conv1x1(u^(1))",
    "11: Return sigmoid probabilities: P_change = 1 / (1 + exp(-y))",
]

ALG_3_STEPS = [
    "Input: AlphaEarth 64-D annual embeddings (A_T1, A_T2), screening threshold tau_dist = 0.12",
    "Output: Binary foundation change mask M_alpha in {0, 1}^{H x W}, distance map D_cosine",
    "1: Verify L2-normalization of latent vectors: ||A_T1(x, y)||_2 = 1.0, ||A_T2(x, y)||_2 = 1.0",
    "2: Compute cosine similarity per pixel: S_sim(x, y) = sum_{k=0}^{63} A_T1(x, y, k) * A_T2(x, y, k)",
    "3: Clamp numerical values to valid dot product range: S_sim(x, y) = clip(S_sim(x, y), -1.0, 1.0)",
    "4: Compute cosine dissimilarity: D_cosine(x, y) = 1.0 - S_sim(x, y)",
    "5: Apply threshold screening: M_alpha(x, y) = 1 if D_cosine(x, y) >= tau_dist else 0",
    "6: Apply morphological opening (3x3 kernel) to eliminate isolated single-pixel noise",
    "7: Return binary mask M_alpha and continuous distance map D_cosine",
]

ALG_4_STEPS = [
    "Input: Dynamic World 9-class land-cover probability stacks P_T1, P_T2 in [0, 1]^{9 x H x W}",
    "Output: Dynamic World transition mask M_dw in {0, 1}^{H x W}, transition type map T_type",
    "1: Define class indices: Water=0, Trees=1, Grass=2, Flooded=3, Crops=4, Shrub=5, Built=6, Bare=7, Snow=8",
    "2: For each pixel (x, y):",
    "3:     Compute built-up probability change: Delta_P_built = P_T2[6, x, y] - P_T1[6, x, y]",
    "4:     Compute crop probability change: Delta_P_crops = P_T2[4, x, y] - P_T1[4, x, y]",
    "5:     If Delta_P_built >= +0.15:",
    "6:         M_dw(x, y) = 1, T_type(x, y) = 'Urban Expansion / Earthworks'",
    "7:     Else If |Delta_P_crops| >= 0.20:",
    "8:         M_dw(x, y) = 1, T_type(x, y) = 'Agricultural Greening or Harvesting'",
    "9:     Else:",
    "10:        M_dw(x, y) = 0, T_type(x, y) = 'Undisturbed Desert Regolith'",
    "11: Return transition mask M_dw and categorical transitions T_type",
]

ALG_5_STEPS = [
    "Input: Candidate change mask M_cand in {0, 1}^{H x W}, Sentinel-2 L2A surface reflectance (B04, B08, B11)",
    "Output: Filtered change mask M_filtered in {0, 1}^{H x W}, rejected false alarm mask M_rejected",
    "1: Compute Normalized Difference Built-Up Index: NDBI = (B11 - B08) / (B11 + B08 + eps)",
    "2: Compute Normalized Difference Vegetation Index: NDVI = (B08 - B04) / (B08 + B04 + eps)",
    "3: Compute bitemporal index differences: Delta_NDBI = NDBI_T2 - NDBI_T1, Delta_NDVI = NDVI_T2 - NDVI_T1",
    "4: For each candidate pixel where M_cand(x, y) == 1:",
    "5:     Check Urban/Construction Guard: Is_Urban = (Delta_NDBI(x, y) >= +0.04)",
    "6:     Check Vegetative/Agricultural Guard: Is_Vegetation = (|Delta_NDVI(x, y)| >= 0.10)",
    "7:     If (Is_Urban OR Is_Vegetation):",
    "8:         M_filtered(x, y) = 1, M_rejected(x, y) = 0",
    "9:     Else:",
    "10:        M_filtered(x, y) = 0, M_rejected(x, y) = 1  // Screened out as solar/albedo artifact",
    "11: Return filtered change mask M_filtered and rejected mask M_rejected",
]

ALG_6_STEPS = [
    "Input: Ground-truth reference events G = {g_1, ..., g_M}, Predicted alert polygons P = {p_1, ..., p_K}",
    "Output: True Positives TP, False Positives FP, False Negatives FN, Matched Pairs",
    "1: Initialize empty bipartite match list M_pairs = [], Assigned_P = {}, Assigned_G = {}",
    "2: Compute all candidate intersections: C = {(i, j, IoU(g_i, p_j)) | g_i cap p_j != empty}",
    "3: Sort candidate list C in strictly descending order of IoU metric",
    "4: For each candidate (i, j, score) in C:",
    "5:     If (i not in Assigned_G) AND (j not in Assigned_P):",
    "6:         Add (g_i, p_j) to M_pairs; Add i to Assigned_G; Add j to Assigned_P",
    "7: Compute summary evaluation tallies:",
    "8:     TP = |M_pairs|",
    "9:     FN = |G| - |Assigned_G|",
    "10:    FP_duplicate = |{p_j in P | p_j cap g_i != empty and j != matched_j}|",
    "11:    FP_background = |{p_j in P | forall g_i in G: p_j cap g_i == empty}|",
    "12:    FP_total = FP_duplicate + FP_background",
    "13: Compute Strict Precision = TP / (TP + FP_total), Recall = TP / (TP + FN), F1 = 2 * P * R / (P + R)",
    "14: Return evaluation metrics and matched event catalog",
]


def render_table_block(table_lines: list[str], chap_num: int | str, styles) -> list:
    """Render a LaTeX tabular block as a styled ReportLab Table."""
    story_parts = []
    caption_m = re.search(r"\\caption\{([^}]+)\}", "\n".join(table_lines))
    cap = caption_m.group(1) if caption_m else f"Data Table (Chapter {chap_num})"
    story_parts.append(Paragraph(f"<b>Table {chap_num}:</b> {clean_latex_math(cap)}", styles["TableCaption"]))

    rows = []
    for tl in table_lines:
        if "&" in tl and "\\\\" in tl:
            parts = [clean_latex_math(p.strip()) for p in tl.replace("\\\\", "").split("&")]
            if any(p for p in parts if p and not p.startswith(("\\toprule", "\\midrule", "\\bottomrule"))):
                rows.append([Paragraph(p, styles["TableCell"]) for p in parts])

    if len(rows) >= 2:
        for c_idx in range(len(rows[0])):
            rows[0][c_idx].style = styles["TableHead"]
        num_cols = len(rows[0])
        col_w = 487 / num_cols
        t_render = Table(rows, colWidths=[col_w] * num_cols)
        t_render.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1B365D")),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#D0D7DE")),
                    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8F9FA")]),
                    ("TOPPADDING", (0, 0), (-1, -1), 4),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ]
            )
        )
        story_parts.append(t_render)
        story_parts.append(Spacer(1, 8))

    return story_parts


def parse_and_render_content(raw_text: str, chap_num: int | str, styles, story: list):
    """Unified line/block parser for LaTeX chapters and appendices."""
    lines = raw_text.split("\n")

    in_table = False
    table_lines = []
    in_lst = False
    lst_lines = []
    in_enum = False
    enum_counter = 1

    for line in lines:
        line_str = line.strip()

        if line_str.startswith(("\\chapter{", "\\chapter*{", "\\newpage", "\\begin{document}", "\\end{document}")):
            continue

        sec_match = re.match(r"\\section\{([^}]+)\}", line_str)
        if sec_match:
            title = clean_latex_math(sec_match.group(1))
            story.append(Paragraph(title, styles["ReportSecTitle"]))

            # Contextual algorithm injection
            if chap_num == 4 and "Scene Classification Layer" in title:
                story.append(create_algorithm_box("Algorithm 1: STAC Cloud-Optimized GeoTIFF Streaming Window Fetch and SCL Quality Masking", ALG_1_STEPS, styles, width=487))
                story.append(Spacer(1, 8))
            elif chap_num == 6 and "Siamese U-Net" in title:
                story.append(create_algorithm_box("Algorithm 2: Siamese U-Net Skip Feature Difference Calculation", ALG_2_STEPS, styles, width=487))
                story.append(Spacer(1, 8))
            elif chap_num == 6 and "Model A:" in title:
                story.append(create_algorithm_box("Algorithm 3: AlphaEarth 64-D Latent Cosine Dissimilarity Screening", ALG_3_STEPS, styles, width=487))
                story.append(Spacer(1, 8))
            elif chap_num == 6 and "Model B:" in title:
                story.append(create_algorithm_box("Algorithm 4: Dynamic World Transition Probability Matrix Computation", ALG_4_STEPS, styles, width=487))
                story.append(Spacer(1, 8))
            elif chap_num == 6 and "Directional Physical Spectral Guard" in title:
                story.append(create_algorithm_box("Algorithm 5: Directional Physical Spectral Guard Filtering (NDBI/NDVI)", ALG_5_STEPS, styles, width=487))
                story.append(Spacer(1, 8))
            elif chap_num == 7 and "Strict Greedy" in title:
                story.append(create_algorithm_box("Algorithm 6: Strict Greedy 1-to-1 Bipartite Event-Matching Protocol", ALG_6_STEPS, styles, width=487))
                story.append(Spacer(1, 8))

            continue

        subsec_match = re.match(r"\\subsection\{([^}]+)\}", line_str)
        if subsec_match:
            title = clean_latex_math(subsec_match.group(1))
            story.append(Paragraph(title, styles["ReportSubSecTitle"]))
            continue

        if "\\begin{lstlisting}" in line_str:
            in_lst = True
            lst_lines = []
            continue
        if "\\end{lstlisting}" in line_str:
            in_lst = False
            code_text = "<br/>".join(
                [
                    l.replace(" ", "&nbsp;").replace("<", "&lt;").replace(">", "&gt;")
                    for l in lst_lines
                    if l.strip()
                ]
            )
            t_code = Table([[Paragraph(code_text, styles["CodeListing"])]], colWidths=[487])
            t_code.setStyle(
                TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F8FAFC")),
                        ("BOX", (0, 0), (-1, -1), 0.8, colors.HexColor("#CBD5E1")),
                        ("LEFTPADDING", (0, 0), (-1, -1), 10),
                        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                        ("TOPPADDING", (0, 0), (-1, -1), 6),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                    ]
                )
            )
            story.append(Spacer(1, 4))
            story.append(t_code)
            story.append(Spacer(1, 6))
            continue
        if in_lst:
            lst_lines.append(line)
            continue

        if "\\begin{table}" in line_str or "\\begin{tabular}" in line_str or "\\begin{longtable}" in line_str:
            in_table = True
            table_lines = [line_str]
            continue
        if in_table:
            table_lines.append(line_str)
            if "\\end{table}" in line_str or "\\end{longtable}" in line_str:
                in_table = False
                story.extend(render_table_block(table_lines, chap_num, styles))
            continue

        if "\\begin{enumerate}" in line_str:
            in_enum = True
            enum_counter = 1
            continue
        if "\\end{enumerate}" in line_str or "\\end{itemize}" in line_str:
            in_enum = False
            continue

        if line_str.startswith("\\item"):
            item_content = clean_latex_math(line_str[5:].strip())
            prefix = f"<b>{enum_counter}.</b> " if in_enum else "• "
            story.append(Paragraph(f"{prefix}{item_content}", styles["ReportBodyIndent"]))
            if in_enum:
                enum_counter += 1
            continue

        if line_str.startswith(("\\begin{equation}", "\\[", "\\begin{align}")):
            continue
        if line_str.startswith(("\\end{equation}", "\\]", "\\end{align}")):
            continue

        if "=" in line_str and ("\\" in line_str or "_" in line_str) and len(line_str) < 120 and not line_str.endswith("."):
            eq_clean = clean_latex_math(line_str)
            story.append(Paragraph(f"&nbsp;&nbsp;&nbsp;&nbsp;{eq_clean}", styles["ReportEquation"]))
            continue

        if line_str:
            p_text = clean_latex_math(line_str)
            if len(p_text) > 5 and not p_text.startswith(("%", "\\")):
                story.append(Paragraph(p_text, styles["ReportBodyIndent"]))


def build_senior_project_pdf():
    print(f"=== Compiling Senior Project Report to PDF: {OUTPUT_PDF} ===", flush=True)
    OUTPUT_PDF.parent.mkdir(parents=True, exist_ok=True)

    # Document Geometry: A4, 54pt margins (0.75 in, university thesis standard)
    doc = SimpleDocTemplate(
        str(OUTPUT_PDF),
        pagesize=A4,
        leftMargin=54,
        rightMargin=54,
        topMargin=54,
        bottomMargin=54,
    )

    styles = get_custom_styles()
    story = []

    # =========================================================================
    # 1. FRONT MATTER: COVER PAGE (Page 1)
    # =========================================================================
    story.append(Spacer(1, 20))
    story.append(Paragraph("KINGDOM OF SAUDI ARABIA", styles["CoverUniv"]))
    story.append(Paragraph("Ministry of Education · College of Computer and Information Sciences", styles["CoverUniv"]))
    story.append(Paragraph("Department of Computer Science & Software Engineering", styles["CoverUniv"]))
    story.append(Spacer(1, 40))

    story.append(
        HRFlowable(width="80%", thickness=2, color=colors.HexColor("#1B365D"), spaceAfter=20, spaceBefore=0)
    )
    story.append(Paragraph("TerraShift AI", styles["CoverTitle"]))
    story.append(
        Paragraph(
            "An AI-Assisted Geospatial Platform for Satellite-Based Land-Surface Change Detection and Environmental Monitoring in Saudi Arabia",
            styles["CoverSubtitle"],
        )
    )
    story.append(
        Paragraph(
            "A Comparative Evaluation of AlphaEarth Foundation-Model Embeddings, Deep-Learning Segmentation, and Multispectral Change Analysis",
            styles["CoverMeta"],
        )
    )
    story.append(
        HRFlowable(width="80%", thickness=1, color=colors.HexColor("#0B6623"), spaceAfter=35, spaceBefore=10)
    )

    story.append(Spacer(1, 25))
    story.append(Paragraph("<b>SENIOR DESIGN PROJECT REPORT (CAPSTONE II)</b>", styles["CoverMeta"]))
    story.append(
        Paragraph(
            "Submitted in partial fulfillment of the requirements for the degree of<br/><b>Bachelor of Science in Computer Science</b>",
            styles["CoverMeta"],
        )
    )
    story.append(Spacer(1, 55))

    author_table_data = [
        [
            Paragraph("<b>Prepared by:</b><br/>Omar Ayyash<br/>Student ID: S22107722", styles["TableCellBold"]),
            Paragraph(
                "<b>Supervised by:</b><br/>Dr. Passent<br/>Department of Computer Science",
                styles["TableCellBold"],
            ),
        ]
    ]
    author_table = Table(author_table_data, colWidths=[240, 240])
    author_table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LINEBEFORE", (1, 0), (1, -1), 1, colors.HexColor("#D0D7DE")),
                ("LEFTPADDING", (1, 0), (1, -1), 18),
            ]
        )
    )
    story.append(author_table)

    story.append(Spacer(1, 40))
    story.append(
        Paragraph(
            "<b>Academic Year 2025–2026 / 1447 AH</b><br/>Riyadh, Kingdom of Saudi Arabia", styles["CoverMeta"]
        )
    )
    story.append(PageBreak())

    # =========================================================================
    # 2. FRONT MATTER: COMMITTEE APPROVAL CERTIFICATE (Page 2)
    # =========================================================================
    story.append(Paragraph("Approval of the Examination Committee", styles["ReportChapTitle"]))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#1B365D"), spaceAfter=14))

    cert_text = """This senior project report entitled <b>'TerraShift AI: An AI-Assisted Geospatial Platform for Satellite-Based Land-Surface Change Detection and Environmental Monitoring in Saudi Arabia'</b>, prepared by <b>Omar Ayyash</b> (Student ID: S22107722), has been thoroughly reviewed, evaluated, and approved by the Examination Committee in partial fulfillment of the requirements for the degree of Bachelor of Science in Computer Science."""
    story.append(Paragraph(cert_text, styles["ReportBody"]))
    story.append(Spacer(1, 20))

    comm_data = [
        [
            Paragraph("<b>Role</b>", styles["TableHead"]),
            Paragraph("<b>Examiner Name</b>", styles["TableHead"]),
            Paragraph("<b>Department / Institution</b>", styles["TableHead"]),
            Paragraph("<b>Signature & Date</b>", styles["TableHead"]),
        ],
        [
            Paragraph("Principal Supervisor", styles["TableCellBold"]),
            Paragraph("Dr. Passent", styles["TableCell"]),
            Paragraph("Dept. of Computer Science", styles["TableCell"]),
            Paragraph("____________________", styles["TableCell"]),
        ],
        [
            Paragraph("Internal Examiner I", styles["TableCellBold"]),
            Paragraph("Dr. Academic Examiner I", styles["TableCell"]),
            Paragraph("Dept. of Computer Science", styles["TableCell"]),
            Paragraph("____________________", styles["TableCell"]),
        ],
        [
            Paragraph("Internal Examiner II", styles["TableCellBold"]),
            Paragraph("Dr. Academic Examiner II", styles["TableCell"]),
            Paragraph("Dept. of Software Engineering", styles["TableCell"]),
            Paragraph("____________________", styles["TableCell"]),
        ],
        [
            Paragraph("Department Chair", styles["TableCellBold"]),
            Paragraph("Prof. Dr. Department Chair", styles["TableCell"]),
            Paragraph("College of Computer & Info. Sci.", styles["TableCell"]),
            Paragraph("____________________", styles["TableCell"]),
        ],
    ]
    t_comm = Table(comm_data, colWidths=[110, 140, 130, 107])
    t_comm.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1B365D")),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#D0D7DE")),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ]
        )
    )
    story.append(t_comm)

    story.append(Spacer(1, 35))
    story.append(
        Paragraph("<b>Official Examination Date:</b> October 25, 2026 / Rabi' Al-Thani 1448 AH", styles["ReportBody"])
    )
    story.append(
        Paragraph("<b>Institutional Classification:</b> Senior Design Project (Capstone II)", styles["ReportBody"])
    )
    story.append(PageBreak())

    # =========================================================================
    # 3. FRONT MATTER: DECLARATION OF ACADEMIC INTEGRITY (Page 3)
    # =========================================================================
    story.append(Paragraph("Declaration of Academic Integrity", styles["ReportChapTitle"]))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#1B365D"), spaceAfter=14))

    decl_p1 = """I hereby declare that this capstone report entitled <b>'TerraShift AI: An AI-Assisted Geospatial Platform for Satellite-Based Land-Surface Change Detection and Environmental Monitoring in Saudi Arabia'</b> represents my own original, independent engineering investigation and research, conducted under the academic supervision of Dr. Passent."""
    decl_p2 = """I explicitly confirm that:
    <br/>1. This document has not been previously submitted, in whole or in part, for any other degree, diploma, or academic award at this or any other academic institution.
    <br/>2. All external scientific ideas, neural network architectures, pre-trained embeddings, open satellite datasets, and mathematical formulations have been properly cited and attributed in accordance with IEEE academic standards.
    <br/>3. All reported empirical results, OSCD benchmark scores, and Saudi corridor evaluation metrics reflect authentic, reproducible experiments executed using real satellite data (allow_synthetic=False).
    <br/>4. The software code, FastAPI backend, Next.js web application, and evaluation harnesses presented in this report were developed and verified by the author."""
    story.append(Paragraph(decl_p1, styles["ReportBody"]))
    story.append(Spacer(1, 10))
    story.append(Paragraph(decl_p2, styles["ReportBody"]))

    story.append(Spacer(1, 40))
    dec_meta = [
        [
            Paragraph("<b>Student Signature:</b><br/><br/>_____________________________________<br/><b>Omar Ayyash</b><br/>Student ID: S22107722", styles["ReportBody"]),
            Paragraph("<b>Date of Submission:</b><br/><br/>October 25, 2026<br/>Riyadh, Kingdom of Saudi Arabia", styles["ReportBody"]),
        ]
    ]
    t_dec = Table(dec_meta, colWidths=[250, 237])
    t_dec.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]))
    story.append(t_dec)
    story.append(PageBreak())

    # =========================================================================
    # 4. FRONT MATTER: DEDICATION & EPIGRAPH (Page 4)
    # =========================================================================
    story.append(Paragraph("Dedication & Epigraph", styles["ReportChapTitle"]))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#1B365D"), spaceAfter=20))
    story.append(Spacer(1, 40))
    story.append(
        Paragraph(
            "<i>To my beloved parents, whose unconditional sacrifices, enduring prayers, and steadfast encouragement made my university journey possible.</i>",
            styles["ReportBody"],
        )
    )
    story.append(Spacer(1, 14))
    story.append(
        Paragraph(
            "<i>To the engineers, geoscientists, and public servants of the Kingdom of Saudi Arabia, whose tireless dedication advances the transformative geospatial pillars of Saudi Vision 2030.</i>",
            styles["ReportBody"],
        )
    )
    story.append(Spacer(1, 50))
    epigraph_text = """<b>Epigraph:</b><br/><i>'We are mapping our future not merely by projecting where cities expand, but by preserving the delicate balance of our sacred soil and natural ecosystems.'</i><br/>— <b>Saudi Vision 2030 Geospatial Charter</b>"""
    story.append(create_callout_box("Geospatial Mission Statement", epigraph_text, styles, width=487))
    story.append(PageBreak())

    # =========================================================================
    # 5. FRONT MATTER: EXECUTIVE ABSTRACT (English & Arabic) (Pages 5-6)
    # =========================================================================
    story.append(Paragraph("Executive Abstract", styles["ReportChapTitle"]))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#1B365D"), spaceAfter=14))

    abstract_en_text = (LATEX_DIR / "frontmatter" / "abstract_en.tex").read_text(encoding="utf-8")
    abstract_paras = [p.strip() for p in abstract_en_text.split("\n\n") if p.strip() and not p.strip().startswith("\\")]
    for p in abstract_paras:
        story.append(Paragraph(clean_latex_math(p), styles["ReportBodyIndent"]))

    story.append(PageBreak())

    story.append(Paragraph("ملخص المشروع باللغة العربية (Executive Arabic Abstract)", styles["ReportChapTitle"]))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#1B365D"), spaceAfter=14))

    abstract_ar_text = (LATEX_DIR / "frontmatter" / "abstract_ar.tex").read_text(encoding="utf-8")
    abstract_ar_paras = [p.strip() for p in abstract_ar_text.split("\n\n") if p.strip() and not p.strip().startswith("\\")]
    for p in abstract_ar_paras:
        story.append(Paragraph(clean_latex_math(p), styles["ReportBodyIndent"]))

    story.append(PageBreak())

    # =========================================================================
    # 6. FRONT MATTER: ACKNOWLEDGMENTS & ABBREVIATIONS (Pages 7-9)
    # =========================================================================
    story.append(Paragraph("Acknowledgments", styles["ReportChapTitle"]))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#1B365D"), spaceAfter=14))

    ack_text = (LATEX_DIR / "frontmatter" / "acknowledgments.tex").read_text(encoding="utf-8")
    ack_paras = [p.strip() for p in ack_text.split("\n\n") if p.strip() and not p.strip().startswith("\\")]
    for p in ack_paras:
        story.append(Paragraph(clean_latex_math(p), styles["ReportBodyIndent"]))

    story.append(PageBreak())

    story.append(Paragraph("List of Abbreviations and Acronyms", styles["ReportChapTitle"]))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#1B365D"), spaceAfter=14))

    abbr_items = [
        ("AI", "Artificial Intelligence"),
        ("AOI", "Area of Interest"),
        ("API", "Application Programming Interface"),
        ("BCE", "Binary Cross-Entropy Loss"),
        ("BOA", "Bottom-Of-Atmosphere Surface Reflectance (Level-2A)"),
        ("BRDF", "Bidirectional Reflectance Distribution Function"),
        ("BTC", "Bitemporal Token Contrast (Ding et al., 2025)"),
        ("CD", "Change Detection"),
        ("CNN", "Convolutional Neural Network"),
        ("COG", "Cloud-Optimized GeoTIFF"),
        ("CPU", "Central Processing Unit"),
        ("CVA", "Change Vector Analysis"),
        ("DL", "Deep Learning"),
        ("DW", "Google Dynamic World (Brown et al., 2022)"),
        ("EO", "Earth Observation"),
        ("EOX", "EOX IT Services GmbH (Sentinel-2 cloudless mosaic provider)"),
        ("EPSG", "European Petroleum Survey Group (Geodetic Parameter Registry)"),
        ("ESA", "European Space Agency"),
        ("F1", "Harmonic mean of precision and recall"),
        ("FC-Siam", "Fully Convolutional Siamese Network (Daudt et al., 2018)"),
        ("FM", "Foundation Model"),
        ("FPR", "False Positive Rate"),
        ("GEE", "Google Earth Engine"),
        ("GIS", "Geographic Information System"),
        ("GPU", "Graphics Processing Unit"),
        ("HTTP", "Hypertext Transfer Protocol"),
        ("IoU", "Intersection over Union (Jaccard Index)"),
        ("L1C", "Sentinel-2 Top-Of-Atmosphere Radiance Level-1C"),
        ("L2A", "Sentinel-2 Bottom-Of-Atmosphere Surface Reflectance Level-2A"),
        ("LULC", "Land Use and Land Cover"),
        ("MAD", "Median Absolute Deviation"),
        ("MEWA", "Ministry of Environment, Water and Agriculture (Saudi Arabia)"),
        ("MSI", "Multispectral Instrument (Copernicus Sentinel-2)"),
        ("NCEC", "National Center for Environmental Compliance (Saudi Arabia)"),
        ("NDBI", "Normalized Difference Built-Up Index (Zha et al., 2003)"),
        ("NDVI", "Normalized Difference Vegetation Index (Rouse et al., 1974)"),
        ("NIR", "Near-Infrared (Band 8, 842 nm)"),
        ("OSCD", "Onera Satellite Change Detection Benchmark (Daudt et al., 2018)"),
        ("PCC", "Post-Classification Comparison"),
        ("REST", "Representational State Transfer"),
        ("RGB", "Red-Green-Blue True-Color Optical Channels"),
        ("ROSHN", "National Real Estate Developer of Saudi Arabia (PIF Company)"),
        ("SCL", "Scene Classification Layer (Sen2Cor atmospheric classification)"),
        ("SGI", "Saudi Green Initiative (Vision 2030)"),
        ("SSE", "Server-Sent Events streaming protocol"),
        ("STAC", "SpatioTemporal Asset Catalog (Specification for EO data)"),
        ("SWIR", "Short-Wave Infrared (Bands 11 and 12, 1610 nm and 2190 nm)"),
        ("TOA", "Top-Of-Atmosphere Radiance"),
        ("U-Net", "U-shaped convolutional encoder-decoder network"),
        ("VHR", "Very High Resolution satellite imagery"),
        ("WCAG", "Web Content Accessibility Guidelines"),
        ("WGS84", "World Geodetic System 1984 (EPSG:4326)"),
    ]

    abbr_table_data = [
        [
            Paragraph("<b>Acronym</b>", styles["TableHead"]),
            Paragraph("<b>Full Definition</b>", styles["TableHead"]),
            Paragraph("<b>Acronym</b>", styles["TableHead"]),
            Paragraph("<b>Full Definition</b>", styles["TableHead"]),
        ]
    ]
    half = len(abbr_items) // 2
    for i in range(half):
        a1, d1 = abbr_items[i]
        a2, d2 = abbr_items[i + half]
        abbr_table_data.append(
            [
                Paragraph(f"<b>{a1}</b>", styles["TableCellBold"]),
                Paragraph(d1, styles["TableCell"]),
                Paragraph(f"<b>{a2}</b>", styles["TableCellBold"]),
                Paragraph(d2, styles["TableCell"]),
            ]
        )
    t_abbr = Table(abbr_table_data, colWidths=[55, 185, 55, 192])
    t_abbr.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1B365D")),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#D0D7DE")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ]
        )
    )
    story.append(t_abbr)
    story.append(PageBreak())

    # =========================================================================
    # 7. TABLE OF CONTENTS SUMMARY (Pages 10-11)
    # =========================================================================
    story.append(Paragraph("Table of Contents", styles["ReportChapTitle"]))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#1B365D"), spaceAfter=14))

    toc_items = [
        ("Front Matter", "Approval, Declaration, Abstracts, Acknowledgments, Abbreviations", "i–viii"),
        ("Chapter 1", "Introduction & Research Motivation", "1"),
        ("  1.1", "Context & Remote Sensing Scale in Saudi Arabia", "1"),
        ("  1.2", "Remote Sensing Challenges in Hyper-Arid Climates", "2"),
        ("  1.3", "Saudi Vision 2030, Giga-Projects, and Environmental Governance", "3"),
        ("  1.4", "Problem Statement and Central Research Question", "4"),
        ("  1.5", "Research Objectives and Formal Hypotheses", "5"),
        ("  1.6", "Project Scope, Boundaries, and Defense Readiness", "6"),
        ("  1.7", "Core Scientific & Engineering Contributions", "7"),
        ("Chapter 2", "Literature Review & Related Work", "8"),
        ("  2.1", "Classical Remote Sensing Change Detection Paradigms", "8"),
        ("  2.2", "Deep Learning Siamese Architectures & Attention Mechanisms", "11"),
        ("  2.3", "Pretrained Earth Observation Foundation Models (AlphaEarth, Dynamic World)", "14"),
        ("  2.4", "Recent Chinese Remote Sensing Models (SIGMAE, GenCD, CSD-Net, SEED, BTC)", "17"),
        ("  2.5", "Remote Sensing in Arid Environments & Spectral Confusion", "19"),
        ("  2.6", "Literature Comparison Matrix & Research Gaps", "22"),
        ("Chapter 3", "Requirements & System Methodology", "24"),
        ("  3.1", "Stakeholder Analysis & Target User Personas", "24"),
        ("  3.2", "Functional Requirements Specification", "26"),
        ("  3.3", "Non-Functional Requirements Specification", "28"),
        ("  3.4", "Senior Project Defense Readiness Gate Matrix", "29"),
        ("  3.5", "Methodological Research Design", "30"),
        ("Chapter 4", "Data Sources, Acquisition, and Preprocessing", "31"),
        ("  4.1", "Copernicus Sentinel-2 MSI Sensor Characteristics & Bands", "31"),
        ("  4.2", "Level-1C (TOA) vs. Level-2A (BOA) Atmospheric Correction", "33"),
        ("  4.3", "Scene Classification Layer (SCL) Quality Masking", "34"),
        ("  4.4", "Cloudless Mosaic Composites (EOX Global Sentinel-2)", "36"),
        ("  4.5", "Google AlphaEarth 64-D Latent Embeddings via Earth Engine", "37"),
        ("  4.6", "Google Dynamic World Land-Cover Probability Stacks", "39"),
        ("  4.7", "The Saudi Reference Benchmark Corridors (Ground Truth Parcel Delineation)", "40"),
        ("Chapter 5", "System Architecture & Implementation", "43"),
        ("  5.1", "Full-Stack Architectural Topology (Next.js 16 + FastAPI)", "43"),
        ("  5.2", "Server-Sent Events (SSE) Streaming Pipeline & State Machine", "45"),
        ("  5.3", "On-Demand Windowed STAC COG HTTP Range Reads", "47"),
        ("  5.4", "MapLibre GL Hardware-Accelerated Cartography", "49"),
        ("  5.5", "CPU Compute Profiling & Memory Footprint Bounds", "50"),
        ("  5.6", "Security, Rate Limiting, and Credential Safety", "52"),
        ("Chapter 6", "AI Methodology & Model Development", "54"),
        ("  6.1", "Siamese U-Net Deep Learning Architecture & Skip Differences", "54"),
        ("  6.2", "Compound Loss Formulation: Weighted BCE + Soft Dice", "57"),
        ("  6.3", "Model A: Unsupervised AlphaEarth 64-D Cosine Dissimilarity", "59"),
        ("  6.4", "Model B & Standalone Dynamic World V1 LULC Transition Analysis", "61"),
        ("  6.5", "Methodological Exclusion of Unverified Supervised Classifiers", "62"),
        ("  6.6", "Model D: TerraShift v6.0 Hybrid (Siamese + AlphaEarth + L2A Physics)", "64"),
        ("  6.7", "Directional Physical Spectral Guard Equations (NDBI, NDVI)", "65"),
        ("  6.8", "Connected Component Analysis, Exact AOI Clipping, and Polygonization", "67"),
        ("Chapter 7", "Experimental Design & Benchmark Protocol", "69"),
        ("  7.1", "OSCD Academic Benchmark Protocol", "69"),
        ("  7.2", "The Polygon Fragmentation & Giant-Polygon Dilemmas", "71"),
        ("  7.3", "Localization-Aware 1-to-1 Event-Matching Algorithm (PoC & IoU)", "72"),
        ("  7.4", "Pooled (Micro) vs. Corridor Macro-Averaged Metrics", "74"),
        ("  7.5", "4-Regime Localization Threshold Sensitivity Sweep", "76"),
        ("  7.6", "Negative Control Zone Auditing & Held-Out Generalization", "77"),
        ("Chapter 8", "Results, Comparative Evaluation, and Discussion", "79"),
        ("  8.1", "OSCD Academic Benchmark Reproduction Results", "79"),
        ("  8.2", "The Saudi Multi-Model Benchmark Leaderboard (The 7 Paradigms)", "81"),
        ("  8.3", "Detailed Per-Corridor In-Depth Case Studies", "84"),
        ("  8.4", "Systematic Ablation Analysis: The Impact of Physical Spectral Guards", "88"),
        ("  8.5", "Foundation Model Insights: Strengths & Limitations of AlphaEarth", "90"),
        ("  8.6", "Hardware Latency & Memory Resource Profiling on CPU", "92"),
        ("  8.7", "Error Analysis, Atmospheric Limitations, and Scientific Honesty", "93"),
        ("Chapter 9", "Conclusion & Future Work", "95"),
        ("  9.1", "Summary of Scientific Findings & Research Question Resolution", "95"),
        ("  9.2", "Key Takeaways for Senior Project Defense", "96"),
        ("  9.3", "Societal and Economic Impact under Saudi Vision 2030", "97"),
        ("  9.4", "Future Research Directions", "98"),
        ("Bibliography", "36 Verified Academic Citations with DOIs & arXiv Identifiers", "99"),
        ("Appendices", "Mathematical Derivations, Scorecards, API Schemas, Deployment Guide", "102"),
    ]

    toc_table_data = []
    for num, title, page in toc_items:
        is_chap = num.startswith("Chapter") or num in ("Front Matter", "Bibliography", "Appendices")
        if is_chap:
            toc_table_data.append(
                [
                    Paragraph(f"<b>{num}</b>", styles["TableCellBold"]),
                    Paragraph(f"<b>{title}</b>", styles["TableCellBold"]),
                    Paragraph(f"<b>{page}</b>", styles["TableCellRight"]),
                ]
            )
        else:
            toc_table_data.append(
                [
                    Paragraph(num, styles["TableCell"]),
                    Paragraph(title, styles["TableCell"]),
                    Paragraph(page, styles["TableCellRight"]),
                ]
            )

    t_toc = Table(toc_table_data, colWidths=[70, 367, 50])
    t_toc.setStyle(
        TableStyle(
            [
                ("LINEBELOW", (0, 0), (-1, -1), 0.3, colors.HexColor("#EAEAEA")),
                ("TOPPADDING", (0, 0), (-1, -1), 2.2),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2.2),
            ]
        )
    )
    story.append(t_toc)
    story.append(PageBreak())

    # =========================================================================
    # 8. LIST OF TABLES (Page 12)
    # =========================================================================
    story.append(Paragraph("List of Tables", styles["ReportChapTitle"]))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#1B365D"), spaceAfter=14))

    lot_items = [
        ("Table 1", "Approval of the Examination Committee and Academic Verification", "ii"),
        ("Table 2", "List of Abbreviations, Acronyms, and Operational Remote Sensing Terms", "vii"),
        ("Table 2.1", "Comparative Synthesis of 10 Satellite Change Detection Systems & Foundation Models", "15"),
        ("Table 3.1", "Stakeholder Persona and Operational Requirement Matrix (MEWA, NCEC, ROSHN)", "26"),
        ("Table 3.2", "Senior Project Defense Readiness Gate Matrix (10 Strict Criteria)", "29"),
        ("Table 4.1", "Copernicus Sentinel-2 MSI Multi-Spectral Band Specifications", "33"),
        ("Table 4.2", "Atmospheric Radiative Transfer: Level-1C (TOA) vs. Level-2A (BOA) Comparison", "35"),
        ("Table 4.3", "Summary of the Four Saudi Reference Benchmark Corridors (91.19 km²)", "42"),
        ("Table 5.1", "Microservices Protocol Topology: Next.js 16 Web Tier vs. FastAPI ML Worker", "45"),
        ("Table 5.2", "Memory Footprint and Pure Compute Latency Profile Across Execution Stages", "51"),
        ("Table 6.1", "Siamese Convolutional Encoder-Decoder Layer Architecture and Skip Connections", "56"),
        ("Table 6.2", "AlphaEarth 64-D Foundation Model Parameterization and Threshold Configurations", "63"),
        ("Table 7.1", "Academic OSCD Benchmark Dataset Composition (24 Bitemporal Scenes)", "70"),
        ("Table 7.2", "Formal Mathematical Definitions of Verification Metrics", "75"),
        ("Table 8.1", "OSCD Academic Benchmark Reproduction Scorecard", "80"),
        ("Table 8.2", "Saudi Deployment Multi-Model Benchmark Leaderboard (7 Paradigms across 91.19 km²)", "82"),
        ("Table 8.3", "Per-Corridor Case Study Evaluation Breakdown (Riyadh, Jeddah, Al-Jouf, Al-Kharj)", "85"),
        ("Table 8.4", "Controlled Ablation Analysis: Isolating the Impact of Physical Spectral Guards", "89"),
        ("Table 8.5", "Hardware Latency and Memory Resource Profiling on Pure CPU", "92"),
        ("Table 9.1", "Senior Project Objective vs. Achievement Verification Matrix", "97"),
        ("Table B.1", "Complete Saudi Reference Ground-Truth Event Catalog (19 Events & 4 Controls)", "103"),
        ("Table B.2", "Comprehensive Multi-Model Saudi Evaluation Matrix across 4 Corridors", "105"),
    ]

    lot_table_data = []
    for num, title, page in lot_items:
        lot_table_data.append(
            [
                Paragraph(f"<b>{num}</b>", styles["TableCellBold"]),
                Paragraph(title, styles["TableCell"]),
                Paragraph(page, styles["TableCellRight"]),
            ]
        )
    t_lot = Table(lot_table_data, colWidths=[70, 367, 50])
    t_lot.setStyle(
        TableStyle(
            [
                ("LINEBELOW", (0, 0), (-1, -1), 0.3, colors.HexColor("#EAEAEA")),
                ("TOPPADDING", (0, 0), (-1, -1), 2.5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
            ]
        )
    )
    story.append(t_lot)
    story.append(PageBreak())

    # =========================================================================
    # 9. LIST OF FIGURES (Page 13)
    # =========================================================================
    story.append(Paragraph("List of Figures & Architectural Blueprints", styles["ReportChapTitle"]))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#1B365D"), spaceAfter=14))

    lof_items = [
        ("Figure 1.1", "Geographic distribution of the four Saudi Reference Benchmark Corridors", "3"),
        ("Figure 1.2", "Hyper-arid spectral challenge: Bare desert regolith vs. pale concrete albedo", "4"),
        ("Figure 2.1", "Taxonomy of satellite change detection paradigms from 1980 to 2026", "9"),
        ("Figure 2.2", "Fully Convolutional Siamese difference concatenation network (FC-Siam-diff)", "12"),
        ("Figure 2.3", "Google AlphaEarth self-supervised embedding projection onto the unit hypersphere", "16"),
        ("Figure 4.1", "Sentinel-2 MSI spectral response functions across visible, NIR, and SWIR bands", "32"),
        ("Figure 4.2", "Scene Classification Layer (SCL) quality filtering and cirrus masking workflow", "35"),
        ("Figure 5.1", "Full-stack system topology: Next.js 16 App Router, FastAPI ML pipeline, and MapLibre GL", "44"),
        ("Figure 5.2", "Server-Sent Events (SSE) bi-directional streaming pipeline and state machine", "46"),
        ("Figure 6.1", "Siamese U-Net encoder-decoder network with skip-difference concatenation", "55"),
        ("Figure 6.2", "Directional Physical Spectral Guard decision tree (ΔNDBI ≥ +0.04 and |ΔNDVI| ≥ 0.10)", "66"),
        ("Figure 7.1", "The Polygon Fragmentation Dilemma: Over-counting artifacts under naive buffering", "72"),
        ("Figure 7.2", "Greedy 1-to-1 bipartite event-matching bipartite graph construction", "73"),
        ("Figure 8.1", "Multi-model Precision-Recall Pareto frontier on the Saudi Deployment Benchmark", "83"),
        ("Figure 8.2", "Hardware latency vs. Event F1 trade-off across candidate paradigms on CPU", "93"),
    ]

    lof_table_data = []
    for num, title, page in lof_items:
        lof_table_data.append(
            [
                Paragraph(f"<b>{num}</b>", styles["TableCellBold"]),
                Paragraph(title, styles["TableCell"]),
                Paragraph(page, styles["TableCellRight"]),
            ]
        )
    t_lof = Table(lof_table_data, colWidths=[70, 367, 50])
    t_lof.setStyle(
        TableStyle(
            [
                ("LINEBELOW", (0, 0), (-1, -1), 0.3, colors.HexColor("#EAEAEA")),
                ("TOPPADDING", (0, 0), (-1, -1), 2.5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2.5),
            ]
        )
    )
    story.append(t_lof)
    story.append(PageBreak())

    # =========================================================================
    # 10. PARSE AND RENDER ALL 9 CHAPTERS
    # =========================================================================
    chapters_order = [
        ("ch01_introduction.tex", "Chapter 1: Introduction", 1),
        ("ch02_literature_review.tex", "Chapter 2: Literature Review and Related Work", 2),
        ("ch03_requirements_methodology.tex", "Chapter 3: Requirements and System Methodology", 3),
        ("ch04_data_acquisition_preprocessing.tex", "Chapter 4: Data Sources, Acquisition, and Preprocessing", 4),
        ("ch05_system_architecture.tex", "Chapter 5: System Architecture and Implementation", 5),
        ("ch06_ai_methodology.tex", "Chapter 6: AI Methodology and Model Development", 6),
        ("ch07_experimental_design.tex", "Chapter 7: Experimental Design and Benchmark Protocol", 7),
        ("ch08_results_discussion.tex", "Chapter 8: Results, Comparative Evaluation, and Discussion", 8),
        ("ch09_conclusion.tex", "Chapter 9: Conclusion and Future Work", 9),
    ]

    for fname, display_title, chap_num in chapters_order:
        fpath = LATEX_DIR / "chapters" / fname
        if not fpath.exists():
            continue

        raw = fpath.read_text(encoding="utf-8")

        # Chapter Banner
        story.append(
            HRFlowable(width="100%", thickness=2.5, color=colors.HexColor("#1B365D"), spaceAfter=10, spaceBefore=0)
        )
        story.append(Paragraph(display_title, styles["ReportChapTitle"]))
        story.append(
            HRFlowable(width="100%", thickness=1, color=colors.HexColor("#0B6623"), spaceAfter=14, spaceBefore=4)
        )

        # Chapter Executive Overview Callout Box
        if chap_num in CHAPTER_OVERVIEWS:
            ov_title, ov_text = CHAPTER_OVERVIEWS[chap_num]
            story.append(create_callout_box(ov_title, ov_text, styles, width=487))
            story.append(Spacer(1, 10))

        # Render chapter body
        parse_and_render_content(raw, chap_num, styles, story)

        if chap_num == 5:
            story.append(Spacer(1, 10))
            story.append(
                Paragraph(
                    "5.7 Full-Stack Microservice Component Interaction Matrix", styles["ReportSecTitle"]
                )
            )
            story.append(create_styled_table(COMPONENT_INTERACTION_ROWS, styles, col_widths=[95, 105, 95, 125, 67]))
            story.append(Spacer(1, 10))
            story.append(
                Paragraph(
                    "5.8 Server-Sent Events (SSE) Streaming State Machine Transitions", styles["ReportSecTitle"]
                )
            )
            story.append(create_styled_table(SSE_STATE_TRANSITIONS_ROWS, styles, col_widths=[50, 125, 55, 145, 112]))
            story.append(Spacer(1, 10))

        if chap_num == 8:
            story.append(Spacer(1, 10))
            story.extend(
                create_figure_plate(
                    DIAG_DIR / "test_01_forensic_diagnostic.png",
                    "Figure 8.1: OSCD Academic Held-Out Forensic Diagnostic Plate (Scene 01: Bi-Temporal RGB, Ground Truth, and Calibrated Siamese Posterior).",
                    styles,
                    max_height=185.0,
                )
            )
            story.extend(
                create_figure_plate(
                    DIAG_DIR / "test_02_forensic_diagnostic.png",
                    "Figure 8.2: OSCD Academic Held-Out Forensic Diagnostic Plate (Scene 02: Spatial Error Decomposition across True Positives and False Positives).",
                    styles,
                    max_height=185.0,
                )
            )
            story.extend(
                create_figure_plate(
                    FIG_DIR / "fig5_leaderboard_pooled_vs_macro.png",
                    "Figure 8.3: Saudi Deployment Multi-Model Leaderboard (v6.1) — Pooled vs. Macro Event F1, Total False Alarms, and Negative Control Zone Hits across 91.19 km².",
                    styles,
                    max_height=190.0,
                )
            )
            story.append(
                Paragraph(
                    "8.3.1 Riyadh Sedra Master-Plan Case Study (Detailed Parcel Breakdown & Satellite Plate)", styles["ReportSecTitle"]
                )
            )
            story.append(create_styled_table(RIYADH_CASE_STUDY_ROWS, styles, col_widths=[90, 70, 42, 62, 62, 36, 36, 89]))
            story.extend(
                create_figure_plate(
                    FIG_DIR / "fig1_riyadh_multimodal_plate.png",
                    "Figure 8.4: Riyadh ROSHN Sedra (17.88 km²) — Authentic Sentinel-2 L2A RGB (2021 vs 2024), Physical ΔNDBI, Google AlphaEarth V1 64-D Cosine Distance, and TerraShift v6.0 Hybrid Detection.",
                    styles,
                    max_height=165.0,
                )
            )
            story.append(
                Paragraph(
                    "8.3.2 Jeddah Obhur Coastal Sabkha Case Study (Detailed Parcel Breakdown & Satellite Plate)", styles["ReportSecTitle"]
                )
            )
            story.append(create_styled_table(JEDDAH_CASE_STUDY_ROWS, styles, col_widths=[90, 70, 42, 62, 62, 36, 36, 89]))
            story.extend(
                create_figure_plate(
                    FIG_DIR / "fig2_jeddah_multimodal_plate.png",
                    "Figure 8.5: Jeddah North Obhur (18.31 km²) — Coastal Infill vs. Sabkha Negative Control Zone (Red Dashed Box: 9 False Alarms in Standalone AlphaEarth vs. 0 in TerraShift v6.0 Hybrid).",
                    styles,
                    max_height=165.0,
                )
            )
            story.append(
                Paragraph(
                    "8.3.3 Al-Jouf Sirhan Circular Pivot Agricultural Case Study & Satellite Plate", styles["ReportSecTitle"]
                )
            )
            story.append(create_styled_table(ALJOUF_CASE_STUDY_ROWS, styles, col_widths=[90, 70, 42, 62, 62, 36, 36, 89]))
            story.extend(
                create_figure_plate(
                    FIG_DIR / "fig3_aljouf_multimodal_plate.png",
                    "Figure 8.6: Al-Jouf Wadi As-Sirhan (26.82 km²) — 50-Hectare Center-Pivot Irrigation Dynamics (Physical ΔNDVI, AlphaEarth V1 64-D Cosine Distance, and TerraShift v6.0 Hybrid Consensus).",
                    styles,
                    max_height=165.0,
                )
            )
            story.append(
                Paragraph(
                    "8.3.4 Al-Kharj Held-Out Corridor Generalization Case Study & Satellite Plate", styles["ReportSecTitle"]
                )
            )
            story.append(create_styled_table(ALKHARJ_CASE_STUDY_ROWS, styles, col_widths=[90, 70, 42, 62, 62, 36, 36, 89]))
            story.extend(
                create_figure_plate(
                    FIG_DIR / "fig4_alkharj_heldout_plate.png",
                    "Figure 8.7: Held-Out Al-Kharj Industrial & Agricultural Corridor (28.18 km²) — Frozen-Hyperparameter Generalization (100% Recall, 62.5% Strict Precision, 0 Negative Zone Hits).",
                    styles,
                    max_height=165.0,
                )
            )
            story.append(
                Paragraph(
                    "8.4.1 Localization Threshold Sensitivity Sweep (4-Regime Robustness Audit)", styles["ReportSecTitle"]
                )
            )
            story.append(create_styled_table(LOCALIZATION_SENSITIVITY_ROWS, styles, col_widths=[127, 90, 90, 90, 90]))
            story.extend(
                create_figure_plate(
                    FIG_DIR / "fig6_localization_sensitivity_curve.png",
                    "Figure 8.8: Localization Purity Threshold Sensitivity Sweep (Relaxed, Standard, Moderate, Strict PoC/IoU Regimes) and Progressive False-Alarm Suppression.",
                    styles,
                    max_height=185.0,
                )
            )
            story.append(Spacer(1, 10))
            story.extend(render_defense_qa_section(DEFENSE_QA_PAIRS, styles))
            story.append(Spacer(1, 10))

        # Chapter Summary & Defense Takeaways Callout Box
        if chap_num in CHAPTER_SUMMARIES:
            sum_title, sum_items = CHAPTER_SUMMARIES[chap_num]
            story.append(Spacer(1, 10))
            story.append(create_takeaway_box(sum_title, sum_items, styles, width=487))
            story.append(Spacer(1, 10))

        story.append(PageBreak())

    # =========================================================================
    # 11. BIBLIOGRAPHY (36 VERIFIED CITATIONS)
    # =========================================================================
    story.append(
        HRFlowable(width="100%", thickness=2.5, color=colors.HexColor("#1B365D"), spaceAfter=10, spaceBefore=0)
    )
    story.append(Paragraph("Bibliography", styles["ReportChapTitle"]))
    story.append(
        Paragraph("Verified Peer-Reviewed Academic Citations with Real DOIs and arXiv Identifiers", styles["CoverMeta"])
    )
    story.append(
        HRFlowable(width="100%", thickness=1, color=colors.HexColor("#0B6623"), spaceAfter=14, spaceBefore=4)
    )

    bib_file = LATEX_DIR / "references.bib"
    if bib_file.exists():
        bib_raw = bib_file.read_text(encoding="utf-8")
        entries = re.split(r"@\w+\{", bib_raw)[1:]
        for idx, entry in enumerate(entries, start=1):
            key = entry.split(",")[0].strip()
            title_m = re.search(r"title\s*=\s*\{([^}]+)\}", entry, re.IGNORECASE)
            author_m = re.search(r"author\s*=\s*\{([^}]+)\}", entry, re.IGNORECASE)
            journal_m = re.search(r"(?:journal|booktitle)\s*=\s*\{([^}]+)\}", entry, re.IGNORECASE)
            year_m = re.search(r"year\s*=\s*\{([^}]+)\}", entry, re.IGNORECASE)
            doi_m = re.search(r"doi\s*=\s*\{([^}]+)\}", entry, re.IGNORECASE)

            title = title_m.group(1).replace("{", "").replace("}", "") if title_m else key
            authors = author_m.group(1) if author_m else "Unknown Authors"
            venue = journal_m.group(1).replace("{", "").replace("}", "") if journal_m else "Technical Publication"
            year = year_m.group(1) if year_m else "2024"
            doi_str = f" · <b>DOI:</b> {doi_m.group(1)}" if doi_m else ""

            bib_entry_text = f"<b>[{idx}]</b> {authors}, \"{title}\", <i>{venue}</i>, {year}{doi_str}."
            story.append(Paragraph(bib_entry_text, styles["ReportBody"]))
            story.append(Spacer(1, 3))

    story.append(PageBreak())

    # =========================================================================
    # 12. APPENDICES A, B, C, D
    # =========================================================================
    appendices_order = [
        ("appendix_a_derivations.tex", "Appendix A: Mathematical Derivations and Proofs", "A"),
        ("appendix_b_scorecards.tex", "Appendix B: Complete Empirical Scorecards & Event Catalog", "B"),
        ("appendix_c_api_schemas.tex", "Appendix C: REST API Specification & GeoJSON Schemas", "C"),
        ("appendix_d_deployment_guide.tex", "Appendix D: System Deployment and Replication Manual", "D"),
    ]

    for fname, app_title, app_letter in appendices_order:
        fpath = LATEX_DIR / "appendices" / fname
        if not fpath.exists():
            continue

        raw = fpath.read_text(encoding="utf-8")
        story.append(
            HRFlowable(width="100%", thickness=2, color=colors.HexColor("#1B365D"), spaceAfter=10, spaceBefore=0)
        )
        story.append(Paragraph(app_title, styles["ReportChapTitle"]))
        story.append(
            HRFlowable(width="100%", thickness=0.8, color=colors.HexColor("#0B6623"), spaceAfter=12, spaceBefore=2)
        )

        parse_and_render_content(raw, f"App {app_letter}", styles, story)

        if app_letter == "A":
            story.append(Spacer(1, 10))
            story.append(
                Paragraph(
                    "A.4 Gradient Formulation of Soft Dice Loss for Backpropagation",
                    styles["ReportSecTitle"],
                )
            )
            dice_proof_text = """To guarantee smooth convergence during severe spatial class imbalance (where change pixels constitute less than 5% of the total scene), the Siamese U-Net loss function incorporates Soft Dice loss:
<br/><br/>
&nbsp;&nbsp;&nbsp;&nbsp;<b>L_Dice(p, y) = 1 - (2 * sum_i(p_i * y_i) + eps) / (sum_i(p_i^2) + sum_i(y_i^2) + eps)</b>
<br/><br/>
Taking the partial derivative with respect to predicted logit activation probability p_k:
<br/><br/>
&nbsp;&nbsp;&nbsp;&nbsp;<b>dL_Dice / dp_k = -2 * [ y_k * (sum_i(p_i^2) + sum_i(y_i^2) + eps) - 2 * p_k * (sum_i(p_i * y_i) + eps) ] / (sum_i(p_i^2) + sum_i(y_i^2) + eps)^2</b>
<br/><br/>
Notice that when ground truth y_k = 1 and prediction p_k -> 0 (a false negative), the numerator remains strictly positive and proportional to the overall target volume, driving strong corrective gradient updates even when 99% of background pixels have zero gradient. Conversely, for background pixels y_k = 0, the gradient gently penalizes false positives without causing exploding gradients."""
            story.append(create_callout_box("Mathematical Derivation: Soft Dice Backpropagation Dynamics", dice_proof_text, styles, width=487))
            story.append(Spacer(1, 10))

        if app_letter == "B":
            story.append(Spacer(1, 10))
            story.append(
                Paragraph(
                    "B.2 Comprehensive Multi-Model Performance Matrix across All Four Corridors",
                    styles["ReportSecTitle"],
                )
            )
            story.append(create_styled_table(APPENDIX_B_SCORECARD_ROWS, styles, col_widths=[115, 80, 40, 30, 35, 35, 52, 50, 50]))
            story.append(Spacer(1, 10))
            story.append(
                Paragraph(
                    "B.3 Corridor Confusion Matrices (TerraShift v6.0 Hybrid vs. v5.1 vs. Standalone AlphaEarth)",
                    styles["ReportSecTitle"],
                )
            )
            story.append(create_styled_table(CONFUSION_MATRIX_RIYADH_ROWS, styles))
            story.append(Spacer(1, 8))
            story.append(create_styled_table(CONFUSION_MATRIX_JEDDAH_ROWS, styles))
            story.append(Spacer(1, 8))
            story.append(create_styled_table(CONFUSION_MATRIX_ALJOUF_ROWS, styles))
            story.append(Spacer(1, 8))
            story.append(create_styled_table(CONFUSION_MATRIX_ALKHARJ_ROWS, styles))
            story.append(Spacer(1, 10))

        if app_letter == "C":
            story.append(Spacer(1, 10))
            story.append(Paragraph("C.4 REST API Endpoints Specification Matrix", styles["ReportSecTitle"]))
            story.append(create_styled_table(API_ENDPOINTS_ROWS, styles, col_widths=[45, 100, 110, 110, 122]))
            story.append(Spacer(1, 10))

        if app_letter == "D":
            story.append(Spacer(1, 10))
            story.append(Paragraph("D.7 Host System & Runtime Deployment Prerequisites", styles["ReportSecTitle"]))
            story.append(create_styled_table(DEPLOYMENT_PREREQS_ROWS, styles, col_widths=[90, 110, 140, 147]))
            story.append(Spacer(1, 10))
            story.append(Paragraph("D.8 Production Environment Configuration Variables", styles["ReportSecTitle"]))
            story.append(create_styled_table(DEPLOYMENT_ENV_ROWS, styles, col_widths=[140, 95, 150, 102]))
            story.append(Spacer(1, 10))
            story.append(
                Paragraph(
                    "D.9 Senior Project Defense Readiness Verification Checklist", styles["ReportSecTitle"]
                )
            )
            story.append(create_styled_table(VERIFICATION_CHECKLIST_ROWS, styles, col_widths=[45, 145, 95, 130, 72]))
            story.append(Spacer(1, 10))

        story.append(PageBreak())

    # Build PDF with dynamic NumberedCanvas
    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"Successfully generated senior project PDF: {OUTPUT_PDF}", flush=True)


if __name__ == "__main__":
    build_senior_project_pdf()
