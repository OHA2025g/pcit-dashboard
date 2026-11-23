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
  convicted: "#1A6B6B",
  gain: "#2D6A4F",
  decline: "#9B2C2C",
  line: "#0F3D5E",
  stateLine: "#1A6B6B",
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

export default function ConvictionDetailedOverview() {
  const api = useApi();
  const [meta, setMeta] = useState(null);
  const [f, setF] = useState(null);
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api("get", "/meta", { params: { domain: "conviction" } })
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
    api("get", "/conviction/detailed", {
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

  if (error) return <div className="text-rose-700 text-sm" data-testid="conviction-detailed-error">{error}</div>;
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
  const trendRates = trend.flatMap((p) => [p.rate, p.state_rate]).filter((v) => v != null && !Number.isNaN(v));
  const rateYDomain = (() => {
    if (!trendRates.length) return [0, 100];
    const lo = Math.min(...trendRates);
    const hi = Math.max(...trendRates);
    const yMin = lo >= 20 ? 20 : Math.max(0, Math.floor(lo / 5) * 5 - 5);
    const yMax = Math.max(yMin + 10, Math.ceil(hi / 5) * 5 + 5);
    return [yMin, yMax];
  })();
  const comparison = d?.comparison || [];
  const topScores = d?.top_scores || [];
  const courtRates = d?.court_rates || [];
  const scorePoints = d?.score_points || [];
  const rateLineName = isAll ? "All units" : isSingle ? "Selected unit" : "Selected units";
  const rangesSelected = Array.isArray(f.range) ? f.range : [];

  return (
    <motion.section variants={fadeUp} className="space-y-4" data-testid="conviction-detailed">
      <div>
        <h2 className="font-display text-xl font-semibold text-slate-900 tracking-tight">Unit conviction review</h2>
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
        singleSelectUnitRange
        testId="conviction-detailed-filters"
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

            <motion.div variants={staggerFast} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
              <Kpi
                label="Trial cases"
                value={fmtInt(k.latest_trials)}
                sub={`Base period ${fmtInt(k.base_trials)}`}
                tone="latest"
                testId="ov-det-kpi-trials"
                formula={{
                  description: "Latest-period trial cases (large) vs base-period trial cases (subtitle) for the current selection.",
                  expression: "Latest Σ trial · Base Σ trial",
                  example: `Latest ${fmtInt(k.latest_trials)} · Base ${fmtInt(k.base_trials)}`,
                }}
              />
              <Kpi
                label="Convicted cases"
                value={fmtInt(k.latest_convicted)}
                sub={`Base period ${fmtInt(k.base_convicted)}`}
                tone="latest"
                testId="ov-det-kpi-convicted"
                formula={{
                  description: "Latest-period convicted cases (large) vs base-period convicted cases (subtitle) for the current selection.",
                  expression: "Latest Σ convicted · Base Σ convicted",
                  example: `Latest ${fmtInt(k.latest_convicted)} · Base ${fmtInt(k.base_convicted)}`,
                }}
              />
              <Kpi
                label={isAll ? "Statewide conviction rate" : isSingle ? "Unit conviction rate" : "Selection conviction rate"}
                value={`${fmt(k.latest_rate)}%`}
                sub={`Base period ${fmt(k.base_rate)}%`}
                accent
                tone="latest"
                testId="ov-det-kpi-rate"
                formula={{
                  description: "Latest-period conviction rate (large) vs base-period rate (subtitle). Rate = convicted ÷ trial × 100.",
                  expression: "Latest (Convicted ÷ Trial) × 100 · Base (Convicted ÷ Trial) × 100",
                  example: `Latest ${fmt(k.latest_rate)}% (${fmtInt(k.latest_convicted)} ÷ ${fmtInt(k.latest_trials)}) · Base ${fmt(k.base_rate)}% (${fmtInt(k.base_convicted)} ÷ ${fmtInt(k.base_trials)})`,
                }}
              />
              <Kpi
                label="Change in conviction rate"
                value={<Delta value={k.improvement} />}
                sub={isAll
                  ? "Statewide change vs base"
                  : `Gap to state ${k.gap_to_state == null ? "—" : `${k.gap_to_state >= 0 ? "+" : ""}${fmt(k.gap_to_state)} pp`}`}
                testId="ov-det-kpi-change"
                formula={{
                  description: isAll
                    ? "Statewide latest rate minus base rate. pp = percentage points: the absolute difference between two rates (not a percent-of-percent change). Example: 50% → 46.8% is −3.20 pp."
                    : "Selection latest rate minus base rate. Subtitle is selection latest minus statewide latest. pp = percentage points: the absolute difference between two rates (not a percent-of-percent change).",
                  expression: isAll ? "Latest − Base" : "Latest − Base · Gap = Selection − State",
                  example: `${fmt(k.latest_rate)}% − ${fmt(k.base_rate)}%`,
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
                testId="ov-det-kpi-rank"
                formula={{
                  description: isSingle
                    ? "Rank of the unit’s overall score among all units for the selected case type and periods (1 = best)."
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
                    title={isAll ? "Statewide conviction rate" : "Unit and statewide conviction rates"}
                    explainId="rates"
                    testId="ov-det-chart-rates-info"
                  />
                }
                subtitle={isAll ? "All half-years across all units" : "All half-years for the current selection"}
                testId="ov-det-chart-rates"
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
                    title={isAll ? "Statewide case volumes" : isSingle ? "Unit case volumes" : "Selection case volumes"}
                    explainId="volumes"
                    testId="ov-det-chart-volumes-info"
                  />
                }
                subtitle="Trial and convicted counts by half-year"
                testId="ov-det-chart-volumes"
              >
                <div className="h-56">
                  <ResponsiveContainer>
                    <BarChart data={trend} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                      <CartesianGrid stroke={EXEC.grid} strokeDasharray="3 3" />
                      <XAxis dataKey="label" tick={{ fill: EXEC.tick, fontSize: 11 }} />
                      <YAxis tick={{ fill: EXEC.tick, fontSize: 11 }} width={48} />
                      <Tooltip content={<TipBox />} />
                      <Legend />
                      <Bar dataKey="trials" name="Trial cases" fill={EXEC.tertiary} radius={[2, 2, 0, 0]} isAnimationActive animationDuration={CHART.animationDuration} />
                      <Bar dataKey="convicted" name="Convicted cases" fill={EXEC.convicted} radius={[2, 2, 0, 0]} isAnimationActive animationDuration={CHART.animationDuration} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Panel>

              <Panel
                title={
                  <OverviewChartTitle
                    title="Unit, range and statewide conviction rates"
                    explainId="comparison"
                    testId="ov-det-chart-comparison-info"
                  />
                }
                subtitle="Base vs latest for the current selection"
                testId="ov-det-chart-comparison"
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
                <p className="text-[11px] text-slate-500 mt-2">Comparisons use the same case type and period selections.</p>
              </Panel>

              <Panel
                title={
                  <OverviewChartTitle
                    title="Highest overall scores in the selected range"
                    explainId="topscores"
                    testId="ov-det-chart-topscores-info"
                  />
                }
                subtitle={!rangesSelected.length ? "Top 5 units statewide" : `Top 5 units in ${rangeSummary}`}
                testId="ov-det-chart-topscores"
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
                <p className="text-[11px] text-slate-500 mt-2">Showing {topScores.length} ranked units{!rangesSelected.length ? " in all ranges" : ""}.</p>
              </Panel>

              <Panel
                title={
                  <OverviewChartTitle
                    title={isAll ? "Statewide conviction rates by Type" : "Conviction rates by Type"}
                    explainId="courts"
                    testId="ov-det-chart-courts-info"
                  />
                }
                subtitle={isAll ? "JMFC and Session across all units" : "JMFC and Session for the current selection"}
                testId="ov-det-chart-courts"
              >
                <div className="h-56">
                  <ResponsiveContainer>
                    <BarChart data={courtRates} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                      <CartesianGrid stroke={EXEC.grid} strokeDasharray="3 3" />
                      <XAxis dataKey="type" tick={{ fill: EXEC.tick, fontSize: 11 }} />
                      <YAxis tick={{ fill: EXEC.tick, fontSize: 11 }} unit="%" width={42} />
                      <Tooltip content={<TipBox unit="%" />} />
                      <Legend />
                      <Bar dataKey="base_rate" name="Base" fill={EXEC.secondary} radius={[2, 2, 0, 0]} isAnimationActive animationDuration={CHART.animationDuration} />
                      <Bar dataKey="latest_rate" name="Latest" fill={EXEC.primary} radius={[2, 2, 0, 0]} isAnimationActive animationDuration={CHART.animationDuration} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-[11px] text-slate-500 mt-2">
                  Latest trials{(d.court_rates || []).map((c) => ` · ${c.type} ${fmtInt(c.latest_trials)}`).join("") || " —"}
                </p>
              </Panel>

              <Panel
                title={
                  <OverviewChartTitle
                    title="Points earned toward the overall score"
                    explainId="points"
                    testId="ov-det-chart-points-info"
                  />
                }
                subtitle={isSingle ? "Performance and improvement contributions" : "Select exactly one unit to see score contributions"}
                testId="ov-det-chart-points"
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
                        <Bar dataKey="earned" name="Earned points" stackId="a" fill={EXEC.convicted} radius={[0, 0, 0, 0]} isAnimationActive animationDuration={CHART.animationDuration} />
                        <Bar dataKey="remaining" name="Remaining points" stackId="a" fill={EXEC.remaining} radius={[2, 2, 0, 0]} isAnimationActive animationDuration={CHART.animationDuration} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
                {isSingle && (
                  <p className="text-[11px] text-slate-500 mt-2">
                    {fmt(scorePoints[0]?.earned)} relative-rate points + {fmt(scorePoints[1]?.earned)} improvement points = {fmt(k.overall_score)} / 100
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
