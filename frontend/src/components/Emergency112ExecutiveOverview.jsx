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
import { fmt, fmtInt, fmtDate, fmtDuration } from "@/lib/format";
import { CHART, TipBox, OrderedLegend } from "@/lib/chartTheme";
import { fadeUp, staggerFast } from "@/lib/motion";
import { clampLatestToBase, periodsAtOrBefore } from "@/lib/periodFilters";

const EXEC = {
  primary: "#0F3D5E",
  secondary: "#5B7C99",
  tertiary: "#3D5A80",
  responded: "#1A6B6B",
  gain: "#2D6A4F",
  decline: "#9B2C2C",
  line: "#0F3D5E",
  closure: "#0F766E",
  grid: "#E8EEF2",
  tick: "#475569",
  zero: "#94A3B8",
};

function shortPeriod(p) {
  if (!p) return "";
  return String(p).replace(/20(\d{2})/, "$1");
}

const FilterField = ({ label, value, onChange, options, testId, disabledOptions = [] }) => (
  <div className="min-w-0">
    <div className="text-[10px] uppercase tracking-[0.14em] font-semibold text-slate-500 mb-1.5">{label}</div>
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 rounded-sm bg-white text-sm border-slate-200 focus:ring-2 focus:ring-teal-600/35" data-testid={testId}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="max-h-72 rounded-sm">
        {options.map((o) => {
          const disabled = disabledOptions.includes(o.value);
          return (
            <SelectItem
              key={o.value}
              value={o.value}
              disabled={disabled}
              className={disabled ? "text-slate-400 opacity-50" : undefined}
            >
              {o.label}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  </div>
);

export default function Emergency112ExecutiveOverview({ d: initial }) {
  const api = useApi();
  const seed = initial?.executive;
  const [grain, setGrain] = useState("monthly");
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
    api("get", "/emergency112/executive", { params: { base, latest, grain } })
      .then((res) => {
        setPayload(res);
        setLoading(false);
      })
      .catch((e) => {
        setError(errMsg(e));
        setLoading(false);
      });
  }, [api, base, latest, grain]);

  useEffect(() => {
    if ((!base || !latest) && !payload?.periods?.length) {
      api("get", "/emergency112/executive", { params: { grain } })
        .then((res) => {
          setPayload(res);
          setBase(res.executive?.base || "");
          setLatest(res.executive?.latest || "");
          if (res.period_grain) setGrain(res.period_grain);
          setLoading(false);
        })
        .catch((e) => { setError(errMsg(e)); setLoading(false); });
      return;
    }
    load();
  }, [load]); // eslint-disable-line react-hooks/exhaustive-deps

  const periods = useMemo(() => payload?.periods || initial?.periods || [], [payload, initial]);
  const periodOptions = useMemo(() => periods.map((p) => ({ value: p, label: p })), [periods]);
  const grainOptions = useMemo(
    () => (payload?.period_grain_options || []).map((o) => ({ value: o.id, label: o.label })),
    [payload],
  );
  const latestDisabled = useMemo(() => periodsAtOrBefore(periods, base), [periods, base]);
  const onBaseChange = (v) => {
    setBase(v);
    setLatest((cur) => clampLatestToBase(periods, v, cur));
  };
  const onGrainChange = (nextGrain) => {
    const next = payload?.period_grains?.[nextGrain];
    setGrain(nextGrain);
    if (next?.periods?.length) {
      setBase(next.default_base || next.periods[Math.max(0, next.periods.length - 2)]);
      setLatest(next.default_latest || next.periods[next.periods.length - 1]);
    }
  };

  const ex = payload?.executive;
  const asOf = payload?.as_of || initial?.as_of;

  if (error) return <div className="text-rose-700 text-sm" data-testid="ov-112-exec-error">{error}</div>;
  if (!ex && loading) {
    return <div className="flex items-center gap-2 text-slate-500 py-10 justify-center"><Loader2 className="h-5 w-5 animate-spin" />Loading executive view…</div>;
  }
  if (!ex) return null;

  const k = ex.kpis || {};
  const trend = (ex.period_trend || []).map((p) => ({ ...p, label: shortPeriod(p.period) }));
  const slowest = (ex.slowest_units || []).map((u) => ({
    ...u,
    label: u.unit.length > 22 ? `${u.unit.slice(0, 20)}…` : u.unit,
  }));
  const movers = (ex.movers || []).map((m) => ({
    ...m,
    label: m.unit.length > 22 ? `${m.unit.slice(0, 20)}…` : m.unit,
  }));
  const saved = k.seconds_saved;
  const savedLabel = saved == null
    ? "—"
    : saved >= 0
      ? `${fmtInt(saved)} sec faster`
      : `${fmtInt(Math.abs(saved))} sec slower`;

  return (
    <motion.section variants={fadeUp} className="space-y-4" data-testid="overview-112-executive">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-display text-xl font-semibold text-slate-900 tracking-tight">112 statewide performance</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Maharashtra Police · data as of {fmtDate(asOf)}
          </p>
        </div>
        <Link
          to="/112"
          className="group text-sm text-brand-navy hover:text-teal-700 inline-flex items-center gap-1.5 font-medium transition-colors"
          data-testid="overview-open-112"
        >
          Open unit dashboard
          <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 surface-panel rounded-sm p-3" data-testid="ov-112-exec-filters">
        {grainOptions.length > 0 && (
          <FilterField
            label="Period view"
            value={grain}
            onChange={onGrainChange}
            options={grainOptions}
            testId="ov-112-filter-period-grain"
          />
        )}
        <FilterField
          label="Base period"
          value={base}
          onChange={onBaseChange}
          options={periodOptions}
          testId="ov-112-filter-base"
        />
        <FilterField
          label="Latest period"
          value={latest}
          onChange={setLatest}
          options={periodOptions}
          disabledOptions={latestDisabled}
          testId="ov-112-filter-latest"
        />
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.14em] font-semibold text-slate-500 mb-1.5">Coverage</div>
          <div className="h-9 flex items-center px-3 rounded-sm border border-slate-200 bg-slate-50 text-sm font-num text-slate-800" data-testid="ov-112-filter-coverage">
            {ex.unit_count} police units
          </div>
        </div>
      </div>

      <div className="relative">
        {loading && (
          <div className="absolute inset-0 z-10 bg-white/60 flex items-center justify-center rounded-sm">
            <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
          </div>
        )}

        <p className="text-xs text-slate-500 mb-3">
          {ex.base} → {ex.latest}
        </p>

        <motion.div variants={staggerFast} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Kpi
            label="Actionable calls"
            value={fmtInt(k.latest_actionable)}
            sub={`Base month ${fmtInt(k.base_actionable)}`}
            accent
            testId="ov-112-exec-actionable"
            formula={{
              description: "Statewide sum of actionable calls in the latest month.",
              expression: "Σ actionable calls",
              example: `Latest ${fmtInt(k.latest_actionable)} · Base ${fmtInt(k.base_actionable)}`,
            }}
          />
          <Kpi
            label="Calls responded"
            value={fmtInt(k.latest_responded)}
            sub={`${fmt(k.latest_response_rate)}% of actionable calls`}
            testId="ov-112-exec-responded"
            formula={{
              description: "Statewide responded calls; subtitle is response rate vs actionable.",
              expression: "Σ responded · (Σ responded ÷ Σ actionable) × 100",
              example: `${fmtInt(k.latest_responded)} · ${fmt(k.latest_response_rate)}%`,
            }}
          />
          <Kpi
            label="Average response time"
            value={fmtDuration(k.latest_mean_sec)}
            sub={`${fmtDuration(k.base_mean_sec)} base, ${savedLabel}`}
            testId="ov-112-exec-time"
            formula={{
              description: "Unweighted mean of unit average response times (Excel statewide method).",
              expression: "Avg(unit total response time)",
              example: `Latest ${fmtDuration(k.latest_mean_sec)} · Base ${fmtDuration(k.base_mean_sec)}`,
            }}
          />
          <Kpi
            label="Closures within 100m"
            value={`${fmt(k.latest_closure_rate)}%`}
            sub={`${fmtInt(k.latest_closed_100m)} events closed within 100m`}
            testId="ov-112-exec-closure"
            formula={{
              description: "Events closed within 100m ÷ actionable calls × 100.",
              expression: "(Σ closed ≤100m ÷ Σ actionable) × 100",
              example: `(${fmtInt(k.latest_closed_100m)} ÷ ${fmtInt(k.latest_actionable)}) × 100 = ${fmt(k.latest_closure_rate)}%`,
            }}
          />
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
          <Panel title="Actionable and responded calls" subtitle="Monthly statewide volumes" testId="ov-112-chart-volumes">
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

          <Panel title="Average response time by month (minutes)" subtitle="Unweighted mean of unit averages" testId="ov-112-chart-time">
            <div className="h-56">
              <ResponsiveContainer>
                <LineChart data={trend} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke={EXEC.grid} strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fill: EXEC.tick, fontSize: 11 }} />
                  <YAxis tick={{ fill: EXEC.tick, fontSize: 11 }} width={42} />
                  <Tooltip content={<TipBox unit=" min" />} />
                  <Line type="monotone" dataKey="mean_minutes" name="Statewide" stroke={EXEC.line} strokeWidth={2.5} dot={{ r: 4, fill: "#fff", stroke: EXEC.line, strokeWidth: 2 }} connectNulls isAnimationActive animationDuration={CHART.animationDuration} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <Panel title="Call response rate by month" subtitle="Responded ÷ actionable" testId="ov-112-chart-response-rate">
            <div className="h-56">
              <ResponsiveContainer>
                <LineChart data={trend} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke={EXEC.grid} strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fill: EXEC.tick, fontSize: 11 }} />
                  <YAxis tick={{ fill: EXEC.tick, fontSize: 11 }} unit="%" width={42} domain={[0, 100]} />
                  <Tooltip content={<TipBox unit="%" />} />
                  <Line type="monotone" dataKey="response_rate" name="Statewide" stroke={EXEC.responded} strokeWidth={2.5} dot={{ r: 4, fill: "#fff", stroke: EXEC.responded, strokeWidth: 2 }} connectNulls isAnimationActive animationDuration={CHART.animationDuration} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[11px] text-slate-500 mt-2">Call response rate = responded calls / actionable calls.</p>
          </Panel>

          <Panel title="Closures within 100m by month" subtitle="Closed ≤100m ÷ actionable" testId="ov-112-chart-closure">
            <div className="h-56">
              <ResponsiveContainer>
                <LineChart data={trend} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke={EXEC.grid} strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fill: EXEC.tick, fontSize: 11 }} />
                  <YAxis tick={{ fill: EXEC.tick, fontSize: 11 }} unit="%" width={42} />
                  <Tooltip content={<TipBox unit="%" />} />
                  <Line type="monotone" dataKey="closure_rate" name="Statewide" stroke={EXEC.closure} strokeWidth={2.5} dot={{ r: 4, fill: "#fff", stroke: EXEC.closure, strokeWidth: 2 }} connectNulls isAnimationActive animationDuration={CHART.animationDuration} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[11px] text-slate-500 mt-2">100m closure rate = events closed within 100m / actionable calls.</p>
          </Panel>

          <Panel title="Five slowest units (response minutes)" subtitle="Ordered by latest-month response time" testId="ov-112-chart-slowest">
            <div className="h-72">
              <ResponsiveContainer>
                <BarChart data={slowest} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                  <CartesianGrid stroke={EXEC.grid} strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fill: EXEC.tick, fontSize: 11 }} unit=" min" />
                  <YAxis type="category" dataKey="label" width={120} tick={{ fill: EXEC.tick, fontSize: 10 }} />
                  <Tooltip content={<TipBox unit=" min" />} />
                  <Legend content={<OrderedLegend />} />
                  <Bar dataKey="base_minutes" name="Base" fill={EXEC.secondary} radius={[0, 2, 2, 0]} isAnimationActive animationDuration={CHART.animationDuration} />
                  <Bar dataKey="latest_minutes" name="Latest" fill={EXEC.primary} radius={[0, 2, 2, 0]} isAnimationActive animationDuration={CHART.animationDuration} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[11px] text-slate-500 mt-2">The five slowest units are ordered by latest-month response time.</p>
          </Panel>

          <Panel title="Largest changes in response time" subtitle="Seconds saved (positive = faster)" testId="ov-112-chart-movers">
            <div className="h-72">
              <ResponsiveContainer>
                <BarChart data={movers} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                  <CartesianGrid stroke={EXEC.grid} strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fill: EXEC.tick, fontSize: 11 }} unit=" sec" />
                  <YAxis type="category" dataKey="label" width={120} tick={{ fill: EXEC.tick, fontSize: 10 }} />
                  <Tooltip content={<TipBox unit=" sec" />} />
                  <ReferenceLine x={0} stroke={EXEC.zero} />
                  <Bar dataKey="seconds_saved" name="Seconds saved" radius={[0, 2, 2, 0]} isAnimationActive animationDuration={CHART.animationDuration}>
                    {movers.map((m) => (
                      <Cell key={m.unit} fill={m.seconds_saved >= 0 ? EXEC.gain : EXEC.decline} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[11px] text-slate-500 mt-2">Positive seconds saved indicate a faster response than the base month.</p>
          </Panel>
        </div>
      </div>
    </motion.section>
  );
}
