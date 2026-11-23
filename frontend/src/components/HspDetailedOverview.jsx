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
  accidents: "#3D5A80",
  killed: "#9B2C2C",
  injured: "#B45309",
  line: "#0F3D5E",
  unit: "#1A6B6B",
  state: "#94A3B8",
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

function pctVsBase(change) {
  if (change == null || Number.isNaN(change)) return "—";
  const abs = Math.abs(change);
  if (change < 0) return `${fmt(abs, 1)}% lower than base`;
  if (change > 0) return `${fmt(abs, 1)}% higher than base`;
  return "Same as base";
}

const initialFilters = (m) => ({
  type: m.types[m.types.length - 1],
  unit: [],
  base: m.default_base,
  latest: m.default_latest,
  range: [],
  category: "All",
});

export default function HspDetailedOverview() {
  const api = useApi();
  const [meta, setMeta] = useState(null);
  const [f, setF] = useState(null);
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api("get", "/meta", { params: { domain: "hsp" } })
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
    api("get", "/hsp/detailed", {
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

  if (error) return <div className="text-rose-700 text-sm" data-testid="hsp-detailed-error">{error}</div>;
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
  const outcomes = d?.outcomes || [];
  const reductions = d?.reductions || [];
  const topScores = d?.top_scores || [];
  const scorePoints = d?.score_points || [];
  const lineName = isAll ? "All units" : isSingle ? "Selected unit" : "Selected units";

  return (
    <motion.section variants={fadeUp} className="space-y-4" data-testid="hsp-detailed">
      <div>
        <h2 className="font-display text-xl font-semibold text-slate-900 tracking-tight">HSP unit performance</h2>
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
        testId="hsp-detailed-filters"
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

            <motion.div variants={staggerFast} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <Kpi
                label="Total accidents"
                value={fmtInt(k.latest_accidents)}
                sub={pctVsBase(k.accidents_pct_change)}
                accent
                tone="latest"
                testId="hsp-det-kpi-accidents"
              />
              <Kpi
                label="Fatalities"
                value={fmtInt(k.latest_killed)}
                sub={pctVsBase(k.killed_pct_change)}
                testId="hsp-det-kpi-killed"
              />
              <Kpi
                label="People injured"
                value={fmtInt(k.latest_injured)}
                sub={pctVsBase(k.injured_pct_change)}
                testId="hsp-det-kpi-injured"
              />
              <Kpi
                label="Fatalities per 100 accidents"
                value={fmt(k.fatality_per_100, 1)}
                sub="Fatalities / accidents × 100"
                testId="hsp-det-kpi-severity"
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
                testId="hsp-det-kpi-rank"
              />
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
              <Panel
                title={<OverviewChartTitle title={isAll ? "Statewide accidents by quarter" : "Unit accidents by quarter"} explainId="volumes" testId="hsp-det-chart-accidents-info" />}
                subtitle="Quarterly accident counts"
                testId="hsp-det-chart-accidents"
              >
                <div className="h-56">
                  <ResponsiveContainer>
                    <LineChart data={trend} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                      <CartesianGrid stroke={EXEC.grid} strokeDasharray="3 3" />
                      <XAxis dataKey="label" tick={{ fill: EXEC.tick, fontSize: 11 }} />
                      <YAxis tick={{ fill: EXEC.tick, fontSize: 11 }} width={48} />
                      <Tooltip content={<TipBox />} />
                      <Line type="monotone" dataKey="accidents" name={lineName} stroke={EXEC.accidents} strokeWidth={2.5} dot={{ r: 4, fill: "#fff", stroke: EXEC.accidents, strokeWidth: 2 }} connectNulls isAnimationActive animationDuration={CHART.animationDuration} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Panel>

              <Panel
                title={<OverviewChartTitle title={isAll ? "Statewide fatalities and injured" : "Unit fatalities and people injured"} explainId="rates" testId="hsp-det-chart-outcomes-info" />}
                subtitle="Quarterly counts"
                testId="hsp-det-chart-outcomes"
              >
                <div className="h-56">
                  <ResponsiveContainer>
                    <LineChart data={trend} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                      <CartesianGrid stroke={EXEC.grid} strokeDasharray="3 3" />
                      <XAxis dataKey="label" tick={{ fill: EXEC.tick, fontSize: 11 }} />
                      <YAxis tick={{ fill: EXEC.tick, fontSize: 11 }} width={48} />
                      <Tooltip content={<TipBox />} />
                      <Legend />
                      <Line type="monotone" dataKey="killed" name="Fatalities" stroke={EXEC.killed} strokeWidth={2.5} dot={{ r: 3 }} connectNulls isAnimationActive animationDuration={CHART.animationDuration} />
                      <Line type="monotone" dataKey="injured" name="People injured" stroke={EXEC.injured} strokeWidth={2} dot={{ r: 3 }} connectNulls isAnimationActive animationDuration={CHART.animationDuration} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Panel>

              <Panel
                title={<OverviewChartTitle title="Unit outcomes in the selected quarters" explainId="comparison" testId="hsp-det-chart-compare-info" />}
                subtitle="Base vs latest counts"
                testId="hsp-det-chart-compare"
              >
                <div className="h-56">
                  <ResponsiveContainer>
                    <BarChart data={outcomes} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                      <CartesianGrid stroke={EXEC.grid} strokeDasharray="3 3" />
                      <XAxis dataKey="outcome" tick={{ fill: EXEC.tick, fontSize: 11 }} />
                      <YAxis tick={{ fill: EXEC.tick, fontSize: 11 }} width={48} />
                      <Tooltip content={<TipBox />} />
                      <Legend />
                      <Bar dataKey="base" name="Base" fill={EXEC.secondary} radius={[2, 2, 0, 0]} isAnimationActive animationDuration={CHART.animationDuration} />
                      <Bar dataKey="latest" name="Latest" fill={EXEC.primary} radius={[2, 2, 0, 0]} isAnimationActive animationDuration={CHART.animationDuration} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-[11px] text-slate-500 mt-2">Counts compare the selected base and latest quarters.</p>
              </Panel>

              <Panel
                title={<OverviewChartTitle title="Reductions from base quarter (%)" explainId="beyond" testId="hsp-det-chart-reductions-info" />}
                subtitle="Positive percentages indicate reductions"
                testId="hsp-det-chart-reductions"
              >
                <div className="h-56">
                  <ResponsiveContainer>
                    <BarChart data={reductions} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                      <CartesianGrid stroke={EXEC.grid} strokeDasharray="3 3" />
                      <XAxis dataKey="outcome" tick={{ fill: EXEC.tick, fontSize: 11 }} />
                      <YAxis tick={{ fill: EXEC.tick, fontSize: 11 }} unit="%" width={42} />
                      <Tooltip content={<TipBox unit="%" />} />
                      <Legend />
                      <ReferenceLine y={0} stroke={EXEC.tick} />
                      <Bar dataKey="unit" name={isAll ? "Statewide" : lineName} fill={EXEC.unit} radius={[2, 2, 0, 0]} isAnimationActive animationDuration={CHART.animationDuration} />
                      {!isAll && (
                        <Bar dataKey="statewide" name="Statewide" fill={EXEC.state} radius={[2, 2, 0, 0]} isAnimationActive animationDuration={CHART.animationDuration} />
                      )}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Panel>

              <Panel
                title={<OverviewChartTitle title="Highest scores in the selected category" explainId="topscores" testId="hsp-det-chart-topscores-info" />}
                subtitle={categorySummary === "All categories" ? "Top 5 units statewide" : `Top 5 in ${categorySummary}`}
                testId="hsp-det-chart-topscores"
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
                title={<OverviewChartTitle title="Points earned toward the overall score" explainId="points" testId="hsp-det-chart-points-info" />}
                subtitle={isSingle ? "Performance and reduction contributions" : "Select exactly one unit to see score contributions"}
                testId="hsp-det-chart-points"
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
                        <Bar dataKey="earned" name="Earned points" stackId="a" fill={EXEC.unit} isAnimationActive animationDuration={CHART.animationDuration} />
                        <Bar dataKey="remaining" name="Remaining points" stackId="a" fill={EXEC.remaining} radius={[2, 2, 0, 0]} isAnimationActive animationDuration={CHART.animationDuration} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
                {isSingle && (
                  <p className="text-[11px] text-slate-500 mt-2">
                    Selected unit score {fmt(k.overall_score)} / 100
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
