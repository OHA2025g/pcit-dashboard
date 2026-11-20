import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell, Legend, ReferenceLine } from "recharts";
import { Panel } from "@/components/Primitives";
import { CHART, TipBox } from "@/lib/chartTheme";

const COMMON = (d) => [
  { id: "movement", label: "Rank movement", title: `${d} rank movement vs previous window`, unit: "places (+ = moved up)", keys: [["rank_movement", "Rank movement"]], signed: true },
  { id: "volatility", label: "Consistency", title: `${d} rate volatility across all periods`, unit: "std. deviation in pp (lower = steadier)", keys: [["volatility", "Volatility (pp)"]] },
  { id: "workload", label: "Workload share", title: `${d} share of state caseload (latest period)`, unit: "% of state cases", keys: [["workload_share", "Workload share %"]] },
];

const CHARTS = {
  conviction: [
    { id: "improvement", label: "Improvement", title: "Conviction improvement", unit: "pp", keys: [["improvement", "Improvement (pp)"]], signed: true },
    { id: "rates", label: "Base vs latest", title: "Conviction base and latest rates", unit: "%", keys: [["base_rate", "Base rate %"], ["latest_rate", "Latest rate %"]] },
    { id: "score", label: "Overall score", title: "Conviction overall score", unit: "0–100", keys: [["overall_score", "Overall score"]], sort: true },
    { id: "rank", label: "Overall rank", title: "Conviction overall rank", unit: "rank (1 = best)", keys: [["rank", "Rank"]], rank: true },
    { id: "acquittal", label: "Acquittal rate", title: "Base and latest acquittal (non-conviction) rate", unit: "% (lower is better)", keys: [["base_acquittal_rate", "Base acquittal %"], ["latest_acquittal_rate", "Latest acquittal %"]] },
    { id: "gap", label: "Session − JMFC gap", title: "Session minus JMFC conviction rate (latest period)", unit: "pp", keys: [["session_jmfc_gap", "Gap (pp)"]], signed: true },
    ...COMMON("Conviction"),
  ],
  timeliness: [
    { id: "improvement", label: "Improvement", title: "Within-time improvement", unit: "pp", keys: [["improvement", "Improvement (pp)"]], signed: true },
    { id: "rates", label: "Base vs latest", title: "Within-time base and latest rates", unit: "%", keys: [["base_rate", "Base rate %"], ["latest_rate", "Latest rate %"]] },
    { id: "score", label: "Overall score", title: "Timeliness overall score", unit: "0–100", keys: [["overall_score", "Overall score"]], sort: true },
    { id: "rank", label: "Overall rank", title: "Timeliness overall rank", unit: "rank (1 = best)", keys: [["rank", "Rank"]], rank: true },
    { id: "beyond", label: "Beyond-time rates", title: "Beyond-time base and latest rates", unit: "%", keys: [["base_beyond_rate", "Base beyond %"], ["latest_beyond_rate", "Latest beyond %"]] },
    { id: "beyond_change", label: "Beyond-time change", title: "Beyond-time rate change", unit: "pp (lower is better)", keys: [["beyond_change", "Change (pp)"]], signed: true, invert: true },
    { id: "pending", label: "Pending charge sheets", title: "Charge sheets still pending (base vs latest)", unit: "% of registered (lower is better)", keys: [["base_pending_rate", "Base pending %"], ["latest_pending_rate", "Latest pending %"]] },
    ...COMMON("Timeliness"),
  ],
  emergency112: [
    { id: "score", label: "Final score", title: "112 final score", unit: "0–100", keys: [["overall_score", "Final score"]], sort: true },
    { id: "response", label: "Response time", title: "Base vs latest total response time (seconds)", unit: "seconds (lower is better)", keys: [["base_total_sec", "Base sec"], ["latest_total_sec", "Latest sec"]] },
    { id: "pct100", label: "% ≤100m", title: "Base vs latest % events closed within 100 minutes", unit: "%", keys: [["base_rate", "Base %"], ["latest_rate", "Latest %"]] },
    { id: "time_imp", label: "Time improvement", title: "Response-time improvement % (faster is positive)", unit: "%", keys: [["time_improvement_pct", "Time improvement %"]], signed: true },
    { id: "pct_imp", label: "100m improvement", title: "% ≤100m improvement (pp)", unit: "pp", keys: [["pct_improvement", "100m improvement (pp)"]], signed: true },
    { id: "perf", label: "Period performance", title: "Period performance score (80% time + 20% %≤100m)", unit: "0–100", keys: [["performance_score", "Period performance"]], sort: true },
    { id: "rank", label: "Rank", title: "112 overall rank", unit: "rank (1 = best)", keys: [["rank", "Rank"]], rank: true },
    ...COMMON("112"),
  ],
  training: [
    { id: "marks", label: "Marks", title: "Training Ranking marks (latest period)", unit: "0–10", keys: [["marks", "Marks"]], sort: true },
    { id: "rates", label: "Base vs latest %", title: "Base and latest % people trained", unit: "%", keys: [["base_rate", "Base %"], ["latest_rate", "Latest %"]] },
    { id: "score", label: "Score", title: "Training score (Marks × 10)", unit: "0–100", keys: [["overall_score", "Score"]], sort: true },
    { id: "rank", label: "Rank", title: "Training rank by marks", unit: "rank (1 = best)", keys: [["rank", "Rank"]], rank: true },
    { id: "headcount", label: "Headcount", title: "Base vs latest unit headcount", unit: "people", keys: [["base_den", "Base headcount"], ["latest_den", "Latest headcount"]] },
    { id: "trained", label: "People trained", title: "Base vs latest people trained", unit: "people", keys: [["base_num", "Base trained"], ["latest_num", "Latest trained"]] },
    ...COMMON("Training"),
  ],
  antf: [
    { id: "meetings", label: "Meetings", title: "Total meetings from January 2026", unit: "meetings", keys: [["meetings", "Meetings"]], sort: true },
    { id: "mom", label: "MoM uploaded", title: "MoM uploaded / not uploaded on NCORD Portal", unit: "months uploaded", keys: [["mom_uploaded", "MoM uploaded"]], sort: true },
    { id: "marks", label: "Total marks", title: "Total marks scored (meetings×3 + MoM×2)", unit: "marks", keys: [["marks", "Total marks"]], sort: true },
    { id: "rank", label: "Rank", title: "ANTF rank by total marks", unit: "rank (1 = best)", keys: [["rank", "Rank"]], rank: true },
    { id: "split", label: "Marks split", title: "Meeting marks vs minutes-upload marks", unit: "marks", keys: [["meeting_marks", "Meeting marks"], ["upload_marks", "Minutes marks"]] },
  ],
  hsp: [
    { id: "score", label: "Final score", title: "HSP final score", unit: "0–100", keys: [["overall_score", "Final score"]], sort: true },
    { id: "accidents", label: "Accidents", title: "Base vs latest total accidents", unit: "accidents (lower is better)", keys: [["base_accidents", "Base accidents"], ["latest_accidents", "Latest accidents"]] },
    { id: "killed", label: "Killed", title: "Base vs latest total killed", unit: "persons (lower is better)", keys: [["base_killed", "Base killed"], ["latest_killed", "Latest killed"]] },
    { id: "perf", label: "Performance", title: "Final performance (accidents 30% + killed 70%)", unit: "0–100", keys: [["performance_score", "Final performance"]], sort: true },
    { id: "improvement", label: "Improvement", title: "Final improvement (reduction marks)", unit: "0–100", keys: [["improvement_score", "Final improvement"]], sort: true },
    { id: "rank", label: "Rank", title: "HSP overall rank", unit: "rank (1 = best)", keys: [["rank", "Rank"]], rank: true },
    ...COMMON("HSP"),
  ],
};

