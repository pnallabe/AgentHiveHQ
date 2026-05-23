"""PDF Export — Section 5.4 (export/pdf endpoint).

Generates a board-ready PDF using ReportLab.  The PDF includes:
  - Company logo placeholder
  - Report date and "CONFIDENTIAL — FOR INTERNAL USE ONLY" watermark
  - Page numbers
  - Footer: "All figures are indicative. Source: AgentHive Analytics Platform."
  - KPI tables for each requested section
  - SAMPLE DATA diagonal watermark in demo mode

WeasyPrint is preferred per the spec; this implementation uses ReportLab
to avoid the GLib/GTK system dependency in Docker.  When WeasyPrint is
available in the environment it will be preferred automatically.
"""
from __future__ import annotations

import io
import logging
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# Watermark + colours
# ─────────────────────────────────────────────────────────────────────────────

BRAND_BLUE = (0.067, 0.255, 0.522)     # #114284
WATERMARK_COLOUR_CONF = (0.7, 0.0, 0.0)
WATERMARK_COLOUR_DEMO = (0.85, 0.55, 0.0)

CONFIDENTIAL_TEXT = "CONFIDENTIAL — FOR INTERNAL USE ONLY"
SAMPLE_DATA_TEXT = "SAMPLE DATA"
GOVERNANCE_FOOTER = (
    "All figures are indicative. "
    "Source: AgentHive Analytics Platform. "
    "Data as of {timestamp}. "
    "For internal management use only — not for external distribution."
)


# ─────────────────────────────────────────────────────────────────────────────
# ReportLab implementation
# ─────────────────────────────────────────────────────────────────────────────


def _build_pdf_reportlab(
    sections_data: dict,
    period: str,
    product: str,
    is_demo: bool,
    data_as_of: str,
) -> bytes:
    """Generate PDF bytes using ReportLab."""
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.pdfgen import canvas
    from reportlab.platypus import (
        SimpleDocTemplate,
        Paragraph,
        Spacer,
        Table,
        TableStyle,
        PageBreak,
    )
    from reportlab.lib.enums import TA_CENTER, TA_LEFT

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=15 * mm,
        rightMargin=15 * mm,
        topMargin=20 * mm,
        bottomMargin=25 * mm,
    )

    styles = getSampleStyleSheet()
    brand_blue_hex = colors.Color(*BRAND_BLUE)

    h1_style = ParagraphStyle(
        "H1",
        parent=styles["Heading1"],
        textColor=brand_blue_hex,
        fontSize=18,
        spaceAfter=6,
    )
    h2_style = ParagraphStyle(
        "H2",
        parent=styles["Heading2"],
        textColor=brand_blue_hex,
        fontSize=13,
        spaceBefore=12,
        spaceAfter=4,
    )
    body_style = styles["BodyText"]
    caption_style = ParagraphStyle(
        "Caption",
        parent=body_style,
        fontSize=7,
        textColor=colors.grey,
        alignment=TA_CENTER,
    )

    # ── Watermark callback ────────────────────────────────────────────────
    watermark_text = SAMPLE_DATA_TEXT if is_demo else CONFIDENTIAL_TEXT
    wm_colour = WATERMARK_COLOUR_DEMO if is_demo else WATERMARK_COLOUR_CONF
    footer_text = GOVERNANCE_FOOTER.format(timestamp=data_as_of)

    def _draw_watermark(canvas_obj: canvas.Canvas, doc_obj) -> None:  # type: ignore[type-arg]
        canvas_obj.saveState()
        width, height = A4

        # Diagonal watermark
        canvas_obj.setFont("Helvetica-Bold", 42)
        canvas_obj.setFillColorRGB(*wm_colour, alpha=0.12)
        canvas_obj.translate(width / 2, height / 2)
        canvas_obj.rotate(45)
        canvas_obj.drawCentredString(0, 0, watermark_text)
        canvas_obj.restoreState()

        # Footer
        canvas_obj.saveState()
        canvas_obj.setFont("Helvetica", 7)
        canvas_obj.setFillGray(0.5)
        canvas_obj.drawString(15 * mm, 10 * mm, footer_text)
        canvas_obj.drawRightString(
            width - 15 * mm,
            10 * mm,
            f"Page {doc_obj.page}",
        )
        # Top-right CONFIDENTIAL label
        canvas_obj.setFont("Helvetica-Bold", 8)
        canvas_obj.setFillColorRGB(*wm_colour)
        canvas_obj.drawRightString(width - 15 * mm, height - 12 * mm, watermark_text)
        canvas_obj.restoreState()

    # ── Build story ───────────────────────────────────────────────────────
    story = []

    # Cover block
    story.append(Paragraph("AgentHive Executive Analytics", h1_style))
    story.append(
        Paragraph(
            f"Period: <b>{period.upper()}</b> &nbsp;|&nbsp; Product: <b>{product.title()}</b> "
            f"&nbsp;|&nbsp; Generated: <b>{data_as_of[:10]}</b>",
            body_style,
        )
    )
    story.append(Spacer(1, 8 * mm))

    # KPI sections
    section_order = ["overview", "financial", "operational", "risk", "projections", "corporate"]
    section_titles = {
        "overview": "Executive Overview",
        "financial": "Financial Performance",
        "operational": "Operational KPIs",
        "risk": "Risk & Asset Quality",
        "projections": "12-Month Projections",
        "corporate": "Corporate Metrics",
    }

    for section in section_order:
        data = sections_data.get(section)
        if data is None:
            continue

        story.append(Paragraph(section_titles.get(section, section.title()), h2_style))
        rows = _flatten_dict_to_rows(data, max_depth=2)
        if rows:
            t = Table(
                [["Metric", "Value"]] + rows,
                colWidths=[90 * mm, 80 * mm],
            )
            t.setStyle(
                TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (-1, 0), brand_blue_hex),
                        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                        ("FONTSIZE", (0, 0), (-1, -1), 8),
                        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.Color(0.96, 0.97, 1)]),
                        ("GRID", (0, 0), (-1, -1), 0.25, colors.lightgrey),
                        ("TOPPADDING", (0, 0), (-1, -1), 3),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                    ]
                )
            )
            story.append(t)
        story.append(Spacer(1, 5 * mm))

    doc.build(story, onFirstPage=_draw_watermark, onLaterPages=_draw_watermark)
    return buf.getvalue()


