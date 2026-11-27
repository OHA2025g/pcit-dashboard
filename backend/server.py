import asyncio
import copy
import hashlib
import hmac
import json
import re
import os
import logging
import uuid
from contextlib import suppress
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

import requests
from dotenv import load_dotenv
from fastapi import FastAPI, APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request, Response, UploadFile, File
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from pymongo import ASCENDING, DESCENDING, IndexModel, ReturnDocument
from pymongo.errors import DuplicateKeyError
from starlette.concurrency import run_in_threadpool
from starlette.middleware.cors import CORSMiddleware
from starlette.responses import FileResponse

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

try:
    from backend.auth import auth_router, bind_auth, bootstrap_admin, require_user
    from backend.scoring import (
        DOMAINS, DEFAULT_POLICY, CATEGORIES, categories_for, score_units, totals, explain, enrich, combine,
        combined_weights, _norm_unit, conviction_executive, conviction_detailed,
        timeliness_executive, timeliness_detailed, emergency112_executive, emergency112_detailed,
        hsp_executive, hsp_detailed,
    )
    from backend.workbook import parse_workbook, WorkbookError, _normalize_range
    from backend.emailer import send_email
    from backend.reports import build_section, render_pdf, render_email, render_explain_email
    from backend.period_grain import (
        GRAINS, GRAIN_LABELS, normalize_grain, aggregate_112_facts, aggregate_hsp_facts,
        grain_meta_payload, parse_month_period,
    )
except ModuleNotFoundError:
    from auth import auth_router, bind_auth, bootstrap_admin, require_user
    from emailer import send_email
    from reports import build_section, render_pdf, render_email, render_explain_email
    from scoring import (
        DOMAINS, DEFAULT_POLICY, CATEGORIES, categories_for, score_units, totals, explain, enrich, combine,
        combined_weights, _norm_unit, conviction_executive, conviction_detailed,
        timeliness_executive, timeliness_detailed, emergency112_executive, emergency112_detailed,
        hsp_executive, hsp_detailed,
    )
    from workbook import parse_workbook, WorkbookError, _normalize_range
    from period_grain import (
        GRAINS, GRAIN_LABELS, normalize_grain, aggregate_112_facts, aggregate_hsp_facts,
        grain_meta_payload, parse_month_period,
    )

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]
logger = logging.getLogger(__name__)

INDEXES: dict[str, list[IndexModel]] = {
    "users": [
        IndexModel([("user_id", ASCENDING)], name="user_id", unique=True),
        IndexModel([("email", ASCENDING)], name="email", unique=True),
    ],
    "datasets": [IndexModel([("id", ASCENDING)], name="id", unique=True),
                 IndexModel([("domain", ASCENDING), ("active", ASCENDING)], name="domain_active")],
    "facts": [IndexModel([("dataset_id", ASCENDING)], name="dataset_id")],
    "audit": [IndexModel([("ts", DESCENDING)], name="ts_desc"),
              IndexModel([("session_id", ASCENDING)], name="session_id")],
    "policy_versions": [IndexModel([("version", DESCENDING)], name="version_desc")],
    "api_sources": [IndexModel([("id", ASCENDING)], name="id", unique=True)],
    "cron_runs": [IndexModel([("run_id", ASCENDING)], name="run_id", unique=True)],
    "reports": [IndexModel([("id", ASCENDING)], name="id", unique=True), IndexModel([("created_at", DESCENDING)], name="created_desc")],
    "policy_proposals": [IndexModel([("id", ASCENDING)], name="id", unique=True)],
}


async def ensure_indexes() -> None:
    for collection, models in INDEXES.items():
        for model in models:
            try:
                await db[collection].create_indexes([model])
            except Exception as exc:
                logger.error("ensure_indexes(%s.%s): %s", collection, model.document["name"], exc)

app = FastAPI()
api_router = APIRouter(prefix="/api")


def now_iso():
    return datetime.now(timezone.utc).isoformat()


# ---------------- Roles ----------------
ROLES = ["admin", "approver", "state_viewer", "range_viewer", "pending"]
DEFAULT_ROLE = "pending"
RETIRED_ROLES = {}
RANK = {r: len(ROLES) - i for i, r in enumerate(ROLES)}
ENV = os.environ.get("APP_ENV", "live").strip() or "live"
IN_ENV = {"env": {"$in": [ENV, None]}}


def effective_role(role) -> str:
    role = RETIRED_ROLES.get(role, role)
    return role if role in ROLES else DEFAULT_ROLE


async def audit(action: str, member: Optional[dict], detail: dict = None, session_id: str = None):
    await db.audit.insert_one({
        "id": str(uuid.uuid4()), "ts": now_iso(), "action": action,
        "user_id": member.get("user_id") if member else None,
        "email": member.get("email") if member else None,
        "session_id": session_id, "detail": detail or {},
    })


async def current_member(user: dict = Depends(require_user)) -> dict:
    uid = user["user_id"]
    member = await db.users.find_one({"user_id": uid}, {"_id": 0, "password_hash": 0})
    if member is None:
        raise HTTPException(status_code=401, detail="Account not found")
    if not member.get("role"):
        await db.users.update_one({"user_id": uid}, {"$set": {"role": DEFAULT_ROLE}})
        member = {**member, "role": DEFAULT_ROLE}
    if member.get("env") != ENV:
        await db.users.update_one({"user_id": uid}, {"$set": {"env": ENV}})
    member = {**member, "env": ENV, "role": effective_role(member["role"])}
    sid = user.get("session_id")
    if sid and not await db.audit.find_one({"action": "login", "session_id": sid}, {"_id": 1}):
        await audit("login", member, {"role": member["role"]}, session_id=sid)
    return member


def require_role(*roles: str):
    async def check(member: dict = Depends(current_member)) -> dict:
        if member["role"] not in roles:
            raise HTTPException(status_code=403, detail="Not allowed")
        return member
    return check


viewer = require_role("admin", "approver", "state_viewer", "range_viewer")
statewide = require_role("admin", "approver", "state_viewer")
admin_only = require_role("admin")
approver_only = require_role("approver")


def scope_range(member: dict) -> Optional[str]:
    if member["role"] == "range_viewer":
        if not member.get("range"):
            raise HTTPException(status_code=403, detail="No range assigned to your account yet")
        return _normalize_range(member["range"])
    return None


# ---------------- Data access ----------------
_cache: dict = {}


def _merge_policy(stored: dict | None) -> dict:
    policy = copy.deepcopy(DEFAULT_POLICY)
    if not stored:
        return policy
    for key, val in stored.items():
        if key in ("conviction", "timeliness", "emergency112", "hsp", "training", "antf") and isinstance(val, dict):
            policy[key] = {**policy.get(key, {}), **val}
        elif key == "combined_weights" and isinstance(val, dict):
            policy["combined_weights"] = {**policy.get("combined_weights", {}), **val}
        else:
            policy[key] = val
    if "combined_weights" not in policy:
        policy["combined_weights"] = combined_weights(policy)
    return policy


async def get_policy() -> dict:
    p = await db.policy.find_one({"key": "current"}, {"_id": 0})
    return _merge_policy(p["policy"] if p else None)


async def active_dataset(domain: str) -> dict:
    ds = await db.datasets.find_one({"domain": domain, "active": True}, {"_id": 0})
    if not ds:
        raise HTTPException(status_code=404, detail=f"No active {domain} dataset")
    return ds


async def _conviction_range_by_unit() -> dict:
    """Normalized conviction unit name → police range (from active conviction dataset)."""
    try:
        cds = await active_dataset("conviction")
    except HTTPException:
        return {}
    if cds["id"] not in _cache:
        facts = await db.facts.find({"dataset_id": cds["id"]}, {"_id": 0}).to_list(20000)
        by_type: dict = {}
        for f in facts:
            f = {**f, "range": _normalize_range(f.get("range", ""))}
            t = by_type.setdefault(f["type"], {"facts": {}, "units": []})
            if (f["unit"], f["range"]) not in t["units"]:
                t["units"].append((f["unit"], f["range"]))
            t["facts"][(f["unit"], f["period"])] = f
        _cache[cds["id"]] = by_type
    entry = next(iter(_cache[cds["id"]].values()), None)
    if not entry:
        return {}
    return {_norm_unit(u): r for u, r in entry["units"] if r}


async def _attach_ranges_from_conviction(by_type: dict, unit_map: dict) -> None:
    """Domains whose workbooks omit Range — map units to conviction ranges via unit_map (conv → domain)."""
    conv = await _conviction_range_by_unit()
    if not conv:
        return
    domain_to_range = dict(conv)  # same-name units (Akola, Raigad, …)
    for conv_unit, domain_unit in unit_map.items():
        rng = conv.get(_norm_unit(conv_unit))
        if rng:
            domain_to_range[_norm_unit(domain_unit)] = rng
    for entry in by_type.values():
        rebuilt = []
        seen = set()
        for unit, rng in entry["units"]:
            if not rng:
                rng = domain_to_range.get(_norm_unit(unit), "")
            key = (unit, rng)
            if key not in seen:
                seen.add(key)
                rebuilt.append((unit, rng))
        entry["units"] = rebuilt
        for fact in entry["facts"].values():
            if not fact.get("range"):
                fact["range"] = domain_to_range.get(_norm_unit(fact["unit"]), "")


