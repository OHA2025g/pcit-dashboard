/** Explanations + formulas shown from each chart’s info (i) button. */

const explain = (description, expression, example, steps) => ({
  description,
  expression,
  example,
  steps,
});

const COMMON_EXPLAIN = {
  movement: explain(
    "Shows how each range’s average rank moved versus the previous scoring window. Positive places mean the range moved up (better); negative means it slipped.",
    "rank_movement = previous_rank − current_rank\n(range view = average of eligible units in that range)",
    "If a range’s average rank went from 8 to 5, movement = +3 places.",
    [
      "Only score-eligible units are included.",
      "This chart is always grouped by range (ignores the Range | Unit switch).",
      "Green bars = moved up; red bars = moved down.",
    ],
  ),
  volatility: explain(
    "Measures how steady each unit’s rate has been across all available periods. Lower standard deviation means more consistent performance.",
    "volatility_pp = stdev(rate_p1, rate_p2, …, rate_pn)\n(population stdev of period rates, in percentage points)",
    "Rates 40%, 42%, 41% → low volatility; 20%, 60%, 35% → high volatility.",
    [
      "Uses every period present in the source data for that unit, not only base/latest.",
      "Lower is steadier; higher means the rate jumped around more.",
    ],
  ),
  workload: explain(
    "Four-quadrant scatter of caseload share versus latest rate. Median share (vertical) and median rate (horizontal) split units into four groups.",
    "X = workload_share% = 100 × unit_latest_trials ÷ state_latest_trials\nY = latest_rate%\nQuadrants cut at median(X) and median(Y)",
    "A unit with high share and low rate (bottom-right, red) is a heavy caseload underperformer.",
    [
      "Green = high share & high rate · Red = high share & low rate.",
      "Navy = low share & high rate · Soft navy = low share & low rate.",
      "Hover a point for the unit name and exact values.",
    ],
  ),
};

const EXPLAIN = {
  ...COMMON_EXPLAIN,
  improvement: explain(
    "Change in the domain’s headline rate between the selected base and latest periods, in percentage points (pp).",
    "improvement_pp = latest_rate% − base_rate%\nbase_rate% = 100 × base_num ÷ base_den\nlatest_rate% = 100 × latest_num ÷ latest_den",
    "Base 50%, latest 56% → improvement = +6 pp (green). Base 50%, latest 44% → −6 pp (red).",
    [
      "Same formula for conviction, timeliness, and other rate-based domains.",
      "Signed charts use green for favourable movement and red for unfavourable (unless inverted).",
    ],
  ),
  rates: explain(
    "Side-by-side base and latest rates for each unit (or range average). Use this to see absolute levels, not only the change.",
    "base_rate% = 100 × base_num ÷ base_den\nlatest_rate% = 100 × latest_num ÷ latest_den",
    "If a unit tried 200 cases and convicted 120 in the latest period → latest_rate = 60%.",
  ),
  score: explain(
    "Overall composite score (0–100) used for ranking. Combines period performance with improvement, using the domain’s policy weights.",
    "overall_score = w × performance_score + (1 − w) × improvement_score\n(weights w come from admin policy for the domain)",
    "With w = 0.7, performance 80 and improvement score 60 → overall = 0.7×80 + 0.3×60 = 74.",
    [
      "Only score-eligible units receive a score; others are excluded from this chart.",
      "Higher score is better unless the chart notes otherwise.",
    ],
  ),
  rank: explain(
    "Ordinal rank of each unit by overall score (or marks). Rank 1 is best. The Y-axis may be inverted so better ranks sit nearer the top.",
    "rank = 1 + number of eligible units with a strictly better sort key\n(ties keep source order)",
    "If three units score 90, 85, 85 → ranks 1, 2, 3 (stable order among ties).",
  ),
  acquittal: explain(
    "Non-conviction (acquittal) rates for base and latest periods. Lower is better. Always shown by range.",
    "acquittal_rate% = 100 − conviction_rate%\nrange view = rates recomputed from summed trials/convictions in the range",
    "Conviction rate 60% → acquittal rate 40%.",
    [
      "Always grouped by range (ignores the Range | Unit switch).",
      "Light bar = base period; dark bar = latest period.",
    ],
  ),
  gap: explain(
    "Difference between Session-court and JMFC conviction rates in the latest period for each unit.",
    "session_jmfc_gap_pp = session_latest_rate% − jmfc_latest_rate%",
    "Session 55%, JMFC 40% → gap = +15 pp.",
  ),
  beyond: explain(
    "Share of cases disposed beyond the prescribed time, for base and latest periods.",
    "beyond_rate% = 100 × beyond_count ÷ registered_count",
    "Lower beyond-time rates indicate faster disposal.",
  ),
  beyond_change: explain(
    "Change in beyond-time rate (pp) by range. Lower (more negative) is better because fewer cases are late.",
    "beyond_change_pp = latest_beyond_rate% − base_beyond_rate%\nbeyond_rate% = 100 × Σ beyond ÷ Σ registered  (range totals)",
    "Base 30%, latest 22% → change = −8 pp (improvement).",
    [
      "Always grouped by range (ignores the Range | Unit switch).",
      "Green bars = beyond-time rate fell (favourable); red = rose (unfavourable).",
    ],
  ),
  pending: explain(
    "Charge sheets still pending as a share of registered cases, base vs latest. Lower is better.",
    "pending_rate% = 100 × pending_count ÷ registered_count",
  ),
  response: explain(
    "Total response time in seconds for base and latest periods. Lower is better.",
    "Shown as absolute base_total_sec and latest_total_sec from the 112 workbook.",
  ),
  pct100: explain(
    "Share of 112 events closed within 100 minutes, base vs latest.",
    "rate% = 100 × events_≤100m ÷ events",
  ),
  time_imp: explain(
    "Percent reduction in response time (faster is positive).",
    "time_improvement_% = 100 × (base_sec − latest_sec) ÷ base_sec",
    "Base 200s, latest 150s → +25% time improvement.",
  ),
  pct_imp: explain(
    "Improvement in the % ≤100m metric, in percentage points.",
    "pct_improvement_pp = latest_%≤100m − base_%≤100m",
  ),
  closed_100m: explain(
    "Count of 112 events closed within 100 minutes in the base and latest periods.",
    "base_≤100m = Events closed ≤100m in base period\nlatest_≤100m = Events closed ≤100m in latest period",
    "Base 1,200 and latest 1,450 means 250 more on-time closures in the latest window.",
    [
      "Light bar = base period count; dark bar = latest period count.",
      "This is a volume count, not the % ≤100m rate.",
    ],
  ),
  perf: explain(
    "Period performance score combining the domain’s performance components (for example 112: 80% time + 20% %≤100m).",
    "performance_score = weighted mix of component scores (0–100)",
  ),
  marks: explain(
    "Training / ANTF marks from the ranking sheet for the latest period.",
    "Domain-specific: Training uses Ranking marks; ANTF uses meetings×3 + MoM×2.",
  ),
  headcount: explain(
    "Unit headcount (denominator) in base vs latest periods.",
    "base_den and latest_den from the training workbook.",
  ),
  trained: explain(
    "People trained (numerator) in base vs latest periods.",
    "base_num and latest_num from the training workbook.",
  ),
  meetings: explain(
    "Total ANTF meetings counted from January 2026 onward.",
    "meetings = sum of recorded meetings in scope",
  ),
  mom: explain(
    "Months with MoM uploaded on the NCORD portal.",
    "mom_uploaded = count of months with minutes uploaded",
  ),
  split: explain(
    "Breakdown of ANTF marks into meeting marks vs minutes-upload marks.",
    "meeting_marks = meetings × 3\nupload_marks = mom_uploaded × 2\ntotal_marks = meeting_marks + upload_marks",
  ),
  accidents: explain(
    "Total accidents in base vs latest periods. Lower is better.",
    "Counts from the HSP workbook for each period.",
  ),
  killed: explain(
    "Total persons killed in base vs latest periods. Lower is better.",
    "Counts from the HSP workbook for each period.",
  ),
  // HSP uses id "improvement" for reduction marks score — domain override applied in resolver
};

