import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Loader2 } from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ReferenceLine, Cell,
} from "recharts";
import { Panel, Kpi } from "@/components/Primitives";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useApi, errMsg } from "@/lib/api";
import { fmt, fmtInt, fmtDate } from "@/lib/format";
import { CHART, TipBox } from "@/lib/chartTheme";
import { fadeUp, staggerFast } from "@/lib/motion";

const EXEC = {
  primary: "#0F3D5E",
  secondary: "#5B7C99",
  accidents: "#3D5A80",
  killed: "#9B2C2C",
  injured: "#B45309",
  gain: "#2D6A4F",
  decline: "#9B2C2C",
  line: "#0F3D5E",
  grid: "#E8EEF2",
  tick: "#475569",
  zero: "#94A3B8",
  yearA: "#5B7C99",
  yearB: "#0F3D5E",
};

function shortPeriod(p) {
  if (!p) return "";
  return String(p).replace(/20(\d{2})/, "$1");
}

function pctVsBase(change) {
  if (change == null || Number.isNaN(change)) return "—";
  const abs = Math.abs(change);
  if (change < 0) return `${fmt(abs, 1)}% lower than base`;
  if (change > 0) return `${fmt(abs, 1)}% higher than base`;
  return "Same as base";
}

const FilterField = ({ label, value, onChange, options, testId }) => (
  <div className="min-w-0">
    <div className="text-[10px] uppercase tracking-[0.14em] font-semibold text-slate-500 mb-1.5">{label}</div>
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 rounded-sm bg-white text-sm border-slate-200 focus:ring-2 focus:ring-teal-600/35" data-testid={testId}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="max-h-72 rounded-sm">
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
);

