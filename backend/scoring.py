"""Pure KPI + scoring engine for Conviction, Timeliness, Emergency 112, and Training domains."""
from statistics import pstdev

DOMAINS = {
    "conviction": {
        "label": "Conviction",
        "den": "Trial cases", "num": "Convicted cases", "rate": "Conviction rate",
        "types": ["JMFC", "Session", "Both JMFC and Session"],
    },
    "timeliness": {
        "label": "Charge Sheet Timeliness",
        "den": "Registered cases", "num": "Charge-sheeted within time", "rate": "Within-time rate",
        "beyond": "Charge-sheeted beyond time",
        "types": ["60 Day", "90 Day", "Both 60 Day & 90 Day"],
    },
    "emergency112": {
        "label": "112 Performance",
        "den": "Actionable calls", "num": "Events closed ≤100m", "rate": "% closed ≤100m",
        "types": ["All"],
    },
    "training": {
        "label": "Training Performance",
        "den": "Unit headcount", "num": "People trained", "rate": "% people trained",
        "types": ["All"],
    },
}

# Explanation Data / Scale: max total response seconds → performance marks
_112_TIME_BANDS = [
    (8 * 60, 100), (9 * 60, 90), (10 * 60, 80), (11 * 60, 70), (12 * 60, 60),
    (13 * 60, 50), (14 * 60, 40), (15 * 60, 30), (16 * 60, 20), (17 * 60, 10),
]
# % closed ≤100m → marks (LOOKUP floors)
_112_PCT_THRESHOLDS = [10, 20, 30, 40, 50, 60, 70, 80, 90]
_112_PCT_MARKS = [20, 30, 40, 50, 60, 70, 80, 90, 100]

DEFAULT_POLICY = {
    "version": 1,
    "conviction": {
        "perf_weight": 0.70,
        "bands": [
            {"op": "<", "value": 0, "marks": 0},
            {"op": "<", "value": 1, "marks": 2},
            {"op": "<", "value": 3, "marks": 4},
            {"op": "<", "value": 5, "marks": 6},
            {"op": "<", "value": 8, "marks": 8},
        ],
        "default_marks": 10,
    },
    "timeliness": {
        "perf_weight": 0.70,
        "bands": [
            {"op": "<", "value": 0.5, "marks": 0},
            {"op": "<=", "value": 1, "marks": 2},
            {"op": "<=", "value": 1.5, "marks": 4},
            {"op": "<=", "value": 2, "marks": 5},
            {"op": "<", "value": 3, "marks": 6},
            {"op": "<=", "value": 5, "marks": 7},
            {"op": "<=", "value": 7, "marks": 8},
            {"op": "<", "value": 9, "marks": 9},
        ],
        "default_marks": 10,
    },
    "emergency112": {
        "perf_weight": 0.70,
        "time_weight": 0.80,
        "pct_weight": 0.20,
        # Improvement marks × 10 = Excel improvement score (0–100)
        "bands": [
            {"op": "<=", "value": 0, "marks": 0},
            {"op": "<", "value": 1, "marks": 2},
            {"op": "<", "value": 2, "marks": 4},
            {"op": "<", "value": 3, "marks": 5},
            {"op": "<", "value": 4, "marks": 6},
            {"op": "<", "value": 6, "marks": 7},
            {"op": "<", "value": 8, "marks": 8},
            {"op": "<", "value": 10, "marks": 9},
        ],
        "default_marks": 10,
        "score_bands": [
            {"min": 90, "label": "Excellent Performer"},
            {"min": 75, "label": "Good Performer"},
            {"min": 60, "label": "Moderate Performer"},
            {"min": 40, "label": "Needs Improvement"},
        ],
        "score_default": "Low Performer",
    },
    "training": {
        # Excel Ranking sheet — marks from % people trained (0–100 scale)
        "ranking_bands": [
            {"min_pct": 25, "marks": 10},
            {"min_pct": 20, "marks": 8},
            {"min_pct": 15, "marks": 6},
            {"min_pct": 10, "marks": 4},
            {"min_pct": 5, "marks": 2},
        ],
        "default_marks": 0,
        "rank_bands": [
            {"max_rank": 10, "label": "Top Performer"},
            {"max_rank": 20, "label": "Good Performer"},
            {"max_rank": 30, "label": "Needs Improvement"},
        ],
        "rank_default": "Low Performer",
    },
    "rank_bands": [
        {"max_rank": 10, "label": "Top Performer"},
        {"max_rank": 20, "label": "Good Performer"},
        {"max_rank": 30, "label": "Moderate Performer"},
        {"max_rank": 40, "label": "Needs Improvement"},
    ],
    "rank_default": "Low Performer",
    "combined_weight": 0.5,
    "combined_weights": {
        "conviction": 0.25, "timeliness": 0.25, "emergency112": 0.25, "training": 0.25,
    },
}

