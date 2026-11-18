"""Leadership report: snapshot -> PDF (reportlab) and fixed HTML email template."""
import io
from html import escape

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle

TITLES = {
    "conviction": "Conviction",
    "timeliness": "Charge Sheet Timeliness",
    "emergency112": "112 Performance",
    "training": "Training Performance",
    "antf": "ANTF Meetings",
}
RATE = {
    "conviction": "Conviction rate",
    "timeliness": "Within-time rate",
    "emergency112": "% closed ≤100m",
    "training": "% people trained",
    "antf": "Total marks",
}
f2 = lambda v: "-" if v is None else f"{v:.2f}"  # noqa: E731


def _slim(r):
    return {k: r.get(k) for k in ("rank", "unit", "range", "base_rate", "latest_rate", "improvement", "overall_score", "category")}


def build_section(domain, type_, base, latest, rows, tot):
    scored = sorted([r for r in rows if r["rank"]], key=lambda r: r["rank"])
    improvers = sorted([r for r in rows if r["improvement"] is not None], key=lambda r: -r["improvement"])[:5]
    return {"domain": domain, "type": type_, "base": base, "latest": latest,
            "totals": {k: tot.get(k) for k in ("base_rate", "latest_rate", "improvement", "avg_overall_score", "unit_count", "scored_count")},
            "top": [_slim(r) for r in scored[:10]], "bottom": [_slim(r) for r in scored[-5:][::-1]],
            "improvers": [_slim(r) for r in improvers]}


def _table(head, body, widths):
    t = Table([head] + body, colWidths=widths, repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0F172A")), ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTSIZE", (0, 0), (-1, -1), 8), ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F4F6FA")]),
        ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#E2E8F0")), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    return t


def render_pdf(report: dict) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=14 * mm, rightMargin=14 * mm, topMargin=14 * mm, bottomMargin=14 * mm)
    ss = getSampleStyleSheet()
    els = [Paragraph("Police Performance Dashboard - Leadership Report", ss["Title"]),
           Paragraph(f"{escape(report['title'])} | generated {report['created_at'][:16].replace('T', ' ')} UTC | scoring policy v{report.get('policy_version', '-')}", ss["Normal"]),
           Spacer(1, 8)]
    for s in report["sections"]:
        t = s["totals"]
        els += [Paragraph(f"{TITLES[s['domain']]} - {escape(s['type'])} ({escape(s['base'])} to {escape(s['latest'])})", ss["Heading2"]),
                _table(["Base rate %", "Latest rate %", "Improvement (pp)", "Avg overall score", "Units scored"],
                       [[f2(t["base_rate"]), f2(t["latest_rate"]), f2(t["improvement"]), f2(t["avg_overall_score"]), f"{t['scored_count']} / {t['unit_count']}"]],
                       [36 * mm] * 5), Spacer(1, 6)]
        rank_head = ["Rank", "Unit", "Range", "Base %", "Latest %", "Imp. pp", "Overall", "Category"]
        rw = [12 * mm, 40 * mm, 34 * mm, 16 * mm, 16 * mm, 16 * mm, 16 * mm, 30 * mm]
        row = lambda r: [r["rank"] or "-", r["unit"], r["range"], f2(r["base_rate"]), f2(r["latest_rate"]), f2(r["improvement"]), f2(r["overall_score"]), r["category"]]  # noqa: E731
        for label, key in (("Top 10 units", "top"), ("Biggest improvers", "improvers"), ("Bottom 5 units", "bottom")):
            els += [Paragraph(label, ss["Heading4"]), _table(rank_head, [row(r) for r in s[key]], rw), Spacer(1, 4)]
        els.append(Spacer(1, 10))
    els.append(Paragraph("Overall score = weighted performance score (latest rate vs statewide min/max) + improvement score. Confidential - for authorised police leadership only.", ss["Italic"]))
    doc.build(els)
    return buf.getvalue()


def render_email(report: dict, app_url: str) -> tuple[str, str]:
    subject = f"Police Performance Dashboard - {report['title']}"
    blocks = []
    for s in report["sections"]:
        t = s["totals"]
        top = "".join(f"<li>#{r['rank']} {escape(r['unit'])} - {f2(r['overall_score'])}</li>" for r in s["top"][:3])
        imp = "".join(f"<li>{escape(r['unit'])}: +{f2(r['improvement'])} pp</li>" if (r["improvement"] or 0) >= 0
                      else f"<li>{escape(r['unit'])}: {f2(r['improvement'])} pp</li>" for r in s["improvers"][:3])
        blocks.append(
            f'<tr><td style="padding:16px 24px;border-top:1px solid #E2E8F0">'
            f'<div style="font-size:16px;font-weight:bold;color:#0F172A">{TITLES[s["domain"]]}</div>'
            f'<div style="font-size:12px;color:#64748B">{escape(s["type"])} | {escape(s["base"])} to {escape(s["latest"])}</div>'
            f'<p style="font-size:14px;margin:8px 0">{RATE[s["domain"]]}: <b>{f2(t["base_rate"])}% to {f2(t["latest_rate"])}%</b> ({f2(t["improvement"])} pp)</p>'
            f'<div style="font-size:13px"><b>Top units</b><ul style="margin:4px 0 8px">{top}</ul><b>Biggest improvers</b><ul style="margin:4px 0">{imp}</ul></div>'
            f'</td></tr>')
    html = (
        '<table role="presentation" width="100%" style="font-family:Arial,sans-serif;max-width:640px;border:1px solid #E2E8F0">'
        '<tr><td style="background:#0B1220;color:#FFFFFF;padding:20px 24px">'
        '<div style="font-size:11px;letter-spacing:2px;color:#0F766E">LEADERSHIP REPORT</div>'
        f'<div style="font-size:20px;font-weight:bold">{escape(report["title"])}</div></td></tr>'
        + "".join(blocks) +
        f'<tr><td style="padding:16px 24px;border-top:1px solid #E2E8F0;font-size:13px">'
        f'The full PDF with top 10, bottom 5 and improvers is available after signing in: '
        f'<a href="{escape(app_url)}/reports" style="color:#0F3D5E">open the Reports page</a>.</td></tr>'
        '<tr><td style="padding:12px 24px;font-size:11px;color:#888">Sent by Police Performance Dashboard. '
        'You receive this because an administrator added you to the leadership report list. '
        'We never ask for your password by email.</td></tr></table>')
    return subject, html