async def load_facts(ds: dict) -> dict:
    if ds["id"] not in _cache:
        facts = await db.facts.find({"dataset_id": ds["id"]}, {"_id": 0}).to_list(20000)
        by_type: dict = {}
        domain = ds.get("domain")
        for f in facts:
            unit = f.get("unit", "")
            if domain == "hsp":
                unit = _normalize_hsp_unit(unit)
            f = {**f, "unit": unit, "range": _normalize_range(f.get("range", ""))}
            t = by_type.setdefault(f["type"], {"facts": {}, "units": []})
            if (f["unit"], f["range"]) not in t["units"]:
                t["units"].append((f["unit"], f["range"]))
            t["facts"][(f["unit"], f["period"])] = f
        _cache[ds["id"]] = by_type
    by_type = _cache[ds["id"]]
    # 112 / HSP (and similar) workbooks omit Range — attach from conviction on load
    domain = ds.get("domain")
    if domain == "hsp":
        await _attach_ranges_from_conviction(by_type, UNIT_MAP_HSP)
    elif domain == "emergency112":
        await _attach_ranges_from_conviction(by_type, UNIT_MAP_112)
    return by_type


async def store_dataset(parsed: dict, filename: str, source: str, member: Optional[dict]) -> dict:
    ds = {
        "id": str(uuid.uuid4()), "domain": parsed["domain"], "filename": filename, "source": source,
        "periods": parsed["periods"], "types": parsed["types"], "unit_count": parsed["unit_count"],
        "record_count": len(parsed["facts"]), "issues": parsed.get("issues", []),
        "uploaded_by": member.get("email") if member else "system", "uploaded_at": now_iso(), "active": False,
    }
    await db.facts.insert_many([{**f, "dataset_id": ds["id"]} for f in parsed["facts"]])
    await db.datasets.insert_one({**ds})
    await db.datasets.update_many({"domain": ds["domain"], "id": {"$ne": ds["id"]}}, {"$set": {"active": False}})
    await db.datasets.update_one({"id": ds["id"]}, {"$set": {"active": True}})
    ds["active"] = True
    return ds


async def compute(domain, type_, base, latest, member, grain: str = "monthly"):
    if domain not in DOMAINS:
        raise HTTPException(status_code=400, detail="Unknown domain")
    ds = await active_dataset(domain)
    data = await load_facts(ds)
    if type_ not in data:
        raise HTTPException(status_code=400, detail="Unknown case type")

    periods = list(ds["periods"])
    grain_norm = "monthly"
    monthly_facts = None
    if domain == "emergency112":
        grain_norm = normalize_grain(grain)
        entry = data[type_]
        monthly_facts = entry["facts"]
        agg_facts, periods = aggregate_112_facts(entry["facts"], grain_norm)
        data = {**data, type_: {"facts": agg_facts, "units": entry["units"]}}
    elif domain == "hsp":
        grain_norm = normalize_grain(grain)
        entry = data[type_]
        monthly_facts = entry["facts"]
        # Only grain-aggregate when stored periods are monthly (Mon YYYY)
        if any(parse_month_period(p) for p in periods):
            agg_facts, periods = aggregate_hsp_facts(entry["facts"], grain_norm)
            data = {**data, type_: {"facts": agg_facts, "units": entry["units"]}}
        else:
            grain_norm = "monthly"

    if base not in periods or latest not in periods:
        raise HTTPException(status_code=400, detail="Unknown period")

    policy = await get_policy()
    rows, cohort = score_units(domain, data[type_]["facts"], data[type_]["units"], base, latest, policy)
    cohort["extras"] = enrich(
        domain, rows, data, ds["types"], type_, periods, base, latest, policy,
        monthly_facts=monthly_facts,
    )
    cohort["period_grain"] = grain_norm
    cohort["periods"] = periods
    rng = scope_range(member)
    if rng:
        rows = [r for r in rows if r["range"] == rng]
    return ds, policy, rows, cohort, rng


def default_periods(ds):
    periods = ds["periods"]
    if len(periods) == 1:
        return periods[0], periods[0]
    return periods[-2], periods[-1]


# ---------------- Endpoints ----------------
@api_router.get("/")
async def root():
    return {"message": "Police Performance Dashboard API"}


@api_router.get("/me")
async def me(member: dict = Depends(current_member)):
    return {k: member.get(k) for k in ("user_id", "email", "name", "role", "range")}


@api_router.get("/meta")
async def meta(domain: str, member: dict = Depends(viewer)):
    ds = await active_dataset(domain)
    data = await load_facts(ds)
    rng = scope_range(member)
    first = data[ds["types"][0]]["units"]
    units = [u for u, r in first if not rng or r == rng]
    unit_set = set(units)
    unit_ranges = {u: r for u, r in first if (not rng or r == rng) and u in unit_set}
    ranges = sorted({r for _, r in first if not rng or r == rng})
    b, l = default_periods(ds)
    cats = categories_for(domain)
    if domain in ("emergency112", "training", "antf", "hsp"):
        ranges = [r for r in ranges if r]
    payload = {
        "domain": domain, "labels": DOMAINS[domain], "types": ds["types"], "periods": ds["periods"],
        "units": units, "ranges": ranges, "unit_ranges": unit_ranges, "categories": cats,
        "default_base": b, "default_latest": l, "scope_range": rng,
        "dataset": {k: ds[k] for k in ("id", "filename", "source", "uploaded_at", "uploaded_by", "record_count", "unit_count")},
    }
    if domain in ("emergency112", "hsp") and any(parse_month_period(p) for p in (ds.get("periods") or [])):
        grains = grain_meta_payload(ds["periods"])
        payload["period_grains"] = grains
        payload["period_grain_options"] = [{"id": g, "label": GRAIN_LABELS[g]} for g in GRAINS]
        payload["default_period_grain"] = "monthly"
        # Keep top-level periods aligned with default monthly grain
        monthly = grains.get("monthly") or {}
        if monthly.get("periods"):
            payload["periods"] = monthly["periods"]
            payload["default_base"] = monthly.get("default_base") or b
            payload["default_latest"] = monthly.get("default_latest") or l
    return payload


def _filter_set(raw: str) -> set | None:
    """Parse 'All' or comma-separated values into a set. None means no filter (All)."""
    if not raw or raw == "All":
        return None
    parts = [p.strip() for p in str(raw).split(",") if p.strip() and p.strip() != "All"]
    return set(parts) or None


@api_router.get("/dashboard")
async def dashboard(domain: str, type: str, base: str, latest: str, unit: str = "All", range: str = "All",
                    category: str = "All", grain: str = "monthly", member: dict = Depends(viewer)):
    ds, policy, rows, cohort, rng = await compute(domain, type, base, latest, member, grain=grain)
    unit_filter = _filter_set(unit)
    range_raw = _filter_set(range)
    range_filter = {_normalize_range(v) for v in range_raw} if range_raw is not None else None
    for r in rows:
        r["included"] = (
            (unit_filter is None or r["unit"] in unit_filter)
            and (range_filter is None or r["range"] in range_filter)
            and (category == "All" or r["category"] == category)
        )
    included = [r for r in rows if r["included"]]
    weight = policy.get(domain, {}).get("perf_weight", cohort.get("weight", 1.0))
    return {"state": {**totals(domain, rows), **{k: v for k, v in cohort["extras"].items() if k.startswith("state_")}},
            "selection": totals(domain, included), "rows": rows, "prev_window": cohort["extras"]["prev_window"],
            "cohort": cohort, "scope_range": rng, "weight": weight,
            "period_grain": cohort.get("period_grain", "monthly"),
            "periods": cohort.get("periods"),
            "policy_version": policy.get("version"), "dataset_id": ds["id"], "as_of": ds["uploaded_at"]}


@api_router.get("/explain")
async def explain_unit(domain: str, type: str, base: str, latest: str, unit: str, grain: str = "monthly",
                       member: dict = Depends(viewer)):
    ds, policy, rows, cohort, _ = await compute(domain, type, base, latest, member, grain=grain)
    row = next((r for r in rows if r["unit"] == unit), None)
    if not row:
        raise HTTPException(status_code=404, detail="Unit not found")
    if not row["eligible"]:
        return {"row": row, "steps": [], "message": "Unit is not score-eligible: a period has zero cases."}
    return {"row": row, "cohort": cohort, "steps": explain(domain, row, cohort, policy, type, base, latest)}


class ExplainEmailIn(BaseModel):
    domain: str
    type: str
    base: str
    latest: str
    unit: str
    to: str
    grain: str = "monthly"


@api_router.post("/explain/email")
async def email_explain(body: ExplainEmailIn, member: dict = Depends(viewer)):
    to = body.to.strip().lower()
    if not EMAIL_RE.match(to):
        raise HTTPException(status_code=422, detail="Enter a valid email address")
    ds, policy, rows, cohort, _ = await compute(
        body.domain, body.type, body.base, body.latest, member, grain=body.grain,
    )
    row = next((r for r in rows if r["unit"] == body.unit), None)
    if not row:
        raise HTTPException(status_code=404, detail="Unit not found")
    if not row.get("eligible"):
        raise HTTPException(status_code=422, detail="Unit is not score-eligible: a period has zero cases.")
    steps = explain(body.domain, row, cohort, policy, body.type, body.base, body.latest)
    subject, html = render_explain_email(
        domain=body.domain, type_=body.type, base=body.base, latest=body.latest,
        unit=body.unit, row=row, steps=steps, sender=member.get("email") or "",
    )
    await send_email(to=to, subject=subject, html=html)
    await audit("explain_emailed", member, {
        "domain": body.domain, "unit": body.unit, "to": to,
        "type": body.type, "base": body.base, "latest": body.latest, "steps": len(steps),
    })
    return {"ok": True, "to": to}