const SUM_KEYS = new Set([
  "base_den", "base_num", "latest_den", "latest_num",
  "base_beyond", "latest_beyond", "base_pending", "latest_pending",
  "base_total_sec", "latest_total_sec",
  "meetings", "mom_uploaded", "marks", "meeting_marks", "upload_marks",
  "base_accidents", "latest_accidents", "base_killed", "latest_killed", "base_injured", "latest_injured",
  "workload_share",
]);

const AVG_KEYS = new Set([
  "overall_score", "performance_score", "improvement_score", "improvement_marks",
  "rank", "rank_movement", "volatility", "session_jmfc_gap",
  "time_improvement_pct", "pct_improvement", "beyond_change",
  "accident_perf_score", "killed_perf_score",
  "accident_improvement_marks", "killed_improvement_marks",
]);

function avg(vals) {
  const nums = vals.filter((v) => v != null && !Number.isNaN(v));
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
}

function rate(num, den) {
  return den ? (100 * num) / den : null;
}

function aggregateByRange(rows) {
  const groups = new Map();
  for (const r of rows) {
    const key = r.range || "Unassigned";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }
  return [...groups.entries()].map(([rangeName, units]) => {
    const out = {
      unit: rangeName,
      range: rangeName,
      eligible: true,
      unit_count: units.length,
      _isRange: true,
    };
    const sum = (k) => units.reduce((s, u) => s + (Number(u[k]) || 0), 0);
    for (const k of SUM_KEYS) out[k] = sum(k);
    for (const k of AVG_KEYS) out[k] = avg(units.map((u) => u[k]));

    out.base_rate = rate(out.base_num, out.base_den);
    out.latest_rate = rate(out.latest_num, out.latest_den);
    if (out.base_rate != null && out.latest_rate != null) {
      out.improvement = out.latest_rate - out.base_rate;
    } else {
      out.improvement = avg(units.map((u) => u.improvement));
    }
    out.base_acquittal_rate = out.base_rate == null ? null : 100 - out.base_rate;
    out.latest_acquittal_rate = out.latest_rate == null ? null : 100 - out.latest_rate;
    out.base_beyond_rate = rate(out.base_beyond, out.base_den);
    out.latest_beyond_rate = rate(out.latest_beyond, out.latest_den);
    out.base_pending_rate = rate(out.base_pending, out.base_den);
    out.latest_pending_rate = rate(out.latest_pending, out.latest_den);
    if (out.base_beyond_rate != null && out.latest_beyond_rate != null) {
      out.beyond_change = out.latest_beyond_rate - out.base_beyond_rate;
    }
    return out;
  });
}

