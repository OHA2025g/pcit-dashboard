import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ReferenceLine,
} from "recharts";
import { Panel, Kpi, CategoryBadge } from "@/components/Primitives";
import ChartExplainButton from "@/components/ChartExplainButton";
import FilterBar from "@/components/FilterBar";
import { useApi, errMsg } from "@/lib/api";
import { fmt, fmtInt, fmtDate, fmtDuration } from "@/lib/format";
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
  responded: "#1A6B6B",
  line: "#0F3D5E",
  stateLine: "#1A6B6B",
  closure: "#0F766E",
  closureState: "#14B8A6",
  co: "#0F3D5E",
  do: "#5B7C99",
  mdt: "#1A6B6B",
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
  period_grain: "monthly",
});

export default function Emergency112DetailedOverview() {
  const api = useApi();
  const [meta, setMeta] = useState(null);
  const [f, setF] = useState(null);
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api("get", "/meta", { params: { domain: "emergency112" } })
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
    api("get", "/emergency112/detailed", {
      params: {
        unit: filterParam(f.unit),
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

  if (error) return <div className="text-rose-700 text-sm" data-testid="112-detailed-error">{error}</div>;
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
  const components = d?.component_periods || [];
  const topScores = d?.top_scores || [];
  const scorePoints = d?.score_points || [];
  const rateLineName = isAll ? "All units" : isSingle ? "Selected unit" : "Selected units";

  return (
    <motion.section variants={fadeUp} className="space-y-4" data-testid="112-detailed">
      <div>
        <h2 className="font-display text-xl font-semibold text-slate-900 tracking-tight">112 unit performance</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Maharashtra Police{d?.range ? ` / ${d.range}` : ""} · data as of {fmtDate(payload?.as_of || meta.dataset?.uploaded_at)}
        </p>
      </div>

      <FilterBar
        meta={{ ...meta, period_grain_options: undefined, period_grains: undefined }}
        f={f}
        set={setF}
        onReset={() => setF(initialFilters(meta))}
        embedded
        testId="112-detailed-filters"
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
              {unitSummary} · {rangeSummary} · {categorySummary} · {d.base} → {d.latest}
            </p>

            <motion.div variants={staggerFast} initial="hidden" animate="show" className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Kpi
                label="Average response time"
                value={fmtDuration(k.latest_mean_sec)}
                sub={`Base time ${fmtDuration(k.base_mean_sec)}`}
                accent
                tone="latest"
                testId="112-det-kpi-time"
                formula={{
                  description: isAll
                    ? "Unweighted mean of unit response times for the latest month."
                    : "Average response time for the current selection in the latest month.",
                  expression: "Avg(total response time)",
                  example: `Latest ${fmtDuration(k.latest_mean_sec)} · Base ${fmtDuration(k.base_mean_sec)}`,
                }}
              />
              <Kpi
                label="Call response rate"
                value={`${fmt(k.latest_response_rate)}%`}
                sub={`${fmtInt(k.latest_responded)} of ${fmtInt(k.latest_actionable)} calls`}
                testId="112-det-kpi-response"
                formula={{
                  description: "Responded calls ÷ actionable calls × 100 for the latest month.",
                  expression: "(Σ responded ÷ Σ actionable) × 100",
                  example: `(${fmtInt(k.latest_responded)} ÷ ${fmtInt(k.latest_actionable)}) × 100`,
                }}
              />
              <Kpi
                label="Closures within 100m"
                value={`${fmt(k.latest_closure_rate)}%`}
                sub={`${fmtInt(k.latest_closed_100m)} events closed within 100m`}
                testId="112-det-kpi-closure"
                formula={{
                  description: "Events closed within 100m ÷ actionable calls × 100.",
                  expression: "(Σ closed ≤100m ÷ Σ actionable) × 100",
                  example: `${fmt(k.latest_closure_rate)}% · ${fmtInt(k.latest_closed_100m)} events`,
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
                testId="112-det-kpi-rank"
                formula={{
                  description: isSingle
                    ? "Rank of the unit’s overall 112 score (1 = best)."
                    : "Rank applies to a single unit. Select exactly one police unit.",
                  expression: "Overall = 70% period performance + 30% improvement",
                  example: isSingle ? `Rank #${k.rank ?? "—"} · score ${fmt(k.overall_score)}` : "Select one unit",
                }}
              />
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
              <Panel
                title={
                  <OverviewChartTitle
                    title={isAll ? "Statewide response time (minutes)" : "Unit and statewide response time (minutes)"}
                    explainId="rates"
                    testId="112-det-chart-time-info"
                  />
                }
                subtitle="Monthly averages"
                testId="112-det-chart-time"
              >
                <div className="h-56">
                  <ResponsiveContainer>
                    <LineChart data={trend} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                      <CartesianGrid stroke={EXEC.grid} strokeDasharray="3 3" />
                      <XAxis dataKey="label" tick={{ fill: EXEC.tick, fontSize: 11 }} />
                      <YAxis tick={{ fill: EXEC.tick, fontSize: 11 }} width={42} />
                      <Tooltip content={<TipBox unit=" min" />} />
                      <Legend />
                      <Line type="monotone" dataKey="mean_minutes" name={rateLineName} stroke={EXEC.line} strokeWidth={2.5} dot={{ r: 4, fill: "#fff", stroke: EXEC.line, strokeWidth: 2 }} connectNulls isAnimationActive animationDuration={CHART.animationDuration} />
                      {!isAll && (
                        <Line type="monotone" dataKey="state_minutes" name="Statewide" stroke={EXEC.stateLine} strokeWidth={2} strokeDasharray="5 4" dot={{ r: 3 }} connectNulls isAnimationActive animationDuration={CHART.animationDuration} />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Panel>

              <Panel
                title={
                  <OverviewChartTitle
                    title={isAll ? "Statewide call volumes by month" : "Unit call volumes by month"}
                    explainId="volumes"
                    testId="112-det-chart-volumes-info"
                  />
                }
                subtitle="Actionable and responded counts"
                testId="112-det-chart-volumes"
              >
                <div className="h-56">
                  <ResponsiveContainer>
                    <BarChart data={trend} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                      <CartesianGrid stroke={EXEC.grid} strokeDasharray="3 3" />
                      <XAxis dataKey="label" tick={{ fill: EXEC.tick, fontSize: 11 }} />
                      <YAxis tick={{ fill: EXEC.tick, fontSize: 11 }} width={48} />
                      <Tooltip content={<TipBox />} />
                      <Legend />
                      <Bar dataKey="actionable" name="Actionable" fill={EXEC.tertiary} radius={[2, 2, 0, 0]} isAnimationActive animationDuration={CHART.animationDuration} />
                      <Bar dataKey="responded" name="Responded" fill={EXEC.responded} radius={[2, 2, 0, 0]} isAnimationActive animationDuration={CHART.animationDuration} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Panel>

              <Panel
                title={
                  <OverviewChartTitle
                    title="Response components by period (minutes)"
                    explainId="comparison"
                    testId="112-det-chart-components-info"
                  />
                }
                subtitle="CO, DO and MDT averages for base and latest"
                testId="112-det-chart-components"
              >
                <div className="h-56">
                  <ResponsiveContainer>
                    <BarChart data={components} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                      <CartesianGrid stroke={EXEC.grid} strokeDasharray="3 3" />
                      <XAxis dataKey="period" tick={{ fill: EXEC.tick, fontSize: 11 }} />
                      <YAxis tick={{ fill: EXEC.tick, fontSize: 11 }} width={42} />
                      <Tooltip content={<TipBox unit=" min" />} />
                      <Legend />
                      <Bar dataKey="co_minutes" name="CO" fill={EXEC.co} radius={[2, 2, 0, 0]} isAnimationActive animationDuration={CHART.animationDuration} />
                      <Bar dataKey="do_minutes" name="DO" fill={EXEC.do} radius={[2, 2, 0, 0]} isAnimationActive animationDuration={CHART.animationDuration} />
                      <Bar dataKey="mdt_minutes" name="MDT" fill={EXEC.mdt} radius={[2, 2, 0, 0]} isAnimationActive animationDuration={CHART.animationDuration} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-[11px] text-slate-500 mt-2">Components use the CO, DO and MDT times recorded in the source.</p>
              </Panel>

              <Panel
                title={
                  <OverviewChartTitle
                    title={isAll ? "Statewide closures within 100m by month" : "Closures within 100m by month"}
                    explainId="beyond"
                    testId="112-det-chart-closure-info"
                  />
                }
                subtitle="Closed ≤100m ÷ actionable"
                testId="112-det-chart-closure"
              >
                <div className="h-56">
                  <ResponsiveContainer>
                    <LineChart data={trend} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                      <CartesianGrid stroke={EXEC.grid} strokeDasharray="3 3" />
                      <XAxis dataKey="label" tick={{ fill: EXEC.tick, fontSize: 11 }} />
                      <YAxis tick={{ fill: EXEC.tick, fontSize: 11 }} unit="%" width={42} />
                      <Tooltip content={<TipBox unit="%" />} />
                      <Legend />
                      <Line type="monotone" dataKey="closure_rate" name={rateLineName} stroke={EXEC.closure} strokeWidth={2.5} dot={{ r: 4, fill: "#fff", stroke: EXEC.closure, strokeWidth: 2 }} connectNulls isAnimationActive animationDuration={CHART.animationDuration} />
                      {!isAll && (
                        <Line type="monotone" dataKey="state_closure_rate" name="Statewide" stroke={EXEC.closureState} strokeWidth={2} strokeDasharray="5 4" dot={{ r: 3 }} connectNulls isAnimationActive animationDuration={CHART.animationDuration} />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Panel>

              <Panel
                title={
                  <OverviewChartTitle
                    title="Highest scores in the selected category"
                    explainId="topscores"
                    testId="112-det-chart-topscores-info"
                  />
                }
                subtitle={categorySummary === "All categories" ? "Top 5 units statewide" : `Top 5 in ${categorySummary}`}
                testId="112-det-chart-topscores"
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
                    testId="112-det-chart-points-info"
                  />
                }
                subtitle={isSingle ? "Performance and improvement contributions" : "Select exactly one unit to see score contributions"}
                testId="112-det-chart-points"
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
                        <XAxis dataKey="component" tick={{ fill: EXEC.tick, fontSize: 9 }} interval={0} />
                        <YAxis tick={{ fill: EXEC.tick, fontSize: 11 }} width={42} />
                        <Tooltip content={<TipBox />} />
                        <Legend />
                        <ReferenceLine y={0} stroke={EXEC.tick} />
                        <Bar dataKey="earned" name="Earned points" stackId="a" fill={EXEC.responded} isAnimationActive animationDuration={CHART.animationDuration} />
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
