"""Read legacy XLSM workbooks (no macros executed).

Supports:
- Conviction / Timeliness: wide 'Source Data' sheet
- Emergency 112: long 'Mastersheet' monthly district facts
- Training: long 'Mastersheet' quarterly unit facts
- ANTF Meetings: wide 'Meeting Conducted' unit snapshot
- HSP: long 'Quaterly' (or Master sheet) accident/killed facts
"""
import io
import re
import warnings
from datetime import datetime, time, timedelta

import openpyxl

warnings.filterwarnings("ignore", module="openpyxl")

MONTH_ABBR = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


class WorkbookError(ValueError):
    pass


# Display renames applied at ingest so uploaded workbooks stay consistent in the app.
RANGE_ALIASES = {
    "Thane Range": "Kokan Range",
}

# Legacy HSP workbook unit labels → canonical HSP display names
HSP_UNIT_ALIASES = {
    "C.S.Nagarcity": "Chh. Sambhaji N. (C)",
    "C.S.Nagar®": "Chh. Sambhaji N. ®",
    "C.S.Nagar": "Chh. Sambhaji N. ®",
    "MB-VV": "Mira Bhyander V.V. (C)",
    "PCPC": "PCMC",
}


def _normalize_range(v) -> str:
    rng = str(v or "").strip()
    return RANGE_ALIASES.get(rng, rng)


def _num(v):
    try:
        return float(v) if v not in (None, "") else 0.0
    except (TypeError, ValueError):
        raise WorkbookError(f"Non-numeric count value: {v!r}")


def _clean_unit(v) -> str:
    return re.sub(r"\s+", " ", str(v or "").replace("\n", " ")).strip()


def _normalize_hsp_unit(v) -> str:
    cleaned = _clean_unit(v)
    return HSP_UNIT_ALIASES.get(cleaned, cleaned)


def _to_seconds(v) -> float | None:
    if v in (None, ""):
        return None
    if isinstance(v, (int, float)):
        # Excel day fraction or already seconds if large
        if 0 <= float(v) < 1.5:
            return float(v) * 86400.0
        return float(v)
    if isinstance(v, time):
        return v.hour * 3600 + v.minute * 60 + v.second + v.microsecond / 1e6
    if isinstance(v, timedelta):
        return v.total_seconds()
    if isinstance(v, datetime):
        return v.hour * 3600 + v.minute * 60 + v.second + v.microsecond / 1e6
    s = str(v).strip()
    m = re.match(r"^(\d+):(\d{2})(?::(\d{2}(?:\.\d+)?))?$", s)
    if not m:
        raise WorkbookError(f"Cannot parse time value: {v!r}")
    h, mi, sec = int(m.group(1)), int(m.group(2)), float(m.group(3) or 0)
    return h * 3600 + mi * 60 + sec


def _period_label(month, year) -> str:
    try:
        m, y = int(month), int(year)
    except (TypeError, ValueError):
        raise WorkbookError(f"Invalid month/year: {month!r}/{year!r}")
    if m < 1 or m > 12:
        raise WorkbookError(f"Month out of range: {m}")
    return f"{MONTH_ABBR[m]} {y}"


