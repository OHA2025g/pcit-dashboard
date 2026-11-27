import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell, Legend,
  ReferenceLine, ScatterChart, Scatter, ZAxis, LineChart, Line, AreaChart, Area,
} from "recharts";
import { Panel } from "@/components/Primitives";
import ChartExplainButton from "@/components/ChartExplainButton";
import { CHART, TipBox, keysLegendPayload } from "@/lib/chartTheme";
import { resolveChartExplain } from "@/lib/chartExplain";

const COMMON = (d, { workloadAsBar = false, omitWorkload = false } = {}) => [
  {
    id: "movement",
    label: "Rank movement",
    title: `${d} rank movement vs previous window`,
    unit: "places (+ = moved up)",
    keys: [["rank_movement", "Rank movement"]],
    signed: true,
    forceRange: true, // always by range; ignores Range | Unit switch
  },
  omitWorkload
    ? {
      id: "volatility",
      label: "Consistency",
      title: `${d} rate volatility across all periods`,
      unit: "std. deviation in pp (lower = steadier)",
      keys: [["volatility", "Volatility (pp)"]],
      forceGeometry: "line",
      sortAlpha: true,
    }
    : {
      id: "volatility_workload",
      label: "Consistency / workload",
      tabs: [
        {
          id: "volatility",
          label: "Consistency",
          title: `${d} rate volatility across all periods`,
          unit: "std. deviation in pp (lower = steadier)",
          keys: [["volatility", "Volatility (pp)"]],
          forceGeometry: "line",
          sortAlpha: true,
        },
        workloadAsBar
          ? {
            id: "workload",
            label: "Workload share",
            title: `${d} workload share vs latest rate`,
            unit: "%",
            keys: [
              ["workload_share", "Workload share %"],
              ["latest_rate", "Latest rate %"],
            ],
            forceGeometry: "bar",
            sortAlpha: true,
          }
          : {
            id: "workload",
            label: "Workload share",
            title: `${d} workload share vs latest rate`,
            unit: "4-quadrant · medians as axes",
            keys: [["workload_share", "Workload share %"]],
            quadrant: true,
            xKey: "workload_share",
            xLabel: "Workload share %",
            yKey: "latest_rate",
            yLabel: "Latest rate %",
          },
      ],
    },
];

