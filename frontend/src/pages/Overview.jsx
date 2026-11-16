import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Loader2, ArrowRight, TrendingUp, TrendingDown } from "lucide-react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { useApi, errMsg } from "@/lib/api";
import { Panel, Kpi, Delta, CategoryBadge } from "@/components/Primitives";
import { CATEGORY_STYLES, fmt, fmtInt, fmtDate } from "@/lib/format";
import CombinedIndex from "@/components/CombinedIndex";
import { fadeUp, staggerContainer, staggerFast } from "@/lib/motion";
import { CHART } from "@/lib/chartTheme";

const TITLES = { conviction: "Conviction", timeliness: "Charge Sheet Timeliness", emergency112: "112 Performance", training: "Training Performance" };
const RATE = { conviction: "Conviction rate", timeliness: "Within-time rate", emergency112: "% closed ≤100m", training: "% people trained" };
const DOMAIN_PATH = { conviction: "conviction", timeliness: "timeliness", emergency112: "112", training: "training" };

const UnitList = ({ title, icon: Icon, rows, tone, testId }) => (
  <div data-testid={testId}>
    <div className={`flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-bold mb-2 ${tone}`}><Icon className="h-3.5 w-3.5" />{title}</div>
    {rows.map((r) => (
      <div key={r.unit} className="flex items-center justify-between py-1.5 border-b border-slate-100 text-sm">
        <span className="truncate"><span className={`font-num text-xs mr-2 ${r.rank === 1 ? "text-amber-600 font-bold" : "text-slate-400"}`}>#{r.rank}</span>{r.unit}</span>
        <span className="font-num font-semibold">{fmt(r.overall_score)}</span>
      </div>
    ))}
  </div>
);

