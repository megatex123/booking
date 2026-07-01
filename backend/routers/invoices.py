import calendar
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from fpdf import FPDF
from core.database import get_db
from middleware.auth import get_current_user

router = APIRouter(prefix="/bookings", tags=["invoices"])

# ── Brand colours (app palette) ──────────────────────────────────────────────
C_BLUE    = (37,  99, 235)
C_BLUE_L  = (239, 246, 255)
C_GREEN   = (22, 163,  74)
C_GREEN_L = (240, 253, 244)
C_DARK    = (15,  23,  42)
C_GREY    = (100, 116, 139)
C_BORDER  = (226, 232, 240)
C_BG      = (248, 250, 252)
C_WHITE   = (255, 255, 255)


def _add_months(dt: datetime, months: int) -> datetime:
    month = dt.month - 1 + months
    year  = dt.year + month // 12
    month = month % 12 + 1
    day   = min(dt.day, calendar.monthrange(year, month)[1])
    return dt.replace(year=year, month=month, day=day)


def _dtstr(v) -> str:
    if isinstance(v, datetime):
        return v.strftime("%d %b %Y")
    if isinstance(v, str) and v:
        try:
            return datetime.fromisoformat(v.replace("Z", "+00:00")).strftime("%d %b %Y")
        except Exception:
            pass
    return str(v) if v else ""


def _price(amount) -> str:
    try:
        return f"RM {float(amount):,.2f}"
    except Exception:
        return "RM 0.00"


def _month_label(months: int) -> str:
    if months >= 24:
        return f"{months // 12} years"
    if months == 12:
        return "1 year"
    return f"{months} month{'s' if months != 1 else ''}"


