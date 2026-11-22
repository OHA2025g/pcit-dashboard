import { useMemo } from "react";
import { Lightbulb, Compass, ListChecks } from "lucide-react";
import { motion } from "framer-motion";
import { Panel } from "@/components/Primitives";
import { fmt, fmtInt } from "@/lib/format";
import { fadeUp } from "@/lib/motion";

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function signedPp(v) {
  const n = num(v);
  if (n == null) return "—";
  const s = n > 0 ? "+" : "";
  return `${s}${fmt(n)} pp`;
}

function names(rows, limit = 3) {
  return rows.slice(0, limit).map((r) => r.unit).join(", ");
}

function median(vals) {
  const a = vals.filter((v) => v != null).sort((x, y) => x - y);
  if (!a.length) return null;
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

/** Build Insights / Recommendations / Actions from conviction dashboard data. */
export function buildConvictionBrief(data, included) {
  const scored = (included || []).filter((r) => r.eligible && r.overall_score != null);
  const state = data?.state || {};
  const sel = data?.selection || {};
  const insights = [];
  const recommendations = [];
  const actions = [];

  const stateLatest = num(state.latest_rate);
  const stateBase = num(state.base_rate);
  const stateImp = num(state.improvement);
  const stateAcq = num(state.latest_acquittal_rate);
  const gap = num(state.state_session_jmfc_gap);
  const movedUp = num(state.moved_up) ?? 0;
  const movedDown = num(state.moved_down) ?? 0;

  const withImp = scored.filter((r) => num(r.improvement) != null);
  const improvers = [...withImp].sort((a, b) => num(b.improvement) - num(a.improvement));
  const decliners = [...withImp].sort((a, b) => num(a.improvement) - num(b.improvement));
  const lowRate = [...scored]
    .filter((r) => num(r.latest_rate) != null)
    .sort((a, b) => num(a.latest_rate) - num(b.latest_rate));
  const highShareLowRate = scored
    .filter((r) => num(r.workload_share) != null && num(r.latest_rate) != null)
    .sort((a, b) => num(b.workload_share) - num(a.workload_share));
  const shareMid = median(highShareLowRate.map((r) => num(r.workload_share)));
  const rateMid = median(highShareLowRate.map((r) => num(r.latest_rate)));
  const concernLoad = highShareLowRate.filter(
    (r) => shareMid != null && rateMid != null && num(r.workload_share) >= shareMid && num(r.latest_rate) < rateMid,
  );
  const volatile = [...scored]
    .filter((r) => num(r.volatility) != null)
    .sort((a, b) => num(b.volatility) - num(a.volatility));

  const needs = scored.filter((r) => /Needs Improvement|Low Performer/i.test(r.category || ""));
  const topPerf = scored.filter((r) => /Top Performer|Excellent|Good Performer/i.test(r.category || ""));
  const falling = decliners.filter((r) => num(r.improvement) < 0);
  const rising = improvers.filter((r) => num(r.improvement) > 0);

  // —— Insights ——
  if (stateLatest != null && stateBase != null) {
    insights.push({
      id: "statewide-trend",
      title: stateImp != null && stateImp >= 0 ? "Statewide conviction rate held or improved" : "Statewide conviction rate declined",
      body: `Statewide latest rate is ${fmt(stateLatest)}% versus base ${fmt(stateBase)}% (${signedPp(stateImp)}). Trial volume latest ${fmtInt(state.latest_den)} · convicted ${fmtInt(state.latest_num)}.`,
    });
  }

  if (scored.length) {
    const avgSel = num(sel.latest_rate);
    const avgImp = withImp.length
      ? withImp.reduce((s, r) => s + num(r.improvement), 0) / withImp.length
      : null;
    insights.push({
      id: "selection-pulse",
      title: `Selection covers ${fmtInt(scored.length)} scored units`,
      body: `Selection latest rate ${avgSel == null ? "—" : `${fmt(avgSel)}%`} · average improvement ${signedPp(avgImp)}. ${rising.length} units improved and ${falling.length} declined versus base.`,
    });
  }

  if (rising.length) {
    const lead = rising[0];
    insights.push({
      id: "improvers",
      title: "Clear improvement leaders",
      body: `${names(rising, 3)}${rising.length > 3 ? ` and ${rising.length - 3} more` : ""} posted positive gains. Strongest: ${lead.unit} at ${signedPp(lead.improvement)} (latest ${fmt(lead.latest_rate)}%).`,
    });
  }

  if (falling.length) {
    const worst = falling[0];
    insights.push({
      id: "decliners",
      title: "Material declines need attention",
      body: `${names(falling, 3)}${falling.length > 3 ? ` and ${falling.length - 3} more` : ""} fell versus base. Sharpest drop: ${worst.unit} at ${signedPp(worst.improvement)} (latest ${fmt(worst.latest_rate)}%).`,
    });
  }

  if (concernLoad.length) {
    insights.push({
      id: "workload-risk",
      title: "High caseload with below-median rate",
      body: `${names(concernLoad, 3)}${concernLoad.length > 3 ? ` (+${concernLoad.length - 3})` : ""} sit above median workload share (${fmt(shareMid)}%) but below median latest rate (${fmt(rateMid)}%). These units drive state volume while underperforming on conviction.`,
    });
  }

  if (stateAcq != null) {
    insights.push({
      id: "acquittal",
      title: "Acquittal / non-conviction pressure",
      body: `Statewide latest acquittal rate is ${fmt(stateAcq)}% (base ${fmt(state.base_acquittal_rate)}%). Every point of acquittal is a lost conviction opportunity on the same trial base.`,
    });
  }

  if (gap != null) {
    insights.push({
      id: "court-gap",
      title: gap >= 0 ? "Session courts outpace JMFC" : "JMFC outpaces Session courts",
      body: `Statewide Session − JMFC gap is ${signedPp(gap)} (Session ${fmt(state.state_session_rate)}% vs JMFC ${fmt(state.state_jmfc_rate)}% in ${data?.latest || "latest"}).`,
    });
  }

  if (movedUp + movedDown > 0) {
    insights.push({
      id: "rank-churn",
      title: "Rank movement across the cohort",
      body: `${movedUp} units moved up and ${movedDown} moved down versus the previous scoring window${data?.prev_window ? ` (${data.prev_window[0]} → ${data.prev_window[1]})` : ""}.`,
    });
  }

  if (needs.length) {
    insights.push({
      id: "category-tail",
      title: "Large underperformer cohort",
      body: `${fmtInt(needs.length)} of ${fmtInt(scored.length)} scored units are tagged Needs Improvement or Low Performer (${fmt((100 * needs.length) / scored.length)}% of selection).`,
    });
  }

  if (volatile[0] && num(volatile[0].volatility) >= 8) {
    insights.push({
      id: "volatility",
      title: "Unstable period-to-period rates",
      body: `${volatile[0].unit} shows the highest rate volatility (±${fmt(volatile[0].volatility)} pp). Also elevated: ${names(volatile.slice(1, 3)) || "—"}.`,
    });
  }

  if (!insights.length) {
    insights.push({
      id: "empty",
      title: "Insufficient scored data",
      body: "Widen filters or ensure base/latest periods have trial and conviction counts so insights can be generated.",
    });
  }

  // —— Recommendations ——
  if (falling.length) {
    recommendations.push({
      id: "rec-decline",
      title: "Stabilise declining units first",
      body: `Prioritise case-quality and listing follow-up in ${names(falling, 3)}. Target returning each unit at least to its base rate (${falling.slice(0, 3).map((r) => `${r.unit} ${fmt(r.base_rate)}%`).join("; ")}).`,
    });
  }

  if (concernLoad.length) {
    recommendations.push({
      id: "rec-workload",
      title: "Couple volume with conviction quality",
      body: `For high-share / low-rate units (${names(concernLoad, 3)}), pair caseload monitoring with prosecution readiness checks—volume alone is not improving statewide conviction.`,
    });
  }

  if (gap != null && Math.abs(gap) >= 5) {
    recommendations.push({
      id: "rec-gap",
      title: "Narrow Session–JMFC disparity",
      body: `A ${signedPp(Math.abs(gap))} gap suggests process differences between forums. Align evidence standards, listing discipline, and witness production practices across JMFC and Session benches in weak ranges.`,
    });
  }

  if (needs.length >= Math.max(3, Math.floor(scored.length * 0.25))) {
    recommendations.push({
      id: "rec-category",
      title: "Lift the bottom quartile of performers",
      body: `${fmtInt(needs.length)} units are in Needs Improvement / Low. Run a focused coaching cycle using Top/Good units (${topPerf.length ? names(topPerf, 2) : "peer ranges"}) as practice benchmarks.`,
    });
  }

  if (rising.length && falling.length) {
    recommendations.push({
      id: "rec-peer",
      title: "Scale what working units already do",
      body: `Document playbooks from improvers (${names(rising, 2)})—charge framing, witness management, adjournment control—and deploy them in declining peers in the same range.`,
    });
  }

  if (stateImp != null && stateImp < 0) {
    recommendations.push({
      id: "rec-state",
      title: "Reverse the statewide slide",
      body: `Statewide rate is down ${signedPp(stateImp)}. Set a half-year recovery target back toward ${fmt(stateBase)}% and track weekly disposal quality, not only disposal count.`,
    });
  } else if (stateImp != null && stateImp >= 0) {
    recommendations.push({
      id: "rec-hold",
      title: "Protect gains while closing pockets of decline",
      body: `Statewide trend is ${signedPp(stateImp)}. Keep the positive trajectory by ring-fencing support for the ${falling.length} declining units so they do not erase cohort gains.`,
    });
  }

  if (volatile[0] && num(volatile[0].volatility) >= 8) {
    recommendations.push({
      id: "rec-vol",
      title: "Reduce period volatility",
      body: `Units with ±${fmt(volatile[0].volatility)} pp swings need steadier investigation-to-trial pipelines. Prefer continuous listing and fixed prosecution ownership over burst clearances.`,
    });
  }

  if (!recommendations.length) {
    recommendations.push({
      id: "rec-default",
      title: "Maintain monitoring cadence",
      body: "Keep reviewing base vs latest rates by range each half-year and escalate any unit that drops more than 5 pp or falls into Low / Needs Improvement.",
    });
  }

  // —— Action items ——
  falling.slice(0, 3).forEach((r, i) => {
    actions.push({
      id: `act-decline-${i}`,
      owner: r.unit,
      due: "Next 30 days",
      text: `Review open trial board and last-6-month acquittal reasons. Close the ${signedPp(r.improvement)} gap vs base (now ${fmt(r.latest_rate)}%, was ${fmt(r.base_rate)}%).`,
    });
  });

  concernLoad.slice(0, 2).forEach((r, i) => {
    actions.push({
      id: `act-load-${i}`,
      owner: r.unit,
      due: "Next 45 days",
      text: `Workload share ${fmt(r.workload_share)}% with latest rate ${fmt(r.latest_rate)}%. Audit top pending Session/JMFC matters for evidence gaps and fix listing slippage.`,
    });
  });

  if (needs[0]) {
    actions.push({
      id: "act-mentor",
      owner: needs[0].range ? `${needs[0].range} leadership` : "Range leadership",
      due: "This quarter",
      text: `Assign a peer mentor unit for ${names(needs, 3)}. Monthly review of conviction rate, acquittal rate, and rank movement until category improves.`,
    });
  }

  if (gap != null && Math.abs(gap) >= 5) {
    actions.push({
      id: "act-gap",
      owner: "Prosecution / court liaison",
      due: "Next 60 days",
      text: `Produce a Session vs JMFC gap brief (${signedPp(gap)}). Identify 3 process fixes that can be applied in the weakest ranges.`,
    });
  }

  if (state.most_consistent?.unit) {
    actions.push({
      id: "act-benchmark",
      owner: "State crime branch / training cell",
      due: "This quarter",
      text: `Capture operating practices from most consistent unit ${state.most_consistent.unit} (±${fmt(state.most_consistent.volatility)} pp) and circulate a one-page checklist to declining units.`,
    });
  }

  actions.push({
    id: "act-cadence",
    owner: "Dashboard owners",
    due: "Ongoing",
    text: `Every fortnight: refresh filters for this view (${fmtInt(scored.length)} units), flag any new ≥5 pp decline, and log actions against the units listed above.`,
  });

  return { insights, recommendations, actions, scoredCount: scored.length };
}

function ItemCard({ index, title, body }) {
  return (
    <li className="rounded-sm border border-slate-100 bg-white px-3.5 py-3">
      <div className="flex items-start gap-2.5">
        <span className="font-num text-[11px] font-bold text-teal-700 mt-0.5 shrink-0">{String(index).padStart(2, "0")}</span>
        <div className="min-w-0">
          <div className="font-display text-sm font-semibold text-slate-900 leading-snug">{title}</div>
          <p className="text-xs text-slate-600 mt-1 leading-relaxed">{body}</p>
        </div>
      </div>
    </li>
  );
}

function ActionRow({ index, item }) {
  return (
    <li className="rounded-sm border border-slate-100 bg-white px-3.5 py-3 grid grid-cols-1 sm:grid-cols-[2.5rem_1fr_auto] gap-2 sm:gap-3 items-start">
      <span className="font-num text-[11px] font-bold text-teal-700 mt-0.5">{String(index).padStart(2, "0")}</span>
      <div className="min-w-0">
        <p className="text-sm text-slate-800 leading-relaxed">{item.text}</p>
        <div className="text-[11px] text-slate-500 mt-1.5">
          Owner · <span className="font-semibold text-slate-700">{item.owner}</span>
        </div>
      </div>
      <span className="text-[10px] uppercase tracking-[0.12em] font-semibold text-slate-500 bg-slate-50 border border-slate-100 px-2 py-1 rounded-sm shrink-0">
        {item.due}
      </span>
    </li>
  );
}

export default function ConvictionInsights({ data, included, filterLabel }) {
  const brief = useMemo(() => {
    if (!data) return null;
    return buildConvictionBrief(data, included);
  }, [data, included]);

  if (!data || !brief) {
    return (
      <div className="text-sm text-slate-500 py-10 text-center" data-testid="conviction-insights-empty">
        Load unit data to generate insights.
      </div>
    );
  }

  return (
    <motion.div variants={fadeUp} initial="hidden" animate="show" className="space-y-4" data-testid="conviction-insights">
      <div>
        <div className="text-[11px] uppercase tracking-[0.14em] font-semibold text-slate-500">Insight brief</div>
        <p className="text-xs text-slate-500 mt-0.5">
          Generated from current filters · {filterLabel} · {fmtInt(brief.scoredCount)} scored units
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Panel
          title={<span className="inline-flex items-center gap-2"><Lightbulb className="h-4 w-4 text-amber-600" />Insights</span>}
          subtitle="What the data shows"
          className="xl:col-span-1"
        >
          <ol className="space-y-2.5" data-testid="insight-list">
            {brief.insights.map((item, i) => (
              <ItemCard key={item.id} index={i + 1} title={item.title} body={item.body} />
            ))}
          </ol>
        </Panel>

        <Panel
          title={<span className="inline-flex items-center gap-2"><Compass className="h-4 w-4 text-brand-navy" />Recommendations</span>}
          subtitle="Where to focus"
          className="xl:col-span-1"
        >
          <ol className="space-y-2.5" data-testid="recommendation-list">
            {brief.recommendations.map((item, i) => (
              <ItemCard key={item.id} index={i + 1} title={item.title} body={item.body} />
            ))}
          </ol>
        </Panel>

        <Panel
          title={<span className="inline-flex items-center gap-2"><ListChecks className="h-4 w-4 text-teal-700" />Action items</span>}
          subtitle="Concrete next steps"
          className="xl:col-span-1"
        >
          <ol className="space-y-2.5" data-testid="action-list">
            {brief.actions.map((item, i) => (
              <ActionRow key={item.id} index={i + 1} item={item} />
            ))}
          </ol>
        </Panel>
      </div>
    </motion.div>
  );
}