COURT_TYPE_ALIASES = {
    "Both courts": "Both JMFC and Session",
    "both courts": "Both JMFC and Session",
    "Both": "Both JMFC and Session",
}


def resolve_conviction_type(raw: Optional[str], types: list) -> str:
    if not raw:
        return types[-1]
    mapped = COURT_TYPE_ALIASES.get(raw, raw)
    if mapped in types:
        return mapped
    # tolerate Excel short labels
    low = mapped.lower()
    for t in types:
        if t.lower() == low or t.lower().startswith(low):
            return t
    raise HTTPException(status_code=400, detail="Unknown court type")


def resolve_timeliness_type(raw: Optional[str], types: list) -> str:
    if not raw:
        return types[-1]
    if raw in types:
        return raw
    low = raw.lower()
    for t in types:
        if t.lower() == low or t.lower().startswith(low):
            return t
    raise HTTPException(status_code=400, detail="Unknown case deadline")


@api_router.get("/conviction/executive")
async def conviction_executive_view(
    type: str = Query(None),
    base: str = Query(None),
    latest: str = Query(None),
    member: dict = Depends(viewer),
):
    """Executive Dashboard KPIs/charts for Overview → Conviction (filterable)."""
    ds = await active_dataset("conviction")
    default_base, default_latest = default_periods(ds)
    type_ = resolve_conviction_type(type, ds["types"])
    b = base or default_base
    l = latest or default_latest
    if b not in ds["periods"] or l not in ds["periods"]:
        raise HTTPException(status_code=400, detail="Unknown period")
    _, _, rows, _, rng = await compute("conviction", type_, b, l, member)
    data = await load_facts(ds)
    return {
        "as_of": ds["uploaded_at"],
        "scope_range": rng,
        "types": ds["types"],
        "periods": ds["periods"],
        "court_options": [{"value": t, "label": t} for t in ds["types"]],
        "executive": conviction_executive(data, rows, ds["periods"], b, l, type_),
    }


@api_router.get("/conviction/detailed")
async def conviction_detailed_view(
    unit: str = Query(None),
    type: str = Query(None),
    base: str = Query(None),
    latest: str = Query(None),
    range: str = Query("All"),
    category: str = Query("All"),
    member: dict = Depends(viewer),
):
    """Detailed Dashboard KPIs/charts for Conviction → Detailed (same filters as Unit rankings)."""
    ds = await active_dataset("conviction")
    default_base, default_latest = default_periods(ds)
    type_ = resolve_conviction_type(type, ds["types"])
    b = base or default_base
    l = latest or default_latest
    if b not in ds["periods"] or l not in ds["periods"]:
        raise HTTPException(status_code=400, detail="Unknown period")
    data = await load_facts(ds)
    policy = await get_policy()
    entry = data.get(type_) or {"units": []}
    unit_names = sorted({u for u, _ in entry.get("units") or []})
    if not unit_names:
        raise HTTPException(status_code=404, detail="No units in conviction dataset")
    # unit / range may be All, a single name, or comma-separated multi-select
    unit_param = unit if unit not in (None, "") else "All"
    range_param = range if range not in (None, "") else "All"
    cat_param = category if category not in (None, "") else "All"
    detailed = conviction_detailed(
        data, ds["periods"], policy, unit_param, type_, b, l, range_param, cat_param,
    )
    rng = scope_range(member)
    return {
        "as_of": ds["uploaded_at"],
        "scope_range": rng,
        "types": ds["types"],
        "periods": ds["periods"],
        "court_options": [{"value": t, "label": t} for t in ds["types"]],
        "detailed": detailed,
    }


@api_router.get("/timeliness/executive")
async def timeliness_executive_view(
    type: str = Query(None),
    base: str = Query(None),
    latest: str = Query(None),
    member: dict = Depends(viewer),
):
    """Executive Dashboard KPIs/charts for Overview → 60-90 Charge Sheet."""
    ds = await active_dataset("timeliness")
    default_base, default_latest = default_periods(ds)
    type_ = resolve_timeliness_type(type, ds["types"])
    b = base or default_base
    l = latest or default_latest
    if b not in ds["periods"] or l not in ds["periods"]:
        raise HTTPException(status_code=400, detail="Unknown period")
    _, _, rows, _, rng = await compute("timeliness", type_, b, l, member)
    data = await load_facts(ds)
    return {
        "as_of": ds["uploaded_at"],
        "scope_range": rng,
        "types": ds["types"],
        "periods": ds["periods"],
        "deadline_options": [{"value": t, "label": t} for t in ds["types"]],
        "executive": timeliness_executive(data, rows, ds["periods"], b, l, type_),
    }


@api_router.get("/timeliness/detailed")
async def timeliness_detailed_view(
    unit: str = Query(None),
    type: str = Query(None),
    base: str = Query(None),
    latest: str = Query(None),
    range: str = Query("All"),
    category: str = Query("All"),
    member: dict = Depends(viewer),
):
    """Detailed Dashboard KPIs/charts for 60-90 → Overview tab."""
    ds = await active_dataset("timeliness")
    default_base, default_latest = default_periods(ds)
    type_ = resolve_timeliness_type(type, ds["types"])
    b = base or default_base
    l = latest or default_latest
    if b not in ds["periods"] or l not in ds["periods"]:
        raise HTTPException(status_code=400, detail="Unknown period")
    data = await load_facts(ds)
    policy = await get_policy()
    entry = data.get(type_) or {"units": []}
    unit_names = sorted({u for u, _ in entry.get("units") or []})
    if not unit_names:
        raise HTTPException(status_code=404, detail="No units in timeliness dataset")
    unit_param = unit if unit not in (None, "") else "All"
    range_param = range if range not in (None, "") else "All"
    cat_param = category if category not in (None, "") else "All"
    detailed = timeliness_detailed(
        data, ds["periods"], policy, unit_param, type_, b, l, range_param, cat_param,
    )
    rng = scope_range(member)
    return {
        "as_of": ds["uploaded_at"],
        "scope_range": rng,
        "types": ds["types"],
        "periods": ds["periods"],
        "deadline_options": [{"value": t, "label": t} for t in ds["types"]],
        "detailed": detailed,
    }


@api_router.get("/emergency112/executive")
async def emergency112_executive_view(
    base: str = Query(None),
    latest: str = Query(None),
    grain: str = Query("monthly"),
    member: dict = Depends(viewer),
):
    """Executive Dashboard KPIs/charts for Overview → 112."""
    ds = await active_dataset("emergency112")
    default_base, default_latest = default_periods(ds)
    type_ = ds["types"][-1]
    grain_norm = normalize_grain(grain)
    data = await load_facts(ds)
    entry = data.get(type_) or data.get("All") or {"facts": {}, "units": []}
    facts112, periods112 = aggregate_112_facts(entry["facts"], grain_norm)
    b = base or (periods112[-2] if len(periods112) >= 2 else (periods112[0] if periods112 else default_base))
    l = latest or (periods112[-1] if periods112 else default_latest)
    if b not in periods112 or l not in periods112:
        raise HTTPException(status_code=400, detail="Unknown period")
    _, _, rows, _, rng = await compute("emergency112", type_, b, l, member, grain=grain_norm)
    data_view = {type_: {"facts": facts112, "units": entry["units"]}}
    return {
        "as_of": ds["uploaded_at"],
        "scope_range": rng,
        "types": ds["types"],
        "periods": periods112,
        "period_grain": grain_norm,
        "period_grains": grain_meta_payload(ds["periods"]),
        "period_grain_options": [{"id": g, "label": GRAIN_LABELS[g]} for g in GRAINS],
        "executive": emergency112_executive(data_view, rows, periods112, b, l, type_),
    }


@api_router.get("/emergency112/detailed")
async def emergency112_detailed_view(
    unit: str = Query(None),
    base: str = Query(None),
    latest: str = Query(None),
    range: str = Query("All"),
    category: str = Query("All"),
    member: dict = Depends(viewer),
):
    """Detailed Dashboard KPIs/charts for 112 → Overview tab."""
    ds = await active_dataset("emergency112")
    default_base, default_latest = default_periods(ds)
    type_ = ds["types"][-1]
    b = base or default_base
    l = latest or default_latest
    data = await load_facts(ds)
    policy = await get_policy()
    entry = data.get(type_) or data.get("All") or {"facts": {}, "units": []}
    facts112, periods112 = aggregate_112_facts(entry["facts"], "monthly")
    if b not in periods112 or l not in periods112:
        raise HTTPException(status_code=400, detail="Unknown period")
    data_monthly = {type_: {"facts": facts112, "units": entry["units"]}}
    unit_names = sorted({u for u, _ in entry.get("units") or []})
    if not unit_names:
        raise HTTPException(status_code=404, detail="No units in 112 dataset")
    unit_param = unit if unit not in (None, "") else "All"
    range_param = range if range not in (None, "") else "All"
    cat_param = category if category not in (None, "") else "All"
    detailed = emergency112_detailed(
        data_monthly, periods112, policy, unit_param, type_, b, l, range_param, cat_param,
    )
    rng = scope_range(member)
    return {
        "as_of": ds["uploaded_at"],
        "scope_range": rng,
        "types": ds["types"],
        "periods": periods112,
        "detailed": detailed,
    }