def build_invoice_pdf(b: dict, workshop_phone: str = "") -> bytes:
    PAGE_W, MARGIN = 210, 15
    CW = PAGE_W - 2 * MARGIN  # 180 mm

    pdf = FPDF(unit="mm", format="A4")
    pdf.set_auto_page_break(auto=True, margin=22)
    pdf.add_page()

    invoice_num = f"INV-{b['_id'][:8].upper()}"
    completed_dt = b.get("completed_at") or b.get("updated_at")
    date_str = _dtstr(completed_dt)
    payment = b.get("payment_status", "unpaid")

    def section_bar(y: float, title: str) -> float:
        pdf.set_fill_color(*C_BLUE)
        pdf.rect(MARGIN, y, CW, 8, style="F")
        pdf.set_text_color(*C_WHITE)
        pdf.set_font("Helvetica", "B", 8)
        pdf.set_xy(MARGIN + 3, y + 1.5)
        pdf.cell(CW - 6, 5, title.upper(), align="L")
        return y + 10

    # ── 1. HEADER BAND ───────────────────────────────────────────────────────
    HEADER_H = 44
    pdf.set_fill_color(*C_BLUE)
    pdf.rect(0, 0, PAGE_W, HEADER_H, style="F")

    pdf.set_text_color(*C_WHITE)
    pdf.set_font("Helvetica", "B", 16)
    pdf.set_xy(MARGIN, 8)
    pdf.cell(110, 9, b.get("workshop_name", "Workshop"), align="L")

    pdf.set_font("Helvetica", "B", 11)
    pdf.set_xy(PAGE_W - MARGIN - 75, 8)
    pdf.cell(75, 9, "SERVICE INVOICE", align="R")

    pdf.set_font("Helvetica", "", 8)
    pdf.set_text_color(210, 225, 255)
    pdf.set_xy(MARGIN, 20)
    pdf.cell(110, 5, b.get("workshop_address", ""), align="L")
    if workshop_phone:
        pdf.set_xy(MARGIN, 26)
        pdf.cell(110, 5, f"Tel: {workshop_phone}", align="L")

    pdf.set_text_color(*C_WHITE)
    pdf.set_font("Helvetica", "", 8)
    pdf.set_xy(PAGE_W - MARGIN - 80, 20)
    pdf.cell(80, 5, f"Invoice:  {invoice_num}", align="R")
    pdf.set_xy(PAGE_W - MARGIN - 80, 26)
    pdf.cell(80, 5, f"Date:  {date_str}", align="R")

    pay_label = "PAID" if payment == "paid" else "UNPAID"
    pay_rgb = (134, 239, 172) if payment == "paid" else (252, 211, 77)
    pdf.set_text_color(*pay_rgb)
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_xy(PAGE_W - MARGIN - 80, 32)
    pdf.cell(80, 5, f"Payment: {pay_label}", align="R")

    # ── 2. CUSTOMER & VEHICLE ─────────────────────────────────────────────────
    y = HEADER_H + 8
    COL = CW / 2

    pdf.set_text_color(*C_GREY)
    pdf.set_font("Helvetica", "B", 7)
    pdf.set_xy(MARGIN, y)
    pdf.cell(COL, 5, "BILLED TO", align="L")
    pdf.set_xy(MARGIN + COL, y)
    pdf.cell(COL, 5, "VEHICLE", align="L")
    y += 6

    pdf.set_draw_color(*C_BORDER)
    pdf.line(MARGIN, y, MARGIN + COL - 4, y)
    pdf.line(MARGIN + COL, y, PAGE_W - MARGIN, y)
    y += 4

    pdf.set_text_color(*C_DARK)
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_xy(MARGIN, y)
    pdf.cell(COL, 6, b.get("customer_name", ""), align="L")

    vehicle_str = f"{b.get('vehicle_brand', '')} {b.get('vehicle_name', '')}".strip()
    pdf.set_xy(MARGIN + COL, y)
    pdf.cell(COL, 6, vehicle_str, align="L")
    y += 7

    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(*C_GREY)
    if b.get("customer_phone"):
        pdf.set_xy(MARGIN, y)
        pdf.cell(COL, 5, b["customer_phone"], align="L")

    plate = b.get("vehicle_plate", "")
    if plate:
        pdf.set_text_color(*C_DARK)
        pdf.set_font("Helvetica", "B", 10)
        pdf.set_xy(MARGIN + COL, y)
        pdf.cell(COL, 5, plate, align="L")
    y += 10

    # ── 3. SCHEDULE BAR ──────────────────────────────────────────────────────
    pdf.set_fill_color(*C_BG)
    pdf.set_draw_color(*C_BORDER)
    pdf.rect(MARGIN, y, CW, 14, style="FD")

    sched_date = _dtstr(b.get("scheduled_date", ""))
    sched_time = b.get("scheduled_time", "")

    pdf.set_text_color(*C_GREY)
    pdf.set_font("Helvetica", "", 7)
    pdf.set_xy(MARGIN + 4, y + 2)
    pdf.cell(85, 4, "SERVICE DATE", align="L")

    if completed_dt:
        pdf.set_xy(MARGIN + CW / 2 + 4, y + 2)
        pdf.cell(85, 4, "COMPLETED", align="L")

    pdf.set_text_color(*C_DARK)
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_xy(MARGIN + 4, y + 7)
    pdf.cell(85, 5, f"{sched_date}  .  {sched_time}", align="L")

    if completed_dt:
        pdf.set_text_color(*C_GREEN)
        pdf.set_font("Helvetica", "B", 9)
        pdf.set_xy(MARGIN + CW / 2 + 4, y + 7)
        pdf.cell(85, 5, date_str, align="L")

    y += 20

    # ── 4. SERVICES TABLE ────────────────────────────────────────────────────
    y = section_bar(y, "Services Performed")

    pdf.set_fill_color(*C_BLUE_L)
    pdf.rect(MARGIN, y, CW, 7, style="F")
    pdf.set_text_color(*C_BLUE)
    pdf.set_font("Helvetica", "B", 8)
    pdf.set_xy(MARGIN + 3, y + 1.5)
    pdf.cell(140, 4, "Service Description", align="L")
    pdf.set_xy(MARGIN + CW - 38, y + 1.5)
    pdf.cell(35, 4, "Amount", align="R")
    y += 8

    for i, svc in enumerate(b.get("services", [])):
        row_fill = C_BG if i % 2 == 0 else C_WHITE
        pdf.set_fill_color(*row_fill)
        pdf.rect(MARGIN, y, CW, 8, style="F")
        pdf.set_text_color(*C_DARK)
        pdf.set_font("Helvetica", "", 9)
        pdf.set_xy(MARGIN + 3, y + 2)
        pdf.cell(140, 4, svc.get("name", ""), align="L")
        pdf.set_font("Helvetica", "B", 9)
        pdf.set_xy(MARGIN + CW - 38, y + 2)
        pdf.cell(35, 4, _price(svc.get("price", 0)), align="R")
        y += 8

    pdf.set_draw_color(*C_BORDER)
    pdf.line(MARGIN, y, PAGE_W - MARGIN, y)
    y += 4

    has_product_pricing = b.get("products_total", 0) and b.get("products_total", 0) > 0
    services_total_val  = b.get("services_total", b.get("total_price", 0))

    # Services subtotal (when products also charged, show subtotal label; else show TOTAL DUE)
    pdf.set_text_color(*C_GREY)
    pdf.set_font("Helvetica", "", 8)
    pdf.set_xy(MARGIN, y)
    pdf.cell(CW - 38, 6, "SERVICES SUBTOTAL" if has_product_pricing else "TOTAL DUE", align="R")

    pdf.set_text_color(*C_BLUE)
    pdf.set_font("Helvetica", "B", 12 if has_product_pricing else 14)
    pdf.set_xy(MARGIN + CW - 38, y - 1)
    pdf.cell(35, 8, _price(services_total_val), align="R")
    y += 10

    # ── 5. PARTS & PRODUCTS ──────────────────────────────────────────────────
    all_products = [
        (sr.get("service_name", ""), pu)
        for sr in (b.get("service_reports") or [])
        for pu in (sr.get("products_used") or [])
        if pu.get("product_name")
    ]

    if all_products:
        if y > 240:
            pdf.add_page(); y = 15
        y = section_bar(y, "Parts & Products Used")

        # Column header
        pdf.set_fill_color(*C_BLUE_L)
        pdf.rect(MARGIN, y, CW, 7, style="F")
        pdf.set_text_color(*C_BLUE)
        pdf.set_font("Helvetica", "B", 8)
        pdf.set_xy(MARGIN + 3, y + 1.5)
        pdf.cell(95, 4, "Description", align="L")
        pdf.set_xy(MARGIN + 98, y + 1.5)
        pdf.cell(28, 4, "Qty / Unit", align="C")
        pdf.set_xy(MARGIN + 126, y + 1.5)
        pdf.cell(28, 4, "Unit Price", align="R")
        pdf.set_xy(MARGIN + CW - 35, y + 1.5)
        pdf.cell(32, 4, "Amount", align="R")
        y += 8

        parts_computed_total = 0.0
        for i, (svc_name, pu) in enumerate(all_products):
            row_fill = C_BG if i % 2 == 0 else C_WHITE
            pdf.set_fill_color(*row_fill)
            pdf.rect(MARGIN, y, CW, 8, style="F")

            name  = pu.get("product_name", "")
            brand = pu.get("brand", "")
            qty   = float(pu.get("quantity", 0) or 0)
            unit  = pu.get("unit", "")
            unit_price = float(pu.get("unit_price", 0) or 0)
            line_total = qty * unit_price
            parts_computed_total += line_total

            label = name + (f" ({brand})" if brand else "")
            qty_str = f"{qty:g} {unit}".strip()

            pdf.set_text_color(*C_DARK)
            pdf.set_font("Helvetica", "", 8.5)
            pdf.set_xy(MARGIN + 3, y + 2)
            pdf.cell(95, 4, label, align="L")

            pdf.set_font("Helvetica", "", 8)
            pdf.set_text_color(*C_GREY)
            pdf.set_xy(MARGIN + 98, y + 2)
            pdf.cell(28, 4, qty_str, align="C")

            pdf.set_text_color(*C_DARK)
            pdf.set_xy(MARGIN + 126, y + 2)
            pdf.cell(28, 4, _price(unit_price) if unit_price > 0 else "-", align="R")

            pdf.set_font("Helvetica", "B", 8.5)
            pdf.set_xy(MARGIN + CW - 35, y + 2)
            pdf.cell(32, 4, _price(line_total) if unit_price > 0 else "-", align="R")
            y += 8

        # Parts subtotal row
        pdf.set_draw_color(*C_BORDER)
        pdf.line(MARGIN, y, PAGE_W - MARGIN, y)
        y += 4
        pdf.set_text_color(*C_GREY)
        pdf.set_font("Helvetica", "", 8)
        pdf.set_xy(MARGIN, y)
        pdf.cell(CW - 38, 6, "PARTS SUBTOTAL", align="R")
        products_total_val = b.get("products_total") or parts_computed_total
        pdf.set_text_color(*C_BLUE)
        pdf.set_font("Helvetica", "B", 12)
        pdf.set_xy(MARGIN + CW - 38, y - 1)
        pdf.cell(35, 8, _price(products_total_val), align="R")
        y += 10

        # Grand total row (only when products were charged)
        pdf.set_fill_color(*C_BLUE)
        pdf.rect(MARGIN, y, CW, 11, style="F")
        pdf.set_text_color(*C_WHITE)
        pdf.set_font("Helvetica", "B", 8)
        pdf.set_xy(MARGIN + 3, y + 1.5)
        if payment == "paid":
            pdf.cell(60, 4, "Payment Received", align="L")
        pdf.set_xy(MARGIN, y + 1.5)
        pdf.cell(CW - 38, 4, "TOTAL DUE", align="R")
        pdf.set_font("Helvetica", "B", 14)
        pdf.set_xy(MARGIN + CW - 38, y + 0.5)
        pdf.cell(35, 10, _price(b.get("total_price", 0)), align="R")
        y += 17
    else:
        # No products — show payment received note and grand total (already drawn as TOTAL DUE above)
        if payment == "paid":
            pdf.set_text_color(*C_GREEN)
            pdf.set_font("Helvetica", "B", 8)
            pdf.set_xy(MARGIN, y - 10)
            pdf.cell(60, 6, "Payment Received", align="L")
        # Grand total already shown; just add spacing
        y += 4

    # ── 6. WORK COMPLETED ────────────────────────────────────────────────────
    all_notes = [
        (sr.get("service_name", ""), sr["work_done"])
        for sr in (b.get("service_reports") or [])
        if sr.get("work_done")
    ]
    if b.get("completion_notes"):
        all_notes.append(("", b["completion_notes"]))

    if all_notes:
        if y > 230:
            pdf.add_page(); y = 15
        else:
            y = max(y, pdf.get_y())
        y = section_bar(y, "Work Completed")

        for svc_name, note in all_notes:
            if svc_name:
                pdf.set_text_color(*C_GREY)
                pdf.set_font("Helvetica", "B", 8)
                pdf.set_xy(MARGIN + 3, y)
                pdf.cell(CW - 6, 5, svc_name, align="L")
                y += 5
            pdf.set_text_color(*C_DARK)
            pdf.set_font("Helvetica", "", 8)
            pdf.set_xy(MARGIN + 3, y)
            pdf.multi_cell(CW - 6, 5, note, align="L")
            y = pdf.get_y() + 3
        y += 2

    # ── 7. NEXT SERVICE BOX ──────────────────────────────────────────────────
    next_months = b.get("next_service_months")
    if next_months:
        y = max(y, pdf.get_y())
        if y > 245:
            pdf.add_page(); y = 15

        # Compute due date
        anchor = b.get("completed_at") or b.get("updated_at")
        due_str = ""
        if isinstance(anchor, datetime):
            due_str = _add_months(anchor, int(next_months)).strftime("%B %Y")
        elif isinstance(anchor, str):
            try:
                due_str = _add_months(
                    datetime.fromisoformat(anchor.replace("Z", "+00:00")),
                    int(next_months)
                ).strftime("%B %Y")
            except Exception:
                pass

        pdf.set_fill_color(*C_GREEN_L)
        pdf.set_draw_color(*C_GREEN)
        pdf.set_line_width(0.5)
        pdf.rect(MARGIN, y, CW, 20, style="FD")
        pdf.set_line_width(0.2)

        pdf.set_text_color(*C_GREEN)
        pdf.set_font("Helvetica", "B", 8)
        pdf.set_xy(MARGIN + 4, y + 3)
        pdf.cell(CW - 8, 5, "NEXT SERVICE RECOMMENDED", align="L")

        msg = f"In {_month_label(int(next_months))}"
        if due_str:
            msg += f"  -  Due by {due_str}"
        pdf.set_text_color(*C_DARK)
        pdf.set_font("Helvetica", "", 9)
        pdf.set_xy(MARGIN + 4, y + 10)
        pdf.cell(CW - 8, 5, msg, align="L")
        y += 26

    # ── 8. STAMP + DISCLAIMER ────────────────────────────────────────────────
    y = max(y, pdf.get_y())
    if y > 232:
        pdf.add_page(); y = 15

    STAMP_W, STAMP_H = 70, 32
    STAMP_X = PAGE_W - MARGIN - STAMP_W

    pdf.set_fill_color(245, 248, 255)
    pdf.set_draw_color(*C_BLUE)
    pdf.set_line_width(0.6)
    pdf.rect(STAMP_X, y, STAMP_W, STAMP_H, style="FD")
    pdf.set_line_width(0.2)

    ws_name = (b.get("workshop_name") or "")[:22].upper()
    pdf.set_text_color(*C_BLUE)
    pdf.set_font("Helvetica", "B", 8)
    pdf.set_xy(STAMP_X + 2, y + 4)
    pdf.cell(STAMP_W - 4, 5, ws_name, align="C")

    pdf.set_text_color(*C_GREY)
    pdf.set_font("Helvetica", "", 6.5)
    pdf.set_xy(STAMP_X + 2, y + 10)
    pdf.cell(STAMP_W - 4, 4, "Authorised Workshop Stamp", align="C")

    sig_y = y + 22
    pdf.set_draw_color(*C_GREY)
    pdf.set_line_width(0.4)
    pdf.line(STAMP_X + 6, sig_y, STAMP_X + STAMP_W - 6, sig_y)
    pdf.set_line_width(0.2)
    pdf.set_xy(STAMP_X + 2, sig_y + 2)
    pdf.cell(STAMP_W - 4, 4, "Authorised Signature", align="C")

    pdf.set_text_color(*C_GREY)
    pdf.set_font("Helvetica", "I", 7)
    pdf.set_xy(MARGIN, y + 4)
    pdf.multi_cell(
        STAMP_X - MARGIN - 4, 4.5,
        "This invoice is a computer-generated document\n"
        "produced by the Bengkil Lah car service platform.\n"
        "For enquiries, contact the workshop directly.",
        align="L",
    )

    # ── 9. FOOTER ─────────────────────────────────────────────────────────────
    FOOTER_Y = 277
    pdf.set_draw_color(*C_BORDER)
    pdf.line(MARGIN, FOOTER_Y, PAGE_W - MARGIN, FOOTER_Y)
    pdf.set_text_color(*C_GREY)
    pdf.set_font("Helvetica", "I", 7)
    pdf.set_xy(MARGIN, FOOTER_Y + 2)
    pdf.cell(
        CW, 5,
        f"Bengkil Lah  |  Invoice {invoice_num}  |  Computer-generated - no wet signature required unless stamped",
        align="C",
    )

    return bytes(pdf.output())


