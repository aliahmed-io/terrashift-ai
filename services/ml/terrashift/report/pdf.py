import base64
import io
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.platypus import Image as RLImage, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

INK = colors.HexColor("#0A0F16")
SIGNAL = colors.HexColor("#0284C7")
MUTED = colors.HexColor("#2B3545")
RULE = colors.HexColor("#E1E4E8")


def _decode_rl_image(b64_str: str, width: float = 240, height: float = 160) -> Optional[RLImage]:
    try:
        raw = b64_str.split(",", 1)[-1]
        data = base64.b64decode(raw)
        return RLImage(io.BytesIO(data), width=width, height=height)
    except Exception:
        return None


def generate_pdf_report(
    metadata: Dict[str, Any],
    features: List[Dict[str, Any]],
    image_t1_base64: Optional[str] = None,
    image_t2_base64: Optional[str] = None,
    overlay_base64: Optional[str] = None,
) -> bytes:
    """Generate a change-detection audit report from an analysis result."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=36, leftMargin=36, topMargin=36, bottomMargin=36)
    styles = getSampleStyleSheet()

    eyebrow = ParagraphStyle("Eyebrow", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=8.5, leading=11, textColor=SIGNAL)
    title = ParagraphStyle("Title", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=20, leading=24, textColor=INK)
    body = ParagraphStyle("Body", parent=styles["Normal"], fontName="Helvetica", fontSize=8.5, leading=12, textColor=MUTED)
    h2 = ParagraphStyle("H2", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=11, leading=15, textColor=INK)
    fine = ParagraphStyle("Fine", parent=styles["Normal"], fontSize=7, leading=10, textColor=colors.gray)

    total_km2 = float(metadata.get("total_changed_km2", 0.0))
    total_m2 = float(metadata.get("total_changed_m2", total_km2 * 1_000_000))
    aoi_km2 = float(metadata.get("aoi_km2", 0.0))
    changed_pct = float(metadata.get("changed_pct", 0.0))
    count = int(metadata.get("polygon_count", len(features)))
    confidences = [float(f.get("properties", {}).get("confidence", 0.0)) for f in features]
    mean_conf = sum(confidences) / len(confidences) * 100.0 if confidences else 0.0
    generated = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    stac_info = metadata.get("stac_provenance", {})
    t1_scene = stac_info.get("scene_t1_id", "Sentinel-2 L2A Mosaic")
    t2_scene = stac_info.get("scene_t2_id", "Sentinel-2 L2A Mosaic")

    story: List[Any] = [
        Paragraph("TERRASHIFT AI - SATELLITE AUDIT", eyebrow),
        Spacer(1, 3),
        Paragraph("Surface Change Verification Report", title),
        Spacer(1, 10),
    ]

    meta_rows = [
        [Paragraph("<b>Baseline Epoch (T₁)</b>", body), Paragraph(f"{metadata.get('date_t1', '')} · {t1_scene[:32]}", body),
         Paragraph("<b>Target Epoch (T₂)</b>", body), Paragraph(f"{metadata.get('date_t2', '')} · {t2_scene[:32]}", body)],
        [Paragraph("<b>Study Area (AOI)</b>", body), Paragraph(f"{aoi_km2:.2f} km²", body),
         Paragraph("<b>Generated</b>", body), Paragraph(generated, body)],
        [Paragraph("<b>Sensor / Source</b>", body), Paragraph("Sentinel-2 MSI Cloudless", body),
         Paragraph("<b>Model / Method</b>", body), Paragraph("PyTorch Siamese U-Net + Radiometric Fusion", body)],
    ]
    meta_table = Table(meta_rows, colWidths=[110, 160, 110, 160])
    meta_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F8FAFC")),
        ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#CBD5E1")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, RULE),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    story += [meta_table, Spacer(1, 12), Paragraph("Quantified Metrics", h2), Spacer(1, 4)]

    kpi_rows = [
        [Paragraph("<b>Changed Area</b>", body), Paragraph("<b>Share of AOI</b>", body),
         Paragraph("<b>Polygons</b>", body), Paragraph("<b>Mean Confidence</b>", body)],
        [Paragraph(f"<font size=13><b>{total_km2:.3f} km²</b></font><br/>{total_m2:,.0f} m²", body),
         Paragraph(f"<font size=13><b>{changed_pct:.2f}%</b></font>", body),
         Paragraph(f"<font size=13><b>{count}</b></font>", body),
         Paragraph(f"<font size=13><b>{mean_conf:.1f}%</b></font>", body)],
    ]
    kpi_table = Table(kpi_rows, colWidths=[135, 135, 135, 135])
    kpi_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), INK),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("BOX", (0, 0), (-1, -1), 1, INK),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, RULE),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story += [kpi_table, Spacer(1, 12)]

    # Embed side-by-side satellite imagery if provided
    img1 = _decode_rl_image(image_t1_base64, width=260, height=150) if image_t1_base64 else None
    img2 = _decode_rl_image(image_t2_base64, width=260, height=150) if image_t2_base64 else None
    if img1 and img2:
        story += [
            Paragraph("Bi-Temporal Satellite Observation", h2),
            Spacer(1, 4),
            Table(
                [
                    [Paragraph(f"<b>Baseline Imagery ({metadata.get('date_t1', 'T1')})</b>", body),
                     Paragraph(f"<b>Target Imagery ({metadata.get('date_t2', 'T2')})</b>", body)],
                    [img1, img2],
                ],
                colWidths=[270, 270],
                style=[
                    ("BOX", (0, 0), (-1, -1), 1, RULE),
                    ("INNERGRID", (0, 0), (-1, -1), 0.5, RULE),
                    ("TOPPADDING", (0, 0), (-1, -1), 4),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                    ("ALIGN", (0, 1), (-1, 1), "CENTER"),
                ],
            ),
            Spacer(1, 12),
        ]

    story += [Paragraph("Detected Change Inventory", h2), Spacer(1, 4)]
    rows: List[List[str]] = [["ID", "Semantic Class", "Area (ha)", "Confidence"]]
    for f in features[:20]:
        p = f.get("properties", {})
        rows.append([
            f"#{int(p.get('id', 0)):02d}",
            str(p.get("label", "Surface change")),
            f"{float(p.get('area_m2', 0.0)) / 10000.0:.2f}",
            f"{float(p.get('confidence', 0.0)) * 100:.0f}%",
        ])
    inventory = Table(rows, colWidths=[45, 275, 110, 110])
    inventory.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1E293B")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.5, RULE),
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 3.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3.5),
    ]))
    story += [
        inventory,
        Spacer(1, 14),
        Paragraph(
            "Notice: Surface changes are detected between multi-temporal Sentinel-2 MSI observations using PyTorch "
            "Siamese U-Net feature differencing and radiometric index matching. Coordinates and areas are geodesic (WGS84).",
            fine,
        ),
    ]
    doc.build(story)
    return buffer.getvalue()