@api_router.get("/hsp/executive")
async def hsp_executive_view(
    base: str = Query(None),
    latest: str = Query(None),
    grain: str = Query("monthly"),
    member: dict = Depends(viewer),
):
    """Executive Dashboard KPIs/charts for Overview → HSP."""
    ds = await active_dataset("hsp")
    default_base, default_latest = default_periods(ds)
    type_ = ds["types"][-1]
    data = await load_facts(ds)
    entry = data.get(type_) or data.get("All") or {"facts": {}, "units": []}
    grain_norm = normalize_grain(grain)
    monthly_source = any(parse_month_period(p) for p in (ds.get("periods") or []))
    if monthly_source:
        facts_hsp, periods_hsp = aggregate_hsp_facts(entry["facts"], grain_norm)
        data_view = {type_: {"facts": facts_hsp, "units": entry["units"]}}
    else:
        facts_hsp, periods_hsp = entry["facts"], list(ds["periods"])
        data_view = data
        grain_norm = "monthly"
    b = base or (periods_hsp[-2] if len(periods_hsp) >= 2 else (periods_hsp[0] if periods_hsp else default_base))
    l = latest or (periods_hsp[-1] if periods_hsp else default_latest)
    if b not in periods_hsp or l not in periods_hsp:
        raise HTTPException(status_code=400, detail="Unknown period")
    _, _, rows, _, rng = await compute("hsp", type_, b, l, member, grain=grain_norm)
    out = {
        "as_of": ds["uploaded_at"],
        "scope_range": rng,
        "types": ds["types"],
        "periods": periods_hsp,
        "period_grain": grain_norm,
        "executive": hsp_executive(data_view, rows, periods_hsp, b, l, type_),
    }
    if monthly_source:
        out["period_grains"] = grain_meta_payload(ds["periods"])
        out["period_grain_options"] = [{"id": g, "label": GRAIN_LABELS[g]} for g in GRAINS]
    return out


@api_router.get("/hsp/detailed")
async def hsp_detailed_view(
    unit: str = Query(None),
    base: str = Query(None),
    latest: str = Query(None),
    range: str = Query("All"),
    category: str = Query("All"),
    grain: str = Query("monthly"),
    member: dict = Depends(viewer),
):
    """Detailed Dashboard KPIs/charts for HSP → Overview tab."""
    ds = await active_dataset("hsp")
    default_base, default_latest = default_periods(ds)
    type_ = ds["types"][-1]
    data = await load_facts(ds)
    policy = await get_policy()
    entry = data.get(type_) or data.get("All") or {"facts": {}, "units": []}
    grain_norm = normalize_grain(grain)
    if any(parse_month_period(p) for p in (ds.get("periods") or [])):
        facts_hsp, periods_hsp = aggregate_hsp_facts(entry["facts"], grain_norm)
        data_view = {type_: {"facts": facts_hsp, "units": entry["units"]}}
    else:
        facts_hsp, periods_hsp = entry["facts"], list(ds["periods"])
        data_view = data
        grain_norm = "monthly"
    b = base or (periods_hsp[-2] if len(periods_hsp) >= 2 else (periods_hsp[0] if periods_hsp else default_base))
    l = latest or (periods_hsp[-1] if periods_hsp else default_latest)
    if b not in periods_hsp or l not in periods_hsp:
        raise HTTPException(status_code=400, detail="Unknown period")
    unit_names = sorted({u for u, _ in entry.get("units") or []})
    if not unit_names:
        raise HTTPException(status_code=404, detail="No units in HSP dataset")
    unit_param = unit if unit not in (None, "") else "All"
    range_param = range if range not in (None, "") else "All"
    cat_param = category if category not in (None, "") else "All"
    detailed = hsp_detailed(
        data_view, periods_hsp, policy, unit_param, type_, b, l, range_param, cat_param,
    )
    rng = scope_range(member)
    return {
        "as_of": ds["uploaded_at"],
        "scope_range": rng,
        "types": ds["types"],
        "periods": periods_hsp,
        "period_grain": grain_norm,
        "detailed": detailed,
    }


@api_router.get("/overview")
async def overview(member: dict = Depends(viewer)):
    out = {}
    for domain in DOMAINS:
        try:
            ds = await active_dataset(domain)
        except HTTPException:
            continue
        b, l = default_periods(ds)
        type_ = ds["types"][-1]
        _, _, rows, cohort, rng = await compute(domain, type_, b, l, member)
        ranges = {}
        for r in rows:
            ranges.setdefault(r["range"], []).append(r)
        range_stats = [{"range": k, **{x: v for x, v in totals(domain, v).items()
                                       if x in ("latest_rate", "base_rate", "improvement", "avg_overall_score", "unit_count")}}
                       for k, v in ranges.items()]
        scored = sorted([r for r in rows if r["rank"]], key=lambda r: r["rank"])
        cats = categories_for(domain)
        dist = {c: sum(1 for r in rows if r["category"] == c) for c in cats}
        units_by_category = {
            c: sorted(r["unit"] for r in rows if r.get("category") == c and r.get("unit"))
            for c in cats
        }
        range_stats = [x for x in range_stats if x["range"] or domain not in ("emergency112", "training", "antf", "hsp")]
        payload = {"type": type_, "base": b, "latest": l, "totals": totals(domain, rows),
                   "top": scored[:5], "bottom": scored[-5:][::-1], "distribution": dist,
                   "units_by_category": units_by_category,
                   "ranges": sorted(range_stats, key=lambda x: -(x["avg_overall_score"] or 0)),
                   "as_of": ds["uploaded_at"], "scope_range": rng}
        if domain == "conviction":
            data = await load_facts(ds)
            payload["executive"] = conviction_executive(data, rows, ds["periods"], b, l, type_)
            payload["types"] = ds["types"]
            payload["periods"] = ds["periods"]
            payload["court_options"] = [{"value": t, "label": t} for t in ds["types"]]
        elif domain == "timeliness":
            data = await load_facts(ds)
            payload["executive"] = timeliness_executive(data, rows, ds["periods"], b, l, type_)
            payload["types"] = ds["types"]
            payload["periods"] = ds["periods"]
            payload["deadline_options"] = [{"value": t, "label": t} for t in ds["types"]]
        elif domain == "emergency112":
            data = await load_facts(ds)
            payload["executive"] = emergency112_executive(data, rows, ds["periods"], b, l, type_)
            payload["types"] = ds["types"]
            payload["periods"] = ds["periods"]
        elif domain == "hsp":
            data = await load_facts(ds)
            entry = data.get(type_) or data.get("All") or {"facts": {}, "units": []}
            if any(parse_month_period(p) for p in (ds.get("periods") or [])):
                facts_hsp, periods_hsp = aggregate_hsp_facts(entry["facts"], "monthly")
                data_view = {type_: {"facts": facts_hsp, "units": entry["units"]}}
                # Align overview window to monthly defaults when dataset is monthly
                if periods_hsp:
                    b = periods_hsp[-2] if len(periods_hsp) >= 2 else periods_hsp[0]
                    l = periods_hsp[-1]
                    payload["base"], payload["latest"] = b, l
                    _, _, rows, _, _ = await compute(domain, type_, b, l, member, grain="monthly")
                    payload["totals"] = totals(domain, rows)
                    scored = sorted([r for r in rows if r["rank"]], key=lambda r: r["rank"])
                    payload["top"], payload["bottom"] = scored[:5], scored[-5:][::-1]
            else:
                facts_hsp, periods_hsp = entry["facts"], list(ds["periods"])
                data_view = data
            payload["executive"] = hsp_executive(data_view, rows, periods_hsp, b, l, type_)
            payload["types"] = ds["types"]
            payload["periods"] = periods_hsp
        out[domain] = payload
    return out


@api_router.get("/combined")
async def combined(member: dict = Depends(viewer)):
    policy = await get_policy()
    parts = {}
    for domain in DOMAINS:
        try:
            ds = await active_dataset(domain)
        except HTTPException:
            continue
        data = await load_facts(ds)
        b, l = default_periods(ds)
        type_ = ds["types"][-1]
        rows, _ = score_units(domain, data[type_]["facts"], data[type_]["units"], b, l, policy)
        parts[domain] = {"rows": rows, "type": type_, "base": b, "latest": l}
    needed = ("conviction", "timeliness", "emergency112", "hsp", "training", "antf")
    if any(d not in parts for d in needed):
        return {"error": "combined_requires_all_domains", "rows": [], "weight": combined_weights(policy),
                "policy_version": policy.get("version"), "windows": {}}
    rows, w = combine(
        parts["conviction"]["rows"], parts["timeliness"]["rows"],
        parts["emergency112"]["rows"], parts["training"]["rows"], parts["antf"]["rows"], parts["hsp"]["rows"],
        UNIT_MAP, UNIT_MAP_112, UNIT_MAP_TRAINING, UNIT_MAP_ANTF, UNIT_MAP_HSP, policy,
    )
    rng = scope_range(member)
    if rng:
        rows = [r for r in rows if r["range"] == rng]
    return {"rows": rows, "weight": w, "policy_version": policy.get("version"),
            "windows": {d: {k: v for k, v in p.items() if k != "rows"} for d, p in parts.items()}}