CATEGORIES = ["Top Performer", "Good Performer", "Moderate Performer", "Needs Improvement", "Low Performer"]
EMERGENCY112_CATEGORIES = [
    "Excellent Performer", "Good Performer", "Moderate Performer", "Needs Improvement", "Low Performer",
]
TRAINING_CATEGORIES = ["Top Performer", "Good Performer", "Needs Improvement", "Low Performer"]


def categories_for(domain: str):
    if domain == "emergency112":
        return EMERGENCY112_CATEGORIES
    if domain == "training":
        return TRAINING_CATEGORIES
    return CATEGORIES


def rate(num, den):
    return 100.0 * num / den if den else None


def improvement_marks(value, dp):
    for b in dp["bands"]:
        if (b["op"] == "<" and value < b["value"]) or (b["op"] == "<=" and value <= b["value"]):
            return b["marks"]
    return dp["default_marks"]


def rank_category(rank, policy):
    for b in policy["rank_bands"]:
        if rank <= b["max_rank"]:
            return b["label"]
    return policy["rank_default"]


def score_category_112(score, dp):
    for b in dp.get("score_bands", []):
        if score >= b["min"]:
            return b["label"]
    return dp.get("score_default", "Low Performer")


def _period_vals(facts, unit, period):
    f = facts.get((unit, period))
    return (f["den"], f["num"], f.get("beyond", 0)) if f else (0, 0, 0)


def _112_time_marks(total_sec):
    if total_sec is None:
        return None
    sec = round(float(total_sec))
    for limit, marks in _112_TIME_BANDS:
        if sec <= limit:
            return marks
    return 0


def _112_pct_marks(pct):
    if pct is None:
        return None
    if pct == 0:
        return 0
    if pct < 10:
        return 10
    marks = 0
    for thr, m in zip(_112_PCT_THRESHOLDS, _112_PCT_MARKS):
        if pct >= thr:
            marks = m
    return marks


def fmt_duration(sec):
    if sec is None:
        return "—"
    sec = max(0, int(round(sec)))
    h, rem = divmod(sec, 3600)
    m, s = divmod(rem, 60)
    return f"{h}:{m:02d}:{s:02d}" if h else f"{m}:{s:02d}"


def training_marks(pct, dp=None):
    """Excel Ranking sheet marks for % people trained (0–100 scale)."""
    if pct is None:
        return None
    bands = (dp or {}).get("ranking_bands") or DEFAULT_POLICY["training"]["ranking_bands"]
    default = (dp or {}).get("default_marks", 0)
    for b in bands:
        if pct >= b["min_pct"]:
            return b["marks"]
    return default


def training_rank_category(rank, dp):
    for b in dp.get("rank_bands", []):
        if rank <= b["max_rank"]:
            return b["label"]
    return dp.get("rank_default", "Low Performer")


def score_units(domain, facts, units, base, latest, policy):
    """facts: {(unit, period): {den,num,beyond}}; units: ordered [(unit, range)]."""
    if domain == "emergency112":
        return score_emergency112(facts, units, base, latest, policy)
    if domain == "training":
        return score_training(facts, units, base, latest, policy)
    dp = policy[domain]
    w = dp["perf_weight"]
    rows = []
    for unit, rng in units:
        bd, bn, bb = _period_vals(facts, unit, base)
        ld, ln, lb = _period_vals(facts, unit, latest)
        r = {
            "unit": unit, "range": rng,
            "base_den": bd, "base_num": bn, "latest_den": ld, "latest_num": ln,
            "base_rate": rate(bn, bd), "latest_rate": rate(ln, ld),
        }
        if domain == "timeliness":
            r.update(base_beyond=bb, latest_beyond=lb,
                     base_beyond_rate=rate(bb, bd), latest_beyond_rate=rate(lb, ld))
            r["beyond_change"] = (r["latest_beyond_rate"] - r["base_beyond_rate"]
                                  if r["base_beyond_rate"] is not None and r["latest_beyond_rate"] is not None else None)
        r["eligible"] = r["base_rate"] is not None and r["latest_rate"] is not None
        rows.append(r)

    elig = [r for r in rows if r["eligible"]]
    lrates = [r["latest_rate"] for r in elig]
    mn, mx = (min(lrates), max(lrates)) if lrates else (0, 0)
    min_unit = next((r["unit"] for r in elig if r["latest_rate"] == mn), None)
    max_unit = next((r["unit"] for r in elig if r["latest_rate"] == mx), None)
    for r in rows:
        if not r["eligible"]:
            r.update(improvement=None, performance_score=None, improvement_marks=None,
                     improvement_score=None, overall_score=None, rank=None, category="Not scored")
            continue
        r["improvement"] = r["latest_rate"] - r["base_rate"]
        r["performance_score"] = (r["latest_rate"] - mn) / (mx - mn) * 100 if mx > mn else 0.0
        r["improvement_marks"] = improvement_marks(r["improvement"], dp)
        r["improvement_score"] = r["improvement_marks"] * 10
        r["overall_score"] = w * r["performance_score"] + (1 - w) * r["improvement_score"]
    ordered = sorted(elig, key=lambda r: -r["overall_score"])  # stable: ties keep source order
    for i, r in enumerate(ordered, 1):
        r["rank"] = i
        r["category"] = rank_category(i, policy)
    cohort = {"min_rate": mn, "max_rate": mx, "min_unit": min_unit, "max_unit": max_unit,
              "eligible": len(elig), "covered": len(rows), "weight": w}
    return rows, cohort


