"""Pure KPI + scoring engine for Conviction, Timeliness, Emergency 112, Training, ANTF, and HSP domains."""
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
    "hsp": {
        "label": "HSP Performance",
        "den": "Total accidents", "num": "Total killed", "rate": "Fatality rate",
        "beyond": "Total injured",
        "types": ["All"],
    },
    "training": {
        "label": "Training Performance",
        "den": "Unit headcount", "num": "People trained", "rate": "% people trained",
        "types": ["All"],
    },
    "antf": {
        "label": "ANTF Meetings",
        "den": "Meetings conducted", "num": "MoM uploaded (NCORD)", "rate": "Upload rate",
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
    "hsp": {
        # Excel Chart / Explanation: Accidents + Killed (lower counts = better)
        "perf_weight": 0.70,
        "accident_perf_weight": 0.30,
        "killed_perf_weight": 0.70,
        "accident_imp_weight": 0.20,
        "killed_imp_weight": 0.70,
        "rank_bands": [
            {"max_rank": 5, "label": "Excellent"},
            {"max_rank": 12, "label": "Very Good"},
            {"max_rank": 22, "label": "Good"},
            {"max_rank": 34, "label": "Needs Improvement"},
        ],
        "rank_default": "Poor",
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
    "antf": {
        # Excel Ranking: meetings × 3 + MoM uploads × 2
        "meeting_mark": 3,
        "upload_mark": 2,
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
        "conviction": 1 / 6, "timeliness": 1 / 6, "emergency112": 1 / 6,
        "hsp": 1 / 6, "training": 1 / 6, "antf": 1 / 6,
    },
}

CATEGORIES = ["Top Performer", "Good Performer", "Moderate Performer", "Needs Improvement", "Low Performer"]
EMERGENCY112_CATEGORIES = [
    "Excellent Performer", "Good Performer", "Moderate Performer", "Needs Improvement", "Low Performer",
]
TRAINING_CATEGORIES = ["Top Performer", "Good Performer", "Needs Improvement", "Low Performer"]
ANTF_CATEGORIES = ["Top Performer", "Good Performer", "Needs Improvement", "Low Performer"]
HSP_CATEGORIES = ["Excellent", "Very Good", "Good", "Needs Improvement", "Poor"]


def categories_for(domain: str):
    if domain == "emergency112":
        return EMERGENCY112_CATEGORIES
    if domain == "training":
        return TRAINING_CATEGORIES
    if domain == "antf":
        return ANTF_CATEGORIES
    if domain == "hsp":
        return HSP_CATEGORIES
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


def hsp_reduction_marks(base_count, latest_count):
    """Excel Chart nested IF for reduction % → marks (Accidents / Killed)."""
    if base_count in (None, 0):
        return 0
    if latest_count is None or latest_count >= base_count:
        return 0
    pct = (base_count - latest_count) / base_count
    # Chart formula: ≥10→100, ≥8→90, ≥6→80, ≥4→70, ≥2→60, ≥1→40, else 20
    if pct >= 0.10:
        return 100
    if pct >= 0.08:
        return 90
    if pct >= 0.06:
        return 80
    if pct >= 0.04:
        return 70
    if pct >= 0.02:
        return 60
    if pct >= 0.01:
        return 40
    return 20


def hsp_rank_category(rank, dp):
    for b in dp.get("rank_bands", []):
        if rank <= b["max_rank"]:
            return b["label"]
    return dp.get("rank_default", "Poor")


def score_units(domain, facts, units, base, latest, policy):
    """facts: {(unit, period): {den,num,beyond}}; units: ordered [(unit, range)]."""
    if domain == "emergency112":
        return score_emergency112(facts, units, base, latest, policy)
    if domain == "training":
        return score_training(facts, units, base, latest, policy)
    if domain == "antf":
        return score_antf(facts, units, base, latest, policy)
    if domain == "hsp":
        return score_hsp(facts, units, base, latest, policy)
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


def score_antf(facts, units, base, latest, policy):
    """ANTF Meetings — marks = meetings×3 + MoM uploads×2; competition rank by total marks."""
    dp = policy.get("antf") or DEFAULT_POLICY["antf"]
    meet_pts = float(dp.get("meeting_mark", 3))
    upload_pts = float(dp.get("upload_mark", 2))
    rows = []
    for unit, rng in units:
        lf = facts.get((unit, latest)) or facts.get((unit, base))
        meetings = (lf.get("meetings") if lf and lf.get("meetings") is not None else (lf.get("den", 0) if lf else 0)) or 0
        mom = (lf.get("mom_uploaded") if lf and lf.get("mom_uploaded") is not None else (lf.get("num", 0) if lf else 0)) or 0
        r = {
            "unit": unit, "range": rng or "",
            "base_den": meetings, "base_num": mom, "latest_den": meetings, "latest_num": mom,
            "base_rate": None, "latest_rate": None,
            "meetings": meetings, "mom_uploaded": mom,
            "eligible": lf is not None,
        }
        if r["eligible"]:
            r["meeting_marks"] = meetings * meet_pts
            r["upload_marks"] = mom * upload_pts
            r["marks"] = r["meeting_marks"] + r["upload_marks"]
            r["overall_score"] = r["marks"]
            r["performance_score"] = r["marks"]
            r["improvement"] = None
            r["improvement_marks"] = None
            r["improvement_score"] = None
        else:
            r.update(
                meeting_marks=None, upload_marks=None, marks=None, overall_score=None,
                performance_score=None, improvement=None, improvement_marks=None,
                improvement_score=None, rank=None, category="Not scored",
            )
        rows.append(r)

    elig = [r for r in rows if r["eligible"]]
    marks_vals = [r["marks"] for r in elig]
    mn, mx = (min(marks_vals), max(marks_vals)) if marks_vals else (0, 0)
    min_unit = next((r["unit"] for r in elig if r["marks"] == mn), None)
    max_unit = next((r["unit"] for r in elig if r["marks"] == mx), None)
    ordered = sorted(elig, key=lambda x: (-x["marks"], -x["meetings"], -x["mom_uploaded"], x["unit"]))
    # Competition rank (ties share rank; next rank skips) — matches Excel
    i = 0
    while i < len(ordered):
        j = i + 1
        while j < len(ordered) and ordered[j]["marks"] == ordered[i]["marks"]:
            j += 1
        rank = i + 1
        for k in range(i, j):
            ordered[k]["rank"] = rank
            ordered[k]["category"] = training_rank_category(rank, dp)
        i = j
    cohort = {
        "min_rate": mn, "max_rate": mx, "min_unit": min_unit, "max_unit": max_unit,
        "eligible": len(elig), "covered": len(rows), "weight": 1.0,
    }
    return rows, cohort


def score_hsp(facts, units, base, latest, policy):
    """HSP Chart/Explanation: inverted min-max performance on accidents+killed + reduction improvement."""
    dp = policy.get("hsp") or DEFAULT_POLICY["hsp"]
    w = float(dp.get("perf_weight", 0.7))
    aw = float(dp.get("accident_perf_weight", 0.3))
    kw = float(dp.get("killed_perf_weight", 0.7))
    aiw = float(dp.get("accident_imp_weight", 0.2))
    kiw = float(dp.get("killed_imp_weight", 0.7))
    rows = []
    for unit, rng in units:
        bf, lf = facts.get((unit, base)), facts.get((unit, latest))
        ba = (bf.get("accidents") if bf and bf.get("accidents") is not None else (bf.get("den", 0) if bf else 0)) or 0
        bk = (bf.get("killed") if bf and bf.get("killed") is not None else (bf.get("num", 0) if bf else 0)) or 0
        bi = (bf.get("injured") if bf and bf.get("injured") is not None else (bf.get("beyond", 0) if bf else 0)) or 0
        la = (lf.get("accidents") if lf and lf.get("accidents") is not None else (lf.get("den", 0) if lf else 0)) or 0
        lk = (lf.get("killed") if lf and lf.get("killed") is not None else (lf.get("num", 0) if lf else 0)) or 0
        li = (lf.get("injured") if lf and lf.get("injured") is not None else (lf.get("beyond", 0) if lf else 0)) or 0
        r = {
            "unit": unit, "range": rng or "",
            "base_den": ba, "base_num": bk, "latest_den": la, "latest_num": lk,
            "base_accidents": ba, "base_killed": bk, "base_injured": bi,
            "latest_accidents": la, "latest_killed": lk, "latest_injured": li,
            "base_rate": rate(bk, ba), "latest_rate": rate(lk, la),
            "eligible": bf is not None and lf is not None,
        }
        if r["eligible"]:
            r["accident_reduction_pct"] = None if ba == 0 else 100.0 * (ba - la) / ba
            r["killed_reduction_pct"] = None if bk == 0 else 100.0 * (bk - lk) / bk
            r["accident_improvement_marks"] = hsp_reduction_marks(ba, la)
            r["killed_improvement_marks"] = hsp_reduction_marks(bk, lk)
            r["improvement_score"] = (
                r["accident_improvement_marks"] * aiw + r["killed_improvement_marks"] * kiw
            )
            r["improvement"] = r["improvement_score"]
            r["improvement_marks"] = r["improvement_score"]
        else:
            r.update(
                accident_reduction_pct=None, killed_reduction_pct=None,
                accident_improvement_marks=None, killed_improvement_marks=None,
                improvement=None, improvement_marks=None, improvement_score=None,
                accident_perf_score=None, killed_perf_score=None, performance_score=None,
                overall_score=None, rank=None, category="Not scored",
            )
        rows.append(r)

    elig = [r for r in rows if r["eligible"]]
    acc_vals = [r["latest_accidents"] for r in elig]
    kill_vals = [r["latest_killed"] for r in elig]
    amin, amax = (min(acc_vals), max(acc_vals)) if acc_vals else (0, 0)
    kmin, kmax = (min(kill_vals), max(kill_vals)) if kill_vals else (0, 0)
    min_unit = next((r["unit"] for r in elig if r["latest_accidents"] == amin), None)
    max_unit = next((r["unit"] for r in elig if r["latest_accidents"] == amax), None)
    for r in elig:
        # Lower count = better → inverted min-max
        r["accident_perf_score"] = 0.0 if amax == amin else 100.0 * (amax - r["latest_accidents"]) / (amax - amin)
        r["killed_perf_score"] = 0.0 if kmax == kmin else 100.0 * (kmax - r["latest_killed"]) / (kmax - kmin)
        r["performance_score"] = r["accident_perf_score"] * aw + r["killed_perf_score"] * kw
        r["overall_score"] = r["performance_score"] * w + r["improvement_score"] * (1 - w)

    ordered = sorted(elig, key=lambda x: (-(x["overall_score"] or 0), x["unit"]))
    for i, r in enumerate(ordered, 1):
        r["rank"] = i
        r["category"] = hsp_rank_category(i, dp)
    cohort = {
        "min_rate": amin, "max_rate": amax, "min_unit": min_unit, "max_unit": max_unit,
        "min_killed": kmin, "max_killed": kmax,
        "eligible": len(elig), "covered": len(rows), "weight": w,
        "accident_weight": aw, "killed_weight": kw,
        "accident_imp_weight": aiw, "killed_imp_weight": kiw,
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
    keys = ("conviction", "timeliness", "emergency112", "hsp", "training", "antf")
    cw = policy.get("combined_weights")
    if cw and all(k in cw for k in keys):
        return {k: cw[k] for k in keys}
    # Legacy weight → split remainder equally across newer domains
    w = policy.get("combined_weight", 0.5)
    rem = (1 - w) / 5
    return {
        "conviction": w, "timeliness": rem, "emergency112": rem,
        "hsp": rem, "training": rem, "antf": rem,
    }


def _norm_unit(name: str) -> str:
    return " ".join(str(name or "").upper().replace("-", " ").replace(",", " ").split())


def _index_by_map(rows, unit_map):
    idx = {_norm_unit(r["unit"]): r for r in rows}
    for src, dst in unit_map.items():
        row = next((r for r in rows if _norm_unit(r["unit"]) == _norm_unit(dst)), None)
        if row:
            idx[_norm_unit(src)] = row
    return idx


def combine(conv_rows, tim_rows, e112_rows, training_rows, antf_rows, hsp_rows,
            unit_map, unit_map_112, unit_map_training, unit_map_antf, unit_map_hsp, policy):
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
    antf = _index_by_map(antf_rows, unit_map_antf)
    hsp = _index_by_map(hsp_rows, unit_map_hsp)
    out = []
    for c in conv_rows:
        t = tim.get(_norm_unit(unit_map.get(c["unit"], c["unit"].upper()))) or tim.get(_norm_unit(c["unit"]))
        e = e112.get(_norm_unit(unit_map_112.get(c["unit"], c["unit"]))) or e112.get(_norm_unit(c["unit"]))
        tr = train.get(_norm_unit(unit_map_training.get(c["unit"], c["unit"]))) or train.get(_norm_unit(c["unit"]))
        a = antf.get(_norm_unit(unit_map_antf.get(c["unit"], c["unit"]))) or antf.get(_norm_unit(c["unit"]))
        h = hsp.get(_norm_unit(unit_map_hsp.get(c["unit"], c["unit"]))) or hsp.get(_norm_unit(c["unit"]))
        row = {
            "unit": c["unit"], "range": c["range"],
            "conviction_score": c["overall_score"], "conviction_rank": c["rank"],
            "timeliness_unit": t["unit"] if t else None,
            "timeliness_score": t["overall_score"] if t else None,
            "timeliness_rank": t["rank"] if t else None,
            "emergency112_unit": e["unit"] if e else None,
            "emergency112_score": e["overall_score"] if e else None,
            "emergency112_rank": e["rank"] if e else None,
            "hsp_unit": h["unit"] if h else None,
            "hsp_score": h["overall_score"] if h else None,
            "hsp_rank": h["rank"] if h else None,
            "training_unit": tr["unit"] if tr else None,
            "training_score": tr["overall_score"] if tr else None,
            "training_rank": tr["rank"] if tr else None,
            "antf_unit": a["unit"] if a else None,
            "antf_score": a["overall_score"] if a else None,
            "antf_rank": a["rank"] if a else None,
        }
        parts = []
        for key, score_key in (
            ("conviction", "conviction_score"), ("timeliness", "timeliness_score"),
            ("emergency112", "emergency112_score"), ("hsp", "hsp_score"),
            ("training", "training_score"), ("antf", "antf_score"),
        ):
            if row[score_key] is not None:
                parts.append((weights[key], row[score_key]))
        if len(parts) == 6:
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
    elif domain == "antf":
        t["total_meetings"] = sum(r.get("meetings") or r.get("latest_den") or 0 for r in rows)
        t["total_mom_uploaded"] = sum(r.get("mom_uploaded") or r.get("latest_num") or 0 for r in rows)
        marks = [r["marks"] for r in rows if r.get("marks") is not None]
        t["avg_marks"] = sum(marks) / len(marks) if marks else None
        t["total_marks"] = sum(marks) if marks else None
    elif domain == "hsp":
        t["total_accidents"] = sum(r.get("latest_accidents") or r.get("latest_den") or 0 for r in rows)
        t["total_killed"] = sum(r.get("latest_killed") or r.get("latest_num") or 0 for r in rows)
        t["total_injured"] = sum(r.get("latest_injured") or 0 for r in rows)
        t["base_accidents"] = sum(r.get("base_accidents") or r.get("base_den") or 0 for r in rows)
        t["base_killed"] = sum(r.get("base_killed") or r.get("base_num") or 0 for r in rows)
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
    if domain == "antf":
        return explain_antf(row, cohort, policy, base, latest)
    if domain == "hsp":
        return explain_hsp(row, cohort, policy, base, latest)
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


def explain_antf(row, cohort, policy, base, latest):
    dp = policy.get("antf") or DEFAULT_POLICY["antf"]
    meet_pts = dp.get("meeting_mark", 3)
    upload_pts = dp.get("upload_mark", 2)
    n0 = lambda v: f"{v:,.0f}"
    return [
        {"step": 1, "title": "Selection", "lines": [["Unit", row["unit"]], ["Period", latest or base]]},
        {"step": 2, "title": "Meetings & MoM uploads",
         "lines": [
             ["Total meetings from Jan 2026", n0(row.get("meetings"))],
             ["MoM uploaded on NCORD Portal", n0(row.get("mom_uploaded"))],
         ]},
        {"step": 3, "title": "Marks",
         "formula": (
             f"(Meetings × {meet_pts}) + (MoM uploaded × {upload_pts}) = "
             f"({n0(row.get('meetings'))} × {meet_pts}) + ({n0(row.get('mom_uploaded'))} × {upload_pts}) = "
             f"{n0(row.get('meeting_marks'))} + {n0(row.get('upload_marks'))} = {n0(row.get('marks'))}"
         )},
        {"step": 4, "title": "Rank",
         "formula": f"Rank {row.get('rank')} of {cohort['eligible']} units by total marks (1 = highest; ties share rank)"},
        {"step": 5, "title": "Performance",
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


def explain_hsp(row, cohort, policy, base, latest):
    dp = policy.get("hsp") or DEFAULT_POLICY["hsp"]
    w = float(dp.get("perf_weight", 0.7))
    aw = float(dp.get("accident_perf_weight", 0.3))
    kw = float(dp.get("killed_perf_weight", 0.7))
    aiw = float(dp.get("accident_imp_weight", 0.2))
    kiw = float(dp.get("killed_imp_weight", 0.7))
    f2 = lambda v: "—" if v is None else f"{v:.2f}"
    n0 = lambda v: f"{v:,.0f}"
    return [
        {"step": 1, "title": "Selection", "lines": [["Unit", row["unit"]], ["Base period", base], ["Latest period", latest]]},
        {"step": 2, "title": f"Base period · {base}",
         "lines": [["Total accidents", n0(row.get("base_accidents"))], ["Total killed", n0(row.get("base_killed"))],
                   ["Total injured", n0(row.get("base_injured"))]]},
        {"step": 3, "title": f"Latest period · {latest}",
         "lines": [["Total accidents", n0(row.get("latest_accidents"))], ["Total killed", n0(row.get("latest_killed"))],
                   ["Total injured", n0(row.get("latest_injured"))]]},
        {"step": 4, "title": "Performance score of accidents (latest)",
         "lines": [["Minimum latest accidents", n0(cohort.get("min_rate"))],
                   ["Maximum latest accidents", n0(cohort.get("max_rate"))]],
         "formula": (
             f"(Max − Unit) ÷ (Max − Min) × 100 = ({n0(cohort.get('max_rate'))} − {n0(row.get('latest_accidents'))}) ÷ "
             f"({n0(cohort.get('max_rate'))} − {n0(cohort.get('min_rate'))}) × 100 = {f2(row.get('accident_perf_score'))}"
         )},
        {"step": 5, "title": "Performance score of killed (latest)",
         "lines": [["Minimum latest killed", n0(cohort.get("min_killed"))],
                   ["Maximum latest killed", n0(cohort.get("max_killed"))]],
         "formula": (
             f"(Max − Unit) ÷ (Max − Min) × 100 = ({n0(cohort.get('max_killed'))} − {n0(row.get('latest_killed'))}) ÷ "
             f"({n0(cohort.get('max_killed'))} − {n0(cohort.get('min_killed'))}) × 100 = {f2(row.get('killed_perf_score'))}"
         )},
        {"step": 6, "title": "Final performance score",
         "formula": (
             f"({f2(row.get('accident_perf_score'))} × {round(aw * 100)}%) + "
             f"({f2(row.get('killed_perf_score'))} × {round(kw * 100)}%) = {f2(row.get('performance_score'))}"
         )},
        {"step": 7, "title": "Accident reduction marks",
         "formula": (
             f"(Base − Latest) ÷ Base × 100 = ({n0(row.get('base_accidents'))} − {n0(row.get('latest_accidents'))}) ÷ "
             f"{n0(row.get('base_accidents'))} = {f2(row.get('accident_reduction_pct'))}% → "
             f"{row.get('accident_improvement_marks')} marks"
         )},
        {"step": 8, "title": "Killed reduction marks",
         "formula": (
             f"(Base − Latest) ÷ Base × 100 = ({n0(row.get('base_killed'))} − {n0(row.get('latest_killed'))}) ÷ "
             f"{n0(row.get('base_killed'))} = {f2(row.get('killed_reduction_pct'))}% → "
             f"{row.get('killed_improvement_marks')} marks"
         )},
        {"step": 9, "title": "Final improvement",
         "formula": (
             f"({row.get('accident_improvement_marks')} × {round(aiw * 100)}%) + "
             f"({row.get('killed_improvement_marks')} × {round(kiw * 100)}%) = {f2(row.get('improvement_score'))}"
         )},
        {"step": 10, "title": "Final score",
         "formula": (
             f"({f2(row.get('performance_score'))} × {round(w * 100)}%) + "
             f"({f2(row.get('improvement_score'))} × {round((1 - w) * 100)}%) = {f2(row.get('overall_score'))}"
         )},
        {"step": 11, "title": "Rank",
         "formula": f"Rank {row.get('rank')} of {cohort['eligible']} units by final score (1 = highest)"},
        {"step": 12, "title": "Category (by rank)",
         "table": [[f"Rank ≤ {b['max_rank']}", b["label"]] for b in dp.get("rank_bands", [])]
         + [["Otherwise", dp.get("rank_default", "Poor")]],
         "formula": f"Rank {row.get('rank')} → {row.get('category')}"},
    ]
