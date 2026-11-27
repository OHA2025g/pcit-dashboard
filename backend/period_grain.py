"""Aggregate monthly Emergency 112 facts into quarterly / half-yearly / yearly / YTD views."""

from __future__ import annotations

MONTH_ABBR = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
MONTH_ORD = {m: i for i, m in enumerate(MONTH_ABBR[1:], 1)}

GRAINS = ("monthly", "quarterly", "half_yearly", "yearly", "ytd")

GRAIN_LABELS = {
    "monthly": "Monthly",
    "quarterly": "Quarterly",
    "half_yearly": "Half-yearly",
    "yearly": "Yearly",
    "ytd": "YTD",
}

_Q_LABEL = {1: "Jan-Mar", 2: "Apr-Jun", 3: "Jul-Sep", 4: "Oct-Dec"}
_Q_ORD = {"Jan-Mar": 1, "Apr-Jun": 2, "Jul-Sep": 3, "Oct-Dec": 4}
_Q_TO_HALF = {
    "Jan-Mar": "Jan-Jun",
    "Apr-Jun": "Jan-Jun",
    "Jul-Sep": "Jul-Dec",
    "Oct-Dec": "Jul-Dec",
}

# Grains available depending on how HSP periods were uploaded
HSP_GRAINS_BY_SOURCE = {
    "monthly": GRAINS,
    "quarterly": ("quarterly", "half_yearly", "yearly"),
    "other": ("quarterly",),
}


def parse_month_period(period: str):
    """Parse 'Aug 2026' → (year, month) or None."""
    parts = str(period or "").split()
    if len(parts) == 2 and parts[0] in MONTH_ORD and parts[1].isdigit():
        return int(parts[1]), MONTH_ORD[parts[0]]
    return None


def parse_quarter_period(period: str):
    """Parse 'Apr-Jun 2026' → (year, quarter_ord, quarter_label) or None."""
    parts = str(period or "").split()
    if len(parts) == 2 and parts[0] in _Q_ORD and parts[1].isdigit():
        return int(parts[1]), _Q_ORD[parts[0]], parts[0]
    return None


def hsp_source_kind(periods: list) -> str:
    """Detect whether HSP periods are monthly Master rows or Quaterly sheet labels."""
    plist = periods or []
    if any(parse_month_period(p) for p in plist):
        return "monthly"
    if any(parse_quarter_period(p) for p in plist):
        return "quarterly"
    return "other"


def hsp_default_grain(source: str) -> str:
    return "monthly" if source == "monthly" else "quarterly"


def hsp_allowed_grains(source: str) -> tuple:
    return HSP_GRAINS_BY_SOURCE.get(source) or HSP_GRAINS_BY_SOURCE["other"]


def hsp_grain_options(source: str) -> list:
    return [{"id": g, "label": GRAIN_LABELS[g]} for g in hsp_allowed_grains(source)]


def clamp_hsp_grain(grain: str | None, source: str) -> str:
    g = normalize_grain(grain)
    allowed = hsp_allowed_grains(source)
    return g if g in allowed else hsp_default_grain(source)


def normalize_grain(grain: str | None) -> str:
    g = (grain or "monthly").strip().lower().replace("-", "_").replace(" ", "_")
    aliases = {
        "month": "monthly",
        "months": "monthly",
        "quarter": "quarterly",
        "quarters": "quarterly",
        "half": "half_yearly",
        "halfyearly": "half_yearly",
        "half_year": "half_yearly",
        "halfyear": "half_yearly",
        "year": "yearly",
        "years": "yearly",
        "annual": "yearly",
    }
    g = aliases.get(g, g)
    return g if g in GRAINS else "monthly"


def _bucket(year: int, month: int, grain: str):
    """Return (label, sort_key) for a calendar month under the given grain."""
    if grain == "monthly":
        return f"{MONTH_ABBR[month]} {year}", (year, month)
    if grain == "quarterly":
        q = (month - 1) // 3 + 1
        return f"{_Q_LABEL[q]} {year}", (year, q)
    if grain == "half_yearly":
        half = 1 if month <= 6 else 2
        label = "Jan-Jun" if half == 1 else "Jul-Dec"
        return f"{label} {year}", (year, half)
    if grain == "yearly":
        return str(year), (year, 0)
    # ytd — one snapshot ending at this month
    return f"YTD {MONTH_ABBR[month]} {year}", (year, month)


