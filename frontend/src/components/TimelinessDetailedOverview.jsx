import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ReferenceLine,
} from "recharts";
import { Panel, Kpi, Delta, CategoryBadge } from "@/components/Primitives";
import ChartExplainButton from "@/components/ChartExplainButton";
import FilterBar from "@/components/FilterBar";
import { useApi, errMsg } from "@/lib/api";
import { fmt, fmtInt, fmtDate } from "@/lib/format";
import { CHART, TipBox } from "@/lib/chartTheme";
import { resolveOverviewChartExplain } from "@/lib/chartExplain";
import { fadeUp, staggerFast } from "@/lib/motion";

function OverviewChartTitle({ title, explainId, testId }) {
  const explain = resolveOverviewChartExplain(explainId, title);
  return (
    <span className="inline-flex items-center gap-2 min-w-0">
      <span className="min-w-0">{title}</span>
      <ChartExplainButton explain={explain} testId={testId} />
    </span>
  );
}

const EXEC = {
  primary: "#0F3D5E",
  secondary: "#5B7C99",
  tertiary: "#3D5A80",
  within: "#1A6B6B",
  beyond: "#9B2C2C",
  line: "#0F3D5E",
  stateLine: "#1A6B6B",
  lateLine: "#B45309",
  lateState: "#D97706",
  grid: "#E8EEF2",
  tick: "#475569",
  remaining: "#CBD5E1",
};

function shortPeriod(p) {
  if (!p) return "";
  return String(p).replace(/20(\d{2})/, "$1");
}

function summarizeList(selected, allLabel) {
  if (!selected?.length) return allLabel;
  if (selected.length === 1) return selected[0];
  if (selected.length === 2) return `${selected[0]}, ${selected[1]}`;
  return `${selected[0]} +${selected.length - 1}`;
}

function filterParam(v) {
  if (Array.isArray(v)) return v.length ? v.join(",") : "All";
  return v && v !== "All" ? v : "All";
}

const initialFilters = (m) => ({
  type: m.types[m.types.length - 1],
  unit: [],
  base: m.default_base,
  latest: m.default_latest,
  range: [],
  category: "All",
});