const CHARTS = {
  conviction: [
    {
      id: "acquittal",
      label: "Acquittal rate",
      title: "Base and latest acquittal (non-conviction) rate",
      unit: "% (lower is better)",
      keys: [["base_acquittal_rate", "Base acquittal %"], ["latest_acquittal_rate", "Latest acquittal %"]],
      forceRange: true, // always by range; ignores Range | Unit switch
    },
    // Rank movement directly under acquittal (both always-by-range), above improvement
    ...COMMON("Conviction").filter((c) => c.id === "movement"),
    {
      id: "improvement_rates",
      label: "Improvement / rates",
      tabs: [
        { id: "improvement", label: "Improvement", title: "Conviction improvement", unit: "pp", keys: [["improvement", "Improvement (pp)"]], signed: true },
        { id: "rates", label: "Base vs latest", title: "Conviction base and latest rates", unit: "%", keys: [["base_rate", "Base rate %"], ["latest_rate", "Latest rate %"]] },
      ],
    },
    {
      id: "score_rank",
      label: "Score / rank",
      tabs: [
        { id: "score", label: "Overall score", title: "Conviction overall score", unit: "0–100", keys: [["overall_score", "Overall score"]], sortAlpha: true, forceGeometry: "line" },
        { id: "rank", label: "Overall rank", title: "Conviction overall rank", unit: "rank (1 = best)", keys: [["rank", "Rank"]], rank: true, sortAlpha: true, forceGeometry: "area" },
      ],
    },
    ...COMMON("Conviction").filter((c) => c.id !== "movement"),
  ],
  timeliness: [
    {
      id: "beyond_change",
      label: "Beyond-time change",
      title: "Beyond-time rate change",
      unit: "pp (lower is better)",
      keys: [["beyond_change", "Change (pp)"]],
      signed: true,
      invert: true,
      forceRange: true, // always by range; ignores Range | Unit switch
      flip180: true, // Y flipped + categories right→left so bars rise from the bottom
    },
    ...COMMON("Timeliness", { omitWorkload: true }).filter((c) => c.id === "movement"),
    {
      id: "improvement_rates",
      label: "Improvement / rates",
      tabs: [
        { id: "improvement", label: "Improvement", title: "Within-time improvement", unit: "pp", keys: [["improvement", "Improvement (pp)"]], signed: true },
        { id: "rates", label: "Base vs latest", title: "Within-time base and latest rates", unit: "%", keys: [["base_rate", "Base rate %"], ["latest_rate", "Latest rate %"]] },
      ],
    },
    {
      id: "score_rank",
      label: "Score / rank",
      tabs: [
        { id: "score", label: "Overall score", title: "Timeliness overall score", unit: "0–100", keys: [["overall_score", "Overall score"]], sortAlpha: true, forceGeometry: "line" },
        { id: "rank", label: "Overall rank", title: "Timeliness overall rank", unit: "rank (1 = best)", keys: [["rank", "Rank"]], rank: true, sortAlpha: true, forceGeometry: "area" },
      ],
    },
    {
      id: "pending_consistency",
      label: "Pending / consistency",
      tabs: [
        {
          id: "pending",
          label: "Pending",
          title: "Charge sheets still pending (base vs latest)",
          unit: "% of registered (lower is better)",
          keys: [["base_pending_rate", "Base pending %"], ["latest_pending_rate", "Latest pending %"]],
          sortAlpha: true,
        },
        {
          id: "volatility",
          label: "Consistency",
          title: "Timeliness rate volatility across all periods",
          unit: "std. deviation in pp (lower = steadier)",
          keys: [["volatility", "Volatility (pp)"]],
          forceGeometry: "line",
          sortAlpha: true,
        },
      ],
    },
  ],
  emergency112: [
    {
      id: "score",
      label: "Final score",
      title: "112 final score",
      unit: "0–100",
      keys: [["overall_score", "Final score"]],
      sort: true,
      forceRange: true, // always by range; ignores Range | Unit switch
    },
    ...COMMON("112", { omitWorkload: true }).filter((c) => c.id === "movement"),
    {
      id: "improvement_tabs",
      label: "Improvements",
      tabs: [
        { id: "time_imp", label: "Response-time", title: "Response-time improvement % (faster is positive)", unit: "%", keys: [["time_improvement_pct", "Time improvement %"]], signed: true },
        {
          id: "closed_100m",
          label: "≤100m calls",
          title: "Calls closed within 100 meters",
          unit: "events",
          keys: [
            ["base_num", "Base ≤100m"],
            ["latest_num", "Latest ≤100m"],
          ],
          sortAlpha: true,
        },
      ],
    },
    {
      id: "response_pct100",
      label: "Response / % ≤100m",
      tabs: [
        {
          id: "response",
          label: "Response time",
          title: "Base vs latest total response time (seconds)",
          unit: "seconds (lower is better)",
          keys: [["base_total_sec", "Base sec"], ["latest_total_sec", "Latest sec"]],
          forceGeometry: "line",
          sortAlpha: true,
        },
        {
          id: "pct100",
          label: "% ≤100m",
          title: "Base vs latest % events closed within 100 minutes",
          unit: "%",
          keys: [["base_rate", "Base %"], ["latest_rate", "Latest %"]],
          forceGeometry: "line",
          sortAlpha: true,
        },
      ],
    },
    {
      id: "perf_rank",
      label: "Performance / rank",
      tabs: [
        {
          id: "perf",
          label: "Period performance",
          title: "Period performance score (80% time + 20% %≤100m)",
          unit: "0–100",
          keys: [["performance_score", "Period performance"]],
          sortAlpha: true,
        },
        {
          id: "rank",
          label: "Overall rank",
          title: "112 overall rank",
          unit: "rank (1 = best)",
          keys: [["rank", "Rank"]],
          rank: true,
          sortAlpha: true,
          forceGeometry: "area",
        },
      ],
    },
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
    {
      id: "score",
      label: "Final score",
      title: "HSP final score",
      unit: "0–100",
      keys: [["overall_score", "Final score"]],
      sort: true,
      forceRange: true, // always by range; ignores Range | Unit switch
    },
    ...COMMON("HSP").filter((c) => c.id === "movement"),
    {
      id: "perf_improvement",
      label: "Performance / improvement",
      tabs: [
        {
          id: "perf",
          label: "Performance",
          title: "Final performance (accidents 30% + killed 70%)",
          unit: "0–100",
          keys: [["performance_score", "Final performance"]],
          forceGeometry: "dots",
          sortAlpha: true,
        },
        {
          id: "improvement",
          label: "Improvement",
          title: "Final improvement (reduction marks)",
          unit: "0–100",
          keys: [["improvement_score", "Final improvement"]],
          sortAlpha: true,
        },
      ],
    },
    {
      id: "accidents_killed",
      label: "Accidents / killed",
      tabs: [
        {
          id: "accidents",
          label: "Accidents",
          title: "Base vs latest total accidents",
          unit: "accidents (lower is better)",
          keys: [["base_accidents", "Base accidents"], ["latest_accidents", "Latest accidents"]],
          forceGeometry: "line",
          sortAlpha: true,
        },
        {
          id: "killed",
          label: "Killed",
          title: "Base vs latest total killed",
          unit: "persons (lower is better)",
          keys: [["base_killed", "Base killed"], ["latest_killed", "Latest killed"]],
          forceGeometry: "bar",
          sortAlpha: true,
        },
      ],
    },
    ...COMMON("HSP").filter((c) => c.id !== "movement"),
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

function signedFill(value, invert) {
  if (value == null || Number.isNaN(value)) return CHART.navySoft;
  const good = invert ? value <= 0 : value >= 0;
  return good ? CHART.emerald : CHART.rose;
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

function PillSwitch({ value, onChange, options, testId, ariaLabel, cols }) {
  const activeIdx = Math.max(0, options.findIndex((o) => o.id === value));
  const colCount = cols || options.length;

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      data-testid={testId}
      className="relative inline-grid w-full sm:w-auto items-center rounded-full p-1 max-w-full"
      style={{
        gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))`,
        background: "#E8ECF1",
        boxShadow: "inset 0 1px 2px rgba(15, 23, 42, 0.12), inset 0 -1px 1px rgba(255,255,255,0.7)",
      }}
    >
      <motion.span
        aria-hidden
        className="absolute top-1 bottom-1 left-1 rounded-full bg-white"
        style={{
          width: `calc(${100 / colCount}% - 4px)`,
          boxShadow: "0 1px 3px rgba(15, 23, 42, 0.16), 0 0 0 1px rgba(15, 23, 42, 0.04)",
        }}
        animate={{ x: `${activeIdx * 100}%` }}
        transition={{ type: "spring", stiffness: 420, damping: 36 }}
      />
      {colCount === 2 && (
        <span aria-hidden className="pointer-events-none absolute left-1/2 top-2 bottom-2 w-px -translate-x-1/2 bg-slate-300/70 z-[1]" />
      )}
      {options.map((opt) => {
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            data-testid={`${testId}-${opt.id}`}
            aria-pressed={active}
            onClick={() => onChange(opt.id)}
            className={`relative z-[2] min-w-[3.75rem] px-3 py-1.5 text-[13px] leading-none transition-colors ${
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

/** Fit every unit label without skipping ticks or scrolling the chart. */
function categoryAxisProps(count) {
  if (count <= 14) return { angle: -35, fontSize: 10, height: 72 };
  if (count <= 28) return { angle: -55, fontSize: 9, height: 100 };
  return { angle: -90, fontSize: 8, height: 140 };
}

function labelColumnWidth(rows) {
  const longest = rows.reduce((m, r) => Math.max(m, String(r.unit || "").length), 0);
  return Math.min(200, Math.max(96, Math.ceil(longest * 6.6)));
}

function chartBodyHeight(count, geometry) {
  if (geometry === "quadrant") return 480;
  if (geometry === "horizontal") return Math.max(320, count * 18);
  const axis = categoryAxisProps(count).height;
  return 220 + axis;
}

function niceCeil(value, step = 1) {
  if (!Number.isFinite(value) || value <= 0) return step;
  return Math.ceil(value / step) * step;
}

function VerticalBarChart({ data, c, byRange, onSelectUnit }) {
  const axis = categoryAxisProps(data.length);
  // 180° flip: reverse category order and Y so negative (favourable) bars rise from the bottom
  const plotData = c.flip180 ? [...data].reverse() : data;
  return (
    <BarChart
      data={plotData}
      margin={{ top: 10, right: 12, left: 0, bottom: 4 }}
      onClick={(e) => {
        if (!e?.activeLabel || byRange) return;
        onSelectUnit(e.activeLabel);
      }}
    >
      <CartesianGrid strokeDasharray="2 4" stroke={CHART.grid} vertical={false} />
      <XAxis
        dataKey="unit"
        interval={0}
        angle={axis.angle}
        textAnchor="end"
        height={axis.height}
        tick={{ fontSize: axis.fontSize, fill: CHART.tick }}
        minTickGap={0}
      />
      <YAxis tick={{ fontSize: 10, fill: CHART.tick }} reversed={!!c.rank || !!c.flip180} width={42} />
      <Tooltip content={<TipBox />} cursor={{ fill: CHART.cursor }} />
      {c.keys.length > 1 && (
        <Legend
          wrapperStyle={{ fontSize: 11 }}
          verticalAlign="top"
          height={28}
          payload={keysLegendPayload(c.keys)}
        />
      )}
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
          {c.signed && plotData.map((r) => (
            <Cell key={r.unit} fill={signedFill(r[k], c.invert)} />
          ))}
        </Bar>
      ))}
    </BarChart>
  );
}

function HorizontalBarChart({ data, c, byRange, onSelectUnit }) {
  const yWidth = labelColumnWidth(data);
  const fontSize = data.length > 36 ? 9 : 10;
  return (
    <BarChart
      data={data}
      layout="vertical"
      margin={{ top: 8, right: 16, left: 4, bottom: 8 }}
      onClick={(e) => {
        if (!e?.activeLabel || byRange) return;
        onSelectUnit(e.activeLabel);
      }}
    >
      <CartesianGrid strokeDasharray="2 4" stroke={CHART.grid} horizontal={false} />
      <XAxis type="number" tick={{ fontSize: 10, fill: CHART.tick }} />
      <YAxis
        type="category"
        dataKey="unit"
        width={yWidth}
        tick={{ fontSize, fill: CHART.tick }}
        interval={0}
        minTickGap={0}
      />
      <Tooltip content={<TipBox />} cursor={{ fill: CHART.cursor }} />
      {c.keys.length > 1 && (
        <Legend
          wrapperStyle={{ fontSize: 11 }}
          verticalAlign="top"
          height={28}
          payload={keysLegendPayload(c.keys)}
        />
      )}
      {c.signed && <ReferenceLine x={0} stroke="#334155" />}
      {c.keys.map(([k, name], i) => (
        <Bar
          key={k}
          dataKey={k}
          name={name}
          fill={c.keys.length > 1 ? CHART.dual[i] : CHART.navy}
          radius={[0, 2, 2, 0]}
          className={byRange ? undefined : "cursor-pointer"}
          isAnimationActive
          animationDuration={CHART.animationDuration}
        >
          {c.signed && data.map((r) => (
            <Cell key={`${r.unit}-${k}`} fill={signedFill(r[k], c.invert)} />
          ))}
        </Bar>
      ))}
    </BarChart>
  );
}

function LinePlotChart({ data, c, byRange, onSelectUnit }) {
  const axis = categoryAxisProps(data.length);
  return (
    <LineChart
      data={data}
      margin={{ top: 10, right: 12, left: 0, bottom: 4 }}
      onClick={(e) => {
        if (!e?.activeLabel || byRange) return;
        onSelectUnit(e.activeLabel);
      }}
    >
      <CartesianGrid strokeDasharray="2 4" stroke={CHART.grid} vertical={false} />
      <XAxis
        dataKey="unit"
        interval={0}
        angle={axis.angle}
        textAnchor="end"
        height={axis.height}
        tick={{ fontSize: axis.fontSize, fill: CHART.tick }}
        minTickGap={0}
      />
      <YAxis tick={{ fontSize: 10, fill: CHART.tick }} width={42} reversed={!!c.rank} />
      <Tooltip content={<TipBox />} cursor={{ stroke: CHART.navySoft, strokeWidth: 1 }} />
      {c.keys.length > 1 && (
        <Legend
          wrapperStyle={{ fontSize: 11 }}
          verticalAlign="top"
          height={28}
          payload={keysLegendPayload(c.keys)}
        />
      )}
      {c.signed && <ReferenceLine y={0} stroke="#334155" />}
      {c.keys.map(([k, name], i) => (
        <Line
          key={k}
          type="monotone"
          dataKey={k}
          name={name}
          stroke={c.keys.length > 1 ? CHART.dual[i] : CHART.navy}
          strokeWidth={2}
          dot={{ r: 3, fill: c.keys.length > 1 ? CHART.dual[i] : CHART.navy, strokeWidth: 0 }}
          activeDot={{ r: 5, className: byRange ? undefined : "cursor-pointer" }}
          isAnimationActive
          animationDuration={CHART.animationDuration}
          connectNulls={false}
        />
      ))}
    </LineChart>
  );
}

function AreaPlotChart({ data, c, byRange, onSelectUnit }) {
  const axis = categoryAxisProps(data.length);
  // 180° flip vs inverted rank bars: units right→left, Y normal (0 at bottom, area fills upward)
  const plotData = useMemo(() => [...data].reverse(), [data]);
  return (
    <AreaChart
      data={plotData}
      margin={{ top: 10, right: 12, left: 0, bottom: 4 }}
      onClick={(e) => {
        if (!e?.activeLabel || byRange) return;
        onSelectUnit(e.activeLabel);
      }}
    >
      <CartesianGrid strokeDasharray="2 4" stroke={CHART.grid} vertical={false} />
      <XAxis
        dataKey="unit"
        interval={0}
        angle={axis.angle}
        textAnchor="end"
        height={axis.height}
        tick={{ fontSize: axis.fontSize, fill: CHART.tick }}
        minTickGap={0}
      />
      <YAxis tick={{ fontSize: 10, fill: CHART.tick }} width={42} />
      <Tooltip content={<TipBox />} cursor={{ stroke: CHART.navySoft, strokeWidth: 1 }} />
      {c.keys.length > 1 && (
        <Legend
          wrapperStyle={{ fontSize: 11 }}
          verticalAlign="top"
          height={28}
          payload={keysLegendPayload(c.keys)}
        />
      )}
      {c.signed && <ReferenceLine y={0} stroke="#334155" />}
      {c.keys.map(([k, name], i) => {
        const color = c.keys.length > 1 ? CHART.dual[i] : CHART.navy;
        return (
          <Area
            key={k}
            type="monotone"
            dataKey={k}
            name={name}
            stroke={color}
            fill={color}
            fillOpacity={0.28}
            strokeWidth={2}
            baseValue={0}
            dot={{ r: 2.5, fill: color, strokeWidth: 0 }}
            activeDot={{ r: 5, className: byRange ? undefined : "cursor-pointer" }}
            isAnimationActive
            animationDuration={CHART.animationDuration}
            connectNulls={false}
          />
        );
      })}
    </AreaChart>
  );
}

function DotPlotChart({ data, c, byRange, onSelectUnit }) {
  const [primaryKey, primaryName] = c.keys[0];
  const pointFill = (value) => (c.signed ? signedFill(value, c.invert) : CHART.navy);
  const scatterData = useMemo(
    () => data.map((r, i) => ({
      ...r,
      idx: i,
      _value: r[primaryKey],
    })),
    [data, primaryKey],
  );
  const axis = categoryAxisProps(scatterData.length);

  return (
    <ScatterChart
      margin={{ top: 10, right: 16, left: 0, bottom: 4 }}
      onClick={(e) => {
        const label = e?.activePayload?.[0]?.payload?.unit;
        if (!label || byRange) return;
        onSelectUnit(label);
      }}
    >
      <CartesianGrid strokeDasharray="2 4" stroke={CHART.grid} vertical={false} />
      <XAxis
        type="number"
        dataKey="idx"
        name="unit"
        domain={[-0.5, Math.max(scatterData.length - 0.5, 0.5)]}
        ticks={scatterData.map((d) => d.idx)}
        tickFormatter={(i) => scatterData[i]?.unit || ""}
        interval={0}
        angle={axis.angle}
        textAnchor="end"
        height={axis.height}
        tick={{ fontSize: axis.fontSize, fill: CHART.tick }}
        minTickGap={0}
      />
      <YAxis
        type="number"
        dataKey="_value"
        name={primaryName}
        tick={{ fontSize: 10, fill: CHART.tick }}
      />
      <ZAxis range={[80, 80]} />
      <Tooltip
        cursor={{ strokeDasharray: "3 3" }}
        content={({ active, payload }) => {
          if (!active || !payload?.length) return null;
          const row = payload[0].payload;
          return (
            <TipBox
              active
              label={row.unit}
              payload={[{ dataKey: primaryKey, name: primaryName, value: row._value, color: pointFill(row._value) }]}
            />
          );
        }}
      />
      {c.signed && <ReferenceLine y={0} stroke="#334155" />}
      <Scatter
        name={primaryName}
        data={scatterData}
        fill={CHART.navy}
        className={byRange ? undefined : "cursor-pointer"}
        isAnimationActive
        animationDuration={CHART.animationDuration}
      >
        {scatterData.map((r) => (
          <Cell key={r.unit} fill={pointFill(r._value)} />
        ))}
      </Scatter>
    </ScatterChart>
  );
}

function median(vals) {
  const nums = vals.filter((v) => v != null && !Number.isNaN(Number(v))).map(Number).sort((a, b) => a - b);
  if (!nums.length) return null;
  const mid = Math.floor(nums.length / 2);
  return nums.length % 2 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
}

function quadrantFill(x, y, xMid, yMid) {
  const highX = x >= xMid;
  const highY = y >= yMid;
  if (highX && highY) return CHART.emerald; // high load, high rate
  if (!highX && highY) return CHART.navy; // low load, high rate
  if (highX && !highY) return CHART.rose; // high load, low rate
  return CHART.navySoft; // low load, low rate
}

function QuadrantScatterChart({ data, c, byRange, onSelectUnit }) {
  const xKey = c.xKey || "workload_share";
  const yKey = c.yKey || "latest_rate";
  const xLabel = c.xLabel || "X";
  const yLabel = c.yLabel || "Y";

  const points = useMemo(() => (
    data
      .filter((r) => r[xKey] != null && r[yKey] != null && !Number.isNaN(Number(r[xKey])) && !Number.isNaN(Number(r[yKey])))
      .map((r) => ({
        ...r,
        _x: Number(r[xKey]),
        _y: Number(r[yKey]),
      }))
  ), [data, xKey, yKey]);

  const xMid = useMemo(() => median(points.map((p) => p._x)), [points]);
  const yMid = useMemo(() => median(points.map((p) => p._y)), [points]);
  const xHi = useMemo(() => {
    if (!points.length) return 1;
    const xMax = Math.max(...points.map((p) => p._x));
    return niceCeil(Math.max(xMax * 1.08, (xMid || 0) * 1.5), xMax > 8 ? 1 : 0.5);
  }, [points, xMid]);

  return (
    <ScatterChart
      margin={{ top: 20, right: 24, left: 10, bottom: 24 }}
      onClick={(e) => {
        const label = e?.activePayload?.[0]?.payload?.unit;
        if (!label || byRange) return;
        onSelectUnit(label);
      }}
    >
      <CartesianGrid strokeDasharray="2 4" stroke={CHART.grid} />
      <XAxis
        type="number"
        dataKey="_x"
        name={xLabel}
        domain={[0, xHi]}
        tick={{ fontSize: 10, fill: CHART.tick }}
        label={{ value: xLabel, position: "insideBottom", offset: -8, style: { fill: CHART.tick, fontSize: 11 } }}
      />
      <YAxis
        type="number"
        dataKey="_y"
        name={yLabel}
        domain={[0, 100]}
        tick={{ fontSize: 10, fill: CHART.tick }}
        width={48}
        label={{ value: yLabel, angle: -90, position: "insideLeft", style: { fill: CHART.tick, fontSize: 11 } }}
      />
      <ZAxis type="number" range={[80, 80]} />
      <Tooltip
        cursor={{ strokeDasharray: "3 3" }}
        content={({ active, payload }) => {
          if (!active || !payload?.length) return null;
          const row = payload[0].payload;
          return (
            <TipBox
              active
              label={row.unit}
              payload={[
                { dataKey: xKey, name: xLabel, value: row._x, color: CHART.navy },
                { dataKey: yKey, name: yLabel, value: row._y, color: CHART.amber },
              ]}
            />
          );
        }}
      />
      {xMid != null && (
        <ReferenceLine x={xMid} stroke="#64748B" strokeDasharray="4 4" label={{ value: "Median share", position: "insideTopRight", fill: "#64748B", fontSize: 10 }} />
      )}
      {yMid != null && (
        <ReferenceLine y={yMid} stroke="#64748B" strokeDasharray="4 4" label={{ value: "Median rate", position: "insideTopLeft", fill: "#64748B", fontSize: 10 }} />
      )}
      <Scatter
        name="Units"
        data={points}
        fill={CHART.navy}
        className={byRange ? undefined : "cursor-pointer"}
        isAnimationActive={false}
        shape={(props) => {
          const { cx, cy, fill } = props;
          if (cx == null || cy == null || Number.isNaN(cx) || Number.isNaN(cy)) return null;
          return (
            <circle
              cx={cx}
              cy={cy}
              r={6}
              fill={fill || CHART.navy}
              stroke="#fff"
              strokeWidth={1.25}
              className={byRange ? undefined : "cursor-pointer"}
            />
          );
        }}
      >
        {points.map((r) => (
          <Cell key={r.unit} fill={xMid != null && yMid != null ? quadrantFill(r._x, r._y, xMid, yMid) : CHART.navy} />
        ))}
      </Scatter>
    </ScatterChart>
  );
}

function buildChartData(rows, groupBy, hasRanges, chartDef) {
  let base = rows.filter((r) => r.eligible);
  const useRange = chartDef.forceRange ? hasRanges : (groupBy === "range" && hasRanges);
  if (useRange) base = aggregateByRange(base);
  if (chartDef.sortAlpha) {
    base = [...base].sort((a, b) => String(a.unit || "").localeCompare(String(b.unit || ""), undefined, { sensitivity: "base" }));
  } else if (chartDef.sort || chartDef.rank) {
    base = [...base].sort((a, b) => {
      if (chartDef.rank) return (a.rank ?? 999) - (b.rank ?? 999);
      return (b.overall_score ?? b.marks ?? 0) - (a.overall_score ?? a.marks ?? 0) || (a.rank ?? 0) - (b.rank ?? 0);
    });
  }
  return base;
}

function ChartCard({ chartDef, rows, groupBy, hasRanges, geometry, byRange, onSelectUnit, filterLabel, domain }) {
  const tabOptions = chartDef.tabs || null;
  const [tabId, setTabId] = useState(tabOptions?.[0]?.id || null);
  const activeDef = useMemo(() => {
    if (!tabOptions?.length) return chartDef;
    return tabOptions.find((t) => t.id === tabId) || tabOptions[0];
  }, [chartDef, tabOptions, tabId]);

  const lockedToRange = !!(activeDef.forceRange && hasRanges);
  const cardByRange = lockedToRange || byRange;
  const data = useMemo(
    () => buildChartData(rows, groupBy, hasRanges, activeDef),
    [rows, groupBy, hasRanges, activeDef],
  );
  const isQuadrant = !!activeDef.quadrant;
  const activeGeometry = isQuadrant ? "quadrant" : (activeDef.forceGeometry || (activeDef.signed ? geometry : "bar"));
  const title = isQuadrant
    ? `${activeDef.title} (${cardByRange ? "range" : "unit"})`
    : `${activeDef.title} by ${cardByRange ? "range" : "unit"}`;
  const explain = useMemo(() => resolveChartExplain(domain, activeDef), [domain, activeDef]);
  const countLabel = cardByRange ? `${data.length} ranges` : `${data.length} units`;
  const height = chartBodyHeight(data.length, activeGeometry);

  let chart;
  if (data.length === 0) {
    chart = null;
  } else if (isQuadrant) {
    chart = <QuadrantScatterChart data={data} c={activeDef} byRange={cardByRange} onSelectUnit={onSelectUnit} />;
  } else if (activeGeometry === "horizontal") {
    chart = <HorizontalBarChart data={data} c={activeDef} byRange={cardByRange} onSelectUnit={onSelectUnit} />;
  } else if (activeGeometry === "line") {
    chart = <LinePlotChart data={data} c={activeDef} byRange={cardByRange} onSelectUnit={onSelectUnit} />;
  } else if (activeGeometry === "area") {
    chart = <AreaPlotChart data={data} c={activeDef} byRange={cardByRange} onSelectUnit={onSelectUnit} />;
  } else if (activeGeometry === "dots") {
    chart = <DotPlotChart data={data} c={activeDef} byRange={cardByRange} onSelectUnit={onSelectUnit} />;
  } else {
    chart = <VerticalBarChart data={data} c={activeDef} byRange={cardByRange} onSelectUnit={onSelectUnit} />;
  }

  const tabSwitch = tabOptions ? (
    <PillSwitch
      value={activeDef.id}
      onChange={setTabId}
      options={tabOptions.map((t) => ({ id: t.id, label: t.label }))}
      testId={`chart-tab-${chartDef.id}`}
      ariaLabel={`${chartDef.label || chartDef.id} chart view`}
      cols={tabOptions.length}
    />
  ) : null;

  const titleNode = (
    <span className="inline-flex items-center gap-2 min-w-0">
      <span className="min-w-0">{title}</span>
      <ChartExplainButton explain={explain} testId={`chart-info-${chartDef.id}-${activeDef.id}`} />
    </span>
  );

  return (
    <Panel
      testId={`chart-card-${chartDef.id}`}
      title={titleNode}
      subtitle={`${activeDef.unit} · ${filterLabel} · ${countLabel}${lockedToRange ? " · always by range" : ""}${isQuadrant ? " · green = high share & high rate · red = high share & low rate" : ""}`}
      right={tabSwitch}
    >
      {data.length === 0 || !chart ? (
        <div className="h-[280px] flex items-center justify-center text-sm text-slate-500" data-testid={`chart-empty-${chartDef.id}`}>
          No score-eligible units match the current filters.
        </div>
      ) : (
        <div
          className={`w-full min-w-0 ${isQuadrant ? "overflow-visible" : "overflow-hidden"}`}
          style={{ height, width: "100%" }}
          data-testid={`chart-geometry-${chartDef.id}-${activeGeometry}`}
        >
          <ResponsiveContainer width="100%" height="100%">
            {chart}
          </ResponsiveContainer>
        </div>
      )}
    </Panel>
  );
}

function renderChartGrid(chartDefs, props) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {chartDefs.map((chartDef) => (
        <div key={chartDef.id} className={chartDef.tabs ? "xl:col-span-2" : undefined}>
          <ChartCard chartDef={chartDef} {...props} />
        </div>
      ))}
    </div>
  );
}

