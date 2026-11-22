import { useEffect, useMemo, useState } from "react";
import { Loader2, MapPinned } from "lucide-react";
import {
  ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Tooltip,
} from "recharts";
import { Panel, CategoryBadge } from "@/components/Primitives";
import { useApi, errMsg } from "@/lib/api";
import { fmt, slug, MAP_LEGEND, mapCategoryColor } from "@/lib/format";
import { CHART, TipBox } from "@/lib/chartTheme";
import geo from "@/data/maharashtra-districts.json";
import tahasils from "@/data/maharashtra-tahasils.json";

const DOMAIN_OPTIONS = [
  { key: "conviction", label: "Conviction" },
  { key: "timeliness", label: "60-90 Charge Sheet" },
  { key: "emergency112", label: "112" },
  { key: "hsp", label: "HSP" },
];

const DOMAIN_CARD_META = {
  conviction: { label: "Conviction", rateLabel: "Conviction rate" },
  timeliness: { label: "60-90 Charge Sheet", rateLabel: "Within-time rate" },
  emergency112: { label: "112", rateLabel: "% closed ≤100m" },
  hsp: { label: "HSP", rateLabel: "Killed / accidents" },
};

/** Explicit unit → geo district when auto-match is ambiguous. */
const UNIT_DISTRICT = {
  "Ahmednagar": "Ahmednagar",
  "Amravati (R)": "Amravati",
  "Amravati (C)": "Amravati",
  "Chh. Sambhaji N. (R)": "Aurangabad",
  "Chh. Sambhaji N. (C)": "Aurangabad",
  "Chh. Sambhaji N. Rly": "Aurangabad",
  "Dharashiv": "Osmanabad",
  "Mira Bhyander V.V. (C)": "Thane",
  "Mumbai (C)": "Mumbai",
  "Mumbai Rly": "Mumbai",
  "Nagpur (C)": "Nagpur",
  "Nagpur Rural": "Nagpur",
  "Nagpur Rly": "Nagpur",
  "Nasik (C)": "Nashik",
  "Nasik (R)": "Nashik",
  "Navi Mumbai (C)": "Thane",
  "Pimpri Chinchwad (C)": "Pune",
  "Pune (C)": "Pune",
  "Pune (R)": "Pune",
  "Pune Rly": "Pune",
  "Solapur (C)": "Solapur",
  "Solapur (R)": "Solapur",
  "Thane (C)": "Thane",
  "Thane (R)": "Thane",
};

const ALIASES = {
  ahmednagar: ["ahilyanagar"],
  aurangabad: ["chh sambhaji n", "chhatrapati sambhajinagar", "chatrapati sambhajinagar", "c s nagar"],
  osmanabad: ["dharashiv"],
  nashik: ["nasik"],
  mumbai: ["mumbai city", "mumbai suburban"],
  thane: ["mira bhyander", "mb vv", "navi mumbai"],
  pune: ["pimpri chinchwad", "pcpc"],
};

