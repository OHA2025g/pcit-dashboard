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

/**
 * Custom Recharts Legend content — Recharts 3 reverses series in the default Legend,
 * so we render Trial→Convicted and Base→Latest ourselves. Other series keep payload order.
 */
export function OrderedLegend({ payload }) {
  const raw = payload || [];
  if (!raw.length) return null;
  const keyOf = (p) => p.dataKey ?? p.id ?? p.value ?? p.name;
  const hasPreferred = raw.some((p) => seriesRank(keyOf(p)) < 50);
  const items = hasPreferred ? orderSeriesItems(raw, keyOf) : raw;
  return (
    <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1 px-2 pt-1 text-[11px] text-slate-600">
      {items.map((entry) => (
        <li key={String(entry.value)} className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-2.5 shrink-0 rounded-[2px]"
            style={{ background: entry.color || CHART.navy }}
          />
          <span>{entry.value}</span>
        </li>
      ))}
    </ul>
  );
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