@api_router.get("/admin/project-zip")
async def project_zip(member: dict = Depends(admin_only)):
    path = ROOT_DIR / "exports" / "police-performance-dashboard.zip"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Project export has not been built yet")
    await audit("export", member, {"format": "zip", "view": "project-source"})
    return FileResponse(path, media_type="application/zip", filename=path.name)


# ---------- Datasets (admin) ----------
@api_router.get("/datasets")
async def list_datasets(member: dict = Depends(admin_only)):
    return await db.datasets.find({"archived": {"$ne": True}}, {"_id": 0}).sort("uploaded_at", -1).to_list(200)


@api_router.post("/datasets/{dataset_id}/archive")
async def archive_dataset(dataset_id: str, member: dict = Depends(admin_only)):
    ds = await db.datasets.find_one({"id": dataset_id}, {"_id": 0})
    if not ds:
        raise HTTPException(status_code=404, detail="Not found")
    if ds.get("active"):
        raise HTTPException(status_code=409, detail="Activate another version before archiving this one")
    await db.datasets.update_one({"id": dataset_id}, {"$set": {"archived": True}})
    await audit("dataset_archived", member, {"dataset_id": dataset_id, "filename": ds["filename"]})
    return {"ok": True}


@api_router.post("/datasets/upload")
async def upload_dataset(file: UploadFile = File(...), member: dict = Depends(admin_only)):
    if not file.filename.lower().endswith((".xlsx", ".xlsm")):
        raise HTTPException(status_code=400, detail="Upload an .xlsx or .xlsm workbook")
    content = await file.read()
    if len(content) > 20 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Workbook larger than 20 MB")
    try:
        parsed = await run_in_threadpool(parse_workbook, content)
    except WorkbookError as e:
        await audit("upload_failed", member, {"filename": file.filename, "error": str(e)})
        raise HTTPException(status_code=422, detail=str(e))
    ds = await store_dataset(parsed, file.filename, "upload", member)
    await audit("upload", member, {"filename": file.filename, "domain": ds["domain"], "dataset_id": ds["id"],
                                   "records": ds["record_count"]})
    return ds


@api_router.post("/datasets/{dataset_id}/activate")
async def activate_dataset(dataset_id: str, member: dict = Depends(admin_only)):
    ds = await db.datasets.find_one({"id": dataset_id}, {"_id": 0})
    if not ds:
        raise HTTPException(status_code=404, detail="Not found")
    await db.datasets.update_many({"domain": ds["domain"]}, {"$set": {"active": False}})
    await db.datasets.update_one({"id": dataset_id}, {"$set": {"active": True, "archived": False}})
    await audit("dataset_activated", member, {"dataset_id": dataset_id, "domain": ds["domain"], "filename": ds["filename"]})
    return {"ok": True}


# ---------- Policy (admin) ----------
class Band(BaseModel):
    op: str = Field(pattern="^(<|<=)$")
    value: float
    marks: float


class DomainPolicy(BaseModel):
    perf_weight: float = Field(ge=0, le=1)
    bands: List[Band]
    default_marks: float


class RankBand(BaseModel):
    max_rank: int = Field(ge=1)
    label: str


class CombinedWeights(BaseModel):
    conviction: float = Field(ge=0, le=1)
    timeliness: float = Field(ge=0, le=1)
    emergency112: float = Field(ge=0, le=1)
    hsp: float = Field(ge=0, le=1)
    training: float = Field(ge=0, le=1)
    antf: float = Field(ge=0, le=1)


class RankingBand(BaseModel):
    min_pct: float
    marks: float


class TrainingPolicy(BaseModel):
    ranking_bands: List[RankingBand]
    default_marks: float = 0
    rank_bands: List[RankBand]
    rank_default: str = "Low Performer"


class AntfPolicy(BaseModel):
    meeting_mark: float = 3
    upload_mark: float = 2
    rank_bands: List[RankBand]
    rank_default: str = "Low Performer"


class HspPolicy(BaseModel):
    perf_weight: float = Field(default=0.7, ge=0, le=1)
    accident_perf_weight: float = Field(default=0.3, ge=0, le=1)
    killed_perf_weight: float = Field(default=0.7, ge=0, le=1)
    accident_imp_weight: float = Field(default=0.2, ge=0, le=1)
    killed_imp_weight: float = Field(default=0.7, ge=0, le=1)
    rank_bands: List[RankBand]
    rank_default: str = "Poor"


class PolicyIn(BaseModel):
    conviction: DomainPolicy
    timeliness: DomainPolicy
    emergency112: DomainPolicy
    hsp: HspPolicy
    training: TrainingPolicy
    antf: AntfPolicy
    rank_bands: List[RankBand]
    rank_default: str
    combined_weight: float = Field(default=0.5, ge=0, le=1)
    combined_weights: Optional[CombinedWeights] = None
    note: str = ""


async def _propose(data: dict, note: str, member: dict, kind: str):
    await db.policy_proposals.update_many({"status": "pending"}, {"$set": {"status": "superseded", "decided_at": now_iso()}})
    prop = {"id": str(uuid.uuid4()), "policy": data, "note": note, "kind": kind, "status": "pending",
            "proposed_by": member.get("email"), "proposed_by_id": member["user_id"], "proposed_at": now_iso(),
            "base_version": (await get_policy()).get("version", 1)}
    await db.policy_proposals.insert_one({**prop})
    await audit("policy_proposed", member, {"proposal_id": prop["id"], "note": note, "kind": kind})
    return prop


@api_router.get("/policy")
async def read_policy(member: dict = Depends(viewer)):
    history = await db.policy_versions.find({}, {"_id": 0}).sort("version", -1).to_list(50)
    proposals = await db.policy_proposals.find({}, {"_id": 0}).sort("proposed_at", -1).to_list(30)
    pending = next((p for p in proposals if p["status"] == "pending"), None)
    return {"policy": await get_policy(), "history": history, "pending": pending, "proposals": proposals}


@api_router.put("/policy")
async def update_policy(body: PolicyIn, member: dict = Depends(admin_only)):
    data = body.model_dump()
    note = data.pop("note")
    for d in ("conviction", "timeliness", "emergency112"):
        if not data[d]["bands"]:
            raise HTTPException(status_code=422, detail=f"{d}: at least one improvement band is required")
        vals = [b["value"] for b in data[d]["bands"]]
        if vals != sorted(vals):
            raise HTTPException(status_code=422, detail=f"{d}: improvement bands must be in ascending order")
    if not data["training"]["ranking_bands"]:
        raise HTTPException(status_code=422, detail="training: at least one ranking band is required")
    if not data["antf"]["rank_bands"]:
        raise HTTPException(status_code=422, detail="antf: at least one rank band is required")
    if not data["hsp"]["rank_bands"]:
        raise HTTPException(status_code=422, detail="hsp: at least one rank band is required")
    # Preserve Scale extras (time/pct weights, score categories) not edited in DomainPolicy form
    cur = await get_policy()
    for extra in ("time_weight", "pct_weight", "score_bands", "score_default"):
        if extra in cur.get("emergency112", {}) and extra not in data["emergency112"]:
            data["emergency112"][extra] = cur["emergency112"][extra]
    if data.get("combined_weights"):
        cw = data["combined_weights"]
        total = sum(cw.values())
        if abs(total - 1.0) > 0.02:
            raise HTTPException(status_code=422, detail="Combined weights must sum to 1")
    else:
        data["combined_weights"] = combined_weights({**cur, "combined_weight": data.get("combined_weight", 0.5)})
    ranks = [b["max_rank"] for b in data["rank_bands"]]
    if not ranks or ranks != sorted(set(ranks)):
        raise HTTPException(status_code=422, detail="Rank bands must be strictly ascending")
    return await _propose(data, note, member, "edit")


@api_router.post("/policy/reset")
async def reset_policy(member: dict = Depends(admin_only)):
    data = {k: v for k, v in copy.deepcopy(DEFAULT_POLICY).items() if k != "version"}
    return await _propose(data, "Reset to workbook defaults", member, "reset")


class DecisionIn(BaseModel):
    reason: str = ""


async def _pending_proposal(pid: str) -> dict:
    prop = await db.policy_proposals.find_one({"id": pid}, {"_id": 0})
    if not prop:
        raise HTTPException(status_code=404, detail="Not found")
    if prop["status"] != "pending":
        raise HTTPException(status_code=409, detail=f"Proposal is already {prop['status']}")
    return prop


