import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Tooltip,
} from "recharts";
import { Panel, CategoryBadge } from "@/components/Primitives";
import ExportMenu from "@/components/ExportMenu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useApi } from "@/lib/api";
import { fmt } from "@/lib/format";
import { CHART, TipBox } from "@/lib/chartTheme";

const AXES = [
  { key: "conviction_score", label: "Conviction" },
  { key: "timeliness_score", label: "60-90 Charge Sheet" },
  { key: "emergency112_score", label: "112" },
  { key: "hsp_score", label: "HSP" },
];

const EXPORT_COLS = [
  { key: "subject", label: "Domain" },
  { key: "score", label: "Score" },
];

function weightLabel(weight) {
  if (weight && typeof weight === "object") {
    const c = Math.round((weight.conviction ?? 0) * 100);
    const t = Math.round((weight.timeliness ?? 0) * 100);
    const e = Math.round((weight.emergency112 ?? 0) * 100);
    const h = Math.round((weight.hsp ?? 0) * 100);
    return `${c}% conviction · ${t}% timeliness · ${e}% 112 · ${h}% HSP`;
  }
  const w = Math.round((weight ?? 0.5) * 100);
  return `${w}% conviction / ${100 - w}% other`;
}

function scoreOrZero(v) {
  return v == null || Number.isNaN(Number(v)) ? 0 : Number(v);
}

export default function CombinedIndex() {
  const api = useApi();
  const [data, setData] = useState(null);
  const [unit, setUnit] = useState("");

  useEffect(() => {
    api("get", "/combined")
      .then((res) => {
        setData(res);
        const ranked = [...(res.rows || [])].sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));
        if (ranked[0]?.unit) setUnit(ranked[0].unit);
      })
      .catch(() => setData({ rows: [], error: true }));
  }, [api]);

  const rows = useMemo(
    () => (data?.rows ? [...data.rows].sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999)) : []),
    [data],
  );

  const selected = useMemo(
    () => rows.find((r) => r.unit === unit) || rows[0] || null,
    [rows, unit],
  );

  const radarData = useMemo(() => {
    if (!selected) return [];
    return AXES.map((a) => ({
      subject: a.label,
      score: scoreOrZero(selected[a.key]),
      fullMark: 100,
    }));
  }, [selected]);

  if (!data) {
    return (
      <div className="flex items-center gap-2 text-slate-500 py-6">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading combined index…
      </div>
    );
  }
  if (data.error) {
    return (
      <div className="text-sm text-rose-700" data-testid="combined-error">
        Combined index is unavailable: conviction, timeliness, 112, training, ANTF, and HSP datasets must all be active.
      </div>
    );
  }

  const label = weightLabel(data.weight);
  const win = data.windows || {};
  const activeUnit = selected?.unit || unit;

  return (
    <Panel
      testId="combined-index-panel"
      title="Combined police performance index"
      subtitle={`${label}${win.conviction ? ` · conviction ${win.conviction.base} → ${win.conviction.latest}` : ""} · policy v${data.policy_version ?? "-"}`}
      right={(
        <ExportMenu
          title={`Combined radar - ${activeUnit}`}
          view="combined-radar"
          columns={EXPORT_COLS}
          rows={radarData.map((d) => ({ subject: d.subject, score: d.score }))}
          context={{ Unit: activeUnit, Weight: label }}
          testId="combined-export"
        />
      )}
    >
      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-5 items-start" data-testid="combined-radar">
        <div className="space-y-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.14em] font-semibold text-slate-500 mb-1.5">Unit</div>
            <Select value={activeUnit} onValueChange={setUnit}>
              <SelectTrigger
                className="h-9 rounded-sm bg-white text-sm border-slate-200 focus:ring-2 focus:ring-teal-600/35"
                data-testid="combined-unit-select"
              >
                <SelectValue placeholder="Select unit" />
              </SelectTrigger>
              <SelectContent className="max-h-72 rounded-sm">
                {rows.map((r) => (
                  <SelectItem key={r.unit} value={r.unit}>
                    {r.rank != null ? `#${r.rank} · ` : ""}{r.unit}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selected && (
            <div className="space-y-3 rounded-sm border border-slate-200 bg-slate-50/70 p-3">
              <div>
                <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Range</div>
                <div className="text-sm text-slate-800 mt-0.5">{selected.range || "—"}</div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Combined</div>
                  <div className="font-num text-xl font-bold text-brand-navy mt-0.5">{fmt(selected.combined_score)}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Rank</div>
                  <div className="font-num text-xl font-bold text-slate-800 mt-0.5">
                    {selected.rank == null ? "—" : `#${selected.rank}`}
                  </div>
                </div>
              </div>
              {selected.category && (
                <div>
                  <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1">Category</div>
                  <CategoryBadge value={selected.category} />
                </div>
              )}
              <div className="space-y-1.5 pt-1 border-t border-slate-200">
                {AXES.map((a) => (
                  <div key={a.key} className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-slate-600 truncate">{a.label}</span>
                    <span className="font-num font-semibold text-slate-900 shrink-0">{fmt(selected[a.key])}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="min-w-0">
          <div className="h-[340px] w-full" data-testid="combined-radar-chart">
            <ResponsiveContainer>
              <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="72%">
                <PolarGrid stroke={CHART.grid} />
                <PolarAngleAxis
                  dataKey="subject"
                  tick={{ fill: CHART.tick, fontSize: 12, fontWeight: 600 }}
                />
                <PolarRadiusAxis
                  angle={90}
                  domain={[0, 100]}
                  tick={{ fill: CHART.tick, fontSize: 10 }}
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
          <p className="text-[11px] text-slate-500 text-center mt-1">
            Scores for Conviction, 60-90 Charge Sheet, 112, and HSP (0–100)
          </p>
        </div>
      </div>
    </Panel>
  );
}
