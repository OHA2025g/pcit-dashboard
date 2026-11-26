import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Loader2, ArrowRight, TrendingUp, TrendingDown } from "lucide-react";
import { useApi, errMsg } from "@/lib/api";
import { Panel, Kpi, Delta } from "@/components/Primitives";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fmt, fmtInt, fmtDate } from "@/lib/format";
import MaharashtraMap from "@/components/MaharashtraMap";
import CategoryDistributionChart from "@/components/CategoryDistributionChart";
import ConvictionExecutiveOverview from "@/components/ConvictionExecutiveOverview";
import TimelinessExecutiveOverview from "@/components/TimelinessExecutiveOverview";
import Emergency112ExecutiveOverview from "@/components/Emergency112ExecutiveOverview";
import HspExecutiveOverview from "@/components/HspExecutiveOverview";
import { fadeUp, staggerContainer, staggerFast } from "@/lib/motion";

// Training & ANTF kept for DomainBlock/API; temporarily omitted from Overview tabs only.
const DOMAIN_ORDER = ["conviction", "timeliness", "emergency112", "hsp"];
const TITLES = { conviction: "Conviction", timeliness: "Charge Sheet Timeliness", emergency112: "112 Performance", hsp: "HSP Performance", training: "Training Performance", antf: "ANTF Meetings" };
const TAB_LABELS = { conviction: "Conviction", timeliness: "60-90 Charge Sheet", emergency112: "112", hsp: "HSP", map: "Map" };
const MAP_TAB = "map";
const RATE = { conviction: "Conviction rate", timeliness: "Within-time rate", emergency112: "% closed ≤100m", hsp: "Final score", training: "% people trained", antf: "Total marks" };
const DOMAIN_PATH = { conviction: "conviction", timeliness: "timeliness", emergency112: "112", hsp: "hsp", training: "training", antf: "antf" };

const UnitList = ({ title, icon: Icon, rows, tone, testId }) => (
  <div data-testid={testId}>
    <div className={`flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-bold mb-2 ${tone}`}><Icon className="h-3.5 w-3.5" />{title}</div>
    {rows.map((r) => (
      <div key={r.unit} className="flex items-center justify-between py-1.5 border-b border-slate-100 text-sm">
        <span className="truncate"><span className={`font-num text-xs mr-2 ${r.rank === 1 ? "text-teal-600 font-bold" : "text-slate-400"}`}>#{r.rank}</span>{r.unit}</span>
        <span className="font-num font-semibold">{fmt(r.overall_score)}</span>
      </div>
    ))}
  </div>
);