const Distribution = ({ dist }) => {
  const data = Object.entries(dist).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value }));
  return (
    <div className="flex items-center gap-5">
      <div className="h-36 w-36 shrink-0">
        <ResponsiveContainer>
          <PieChart>
            <Pie data={data} dataKey="value" innerRadius={38} outerRadius={64} paddingAngle={2} stroke="none" isAnimationActive animationDuration={CHART.animationDuration}>
              {data.map((d) => <Cell key={d.name} fill={(CATEGORY_STYLES[d.name] || CATEGORY_STYLES["Not scored"]).color} />)}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="space-y-2">
        {Object.entries(dist).map(([k, v]) => (
          <div key={k} className="flex items-center gap-2.5 text-xs">
            <CategoryBadge value={k} />
            <span className="font-num font-semibold text-slate-800">{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const DomainBlock = ({ domain, d }) => (
  <motion.section variants={fadeUp} className="space-y-4" data-testid={`overview-${domain}`}>
    <div className="flex items-end justify-between gap-4">
      <div>
        <h2 className="font-display text-xl font-semibold text-slate-900 tracking-tight">{TITLES[domain]}</h2>
        <p className="text-xs text-slate-500 mt-0.5">{d.type} · {d.base} → {d.latest} · data as of {fmtDate(d.as_of)}</p>
      </div>
      <Link
        to={`/${DOMAIN_PATH[domain] || domain}`}
        className="group text-sm text-blue-900 hover:text-amber-700 inline-flex items-center gap-1.5 font-medium transition-colors"
        data-testid={`overview-open-${domain}`}
      >
        Open dashboard
        <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
      </Link>
    </div>
    <motion.div variants={staggerFast} initial="hidden" animate="show" className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <Kpi label={`Base ${RATE[domain].toLowerCase()}`} value={`${fmt(d.totals.base_rate)}%`} sub={`${fmtInt(d.totals.base_num)} / ${fmtInt(d.totals.base_den)}`} testId={`ov-${domain}-base-rate`}
        formula={{
          description: `${RATE[domain]} for the base period from summed statewide counts (not an average of unit rates).`,
          expression: "(Σ numerator ÷ Σ denominator) × 100",
          example: `(${fmtInt(d.totals.base_num)} ÷ ${fmtInt(d.totals.base_den)}) × 100 = ${fmt(d.totals.base_rate)}%`,
        }} />
      <Kpi label={`Latest ${RATE[domain].toLowerCase()}`} value={`${fmt(d.totals.latest_rate)}%`} sub={`${fmtInt(d.totals.latest_num)} / ${fmtInt(d.totals.latest_den)}`} accent testId={`ov-${domain}-latest-rate`}
        formula={{
          description: `${RATE[domain]} for the latest period from summed statewide counts.`,
          expression: "(Σ numerator ÷ Σ denominator) × 100",
          example: `(${fmtInt(d.totals.latest_num)} ÷ ${fmtInt(d.totals.latest_den)}) × 100 = ${fmt(d.totals.latest_rate)}%`,
        }} />
      <Kpi label="Improvement" value={<Delta value={d.totals.improvement} />} sub="percentage points" testId={`ov-${domain}-improvement`}
        formula={{
          description: "Change in the statewide rate between latest and base periods, in percentage points.",
          expression: "Latest rate − Base rate",
          example: `${fmt(d.totals.latest_rate)}% − ${fmt(d.totals.base_rate)}% = ${d.totals.improvement == null ? "—" : `${d.totals.improvement >= 0 ? "+" : ""}${fmt(d.totals.improvement)} pp`}`,
        }} />
      <Kpi label="Avg overall score" value={fmt(d.totals.avg_overall_score)} sub={`${d.totals.scored_count} of ${d.totals.unit_count} units scored`} testId={`ov-${domain}-avg`}
        formula={{
          description: "Mean of unit overall scores. Each unit score blends performance against the statewide cohort with improvement over the base period (default 70% / 30%).",
          expression: "Avg(unit overall score)\nUnit overall = (perf weight × performance score) + (improvement weight × improvement score)",
          example: `${d.totals.scored_count} of ${d.totals.unit_count} units scored · average ${fmt(d.totals.avg_overall_score)}`,
        }} />
    </motion.div>
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Panel title="Top & bottom units" subtitle="By overall score">
        <div className="space-y-5">
          <UnitList title="Top 5" icon={TrendingUp} rows={d.top} tone="text-emerald-700" testId={`ov-${domain}-top`} />
          <UnitList title="Bottom 5" icon={TrendingDown} rows={d.bottom} tone="text-rose-700" testId={`ov-${domain}-bottom`} />
        </div>
      </Panel>
      <Panel title="Category distribution" subtitle="Units per category"><Distribution dist={d.distribution} /></Panel>
      <Panel title={(domain === "emergency112" || domain === "training") ? "Unit snapshot" : "Range comparison"} subtitle={(domain === "emergency112" || domain === "training") ? "Average score" : "Average overall score per range"}>
        <div className="space-y-2.5" data-testid={`ov-${domain}-ranges`}>
          {(domain === "emergency112" || domain === "training") ? (
            <div className="text-sm text-slate-600">
              <div className="flex justify-between py-1"><span>Units scored</span><span className="font-num font-semibold">{d.totals.scored_count} / {d.totals.unit_count}</span></div>
              <div className="flex justify-between py-1"><span>Avg score</span><span className="font-num font-semibold">{fmt(d.totals.avg_overall_score)}</span></div>
              <div className="flex justify-between py-1"><span>Latest {RATE[domain]}</span><span className="font-num font-semibold">{fmt(d.totals.latest_rate)}%</span></div>
              {domain === "training" && <div className="flex justify-between py-1"><span>Avg Ranking marks</span><span className="font-num font-semibold">{fmt(d.totals.avg_marks, 1)}</span></div>}
            </div>
          ) : d.ranges.map((r, i) => (
            <div key={r.range} className="text-xs" style={{ animationDelay: `${i * 40}ms` }}>
              <div className="flex justify-between mb-1">
                <span className="text-slate-700 truncate">{r.range} <span className="text-slate-400">({r.unit_count})</span></span>
                <span className="font-num font-semibold">{fmt(r.avg_overall_score, 1)}</span>
              </div>
              <div className="h-1.5 bg-slate-100 rounded-sm overflow-hidden">
                <div className="h-full bg-blue-900 bar-grow rounded-sm" style={{ width: `${Math.max(0, r.avg_overall_score || 0)}%`, animationDelay: `${80 + i * 50}ms` }} />
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  </motion.section>
);

export default function Overview() {
  const api = useApi();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => { api("get", "/overview").then(setData).catch((e) => setError(errMsg(e))); }, [api]);
  if (error) return <div className="text-rose-700 text-sm mt-10" data-testid="overview-error">{error}</div>;
  if (!data) return <div className="flex items-center gap-2 text-slate-500 mt-20 justify-center"><Loader2 className="h-5 w-5 animate-spin" />Loading overview…</div>;
  return (
    <motion.div className="space-y-10" data-testid="overview-page" variants={staggerContainer} initial="hidden" animate="show">
      <motion.div variants={fadeUp} className="bg-slate-950 text-white rounded-sm p-8 md:p-10 relative overflow-hidden">
        <div className="absolute inset-0 grid-texture grid-texture-animated" />
        <div className="absolute -top-20 right-0 h-56 w-56 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
        <div className="relative">
          <div className="text-[11px] uppercase tracking-[0.25em] text-amber-400 font-semibold">Executive overview</div>
          <div className="h-0.5 w-10 bg-amber-400 mt-3 mb-4 rounded-full" />
          <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight">
            {Object.values(data)[0]?.scope_range ? `${Object.values(data)[0].scope_range} at a glance` : "State performance at a glance"}
          </h1>
          <p className="text-slate-400 mt-3 max-w-2xl text-sm md:text-base leading-relaxed">
            Conviction, charge-sheet timeliness, 112 emergency response, and training are scored separately, then combined. Default blend is equal weight across the four domains.
          </p>
        </div>
      </motion.div>
      {Object.entries(data).map(([k, d]) => <DomainBlock key={k} domain={k} d={d} />)}
      <CombinedIndex />
    </motion.div>
  );
}
