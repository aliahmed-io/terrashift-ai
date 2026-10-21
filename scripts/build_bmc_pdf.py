"""Generate executive presentation-ready Business Model Canvas PDF for TerraShift AI."""

import os
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

def build_pdf(filename: str):
    doc = SimpleDocTemplate(
        filename,
        pagesize=landscape(A4),
        leftMargin=24,
        rightMargin=24,
        topMargin=20,
        bottomMargin=20,
    )

    styles = getSampleStyleSheet()

    # Minimal professional styling
    c_primary = colors.HexColor("#0F172A")    # Deep slate
    c_accent = colors.HexColor("#0284C7")     # Ocean cyan / blue
    c_border = colors.HexColor("#CBD5E1")     # Clean slate border
    c_bg_box = colors.HexColor("#F8FAFC")     # Soft light background
    c_bg_header = colors.HexColor("#F1F5F9")  # Header background
    c_text_dark = colors.HexColor("#1E293B")  # Dark charcoal body
    c_text_muted = colors.HexColor("#64748B") # Muted label

    h_title = ParagraphStyle(
        "DocTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=15,
        leading=18,
        textColor=c_primary,
    )
    h_sub = ParagraphStyle(
        "DocSub",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8,
        leading=11,
        textColor=c_text_muted,
    )
    b_header = ParagraphStyle(
        "BoxHeader",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=8.5,
        leading=11,
        textColor=c_accent,
    )
    b_num = ParagraphStyle(
        "BoxNum",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=10,
        leading=12,
        textColor=c_accent,
        alignment=2, # Right align
    )
    b_body = ParagraphStyle(
        "BoxBody",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=6.8,
        leading=9.2,
        textColor=c_text_dark,
    )
    b_strong = ParagraphStyle(
        "BoxStrong",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=6.8,
        leading=9.2,
        textColor=c_primary,
    )

    def make_cell(num_str: str, title: str, bullet_items: list[tuple[str, str]]):
        """Constructs an individual Osterwalder block with number badge and structured bullet points."""
        header_table = Table(
            [[Paragraph(title.upper(), b_header), Paragraph(f"#{num_str}", b_num)]],
            colWidths=[118, 30],
        )
        header_table.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
            ("TOPPADDING", (0, 0), (-1, -1), 0),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ]))

        flowables = [header_table, Spacer(1, 3)]
        for label, desc in bullet_items:
            text = f"<b>• {label}:</b> {desc}" if label else f"• {desc}"
            flowables.append(Paragraph(text, b_body))
            flowables.append(Spacer(1, 2))
        return flowables

    # Data for the 9 Osterwalder Building Blocks
    p_partners = make_cell("7", "Key Partners", [
        ("Space Agencies", "ESA Copernicus Sentinel-2 open constellation & NASA USGS Landsat."),
        ("Commercial Tasking", "Planet Labs (3m daily SuperDoves) & Maxar (30cm high-res optical)."),
        ("STAC & Cloud Catalogs", "Element84 & AWS Open Data Earth Search cloudless composites."),
        ("Sovereign Hosting", "KSA cloud zones (AWS Bahrain/GCP Dammam/CNTXT) for data residency."),
        ("GIS Ecosystem", "Esri ArcGIS Enterprise and QGIS plugin interoperability networks."),
        ("Academic R&D", "KAUST & KACST for marine blue-carbon & arid soil flux verification."),
    ])

    p_activities = make_cell("5", "Key Activities", [
        ("Siamese AI R&D", "Training bi-temporal ResU-Net models on LEVIR-CD & OSCD benchmarks."),
        ("Automated Ingest", "Continuous Sentinel-2 orbital scene ingestion & disk tile caching."),
        ("Predictive BFAST", "Harmonic breakpoint decomposition & 2030 completion trajectories."),
        ("Carbon Modeling", "IPCC Tier-1 4-pool biomass flux & thermal ΔLST urban cooling."),
        ("Audit Generation", "Producing tamper-evident verifiable PDF compliance dossiers."),
    ])

    p_resources = make_cell("6", "Key Resources", [
        ("Proprietary Checkpoints", "Trained weights (siamese_unet_checkpoint.pt) with τ calibration."),
        ("Global Tile Archives", "Multi-year Sentinel-2 cloudless composite cache (2017–2025)."),
        ("Compute Infrastructure", "High-throughput NVIDIA GPU clusters for low-latency SSE inference."),
        ("Interdisciplinary Team", "Remote sensing geodesists, computer vision ML scientists & full-stack eng."),
        ("Regional Baselines", "Curated ground-truth masks across NEOM, Riyadh, Red Sea & Amazon."),
    ])

    p_value_prop = make_cell("1", "Value Propositions", [
        ("Zero-Noise Change AI", "Physics-guided Siamese U-Net neutralizes solar angle and seasonal noise down to exact m²."),
        ("BFAST 2030 Trajectory", "Non-parametric breakpoint forecasting isolates structural velocity and completion horizons."),
        ("IPCC Carbon Verification", "4-pool carbon accounting (AGB, BGB, SOC, Dead Wood) + urban heat island mitigation."),
        ("Verifiable Audit Dossiers", "Instant one-click executive PDFs embedding raw satellite rasters and STAC scene IDs."),
        ("95% Cost & 100x Speedup", "Replaces $1,200/km² drone and manual surveyor passes with automated <10s satellite telemetry."),
        ("Cross-Module Continuity", "Custom user-drawn AOI instantly synchronized across Map, Timeline, Benchmarks & Carbon."),
    ])

    p_relationships = make_cell("4", "Customer Relationships", [
        ("Solutions Engineering", "Dedicated GIS architects assisting with historical baseline & CRS setup."),
        ("Automated Monitoring", "Scheduled 5-day Sentinel-2 pass ingestion with threshold breach alerts."),
        ("Audit-Grade Deliverables", "Cryptographically referenced compliance PDFs ready for board / ministry review."),
        ("Enterprise SLA", "99.9% API uptime, dedicated GPU inference queues, and model retraining cycles."),
    ])

    p_channels = make_cell("3", "Channels", [
        ("Direct Enterprise / B2G", "Dedicated sales to Vision 2030 Delivery Units, PIF entities & master EPCs."),
        ("Web Map Studio", "Self-service browser SaaS application with interactive WebGL layers & loupe."),
        ("REST & STAC 1.0.0 API", "Headless machine-to-machine endpoints for enterprise data lakes & GIS."),
        ("GIS Marketplace Plugins", "Native extensions for Esri ArcGIS Pro & QGIS workflows."),
        ("Industry Summits", "Live keynotes & telemetry demonstrations at LEAP, Cityscape & COP Summits."),
    ])

    p_segments = make_cell("2", "Customer Segments", [
        ("Megaproject PMOs & EPCs", "NEOM (The Line/Oxagon), Red Sea Global, ROSHN, Qiddiya, Diriyah Gate."),
        ("Sovereign Urban Planners", "Royal Commission for Riyadh City (RCRC), MEWA, Saudi Green Initiative (SGI)."),
        ("ESG & Carbon Auditors", "Independent carbon offset registries, Verra, RVCM & climate compliance bodies."),
        ("Infrastructure Insurers", "Global reinsurance firms & sovereign wealth funds auditing asset deployment."),
        ("Multi-Sided Dynamics", "Developers track execution speed; regulators & investors independently verify claims."),
    ])

    def make_wide_cell(num_str: str, title: str, bullet_items: list[tuple[str, str]]):
        header_table = Table(
            [[Paragraph(title.upper(), b_header), Paragraph(f"#{num_str}", b_num)]],
            colWidths=[310, 40],
        )
        header_table.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
            ("TOPPADDING", (0, 0), (-1, -1), 0),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ]))
        flowables = [header_table, Spacer(1, 2)]
        for label, desc in bullet_items:
            text = f"<b>• {label}:</b> {desc}" if label else f"• {desc}"
            flowables.append(Paragraph(text, b_body))
            flowables.append(Spacer(1, 1.5))
        return flowables

    p_costs = make_wide_cell("9", "Cost Structure", [
        ("Cloud Compute & GPU Inference (25–30%)", "NVIDIA A100/L40S clusters, high-speed NVMe tile caches, vector storage."),
        ("Commercial Satellite Ingestion (20–25%)", "Wholesale API licensing for on-demand PlanetScope 3m & Maxar 30cm tasking passes."),
        ("R&D & Engineering Payroll (35–40%)", "Specialized compensation for Computer Vision Researchers, Geodesists & Full-Stack Engineers."),
        ("Enterprise Sales & Compliance (10–15%)", "Government RFP procurement teams, ISO/SOC2 audits, sovereign cloud certifications."),
    ])

    p_revenue = make_wide_cell("8", "Revenue Streams", [
        ("Annual SaaS Subscriptions", "Pro ($24k/yr, 2.5k km²), Enterprise ($75k/yr, 15k km²), Sovereign/Gov ($250k+/yr, unlimited)."),
        ("Usage-Based AOI Volume Surcharge", "Metered expansion pricing at $0.75 – $2.50 per monitored km² / month beyond base tier."),
        ("High-Res Tasking Pass-Through (25% Margin)", "Direct on-demand commercial satellite tasking markup processed via Siamese engine."),
        ("Bespoke Enterprise Deployments", "Custom on-premises air-gapped sovereign installations & custom land-class model calibration."),
    ])

    col_w = 158.8  # Total = 794 pt (fits within 842 pt A4 landscape width)
    top_grid_data = [
        [p_partners, p_activities, p_value_prop, p_relationships, p_segments],
        ["", p_resources, "", p_channels, ""],
    ]

    top_table = Table(
        top_grid_data,
        colWidths=[col_w, col_w, col_w, col_w, col_w],
        rowHeights=[185, 185],
    )
    top_table.setStyle(TableStyle([
        ("SPAN", (0, 0), (0, 1)), # Partners spans full height
        ("SPAN", (2, 0), (2, 1)), # Value prop spans full height
        ("SPAN", (4, 0), (4, 1)), # Segments spans full height
        ("BACKGROUND", (0, 0), (-1, -1), c_bg_box),
        ("BOX", (0, 0), (-1, -1), 1, c_border),
        ("INNERGRID", (0, 0), (-1, -1), 0.75, c_border),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))

    bottom_grid_data = [
        [p_costs, p_revenue]
    ]
    bottom_table = Table(
        bottom_grid_data,
        colWidths=[col_w * 2.5, col_w * 2.5],
        rowHeights=[115],
    )
    bottom_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), c_bg_box),
        ("BOX", (0, 0), (-1, -1), 1, c_border),
        ("INNERGRID", (0, 0), (-1, -1), 0.75, c_border),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))

    # Title Banner
    header_block = Table(
        [[
            Paragraph("<b>TERRASHIFT AI</b> — BUSINESS MODEL CANVAS", h_title),
            Paragraph("<b>STRATEGIC ENTERPRISE SPECIFICATION</b> · VISION 2030 & GLOBAL EARTH OBSERVATION", h_sub),
        ]],
        colWidths=[450, 344],
    )
    header_block.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "BOTTOM"),
        ("ALIGN", (1, 0), (1, 0), "RIGHT"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ]))

    story = [
        header_block,
        Spacer(1, 8),
        top_table,
        Spacer(1, 6),
        bottom_table,
    ]

    doc.build(story)
    print(f"Successfully generated {filename}")

if __name__ == "__main__":
    out_pdf = os.path.abspath("TerraShift_AI_Business_Model_Canvas.pdf")
    build_pdf(out_pdf)