def build_quotation_pdf(b: dict, quotation: dict, workshop_phone: str = "") -> bytes:
    PAGE_W, MARGIN = 210, 15
    CW = PAGE_W - 2 * MARGIN

    pdf = FPDF(unit="mm", format="A4")
    pdf.set_auto_page_break(auto=True, margin=22)
    pdf.add_page()

    quote_num = f"QT-{quotation['_id'][:8].upper()}"
    type_label = "Additional Work Quotation" if quotation.get("type") == "additional" else "Initial Quotation"
    approved_dt = quotation.get("responded_at") or quotation.get("created_at")
    date_str = _dtstr(approved_dt)

    def section_bar(y: float, title: str) -> float:
        pdf.set_fill_color(*C_BLUE)
        pdf.rect(MARGIN, y, CW, 8, style="F")
        pdf.set_text_color(*C_WHITE)
        pdf.set_font("Helvetica", "B", 8)
        pdf.set_xy(MARGIN + 3, y + 1.5)
        pdf.cell(CW - 6, 5, title.upper(), align="L")
        return y + 10

    # ── 1. HEADER BAND ───────────────────────────────────────────────────────
    HEADER_H = 44
    pdf.set_fill_color(*C_BLUE)
    pdf.rect(0, 0, PAGE_W, HEADER_H, style="F")

    pdf.set_text_color(*C_WHITE)
    pdf.set_font("Helvetica", "B", 16)
    pdf.set_xy(MARGIN, 8)
    pdf.cell(110, 9, b.get("workshop_name", "Workshop"), align="L")

    pdf.set_font("Helvetica", "B", 11)
    pdf.set_xy(PAGE_W - MARGIN - 75, 8)
    pdf.cell(75, 9, "QUOTATION", align="R")

    pdf.set_font("Helvetica", "", 8)
    pdf.set_text_color(210, 225, 255)
    pdf.set_xy(MARGIN, 20)
    pdf.cell(110, 5, b.get("workshop_address", ""), align="L")
    if workshop_phone:
        pdf.set_xy(MARGIN, 26)
        pdf.cell(110, 5, f"Tel: {workshop_phone}", align="L")

    pdf.set_text_color(*C_WHITE)
    pdf.set_font("Helvetica", "", 8)
    pdf.set_xy(PAGE_W - MARGIN - 80, 20)
    pdf.cell(80, 5, f"Quotation:  {quote_num}", align="R")
    pdf.set_xy(PAGE_W - MARGIN - 80, 26)
    pdf.cell(80, 5, f"Date:  {date_str}", align="R")

    pdf.set_text_color(134, 239, 172)
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_xy(PAGE_W - MARGIN - 80, 32)
    pdf.cell(80, 5, "Status: APPROVED", align="R")

    # ── 2. CUSTOMER & VEHICLE ─────────────────────────────────────────────────
    y = HEADER_H + 8
    COL = CW / 2

    pdf.set_text_color(*C_GREY)
    pdf.set_font("Helvetica", "B", 7)
    pdf.set_xy(MARGIN, y)
    pdf.cell(COL, 5, "QUOTED TO", align="L")
    pdf.set_xy(MARGIN + COL, y)
    pdf.cell(COL, 5, "VEHICLE", align="L")
    y += 6

    pdf.set_draw_color(*C_BORDER)
    pdf.line(MARGIN, y, MARGIN + COL - 4, y)
    pdf.line(MARGIN + COL, y, PAGE_W - MARGIN, y)
    y += 4

    pdf.set_text_color(*C_DARK)
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_xy(MARGIN, y)
    pdf.cell(COL, 6, b.get("customer_name", ""), align="L")

    vehicle_str = f"{b.get('vehicle_brand', '')} {b.get('vehicle_name', '')}".strip()
    pdf.set_xy(MARGIN + COL, y)
    pdf.cell(COL, 6, vehicle_str, align="L")
    y += 7

    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(*C_GREY)
    if b.get("customer_phone"):
        pdf.set_xy(MARGIN, y)
        pdf.cell(COL, 5, b["customer_phone"], align="L")

    plate = b.get("vehicle_plate", "")
    if plate:
        pdf.set_text_color(*C_DARK)
        pdf.set_font("Helvetica", "B", 10)
        pdf.set_xy(MARGIN + COL, y)
        pdf.cell(COL, 5, plate, align="L")
    y += 12

    # ── 3. TYPE BADGE ────────────────────────────────────────────────────────
    pdf.set_fill_color(*C_BLUE_L)
    pdf.set_draw_color(*C_BORDER)
    pdf.rect(MARGIN, y, CW, 10, style="FD")
    pdf.set_text_color(*C_BLUE)
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_xy(MARGIN + 4, y + 3)
    pdf.cell(CW - 8, 5, type_label, align="L")
    y += 16

    # ── 4. ITEMS TABLE ───────────────────────────────────────────────────────
    y = section_bar(y, "Quoted Items")

    pdf.set_fill_color(*C_BLUE_L)
    pdf.rect(MARGIN, y, CW, 7, style="F")
    pdf.set_text_color(*C_BLUE)
    pdf.set_font("Helvetica", "B", 8)
    pdf.set_xy(MARGIN + 3, y + 1.5)
    pdf.cell(95, 4, "Item", align="L")
    pdf.set_xy(MARGIN + 98, y + 1.5)
    pdf.cell(20, 4, "Qty", align="C")
    pdf.set_xy(MARGIN + 122, y + 1.5)
    pdf.cell(30, 4, "Unit Price", align="R")
    pdf.set_xy(MARGIN + CW - 35, y + 1.5)
    pdf.cell(32, 4, "Amount", align="R")
    y += 8

    for i, item in enumerate(quotation.get("items", [])):
        name = item.get("name", "")
        desc = item.get("description", "")
        qty = float(item.get("quantity", 1) or 1)
        price = float(item.get("price", 0) or 0)
        line_total = qty * price

        row_h = 8 if not desc else 12
        row_fill = C_BG if i % 2 == 0 else C_WHITE
        pdf.set_fill_color(*row_fill)
        pdf.rect(MARGIN, y, CW, row_h, style="F")

        pdf.set_text_color(*C_DARK)
        pdf.set_font("Helvetica", "B", 8.5)
        pdf.set_xy(MARGIN + 3, y + 2)
        pdf.cell(95, 4, name, align="L")

        if desc:
            pdf.set_text_color(*C_GREY)
            pdf.set_font("Helvetica", "", 7.5)
            pdf.set_xy(MARGIN + 3, y + 6.5)
            pdf.cell(95, 4, desc[:70], align="L")

        pdf.set_text_color(*C_DARK)
        pdf.set_font("Helvetica", "", 8.5)
        pdf.set_xy(MARGIN + 98, y + 2)
        pdf.cell(20, 4, f"{qty:g}", align="C")

        pdf.set_xy(MARGIN + 122, y + 2)
        pdf.cell(30, 4, _price(price), align="R")

        pdf.set_font("Helvetica", "B", 8.5)
        pdf.set_xy(MARGIN + CW - 35, y + 2)
        pdf.cell(32, 4, _price(line_total), align="R")
        y += row_h

    pdf.set_draw_color(*C_BORDER)
    pdf.line(MARGIN, y, PAGE_W - MARGIN, y)
    y += 4

    # ── 5. NOTE ──────────────────────────────────────────────────────────────
    if quotation.get("note"):
        pdf.set_text_color(*C_GREY)
        pdf.set_font("Helvetica", "BI", 8)
        pdf.set_xy(MARGIN, y)
        pdf.cell(CW, 5, "Workshop Note:", align="L")
        y += 5
        pdf.set_text_color(*C_DARK)
        pdf.set_font("Helvetica", "I", 8.5)
        pdf.set_xy(MARGIN, y)
        pdf.multi_cell(CW, 5, quotation["note"], align="L")
        y = pdf.get_y() + 4

    # ── 6. DISCOUNTS + TOTAL ─────────────────────────────────────────────────
    promo_discount = float(quotation.get("promotion_discount", 0) or 0)
    promo_title = quotation.get("promotion_title")
    loyalty_discount = float(quotation.get("loyalty_discount", 0) or 0)
    loyalty_pts = int(quotation.get("loyalty_points_used", 0) or 0)
    has_discounts = promo_discount > 0 or loyalty_discount > 0
    final_amount = quotation.get("final_amount", quotation.get("subtotal", 0))

    if has_discounts:
        pdf.set_text_color(*C_GREY)
        pdf.set_font("Helvetica", "", 9)
        pdf.set_xy(MARGIN, y)
        pdf.cell(CW - 38, 5, "SUBTOTAL", align="R")
        pdf.set_text_color(*C_DARK)
        pdf.set_xy(MARGIN + CW - 38, y)
        pdf.cell(35, 5, _price(quotation.get("subtotal", 0)), align="R")
        y += 6

        if promo_discount > 0:
            label = f"PROMOTION{f' ({promo_title})' if promo_title else ''}"
            pdf.set_text_color(234, 88, 12)
            pdf.set_font("Helvetica", "", 8.5)
            pdf.set_xy(MARGIN, y)
            pdf.cell(CW - 38, 5, label, align="R")
            pdf.set_font("Helvetica", "B", 8.5)
            pdf.set_xy(MARGIN + CW - 38, y)
            pdf.cell(35, 5, f"-{_price(promo_discount)}", align="R")
            y += 6

        if loyalty_discount > 0:
            pdf.set_text_color(202, 138, 4)
            pdf.set_font("Helvetica", "", 8.5)
            pdf.set_xy(MARGIN, y)
            pdf.cell(CW - 38, 5, f"LOYALTY POINTS ({loyalty_pts} pts)", align="R")
            pdf.set_font("Helvetica", "B", 8.5)
            pdf.set_xy(MARGIN + CW - 38, y)
            pdf.cell(35, 5, f"-{_price(loyalty_discount)}", align="R")
            y += 6

        pdf.set_draw_color(*C_BORDER)
        pdf.line(MARGIN, y, PAGE_W - MARGIN, y)
        y += 3

    pdf.set_fill_color(*C_BLUE)
    pdf.rect(MARGIN, y, CW, 12, style="F")
    pdf.set_text_color(*C_WHITE)
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_xy(MARGIN, y + 2)
    pdf.cell(CW - 38, 6, "QUOTATION TOTAL", align="R")
    pdf.set_font("Helvetica", "B", 14)
    pdf.set_xy(MARGIN + CW - 38, y + 1)
    pdf.cell(35, 10, _price(final_amount), align="R")
    y += 20

    # ── 7. STAMP + DISCLAIMER ────────────────────────────────────────────────
    if y > 232:
        pdf.add_page(); y = 15

    STAMP_W, STAMP_H = 70, 32
    STAMP_X = PAGE_W - MARGIN - STAMP_W

    pdf.set_fill_color(245, 248, 255)
    pdf.set_draw_color(*C_BLUE)
    pdf.set_line_width(0.6)
    pdf.rect(STAMP_X, y, STAMP_W, STAMP_H, style="FD")
    pdf.set_line_width(0.2)

    ws_name = (b.get("workshop_name") or "")[:22].upper()
    pdf.set_text_color(*C_BLUE)
    pdf.set_font("Helvetica", "B", 8)
    pdf.set_xy(STAMP_X + 2, y + 4)
    pdf.cell(STAMP_W - 4, 5, ws_name, align="C")

    pdf.set_text_color(*C_GREY)
    pdf.set_font("Helvetica", "", 6.5)
    pdf.set_xy(STAMP_X + 2, y + 10)
    pdf.cell(STAMP_W - 4, 4, "Authorised Workshop Stamp", align="C")

    sig_y = y + 22
    pdf.set_draw_color(*C_GREY)
    pdf.set_line_width(0.4)
    pdf.line(STAMP_X + 6, sig_y, STAMP_X + STAMP_W - 6, sig_y)
    pdf.set_line_width(0.2)
    pdf.set_xy(STAMP_X + 2, sig_y + 2)
    pdf.cell(STAMP_W - 4, 4, "Authorised Signature", align="C")

    pdf.set_text_color(*C_GREY)
    pdf.set_font("Helvetica", "I", 7)
    pdf.set_xy(MARGIN, y + 4)
    pdf.multi_cell(
        STAMP_X - MARGIN - 4, 4.5,
        "This quotation was approved by the customer in-app and is a\n"
        "computer-generated document produced by the Bengkil Lah\n"
        "platform. For enquiries, contact the workshop directly.",
        align="L",
    )

    # ── 8. FOOTER ────────────────────────────────────────────────────────────
    FOOTER_Y = 277
    pdf.set_draw_color(*C_BORDER)
    pdf.line(MARGIN, FOOTER_Y, PAGE_W - MARGIN, FOOTER_Y)
    pdf.set_text_color(*C_GREY)
    pdf.set_font("Helvetica", "I", 7)
    pdf.set_xy(MARGIN, FOOTER_Y + 2)
    pdf.cell(
        CW, 5,
        f"Bengkil Lah  |  Quotation {quote_num}  |  Computer-generated - no wet signature required unless stamped",
        align="C",
    )

    return bytes(pdf.output())