function GroupSwitch({ value, onChange, testId }) {
  const options = [
    { id: "range", label: "Range" },
    { id: "unit", label: "Unit" },
  ];
  const activeIdx = Math.max(0, options.findIndex((o) => o.id === value));

  return (
    <div
      role="group"
      aria-label="Chart grouping"
      data-testid={testId}
      className="relative inline-grid grid-cols-2 items-center rounded-full p-1"
      style={{
        background: "#E8ECF1",
        boxShadow: "inset 0 1px 2px rgba(15, 23, 42, 0.12), inset 0 -1px 1px rgba(255,255,255,0.7)",
      }}
    >
      <motion.span
        aria-hidden
        className="absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-full bg-white"
        style={{ boxShadow: "0 1px 3px rgba(15, 23, 42, 0.16), 0 0 0 1px rgba(15, 23, 42, 0.04)" }}
        animate={{ x: activeIdx === 0 ? 0 : "100%" }}
        transition={{ type: "spring", stiffness: 420, damping: 36 }}
      />
      <span aria-hidden className="pointer-events-none absolute left-1/2 top-2 bottom-2 w-px -translate-x-1/2 bg-slate-300/70 z-[1]" />
      {options.map((opt) => {
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            data-testid={`${testId}-${opt.id}`}
            aria-pressed={active}
            onClick={() => onChange(opt.id)}
            className={`relative z-[2] min-w-[4.5rem] px-4 py-1.5 text-[13px] leading-none transition-colors ${
              active ? "text-slate-900 font-semibold" : "text-slate-500 font-medium hover:text-slate-700"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export default function ChartsPanel({ domain, rows, onSelectUnit, filterLabel }) {
  const defs = CHARTS[domain];
  const [active, setActive] = useState(defs[0].id);
  const [groupBy, setGroupBy] = useState("unit");
  const c = defs.find((d) => d.id === active) || defs[0];

  const hasRanges = useMemo(() => rows.some((r) => r.range), [rows]);

  const data = useMemo(() => {
    let base = rows.filter((r) => r.eligible);
    if (groupBy === "range" && hasRanges) base = aggregateByRange(base);
    if (c.sort || c.rank) {
      base = [...base].sort((a, b) => {
        if (c.rank) return (a.rank ?? 999) - (b.rank ?? 999);
        return (b.overall_score ?? b.marks ?? 0) - (a.overall_score ?? a.marks ?? 0) || (a.rank ?? 0) - (b.rank ?? 0);
      });
    }
    return base;
  }, [rows, groupBy, hasRanges, c]);

  const byRange = groupBy === "range" && hasRanges;
  const title = `${c.title} by ${byRange ? "range" : "unit"}`;
  const countLabel = byRange ? `${data.length} ranges shown` : `${data.length} units shown`;
  const width = Math.max(data.length * (byRange ? 56 : 30), 600);

  return (
    <Panel
      testId={`chart-panel-${domain}`}
      title={title}
      subtitle={`${c.unit} · ${filterLabel} · ${countLabel}`}
      right={
        <div className="flex flex-col items-end gap-2">
          {hasRanges && <GroupSwitch value={groupBy} onChange={setGroupBy} testId="chart-group-switch" />}
          <div className="flex flex-wrap gap-1 justify-end" role="tablist">
            {defs.map((d) => (
              <button
                key={d.id}
                onClick={() => setActive(d.id)}
                data-testid={`chart-tab-${d.id}`}
                className={`relative text-xs px-2.5 py-1.5 rounded-sm border transition-colors ${active === d.id ? "text-white border-slate-900" : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"}`}
              >
                {active === d.id && (
                  <motion.span
                    layoutId={`chart-tab-pill-${domain}`}
                    className="absolute inset-0 rounded-sm bg-slate-900"
                    transition={{ type: "spring", stiffness: 400, damping: 34 }}
                  />
                )}
                <span className="relative z-10">{d.label}</span>
              </button>
            ))}
          </div>
        </div>
      }
    >
      {data.length === 0 ? (
        <div className="h-[340px] flex items-center justify-center text-sm text-slate-500" data-testid="chart-empty">No score-eligible units match the current filters.</div>
      ) : (
        <div className="overflow-x-auto">
          <div style={{ width, height: 360 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                onClick={(e) => {
                  if (!e?.activeLabel || byRange) return;
                  onSelectUnit(e.activeLabel);
                }}
              >
                <CartesianGrid strokeDasharray="2 4" stroke={CHART.grid} vertical={false} />
                <XAxis dataKey="unit" interval={0} angle={-55} textAnchor="end" height={110} tick={{ fontSize: 10, fill: CHART.tick }} />
                <YAxis tick={{ fontSize: 10, fill: CHART.tick }} reversed={!!c.rank} />
                <Tooltip content={<TipBox />} cursor={{ fill: CHART.cursor }} />
                {c.keys.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} verticalAlign="top" height={28} />}
                {c.signed && <ReferenceLine y={0} stroke="#334155" />}
                {c.keys.map(([k, name], i) => (
                  <Bar
                    key={k}
                    dataKey={k}
                    name={name}
                    fill={c.keys.length > 1 ? CHART.dual[i] : CHART.navy}
                    radius={[2, 2, 0, 0]}
                    className={byRange ? undefined : "cursor-pointer"}
                    isAnimationActive
                    animationDuration={CHART.animationDuration}
                  >
                    {c.signed && data.map((r) => (
                      <Cell key={r.unit} fill={(c.invert ? r[k] <= 0 : r[k] >= 0) ? CHART.emerald : CHART.rose} />
                    ))}
                  </Bar>
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
      <p className="text-[11px] text-slate-500 mt-2">
        {byRange
          ? "Bars show each range aggregated from its units. Switch to Unit to open a worked score explanation."
          : "Click a bar to open that unit's worked score explanation. The ranking table below is the accessible table equivalent of this chart."}
      </p>
    </Panel>
  );
}