const DOMAIN_OVERRIDES = {
  "hsp:improvement": explain(
    "HSP final improvement score from accident/killed reduction marks (0–100).",
    "improvement_score = weighted reduction marks scaled to 0–100",
  ),
  "hsp:perf": explain(
    "HSP final performance: accidents 30% + killed 70%, scaled to 0–100.",
    "performance_score = 0.3 × accident_perf + 0.7 × killed_perf",
  ),
  "training:score": explain(
    "Training score is Ranking marks scaled to 0–100.",
    "overall_score = marks × 10",
    "Marks 7.5 → score 75.",
  ),
  "training:rates": explain(
    "Share of headcount trained in base vs latest periods.",
    "rate% = 100 × people_trained ÷ headcount",
  ),
  "conviction:score": explain(
    "Conviction overall score blends period conviction performance with improvement marks under admin policy weights.",
    "overall_score = w × performance_score + (1 − w) × improvement_score\nimprovement_score = improvement_marks × 10",
  ),
  "conviction:improvement": explain(
    "Change in conviction rate (JMFC/Session as filtered) between base and latest periods.",
    "improvement_pp = latest_conviction_rate% − base_conviction_rate%\nrate% = 100 × convicted ÷ trials",
    "Base 48%, latest 55% → +7 pp.",
  ),
  "conviction:rates": explain(
    "Conviction rates in the base and latest windows for each unit (or range).",
    "rate% = 100 × convicted_cases ÷ trial_cases",
  ),
  "timeliness:workload": explain(
    "Side-by-side bars of each unit’s (or range’s) workload share and latest within-time rate. Use this to spot high-volume units that underperform on timeliness.",
    "workload_share% = 100 × unit_latest_registered ÷ state_latest_registered\nlatest_rate% = 100 × within_time ÷ registered",
    "A unit with 8% share and 55% within-time rate shows high caseload relative to peers but a mid-tier disposal rate.",
    [
      "Light/secondary bar = workload share; dark/primary bar = latest within-time rate.",
      "Both series are percentages so they share one axis for comparison.",
    ],
  ),
  "emergency112:score": explain(
    "Average 112 final score by range (0–100). Always aggregated by range.",
    "range_final_score = average(unit overall_score) for eligible units in the range\noverall_score blends period performance with improvement under policy weights",
    "If three units in a range score 80, 70, and 75 → range score = 75.",
    [
      "Always grouped by range (ignores the Range | Unit switch).",
      "Higher is better.",
    ],
  ),
  "hsp:score": explain(
    "Average HSP final score by range (0–100). Always aggregated by range.",
    "range_final_score = average(unit overall_score) for eligible units in the range\noverall_score blends accident/killed performance with improvement under policy weights",
    "If three units in a range score 90, 80, and 70 → range score = 80.",
    [
      "Always grouped by range (ignores the Range | Unit switch).",
      "Higher is better.",
    ],
  ),
};