def parse_source_data(wb) -> dict:
    rows = list(wb["Source Data"].iter_rows(values_only=True))
    if len(rows) < 3:
        raise WorkbookError("Source Data sheet is empty")
    groups = " ".join(str(c) for c in rows[0] if c).lower()
    if "trial" in groups:
        domain, n_groups = "conviction", 2
    elif "registered" in groups:
        domain, n_groups = "timeliness", 3
    else:
        raise WorkbookError("Cannot detect domain: expected 'Trial cases' or 'Registered Cases' header")
    header = rows[1]
    periods = []
    for c in header[4:]:
        if c is None or c in periods:
            break
        periods.append(str(c).strip())
    n = len(periods)
    if n < 2:
        raise WorkbookError("At least two reporting periods are required")
    facts, units, issues = [], [], []
    for i, r in enumerate(rows[2:], start=3):
        if not r or not r[2] or not r[3]:
            continue
        rng, unit, typ = _normalize_range(r[1]), str(r[2]).strip(), str(r[3]).strip()
        vals = r[4:4 + n * n_groups]
        for k, p in enumerate(periods):
            den, num = _num(vals[k]), _num(vals[n + k])
            beyond = _num(vals[2 * n + k]) if domain == "timeliness" else 0
            if num > den:
                issues.append(f"Row {i} {unit} {typ} {p}: numerator exceeds denominator")
            facts.append({"unit": unit, "range": rng, "type": typ, "period": p,
                          "den": den, "num": num, "beyond": beyond})
        units.append(unit)
    if not facts:
        raise WorkbookError("No unit rows found")
    types = list(dict.fromkeys(f["type"] for f in facts))
    return {"domain": domain, "periods": periods, "types": types, "facts": facts,
            "unit_count": len(set(units)), "issues": issues[:50]}


def parse_emergency112(wb, rows=None) -> dict:
    rows = list(rows) if rows is not None else list(wb["Mastersheet"].iter_rows(values_only=True))
    if len(rows) < 3:
        raise WorkbookError("Mastersheet is empty")
    header = " ".join(str(c or "") for c in rows[1]).lower()
    if "district" not in header or "avg co" not in header:
        raise WorkbookError("Mastersheet does not look like Dashboard 112 data")
    facts, period_order, units_seen, issues = [], [], [], []
    for i, r in enumerate(rows[2:], start=3):
        if not r or r[3] in (None, ""):
            continue
        unit = _clean_unit(r[3])
        period = _period_label(r[1], r[2])
        if period not in period_order:
            period_order.append(period)
        try:
            den = _num(r[4])
            responded = _num(r[5])
            co_sec = _to_seconds(r[6])
            do_sec = _to_seconds(r[7])
            mdt_sec = _to_seconds(r[8])
            total_sec = _to_seconds(r[10])
            if total_sec is None and None not in (co_sec, do_sec, mdt_sec):
                total_sec = (co_sec or 0) + (do_sec or 0) + (mdt_sec or 0)
            closed = _num(r[11])
            pct = r[12]
            pct_100m = float(pct) if pct not in (None, "") else None
            if pct_100m is None and responded:
                pct_100m = 100.0 * closed / responded
            elif pct_100m is None:
                pct_100m = 0.0
        except WorkbookError as exc:
            issues.append(f"Row {i} {unit}: {exc}")
            continue
        facts.append({
            "unit": unit, "range": "", "type": "All", "period": period,
            "den": den, "num": closed, "beyond": 0,
            "responded": responded,
            "co_sec": co_sec or 0.0, "do_sec": do_sec or 0.0, "mdt_sec": mdt_sec or 0.0,
            "total_sec": total_sec if total_sec is not None else 0.0,
            "pct_100m": pct_100m,
        })
        if unit not in units_seen:
            units_seen.append(unit)
    if not facts:
        raise WorkbookError("No district rows found on Mastersheet")
    if len(period_order) < 2:
        raise WorkbookError("At least two months are required")
    return {
        "domain": "emergency112",
        "periods": period_order,
        "types": ["All"],
        "facts": facts,
        "unit_count": len(units_seen),
        "issues": issues[:50],
    }


