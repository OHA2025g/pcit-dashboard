import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Loader2 } from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ReferenceLine, Cell,
} from "recharts";
import { Panel, Kpi, Delta } from "@/components/Primitives";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useApi, errMsg } from "@/lib/api";
import { fmt, fmtInt, fmtDate } from "@/lib/format";
import { CHART, TipBox } from "@/lib/chartTheme";
import { fadeUp, staggerFast } from "@/lib/motion";

const EXEC = {
  primary: "#0F3D5E",
  secondary: "#5B7C99",
  tertiary: "#3D5A80",
  within: "#1A6B6B",
  beyond: "#9B2C2C",
  gain: "#2D6A4F",
  decline: "#9B2C2C",
  line: "#0F3D5E",
  lateLine: "#B45309",
  grid: "#E8EEF2",
  tick: "#475569",
  zero: "#94A3B8",
};

function shortPeriod(p) {
  if (!p) return "";
  return String(p).replace(/20(\d{2})/, "$1");
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

export default function TimelinessExecutiveOverview({ d: initial }) {
  const api = useApi();
  const seed = initial?.executive;
  const [type, setType] = useState(seed?.type || initial?.type || "Both 60 Day & 90 Day");
  const [base, setBase] = useState(seed?.base || initial?.base || "");
  const [latest, setLatest] = useState(seed?.latest || initial?.latest || "");
  const [payload, setPayload] = useState(initial?.executive ? {
    as_of: initial.as_of,
    executive: initial.executive,
    periods: initial.periods || [],
    types: initial.types || [],
    deadline_options: initial.deadline_options || [],
  } : null);
  const [loading, setLoading] = useState(!initial?.executive);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    if (!type || !base || !latest) return;
    setLoading(true);
    setError(null);
    api("get", "/timeliness/executive", { params: { type, base, latest } })
      .then((res) => {
        setPayload(res);
        setLoading(false);
      })
      .catch((e) => {
        setError(errMsg(e));
        setLoading(false);
      });
  }, [api, type, base, latest]);

  useEffect(() => {
    if ((!base || !latest) && !payload?.periods?.length) {
      api("get", "/timeliness/executive")
        .then((res) => {
          setPayload(res);
          setType(res.executive?.type || res.types?.[res.types.length - 1]);
          setBase(res.executive?.base || "");
          setLatest(res.executive?.latest || "");
          setLoading(false);
        })
        .catch((e) => { setError(errMsg(e)); setLoading(false); });
      return;
    }
    load();
  }, [load]); // eslint-disable-line react-hooks/exhaustive-deps

  const deadlineOptions = useMemo(() => {
    if (payload?.deadline_options?.length) return payload.deadline_options;
    const types = payload?.types || initial?.types || [];
    return types.map((t) => ({ value: t, label: t }));
  }, [payload, initial]);

  const periodOptions = useMemo(() => {
    const periods = payload?.periods || initial?.periods || [];
    return periods.map((p) => ({ value: p, label: p }));
  }, [payload, initial]);

  const ex = payload?.executive;
  const asOf = payload?.as_of || initial?.as_of;

  if (error) return <div className="text-rose-700 text-sm" data-testid="ov-timeliness-exec-error">{error}</div>;
  if (!ex && loading) {
    return <div className="flex items-center gap-2 text-slate-500 py-10 justify-center"><Loader2 className="h-5 w-5 animate-spin" />Loading executive view…</div>;
  }
  if (!ex) return null;

  const k = ex.kpis || {};
  const trend = (ex.period_trend || []).map((p) => ({ ...p, label: shortPeriod(p.period) }));
  const trendRates = trend.flatMap((p) => [p.rate, p.beyond_rate]).filter((v) => v != null && !Number.isNaN(v));
  const rateYDomain = (() => {
    if (!trendRates.length) return [0, 100];
    const lo = Math.min(...trendRates);
    const hi = Math.max(...trendRates);
    const yMin = lo >= 20 ? 20 : Math.max(0, Math.floor(lo / 5) * 5 - 5);
    const yMax = Math.max(yMin + 10, Math.ceil(hi / 5) * 5 + 5, 100);
    return [yMin, Math.min(100, yMax)];
  })();
  const rangeRates = (ex.range_rates || []).map((r) => ({
    ...r,
    label: r.range.replace(/ Range$/i, ""),
  }));
  const movers = (ex.movers || []).map((m) => ({
    ...m,
    label: m.unit.length > 22 ? `${m.unit.slice(0, 20)}…` : m.unit,
  }));
  const typeRates = ex.type_rates || [];
  const lateUnits = (ex.late_units || []).map((u) => ({
    ...u,
    label: u.unit.length > 22 ? `${u.unit.slice(0, 20)}…` : u.unit,
  }));

  return (
    <motion.section variants={fadeUp} className="space-y-4" data-testid="overview-timeliness-executive">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-display text-xl font-semibold text-slate-900 tracking-tight">60–90 day chargesheet performance</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Maharashtra Police · data as of {fmtDate(asOf)}
          </p>
        </div>
        <Link
          to="/timeliness"
          className="group text-sm text-brand-navy hover:text-teal-700 inline-flex items-center gap-1.5 font-medium transition-colors"
          data-testid="overview-open-timeliness"
        >
          Open unit dashboard
          <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 surface-panel rounded-sm p-3" data-testid="ov-timeliness-exec-filters">
        <FilterField
          label="Case deadline"
          value={type}
          onChange={setType}
          options={deadlineOptions}
          testId="ov-tim-filter-deadline"
        />
        <FilterField
          label="Base period"
          value={base}
          onChange={setBase}
          options={periodOptions}
          testId="ov-tim-filter-base"
        />
        <FilterField
          label="Latest period"
          value={latest}
          onChange={setLatest}
          options={periodOptions}
          testId="ov-tim-filter-latest"
        />
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.14em] font-semibold text-slate-500 mb-1.5">Coverage</div>
          <div className="h-9 flex items-center px-3 rounded-sm border border-slate-200 bg-slate-50 text-sm font-num text-slate-800" data-testid="ov-tim-filter-coverage">
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
          {ex.type} · {ex.base} → {ex.latest}
        </p>

        <motion.div variants={staggerFast} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Kpi
            label="Chargesheeted within time"
            value={`${fmt(k.latest_rate)}%`}
            sub={`Base rate ${fmt(k.base_rate)}%`}
            accent
            testId="ov-timeliness-exec-rate"
            formula={{
              description: "Statewide within-time rate for the latest period (sum of within-time ÷ sum of registered).",
              expression: "(Σ within time ÷ Σ registered) × 100",
              example: `(${fmtInt(k.latest_within)} ÷ ${fmtInt(k.latest_registered)}) × 100 = ${fmt(k.latest_rate)}%`,
            }}
          />
          <Kpi
            label="Change in in-time rate"
            value={<Delta value={k.improvement} />}
            sub={`${ex.units_improved} of ${ex.unit_count} units improved`}
            testId="ov-timeliness-exec-change"
            formula={{
              description: "Percentage-point change between latest and base statewide within-time rates.",
              expression: "Latest rate − Base rate",
              example: `${fmt(k.latest_rate)}% − ${fmt(k.base_rate)}%`,
            }}
          />
          <Kpi
            label="Registered cases"
            value={fmtInt(k.latest_registered)}
            sub={`Base period ${fmtInt(k.base_registered)}`}
            testId="ov-timeliness-exec-registered"
            formula={{
              description: "Statewide total of registered cases in the latest period. Subtitle shows the base-period total.",
              expression: "Σ Registered cases (all units, latest period)",
              example: `Latest ${ex.latest}: ${fmtInt(k.latest_registered)} · Base ${ex.base}: ${fmtInt(k.base_registered)}`,
            }}
          />
          <Kpi
            label="Chargesheeted beyond time"
            value={fmtInt(k.latest_beyond)}
            sub={`${fmt(k.latest_beyond_rate)}% of registered cases`}
            testId="ov-timeliness-exec-beyond"
            formula={{
              description: "Statewide beyond-time chargesheets in the latest period, with beyond-time rate vs registered cases.",
              expression: "Σ beyond · (Σ beyond ÷ Σ registered) × 100",
              example: `${fmtInt(k.latest_beyond)} · ${fmt(k.latest_beyond_rate)}%`,
            }}
          />
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
          <Panel title="Within-time and beyond-time rates" subtitle="All half-years for the selected deadline" testId="ov-tim-chart-rate-trend">
            <div className="h-56">
              <ResponsiveContainer>
                <LineChart data={trend} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke={EXEC.grid} strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fill: EXEC.tick, fontSize: 11 }} />
                  <YAxis tick={{ fill: EXEC.tick, fontSize: 11 }} unit="%" width={42} domain={rateYDomain} />
                  <Tooltip content={<TipBox unit="%" />} />
                  <Legend />
                  <Line type="monotone" dataKey="rate" name="Within time" stroke={EXEC.line} strokeWidth={2.5} dot={{ r: 4, fill: "#fff", stroke: EXEC.line, strokeWidth: 2 }} connectNulls isAnimationActive animationDuration={CHART.animationDuration} />
                  <Line type="monotone" dataKey="beyond_rate" name="Beyond time" stroke={EXEC.lateLine} strokeWidth={2} dot={{ r: 3 }} connectNulls isAnimationActive animationDuration={CHART.animationDuration} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <Panel title="Registered cases and chargesheets" subtitle="Counts by half-year" testId="ov-tim-chart-volumes">
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

          <Panel title="In-time rate by Range" subtitle="Ordered by latest-period rate" testId="ov-tim-chart-ranges">
            <div className="h-72">
              <ResponsiveContainer>
                <BarChart data={rangeRates} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
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
            <p className="text-[11px] text-slate-500 mt-2">Reporting groups are ordered by their latest-period in-time rate.</p>
          </Panel>

          <Panel title="Largest changes in the in-time rate" subtitle="Up to three gains and three declines (pp)" testId="ov-tim-chart-movers">
            <div className="h-72">
              <ResponsiveContainer>
                <BarChart data={movers} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                  <CartesianGrid stroke={EXEC.grid} strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fill: EXEC.tick, fontSize: 11 }} unit=" pp" />
                  <YAxis type="category" dataKey="label" width={110} tick={{ fill: EXEC.tick, fontSize: 10 }} />
                  <Tooltip content={<TipBox unit=" pp" />} />
                  <ReferenceLine x={0} stroke={EXEC.zero} />
                  <Bar dataKey="improvement" name="Rate change" radius={[0, 2, 2, 0]} isAnimationActive animationDuration={CHART.animationDuration}>
                    {movers.map((m) => (
                      <Cell key={m.unit} fill={m.improvement >= 0 ? EXEC.gain : EXEC.decline} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[11px] text-slate-500 mt-2">Up to three unit gains and three declines, in percentage points.</p>
          </Panel>

          <Panel title="In-time rates by case deadline" subtitle="60 Day and 90 Day for selected periods" testId="ov-tim-chart-deadlines">
            <div className="h-56">
              <ResponsiveContainer>
                <BarChart data={typeRates} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
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
            <p className="text-[11px] text-slate-500 mt-2">Both deadline categories are shown for the selected periods.</p>
          </Panel>

          <Panel title="Units with most late chargesheets" subtitle="Beyond-time counts in the latest period" testId="ov-tim-chart-late">
            <div className="h-56">
              <ResponsiveContainer>
                <BarChart data={lateUnits} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                  <CartesianGrid stroke={EXEC.grid} strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fill: EXEC.tick, fontSize: 11 }} />
                  <YAxis type="category" dataKey="label" width={120} tick={{ fill: EXEC.tick, fontSize: 10 }} />
                  <Tooltip content={<TipBox />} />
                  <Bar dataKey="beyond" name="Beyond-time chargesheets" fill={EXEC.beyond} radius={[0, 2, 2, 0]} isAnimationActive animationDuration={CHART.animationDuration} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-[11px] text-slate-500 mt-2">Late-charge counts use the selected case deadline and latest period.</p>
          </Panel>
        </div>
      </div>
    </motion.section>
  );
}