const DomainBlock = ({ domain, d }) => (
  <motion.section variants={fadeUp} className="space-y-4" data-testid={`overview-${domain}`}>
    <div className="flex items-end justify-between gap-4">
      <div>
        <h2 className="font-display text-xl font-semibold text-slate-900 tracking-tight">{TITLES[domain]}</h2>
        <p className="text-xs text-slate-500 mt-0.5">{d.type} · {d.base} → {d.latest} · data as of {fmtDate(d.as_of)}</p>
      </div>
      <Link
        to={`/${DOMAIN_PATH[domain] || domain}`}
        className="group text-sm text-brand-navy hover:text-teal-700 inline-flex items-center gap-1.5 font-medium transition-colors"
        data-testid={`overview-open-${domain}`}
      >
        Open dashboard
        <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
      </Link>
    </div>
    <motion.div variants={staggerFast} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {domain === "antf" ? (
        <>
          <Kpi label="Total meetings from Jan 2026" value={fmtInt(d.totals.total_meetings)} sub={d.latest} accent testId={`ov-${domain}-meetings`} />
          <Kpi label="MoM uploaded (NCORD)" value={fmtInt(d.totals.total_mom_uploaded)} sub="Months with minutes" testId={`ov-${domain}-mom`} />
          <Kpi label="Total marks scored" value={fmtInt(d.totals.total_marks)} sub="Meetings×3 + MoM×2" accent testId={`ov-${domain}-marks`} />
          <Kpi label="Avg marks / unit" value={fmt(d.totals.avg_marks, 1)} sub={`${d.totals.scored_count} of ${d.totals.unit_count} units`} testId={`ov-${domain}-avg`} />
        </>
      ) : domain === "hsp" ? (
        <>
          <Kpi label="Latest accidents" value={fmtInt(d.totals.total_accidents)} sub={d.latest} accent testId={`ov-${domain}-accidents`} />
          <Kpi label="Latest killed" value={fmtInt(d.totals.total_killed)} sub={d.latest} accent testId={`ov-${domain}-killed`} />
          <Kpi label="Latest injured" value={fmtInt(d.totals.total_injured)} sub={d.latest} testId={`ov-${domain}-injured`} />
          <Kpi label="Avg final score" value={fmt(d.totals.avg_overall_score)} sub={`${d.totals.scored_count} of ${d.totals.unit_count} units`} testId={`ov-${domain}-avg`} />
        </>
      ) : (
        <>
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
        </>
      )}
    </motion.div>
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Panel title="Top & bottom units" subtitle="By overall score">
        <div className="space-y-5">
          <UnitList title="Top 5" icon={TrendingUp} rows={d.top} tone="text-emerald-700" testId={`ov-${domain}-top`} />
          <UnitList title="Bottom 5" icon={TrendingDown} rows={d.bottom} tone="text-rose-700" testId={`ov-${domain}-bottom`} />
        </div>
      </Panel>
      <Panel title="Category distribution" subtitle="Units per category" bodyClassName="flex items-center justify-center">
        <CategoryDistributionChart
          dist={d.distribution}
          unitsByCategory={d.units_by_category || {}}
          testId={`ov-${domain}-categories`}
        />
      </Panel>
      <Panel title={(domain === "emergency112" || domain === "training" || domain === "antf" || domain === "hsp") ? "Unit snapshot" : "Range comparison"} subtitle={(domain === "emergency112" || domain === "training" || domain === "antf" || domain === "hsp") ? "Average score" : "Average overall score per range"}>
        <div className="space-y-2.5" data-testid={`ov-${domain}-ranges`}>
          {(domain === "emergency112" || domain === "training" || domain === "antf" || domain === "hsp") ? (
            <div className="text-sm text-slate-600">
              <div className="flex justify-between py-1"><span>Units scored</span><span className="font-num font-semibold">{d.totals.scored_count} / {d.totals.unit_count}</span></div>
              <div className="flex justify-between py-1"><span>Avg score</span><span className="font-num font-semibold">{fmt(d.totals.avg_overall_score)}</span></div>
              {domain !== "antf" && domain !== "hsp" && <div className="flex justify-between py-1"><span>Latest {RATE[domain]}</span><span className="font-num font-semibold">{fmt(d.totals.latest_rate)}%</span></div>}
              {domain === "training" && <div className="flex justify-between py-1"><span>Avg Ranking marks</span><span className="font-num font-semibold">{fmt(d.totals.avg_marks, 1)}</span></div>}
              {domain === "antf" && <div className="flex justify-between py-1"><span>Total meetings</span><span className="font-num font-semibold">{fmtInt(d.totals.total_meetings)}</span></div>}
              {domain === "antf" && <div className="flex justify-between py-1"><span>Avg marks</span><span className="font-num font-semibold">{fmt(d.totals.avg_marks, 1)}</span></div>}
              {domain === "hsp" && <div className="flex justify-between py-1"><span>Latest accidents</span><span className="font-num font-semibold">{fmtInt(d.totals.total_accidents)}</span></div>}
              {domain === "hsp" && <div className="flex justify-between py-1"><span>Latest killed</span><span className="font-num font-semibold">{fmtInt(d.totals.total_killed)}</span></div>}
            </div>
          ) : d.ranges.map((r, i) => (
            <div key={r.range} className="text-xs" style={{ animationDelay: `${i * 40}ms` }}>
              <div className="flex justify-between mb-1">
                <span className="text-slate-700 truncate">{r.range} <span className="text-slate-400">({r.unit_count})</span></span>
                <span className="font-num font-semibold">{fmt(r.avg_overall_score, 1)}</span>
              </div>
              <div className="h-1.5 bg-slate-100 rounded-sm overflow-hidden">
                <div className="h-full bg-brand-navy bar-grow rounded-sm" style={{ width: `${Math.max(0, r.avg_overall_score || 0)}%`, animationDelay: `${80 + i * 50}ms` }} />
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
  const [tab, setTab] = useState(null);
  useEffect(() => { api("get", "/overview").then(setData).catch((e) => setError(errMsg(e))); }, [api]);

  const domains = useMemo(
    () => (data ? DOMAIN_ORDER.filter((k) => data[k]) : []),
    [data],
  );
  const tabs = useMemo(() => (domains.length ? [MAP_TAB, ...domains] : []), [domains]);
  const activeTab = tab && tabs.includes(tab) ? tab : tabs[0];

  if (error) return <div className="text-rose-700 text-sm mt-10" data-testid="overview-error">{error}</div>;
  if (!data) return <div className="flex items-center gap-2 text-slate-500 mt-20 justify-center"><Loader2 className="h-5 w-5 animate-spin" />Loading overview…</div>;
  return (
    <motion.div className="space-y-8" data-testid="overview-page" variants={staggerContainer} initial="hidden" animate="show">
      <motion.div variants={fadeUp} className="space-y-0">
        <div className="bg-brand-chrome text-white rounded-t-sm rounded-b-none px-3 py-3 md:px-4 md:py-3.5 relative overflow-hidden">
          <div className="absolute inset-0 grid-texture grid-texture-animated opacity-60" />
          <div className="absolute -top-8 right-0 h-20 w-20 rounded-full bg-teal-500/10 blur-2xl pointer-events-none" />
          <div className="relative">
            <div className="text-[8px] uppercase tracking-[0.2em] text-teal-400 font-semibold">Executive overview</div>
            <div className="h-0.5 w-4 bg-teal-500 mt-1 mb-1.5 rounded-full" />
            <h1 className="font-display text-base sm:text-lg lg:text-xl font-bold tracking-tight leading-tight">
              {Object.values(data)[0]?.scope_range ? `${Object.values(data)[0].scope_range} at a glance` : "State performance at a glance"}
            </h1>
            <p className="text-slate-400 mt-1 max-w-xl text-[10px] md:text-[11px] leading-snug">
              Conviction, charge-sheet timeliness, 112, and HSP are scored separately, then combined.
            </p>
          </div>
        </div>

        {tabs.length > 0 && (
          <Tabs value={activeTab} onValueChange={setTab} data-testid="overview-domain-tabs">
            <TabsList className="rounded-none rounded-b-sm bg-white border border-t-0 border-slate-200 h-auto p-1 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-1 w-full">
              {tabs.map((k) => (
                <TabsTrigger
                  key={k}
                  value={k}
                  className="rounded-sm px-2 sm:px-3 py-2 text-[11px] sm:text-sm w-full justify-center whitespace-normal text-center leading-snug data-[state=active]:bg-brand-chrome data-[state=active]:text-white data-[state=active]:shadow-none"
                  data-testid={`overview-tab-${k}`}
                >
                  {TAB_LABELS[k] || TITLES[k]}
                </TabsTrigger>
              ))}
            </TabsList>
            {domains.map((k) => (
              <TabsContent key={k} value={k} className="mt-5 focus-visible:ring-0">
                {k === "conviction"
                  ? <ConvictionExecutiveOverview d={data[k]} />
                  : k === "timeliness"
                    ? <TimelinessExecutiveOverview d={data[k]} />
                    : k === "emergency112"
                      ? <Emergency112ExecutiveOverview d={data[k]} />
                      : k === "hsp"
                        ? <HspExecutiveOverview d={data[k]} />
                        : <DomainBlock domain={k} d={data[k]} />}
              </TabsContent>
            ))}
            <TabsContent value={MAP_TAB} className="mt-5 focus-visible:ring-0">
              <MaharashtraMap overview={data} />
            </TabsContent>
          </Tabs>
        )}
      </motion.div>

    </motion.div>
  );
}