export default function TimelinessDetailedOverview() {
  const api = useApi();
  const [meta, setMeta] = useState(null);
  const [f, setF] = useState(null);
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api("get", "/meta", { params: { domain: "timeliness" } })
      .then((m) => {
        setMeta(m);
        setF(initialFilters(m));
      })
      .catch((e) => { setError(errMsg(e)); setLoading(false); });
  }, [api]);

  const load = useCallback(() => {
    if (!f) return;
    setLoading(true);
    setError(null);
    api("get", "/timeliness/detailed", {
      params: {
        unit: filterParam(f.unit),
        type: f.type,
        base: f.base,
        latest: f.latest,
        range: filterParam(f.range),
        category: f.category || "All",
      },
    })
      .then((res) => { setPayload(res); setLoading(false); })
      .catch((e) => { setError(errMsg(e)); setLoading(false); });
  }, [api, f]);

  useEffect(() => { load(); }, [load]);

  if (error) return <div className="text-rose-700 text-sm" data-testid="timeliness-detailed-error">{error}</div>;
  if (!meta || !f) {
    return <div className="flex items-center gap-2 text-slate-500 py-10 justify-center"><Loader2 className="h-5 w-5 animate-spin" />Loading overview…</div>;
  }

  const d = payload?.detailed;
  const mode = d?.selection_mode || (d?.unit === "All" ? "all" : "single");
  const isSingle = mode === "single";
  const isAll = mode === "all";
  const unitSummary = summarizeList(d?.units_selected || [], "All units");
  const rangeSummary = summarizeList(d?.ranges_selected || [], "All ranges");
  const categorySummary = d?.category && d.category !== "All" ? d.category : "All categories";
  const k = d?.kpis || {};
  const trend = (d?.unit_trend || []).map((p) => ({ ...p, label: shortPeriod(p.period) }));
  const trendRates = trend.flatMap((p) => [p.rate, p.state_rate, p.beyond_rate, p.state_beyond_rate]).filter((v) => v != null && !Number.isNaN(v));
  const rateYDomain = (() => {
    if (!trendRates.length) return [0, 100];
    const lo = Math.min(...trendRates);
    const hi = Math.max(...trendRates);
    const yMin = lo >= 20 ? 20 : Math.max(0, Math.floor(lo / 5) * 5 - 5);
    const yMax = Math.max(yMin + 10, Math.ceil(hi / 5) * 5 + 5, 100);
    return [yMin, Math.min(100, yMax)];
  })();
  const comparison = d?.comparison || [];
  const topScores = d?.top_scores || [];
  const scorePoints = d?.score_points || [];
  const rateLineName = isAll ? "All units" : isSingle ? "Selected unit" : "Selected units";
  const rangesSelected = Array.isArray(f.range) ? f.range : [];

  return (
    <motion.section variants={fadeUp} className="space-y-4" data-testid="timeliness-detailed">
      <div>
        <h2 className="font-display text-xl font-semibold text-slate-900 tracking-tight">Unit chargesheet performance</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Maharashtra Police{d?.range ? ` / ${d.range}` : ""} · data as of {fmtDate(payload?.as_of || meta.dataset?.uploaded_at)}
        </p>
      </div>

      <FilterBar
        meta={meta}
        f={f}
        set={setF}
        onReset={() => setF(initialFilters(meta))}
        embedded
        testId="timeliness-detailed-filters"
      />

      <div className="relative">
        {(loading || !d) && (
          <div className="absolute inset-0 z-10 bg-white/60 flex items-center justify-center rounded-sm min-h-[12rem]">
            <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
          </div>
        )}

        {d && (
          <>
            <p className="text-xs text-slate-500 mb-3">
              {unitSummary} · {rangeSummary} · {categorySummary} · {d.type} · {d.base} → {d.latest}
            </p>

            <motion.div variants={staggerFast} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <Kpi
                label="Chargesheeted within time"
                value={`${fmt(k.latest_rate)}%`}
                sub={`Base rate ${fmt(k.base_rate)}%`}
                accent
                tone="latest"
                testId="tim-det-kpi-rate"
                formula={{
                  description: "Latest-period within-time rate vs base-period rate for the current selection.",
                  expression: "(Σ within ÷ Σ registered) × 100",
                  example: `Latest ${fmt(k.latest_rate)}% · Base ${fmt(k.base_rate)}%`,
                }}
              />
              <Kpi
                label="Change in in-time rate"
                value={<Delta value={k.improvement} />}
                sub={k.late_reduction == null ? "—" : `Late-rate reduction ${k.late_reduction >= 0 ? "+" : ""}${fmt(k.late_reduction)} pp`}
                testId="tim-det-kpi-change"
                formula={{
                  description: "Within-time rate change (pp). Subtitle is the reduction in beyond-time rate (positive when late rate falls).",
                  expression: "Latest − Base · Late reduction = −(latest beyond rate − base beyond rate)",
                  example: `${fmt(k.latest_rate)}% − ${fmt(k.base_rate)}%`,
                }}
              />
              <Kpi
                label="Registered cases"
                value={fmtInt(k.latest_registered)}
                sub={`In time ${fmtInt(k.latest_within)}, late ${fmtInt(k.latest_beyond)}`}
                tone="latest"
                testId="tim-det-kpi-registered"
                formula={{
                  description: "Latest-period registered cases with within-time and beyond-time counts in the subtitle.",
                  expression: "Σ registered · Σ within · Σ beyond",
                  example: `${fmtInt(k.latest_registered)} · within ${fmtInt(k.latest_within)} · late ${fmtInt(k.latest_beyond)}`,
                }}
              />
              <Kpi
                label="Statewide overall rank"
                value={k.rank ?? "—"}
                sub={
                  <span className="inline-flex items-center gap-2">
                    {k.category ? <CategoryBadge value={k.category} /> : null}
                    <span>{isSingle ? `${fmt(k.overall_score)} / 100` : "N/A for multiple units"}</span>
                  </span>
                }
                testId="tim-det-kpi-rank"
                formula={{
                  description: isSingle
                    ? "Rank of the unit’s overall score among all units for the selected deadline and periods (1 = best)."
                    : "Rank applies to a single unit. Select exactly one police unit to see overall score and rank.",
                  expression: "Overall = (perf weight × performance) + (improvement weight × improvement score)",
                  example: isSingle ? `Rank #${k.rank ?? "—"} · score ${fmt(k.overall_score)}` : "Select one unit to score",
                }}
              />
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
              <Panel
                title={
                  <OverviewChartTitle
                    title={isAll ? "Statewide in-time rates" : "Unit and statewide in-time rates"}
                    explainId="rates"
                    testId="tim-det-chart-rates-info"
                  />
                }
                subtitle={isAll ? "All half-years across all units" : "All half-years for the current selection"}
                testId="tim-det-chart-rates"
              >
                <div className="h-56">
                  <ResponsiveContainer>
                    <LineChart data={trend} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                      <CartesianGrid stroke={EXEC.grid} strokeDasharray="3 3" />
                      <XAxis dataKey="label" tick={{ fill: EXEC.tick, fontSize: 11 }} />
                      <YAxis tick={{ fill: EXEC.tick, fontSize: 11 }} unit="%" width={42} domain={rateYDomain} />
                      <Tooltip content={<TipBox unit="%" />} />
                      <Legend />
                      <Line type="monotone" dataKey="rate" name={rateLineName} stroke={EXEC.line} strokeWidth={2.5} dot={{ r: 4, fill: "#fff", stroke: EXEC.line, strokeWidth: 2 }} connectNulls isAnimationActive animationDuration={CHART.animationDuration} />
                      {!isAll && (
                        <Line type="monotone" dataKey="state_rate" name="Statewide" stroke={EXEC.stateLine} strokeWidth={2} strokeDasharray="5 4" dot={{ r: 3 }} connectNulls isAnimationActive animationDuration={CHART.animationDuration} />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Panel>

              <Panel
                title={
                  <OverviewChartTitle
                    title={isAll ? "Statewide registered cases and chargesheets" : "Unit registered cases and chargesheets"}
                    explainId="volumes"
                    testId="tim-det-chart-volumes-info"
                  />
                }
                subtitle="Registered, within-time, and beyond-time counts"
                testId="tim-det-chart-volumes"
              >
                <div className="h-56">
                  <ResponsiveContainer>
                    <BarChart data={trend} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                      <CartesianGrid stroke={EXEC.grid} strokeDasharray="3 3" />
                      <XAxis dataKey="label" tick={{ fill: EXEC.tick, fontSize: 11 }} />
                      <YAxis tick={{ fill: EXEC.tick, fontSize: 11 }} width={48} />
                      <Tooltip content={<TipBox />} />
                      <Legend />
                      <Bar dataKey="registered" name="Registered" fill={EXEC.tertiary} radius={[2, 2, 0, 0]} isAnimationActive animationDuration={CHART.animationDuration} />
                      <Bar dataKey="within" name="Within time" fill={EXEC.within} radius={[2, 2, 0, 0]} isAnimationActive animationDuration={CHART.animationDuration} />
                      <Bar dataKey="beyond" name="Beyond time" fill={EXEC.beyond} radius={[2, 2, 0, 0]} isAnimationActive animationDuration={CHART.animationDuration} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Panel>

              <Panel
                title={
                  <OverviewChartTitle
                    title={isAll ? "Statewide beyond-time rates" : "Unit and statewide beyond-time rates"}
                    explainId="beyond"
                    testId="tim-det-chart-beyond-info"
                  />
                }
                subtitle="Late-rate charts use beyond-time ÷ registered"
                testId="tim-det-chart-beyond"
              >
                <div className="h-56">
                  <ResponsiveContainer>
                    <LineChart data={trend} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                      <CartesianGrid stroke={EXEC.grid} strokeDasharray="3 3" />
                      <XAxis dataKey="label" tick={{ fill: EXEC.tick, fontSize: 11 }} />
                      <YAxis tick={{ fill: EXEC.tick, fontSize: 11 }} unit="%" width={42} domain={rateYDomain} />
                      <Tooltip content={<TipBox unit="%" />} />
                      <Legend />
                      <Line type="monotone" dataKey="beyond_rate" name={rateLineName} stroke={EXEC.lateLine} strokeWidth={2.5} dot={{ r: 4, fill: "#fff", stroke: EXEC.lateLine, strokeWidth: 2 }} connectNulls isAnimationActive animationDuration={CHART.animationDuration} />
                      {!isAll && (
                        <Line type="monotone" dataKey="state_beyond_rate" name="Statewide" stroke={EXEC.lateState} strokeWidth={2} strokeDasharray="5 4" dot={{ r: 3 }} connectNulls isAnimationActive animationDuration={CHART.animationDuration} />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Panel>

              <Panel
                title={
                  <OverviewChartTitle
                    title="Unit, range and statewide in-time rates"
                    explainId="comparison"
                    testId="tim-det-chart-comparison-info"
                  />
                }
                subtitle="Base vs latest for the current selection"
                testId="tim-det-chart-comparison"
              >
                <div className="h-56">
                  <ResponsiveContainer>
                    <BarChart data={comparison} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                      <CartesianGrid stroke={EXEC.grid} strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" tick={{ fill: EXEC.tick, fontSize: 11 }} unit="%" />
                      <YAxis type="category" dataKey="label" width={110} tick={{ fill: EXEC.tick, fontSize: 10 }} />
                      <Tooltip content={<TipBox unit="%" />} />
                      <Legend />
                      <Bar dataKey="base_rate" name="Base" fill={EXEC.secondary} radius={[0, 2, 2, 0]} isAnimationActive animationDuration={CHART.animationDuration} />
                      <Bar dataKey="latest_rate" name="Latest" fill={EXEC.primary} radius={[0, 2, 2, 0]} isAnimationActive animationDuration={CHART.animationDuration} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Panel>

              <Panel
                title={
                  <OverviewChartTitle
                    title="Highest overall scores in the selected range"
                    explainId="topscores"
                    testId="tim-det-chart-topscores-info"
                  />
                }
                subtitle={!rangesSelected.length ? "Top 5 units statewide" : `Top 5 units in ${rangeSummary}`}
                testId="tim-det-chart-topscores"
              >
                <div className="h-56">
                  <ResponsiveContainer>
                    <BarChart data={topScores} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                      <CartesianGrid stroke={EXEC.grid} strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" tick={{ fill: EXEC.tick, fontSize: 11 }} domain={[0, 100]} />
                      <YAxis type="category" dataKey="label" width={140} tick={{ fill: EXEC.tick, fontSize: 10 }} />
                      <Tooltip content={<TipBox />} />
                      <Bar dataKey="overall_score" name="Overall score" fill={EXEC.primary} radius={[0, 2, 2, 0]} isAnimationActive animationDuration={CHART.animationDuration} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Panel>

              <Panel
                title={
                  <OverviewChartTitle
                    title="Points earned toward the overall score"
                    explainId="points"
                    testId="tim-det-chart-points-info"
                  />
                }
                subtitle={isSingle ? "Performance and improvement contributions" : "Select exactly one unit to see score contributions"}
                testId="tim-det-chart-points"
              >
                <div className="h-56">
                  {!isSingle ? (
                    <div className="h-full flex items-center justify-center text-sm text-slate-500 px-6 text-center">
                      Overall score points are unit-specific. Choose a single unit to view earned vs remaining points.
                    </div>
                  ) : (
                    <ResponsiveContainer>
                      <BarChart data={scorePoints} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                        <CartesianGrid stroke={EXEC.grid} strokeDasharray="3 3" />
                        <XAxis dataKey="component" tick={{ fill: EXEC.tick, fontSize: 10 }} interval={0} />
                        <YAxis tick={{ fill: EXEC.tick, fontSize: 11 }} width={42} />
                        <Tooltip content={<TipBox />} />
                        <Legend />
                        <ReferenceLine y={0} stroke={EXEC.tick} />
                        <Bar dataKey="earned" name="Earned points" stackId="a" fill={EXEC.within} radius={[0, 0, 0, 0]} isAnimationActive animationDuration={CHART.animationDuration} />
                        <Bar dataKey="remaining" name="Remaining points" stackId="a" fill={EXEC.remaining} radius={[2, 2, 0, 0]} isAnimationActive animationDuration={CHART.animationDuration} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
                {isSingle && (
                  <p className="text-[11px] text-slate-500 mt-2">
                    Total earned points {fmt(k.overall_score)} / 100
                  </p>
                )}
              </Panel>
            </div>
          </>
        )}
      </div>
    </motion.section>
  );
}