def list_grain_periods(monthly_periods: list, grain: str) -> list:
    """Ordered period labels for a grain, derived from monthly labels only."""
    grain = normalize_grain(grain)
    parsed = []
    for p in monthly_periods or []:
        ym = parse_month_period(p)
        if ym:
            parsed.append(ym)
    if not parsed:
        return list(monthly_periods or [])
    parsed = sorted(set(parsed))
    if grain == "monthly":
        return [f"{MONTH_ABBR[m]} {y}" for y, m in parsed]

    labels = {}
    for y, m in parsed:
        label, key = _bucket(y, m, grain)
        labels[label] = key
    return sorted(labels.keys(), key=lambda L: labels[L])


def default_grain_window(periods: list):
    if not periods:
        return None, None
    if len(periods) == 1:
        return periods[0], periods[0]
    return periods[-2], periods[-1]


def _weighted_avg(pairs):
    """pairs: list of (value, weight)."""
    total_w = 0.0
    total = 0.0
    for v, w in pairs:
        if v is None or w is None or w <= 0:
            continue
        total += float(v) * float(w)
        total_w += float(w)
    if total_w <= 0:
        return None
    return total / total_w


def _merge_month_facts(items: list) -> dict:
    den = sum(float(f.get("den") or 0) for f in items)
    responded = sum(float(f.get("responded") or 0) for f in items)
    num = sum(float(f.get("num") or 0) for f in items)
    beyond = sum(float(f.get("beyond") or 0) for f in items)
    weights = [(f, float(f.get("responded") or f.get("den") or 0)) for f in items]
    total_sec = _weighted_avg([(f.get("total_sec"), w) for f, w in weights])
    co_sec = _weighted_avg([(f.get("co_sec"), w) for f, w in weights])
    do_sec = _weighted_avg([(f.get("do_sec"), w) for f, w in weights])
    mdt_sec = _weighted_avg([(f.get("mdt_sec"), w) for f, w in weights])
    pct = (100.0 * num / responded) if responded else 0.0
    return {
        "den": den,
        "num": num,
        "beyond": beyond,
        "responded": responded,
        "co_sec": co_sec or 0.0,
        "do_sec": do_sec or 0.0,
        "mdt_sec": mdt_sec or 0.0,
        "total_sec": total_sec if total_sec is not None else 0.0,
        "pct_100m": pct,
    }


def aggregate_112_facts(facts: dict, grain: str):
    """
    Aggregate monthly {(unit, period): fact} into the requested grain.

    Returns (new_facts, periods) where new_facts keep unit/range/type from source months.
    """
    grain = normalize_grain(grain)
    if grain == "monthly":
        periods = list_grain_periods([p for (_, p) in facts.keys()], "monthly")
        # Keep only parsable monthly keys; preserve structure
        out = {}
        for (unit, period), fact in facts.items():
            ym = parse_month_period(period)
            if not ym:
                continue
            label = f"{MONTH_ABBR[ym[1]]} {ym[0]}"
            out[(unit, label)] = {**fact, "period": label}
        return out, periods

    # Index monthly facts by unit → [(y, m, fact), ...]
    by_unit = {}
    meta = {}
    for (unit, period), fact in facts.items():
        ym = parse_month_period(period)
        if not ym:
            continue
        by_unit.setdefault(unit, []).append((ym[0], ym[1], fact))
        meta.setdefault(unit, {
            "unit": unit,
            "range": fact.get("range") or "",
            "type": fact.get("type") or "All",
        })

    periods = list_grain_periods(
        [f"{MONTH_ABBR[m]} {y}" for items in by_unit.values() for y, m, _ in items],
        grain,
    )
    out = {}

    if grain == "ytd":
        for unit, items in by_unit.items():
            items_sorted = sorted(items, key=lambda x: (x[0], x[1]))
            for y, m, _ in items_sorted:
                label, _ = _bucket(y, m, "ytd")
                window = [f for yy, mm, f in items_sorted if yy == y and mm <= m]
                if not window:
                    continue
                merged = _merge_month_facts(window)
                out[(unit, label)] = {**meta[unit], "period": label, **merged}
        return out, periods

    # quarterly / half_yearly / yearly — group months that share a bucket label
    for unit, items in by_unit.items():
        buckets = {}
        for y, m, fact in items:
            label, _ = _bucket(y, m, grain)
            buckets.setdefault(label, []).append(fact)
        for label, window in buckets.items():
            merged = _merge_month_facts(window)
            out[(unit, label)] = {**meta[unit], "period": label, **merged}

    return out, periods