function fallbackExplain(def) {
  const keys = (def.keys || []).map(([k, label]) => `${label} ← ${k}`).join("\n");
  return explain(
    def.unit
      ? `${def.title || def.label}. Values are shown in ${def.unit}.`
      : (def.title || def.label || "Chart"),
    keys || "See unit rankings table for source fields.",
    def.forceRange ? "This view is always aggregated by range." : undefined,
    def.quadrant
      ? ["Points are coloured by quadrant relative to the median of each axis."]
      : undefined,
  );
}

export function resolveChartExplain(domain, def) {
  if (!def) return null;
  if (def.explain) return { ...def.explain, title: def.title || def.label };
  const id = def.id;
  const override = DOMAIN_OVERRIDES[`${domain}:${id}`];
  const base = override || EXPLAIN[id] || fallbackExplain(def);
  return {
    ...base,
    title: def.title || def.label || id,
  };
}

/** Overview-tab (ConvictionDetailedOverview) chart explanations. */
const OVERVIEW_EXPLAIN = {
  rates: explain(
    "Half-year conviction rates for the current filter selection. When a subset of units is selected, a dashed statewide line is shown for comparison.",
    "rate% = 100 × convicted ÷ trials  (for the selection in each half-year)\nstate_rate% = 100 × statewide_convicted ÷ statewide_trials",
    "If the selection convicted 120 of 200 trials in H1-25 → rate = 60%.",
    [
      "Solid line = filtered selection (or all units when no unit filter).",
      "Dashed line = statewide benchmark (hidden when viewing all units).",
      "Y-axis auto-zooms around the observed rates for readability.",
    ],
  ),
  volumes: explain(
    "Trial and convicted case counts by half-year for the current selection. Use with the rate chart to see whether rate moves came from volume or outcomes.",
    "trials = Σ trial_cases in period\nconvicted = Σ convicted_cases in period",
    "H1-25: 200 trials, 120 convicted → bars at 200 and 120.",
    [
      "Navy bars = trial cases; teal bars = convicted cases.",
      "Counts respect the same unit, range, category, and case-type filters as the KPIs.",
    ],
  ),
  comparison: explain(
    "Base vs latest conviction rates for the selected unit(s), their range(s), and statewide — same case type and periods as the filters.",
    "base_rate% = 100 × base_convicted ÷ base_trials\nlatest_rate% = 100 × latest_convicted ÷ latest_trials",
    "Unit 55% latest, range 52%, state 50% → unit ahead of both benchmarks.",
    [
      "Light bars = base period; dark bars = latest period.",
      "Rows adapt to selection mode (single unit, multi-unit, or all units).",
    ],
  ),
  topscores: explain(
    "Top overall conviction scores among units in the selected range(s). With no range filter, shows the statewide top 5.",
    "overall_score = w × performance_score + (1 − w) × improvement_score\n(weights from admin policy; 0–100)",
    "Score 82 ranks above 74 — only score-eligible units appear.",
    [
      "Limited to the top 5 units in scope.",
      "Overall score blends period performance with improvement under policy weights.",
    ],
  ),
  courts: explain(
    "Conviction rates split by court forum (JMFC vs Session) for base and latest periods under the current filters.",
    "court_rate% = 100 × court_convicted ÷ court_trials\n(computed separately for JMFC and Session)",
    "Session latest 58%, JMFC latest 45% → a 13 pp forum gap.",
    [
      "Light bars = base; dark bars = latest.",
      "Footnote shows latest trial volume by court for context.",
    ],
  ),
  points: explain(
    "How a single unit’s overall score is built: earned vs remaining points on the relative-rate and improvement components. Requires exactly one unit selected.",
    "overall_score = relative_rate_points + improvement_points\n(each component capped by its policy max contribution)",
    "12 relative-rate + 8 improvement = 20 / 100 (illustrative).",
    [
      "Teal = points earned; grey = remaining headroom on that component.",
      "Select exactly one police unit to unlock this chart.",
    ],
  ),
};

export function resolveOverviewChartExplain(id, title) {
  const base = OVERVIEW_EXPLAIN[id];
  if (!base) return null;
  return { ...base, title: title || id };
}