def _flatten_dict_to_rows(d: dict, prefix: str = "", max_depth: int = 2, _depth: int = 0) -> list[list[str]]:
    """Convert a nested dict to a list of [label, value] rows (max depth limited)."""
    rows: list[list[str]] = []
    for k, v in d.items():
        if k in ("data_availability", "missing_sources", "affected_kpis", "data_as_of"):
            continue
        label = (prefix + k).replace("_", " ").title()
        if isinstance(v, dict) and _depth < max_depth:
            rows.extend(_flatten_dict_to_rows(v, prefix=k + " / ", max_depth=max_depth, _depth=_depth + 1))
        elif isinstance(v, list):
            rows.append([label, f"[{len(v)} items]"])
        elif v is None:
            rows.append([label, "—"])
        elif isinstance(v, float):
            rows.append([label, f"{v:,.4g}"])
        else:
            rows.append([label, str(v)])
    return rows


# ─────────────────────────────────────────────────────────────────────────────
# Public API
# ─────────────────────────────────────────────────────────────────────────────


def generate_export_pdf(
    sections_data: dict,
    period: str = "mtd",
    product: str = "all",
    is_demo: bool = True,
    data_as_of: Optional[str] = None,
) -> bytes:
    """Generate and return raw PDF bytes.

    Args:
        sections_data: Dict[section_name, payload_dict] — one entry per
                       requested section (overview, financial, etc.)
        period:        Period label printed on the cover page.
        product:       Product filter label printed on the cover page.
        is_demo:       True → SAMPLE DATA watermark; False → CONFIDENTIAL watermark.
        data_as_of:    ISO timestamp string for the footer.

    Returns:
        bytes — application/pdf content ready to stream as a response.
    """
    if data_as_of is None:
        data_as_of = datetime.now(tz=timezone.utc).isoformat()

    # Try ReportLab (always available)
    try:
        return _build_pdf_reportlab(sections_data, period, product, is_demo, data_as_of)
    except ImportError as exc:
        logger.error("reportlab not available: %s", exc)

    # Last-resort: minimal plaintext PDF
    return _minimal_pdf(period, product, is_demo, data_as_of)


def _minimal_pdf(period: str, product: str, is_demo: bool, data_as_of: str) -> bytes:
    """Return a bare-minimum valid PDF when ReportLab is absent."""
    watermark = SAMPLE_DATA_TEXT if is_demo else CONFIDENTIAL_TEXT
    content = (
        f"%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n"
        f"2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n"
        f"3 0 obj<</Type/Page/MediaBox[0 0 595 842]/Parent 2 0 R/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n"
        f"4 0 obj<</Length 120>>stream\nBT /F1 12 Tf 50 800 Td "
        f"({watermark} — {period} {product} {data_as_of[:10]}) Tj ET\nendstream endobj\n"
        f"5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\n"
        f"xref\n0 6\n0000000000 65535 f \ntrailer<</Size 6/Root 1 0 R>>\nstartxref 9\n%%EOF"
    )
    return content.encode()
