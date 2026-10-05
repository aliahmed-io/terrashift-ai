"""Automated geospatial PDF audit report generator."""

import io
from datetime import datetime, timezone
from typing import Any, Dict, List

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

INK = colors.HexColor("#0A0F16")
SIGNAL = colors.HexColor("#E08A00")
MUTED = colors.HexColor("#2B3545")
RULE = colors.HexColor("#E1E4E8")


def generate_pdf_report(
    metadata: Dict[str, Any],
    features: List[Dict[str, Any]],
) -> bytes:
    """Generate a change-detection audit report from an analysis result."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=40, leftMargin=40, topMargin=40, bottomMargin=40)
    styles = getSampleStyleSheet()

    eyebrow = ParagraphStyle("Eyebrow", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=9, leading=12, textColor=SIGNAL)
    title = ParagraphStyle("Title", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=22, leading=26, textColor=INK)
    body = ParagraphStyle("Body", parent=styles["Normal"], fontName="Helvetica", fontSize=9, leading=13, textColor=MUTED)
    h2 = ParagraphStyle("H2", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=12, leading=16, textColor=INK)
    fine = ParagraphStyle("Fine", parent=styles["Normal"], fontSize=7, leading=10, textColor=colors.gray)

    total_km2 = float(metadata.get("total_changed_km2", 0.0))
    total_m2 = float(metadata.get("total_changed_m2", total_km2 * 1_000_000))
    aoi_km2 = float(metadata.get("aoi_km2", 0.0))
    changed_pct = float(metadata.get("changed_pct", 0.0))
    count = int(metadata.get("polygon_count", len(features)))
    confidences = [float(f.get("properties", {}).get("confidence", 0.0)) for f in features]
    mean_conf = sum(confidences) / len(confidences) * 100.0 if confidences else 0.0
    generated = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    story: List[Any] = [
        Paragraph("TERRASHIFT AI - SATELLITE AUDIT", eyebrow),
        Spacer(1, 4),
        Paragraph("Surface Change Report", title),
        Spacer(1, 14),
    ]

    meta_rows = [
        [Paragraph("<b>Baseline year</b>", body), Paragraph(str(metadata.get("date_t1", "")), body),
         Paragraph("<b>Comparison year</b>", body), Paragraph(str(metadata.get("date_t2", "")), body)],
        [Paragraph("<b>Study area</b>", body), Paragraph(f"{aoi_km2:.2f} km2", body),
         Paragraph("<b>Generated</b>", body), Paragraph(generated, body)],
        [Paragraph("<b>Imagery</b>", body), Paragraph("Sentinel-2 cloudless composite", body),
         Paragraph("<b>Method</b>", body), Paragraph("Radiometric matching + statistical change", body)],
    ]
    meta_table = Table(meta_rows, colWidths=[100, 160, 100, 160])
    meta_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F4F6F8")),
        ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#D0D7DE")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, RULE),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story += [meta_table, Spacer(1, 18), Paragraph("Quantified change", h2), Spacer(1, 6)]

    kpi_rows = [
        [Paragraph("<b>Changed area</b>", body), Paragraph("<b>Share of study area</b>", body),
         Paragraph("<b>Polygons</b>", body), Paragraph("<b>Mean confidence</b>", body)],
        [Paragraph(f"<font size=14><b>{total_km2:.3f} km2</b></font><br/>{total_m2:,.0f} m2", body),
         Paragraph(f"<font size=14><b>{changed_pct:.2f}%</b></font>", body),
         Paragraph(f"<font size=14><b>{count}</b></font>", body),
         Paragraph(f"<font size=14><b>{mean_conf:.1f}%</b></font>", body)],
    ]
    kpi_table = Table(kpi_rows, colWidths=[140, 130, 120, 130])
    kpi_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), INK),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("BOX", (0, 0), (-1, -1), 1, INK),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, RULE),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    story += [kpi_table, Spacer(1, 18), Paragraph("Polygon inventory", h2), Spacer(1, 6)]

    rows: List[List[str]] = [["ID", "Class", "Area (ha)", "Confidence"]]
    for f in features[:25]:
        p = f.get("properties", {})
        rows.append([
            f"#{int(p.get('id', 0)):02d}",
            str(p.get("label", "Surface change")),
            f"{float(p.get('area_m2', 0.0)) / 10000.0:.2f}",
            f"{float(p.get('confidence', 0.0)) * 100:.0f}%",
        ])
    inventory = Table(rows, colWidths=[50, 270, 100, 90])
    inventory.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1B2533")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.5, RULE),
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story += [
        inventory,
        Spacer(1, 22),
        Paragraph(
            "Notice: changes are detected between two annual cloud-free Sentinel-2 composites after matching their "
            "per-channel radiometry; pixels above a robust median + 4 MAD threshold are grouped into polygons. "
            "Areas are geodesic (WGS84). Annual composites can contain compositing artefacts, so verify "
            "high-stakes findings against source scenes.",
            fine,
        ),
    ]
    doc.build(story)
    return buffer.getvalue()