function norm(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[®().,_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function districtKey(name) {
  return norm(name).replace(/\s+(rural|city|rly|urban)$/g, "").trim();
}

function findUnitRow(list, unitName) {
  if (!list?.length || !unitName) return null;
  const n = districtKey(unitName);
  const exact = list.find((r) => districtKey(r.unit) === n);
  if (exact) return exact;
  return list.find((r) => {
    const u = districtKey(r.unit);
    return u.length >= 4 && (u.includes(n) || n.includes(u));
  }) || null;
}

function avg(vals) {
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

/** Statewide summary row shaped like a unit score row for DomainSnapshotCard / radar. */
function stateDomainRow(domainKey, rows, overviewTotals) {
  const list = rows || [];
  const tot = overviewTotals || {};
  const scored = list.filter((r) => r.overall_score != null);
  const overall = tot.avg_overall_score ?? avg(scored.map((r) => r.overall_score));
  if (overall == null && !list.length) return null;

  let latestRate = tot.latest_rate;
  if (latestRate == null && domainKey !== "hsp") {
    const ld = list.reduce((s, r) => s + (r.latest_den || 0), 0);
    const ln = list.reduce((s, r) => s + (r.latest_num || 0), 0);
    latestRate = ld > 0 ? (100 * ln) / ld : avg(list.map((r) => r.latest_rate).filter((v) => v != null));
  }
  if (latestRate == null && domainKey === "hsp") {
    const la = list.reduce((s, r) => s + (r.latest_accidents || 0), 0);
    const lk = list.reduce((s, r) => s + (r.latest_killed || 0), 0);
    latestRate = la > 0 ? (100 * lk) / la : null;
  }

  const cat = districtCategory(scored);

  return {
    unit: "Maharashtra (statewide)",
    overall_score: overall,
    rank: null,
    category: cat,
    latest_rate: latestRate,
    latest_accidents: tot.total_accidents ?? list.reduce((s, r) => s + (r.latest_accidents || 0), 0),
    latest_killed: tot.total_killed ?? list.reduce((s, r) => s + (r.latest_killed || 0), 0),
    latest_injured: tot.total_injured ?? list.reduce((s, r) => s + (r.latest_injured || 0), 0),
    unit_count: tot.unit_count ?? list.length,
    scored_count: tot.scored_count ?? scored.length,
  };
}

function fmtIntSafe(v) {
  if (v == null || Number.isNaN(v)) return "—";
  return Math.round(Number(v)).toLocaleString("en-IN");
}

function DomainSnapshotCard({ domainKey, row }) {
  const meta = DOMAIN_CARD_META[domainKey];
  const missing = !row || row.overall_score == null;
  let metric = "—";
  if (!missing) {
    if (domainKey === "hsp") {
      metric = `${fmtIntSafe(row.latest_killed)} / ${fmtIntSafe(row.latest_accidents)}`;
    } else if (row.latest_rate != null) {
      metric = `${fmt(row.latest_rate)}%`;
    }
  }
  return (
    <div
      className="rounded-sm border border-slate-200 bg-white px-3 py-2.5 shadow-sm shadow-slate-900/5"
      data-testid={`map-domain-card-${domainKey}`}
    >
      <div className="flex items-center justify-between gap-2 min-w-0">
        <div className="text-[10px] uppercase tracking-[0.12em] font-bold text-slate-500 truncate">{meta.label}</div>
        {row?.category ? <CategoryBadge value={row.category} /> : null}
      </div>
      {missing ? (
        <div className="text-xs text-slate-400 mt-1.5">No matching unit</div>
      ) : (
        <div className="mt-1.5 space-y-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-num text-lg font-bold text-brand-navy leading-none">{fmt(row.overall_score)}</span>
            <span className="font-num text-xs text-slate-600">
              {row.rank != null
                ? `#${row.rank}`
                : (row.scored_count != null || row.unit_count != null
                  ? `${row.scored_count ?? row.unit_count} units`
                  : "avg")}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
            <span className="truncate">{meta.rateLabel}</span>
            <span className="font-num font-semibold text-slate-800 shrink-0">{metric}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function UnitDomainRadar({ snapshots }) {
  const data = (snapshots || []).map((d) => ({
    subject: DOMAIN_CARD_META[d.key]?.label || d.key,
    score: d.row?.overall_score == null || Number.isNaN(Number(d.row.overall_score))
      ? 0
      : Number(d.row.overall_score),
    fullMark: 100,
  }));
  const hasAny = (snapshots || []).some((d) => d.row?.overall_score != null);
  if (!hasAny) {
    return <div className="text-xs text-slate-400 py-6 text-center">No domain scores for this unit</div>;
  }
  return (
    <div className="h-[200px] w-full" data-testid="map-unit-radar">
      <ResponsiveContainer>
        <RadarChart data={data} cx="50%" cy="52%" outerRadius="68%">
          <PolarGrid stroke={CHART.grid} />
          <PolarAngleAxis
            dataKey="subject"
            tick={{ fill: CHART.tick, fontSize: 10, fontWeight: 600 }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tick={{ fill: CHART.tick, fontSize: 9 }}
            tickCount={5}
          />
          <Tooltip content={<TipBox />} />
          <Radar
            name="Score"
            dataKey="score"
            stroke={CHART.navy}
            fill={CHART.navy}
            fillOpacity={0.28}
            strokeWidth={2}
            isAnimationActive
            animationDuration={CHART.animationDuration}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Prefer the most common unit category in a district; ties break toward the lower score. */
function districtCategory(list) {
  const scored = list.filter((r) => r.category && r.category !== "Not scored");
  if (!scored.length) return null;
  const counts = {};
  scored.forEach((r) => { counts[r.category] = (counts[r.category] || 0) + 1; });
  const maxCount = Math.max(...Object.values(counts));
  const tied = Object.keys(counts).filter((c) => counts[c] === maxCount);
  if (tied.length === 1) return tied[0];
  const byCat = {};
  scored.forEach((r) => {
    if (!tied.includes(r.category) || r.overall_score == null) return;
    (byCat[r.category] || (byCat[r.category] = [])).push(r.overall_score);
  });
  let best = tied[0];
  let bestAvg = Infinity;
  tied.forEach((c) => {
    const vals = byCat[c] || [];
    const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : Infinity;
    if (avg < bestAvg) {
      bestAvg = avg;
      best = c;
    }
  });
  return best;
}

function ringCentroid(ring) {
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [x0, y0] = ring[j];
    const [x1, y1] = ring[i];
    const f = x0 * y1 - x1 * y0;
    a += f;
    cx += (x0 + x1) * f;
    cy += (y0 + y1) * f;
  }
  a *= 0.5;
  if (Math.abs(a) < 1e-9) {
    const xs = ring.map((p) => p[0]);
    const ys = ring.map((p) => p[1]);
    return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
  }
  return [cx / (6 * a), cy / (6 * a)];
}

function geomCentroid(geom) {
  if (geom.type === "Polygon") return ringCentroid(geom.coordinates[0]);
  if (geom.type === "MultiPolygon") {
    let best = null;
    let bestArea = -1;
    geom.coordinates.forEach((poly) => {
      const ring = poly[0];
      let a = 0;
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        a += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
      }
      a = Math.abs(a / 2);
      if (a > bestArea) {
        bestArea = a;
        best = ringCentroid(ring);
      }
    });
    return best;
  }
  return null;
}

function projectFactory(features, width, height, pad = 16) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const walk = (coords) => {
    if (!coords?.length) return;
    if (typeof coords[0] === "number") {
      const [x, y] = coords;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      return;
    }
    coords.forEach(walk);
  };
  features.forEach((f) => walk(f.geometry.coordinates));
  const dx = maxX - minX || 1;
  const dy = maxY - minY || 1;
  const scale = Math.min((width - pad * 2) / dx, (height - pad * 2) / dy);
  const ox = (width - dx * scale) / 2;
  const oy = (height - dy * scale) / 2;
  const project = ([x, y]) => [ox + (x - minX) * scale, height - (oy + (y - minY) * scale)];
  const ringPath = (ring) => ring.map((p, i) => `${i ? "L" : "M"}${project(p).join(",")}`).join(" ") + "Z";
  const geomPath = (geom) => {
    if (geom.type === "Polygon") return geom.coordinates.map(ringPath).join(" ");
    if (geom.type === "MultiPolygon") {
      return geom.coordinates.map((poly) => poly.map(ringPath).join(" ")).join(" ");
    }
    return "";
  };
  return { project, geomPath };
}

function resolveDistrict(unit, districtNames) {
  if (UNIT_DISTRICT[unit]) return UNIT_DISTRICT[unit];
  const uKey = districtKey(unit);
  const exact = districtNames.find((d) => districtKey(d) === uKey);
  if (exact) return exact;
  for (const d of districtNames) {
    const dKey = districtKey(d);
    const aliases = [dKey, ...(ALIASES[dKey] || []).map(norm)];
    if (aliases.some((a) => uKey === a || uKey.includes(a) || a.includes(uKey))) return d;
  }
  return null;
}

function labelSize(name, fontSize = 8.5) {
  // Approx Source Sans glyph width — keep boxes conservative so names never overlap
  const w = Math.max(28, String(name).length * fontSize * 0.58);
  const h = fontSize + 4;
  return { w, h };
}

/** Push label boxes apart until none overlap (or max passes). */
function resolveLabelOverlaps(points, mapW, mapH, pad = 4) {
  const items = points.map((p) => {
    const { w, h } = labelSize(p.unit);
    return { ...p, lw: w, lh: h, lx: p.lx, ly: p.ly };
  });
  const clamp = (p) => {
    p.lx = Math.max(2, Math.min(mapW - p.lw - 2, p.lx));
    p.ly = Math.max(p.lh, Math.min(mapH - 2, p.ly));
  };
  items.forEach(clamp);

  for (let pass = 0; pass < 40; pass += 1) {
    let moved = false;
    for (let i = 0; i < items.length; i += 1) {
      for (let j = i + 1; j < items.length; j += 1) {
        const a = items[i];
        const b = items[j];
        const ax0 = a.lx;
        const ay0 = a.ly - a.lh;
        const ax1 = a.lx + a.lw;
        const ay1 = a.ly;
        const bx0 = b.lx;
        const by0 = b.ly - b.lh;
        const bx1 = b.lx + b.lw;
        const by1 = b.ly;
        const overlapX = Math.min(ax1, bx1) - Math.max(ax0, bx0);
        const overlapY = Math.min(ay1, by1) - Math.max(ay0, by0);
        if (overlapX <= pad || overlapY <= pad) continue;
        const pushX = (overlapX + pad) / 2;
        const pushY = (overlapY + pad) / 2;
        const acx = (ax0 + ax1) / 2;
        const bcx = (bx0 + bx1) / 2;
        const acy = (ay0 + ay1) / 2;
        const bcy = (by0 + by1) / 2;
        if (Math.abs(acx - bcx) >= Math.abs(acy - bcy)) {
          if (acx <= bcx) {
            a.lx -= pushX;
            b.lx += pushX;
          } else {
            a.lx += pushX;
            b.lx -= pushX;
          }
        } else if (acy <= bcy) {
          a.ly -= pushY;
          b.ly += pushY;
        } else {
          a.ly += pushY;
          b.ly -= pushY;
        }
        clamp(a);
        clamp(b);
        moved = true;
      }
    }
    if (!moved) break;
  }
  return items;
}

export default function MaharashtraMap({ overview }) {
  const api = useApi();
  const [domain, setDomain] = useState("conviction");
  const [domainRows, setDomainRows] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hover, setHover] = useState(null);
  const [size, setSize] = useState({ w: 720, h: 520 });

  useEffect(() => {
    const onResize = () => {
      const w = Math.round(Math.min(920, Math.max(320, window.innerWidth - 120)) * 0.8);
      setSize({ w, h: Math.round(w * 0.72) });
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    const available = DOMAIN_OPTIONS.filter((o) => overview?.[o.key]);
    if (!available.length) {
      setDomainRows({});
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all(
      available.map((o) => {
        const snap = overview[o.key];
        return api("get", "/dashboard", {
          params: {
            domain: o.key,
            type: snap.type,
            base: snap.base,
            latest: snap.latest,
          },
        })
          .then((d) => [o.key, d.rows || []])
          .catch(() => [o.key, []]);
      }),
    )
      .then((entries) => {
        if (!cancelled) setDomainRows(Object.fromEntries(entries));
      })
      .catch((e) => {
        if (!cancelled) setError(errMsg(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [api, overview]);

  const rows = domainRows[domain] || [];

  const districtNames = useMemo(
    () => (geo.features || []).map((f) => f.properties.district),
    [],
  );

  const centroids = useMemo(() => {
    const m = {};
    (geo.features || []).forEach((f) => {
      const c = geomCentroid(f.geometry);
      if (c) m[f.properties.district] = c;
    });
    return m;
  }, []);

  const tahasilByDistrict = useMemo(() => {
    const m = {};
    (tahasils || []).forEach((d) => {
      m[districtKey(d.name)] = d.tahasil || [];
      if (d.name === "Mumbai Suburban") m.mumbai = d.tahasil || [];
    });
    return m;
  }, []);

  const { project, geomPath } = useMemo(
    () => projectFactory(geo.features || [], size.w, size.h),
    [size.w, size.h],
  );

  const markers = useMemo(() => {
    const byDist = {};
    rows.forEach((r) => {
      const dist = resolveDistrict(r.unit, districtNames);
      if (!dist || !centroids[dist]) return;
      (byDist[dist] || (byDist[dist] = [])).push(r);
    });

    const districtScores = {};
    const districtCats = {};
    Object.entries(byDist).forEach(([dist, list]) => {
      const vals = list.map((r) => r.overall_score).filter((v) => v != null);
      districtScores[dist] = vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
      districtCats[dist] = districtCategory(list);
    });
    const districtColors = {};
    Object.entries(districtCats).forEach(([dist, cat]) => {
      districtColors[dist] = mapCategoryColor(cat);
    });
    const covered = Object.values(districtCats).filter(Boolean).length;

    const raw = [];
    Object.entries(byDist).forEach(([dist, list]) => {
      const [lon, lat] = centroids[dist];
      const n = list.length;
      const ordered = [...list].sort((a, b) => a.unit.localeCompare(b.unit));
      ordered.forEach((r, i) => {
        const angle = n === 1 ? -Math.PI / 2 : (i / n) * Math.PI * 2 - Math.PI / 2;
        const radius = n === 1 ? 0 : 0.28 + Math.min(0.22, (n - 2) * 0.06);
        const lon2 = lon + Math.cos(angle) * radius;
        const lat2 = lat + Math.sin(angle) * radius * 0.85;
        const [x, y] = project([lon2, lat2]);
        const lx = x + (n === 1 ? 8 : Math.cos(angle) * 14 + 8);
        const ly = y + (n === 1 ? 3 : Math.sin(angle) * 12);
        raw.push({
          ...r,
          district: dist,
          districtScore: districtScores[dist],
          districtCategory: districtCats[dist],
          x,
          y,
          lx,
          ly,
        });
      });
    });

    const points = resolveLabelOverlaps(raw, size.w, size.h);
    return {
      points,
      districtColors,
      districtScores,
      districtCats,
      placed: points.length,
      total: rows.length,
      covered,
    };
  }, [rows, centroids, districtNames, project, size.w, size.h]);

  const hoverInfo = hover
    ? {
        ...hover,
        tahasil:
          tahasilByDistrict[districtKey(hover.district)]
          || tahasilByDistrict[districtKey(hover.district === "Mumbai" ? "Mumbai Suburban" : hover.district)]
          || [],
      }
    : null;

  const stateSnapshots = useMemo(
    () => DOMAIN_OPTIONS.map((o) => ({
      key: o.key,
      row: stateDomainRow(o.key, domainRows[o.key], overview?.[o.key]?.totals),
    })),
    [domainRows, overview],
  );

  const domainSnapshots = useMemo(() => {
    if (!hoverInfo?.unit) return stateSnapshots;
    return DOMAIN_OPTIONS.map((o) => ({
      key: o.key,
      row: findUnitRow(domainRows[o.key], hoverInfo.unit),
    }));
  }, [domainRows, hoverInfo?.unit, stateSnapshots]);

  const detailMode = hoverInfo ? "unit" : "state";
  const stateUnitCount = stateSnapshots.find((d) => d.row?.unit_count)?.row?.unit_count
    || stateSnapshots.find((d) => d.row?.scored_count)?.row?.scored_count
    || null;

  const snap = overview?.[domain];
  const unplaced = markers.total - markers.placed;

  return (
    <div className="space-y-4" data-testid="overview-map">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold text-slate-900 tracking-tight">Maharashtra map</h2>
          <p className="text-xs text-slate-500 mt-0.5 max-w-2xl">
            All units plotted on district boundaries · tahasils from{" "}
            <a
              className="text-teal-700 hover:underline"
              href="https://gist.github.com/maheshwarLigade/f0ae609cf7e68480622c2acc20b06a7f"
              target="_blank"
              rel="noreferrer"
            >
              gist
            </a>
            {snap ? ` · ${snap.base} → ${snap.latest}` : ""}.
          </p>
        </div>
        <label className="text-xs text-slate-600">
          <span className="block text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1">Score domain</span>
          <select
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            className="h-9 rounded-sm border border-slate-200 bg-white px-2 text-sm"
            data-testid="map-domain-select"
          >
            {DOMAIN_OPTIONS.filter((o) => overview?.[o.key]).map((o) => (
              <option key={o.key} value={o.key}>{o.label}</option>
            ))}
          </select>
        </label>
      </div>

      {error && <div className="text-sm text-rose-700" data-testid="map-error">{error}</div>}

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-4">
        <Panel
          title="District choropleth"
          subtitle={`${markers.covered} districts coloured · ${markers.placed} unit labels${unplaced ? ` · ${unplaced} unmatched` : ""}`}
          testId="map-panel"
        >
          {loading ? (
            <div className="h-[320px] flex items-center justify-center text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : (
            <div className="relative">
              <svg
                viewBox={`0 0 ${size.w} ${size.h}`}
                className="w-full h-auto rounded-sm bg-slate-50 border border-slate-100"
                role="img"
                aria-label="Maharashtra district score map"
                data-testid="maharashtra-map-svg"
              >
                {(geo.features || []).map((f) => {
                  const name = f.properties.district;
                  const active = hover?.district === name;
                  const fill = markers.districtColors[name] || "#E2E8F0";
                  const distScore = markers.districtScores[name];
                  const distCat = markers.districtCats[name];
                  return (
                    <path
                      key={name}
                      d={geomPath(f.geometry)}
                      fill={fill}
                      stroke={active ? "#0F3D5E" : "#FFFFFF"}
                      strokeWidth={active ? 1.8 : 0.8}
                      className="cursor-pointer"
                      opacity={active ? 1 : 0.92}
                      onMouseEnter={() => {
                        const units = markers.points.filter((p) => p.district === name);
                        setHover(units[0] || {
                          unit: name,
                          district: name,
                          overall_score: distScore,
                          districtScore: distScore,
                          districtCategory: distCat,
                          rank: null,
                          category: distCat,
                          range: "",
                        });
                      }}
                      data-testid={`map-district-${slug(name)}`}
                    >
                      <title>{`${name}${distCat ? ` · ${distCat}` : ""}${distScore != null ? ` · ${fmt(distScore)}` : " · no score"}`}</title>
                    </path>
                  );
                })}
                {markers.points.map((m) => {
                  const active = hover?.unit === m.unit;
                  return (
                    <g
                      key={m.unit}
                      className="cursor-pointer"
                      onMouseEnter={() => setHover(m)}
                      data-testid={`map-unit-${slug(m.unit)}`}
                    >
                      <line
                        x1={m.x}
                        y1={m.y}
                        x2={m.lx - 2}
                        y2={m.ly - 2}
                        stroke={active ? "#0F3D5E" : "rgba(15,23,42,0.35)"}
                        strokeWidth={active ? 1.2 : 0.6}
                      />
                      <circle
                        cx={m.x}
                        cy={m.y}
                        r={active ? 3.2 : 2.2}
                        fill="#FFFFFF"
                        stroke={active ? "#0F3D5E" : "#334155"}
                        strokeWidth={1.2}
                      />
                      <text
                        x={m.lx}
                        y={m.ly}
                        fontSize={active ? 10 : 8.5}
                        fontWeight={active ? 700 : 600}
                        fill={active ? "#0F3D5E" : "#0F172A"}
                        stroke="#FFFFFF"
                        strokeWidth={3}
                        paintOrder="stroke"
                        style={{ fontFamily: "Source Sans 3, sans-serif", pointerEvents: "none" }}
                      >
                        {m.unit}
                      </text>
                      <title>{`${m.unit}${m.overall_score != null ? ` · ${fmt(m.overall_score)}` : ""}${m.rank ? ` · #${m.rank}` : ""}`}</title>
                    </g>
                  );
                })}
              </svg>
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[10px] text-slate-600" data-testid="map-category-legend">
                {MAP_LEGEND.map((item) => (
                  <div key={item.label} className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm shrink-0 border border-black/10" style={{ background: item.color }} />
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Panel>

        <Panel
          title={detailMode === "unit" ? "Unit detail" : "State detail"}
          subtitle={detailMode === "unit" ? hoverInfo.unit : "Maharashtra · statewide averages"}
          testId="map-detail"
          right={detailMode === "unit" ? (
            <button
              type="button"
              onClick={() => setHover(null)}
              className="text-xs text-brand-navy hover:text-teal-700 font-medium shrink-0"
              data-testid="map-show-state"
            >
              Statewide
            </button>
          ) : null}
        >
          <div className="space-y-3" data-testid={detailMode === "unit" ? "map-unit-detail" : "map-state-detail"}>
            <div>
              <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500">
                {detailMode === "unit" ? "Unit" : "Scope"}
              </div>
              {detailMode === "unit" ? (
                <>
                  <div className="font-semibold text-slate-900 mt-0.5">{hoverInfo.unit}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{hoverInfo.district} · {hoverInfo.range || "—"}</div>
                  {hoverInfo.districtScore != null && (
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      District avg {fmt(hoverInfo.districtScore)}
                      {hoverInfo.districtCategory ? ` · ${hoverInfo.districtCategory}` : ""}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="font-semibold text-slate-900 mt-0.5 inline-flex items-center gap-1.5">
                    <MapPinned className="h-3.5 w-3.5 text-teal-700" />
                    Maharashtra (state)
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {stateUnitCount != null ? `${stateUnitCount} police units · ` : ""}
                    hover a unit marker for unit-level detail
                  </div>
                </>
              )}
            </div>

            <div className="rounded-sm border border-slate-200 bg-white px-1 pt-1 pb-1 shadow-sm shadow-slate-900/5" data-testid="map-domain-radar-block">
              <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500 px-2.5 pt-1.5">
                Domain radar
              </div>
              <UnitDomainRadar snapshots={domainSnapshots} />
            </div>

            <div className="space-y-2" data-testid="map-domain-cards">
              <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500">
                {detailMode === "unit" ? "Domain scores" : "Statewide domain scores"}
              </div>
              {domainSnapshots?.map((d) => (
                <DomainSnapshotCard key={d.key} domainKey={d.key} row={d.row} />
              ))}
            </div>

            {detailMode === "unit" && (
              <div>
                <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1.5">
                  District tahasils ({hoverInfo.tahasil.length})
                </div>
                <div className="max-h-[140px] overflow-auto space-y-1 pr-1">
                  {hoverInfo.tahasil.length === 0 ? (
                    <div className="text-xs text-slate-500">No tahasil list for this district in the gist.</div>
                  ) : (
                    hoverInfo.tahasil.map((t) => (
                      <div key={t} className="text-xs text-slate-700 border-b border-slate-100 py-1">{t}</div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}