def score_emergency112(facts, units, base, latest, policy):
    """Excel Explanation Data / Scale parity for Emergency 112."""
    dp = policy["emergency112"]
    w = dp["perf_weight"]
    tw, pw = dp.get("time_weight", 0.8), dp.get("pct_weight", 0.2)
    rows = []
    for unit, rng in units:
        bf, lf = facts.get((unit, base)), facts.get((unit, latest))
        r = {"unit": unit, "range": rng or ""}
        if not bf or not lf:
            r.update(
                base_den=0, base_num=0, latest_den=0, latest_num=0,
                base_rate=None, latest_rate=None, eligible=False,
                base_total_sec=None, latest_total_sec=None,
                base_responded=0, latest_responded=0,
                base_co_sec=None, base_do_sec=None, base_mdt_sec=None,
                latest_co_sec=None, latest_do_sec=None, latest_mdt_sec=None,
            )
            rows.append(r)
            continue
        r.update(
            base_den=bf.get("den", 0), base_num=bf.get("num", 0),
            latest_den=lf.get("den", 0), latest_num=lf.get("num", 0),
            base_responded=bf.get("responded", 0), latest_responded=lf.get("responded", 0),
            base_total_sec=bf.get("total_sec"), latest_total_sec=lf.get("total_sec"),
            base_co_sec=bf.get("co_sec"), base_do_sec=bf.get("do_sec"), base_mdt_sec=bf.get("mdt_sec"),
            latest_co_sec=lf.get("co_sec"), latest_do_sec=lf.get("do_sec"), latest_mdt_sec=lf.get("mdt_sec"),
            base_rate=bf.get("pct_100m", rate(bf.get("num", 0), bf.get("responded") or bf.get("den") or 0)),
            latest_rate=lf.get("pct_100m", rate(lf.get("num", 0), lf.get("responded") or lf.get("den") or 0)),
        )
        r["eligible"] = r["base_total_sec"] is not None and r["latest_total_sec"] is not None
        rows.append(r)

    elig = [r for r in rows if r["eligible"]]
    lrates = [r["latest_rate"] for r in elig if r["latest_rate"] is not None]
    mn, mx = (min(lrates), max(lrates)) if lrates else (0, 0)
    min_unit = next((r["unit"] for r in elig if r["latest_rate"] == mn), None)
    max_unit = next((r["unit"] for r in elig if r["latest_rate"] == mx), None)

    for r in rows:
        if not r["eligible"]:
            r.update(
                improvement=None, performance_score=None, improvement_marks=None,
                improvement_score=None, overall_score=None, rank=None, category="Not scored",
                time_improvement_pct=None, pct_improvement=None,
                perf_time_score=None, perf_pct_score=None,
                time_improvement_score=None, pct_improvement_score=None,
            )
            continue
        base_sec, latest_sec = r["base_total_sec"], r["latest_total_sec"]
        r["perf_time_score"] = _112_time_marks(latest_sec)
        r["perf_pct_score"] = _112_pct_marks(r["latest_rate"])
        r["performance_score"] = tw * r["perf_time_score"] + pw * r["perf_pct_score"]
        r["time_improvement_pct"] = ((base_sec - latest_sec) / base_sec * 100) if base_sec else 0.0
        r["pct_improvement"] = (
            r["latest_rate"] - r["base_rate"]
            if r["base_rate"] is not None and r["latest_rate"] is not None else 0.0
        )
        r["improvement"] = r["pct_improvement"]
        r["time_improvement_score"] = improvement_marks(r["time_improvement_pct"], dp) * 10
        r["pct_improvement_score"] = improvement_marks(r["pct_improvement"], dp) * 10
        r["improvement_marks"] = None
        r["improvement_score"] = tw * r["time_improvement_score"] + pw * r["pct_improvement_score"]
        r["overall_score"] = w * r["performance_score"] + (1 - w) * r["improvement_score"]
        r["category"] = score_category_112(r["overall_score"], dp)

    ordered = sorted(elig, key=lambda x: -x["overall_score"])
    for i, r in enumerate(ordered, 1):
        r["rank"] = i
    cohort = {
        "min_rate": mn, "max_rate": mx, "min_unit": min_unit, "max_unit": max_unit,
        "eligible": len(elig), "covered": len(rows), "weight": w,
        "time_weight": tw, "pct_weight": pw,
    }
    return rows, cohort


