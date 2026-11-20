import { Info } from "lucide-react";
import { motion } from "framer-motion";
import { CATEGORY_STYLES } from "@/lib/format";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { fadeUp } from "@/lib/motion";
import { cn } from "@/lib/utils";

export const CategoryBadge = ({ value, testId }) => {
  const s = CATEGORY_STYLES[value] || CATEGORY_STYLES["Not scored"];
  return (
    <span data-testid={testId} className={`inline-flex items-center gap-1.5 border px-2 py-0.5 rounded-sm text-[11px] font-semibold whitespace-nowrap ${s.cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />{value}
    </span>
  );
};

export const Panel = ({ title, subtitle, right, children, className = "", testId, tone = "default" }) => (
  <motion.section
    variants={fadeUp}
    initial="hidden"
    animate="show"
    data-testid={testId}
    className={cn(
      "rounded-sm rise overflow-hidden",
      tone === "emphasis" ? "surface-panel-emphasis" : "surface-panel",
      className,
    )}
  >
    {(title || right) && (
      <div className="flex items-start justify-between gap-4 px-5 pt-4 pb-3 border-b border-slate-100/90 bg-gradient-to-b from-white to-slate-50/40">
        <div>
          <h3 className="font-display text-base font-semibold text-slate-900 tracking-tight">{title}</h3>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{subtitle}</p>}
        </div>
        {right}
      </div>
    )}
    <div className="p-5">{children}</div>
  </motion.section>
);

export const Kpi = ({ label, value, sub, accent, tone, testId, formula }) => {
  const isBase = tone === "base" || (typeof testId === "string" && /(^|-)base(-|$)/.test(testId));
  const isLatest = tone === "latest" || (typeof testId === "string" && /(^|-)latest(-|$)/.test(testId));
  const isChange =
    tone === "change" ||
    (typeof testId === "string" && /(^|-)(improvement|improv|time-imp|pct-imp)(-|$)/.test(testId));
  return (
  <motion.div
    variants={fadeUp}
    initial="hidden"
    whileInView="show"
    viewport={{ once: true, margin: "-20px" }}
    data-testid={testId}
    className={cn(
      "surface-panel rounded-sm px-4 py-3.5 relative overflow-visible h-full flex flex-col transition-shadow duration-200 hover:shadow-md hover:shadow-slate-900/5",
      accent && !isBase && !isLatest && !isChange && "kpi-accent-rail",
      isBase && "kpi-base",
      isLatest && !isBase && "kpi-latest",
      isChange && !isBase && !isLatest && "kpi-change",
    )}
  >
    {formula && (
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            data-testid={testId ? `${testId}-info` : undefined}
            aria-label={`How ${label} is calculated`}
            className="kpi-info-btn absolute top-2 right-2 z-10 h-6 w-6 inline-flex items-center justify-center rounded-sm border border-slate-200 bg-white text-slate-500 hover:text-brand-navy hover:border-teal-600 hover:bg-teal-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/50 transition-colors"
          >
            <Info className="h-3.5 w-3.5" strokeWidth={2.25} />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" side="bottom" className="w-80 p-3.5 rounded-sm border-slate-200 shadow-lg bg-white surface-panel">
          <div className="text-[10px] uppercase tracking-[0.14em] font-semibold text-teal-700">How it’s calculated</div>
          <div className="text-sm font-semibold text-slate-900 mt-1 leading-snug">{label}</div>
          {typeof formula === "string" ? (
            <p className="text-xs text-slate-600 mt-2 leading-relaxed whitespace-pre-wrap">{formula}</p>
          ) : (
            <div className="mt-2 space-y-2">
              {formula.description && <p className="text-xs text-slate-600 leading-relaxed">{formula.description}</p>}
              {formula.expression && (
                <div className="rounded-sm bg-slate-50 border border-slate-100 px-2.5 py-2 font-mono text-[11px] text-slate-800 leading-relaxed whitespace-pre-wrap">
                  {formula.expression}
                </div>
              )}
              {formula.example && <p className="text-[11px] text-slate-500 leading-relaxed">{formula.example}</p>}
            </div>
          )}
        </PopoverContent>
      </Popover>
    )}
    <div className="kpi-label text-[10.5px] uppercase tracking-[0.12em] font-semibold text-slate-500 leading-snug h-[2.75rem] overflow-hidden pr-7">{label}</div>
    <div className="kpi-figure font-num text-2xl font-semibold text-slate-900 mt-2 tracking-tight leading-none h-8 flex items-end">{value}</div>
    <div className="kpi-sub text-[11px] text-slate-500 mt-1.5 min-h-[2.5rem] leading-snug">{sub || "\u00A0"}</div>
  </motion.div>
  );
};

export const Delta = ({ value, suffix = " pp", invert = false, testId }) => {
  if (value === null || value === undefined) return <span data-testid={testId}>—</span>;
  const good = invert ? value < 0 : value >= 0;
  return (
    <span data-testid={testId} className={`font-num font-semibold ${good ? "text-emerald-700" : "text-rose-700"}`}>
      {value > 0 ? "+" : ""}{value.toFixed(2)}{suffix}
    </span>
  );
};
