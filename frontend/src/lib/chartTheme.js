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

export const TipBox = ({ active, payload, label, unit = "" }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-sm bg-[#0B1220] text-white text-xs px-3 py-2 shadow-lg border border-slate-800">
      <div className="font-semibold mb-1 text-slate-200">{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="font-num flex items-center gap-2">
          <span className="h-2 w-2 rounded-full shrink-0" style={{ background: p.color || CHART.navy }} />
          <span className="text-slate-400">{p.name}:</span>
          <span className="font-semibold">{p.value == null || p.value === undefined ? "—" : `${fmt(p.value)}${unit}`}</span>
        </div>
      ))}
    </div>
  );
};