def score_training(facts, units, base, latest, policy):
    """Excel Ranking / clubbing parity — marks from % trained; no Conviction 70/30."""
    dp = policy.get("training") or DEFAULT_POLICY["training"]
    rows = []
    for unit, rng in units:
        bf, lf = facts.get((unit, base)), facts.get((unit, latest))
        bd = bf.get("den", 0) if bf else 0
        bn = bf.get("num", 0) if bf else 0
        ld = lf.get("den", 0) if lf else 0
        ln = lf.get("num", 0) if lf else 0
        r = {
            "unit": unit, "range": rng or "",
            "base_den": bd, "base_num": bn, "latest_den": ld, "latest_num": ln,
            "base_rate": rate(bn, bd) if bf else None,
            "latest_rate": rate(ln, ld) if lf else None,
        }
        # Score from latest period only (Ranking sheet)
        r["eligible"] = r["latest_rate"] is not None
        if r["eligible"]:
            r["marks"] = training_marks(r["latest_rate"], dp)
            r["base_marks"] = training_marks(r["base_rate"], dp) if r["base_rate"] is not None else None
            r["overall_score"] = r["marks"] * 10
            r["performance_score"] = r["overall_score"]
            r["improvement"] = (
                r["latest_rate"] - r["base_rate"]
                if r["base_rate"] is not None else None
            )
            r["improvement_marks"] = None
            r["improvement_score"] = None
        else:
            r.update(
                marks=None, base_marks=None, overall_score=None, performance_score=None,
                improvement=None, improvement_marks=None, improvement_score=None,
                rank=None, category="Not scored",
            )
        rows.append(r)

    elig = [r for r in rows if r["eligible"]]
    lrates = [r["latest_rate"] for r in elig]
    mn, mx = (min(lrates), max(lrates)) if lrates else (0, 0)
    min_unit = next((r["unit"] for r in elig if r["latest_rate"] == mn), None)
    max_unit = next((r["unit"] for r in elig if r["latest_rate"] == mx), None)
    ordered = sorted(elig, key=lambda x: (-x["marks"], -x["latest_rate"]))
    for i, r in enumerate(ordered, 1):
        r["rank"] = i
        r["category"] = training_rank_category(i, dp)
    cohort = {
        "min_rate": mn, "max_rate": mx, "min_unit": min_unit, "max_unit": max_unit,
        "eligible": len(elig), "covered": len(rows), "weight": 1.0,
    }
    return rows, cohort


def _rate_at(facts, unit, period):
    f = facts.get((unit, period))
    return rate(f["num"], f["den"]) if f else None


def _state_rate(facts, units, period):
    den = sum(facts.get((u, period), {}).get("den", 0) for u, _ in units)
    num = sum(facts.get((u, period), {}).get("num", 0) for u, _ in units)
    return rate(num, den)