def parse_training(wb, rows=None) -> dict:
    """Quarterly Training / Refresher Mastersheet (Unit × Quarter)."""
    rows = list(rows) if rows is not None else list(wb["Mastersheet"].iter_rows(values_only=True))
    if len(rows) < 2:
        raise WorkbookError("Training Mastersheet is empty")
    # Header may be row 1 (index 0)
    header_row = rows[0]
    header = " ".join(str(c or "") for c in header_row).lower()
    if "unit name" not in header or ("people present" not in header and "% of people trained" not in header):
        raise WorkbookError("Mastersheet does not look like Training Data")
    facts, period_order, units_seen, issues = [], [], [], []
    for i, r in enumerate(rows[1:], start=2):
        if not r or r[1] in (None, ""):
            continue
        unit = _clean_unit(r[1])
        period = str(r[2] or "").strip()
        if not period:
            issues.append(f"Row {i} {unit}: missing quarter")
            continue
        if period not in period_order:
            period_order.append(period)
        try:
            den, num = _num(r[3]), _num(r[4])
        except WorkbookError as exc:
            issues.append(f"Row {i} {unit}: {exc}")
            continue
        facts.append({
            "unit": unit, "range": "", "type": "All", "period": period,
            "den": den, "num": num, "beyond": 0,
        })
        if unit not in units_seen:
            units_seen.append(unit)
    if not facts:
        raise WorkbookError("No unit rows found on Training Mastersheet")
    if len(period_order) < 2:
        raise WorkbookError("At least two quarters are required")
    return {
        "domain": "training",
        "periods": period_order,
        "types": ["All"],
        "facts": facts,
        "unit_count": len(units_seen),
        "issues": issues[:50],
    }


def parse_antf(wb, rows=None) -> dict:
    """ANTF Meetings Conducted sheet — cumulative meetings + NCORD MoM uploads."""
    sheet = "Meeting Conducted" if "Meeting Conducted" in wb.sheetnames else None
    if sheet is None:
        raise WorkbookError("Sheet 'Meeting Conducted' not found")
    rows = list(rows) if rows is not None else list(wb[sheet].iter_rows(values_only=True))
    if len(rows) < 3:
        raise WorkbookError("Meeting Conducted sheet is empty")
    header = " ".join(str(c or "") for c in rows[1]).lower()
    if "name of unit" not in header or "total number of meetings" not in header:
        raise WorkbookError("Meeting Conducted does not look like ANTF Meetings data")
    # Column layout (row 2 header): unit, established, Jan..Oct, meetings, mom, meet_marks, min_marks, total, rank, clubbing
    facts, units_seen, issues = [], [], []
    period = "YTD 2026"
    for i, r in enumerate(rows[2:], start=3):
        if not r or r[0] in (None, ""):
            continue
        unit = _clean_unit(r[0])
        try:
            meetings = _num(r[12])
            mom = _num(r[13])
        except WorkbookError as exc:
            issues.append(f"Row {i} {unit}: {exc}")
            continue
        # den = meetings conducted; num = MoM uploaded count (NCORD)
        facts.append({
            "unit": unit, "range": "", "type": "All", "period": period,
            "den": meetings, "num": mom, "beyond": 0,
            "meetings": meetings, "mom_uploaded": mom,
        })
        if unit not in units_seen:
            units_seen.append(unit)
    if not facts:
        raise WorkbookError("No unit rows found on Meeting Conducted")
    return {
        "domain": "antf",
        "periods": [period],
        "types": ["All"],
        "facts": facts,
        "unit_count": len(units_seen),
        "issues": issues[:50],
    }