def grain_meta_payload(monthly_periods: list) -> dict:
    """Build period_grains block for /meta (emergency112 / hsp)."""
    out = {}
    for g in GRAINS:
        periods = list_grain_periods(monthly_periods, g)
        b, l = default_grain_window(periods)
        out[g] = {
            "label": GRAIN_LABELS[g],
            "periods": periods,
            "default_base": b,
            "default_latest": l,
        }
    return out


def list_quarter_grain_periods(quarter_periods: list, grain: str) -> list:
    """Ordered period labels when source data is quarterly (Jan-Mar YYYY)."""
    grain = normalize_grain(grain)
    parsed = []
    for p in quarter_periods or []:
        q = parse_quarter_period(p)
        if q:
            parsed.append(q)
    if not parsed:
        return list(quarter_periods or [])
    parsed = sorted({(y, qo, ql) for y, qo, ql in parsed}, key=lambda x: (x[0], x[1]))
    if grain == "quarterly":
        return [f"{ql} {y}" for y, qo, ql in parsed]
    if grain == "half_yearly":
        labels = {}
        for y, _qo, ql in parsed:
            half = _Q_TO_HALF[ql]
            labels[(y, 1 if half == "Jan-Jun" else 2)] = f"{half} {y}"
        return [labels[k] for k in sorted(labels.keys())]
    if grain == "yearly":
        return [str(y) for y in sorted({y for y, _, _ in parsed})]
    return [f"{ql} {y}" for y, qo, ql in parsed]


def grain_meta_payload_hsp(periods: list) -> dict:
    """period_grains block for HSP — monthly Master or Quaterly source."""
    source = hsp_source_kind(periods)
    if source == "monthly":
        return grain_meta_payload(periods)
    out = {}
    for g in hsp_allowed_grains(source):
        plist = list_quarter_grain_periods(periods, g) if source == "quarterly" else list(periods or [])
        b, l = default_grain_window(plist)
        out[g] = {
            "label": GRAIN_LABELS[g],
            "periods": plist,
            "default_base": b,
            "default_latest": l,
        }
    return out


def aggregate_hsp_quarter_facts(facts: dict, grain: str):
    """Aggregate Quaterly-sheet {(unit, period): fact} into half-yearly / yearly views."""
    grain = normalize_grain(grain)
    periods = list_quarter_grain_periods([p for (_, p) in facts.keys()], grain)
    if grain == "quarterly":
        out = {}
        for (unit, period), fact in facts.items():
            if parse_quarter_period(period):
                out[(unit, period)] = {
                    **fact,
                    "period": period,
                    "den": fact.get("accidents") if fact.get("accidents") is not None else fact.get("den"),
                    "num": fact.get("killed") if fact.get("killed") is not None else fact.get("num"),
                    "beyond": fact.get("injured") if fact.get("injured") is not None else fact.get("beyond"),
                }
        return out, periods

    by_unit = {}
    meta = {}
    for (unit, period), fact in facts.items():
        q = parse_quarter_period(period)
        if not q:
            continue
        y, qo, ql = q
        by_unit.setdefault(unit, []).append((y, qo, ql, fact))
        meta.setdefault(unit, {
            "unit": unit,
            "range": fact.get("range") or "",
            "type": fact.get("type") or "All",
        })

    out = {}
    for unit, items in by_unit.items():
        buckets = {}
        for y, _qo, ql, fact in items:
            if grain == "half_yearly":
                label = f"{_Q_TO_HALF[ql]} {y}"
            elif grain == "yearly":
                label = str(y)
            else:
                label = f"{ql} {y}"
            buckets.setdefault(label, []).append(fact)
        for label, window in buckets.items():
            merged = _merge_hsp_month_facts(window)
            out[(unit, label)] = {**meta[unit], "period": label, **merged}
    return out, periods