def enrich(domain, rows, data, types, type_, periods, base, latest, policy):
    """Section A indicators: acquittal / pending, Session-JMFC gap, consistency, rank movement, workload share."""
    entry = data[type_]
    facts, units = entry["facts"], entry["units"]
    state_latest = sum(r["latest_den"] for r in rows)
    ib, il = periods.index(base), periods.index(latest)
    prev, prev_window = {}, None
    if ib > 0 and il > 0:
        prev_window = (periods[ib - 1], periods[il - 1])
        prev_rows, _ = score_units(domain, facts, units, *prev_window, policy)
        prev = {r["unit"]: r["rank"] for r in prev_rows}
    jmfc, session = (data.get(types[0]), data.get(types[1])) if len(types) >= 2 else (None, None)
    for r in rows:
        u = r["unit"]
        r["workload_share"] = 100.0 * r["latest_den"] / state_latest if state_latest else None
        if domain == "emergency112":
            vals = []
            for p in periods:
                f = facts.get((u, p))
                if f and f.get("pct_100m") is not None:
                    vals.append(f["pct_100m"])
        else:
            vals = [v for v in (_rate_at(facts, u, p) for p in periods) if v is not None]
        r["volatility"] = pstdev(vals) if len(vals) > 1 else None
        r["prev_rank"] = prev.get(u)
        r["rank_movement"] = r["prev_rank"] - r["rank"] if r["prev_rank"] and r["rank"] else None
        if domain == "conviction":
            r["base_acquittal_rate"] = None if r["base_rate"] is None else 100 - r["base_rate"]
            r["latest_acquittal_rate"] = None if r["latest_rate"] is None else 100 - r["latest_rate"]
            sr = _rate_at(session["facts"], u, latest) if session else None
            jr = _rate_at(jmfc["facts"], u, latest) if jmfc else None
            r["session_rate"], r["jmfc_rate"] = sr, jr
            r["session_jmfc_gap"] = sr - jr if sr is not None and jr is not None else None
        elif domain == "timeliness":
            for k in ("base", "latest"):
                pend = max(r[f"{k}_den"] - r[f"{k}_num"] - r[f"{k}_beyond"], 0)
                r[f"{k}_pending"] = pend
                r[f"{k}_pending_rate"] = rate(pend, r[f"{k}_den"])
    extras = {"prev_window": prev_window}
    if domain == "conviction" and jmfc and session:
        s_rate, j_rate = _state_rate(session["facts"], session["units"], latest), _state_rate(jmfc["facts"], jmfc["units"], latest)
        extras.update(state_session_rate=s_rate, state_jmfc_rate=j_rate,
                      state_session_jmfc_gap=s_rate - j_rate if s_rate is not None and j_rate is not None else None)
    if domain == "emergency112" and rows:
        bt = [r["base_total_sec"] for r in rows if r.get("base_total_sec") is not None]
        lt = [r["latest_total_sec"] for r in rows if r.get("latest_total_sec") is not None]
        extras.update(
            state_base_total_sec=(sum(bt) / len(bt) if bt else None),
            state_latest_total_sec=(sum(lt) / len(lt) if lt else None),
        )
    return extras


def combined_weights(policy):
    keys = ("conviction", "timeliness", "emergency112", "training")
    cw = policy.get("combined_weights")
    if cw and all(k in cw for k in keys):
        return {k: cw[k] for k in keys}
    # Legacy 2-domain weight → split remainder equally across newer domains
    w = policy.get("combined_weight", 0.5)
    rem = (1 - w) / 3
    return {"conviction": w, "timeliness": rem, "emergency112": rem, "training": rem}


def _norm_unit(name: str) -> str:
    return " ".join(str(name or "").upper().replace("-", " ").replace(",", " ").split())


def _index_by_map(rows, unit_map):
    idx = {_norm_unit(r["unit"]): r for r in rows}
    for src, dst in unit_map.items():
        row = next((r for r in rows if _norm_unit(r["unit"]) == _norm_unit(dst)), None)
        if row:
            idx[_norm_unit(src)] = row
    return idx


def combine(conv_rows, tim_rows, e112_rows, training_rows, unit_map, unit_map_112, unit_map_training, policy):
    """Combined police performance index from each domain's overall score."""
    weights = combined_weights(policy)
    tim = _index_by_map(tim_rows, {k: v for k, v in unit_map.items()})
    # timeliness map values are uppercase names already used as lookup
    for c_unit, t_name in unit_map.items():
        row = next((r for r in tim_rows if _norm_unit(r["unit"]) == _norm_unit(t_name)), None)
        if row:
            tim[_norm_unit(c_unit)] = row
            tim[_norm_unit(t_name)] = row
    e112 = _index_by_map(e112_rows, unit_map_112)
    train = _index_by_map(training_rows, unit_map_training)
    out = []
    for c in conv_rows:
        t = tim.get(_norm_unit(unit_map.get(c["unit"], c["unit"].upper()))) or tim.get(_norm_unit(c["unit"]))
        e = e112.get(_norm_unit(unit_map_112.get(c["unit"], c["unit"]))) or e112.get(_norm_unit(c["unit"]))
        tr = train.get(_norm_unit(unit_map_training.get(c["unit"], c["unit"]))) or train.get(_norm_unit(c["unit"]))
        row = {
            "unit": c["unit"], "range": c["range"],
            "conviction_score": c["overall_score"], "conviction_rank": c["rank"],
            "timeliness_unit": t["unit"] if t else None,
            "timeliness_score": t["overall_score"] if t else None,
            "timeliness_rank": t["rank"] if t else None,
            "emergency112_unit": e["unit"] if e else None,
            "emergency112_score": e["overall_score"] if e else None,
            "emergency112_rank": e["rank"] if e else None,
            "training_unit": tr["unit"] if tr else None,
            "training_score": tr["overall_score"] if tr else None,
            "training_rank": tr["rank"] if tr else None,
        }
        parts = []
        for key, score_key in (
            ("conviction", "conviction_score"), ("timeliness", "timeliness_score"),
            ("emergency112", "emergency112_score"), ("training", "training_score"),
        ):
            if row[score_key] is not None:
                parts.append((weights[key], row[score_key]))
        if len(parts) == 4:
            total_w = sum(w for w, _ in parts)
            row["combined_score"] = sum(w * s for w, s in parts) / total_w if total_w else None
        else:
            row["combined_score"] = None
        out.append(row)
    scored = sorted([r for r in out if r["combined_score"] is not None], key=lambda r: -r["combined_score"])
    for i, r in enumerate(scored, 1):
        r["rank"], r["category"] = i, rank_category(i, policy)
    for r in out:
        r.setdefault("rank", None)
        r.setdefault("category", "Not scored")
    return out, weights