@api_router.post("/policy/proposals/{pid}/approve")
async def approve_proposal(pid: str, body: DecisionIn, member: dict = Depends(approver_only)):
    prop = await _pending_proposal(pid)
    if prop["proposed_by_id"] == member["user_id"]:
        raise HTTPException(status_code=403, detail="You cannot approve your own change")
    data = {**prop["policy"], "version": (await get_policy()).get("version", 1) + 1}
    await db.policy.update_one({"key": "current"}, {"$set": {"policy": data}}, upsert=True)
    await db.policy_versions.insert_one({"version": data["version"], "policy": data, "note": prop["note"],
                                         "updated_by": prop["proposed_by"], "approved_by": member.get("email"),
                                         "updated_at": now_iso(), "proposal_id": pid})
    await db.policy_proposals.update_one({"id": pid}, {"$set": {"status": "approved", "decided_by": member.get("email"),
                                                               "decided_at": now_iso(), "reason": body.reason, "version": data["version"]}})
    await audit("policy_approved", member, {"proposal_id": pid, "version": data["version"], "proposed_by": prop["proposed_by"]})
    return data


@api_router.post("/policy/proposals/{pid}/reject")
async def reject_proposal(pid: str, body: DecisionIn, member: dict = Depends(approver_only)):
    await _pending_proposal(pid)
    if not body.reason.strip():
        raise HTTPException(status_code=422, detail="Give a reason for rejecting")
    await db.policy_proposals.update_one({"id": pid}, {"$set": {"status": "rejected", "decided_by": member.get("email"),
                                                               "decided_at": now_iso(), "reason": body.reason}})
    await audit("policy_rejected", member, {"proposal_id": pid, "reason": body.reason})
    return {"ok": True}


@api_router.post("/policy/proposals/{pid}/withdraw")
async def withdraw_proposal(pid: str, member: dict = Depends(admin_only)):
    await _pending_proposal(pid)
    await db.policy_proposals.update_one({"id": pid}, {"$set": {"status": "withdrawn", "decided_by": member.get("email"), "decided_at": now_iso()}})
    await audit("policy_withdrawn", member, {"proposal_id": pid})
    return {"ok": True}


# ---------- Users (admin) ----------
@api_router.get("/users")
async def list_users(member: dict = Depends(admin_only)):
    people = await db.users.find(IN_ENV, {"_id": 0, "password_hash": 0}).to_list(1000)
    ranges = set()
    for d in DOMAINS:
        with suppress(HTTPException):
            ds = await active_dataset(d)
            data = await load_facts(ds)
            ranges |= {r for _, r in data[ds["types"][0]]["units"]}
    return {"roles": [r for r in ROLES if RANK[r] <= RANK[member["role"]]],
            "ranges": sorted(ranges),
            "users": [{**p, "role": effective_role(p.get("role"))} for p in people]}


class RoleIn(BaseModel):
    role: str
    range: Optional[str] = None


@api_router.patch("/users/{user_id}/role")
async def set_role(user_id: str, body: RoleIn, member: dict = Depends(admin_only)):
    if body.role not in ROLES or RANK[body.role] > RANK[member["role"]]:
        raise HTTPException(status_code=403, detail="Not allowed")
    if body.role == "range_viewer" and not body.range:
        raise HTTPException(status_code=422, detail="Range viewers need a range")
    target = await db.users.find_one({"user_id": user_id, **IN_ENV}, {"_id": 0})
    if target is None:
        raise HTTPException(status_code=404, detail="Not found")
    if (effective_role(target.get("role")) == "admin" and body.role != "admin"
            and await db.users.count_documents({"role": "admin", **IN_ENV}) <= 1):
        raise HTTPException(status_code=409, detail="Keep at least one admin")
    rng = body.range if body.role == "range_viewer" else None
    await db.users.update_one({"user_id": user_id}, {"$set": {"role": body.role, "range": rng}})
    await audit("role_changed", member, {"target": target.get("email"), "role": body.role, "range": rng})
    return {"user_id": user_id, "role": body.role, "range": rng}


# ---------- Audit ----------
class ExportIn(BaseModel):
    format: str = Field(pattern="^(csv|xlsx|pdf)$")
    view: str
    context: dict = {}
    rows: int = 0


@api_router.post("/audit/export")
async def log_export(body: ExportIn, member: dict = Depends(viewer)):
    await audit("export", member, body.model_dump())
    return {"ok": True}


@api_router.get("/audit")
async def list_audit(action: str = "All", limit: int = Query(200, ge=1, le=1000), member: dict = Depends(admin_only)):
    q = {} if action == "All" else {"action": action}
    return await db.audit.find(q, {"_id": 0}).sort("ts", -1).limit(limit).to_list(limit)


# ---------- API data sources (admin) ----------
class SourceIn(BaseModel):
    name: str = Field(min_length=1)
    url: str = Field(pattern="^https?://")
    domain: str = Field(pattern="^(conviction|timeliness|emergency112|training|antf|hsp)$")
    auth_header: str = ""
    auth_value: str = ""
    schedule: str = Field(default="manual", pattern="^(manual|daily)$")
    enabled: bool = True


def _public_source(s):
    return {**{k: v for k, v in s.items() if k != "auth_value"}, "has_secret": bool(s.get("auth_value"))}


@api_router.get("/sources")
async def list_sources(member: dict = Depends(admin_only)):
    return [_public_source(s) for s in await db.api_sources.find({}, {"_id": 0}).to_list(100)]


@api_router.post("/sources")
async def create_source(body: SourceIn, member: dict = Depends(admin_only)):
    doc = {**body.model_dump(), "id": str(uuid.uuid4()), "created_at": now_iso(), "last_status": "never synced"}
    await db.api_sources.insert_one({**doc})
    await audit("source_created", member, {"name": body.name, "domain": body.domain})
    return _public_source(doc)


@api_router.delete("/sources/{source_id}")
async def delete_source(source_id: str, member: dict = Depends(admin_only)):
    if (await db.api_sources.delete_one({"id": source_id})).deleted_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    await audit("source_deleted", member, {"id": source_id})
    return {"ok": True}


def _fetch_source(s):
    headers = {"Accept": "application/json"}
    if s.get("auth_header") and s.get("auth_value"):
        headers[s["auth_header"]] = s["auth_value"]
    r = requests.get(s["url"], headers=headers, timeout=20)
    r.raise_for_status()
    return r.json()


def _parse_api_payload(payload, domain):
    recs = payload.get("records") if isinstance(payload, dict) else None
    if not isinstance(recs, list) or not recs:
        raise WorkbookError("Response must be JSON with a non-empty 'records' array")
    facts = []
    for i, x in enumerate(recs):
        try:
            facts.append({"unit": str(x["unit"]), "range": _normalize_range(x.get("range", "")), "type": str(x["type"]),
                          "period": str(x["period"]), "den": float(x["denominator"]), "num": float(x["numerator"]),
                          "beyond": float(x.get("beyond", 0) or 0)})
        except (KeyError, TypeError, ValueError) as e:
            raise WorkbookError(f"Record {i}: missing/invalid field {e}")
    periods = payload.get("periods") or list(dict.fromkeys(f["period"] for f in facts))
    return {"domain": domain, "periods": periods, "types": list(dict.fromkeys(f["type"] for f in facts)),
            "facts": facts, "unit_count": len({f["unit"] for f in facts}), "issues": []}


class ScheduleIn(BaseModel):
    schedule: str = Field(pattern="^(manual|daily)$")


@api_router.patch("/sources/{source_id}")
async def update_source_schedule(source_id: str, body: ScheduleIn, member: dict = Depends(admin_only)):
    if (await db.api_sources.update_one({"id": source_id}, {"$set": {"schedule": body.schedule}})).matched_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    await audit("source_schedule_changed", member, {"id": source_id, "schedule": body.schedule})
    return {"ok": True}


async def _run_source(s: dict, action: str, member: Optional[dict]) -> dict:
    try:
        payload = await run_in_threadpool(_fetch_source, s)
        parsed = _parse_api_payload(payload, s["domain"])
    except (requests.RequestException, ValueError) as e:
        status = f"failed: {str(e)[:200]}"
        await db.api_sources.update_one({"id": s["id"]}, {"$set": {"last_status": status, "last_run": now_iso()}})
        await audit(f"source_{action}_failed", member, {"name": s["name"], "error": status})
        raise HTTPException(status_code=502, detail=status)
    result = {"records": len(parsed["facts"]), "units": parsed["unit_count"], "periods": parsed["periods"]}
    update = {"last_run": now_iso()}
    if action == "sync":
        digest = hashlib.sha256(json.dumps(parsed["facts"], sort_keys=True).encode()).hexdigest()
        if digest == s.get("last_hash"):
            result["unchanged"] = True
        else:
            ds = await store_dataset(parsed, s["name"], f"api:{s['name']}", member)
            result["dataset_id"] = ds["id"]
            update["last_hash"] = digest
    update["last_status"] = f"{action} ok · {result['records']} records" + (" · no changes" if result.get("unchanged") else "")
    await db.api_sources.update_one({"id": s["id"]}, {"$set": update})
    await audit(f"source_{action}", member, {"name": s["name"], **result})
    return result


@api_router.post("/sources/{source_id}/{action}")
async def run_source(source_id: str, action: str, member: dict = Depends(admin_only)):
    if action not in ("test", "sync"):
        raise HTTPException(status_code=404, detail="Not found")
    s = await db.api_sources.find_one({"id": source_id}, {"_id": 0})
    if not s:
        raise HTTPException(status_code=404, detail="Not found")
    return await _run_source(s, action, member)


async def sync_daily_sources():
    for s in await db.api_sources.find({"enabled": True, "schedule": "daily"}, {"_id": 0}).to_list(100):
        with suppress(HTTPException):
            await _run_source(s, "sync", None)