export default function HspExecutiveOverview({ d: initial }) {
  const api = useApi();
  const seed = initial?.executive;
  const [base, setBase] = useState(seed?.base || initial?.base || "");
  const [latest, setLatest] = useState(seed?.latest || initial?.latest || "");
  const [payload, setPayload] = useState(initial?.executive ? {
    as_of: initial.as_of,
    executive: initial.executive,
    periods: initial.periods || [],
  } : null);
  const [loading, setLoading] = useState(!initial?.executive);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    if (!base || !latest) return;
    setLoading(true);
    setError(null);
    api("get", "/hsp/executive", { params: { base, latest } })
      .then((res) => {
        setPayload(res);
        setLoading(false);
      })
      .catch((e) => {
        setError(errMsg(e));
        setLoading(false);
      });
  }, [api, base, latest]);

  useEffect(() => {
    if ((!base || !latest) && !payload?.periods?.length) {
      api("get", "/hsp/executive")
        .then((res) => {
          setPayload(res);
          setBase(res.executive?.base || "");
          setLatest(res.executive?.latest || "");
          setLoading(false);
        })
        .catch((e) => { setError(errMsg(e)); setLoading(false); });
      return;
    }
    load();
  }, [load]); // eslint-disable-line react-hooks/exhaustive-deps

  const periodOptions = useMemo(() => {
    const periods = payload?.periods || initial?.periods || [];
    return periods.map((p) => ({ value: p, label: p }));
  }, [payload, initial]);

  const ex = payload?.executive;
  const asOf = payload?.as_of || initial?.as_of;

  if (error) return <div className="text-rose-700 text-sm" data-testid="ov-hsp-exec-error">{error}</div>;
  if (!ex && loading) {
    return <div className="flex items-center gap-2 text-slate-500 py-10 justify-center"><Loader2 className="h-5 w-5 animate-spin" />Loading executive view…</div>;
  }
  if (!ex) return null;

  const k = ex.kpis || {};
  const trend = (ex.period_trend || []).map((p) => ({ ...p, label: shortPeriod(p.period) }));
  const topFatal = (ex.top_fatalities || []).map((u) => ({
    ...u,
    label: u.unit.length > 22 ? `${u.unit.slice(0, 20)}…` : u.unit,
  }));
  const movers = (ex.fatality_movers || []).map((m) => ({
    ...m,
    label: m.unit.length > 22 ? `${m.unit.slice(0, 20)}…` : m.unit,
  }));
  const yoy = ex.yoy_years || [];
  const yearA = yoy[0];
  const yearB = yoy[1];
  const calendar = (ex.calendar_compare || []).map((c) => ({
    ...c,
    label: c.calendar_quarter,
  }));

  return (
    <motion.section variants={fadeUp} className="space-y-4" data-testid="overview-hsp-executive">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-display text-xl font-semibold text-slate-900 tracking-tight">HSP road-safety performance</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Maharashtra Police · data as of {fmtDate(asOf)}
          </p>
        </div>
        <Link
          to="/hsp"
          className="group text-sm text-brand-navy hover:text-teal-700 inline-flex items-center gap-1.5 font-medium transition-colors"
          data-testid="overview-open-hsp"
        >
          Open unit dashboard
          <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 surface-panel rounded-sm p-3" data-testid="ov-hsp-exec-filters">
        <FilterField label="Base quarter" value={base} onChange={setBase} options={periodOptions} testId="ov-hsp-filter-base" />
        <FilterField label="Latest quarter" value={latest} onChange={setLatest} options={periodOptions} testId="ov-hsp-filter-latest" />
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.14em] font-semibold text-slate-500 mb-1.5">Coverage</div>
          <div className="h-9 flex items-center px-3 rounded-sm border border-slate-200 bg-slate-50 text-sm font-num text-slate-800">
            {ex.unit_count} police units
          </div>
        </div>
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.14em] font-semibold text-slate-500 mb-1.5">Latest quarter</div>
          <div className="h-9 flex items-center px-3 rounded-sm border border-slate-200 bg-slate-50 text-sm font-num text-slate-800">
            {ex.latest}
          </div>
        </div>
      </div>

      <div className="relative">
        {loading && (
          <div className="absolute inset-0 z-10 bg-white/60 flex items-center justify-center rounded-sm">
            <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
          </div>
        )}

        <p className="text-xs text-slate-500 mb-3">{ex.base} → {ex.latest}</p>

        <motion.div variants={staggerFast} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Kpi
            label="Total accidents"
            value={fmtInt(k.latest_accidents)}
            sub={pctVsBase(k.accidents_pct_change)}
            accent
            testId="ov-hsp-exec-accidents"
            formula={{
              description: "Statewide sum of accidents in the latest quarter vs base.",
              expression: "Σ accidents",
              example: `Latest ${fmtInt(k.latest_accidents)} · Base ${fmtInt(k.base_accidents)}`,
            }}
          />
          <Kpi
            label="Fatalities"
            value={fmtInt(k.latest_killed)}
            sub={pctVsBase(k.killed_pct_change)}
            testId="ov-hsp-exec-killed"
            formula={{
              description: "Statewide sum of fatalities (killed) in the latest quarter.",
              expression: "Σ fatalities",
              example: `Latest ${fmtInt(k.latest_killed)} · Base ${fmtInt(k.base_killed)}`,
            }}
          />
          <Kpi
            label="People injured"
            value={fmtInt(k.latest_injured)}
            sub={pctVsBase(k.injured_pct_change)}
            testId="ov-hsp-exec-injured"
            formula={{
              description: "Statewide sum of people injured in the latest quarter.",
              expression: "Σ injured",
              example: `Latest ${fmtInt(k.latest_injured)} · Base ${fmtInt(k.base_injured)}`,
            }}
          />
          <Kpi
            label="Fatalities per 100 accidents"
            value={fmt(k.latest_fatality_per_100, 1)}
            sub="Fatalities / accidents × 100"
            testId="ov-hsp-exec-severity"
            formula={{
              description: "Severity ratio for the latest quarter.",
              expression: "(Σ fatalities ÷ Σ accidents) × 100",
              example: `(${fmtInt(k.latest_killed)} ÷ ${fmtInt(k.latest_accidents)}) × 100 = ${fmt(k.latest_fatality_per_100, 1)}`,
            }}
          />
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
          <Panel title="Accidents by quarter" subtitle="Statewide totals" testId="ov-hsp-chart-accidents">
            <div className="h-56">
              <ResponsiveContainer>
                <LineChart data={trend} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke={EXEC.grid} strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fill: EXEC.tick, fontSize: 11 }} />
                  <YAxis tick={{ fill: EXEC.tick, fontSize: 11 }} width={48} />
                  <Tooltip content={<TipBox />} />
                  <Line type="monotone" dataKey="accidents" name="Accidents" stroke={EXEC.accidents} strokeWidth={2.5} dot={{ r: 4, fill: "#fff", stroke: EXEC.accidents, strokeWidth: 2 }} connectNulls isAnimationActive animationDuration={CHART.animationDuration} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <Panel title="Fatalities and people injured by quarter" subtitle="Statewide totals" testId="ov-hsp-chart-outcomes">
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

          <Panel title="Units with most fatalities in the latest quarter" subtitle="Top 5 by fatality count" testId="ov-hsp-chart-top-fatal">
            <div className="h-72">
              <ResponsiveContainer>
                <BarChart data={topFatal} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                  <CartesianGrid stroke={EXEC.grid} strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fill: EXEC.tick, fontSize: 11 }} />
                  <YAxis type="category" dataKey="label" width={120} tick={{ fill: EXEC.tick, fontSize: 10 }} />
                  <Tooltip content={<TipBox />} />
                  <Bar dataKey="killed" name="Fatalities" fill={EXEC.killed} radius={[0, 2, 2, 0]} isAnimationActive animationDuration={CHART.animationDuration} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[11px] text-slate-500 mt-2">Units are ordered by the latest-quarter fatality count.</p>
          </Panel>

          <Panel title="Largest fatality reductions and increases" subtitle="Positive = fewer fatalities than base" testId="ov-hsp-chart-movers">
            <div className="h-72">
              <ResponsiveContainer>
                <BarChart data={movers} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                  <CartesianGrid stroke={EXEC.grid} strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fill: EXEC.tick, fontSize: 11 }} />
                  <YAxis type="category" dataKey="label" width={120} tick={{ fill: EXEC.tick, fontSize: 10 }} />
                  <Tooltip content={<TipBox />} />
                  <ReferenceLine x={0} stroke={EXEC.zero} />
                  <Bar dataKey="fatalities_reduced" name="Fatalities reduced" radius={[0, 2, 2, 0]} isAnimationActive animationDuration={CHART.animationDuration}>
                    {movers.map((m) => (
                      <Cell key={m.unit} fill={m.fatalities_reduced >= 0 ? EXEC.gain : EXEC.decline} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[11px] text-slate-500 mt-2">Positive values indicate fewer fatalities than in the base quarter.</p>
          </Panel>

          <Panel title="Fatalities per 100 accidents by quarter" subtitle="Severity ratio" testId="ov-hsp-chart-severity">
            <div className="h-56">
              <ResponsiveContainer>
                <LineChart data={trend} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke={EXEC.grid} strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fill: EXEC.tick, fontSize: 11 }} />
                  <YAxis tick={{ fill: EXEC.tick, fontSize: 11 }} width={42} />
                  <Tooltip content={<TipBox />} />
                  <Line type="monotone" dataKey="fatality_per_100" name="Fatalities per 100 accidents" stroke={EXEC.line} strokeWidth={2.5} dot={{ r: 4, fill: "#fff", stroke: EXEC.line, strokeWidth: 2 }} connectNulls isAnimationActive animationDuration={CHART.animationDuration} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[11px] text-slate-500 mt-2">The ratio uses total fatalities / total accidents × 100.</p>
          </Panel>

          <Panel
            title="Fatalities in matching calendar quarters"
            subtitle={yearA && yearB ? `${yearA} vs ${yearB}` : "Year-on-year"}
            testId="ov-hsp-chart-yoy"
          >
            <div className="h-56">
              {!calendar.length ? (
                <div className="h-full flex items-center justify-center text-sm text-slate-500">Need two years of matching quarters</div>
              ) : (
                <ResponsiveContainer>
                  <BarChart data={calendar} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke={EXEC.grid} strokeDasharray="3 3" />
                    <XAxis dataKey="label" tick={{ fill: EXEC.tick, fontSize: 11 }} />
                    <YAxis tick={{ fill: EXEC.tick, fontSize: 11 }} width={48} />
                    <Tooltip content={<TipBox />} />
                    <Legend />
                    <Bar dataKey="killed_a" name={String(yearA)} fill={EXEC.yearA} radius={[2, 2, 0, 0]} isAnimationActive animationDuration={CHART.animationDuration} />
                    <Bar dataKey="killed_b" name={String(yearB)} fill={EXEC.yearB} radius={[2, 2, 0, 0]} isAnimationActive animationDuration={CHART.animationDuration} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
            <p className="text-[11px] text-slate-500 mt-2">Compares matching calendar quarters across years.</p>
          </Panel>
        </div>
      </div>
    </motion.section>
  );
}