def totals(domain, rows):
    t = {k: sum(r[k] for r in rows) for k in ("base_den", "base_num", "latest_den", "latest_num")}
    if domain == "emergency112":
        br = sum(r.get("base_responded", 0) for r in rows)
        lr = sum(r.get("latest_responded", 0) for r in rows)
        t["base_responded"], t["latest_responded"] = br, lr
        t["base_rate"] = rate(t["base_num"], br or t["base_den"])
        t["latest_rate"] = rate(t["latest_num"], lr or t["latest_den"])
        bt = [r["base_total_sec"] for r in rows if r.get("base_total_sec") is not None]
        lt = [r["latest_total_sec"] for r in rows if r.get("latest_total_sec") is not None]
        t["base_total_sec"] = sum(bt) / len(bt) if bt else None
        t["latest_total_sec"] = sum(lt) / len(lt) if lt else None
        t["time_improvement_pct"] = (
            (t["base_total_sec"] - t["latest_total_sec"]) / t["base_total_sec"] * 100
            if t["base_total_sec"] else None
        )
    else:
        t["base_rate"] = rate(t["base_num"], t["base_den"])
        t["latest_rate"] = rate(t["latest_num"], t["latest_den"])
    t["improvement"] = (t["latest_rate"] - t["base_rate"]
                        if t["base_rate"] is not None and t["latest_rate"] is not None else None)
    if domain == "timeliness":
        t["base_beyond"] = sum(r["base_beyond"] for r in rows)
        t["latest_beyond"] = sum(r["latest_beyond"] for r in rows)
        t["base_beyond_rate"] = rate(t["base_beyond"], t["base_den"])
        t["latest_beyond_rate"] = rate(t["latest_beyond"], t["latest_den"])
        for k in ("base", "latest"):
            t[f"{k}_pending"] = max(t[f"{k}_den"] - t[f"{k}_num"] - t[f"{k}_beyond"], 0)
            t[f"{k}_pending_rate"] = rate(t[f"{k}_pending"], t[f"{k}_den"])
    elif domain == "conviction":
        t["base_acquittal_rate"] = None if t["base_rate"] is None else 100 - t["base_rate"]
        t["latest_acquittal_rate"] = None if t["latest_rate"] is None else 100 - t["latest_rate"]
    elif domain == "training":
        marks = [r["marks"] for r in rows if r.get("marks") is not None]
        t["avg_marks"] = sum(marks) / len(marks) if marks else None
    moved = [r.get("rank_movement") for r in rows if r.get("rank_movement") is not None]
    t["moved_up"] = sum(1 for m in moved if m > 0)
    t["moved_down"] = sum(1 for m in moved if m < 0)
    steady = sorted([r for r in rows if r.get("volatility") is not None], key=lambda r: r["volatility"])
    t["most_consistent"] = {"unit": steady[0]["unit"], "volatility": steady[0]["volatility"]} if steady else None
    scored = [r["overall_score"] for r in rows if r["overall_score"] is not None]
    t["avg_overall_score"] = sum(scored) / len(scored) if scored else None
    t["unit_count"] = len(rows)
    t["scored_count"] = len(scored)
    return t


