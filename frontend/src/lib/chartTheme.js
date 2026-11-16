import { fmt } from "@/lib/format";

/** Shared Recharts theme — keep ChartsPanel + Trends in sync. */

export const CHART = {
  navy: "#1E3A8A",
  navySoft: "#94A3B8",
  amber: "#D97706",
  emerald: "#15803D",
  rose: "#BE123C",
  grid: "#E2E8F0",
  tick: "#475569",
  cursor: "rgba(30,58,138,0.06)",
  tooltipBg: "#020617",
  dual: ["#94A3B8", "#1E3A8A"],
  animationDuration: 600,
};

export const TipBox = ({ active, payload, label, unit = "" }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-sm bg-slate-950 text-white text-xs px-3 py-2 shadow-lg border border-slate-800">
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