# ── Endpoint ─────────────────────────────────────────────────────────────────

@router.get("/{booking_id}/invoice", summary="Download PDF invoice (completed bookings only)")
async def download_invoice(
    booking_id: str,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    b = await db.bookings.find_one({"_id": booking_id})
    if not b:
        raise HTTPException(status_code=404, detail="Booking not found")

    if b["status"] != "completed":
        raise HTTPException(status_code=400, detail="Invoice is only available for completed bookings")

    if user["role"] == "customer" and b["customer_id"] != user["_id"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    elif user["role"] == "workshop":
        ws = await db.workshops.find_one({"owner_id": user["_id"]})
        if not ws or b["workshop_id"] != ws["_id"]:
            raise HTTPException(status_code=403, detail="Forbidden")

    workshop = await db.workshops.find_one({"_id": b["workshop_id"]})
    workshop_phone = workshop.get("phone", "") if workshop else ""

    pdf_bytes = build_invoice_pdf(b, workshop_phone)

    filename = f"invoice-{booking_id[:8].upper()}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Content-Length": str(len(pdf_bytes)),
        },
    )


@router.get("/{booking_id}/quotations/{quotation_id}/pdf", summary="Download PDF for an approved quotation")
async def download_quotation_pdf(
    booking_id: str,
    quotation_id: str,
    user=Depends(get_current_user),
    db=Depends(get_db),
):
    b = await db.bookings.find_one({"_id": booking_id})
    if not b:
        raise HTTPException(status_code=404, detail="Booking not found")

    if user["role"] == "customer" and b["customer_id"] != user["_id"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    elif user["role"] == "workshop":
        ws = await db.workshops.find_one({"owner_id": user["_id"]})
        if not ws or b["workshop_id"] != ws["_id"]:
            raise HTTPException(status_code=403, detail="Forbidden")

    quotation = next((q for q in b.get("quotations", []) if q["_id"] == quotation_id), None)
    if not quotation:
        raise HTTPException(status_code=404, detail="Quotation not found")
    if quotation["status"] != "approved":
        raise HTTPException(status_code=400, detail="Only approved quotations can be downloaded")

    workshop = await db.workshops.find_one({"_id": b["workshop_id"]})
    workshop_phone = workshop.get("phone", "") if workshop else ""

    pdf_bytes = build_quotation_pdf(b, quotation, workshop_phone)

    filename = f"quotation-{quotation_id[:8].upper()}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Content-Length": str(len(pdf_bytes)),
        },
    )