def explain(domain, row, cohort, policy, type_, base, latest):
    if domain == "emergency112":
        return explain_emergency112(row, cohort, policy, base, latest)
    if domain == "training":
        return explain_training(row, cohort, policy, base, latest)
    d = DOMAINS[domain]
    dp = policy[domain]
    w = dp["perf_weight"]
    f2 = lambda v: "—" if v is None else f"{v:.2f}"
    n0 = lambda v: f"{v:,.0f}"
    steps = [
        {"step": 1, "title": "Selection", "lines": [["Case type", type_], ["Unit", row["unit"]], ["Range", row["range"]]]},
        {"step": 2, "title": f"Base period · {base}", "lines": [[d["den"], row["base_den"]], [d["num"], row["base_num"]]],
         "formula": f"({d['num']} ÷ {d['den']}) × 100 = ({n0(row['base_num'])} ÷ {n0(row['base_den'])}) × 100 = {f2(row['base_rate'])}%"},
        {"step": 3, "title": f"Latest period · {latest}", "lines": [[d["den"], row["latest_den"]], [d["num"], row["latest_num"]]],
         "formula": f"({d['num']} ÷ {d['den']}) × 100 = ({n0(row['latest_num'])} ÷ {n0(row['latest_den'])}) × 100 = {f2(row['latest_rate'])}%"},
        {"step": 4, "title": "Performance score",
         "lines": [[f"Minimum latest {d['rate'].lower()} ({cohort['min_unit']})", f2(cohort["min_rate"]) + "%"],
                   [f"Maximum latest {d['rate'].lower()} ({cohort['max_unit']})", f2(cohort["max_rate"]) + "%"]],
         "formula": f"(Latest − Min) ÷ (Max − Min) × 100 = ({f2(row['latest_rate'])} − {f2(cohort['min_rate'])}) ÷ ({f2(cohort['max_rate'])} − {f2(cohort['min_rate'])}) × 100 = {f2(row['performance_score'])}"},
        {"step": 5, "title": "Improvement",
         "formula": f"Latest rate − Base rate = {f2(row['latest_rate'])} − {f2(row['base_rate'])} = {f2(row['improvement'])} pp"},
        {"step": 6, "title": "Improvement marks",
         "table": [[f"Improvement {b['op']} {b['value']} pp", b["marks"]] for b in dp["bands"]] + [["Otherwise", dp["default_marks"]]],
         "formula": f"{f2(row['improvement'])} pp → {row['improvement_marks']} marks"},
        {"step": 7, "title": "Improvement score",
         "formula": f"Improvement marks × 10 = {row['improvement_marks']} × 10 = {row['improvement_score']}"},
        {"step": 8, "title": "Overall score",
         "formula": f"({f2(row['performance_score'])} × {round(w*100)}%) + ({row['improvement_score']} × {round((1-w)*100)}%) = {f2(row['overall_score'])}"},
        {"step": 9, "title": "Rank", "formula": f"Rank {row['rank']} of {cohort['eligible']} score-eligible units (1 = highest overall score)"},
        {"step": 10, "title": "Rank category",
         "table": [[f"Rank ≤ {b['max_rank']}", b["label"]] for b in policy["rank_bands"]] + [["Otherwise", policy["rank_default"]]],
         "formula": f"Rank {row['rank']} → {row['category']}"},
    ]
    extra = [["Share of state workload (latest cases)", f"{f2(row.get('workload_share'))}%"],
             ["Consistency: std. deviation of rate across all periods", f"{f2(row.get('volatility'))} pp"],
             ["Rank movement vs previous window", "—" if row.get("rank_movement") is None else f"{row['rank_movement']:+d} (was #{row['prev_rank']})"]]
    if domain == "conviction":
        extra = [["Acquittal / non-conviction rate (latest)", f"{f2(row.get('latest_acquittal_rate'))}%"],
                 ["Session − JMFC conviction gap (latest)", f"{f2(row.get('session_jmfc_gap'))} pp"]] + extra
    else:
        extra = [["Pending charge sheets (latest)", f"{n0(row.get('latest_pending', 0))} ({f2(row.get('latest_pending_rate'))}%)"]] + extra
    if domain == "timeliness":
        steps.append({"step": 11, "title": "Beyond-time context (not scored)",
                      "lines": [[f"Base beyond-time cases ({base})", row["base_beyond"]], [f"Latest beyond-time cases ({latest})", row["latest_beyond"]]],
                      "formula": f"Beyond-time rate {f2(row['base_beyond_rate'])}% → {f2(row['latest_beyond_rate'])}% (change {f2(row['beyond_change'])} pp)"})
    steps.append({"step": len(steps) + 1, "title": "Additional indicators (not scored)", "lines": extra})
    return steps