export default function ChartsPanel({ domain, rows, onSelectUnit, filterLabel }) {
  const defs = CHARTS[domain] || [];
  const [groupBy, setGroupBy] = useState("unit");
  const hasRanges = useMemo(() => rows.some((r) => r.range), [rows]);
  const byRange = groupBy === "range" && hasRanges;
  // Always-by-range charts sit above the Unit charts toolbar
  const pinnedRangeDefs = useMemo(() => defs.filter((d) => d.forceRange), [defs]);
  const unitDefs = useMemo(() => defs.filter((d) => !d.forceRange), [defs]);
  const cardProps = {
    domain,
    rows,
    groupBy,
    hasRanges,
    geometry: "bar",
    byRange,
    onSelectUnit,
    filterLabel,
  };

  return (
    <div className="space-y-4" data-testid={`chart-panel-${domain}`}>
      {pinnedRangeDefs.length > 0 && (
        <div className="space-y-3" data-testid="chart-pinned-range">
          <div>
            <div className="text-[11px] uppercase tracking-[0.14em] font-semibold text-slate-500">Range charts</div>
            <p className="text-xs text-slate-500 mt-0.5">
              {pinnedRangeDefs.length} views · {filterLabel} · always by range
            </p>
          </div>
          {renderChartGrid(pinnedRangeDefs, cardProps)}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.14em] font-semibold text-slate-500">Unit charts</div>
          <p className="text-xs text-slate-500 mt-0.5">
            {unitDefs.length} views · {filterLabel}
            {byRange ? " · grouped by range" : " · by unit"}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {hasRanges && (
            <PillSwitch
              value={groupBy}
              onChange={setGroupBy}
              options={[{ id: "range", label: "Range" }, { id: "unit", label: "Unit" }]}
              testId="chart-group-switch"
              ariaLabel="Chart grouping"
              cols={2}
            />
          )}
        </div>
      </div>

      {renderChartGrid(unitDefs, cardProps)}

      <p className="text-[11px] text-slate-500">
        {byRange
          ? "Values show each range aggregated from its units. Switch to Unit to open a worked score explanation."
          : "Click a bar or point to open that unit's worked score explanation. The ranking table below is the accessible table equivalent."}
      </p>
    </div>
  );
}
