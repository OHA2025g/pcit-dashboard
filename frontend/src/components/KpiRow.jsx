import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Kpi, Delta } from "@/components/Primitives";
import { fmt, fmtInt, fmtDuration } from "@/lib/format";
import { staggerFast } from "@/lib/motion";

function listLabel(v) {
  if (Array.isArray(v)) return v.length ? (v.length <= 2 ? v.join(", ") : `${v[0]} +${v.length - 1}`) : null;
  return v && v !== "All" ? v : null;
}

function selectionLabel(f) {
  const parts = [];
  const unit = listLabel(f.unit);
  const range = listLabel(f.range);
  if (unit) parts.push(unit);
  if (range) parts.push(range);
  if (f.category && f.category !== "All") parts.push(f.category);
  return parts.length ? parts.join(" · ") : "Current filter selection";
}

const RowLabel = ({ children }) => (
  <div className="flex items-center gap-2 mb-2">
    <span className="text-[10px] uppercase tracking-[0.16em] font-bold text-slate-500">{children}</span>
    <span className="h-px flex-1 bg-gradient-to-r from-slate-200 to-transparent" />
  </div>
);

export default function KpiRow({ domain, data, f, labels, included }) {
  const [showSignals, setShowSignals] = useState(false);
  const s = data.state;
  const sel = data.selection;
  const scope = data.scope_range ? data.scope_range : "State";
  const top = included.filter((r) => r.rank).sort((a, b) => a.rank - b.rank)[0];
  const mc = s.most_consistent;
  const w = Math.round((data.weight ?? 0.7) * 100);
  const iw = 100 - w;
  const selName = selectionLabel(f);
  const singleUnit = Array.isArray(f.unit) ? f.unit.length === 1 : (f.unit && f.unit !== "All");
  const unitName = Array.isArray(f.unit) ? f.unit[0] : f.unit;

  if (domain === "antf") {
    return (
      <div className="space-y-5">
        <div>
          <RowLabel>Statewide</RowLabel>
          <motion.div variants={staggerFast} initial="hidden" animate="show" className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3" data-testid="kpi-row">
            <Kpi testId="kpi-total-meetings" label="Total meetings from Jan 2026" value={fmtInt(s.total_meetings)} sub={scope} accent />
            <Kpi testId="kpi-mom-uploaded" label="MoM uploaded (NCORD)" value={fmtInt(s.total_mom_uploaded)} sub="Months with minutes uploaded" />
            <Kpi testId="kpi-total-marks" label="Total marks scored" value={fmtInt(s.total_marks)} sub="Meetings×3 + MoM×2" accent />
            <Kpi testId="kpi-avg-marks" label="Avg marks / unit" value={fmt(s.avg_marks, 1)} sub={`${fmtInt(s.scored_count)} units`} />
            <Kpi testId="kpi-units" label="Units" value={fmtInt(s.unit_count)} sub={top ? `#1 ${top.unit}` : scope} />
          </motion.div>
        </div>
        <div>
          <RowLabel>Selection</RowLabel>
          <motion.div variants={staggerFast} initial="hidden" animate="show" className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3" data-testid="kpi-unit-row">
            <Kpi testId="kpi-sel-units" label="Units" value={fmtInt(sel.unit_count)} sub={selName} />
            <Kpi testId="kpi-sel-meetings" label="Meetings" value={fmtInt(sel.total_meetings)} sub="From Jan 2026" />
            <Kpi testId="kpi-sel-mom" label="MoM uploaded" value={fmtInt(sel.total_mom_uploaded)} sub="NCORD portal" />
            <Kpi testId="kpi-sel-marks" label="Total marks" value={fmtInt(sel.total_marks)} sub="Selected units" accent />
            <Kpi testId="kpi-sel-avg" label="Avg marks" value={fmt(sel.avg_marks, 1)} sub={top && singleUnit ? `Rank #${top.rank} · ${top.category}` : "Selected"} />
          </motion.div>
        </div>
      </div>
    );
  }

  if (domain === "hsp") {
    return (
      <div className="space-y-5">
        <div>
          <RowLabel>Statewide</RowLabel>
          <motion.div variants={staggerFast} initial="hidden" animate="show" className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3" data-testid="kpi-row">
            <Kpi testId="kpi-base-accidents" label={`${scope} base accidents`} value={fmtInt(s.base_accidents ?? s.base_den)} sub={f.base} />
            <Kpi testId="kpi-base-killed" label={`${scope} base killed`} value={fmtInt(s.base_killed ?? s.base_num)} sub={f.base} />
            <Kpi testId="kpi-latest-accidents" label={`${scope} latest accidents`} value={fmtInt(s.total_accidents ?? s.latest_den)} sub={f.latest} accent />
            <Kpi testId="kpi-latest-killed" label={`${scope} latest killed`} value={fmtInt(s.total_killed ?? s.latest_num)} sub={f.latest} accent />
            <Kpi testId="kpi-avg-score" label="Avg final score" value={fmt(s.avg_overall_score)} sub={`${fmtInt(s.scored_count)} units`} />
            <Kpi testId="kpi-units" label="Units" value={fmtInt(s.unit_count)} sub={top ? `#1 ${top.unit}` : scope} />
          </motion.div>
        </div>
        <div>
          <RowLabel>Selection</RowLabel>
          <motion.div variants={staggerFast} initial="hidden" animate="show" className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3" data-testid="kpi-unit-row">
            <Kpi testId="kpi-sel-units" label="Units" value={fmtInt(sel.unit_count)} sub={selName} />
            <Kpi testId="kpi-sel-accidents" label="Latest accidents" value={fmtInt(sel.total_accidents ?? sel.latest_den)} sub={f.latest} />
            <Kpi testId="kpi-sel-killed" label="Latest killed" value={fmtInt(sel.total_killed ?? sel.latest_num)} sub={f.latest} />
            <Kpi testId="kpi-sel-injured" label="Latest injured" value={fmtInt(sel.total_injured)} sub={f.latest} />
            <Kpi testId="kpi-sel-score" label="Avg final score" value={fmt(sel.avg_overall_score)} sub="Selected" accent />
            <Kpi testId="kpi-sel-top" label="Top unit" value={top ? `#${top.rank}` : "—"} sub={top ? `${top.unit} · ${top.category}` : selName} />
          </motion.div>
        </div>
      </div>
    );
  }

  if (domain === "training") {
    return (
      <div className="space-y-5">
        <div>
          <RowLabel>Statewide</RowLabel>
          <motion.div variants={staggerFast} initial="hidden" animate="show" className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3" data-testid="kpi-row">
            <Kpi testId="kpi-base-den" label={`${scope} base headcount`} value={fmtInt(s.base_den)} sub={f.base} />
            <Kpi testId="kpi-base-num" label={`${scope} base people trained`} value={fmtInt(s.base_num)} sub={f.base} />
            <Kpi testId="kpi-base-rate" label="Base % people trained" value={`${fmt(s.base_rate)}%`} sub={f.base} />
            <Kpi testId="kpi-latest-den" label={`${scope} latest headcount`} value={fmtInt(s.latest_den)} sub={f.latest} />
            <Kpi testId="kpi-latest-num" label={`${scope} latest people trained`} value={fmtInt(s.latest_num)} sub={f.latest} />
            <Kpi testId="kpi-latest-rate" label="Latest % people trained" value={`${fmt(s.latest_rate)}%`} sub={f.latest} accent />
            <Kpi testId="kpi-avg-marks" label="Avg Ranking marks" value={fmt(s.avg_marks, 1)} sub="Latest period · 0–10" accent />
          </motion.div>
        </div>
        <div>
          <RowLabel>Selection</RowLabel>
          <motion.div variants={staggerFast} initial="hidden" animate="show" className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3" data-testid="kpi-unit-row">
            <Kpi testId="kpi-unit-count" label="Units" value={fmtInt(sel.unit_count)} sub={selName} />
            <Kpi testId="kpi-unit-base-rate" label="Base % trained" value={`${fmt(sel.base_rate)}%`} sub={f.base} />
            <Kpi testId="kpi-unit-latest-rate" label="Latest % trained" value={`${fmt(sel.latest_rate)}%`} sub={f.latest} accent />
            <Kpi testId="kpi-unit-base-num" label="Base trained" value={fmtInt(sel.base_num)} sub={f.base} />
            <Kpi testId="kpi-unit-latest-num" label="Latest trained" value={fmtInt(sel.latest_num)} sub={f.latest} />
            <Kpi testId="kpi-unit-improvement" label="% change" value={<Delta value={sel.improvement} />} sub="pp (not scored)" />
            <Kpi testId="kpi-avg-score" label="Avg score (Marks×10)" value={fmt(sel.avg_overall_score)}
              sub={`${sel.scored_count} scored${top ? ` · #1 ${top.unit}` : ""}`} accent />
            <Kpi testId="kpi-sel-marks" label="Avg marks" value={fmt(sel.avg_marks, 1)} sub="0–10" />
          </motion.div>
        </div>
        <div>
          <div className="flex items-center gap-2 mb-2">
            <button type="button" onClick={() => setShowSignals((v) => !v)} aria-expanded={showSignals} data-testid="signals-toggle"
              className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.16em] font-bold text-slate-500 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/50 rounded-sm">
              Signals
              <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${showSignals ? "rotate-0" : "-rotate-90"}`} aria-hidden />
            </button>
            <span className="h-px flex-1 bg-gradient-to-r from-slate-200 to-transparent" />
          </div>
          <AnimatePresence initial={false}>
            {showSignals && (
              <motion.div key="signals-row" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                <motion.div variants={staggerFast} initial="hidden" animate="show" className="grid grid-cols-2 md:grid-cols-4 gap-3" data-testid="kpi-extra-row">
                  <Kpi testId="kpi-rank-movement" label="Rank movement" value={<span><span className="text-emerald-700">▲ {s.moved_up}</span> <span className="text-rose-700 ml-2">▼ {s.moved_down}</span></span>}
                    sub={data.prev_window ? `vs ${data.prev_window[0]} → ${data.prev_window[1]}` : "No earlier window"} />
                  <Kpi testId="kpi-most-consistent" label="Most consistent unit" value={<span className="text-lg">{mc ? mc.unit : "—"}</span>} sub={mc ? `±${fmt(mc.volatility)} pp` : ""} />
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    );
  }

  if (domain === "emergency112") {
    return (
      <div className="space-y-5">
        <div>
          <RowLabel>Statewide</RowLabel>
          <motion.div variants={staggerFast} initial="hidden" animate="show" className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3" data-testid="kpi-row">
            <Kpi testId="kpi-base-den" label={`${scope} base actionable calls`} value={fmtInt(s.base_den)} sub={f.base} />
            <Kpi testId="kpi-base-time" label="Base avg response time" value={fmtDuration(s.base_total_sec)} sub={f.base} />
            <Kpi testId="kpi-base-rate" label="Base % ≤100m" value={`${fmt(s.base_rate)}%`} sub={f.base} />
            <Kpi testId="kpi-latest-den" label={`${scope} latest actionable calls`} value={fmtInt(s.latest_den)} sub={f.latest} />
            <Kpi testId="kpi-latest-time" label="Latest avg response time" value={fmtDuration(s.latest_total_sec)} sub={f.latest} accent />
            <Kpi testId="kpi-latest-rate" label="Latest % ≤100m" value={`${fmt(s.latest_rate)}%`} sub={f.latest} accent />
            <Kpi testId="kpi-improvement" label="Time improvement" value={<Delta value={s.time_improvement_pct} />} sub="% faster vs base" />
          </motion.div>
        </div>
        <div>
          <RowLabel>Selection</RowLabel>
          <motion.div variants={staggerFast} initial="hidden" animate="show" className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3" data-testid="kpi-unit-row">
            <Kpi testId="kpi-unit-count" label="Districts" value={fmtInt(sel.unit_count)} sub={selName} />
            <Kpi testId="kpi-unit-base-time" label="Base response time" value={fmtDuration(sel.base_total_sec)} sub={f.base} />
            <Kpi testId="kpi-unit-base-rate" label="Base % ≤100m" value={`${fmt(sel.base_rate)}%`} sub={f.base} />
            <Kpi testId="kpi-unit-latest-time" label="Latest response time" value={fmtDuration(sel.latest_total_sec)} sub={f.latest} accent />
            <Kpi testId="kpi-unit-latest-rate" label="Latest % ≤100m" value={`${fmt(sel.latest_rate)}%`} sub={f.latest} accent />
            <Kpi testId="kpi-unit-improvement" label="% ≤100m improvement" value={<Delta value={sel.improvement} />} sub="pp" />
            <Kpi testId="kpi-time-imp" label="Time improvement" value={<Delta value={sel.time_improvement_pct} />} sub="%" />
            <Kpi testId="kpi-avg-score" label="Avg final score" value={fmt(sel.avg_overall_score)}
              sub={`${sel.scored_count} scored${top ? ` · #1 ${top.unit}` : ""}`} accent />
          </motion.div>
        </div>
        <div>
          <div className="flex items-center gap-2 mb-2">
            <button type="button" onClick={() => setShowSignals((v) => !v)} aria-expanded={showSignals} data-testid="signals-toggle"
              className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.16em] font-bold text-slate-500 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/50 rounded-sm">
              Signals
              <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${showSignals ? "rotate-0" : "-rotate-90"}`} aria-hidden />
            </button>
            <span className="h-px flex-1 bg-gradient-to-r from-slate-200 to-transparent" />
          </div>
          <AnimatePresence initial={false}>
            {showSignals && (
              <motion.div key="signals-row" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                <motion.div variants={staggerFast} initial="hidden" animate="show" className="grid grid-cols-2 md:grid-cols-4 gap-3" data-testid="kpi-extra-row">
                  <Kpi testId="kpi-closed" label="Events closed ≤100m (latest)" value={fmtInt(s.latest_num)} sub={`of ${fmtInt(s.latest_responded || s.latest_den)} responded`} />
                  <Kpi testId="kpi-pct-imp" label="% ≤100m improvement" value={<Delta value={s.improvement} />} sub="statewide pp" />
                  <Kpi testId="kpi-rank-movement" label="Rank movement" value={<span><span className="text-emerald-700">▲ {s.moved_up}</span> <span className="text-rose-700 ml-2">▼ {s.moved_down}</span></span>}
                    sub={data.prev_window ? `vs ${data.prev_window[0]} → ${data.prev_window[1]}` : "No earlier window"} />
                  <Kpi testId="kpi-most-consistent" label="Most consistent district" value={<span className="text-lg">{mc ? mc.unit : "—"}</span>} sub={mc ? `±${fmt(mc.volatility)} pp` : ""} />
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <RowLabel>Statewide</RowLabel>
        <motion.div variants={staggerFast} initial="hidden" animate="show" className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3" data-testid="kpi-row">
          <Kpi testId="kpi-base-den" label={`${scope} base ${labels.den.toLowerCase()}`} value={fmtInt(s.base_den)} sub={f.base}
            formula={{ description: `Total ${labels.den.toLowerCase()} statewide for the base period.`, expression: `Σ ${labels.den} (base period)`, example: `${f.base}: ${fmtInt(s.base_den)}` }} />
          <Kpi testId="kpi-base-num" label={`${scope} base ${labels.num.toLowerCase()}`} value={fmtInt(s.base_num)} sub={domain === "timeliness" ? `Beyond time: ${fmtInt(s.base_beyond)}` : f.base}
            formula={{ description: `Total ${labels.num.toLowerCase()} statewide for the base period.`, expression: `Σ ${labels.num} (base period)`, example: domain === "timeliness" ? `${f.base}: ${fmtInt(s.base_num)} within time · ${fmtInt(s.base_beyond)} beyond time` : `${f.base}: ${fmtInt(s.base_num)}` }} />
          <Kpi testId="kpi-base-rate" label={`Base ${labels.rate.toLowerCase()}`} value={`${fmt(s.base_rate)}%`} sub={f.base}
            formula={{ description: `${labels.rate} for the base period from summed statewide counts.`, expression: `(Σ ${labels.num} ÷ Σ ${labels.den}) × 100`, example: `(${fmtInt(s.base_num)} ÷ ${fmtInt(s.base_den)}) × 100 = ${fmt(s.base_rate)}%` }} />
          <Kpi testId="kpi-latest-den" label={`${scope} latest ${labels.den.toLowerCase()}`} value={fmtInt(s.latest_den)} sub={f.latest}
            formula={{ description: `Total ${labels.den.toLowerCase()} statewide for the latest period.`, expression: `Σ ${labels.den} (latest period)`, example: `${f.latest}: ${fmtInt(s.latest_den)}` }} />
          <Kpi testId="kpi-latest-num" label={`${scope} latest ${labels.num.toLowerCase()}`} value={fmtInt(s.latest_num)} sub={domain === "timeliness" ? `Beyond time: ${fmtInt(s.latest_beyond)}` : f.latest}
            formula={{ description: `Total ${labels.num.toLowerCase()} statewide for the latest period.`, expression: `Σ ${labels.num} (latest period)`, example: domain === "timeliness" ? `${f.latest}: ${fmtInt(s.latest_num)} within time · ${fmtInt(s.latest_beyond)} beyond time` : `${f.latest}: ${fmtInt(s.latest_num)}` }} />
          <Kpi testId="kpi-latest-rate" label={`Latest ${labels.rate.toLowerCase()}`} value={`${fmt(s.latest_rate)}%`} sub={f.latest} accent
            formula={{ description: `${labels.rate} for the latest period from summed statewide counts.`, expression: `(Σ ${labels.num} ÷ Σ ${labels.den}) × 100`, example: `(${fmtInt(s.latest_num)} ÷ ${fmtInt(s.latest_den)}) × 100 = ${fmt(s.latest_rate)}%` }} />
          <Kpi testId="kpi-improvement" label="Improvement" value={<Delta value={s.improvement} />} sub="Latest − base rate"
            formula={{ description: "Change in the statewide rate between latest and base periods (pp).", expression: "Latest rate − Base rate", example: `${fmt(s.latest_rate)}% − ${fmt(s.base_rate)}% = ${s.improvement == null ? "—" : `${s.improvement >= 0 ? "+" : ""}${fmt(s.improvement)} pp`}` }} />
        </motion.div>
      </div>

      <div>
        <RowLabel>Selection</RowLabel>
        <motion.div variants={staggerFast} initial="hidden" animate="show" className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-9 gap-3" data-testid="kpi-unit-row">
          <Kpi testId="kpi-unit-count" label="Units" value={fmtInt(sel.unit_count)} sub={selName}
            formula={{ description: "Number of units included by the current Unit / Range / Rank category filters.", expression: "COUNT of units where Include = 1", example: `${fmtInt(sel.unit_count)} unit${sel.unit_count === 1 ? "" : "s"} · ${selName}` }} />
          <Kpi testId="kpi-unit-base-den" label={`Base ${labels.den.toLowerCase()}`} value={fmtInt(sel.base_den)} sub={f.base}
            formula={{ description: `Sum of ${labels.den.toLowerCase()} for the filtered selection in the base period.`, expression: `Σ ${labels.den} over selected units (base)`, example: `${singleUnit ? unitName : selName}: ${fmtInt(sel.base_den)}` }} />
          <Kpi testId="kpi-unit-base-num" label={`Base ${labels.num.toLowerCase()}`} value={fmtInt(sel.base_num)} sub={domain === "timeliness" ? `Beyond time: ${fmtInt(sel.base_beyond)}` : f.base}
            formula={{ description: `Sum of ${labels.num.toLowerCase()} for the filtered selection in the base period.`, expression: `Σ ${labels.num} over selected units (base)`, example: domain === "timeliness" ? `${fmtInt(sel.base_num)} within time · ${fmtInt(sel.base_beyond)} beyond time` : `${fmtInt(sel.base_num)}` }} />
          <Kpi testId="kpi-unit-base-rate" label={`Base ${labels.rate.toLowerCase()}`} value={`${fmt(sel.base_rate)}%`} sub={f.base}
            formula={{ description: `${labels.rate} for the filtered selection in the base period.`, expression: `(Σ ${labels.num} ÷ Σ ${labels.den}) × 100`, example: `(${fmtInt(sel.base_num)} ÷ ${fmtInt(sel.base_den)}) × 100 = ${fmt(sel.base_rate)}%` }} />
          <Kpi testId="kpi-unit-latest-den" label={`Latest ${labels.den.toLowerCase()}`} value={fmtInt(sel.latest_den)} sub={f.latest}
            formula={{ description: `Sum of ${labels.den.toLowerCase()} for the filtered selection in the latest period.`, expression: `Σ ${labels.den} over selected units (latest)`, example: `${fmtInt(sel.latest_den)}` }} />
          <Kpi testId="kpi-unit-latest-num" label={`Latest ${labels.num.toLowerCase()}`} value={fmtInt(sel.latest_num)} sub={domain === "timeliness" ? `Beyond time: ${fmtInt(sel.latest_beyond)}` : f.latest}
            formula={{ description: `Sum of ${labels.num.toLowerCase()} for the filtered selection in the latest period.`, expression: `Σ ${labels.num} over selected units (latest)`, example: domain === "timeliness" ? `${fmtInt(sel.latest_num)} within time · ${fmtInt(sel.latest_beyond)} beyond time` : `${fmtInt(sel.latest_num)}` }} />
          <Kpi testId="kpi-unit-latest-rate" label={`Latest ${labels.rate.toLowerCase()}`} value={`${fmt(sel.latest_rate)}%`} sub={f.latest} accent
            formula={{ description: `${labels.rate} for the filtered selection in the latest period.`, expression: `(Σ ${labels.num} ÷ Σ ${labels.den}) × 100`, example: `(${fmtInt(sel.latest_num)} ÷ ${fmtInt(sel.latest_den)}) × 100 = ${fmt(sel.latest_rate)}%` }} />
          <Kpi testId="kpi-unit-improvement" label="Improvement" value={<Delta value={sel.improvement} />} sub="Latest − base rate"
            formula={{ description: "Change in the filtered selection’s rate between latest and base periods (pp).", expression: "Selection latest rate − Selection base rate", example: `${fmt(sel.latest_rate)}% − ${fmt(sel.base_rate)}% = ${sel.improvement == null ? "—" : `${sel.improvement >= 0 ? "+" : ""}${fmt(sel.improvement)} pp`}` }} />
          <Kpi testId="kpi-avg-score" label="Avg overall score" value={fmt(sel.avg_overall_score)}
            sub={`${sel.scored_count} scored${top ? ` · #1 ${top.unit}` : ""}`} accent
            formula={{ description: `Mean overall score of scored units in the current selection. Unit overall = ${w}% performance + ${iw}% improvement.`, expression: `AVERAGEIF(Include=1, Overall score)`, example: `${sel.scored_count} of ${sel.unit_count} units scored · average ${fmt(sel.avg_overall_score)}` }} />
        </motion.div>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-2">
          <button
            type="button"
            onClick={() => setShowSignals((v) => !v)}
            aria-expanded={showSignals}
            data-testid="signals-toggle"
            className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.16em] font-bold text-slate-500 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/50 rounded-sm"
          >
            Signals
            <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${showSignals ? "rotate-0" : "-rotate-90"}`} aria-hidden />
          </button>
          <span className="h-px flex-1 bg-gradient-to-r from-slate-200 to-transparent" />
        </div>
        <AnimatePresence initial={false}>
          {showSignals && (
            <motion.div
              key="signals-row"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <motion.div variants={staggerFast} initial="hidden" animate="show" className="grid grid-cols-2 md:grid-cols-4 gap-3" data-testid="kpi-extra-row">
                {domain === "conviction" ? (
                  <>
                    <Kpi testId="kpi-acquittal-rate" label={`${scope} acquittal rate`} value={`${fmt(s.latest_acquittal_rate)}%`} sub={`Base ${fmt(s.base_acquittal_rate)}% · lower is better`}
                      formula={{ description: "Share of trial cases that did not end in conviction. Lower is better.", expression: "100 − Conviction rate", example: `Latest: 100 − ${fmt(s.latest_rate)} = ${fmt(s.latest_acquittal_rate)}%` }} />
                    <Kpi testId="kpi-session-jmfc-gap" label={data.scope_range ? "State Session − JMFC gap" : "Session − JMFC gap"} value={<Delta value={s.state_session_jmfc_gap} />} sub={`Session ${fmt(s.state_session_rate)}% vs JMFC ${fmt(s.state_jmfc_rate)}% · ${f.latest}`}
                      formula={{ description: "Session-court minus JMFC conviction rate for the latest period.", expression: "Session rate − JMFC rate", example: `${fmt(s.state_session_rate)}% − ${fmt(s.state_jmfc_rate)}%` }} />
                  </>
                ) : domain === "timeliness" ? (
                  <>
                    <Kpi testId="kpi-pending" label={`${scope} pending charge sheets`} value={fmtInt(s.latest_pending)} sub={`${fmt(s.latest_pending_rate)}% of registered · base ${fmtInt(s.base_pending)}`}
                      formula={{ description: "Registered cases neither within time nor beyond time.", expression: "Registered − Within time − Beyond time", example: `${fmtInt(s.latest_pending)} (${fmt(s.latest_pending_rate)}%)` }} />
                    <Kpi testId="kpi-late-rate" label="Late charge-sheet rate" value={`${fmt(s.latest_beyond_rate)}%`} sub={`Base ${fmt(s.base_beyond_rate)}% · lower is better`}
                      formula={{ description: "Share charge-sheeted beyond prescribed time.", expression: "(Beyond-time ÷ Registered) × 100", example: `(${fmtInt(s.latest_beyond)} ÷ ${fmtInt(s.latest_den)}) × 100 = ${fmt(s.latest_beyond_rate)}%` }} />
                  </>
                ) : null}
                <Kpi testId="kpi-rank-movement" label="Rank movement" value={<span><span className="text-emerald-700">▲ {s.moved_up}</span> <span className="text-rose-700 ml-2">▼ {s.moved_down}</span></span>}
                  sub={data.prev_window ? `vs ${data.prev_window[0]} → ${data.prev_window[1]}` : "No earlier window to compare"}
                  formula={{ description: "Units that improved or declined in overall rank vs the previous window.", expression: "▲ count (prev − current > 0)\n▼ count (prev − current < 0)", example: data.prev_window ? `▲ ${s.moved_up} · ▼ ${s.moved_down}` : "No earlier window." }} />
                <Kpi testId="kpi-most-consistent" label="Most consistent unit" value={<span className="text-lg">{mc ? mc.unit : "—"}</span>} sub={mc ? `±${fmt(mc.volatility)} pp across all periods` : ""}
                  formula={{ description: "Unit with the lowest rate volatility across periods.", expression: "argmin(pstdev(rates))", example: mc ? `${mc.unit}: ±${fmt(mc.volatility)} pp` : "No unit with enough history." }} />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