def explain_training(row, cohort, policy, base, latest):
    dp = policy.get("training") or DEFAULT_POLICY["training"]
    f2 = lambda v: "—" if v is None else f"{v:.2f}"
    n0 = lambda v: f"{v:,.0f}"
    bands = dp.get("ranking_bands", [])
    return [
        {"step": 1, "title": "Selection", "lines": [["Unit", row["unit"]], ["Base period", base], ["Latest period", latest]]},
        {"step": 2, "title": f"Base period · {base}",
         "lines": [["Unit headcount", n0(row.get("base_den"))], ["People trained", n0(row.get("base_num"))]],
         "formula": f"% trained = ({n0(row.get('base_num'))} ÷ {n0(row.get('base_den'))}) × 100 = {f2(row.get('base_rate'))}% → Marks {row.get('base_marks')}"},
        {"step": 3, "title": f"Latest period · {latest}",
         "lines": [["Unit headcount", n0(row.get("latest_den"))], ["People trained", n0(row.get("latest_num"))]],
         "formula": f"% trained = ({n0(row.get('latest_num'))} ÷ {n0(row.get('latest_den'))}) × 100 = {f2(row.get('latest_rate'))}%"},
        {"step": 4, "title": "Ranking marks (latest % trained)",
         "table": [[f"≥ {b['min_pct']}%", b["marks"]] for b in bands] + [["Otherwise", dp.get("default_marks", 0)]],
         "formula": f"{f2(row.get('latest_rate'))}% → {row.get('marks')} marks"},
        {"step": 5, "title": "Score (for charts / combined index)",
         "formula": f"Marks × 10 = {row.get('marks')} × 10 = {f2(row.get('overall_score'))}"},
        {"step": 6, "title": "Rank",
         "formula": f"Rank {row.get('rank')} of {cohort['eligible']} units by marks (1 = highest)"},
        {"step": 7, "title": "Category (Excel clubbing)",
         "table": [[f"Rank ≤ {b['max_rank']}", b["label"]] for b in dp.get("rank_bands", [])] + [["Otherwise", dp.get("rank_default", "Low Performer")]],
         "formula": f"Rank {row.get('rank')} → {row.get('category')}"},
    ]


def explain_emergency112(row, cohort, policy, base, latest):
    dp = policy["emergency112"]
    w = dp["perf_weight"]
    tw, pw = dp.get("time_weight", 0.8), dp.get("pct_weight", 0.2)
    f2 = lambda v: "—" if v is None else f"{v:.2f}"
    steps = [
        {"step": 1, "title": "Selection", "lines": [["Unit", row["unit"]], ["Base period", base], ["Latest period", latest]]},
        {"step": 2, "title": f"Base period · {base}",
         "lines": [["Total response time (A+B+C)", fmt_duration(row.get("base_total_sec"))],
                   ["% closed ≤100m (D)", f2(row.get("base_rate")) + "%"],
                   ["Actionable calls", row.get("base_den")], ["Responded calls", row.get("base_responded")]]},
        {"step": 3, "title": f"Latest period · {latest}",
         "lines": [["Total response time (A+B+C)", fmt_duration(row.get("latest_total_sec"))],
                   ["% closed ≤100m (D)", f2(row.get("latest_rate")) + "%"],
                   ["Actionable calls", row.get("latest_den")], ["Responded calls", row.get("latest_responded")]]},
        {"step": 4, "title": "Performance score of A+B+C (latest response time)",
         "formula": f"Scale band for {fmt_duration(row.get('latest_total_sec'))} → {row.get('perf_time_score')}"},
        {"step": 5, "title": "Performance score of D (% ≤100m)",
         "formula": f"Scale band for {f2(row.get('latest_rate'))}% → {row.get('perf_pct_score')}"},
        {"step": 6, "title": "Final performance score",
         "formula": f"({f2(row.get('perf_time_score'))} × {round(tw*100)}%) + ({f2(row.get('perf_pct_score'))} × {round(pw*100)}%) = {f2(row.get('performance_score'))}"},
        {"step": 7, "title": "Time improvement %",
         "formula": f"(Base − Latest) ÷ Base × 100 = ({fmt_duration(row.get('base_total_sec'))} − {fmt_duration(row.get('latest_total_sec'))}) ÷ base = {f2(row.get('time_improvement_pct'))}%"},
        {"step": 8, "title": "100m improvement (pp)",
         "formula": f"Latest % − Base % = {f2(row.get('latest_rate'))} − {f2(row.get('base_rate'))} = {f2(row.get('pct_improvement'))} pp"},
        {"step": 9, "title": "Final improvement",
         "formula": f"({f2(row.get('time_improvement_score'))} × {round(tw*100)}%) + ({f2(row.get('pct_improvement_score'))} × {round(pw*100)}%) = {f2(row.get('improvement_score'))}"},
        {"step": 10, "title": "Final score",
         "formula": f"({f2(row.get('performance_score'))} × {round(w*100)}%) + ({f2(row.get('improvement_score'))} × {round((1-w)*100)}%) = {f2(row.get('overall_score'))}"},
        {"step": 11, "title": "Category (score bands)",
         "table": [[f"Score ≥ {b['min']}", b["label"]] for b in dp.get("score_bands", [])] + [["Otherwise", dp.get("score_default", "Low Performer")]],
         "formula": f"Final score {f2(row.get('overall_score'))} → {row.get('category')}"},
        {"step": 12, "title": "Rank", "formula": f"Rank {row.get('rank')} of {cohort['eligible']} scored districts"},
    ]
    return steps