def resolve_hsp_facts(facts: dict, source_periods: list, grain: str):
    """
    Apply the requested period view to HSP facts.
    Returns (facts, periods, grain_norm, source_kind).
    """
    source = hsp_source_kind(source_periods)
    grain_norm = clamp_hsp_grain(grain, source)
    if source == "monthly":
        agg, periods = aggregate_hsp_facts(facts, grain_norm)
        return agg, periods, grain_norm, source
    if source == "quarterly":
        agg, periods = aggregate_hsp_quarter_facts(facts, grain_norm)
        return agg, periods, grain_norm, source
    return facts, list(source_periods or []), grain_norm, source


def _merge_hsp_month_facts(items: list) -> dict:
    accidents = sum(float(f.get("accidents") if f.get("accidents") is not None else f.get("den") or 0) for f in items)
    killed = sum(float(f.get("killed") if f.get("killed") is not None else f.get("num") or 0) for f in items)
    injured = sum(float(f.get("injured") if f.get("injured") is not None else f.get("beyond") or 0) for f in items)
    return {
        "den": accidents,
        "num": killed,
        "beyond": injured,
        "accidents": accidents,
        "killed": killed,
        "injured": injured,
    }


def aggregate_hsp_facts(facts: dict, grain: str):
    """
    Aggregate monthly HSP {(unit, period): fact} into the requested grain.

    Returns (new_facts, periods). Monthly labels must be parseable as 'Mon YYYY'.
    """
    grain = normalize_grain(grain)
    if grain == "monthly":
        periods = list_grain_periods([p for (_, p) in facts.keys()], "monthly")
        out = {}
        for (unit, period), fact in facts.items():
            ym = parse_month_period(period)
            if not ym:
                continue
            label = f"{MONTH_ABBR[ym[1]]} {ym[0]}"
            out[(unit, label)] = {
                **fact,
                "period": label,
                "den": fact.get("accidents") if fact.get("accidents") is not None else fact.get("den"),
                "num": fact.get("killed") if fact.get("killed") is not None else fact.get("num"),
                "beyond": fact.get("injured") if fact.get("injured") is not None else fact.get("beyond"),
            }
        return out, periods

    by_unit = {}
    meta = {}
    for (unit, period), fact in facts.items():
        ym = parse_month_period(period)
        if not ym:
            continue
        by_unit.setdefault(unit, []).append((ym[0], ym[1], fact))
        meta.setdefault(unit, {
            "unit": unit,
            "range": fact.get("range") or "",
            "type": fact.get("type") or "All",
        })

    periods = list_grain_periods(
        [f"{MONTH_ABBR[m]} {y}" for items in by_unit.values() for y, m, _ in items],
        grain,
    )
    out = {}

    if grain == "ytd":
        for unit, items in by_unit.items():
            items_sorted = sorted(items, key=lambda x: (x[0], x[1]))
            for y, m, _ in items_sorted:
                label, _ = _bucket(y, m, "ytd")
                window = [f for yy, mm, f in items_sorted if yy == y and mm <= m]
                if not window:
                    continue
                merged = _merge_hsp_month_facts(window)
                out[(unit, label)] = {**meta[unit], "period": label, **merged}
        return out, periods

    for unit, items in by_unit.items():
        buckets = {}
        for y, m, fact in items:
            label, _ = _bucket(y, m, grain)
            buckets.setdefault(label, []).append(fact)
        for label, window in buckets.items():
            merged = _merge_hsp_month_facts(window)
            out[(unit, label)] = {**meta[unit], "period": label, **merged}

    return out, periods
