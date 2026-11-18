import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
  ReferenceLine,
} from "recharts";
import { CHART, TipBox } from "@/lib/chartTheme";
import { fmt } from "@/lib/format";

const ChartCard = ({ title, subtitle, children, testId }) => (
  <div className="surface-panel rounded-sm border border-slate-200/80 p-3" data-testid={testId}>
    <div className="text-[10px] uppercase tracking-[0.14em] font-semibold text-slate-500">{title}</div>
    {subtitle && <div className="text-[11px] text-slate-500 mt-0.5 mb-2">{subtitle}</div>}
    <div className="h-[148px] w-full">{children}</div>
  </div>
);

const Axis = {
  tick: { fill: CHART.tick, fontSize: 10 },
  axisLine: false,
  tickLine: false,
};

function RateChart({ row, base, latest, rateLabel }) {
  const data = [
    { name: base || "Base", value: row.base_rate, fill: CHART.navySoft },
    { name: latest || "Latest", value: row.latest_rate, fill: CHART.navy },
  ];
  return (
    <ChartCard title={`${rateLabel} · base vs latest`} subtitle="Higher is better" testId="explain-chart-rates">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <CartesianGrid stroke={CHART.grid} vertical={false} />
          <XAxis dataKey="name" {...Axis} interval={0} />
          <YAxis {...Axis} unit="%" width={40} />
          <Tooltip content={<TipBox unit="%" />} cursor={{ fill: CHART.cursor }} />
          <Bar dataKey="value" name={rateLabel} radius={[2, 2, 0, 0]} isAnimationActive animationDuration={CHART.animationDuration}>
            {data.map((d) => <Cell key={d.name} fill={d.fill} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

function VolumeChart({ row, labels, base, latest }) {
  const den = labels?.den || "Denominator";
  const num = labels?.num || "Numerator";
  const data = [
    { name: base || "Base", den: row.base_den ?? 0, num: row.base_num ?? 0 },
    { name: latest || "Latest", den: row.latest_den ?? 0, num: row.latest_num ?? 0 },
  ];
  return (
    <ChartCard title="Case volume" subtitle={`${den} vs ${num}`} testId="explain-chart-volume">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
          <CartesianGrid stroke={CHART.grid} vertical={false} />
          <XAxis dataKey="name" {...Axis} interval={0} />
          <YAxis {...Axis} width={44} />
          <Tooltip content={<TipBox />} cursor={{ fill: CHART.cursor }} />
          <Bar dataKey="den" name={den} fill={CHART.navySoft} radius={[2, 2, 0, 0]} isAnimationActive animationDuration={CHART.animationDuration} />
          <Bar dataKey="num" name={num} fill={CHART.amber} radius={[2, 2, 0, 0]} isAnimationActive animationDuration={CHART.animationDuration} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

function CohortChart({ row, cohort, rateLabel }) {
  if (cohort?.min_rate == null || cohort?.max_rate == null || row.latest_rate == null) return null;
  const data = [
    { name: "Cohort min", value: cohort.min_rate, fill: CHART.rose },
    { name: "This unit", value: row.latest_rate, fill: CHART.navy },
    { name: "Cohort max", value: cohort.max_rate, fill: CHART.emerald },
  ];
  return (
    <ChartCard
      title="Latest rate in cohort"
      subtitle={`Min ${cohort.min_unit || ""} · Max ${cohort.max_unit || ""}`.trim()}
      testId="explain-chart-cohort"
    >
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <CartesianGrid stroke={CHART.grid} vertical={false} />
          <XAxis dataKey="name" {...Axis} interval={0} />
          <YAxis {...Axis} unit="%" width={40} />
          <Tooltip content={<TipBox unit="%" />} cursor={{ fill: CHART.cursor }} />
          <Bar dataKey="value" name={rateLabel} radius={[2, 2, 0, 0]} isAnimationActive animationDuration={CHART.animationDuration}>
            {data.map((d) => <Cell key={d.name} fill={d.fill} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

function ScoreChart({ row, weight }) {
  const w = weight ?? 0.7;
  const perf = row.performance_score;
  const imp = row.improvement_score;
  if (perf == null && imp == null) {
    if (row.overall_score == null) return null;
    return (
      <ChartCard title="Overall score" subtitle="0–100 scale" testId="explain-chart-score">
        <ResponsiveContainer>
          <BarChart data={[{ name: "Overall", value: row.overall_score }]} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
            <CartesianGrid stroke={CHART.grid} vertical={false} />
            <XAxis dataKey="name" {...Axis} />
            <YAxis {...Axis} domain={[0, 100]} width={36} />
            <Tooltip content={<TipBox />} cursor={{ fill: CHART.cursor }} />
            <Bar dataKey="value" name="Overall score" fill={CHART.navy} radius={[2, 2, 0, 0]} isAnimationActive animationDuration={CHART.animationDuration} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    );
  }
  const data = [
    { name: `Performance (${Math.round(w * 100)}%)`, value: perf ?? 0, fill: CHART.navy },
    { name: `Improvement (${Math.round((1 - w) * 100)}%)`, value: imp ?? 0, fill: CHART.amber },
  ];
  return (
    <ChartCard
      title="Score composition"
      subtitle={`Overall ${fmt(row.overall_score)} = weighted blend`}
      testId="explain-chart-score"
    >
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
          <CartesianGrid stroke={CHART.grid} horizontal={false} />
          <XAxis type="number" domain={[0, 100]} {...Axis} />
          <YAxis type="category" dataKey="name" width={118} {...Axis} />
          <Tooltip content={<TipBox />} cursor={{ fill: CHART.cursor }} />
          <ReferenceLine x={row.overall_score} stroke={CHART.emerald} strokeDasharray="4 3" />
          <Bar dataKey="value" name="Score" radius={[0, 2, 2, 0]} isAnimationActive animationDuration={CHART.animationDuration}>
            {data.map((d) => <Cell key={d.name} fill={d.fill} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

function RankMoveChart({ row }) {
  if (row.rank == null) return null;
  const prev = row.prev_rank;
  const data = prev != null
    ? [
        { name: "Previous", value: prev, fill: CHART.navySoft },
        { name: "Current", value: row.rank, fill: CHART.navy },
      ]
    : [{ name: "Current rank", value: row.rank, fill: CHART.navy }];
  const move = row.rank_movement;
  return (
    <ChartCard
      title="Rank position"
      subtitle={move == null ? "Current rank (1 = best)" : `Moved ${move > 0 ? "up" : move < 0 ? "down" : "unchanged"} ${move === 0 ? "" : Math.abs(move)} · was #${prev}`}
      testId="explain-chart-rank"
    >
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <CartesianGrid stroke={CHART.grid} vertical={false} />
          <XAxis dataKey="name" {...Axis} />
          <YAxis reversed {...Axis} allowDecimals={false} width={36} />
          <Tooltip content={<TipBox />} cursor={{ fill: CHART.cursor }} />
          <Bar dataKey="value" name="Rank" radius={[2, 2, 0, 0]} isAnimationActive animationDuration={CHART.animationDuration}>
            {data.map((d) => <Cell key={d.name} fill={d.fill} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

function AntfChart({ row }) {
  const data = [
    { name: "Meetings", value: row.meetings ?? 0, fill: CHART.navy },
    { name: "MoM uploaded", value: row.mom_uploaded ?? 0, fill: CHART.amber },
    { name: "Total marks", value: row.marks ?? 0, fill: CHART.emerald },
  ];
  return (
    <ChartCard title="ANTF snapshot" subtitle="Meetings, uploads, marks" testId="explain-chart-antf">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <CartesianGrid stroke={CHART.grid} vertical={false} />
          <XAxis dataKey="name" {...Axis} interval={0} />
          <YAxis {...Axis} width={36} />
          <Tooltip content={<TipBox />} cursor={{ fill: CHART.cursor }} />
          <Bar dataKey="value" name="Count" radius={[2, 2, 0, 0]} isAnimationActive animationDuration={CHART.animationDuration}>
            {data.map((d) => <Cell key={d.name} fill={d.fill} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

/**
 * Visual summary strip for Worked Explanation — 2–4 compact charts from explain payload.
 */
export default function ExplainVisuals({ domain, row, cohort, labels, base, latest }) {
  if (!row) return null;

  const rateLabel = labels?.rate || "Rate";
  const weight = cohort?.weight;
  const charts = [];

  if (domain === "antf") {
    charts.push(<AntfChart key="antf" row={row} />);
    charts.push(<RankMoveChart key="rank" row={row} />);
  } else {
    if (row.base_rate != null || row.latest_rate != null) {
      charts.push(<RateChart key="rates" row={row} base={base} latest={latest} rateLabel={rateLabel} />);
    }
    if (row.base_den != null || row.latest_den != null) {
      charts.push(<VolumeChart key="volume" row={row} labels={labels} base={base} latest={latest} />);
    }
    const cohortChart = <CohortChart key="cohort" row={row} cohort={cohort} rateLabel={rateLabel} />;
    if (cohort?.min_rate != null) charts.push(cohortChart);
    if (row.performance_score != null || row.improvement_score != null || row.overall_score != null) {
      charts.push(<ScoreChart key="score" row={row} weight={weight} />);
    } else if (row.rank != null) {
      charts.push(<RankMoveChart key="rank" row={row} />);
    }
  }

  const shown = charts.filter(Boolean).slice(0, 4);
  if (!shown.length) return null;

  return (
    <div className="mt-4 mb-2" data-testid="explain-visuals">
      <div className="text-[10px] uppercase tracking-[0.16em] font-bold text-slate-500 mb-2">Visual summary</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{shown}</div>
      <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
        Charts mirror the calculation steps below — useful when sharing this unit&apos;s score story at a glance.
      </p>
    </div>
  );
}
