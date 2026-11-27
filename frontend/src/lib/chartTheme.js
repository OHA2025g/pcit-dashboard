import { fmt } from "@/lib/format";

/** Shared Recharts theme — cool command-centre steel + teal. */

export const CHART = {
  navy: "#0F3D5E",
  navySoft: "#94A3B8",
  amber: "#0F766E", // teal accent (legacy key kept for call sites)
  emerald: "#15803D",
  rose: "#BE123C",
  grid: "#D8E0E8",
  tick: "#475569",
  cursor: "rgba(15,61,94,0.06)",
  tooltipBg: "#0B1220",
  dual: ["#94A3B8", "#0F3D5E"],
  animationDuration: 600,
};

/** Recharts Legend often reverses series; keep Base before Latest (and trials before convicted). */
function seriesRank(key) {
  const k = String(key || "").toLowerCase();
  if (k.includes("trial")) return 0;
  if (k.includes("convict")) return 1;
  if (k === "base" || k.startsWith("base_") || k.startsWith("base ")) return 10;
  if (k === "latest" || k.startsWith("latest_") || k.startsWith("latest ")) return 11;
  return 50;
}

export function orderSeriesItems(items, keyFn = (p) => p.dataKey ?? p.id ?? p.value ?? p.name) {
  return [...items].sort((a, b) => seriesRank(keyFn(a)) - seriesRank(keyFn(b)));
}

/** Explicit legend payload so Base always appears before Latest. */
export function baseLatestLegend(baseColor, latestColor, { baseName = "Base", latestName = "Latest" } = {}) {
  return [
    { value: baseName, type: "square", id: "base", color: baseColor },
    { value: latestName, type: "square", id: "latest", color: latestColor },
  ];
}

/** Legend payload from chart key pairs in declaration order (Base → Latest). */
export function keysLegendPayload(keys, colors = CHART.dual) {
  return keys.map(([k, name], i) => ({
    value: name,
    type: "square",
    id: k,
    color: colors[i] || CHART.navy,
  }));
}

export const TipBox = ({ active, payload, label, unit = "" }) => {
  if (!active || !payload?.length) return null;
  const rows = orderSeriesItems(payload);
  return (
    <div className="rounded-sm bg-[#0B1220] text-white text-xs px-3 py-2 shadow-lg border border-slate-800">
      <div className="font-semibold mb-1 text-slate-200">{label}</div>
      {rows.map((p) => (
        <div key={p.dataKey} className="font-num flex items-center gap-2">
          <span className="h-2 w-2 rounded-full shrink-0" style={{ background: p.color || CHART.navy }} />
          <span className="text-slate-400">{p.name}:</span>
          <span className="font-semibold">{p.value == null || p.value === undefined ? "—" : `${fmt(p.value)}${unit}`}</span>
        </div>
      ))}
    </div>
  );
};