# ---------- Trends ----------
UNIT_MAP = {
    "Ahmednagar": "AHILYANAGAR", "Amravati (C)": "AMRAVATI CITY", "Amravati (R)": "AMRAVATI RURAL",
    "Chh. Sambhaji N. (C)": "CHHATRAPATI SAMBHAJINAGAR CITY", "Chh. Sambhaji N. (R)": "CHHATRAPATI SAMBHAJINAGAR (RURAL)",
    "Chh. Sambhaji N. Rly": "RAILWAY CHHATRAPATI SAMBHAJINAGAR", "Mira Bhyander V.V. (C)": "Mira-Bhayandar, Vasai-Virar Police Commissioner",
    "Mumbai (C)": "BRIHAN MUMBAI CITY", "Mumbai Rly": "RAILWAY MUMBAI", "Nagpur (C)": "NAGPUR CITY", "Nagpur Rly": "RAILWAY NAGPUR",
    "Nasik (C)": "NASHIK CITY", "Nasik (R)": "NASHIK RURAL", "Navi Mumbai (C)": "NAVI MUMBAI", "Pimpri Chinchwad (C)": "PIMPRI-CHINCHWAD",
    "Pune (C)": "PUNE CITY", "Pune (R)": "PUNE RURAL", "Pune Rly": "RAILWAY PUNE", "Solapur (C)": "SOLAPUR CITY",
    "Solapur (R)": "SOLAPUR RURAL", "Thane (C)": "THANE CITY", "Thane (R)": "THANE RURAL",
}

# Conviction (or display) unit → Emergency 112 Mastersheet district
UNIT_MAP_112 = {
    "Ahmednagar": "Ahilyanagar", "Amravati (C)": "Amravati City", "Amravati (R)": "Amravati Rural",
    "Chh. Sambhaji N. (C)": "Chatrapati Sambhajinagar", "Chh. Sambhaji N. (R)": "Chhatrapati Sambhajinagar Rural",
    "Mira Bhyander V.V. (C)": "MiraBhayander", "Mumbai (C)": "Mumbai City",
    "Nagpur (C)": "Nagpur City", "Nagpur (R)": "Nagpur Rural", "Nagpur Rural": "Nagpur Rural",
    "Nasik (C)": "Nashik City", "Nasik (R)": "Nashik Rural", "Navi Mumbai (C)": "Navi Mumbai",
    "Pimpri Chinchwad (C)": "Pimpri Chinchwad", "Pune (C)": "Pune City", "Pune (R)": "Pune Rural",
    "Solapur (C)": "Solapur City", "Solapur (R)": "Solapur Rural", "Thane (C)": "Thane City", "Thane (R)": "Thane Rural",
    "Osmanabad": "Dharashiv",
}

# Conviction unit → Training Mastersheet unit
UNIT_MAP_TRAINING = {
    "Ahmednagar": "Ahilyanagar", "Amravati (C)": "Amravati City", "Amravati (R)": "Amravati Rural",
    "Chh. Sambhaji N. (C)": "Chh.Sambhaji Nagar City", "Chh. Sambhaji N. (R)": "Chh.Sambhaji Nagar Rural",
    "Chh. Sambhaji N. Rly": "Railway Chh. Shambaji Nagar",
    "Mira Bhyander V.V. (C)": "Mira-Bhayandar", "Nagpur (C)": "Nagpur City", "Nagpur (R)": "Nagpur Rural",
    "Nagpur Rly": "Railway Nagpur", "Nasik (C)": "Nashik City", "Navi Mumbai (C)": "Navi Mumbai",
    "Pimpri Chinchwad (C)": "Pimpri Chinchwad", "Pune (C)": "Pune City", "Pune (R)": "Pune Rural",
    "Pune Rly": "Railway Pune", "Solapur (C)": "Solapur City", "Solapur (R)": "Solapur Rural",
    "Thane (C)": "Thane City", "Thane (R)": "Thane Rural", "Mumbai Rly": "Railway Mumbai",
    "Osmanabad": "Dharashiv", "Nanded": "Naded",
}

# Conviction unit → ANTF Meeting Conducted unit
UNIT_MAP_ANTF = {
    "Ahmednagar": "Ahilyanagar", "Amravati (C)": "Amravati", "Amravati (R)": "Amravati",
    "Mumbai (C)": "Mumbai City", "Nagpur (C)": "Nagpur", "Nagpur (R)": "Nagpur",
    "Nasik (C)": "Nashik", "Nasik (R)": "Nashik", "Pune (C)": "Pune", "Pune (R)": "Pune",
    "Solapur (C)": "Solapur", "Solapur (R)": "Solapur", "Thane (C)": "Thane", "Thane (R)": "Thane",
    "Aurangabad": "Aurangabad", "Osmanabad": "Osmanabad",
}

# Conviction unit → HSP Quaterly unit (as stored / displayed after HSP_UNIT_ALIASES)
UNIT_MAP_HSP = {
    "Ahmednagar": "Ahilyanagar", "Amravati (C)": "Amravati City", "Amravati (R)": "Amaravati ®",
    "Chh. Sambhaji N. (C)": "Chh. Sambhaji N. (C)", "Chh. Sambhaji N. (R)": "Chh. Sambhaji N. ®",
    "Mira Bhyander V.V. (C)": "Mira Bhyander V.V. (C)", "Mumbai (C)": "Mumbai city",
    "Nagpur (C)": "Nagpur city", "Nagpur (R)": "Nagpur ®", "Nagpur Rural": "Nagpur ®",
    "Nasik (C)": "Nasik city", "Nasik (R)": "Nasik ®",
    "Navi Mumbai (C)": "Navi Mumbai", "Pimpri Chinchwad (C)": "PCMC",
    "Pune (C)": "Pune city", "Pune (R)": "Pune ®",
    "Solapur (C)": "Solapur city", "Solapur (R)": "Solapur ®",
    "Thane (C)": "Thane city", "Thane (R)": "Thane ®",
    "Osmanabad": "Dharashiv", "Beed": "Beed",
}

# Legacy HSP workbook labels → canonical HSP display names
HSP_UNIT_ALIASES = {
    "C.S.Nagarcity": "Chh. Sambhaji N. (C)",
    "C.S.Nagar®": "Chh. Sambhaji N. ®",
    "C.S.Nagar": "Chh. Sambhaji N. ®",
    "MB-VV": "Mira Bhyander V.V. (C)",
    "PCPC": "PCMC",
}


def _normalize_hsp_unit(unit: str) -> str:
    cleaned = " ".join(str(unit or "").replace("\n", " ").split()).strip()
    return HSP_UNIT_ALIASES.get(cleaned, cleaned)