def _fmt_val(v):
    if v is None:
        return "-"
    if isinstance(v, float):
        return f"{v:.2f}"
    if isinstance(v, int):
        return f"{v:,}"
    return str(v)


def render_explain_email(*, domain: str, type_: str, base: str, latest: str, unit: str,
                         row: dict, steps: list, sender: str) -> tuple[str, str]:
    """Full worked-explanation report as a shareable HTML email (no forms / no credential asks)."""
    title = TITLES.get(domain, domain)
    subject = f"Police Performance Dashboard - {title} explanation - {unit}"
    rate_label = RATE.get(domain, "Rate")

    step_blocks = []
    for s in steps:
        lines_html = ""
        if s.get("lines"):
            rows = "".join(
                f'<tr><td style="padding:4px 0;color:#64748B">{escape(str(k))}</td>'
                f'<td style="padding:4px 0;text-align:right;font-family:Consolas,monospace;color:#0F172A">{escape(_fmt_val(v))}</td></tr>'
                for k, v in s["lines"]
            )
            lines_html = f'<table width="100%" style="font-size:13px;margin:6px 0 0">{rows}</table>'
        table_html = ""
        if s.get("table"):
            trows = "".join(
                f'<tr><td style="padding:3px 8px;border:1px solid #E2E8F0;color:#475569">{escape(str(k))}</td>'
                f'<td style="padding:3px 8px;border:1px solid #E2E8F0;text-align:right;font-weight:bold">{escape(_fmt_val(v))}</td></tr>'
                for k, v in s["table"]
            )
            table_html = f'<table style="font-size:12px;border-collapse:collapse;margin:8px 0 0">{trows}</table>'
        formula_html = ""
        if s.get("formula"):
            formula_html = (
                f'<div style="margin-top:8px;padding:10px 12px;background:#0B1220;color:#99F6E4;'
                f'font-family:Consolas,monospace;font-size:12px;white-space:pre-wrap">'
                f'{escape(str(s["formula"]))}</div>'
            )
        step_blocks.append(
            f'<tr><td style="padding:14px 24px;border-top:1px solid #E2E8F0">'
            f'<div style="font-size:11px;font-weight:bold;letter-spacing:1px;color:#0F766E">'
            f'STEP {int(s["step"]):02d}</div>'
            f'<div style="font-size:15px;font-weight:bold;color:#0F172A;margin-top:2px">{escape(s["title"])}</div>'
            f'{lines_html}{table_html}{formula_html}</td></tr>'
        )

    html = (
        '<table role="presentation" width="100%" style="font-family:Arial,sans-serif;max-width:640px;border:1px solid #E2E8F0">'
        '<tr><td style="background:#0B1220;color:#FFFFFF;padding:20px 24px">'
        f'<div style="font-size:11px;letter-spacing:2px;color:#0F766E">{escape(title.upper())} · WORKED EXPLANATION</div>'
        f'<div style="font-size:22px;font-weight:bold;margin-top:4px">{escape(unit)}</div>'
        f'<div style="font-size:12px;color:#94A3B8;margin-top:4px">{escape(type_)} · {escape(base)} → {escape(latest)}</div>'
        '</td></tr>'
        '<tr><td style="padding:16px 24px;background:#F8FAFC">'
        '<table width="100%" style="font-size:13px">'
        f'<tr><td style="color:#64748B">Overall score</td><td style="text-align:right;font-size:20px;font-weight:bold;color:#0F3D5E">{escape(f2(row.get("overall_score")))}</td></tr>'
        f'<tr><td style="color:#64748B">Rank</td><td style="text-align:right;font-size:18px;font-weight:bold">#{escape(_fmt_val(row.get("rank")))}</td></tr>'
        f'<tr><td style="color:#64748B">Category</td><td style="text-align:right;font-weight:bold">{escape(str(row.get("category") or "-"))}</td></tr>'
        f'<tr><td style="color:#64748B">{escape(rate_label)} (base → latest)</td>'
        f'<td style="text-align:right;font-family:Consolas,monospace">{escape(f2(row.get("base_rate")))}% → {escape(f2(row.get("latest_rate")))}%</td></tr>'
        f'<tr><td style="color:#64748B">Improvement</td><td style="text-align:right;font-family:Consolas,monospace">{escape(f2(row.get("improvement")))} pp</td></tr>'
        '</table></td></tr>'
        + "".join(step_blocks) +
        '<tr><td style="padding:14px 24px;border-top:1px solid #E2E8F0;font-size:11px;color:#888">'
        f'Sent by Police Performance Dashboard'
        f'{(" on behalf of " + escape(sender)) if sender else ""}. '
        'Shared for authorised police leadership review. '
        'We never ask for your password by email.</td></tr></table>'
    )
    return subject, html