def parse_hsp(wb, rows=None) -> dict:
    """HSP Quaterly sheet — accidents, killed, injured by unit and quarter."""
    sheet = "Quaterly" if "Quaterly" in wb.sheetnames else ("Master sheet" if "Master sheet" in wb.sheetnames else None)
    if sheet is None:
        raise WorkbookError("Sheet 'Quaterly' not found")
    rows = list(rows) if rows is not None else list(wb[sheet].iter_rows(values_only=True))
    if len(rows) < 2:
        raise WorkbookError(f"{sheet} sheet is empty")
    header = " ".join(str(c or "") for c in rows[0]).lower()
    if "total accident" not in header or "total killed" not in header:
        raise WorkbookError(f"{sheet} does not look like HSP accident/killed data")
    # Quaterly: Sr, Unit, Quarter, Accident, Killed, Injured, ...
    # Master sheet: Sr, Unit, Year, Month, Accident, Killed, Injured, ..., Quarter
    is_master = sheet == "Master sheet"
    facts_map = {}  # (unit, period) -> aggregates (dedupe / sum months)
    period_order, units_seen, issues = [], [], []
    for i, r in enumerate(rows[1:], start=2):
        if not r or r[1] in (None, ""):
            continue
        unit = _normalize_hsp_unit(r[1])
        try:
            if is_master:
                period = str(r[12] or "").strip()
                accidents, killed, injured = _num(r[4]), _num(r[5]), _num(r[6])
            else:
                period = str(r[2] or "").strip()
                accidents, killed, injured = _num(r[3]), _num(r[4]), _num(r[5])
        except WorkbookError as exc:
            issues.append(f"Row {i} {unit}: {exc}")
            continue
        if not period:
            issues.append(f"Row {i} {unit}: missing quarter")
            continue
        key = (unit, period)
        if key in facts_map:
            # Quaterly has duplicate identical rows — keep first; Master sums months
            if is_master:
                prev = facts_map[key]
                prev["den"] += accidents
                prev["num"] += killed
                prev["beyond"] += injured
                prev["accidents"] += accidents
                prev["killed"] += killed
                prev["injured"] += injured
            continue
        facts_map[key] = {
            "unit": unit, "range": "", "type": "All", "period": period,
            "den": accidents, "num": killed, "beyond": injured,
            "accidents": accidents, "killed": killed, "injured": injured,
        }
        if period not in period_order:
            period_order.append(period)
        if unit not in units_seen:
            units_seen.append(unit)
    if not facts_map:
        raise WorkbookError("No unit rows found on HSP Quaterly sheet")
    if len(period_order) < 2:
        raise WorkbookError("At least two quarters are required")
    # Chronological order for quarter labels
    _qord = {"Jan-Mar": 0, "Apr-Jun": 1, "Jul-Sep": 2, "Oct-Dec": 3}

    def _pkey(p):
        parts = str(p).split()
        if len(parts) == 2 and parts[0] in _qord and parts[1].isdigit():
            return (int(parts[1]), _qord[parts[0]])
        return (0, 0, p)

    period_order = sorted(period_order, key=_pkey)
    return {
        "domain": "hsp",
        "periods": period_order,
        "types": ["All"],
        "facts": list(facts_map.values()),
        "unit_count": len(units_seen),
        "issues": issues[:50],
    }


def parse_workbook(content: bytes):
    try:
        wb = openpyxl.load_workbook(io.BytesIO(content), read_only=True, data_only=True)
    except Exception as exc:
        raise WorkbookError(f"Cannot open workbook: {exc}")
    names = wb.sheetnames
    if "Quaterly" in names or ("Master sheet" in names and "Killed_Working" in names):
        return parse_hsp(wb)
    if "Meeting Conducted" in names:
        return parse_antf(wb)
    if "Mastersheet" in names:
        # read_only sheets are single-pass — load once
        ms_rows = list(wb["Mastersheet"].iter_rows(values_only=True))
        h0 = " ".join(str(c or "") for c in (ms_rows[0] if ms_rows else []))
        h1 = " ".join(str(c or "") for c in (ms_rows[1] if len(ms_rows) > 1 else []))
        # Training: headers on row 1
        if "unit name" in h0.lower() and ("people present" in h0.lower() or "% of people trained" in h0.lower()):
            return parse_training(wb, rows=ms_rows)
        # 112: headers on row 2
        if "district" in h1.lower() and "avg co" in h1.lower():
            return parse_emergency112(wb, rows=ms_rows)
    if "Source Data" in names:
        return parse_source_data(wb)
    raise WorkbookError("Sheet 'Source Data', Quaterly/HSP, Meeting Conducted, 112 Mastersheet, or Training Mastersheet not found")