_MONTH_ORD = {m: i for i, m in enumerate(
    ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"], 1)}


_QUARTER_ORD = {"Apr-Jun": 1, "Jul-Sep": 2, "Oct-Dec": 3, "Jan-Mar": 0}


def _period_key(p: str):
    parts = p.split()
    # Quarter labels: "Apr-Jun 2026"
    if len(parts) == 2 and parts[0] in _QUARTER_ORD and parts[1].isdigit():
        return (int(parts[1]), _QUARTER_ORD[parts[0]])
    if len(parts) == 2 and parts[0] in _MONTH_ORD and parts[1].isdigit():
        return (int(parts[1]), _MONTH_ORD[parts[0]])
    year = int(parts[-1]) if parts and parts[-1].isdigit() else 0
    half = 0 if p.lower().startswith("jan") else 1
    return (year, half)


def _series(entry: dict, unit: Optional[str], periods: list, scope_units: list):
    def rate_for(units, p):
        den = sum(entry["facts"].get((u, p), {}).get("den", 0) for u in units)
        num = sum(entry["facts"].get((u, p), {}).get("num", 0) for u in units)
        return round(100 * num / den, 2) if den else None
    return ({p: rate_for([unit], p) for p in periods} if unit else {}), {p: rate_for(scope_units, p) for p in periods}


def _series_112(entry: dict, unit: Optional[str], periods: list, scope_units: list):
    def pct_for(units, p):
        facts = [entry["facts"].get((u, p)) for u in units]
        facts = [f for f in facts if f]
        if not facts:
            return None
        closed = sum(f.get("num", 0) for f in facts)
        responded = sum(f.get("responded") or f.get("den", 0) for f in facts)
        return round(100 * closed / responded, 2) if responded else None
    return ({p: pct_for([unit], p) for p in periods} if unit else {}), {p: pct_for(scope_units, p) for p in periods}


@api_router.get("/trend")
async def trend(unit: str, conv_type: str, tim_type: str, member: dict = Depends(viewer)):
    rng = scope_range(member)
    out, units_meta = {}, {}
    for domain, type_ in (("conviction", conv_type), ("timeliness", tim_type), ("emergency112", "All"), ("hsp", "All"), ("training", "All"), ("antf", "All")):
        try:
            ds = await active_dataset(domain)
        except HTTPException:
            continue
        data = await load_facts(ds)
        if type_ not in data:
            if domain in ("emergency112", "training", "antf", "hsp"):
                continue
            raise HTTPException(status_code=400, detail=f"Unknown {domain} case type")
        entry = data[type_]
        scope_units = [u for u, r in entry["units"] if not rng or r == rng]
        if domain == "conviction":
            name = unit
            if unit not in scope_units:
                raise HTTPException(status_code=404, detail="Unit not found in your scope")
        elif domain == "timeliness":
            name = UNIT_MAP.get(unit, unit.upper())
        elif domain == "emergency112":
            name = UNIT_MAP_112.get(unit, unit)
        elif domain == "training":
            name = UNIT_MAP_TRAINING.get(unit, unit)
        elif domain == "antf":
            name = UNIT_MAP_ANTF.get(unit, unit)
        else:
            name = UNIT_MAP_HSP.get(unit, unit)
        matched = name if name in scope_units else next((u for u in scope_units if u.lower() == name.lower()), None)
        units_meta[domain] = matched
        if domain == "emergency112":
            out[domain] = (ds["periods"], *_series_112(entry, matched, ds["periods"], scope_units))
        else:
            out[domain] = (ds["periods"], *_series(entry, matched, ds["periods"], scope_units))
    period_set = set()
    for v in out.values():
        period_set |= set(v[0])
    periods = sorted(period_set, key=_period_key)
    points = []
    for p in periods:
        pt = {"period": p}
        for domain in ("conviction", "timeliness", "emergency112", "hsp", "training", "antf"):
            if domain not in out:
                pt[domain] = None
                pt[f"{domain}_benchmark"] = None
                continue
            pt[domain] = out[domain][1].get(p)
            pt[f"{domain}_benchmark"] = out[domain][2].get(p)
        points.append(pt)
    return {"unit": unit, "matched": units_meta, "benchmark_label": f"{rng} average" if rng else "State average", "points": points}


# ---------- Leadership reports ----------
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


async def report_settings() -> dict:
    s = await db.settings.find_one({"key": "report"}, {"_id": 0})
    if not s:
        s = {"key": "report", "enabled": True,
             "recipients": [e.strip() for e in os.environ.get("REPORT_DEFAULT_RECIPIENTS", "").split(",") if e.strip()]}
        await db.settings.update_one({"key": "report"}, {"$setOnInsert": s}, upsert=True)
    return s


def _app_url(request: Request) -> str:
    host = (request.headers.get("x-forwarded-host") or request.headers.get("host", "")).split(",")[0].strip()
    return f"https://{host}"


async def generate_report(trigger: str, member: Optional[dict], app_url: str) -> dict:
    policy = await get_policy()
    sections = []
    for domain in DOMAINS:
        ds = await active_dataset(domain)
        data = await load_facts(ds)
        b, l = default_periods(ds)
        type_ = ds["types"][-1]
        rows, _ = score_units(domain, data[type_]["facts"], data[type_]["units"], b, l, policy)
        sections.append(build_section(domain, type_, b, l, rows, totals(domain, rows)))
    created = datetime.now(timezone.utc)
    settings = await report_settings()
    report = {"id": str(uuid.uuid4()), "created_at": created.isoformat(), "trigger": trigger,
              "title": f"Monthly report - {created.strftime('%B %Y')}", "policy_version": policy.get("version"),
              "sections": sections, "created_by": member.get("email") if member else "schedule", "deliveries": []}
    subject, html = render_email(report, app_url)
    for to in settings["recipients"] if settings.get("enabled", True) else []:
        try:
            await send_email(to=to, subject=subject, html=html)
            report["deliveries"].append({"to": to, "status": "sent"})
        except HTTPException as e:
            report["deliveries"].append({"to": to, "status": "failed", "error": e.detail})
    await db.reports.insert_one({**report})
    await audit("report_generated", member, {"report_id": report["id"], "trigger": trigger, "deliveries": report["deliveries"]})
    return report


class ReportSettingsIn(BaseModel):
    recipients: List[str]
    enabled: bool = True


@api_router.get("/reports")
async def list_reports(member: dict = Depends(statewide)):
    reports = await db.reports.find({}, {"_id": 0, "sections": 0}).sort("created_at", -1).to_list(100)
    settings = await report_settings() if member["role"] == "admin" else None
    return {"reports": reports, "settings": settings}


@api_router.put("/reports/settings")
async def save_report_settings(body: ReportSettingsIn, member: dict = Depends(admin_only)):
    recipients = list(dict.fromkeys(e.strip().lower() for e in body.recipients if e.strip()))
    bad = [e for e in recipients if not EMAIL_RE.match(e)]
    if bad or len(recipients) > 25:
        raise HTTPException(status_code=422, detail=f"Invalid recipients: {', '.join(bad) or 'max 25'}")
    await db.settings.update_one({"key": "report"}, {"$set": {"recipients": recipients, "enabled": body.enabled}}, upsert=True)
    await audit("report_settings_changed", member, {"recipients": recipients, "enabled": body.enabled})
    return {"recipients": recipients, "enabled": body.enabled}


@api_router.post("/reports/send-now")
async def send_report_now(request: Request, member: dict = Depends(admin_only)):
    last = await db.reports.find_one({"trigger": "manual"}, {"_id": 0, "created_at": 1}, sort=[("created_at", -1)])
    if last and (datetime.now(timezone.utc) - datetime.fromisoformat(last["created_at"])).total_seconds() < 60:
        raise HTTPException(status_code=429, detail="Please wait a minute between manual sends")
    report = await generate_report("manual", member, _app_url(request))
    return {k: report[k] for k in ("id", "title", "created_at", "deliveries")}


@api_router.get("/reports/{report_id}/pdf")
async def report_pdf(report_id: str, member: dict = Depends(statewide)):
    report = await db.reports.find_one({"id": report_id}, {"_id": 0})
    if not report:
        raise HTTPException(status_code=404, detail="Not found")
    pdf = await run_in_threadpool(render_pdf, report)
    await audit("export", member, {"format": "pdf", "view": "leadership-report", "report_id": report_id})
    return Response(content=pdf, media_type="application/pdf",
                    headers={"Content-Disposition": f'attachment; filename="{report["title"].replace(" ", "_")}.pdf"'})


# ---------- Platform cron webhooks ----------
async def _cron_accept(request: Request) -> Optional[str]:
    auth = request.headers.get("authorization", "")
    secret = os.environ["WEBHOOK_CRON_SECRET"]
    if not auth.startswith("Bearer ") or not hmac.compare_digest(auth[7:], secret):
        raise HTTPException(status_code=401, detail="Unauthorized")
    raw = await request.body()
    try:
        body = json.loads(raw) if raw.strip() else {}
    except ValueError:
        body = {}
    run_id = request.headers.get("x-webhook-id") or (body if isinstance(body, dict) else {}).get("run_id") or str(uuid.uuid4())
    try:
        await db.cron_runs.insert_one({"run_id": f"{request.url.path}:{run_id}", "path": request.url.path, "ts": now_iso()})
    except DuplicateKeyError:
        return None
    return run_id


@api_router.post("/cron/daily-sync")
async def cron_daily_sync(request: Request, background: BackgroundTasks):
    # Cron endpoints must ack 2xx immediately; enqueue/background the actual work.
    run_id = await _cron_accept(request)
    if run_id:
        background.add_task(sync_daily_sources)
    return {"accepted": True, "duplicate": run_id is None}


@api_router.post("/cron/monthly-report")
async def cron_monthly_report(request: Request, background: BackgroundTasks):
    # Cron endpoints must ack 2xx immediately; enqueue/background the actual work.
    run_id = await _cron_accept(request)
    if run_id:
        background.add_task(generate_report, "schedule", None, _app_url(request))
    return {"accepted": True, "duplicate": run_id is None}


bind_auth(db=db, env=ENV, default_role=DEFAULT_ROLE, now_iso=now_iso, audit=audit)
app.include_router(api_router)
app.include_router(auth_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')


async def seed_datasets():
    seeds = (
        ("conviction", "conviction.xlsm", "conviction_Final Dashboard_v3.xlsm"),
        ("timeliness", "timeliness.xlsm", "timeliness_Final Dashboard_v3.xlsm"),
        ("emergency112", "emergency112.xlsm", "Dashboard 112_V2.xlsm"),
        ("hsp", "hsp.xlsm", "Consilidated HSP Data_v3.xlsm"),
        ("training", "training.xlsm", "Training Data v2.xlsm"),
        ("antf", "antf.xlsx", "ANTF Meetings Conducted Dashboard.xlsx"),
    )
    for domain, fname, label in seeds:
        if await db.datasets.count_documents({"domain": domain}):
            continue
        path = ROOT_DIR / "seed" / fname
        if not path.exists():
            logger.warning("Seed file missing for %s: %s", domain, path)
            continue
        parsed = await run_in_threadpool(parse_workbook, path.read_bytes())
        await store_dataset(parsed, label, "historical workbook", None)
        logger.info("Seeded %s dataset (%d records)", domain, len(parsed["facts"]))


@app.on_event("startup")
async def startup():
    app.state.index_task = asyncio.create_task(ensure_indexes())
    for old, new in RETIRED_ROLES.items():
        await db.users.update_many({"role": old}, {"$set": {"role": new}})
    admin_id = await bootstrap_admin()
    if admin_id:
        logger.info("Bootstrapped admin account %s", admin_id)
    await seed_datasets()


@app.on_event("shutdown")
async def shutdown_db_client():
    app.state.index_task.cancel()
    with suppress(asyncio.CancelledError):
        await app.state.index_task
    client.close()
