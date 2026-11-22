import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Loader2 } from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, PieChart, Pie, Cell, ReferenceLine,
} from "recharts";
import { Panel, Kpi, Delta } from "@/components/Primitives";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useApi, errMsg } from "@/lib/api";
import { fmt, fmtInt, fmtDate } from "@/lib/format";
import { CHART, TipBox } from "@/lib/chartTheme";
import { fadeUp, staggerFast } from "@/lib/motion";

/** Settled professional palette — navy / slate / teal, clear but restrained. */
const EXEC = {
  primary: "#0F3D5E",      // brand navy — latest / main
  secondary: "#5B7C99",    // steel blue — base / comparison
  tertiary: "#3D5A80",     // mid navy — trial volumes
  convicted: "#1A6B6B",    // settled teal — convicted
  gain: "#2D6A4F",         // forest green
  decline: "#9B2C2C",      // deep red
  line: "#0F3D5E",         // navy trend
  grid: "#E8EEF2",
  tick: "#475569",
  zero: "#94A3B8",
};
const COURT_COLORS = ["#0F3D5E", "#1A6B6B"]; // JMFC navy · Session teal

function shortPeriod(p) {
  if (!p) return "";
  return String(p).replace(/20(\d{2})/, "$1");
}

function courtLabel(type, courtOptions) {
  const hit = (courtOptions || []).find((o) => o.value === type);
  if (hit) return hit.label;
  return type;
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

export default function ConvictionExecutiveOverview({ d: initial }) {
  const api = useApi();
  const seed = initial?.executive;
  const [type, setType] = useState(seed?.type || initial?.type || "Both JMFC and Session");
  const [base, setBase] = useState(seed?.base || initial?.base || "");
  const [latest, setLatest] = useState(seed?.latest || initial?.latest || "");
  const [payload, setPayload] = useState(initial?.executive ? {
    as_of: initial.as_of,
    executive: initial.executive,
    periods: initial.periods || [],
    types: initial.types || [],
    court_options: initial.court_options || [],
  } : null);
  const [loading, setLoading] = useState(!initial?.executive);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    if (!type || !base || !latest) return;
    setLoading(true);
    setError(null);
    api("get", "/conviction/executive", { params: { type, base, latest } })
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
      api("get", "/conviction/executive")
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

  const courtOptions = useMemo(() => {
    if (payload?.court_options?.length) return payload.court_options;
    const types = payload?.types || initial?.types || [];
    return types.map((t) => ({ value: t, label: t }));
  }, [payload, initial]);

  const periodOptions = useMemo(() => {
    const periods = payload?.periods || initial?.periods || [];
    return periods.map((p) => ({ value: p, label: p }));
  }, [payload, initial]);

  const ex = payload?.executive;
  const asOf = payload?.as_of || initial?.as_of;

  if (error) return <div className="text-rose-700 text-sm" data-testid="ov-conviction-exec-error">{error}</div>;
  if (!ex && loading) {
    return <div className="flex items-center gap-2 text-slate-500 py-10 justify-center"><Loader2 className="h-5 w-5 animate-spin" />Loading executive view…</div>;
  }
  if (!ex) return null;

  const k = ex.kpis || {};
  const trend = (ex.period_trend || []).map((p) => ({ ...p, label: shortPeriod(p.period) }));
  const trendRates = trend.map((p) => p.rate).filter((v) => v != null && !Number.isNaN(v));
  // Prefer a 20% floor when rates sit above it; otherwise drop so Session (~11–15%) still plots.
  const rateYDomain = (() => {
    if (!trendRates.length) return [0, 100];
    const lo = Math.min(...trendRates);
    const hi = Math.max(...trendRates);
    const yMin = lo >= 20 ? 20 : Math.max(0, Math.floor(lo / 5) * 5 - 5);
    const yMax = Math.max(yMin + 10, Math.ceil(hi / 5) * 5 + 5);
    return [yMin, yMax];
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
  const share = (ex.type_trial_share || []).map((t) => ({ name: t.type, value: t.trials || 0 }));
  const shareTotal = share.reduce((a, b) => a + b.value, 0);

  return (
    <motion.section variants={fadeUp} className="space-y-4" data-testid="overview-conviction-executive">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-display text-xl font-semibold text-slate-900 tracking-tight">Statewide conviction performance</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Maharashtra Police · data as of {fmtDate(asOf)}
          </p>
        </div>
        <Link
          to="/conviction"
          className="group text-sm text-brand-navy hover:text-teal-700 inline-flex items-center gap-1.5 font-medium transition-colors"
          data-testid="overview-open-conviction"
        >
          Open unit dashboard
          <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 surface-panel rounded-sm p-3" data-testid="ov-conviction-exec-filters">
        <FilterField
          label="Case type"
          value={type}
          onChange={setType}
          options={courtOptions}
          testId="ov-conv-filter-court"
        />
        <FilterField
          label="Base period"
          value={base}
          onChange={setBase}
          options={periodOptions}
          testId="ov-conv-filter-base"
        />
        <FilterField
          label="Latest period"
          value={latest}
          onChange={setLatest}
          options={periodOptions}
          testId="ov-conv-filter-latest"
        />
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.14em] font-semibold text-slate-500 mb-1.5">Statewide coverage</div>
          <div className="h-9 flex items-center px-3 rounded-sm border border-slate-200 bg-slate-50 text-sm font-num text-slate-800" data-testid="ov-conv-filter-coverage">
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
          {courtLabel(ex.type, courtOptions)} · {ex.base} → {ex.latest}
        </p>

        <motion.div variants={staggerFast} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Kpi
            label="Conviction rate"
            value={`${fmt(k.latest_rate)}%`}
            sub={`Base rate ${fmt(k.base_rate)}%`}
            accent
            testId="ov-conviction-exec-rate"
            formula={{
              description: "Statewide conviction rate for the latest period (sum of convictions ÷ sum of trials).",
              expression: "(Σ convicted ÷ Σ trial) × 100",
              example: `(${fmtInt(k.latest_convicted)} ÷ ${fmtInt(k.latest_trials)}) × 100 = ${fmt(k.latest_rate)}%`,
            }}
          />
          <Kpi
            label="Change in conviction rate"
            value={<Delta value={k.improvement} />}
            sub={`${ex.units_improved} of ${ex.unit_count} units improved`}
            testId="ov-conviction-exec-change"
            formula={{
              description: "Percentage-point change between latest and base statewide rates.",
              expression: "Latest rate − Base rate",
              example: `${fmt(k.latest_rate)}% − ${fmt(k.base_rate)}%`,
            }}
          />
          <Kpi
            label="Trial cases"
            value={fmtInt(k.latest_trials)}
            sub={`Base period ${fmtInt(k.base_trials)}`}
            testId="ov-conviction-exec-trials"
            formula={{
              description: "Statewide total of trial cases in the latest period for the selected case type (sum across all police units). The subtitle shows the same total for the base period.",
              expression: "Σ Trial cases (all units, latest period)",
              example: `Latest ${ex.latest}: ${fmtInt(k.latest_trials)} · Base ${ex.base}: ${fmtInt(k.base_trials)}`,
            }}
          />
          <Kpi
            label="Convicted cases"
            value={fmtInt(k.latest_convicted)}
            sub={`Base period ${fmtInt(k.base_convicted)}`}
            testId="ov-conviction-exec-convicted"
            formula={{
              description: "Statewide total of convicted cases in the latest period for the selected case type (sum across all police units). The subtitle shows the same total for the base period. Conviction rate uses these counts as the numerator over trial cases.",
              expression: "Σ Convicted cases (all units, latest period)",
              example: `Latest ${ex.latest}: ${fmtInt(k.latest_convicted)} · Base ${ex.base}: ${fmtInt(k.base_convicted)}`,
            }}
          />
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
          <Panel title="Statewide conviction rate" subtitle="All half-years for the selected case type" testId="ov-conv-chart-rate-trend">
            <div className="h-56">
              <ResponsiveContainer>
                <LineChart data={trend} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke={EXEC.grid} strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fill: EXEC.tick, fontSize: 11 }} />
                  <YAxis tick={{ fill: EXEC.tick, fontSize: 11 }} unit="%" width={42} domain={rateYDomain} />
                  <Tooltip content={<TipBox unit="%" />} />
                  <Line
                    type="monotone"
                    dataKey="rate"
                    name="Statewide"
                    stroke={EXEC.line}
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: "#fff", stroke: EXEC.line, strokeWidth: 2 }}
                    activeDot={{ r: 6 }}
                    connectNulls
                    isAnimationActive
                    animationDuration={CHART.animationDuration}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <Panel title="Statewide case volumes" subtitle="Trial and convicted counts by half-year" testId="ov-conv-chart-volumes">
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

          <Panel title="Conviction rates by reporting group" subtitle="Ordered by latest-period rate" testId="ov-conv-chart-ranges">
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
            <p className="text-[11px] text-slate-500 mt-2">Reporting groups are ordered by their latest-period rate.</p>
          </Panel>

          <Panel title="Largest unit gains and declines" subtitle="Up to three gains and three declines (pp)" testId="ov-conv-chart-movers">
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
            <p className="text-[11px] text-slate-500 mt-2">Up to three gains and three declines, in percentage points.</p>
          </Panel>

          <Panel title="Statewide conviction rates by Conviction Type" subtitle="JMFC and Session for selected periods" testId="ov-conv-chart-types">
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
            <p className="text-[11px] text-slate-500 mt-2">Both court types are shown for the selected periods.</p>
          </Panel>

          <Panel title="Share of latest trials by Conviction Type" subtitle="Trial volume share in the latest period" testId="ov-conv-chart-share">
            <div className="h-56 flex items-center gap-4">
              <div className="h-48 w-48 shrink-0">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={share}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={48}
                      outerRadius={72}
                      paddingAngle={2}
                      stroke="none"
                      isAnimationActive
                      animationDuration={CHART.animationDuration}
                    >
                      {share.map((s, i) => (
                        <Cell key={s.name} fill={COURT_COLORS[i % COURT_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v, name) => [`${fmtInt(v)} (${shareTotal ? fmt((100 * v) / shareTotal) : 0}%)`, name]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2 text-sm">
                {share.map((s, i) => (
                  <div key={s.name} className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: COURT_COLORS[i % COURT_COLORS.length] }} />
                    <span className="text-slate-700">{s.name}</span>
                    <span className="font-num font-semibold text-slate-900">
                      {shareTotal ? `${fmt((100 * s.value) / shareTotal)}%` : "—"}
                    </span>
                    <span className="text-xs text-slate-500 font-num">{fmtInt(s.value)} trials</span>
                  </div>
                ))}
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </motion.section>
  );
}
