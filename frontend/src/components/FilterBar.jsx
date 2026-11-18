import { RotateCcw } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

const Field = ({ label, value, onChange, options, testId, allLabel, disabledOptions = [] }) => (
  <div className="min-w-0">
    <div className="text-[10px] uppercase tracking-[0.14em] font-semibold text-slate-500 mb-1.5">{label}</div>
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 rounded-sm bg-white text-sm border-slate-200 focus:ring-2 focus:ring-teal-600/35" data-testid={testId}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="max-h-72 rounded-sm">
        {allLabel && <SelectItem value="All">{allLabel}</SelectItem>}
        {options.map((o) => {
          const disabled = disabledOptions.includes(o);
          return (
            <SelectItem
              key={o}
              value={o}
              disabled={disabled}
              className={disabled ? "text-slate-400 opacity-50" : undefined}
            >
              {o}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  </div>
);

function firstPeriodAfter(periods, base) {
  const idx = periods.indexOf(base);
  if (idx < 0) return periods[0];
  return periods[idx + 1] || null;
}

function periodsAtOrBefore(periods, base) {
  const idx = periods.indexOf(base);
  if (idx < 0) return [base];
  return periods.slice(0, idx + 1);
}

export default function FilterBar({ meta, f, set, onReset }) {
  const upd = (k) => (v) => set((p) => ({ ...p, [k]: v }));
  const simple = meta.domain === "emergency112" || meta.domain === "training" || meta.domain === "antf";
  const snapshot = meta.domain === "antf";
  const periods = meta.periods || [];
  const unitRanges = meta.unit_ranges || {};
  const latestDisabled = periodsAtOrBefore(periods, f.base);
  // Last period cannot be base — nothing after it for Latest.
  const baseDisabled = periods.length ? [periods[periods.length - 1]] : [];
  const unitSelected = f.unit && f.unit !== "All";
  const unitRange = unitSelected ? unitRanges[f.unit] : null;
  const rangeDisabled = unitSelected
    ? (meta.ranges || []).filter((r) => r !== unitRange)
    : [];

  const setBase = (v) => set((p) => {
    const nextLatest = firstPeriodAfter(periods, v);
    const latestIdx = periods.indexOf(p.latest);
    const baseIdx = periods.indexOf(v);
    const latestStillValid = latestIdx > baseIdx;
    return {
      ...p,
      base: v,
      latest: latestStillValid ? p.latest : (nextLatest || p.latest),
    };
  });

  const setUnit = (v) => set((p) => {
    if (v === "All") return { ...p, unit: v, range: "All" };
    const mapped = unitRanges[v];
    return mapped ? { ...p, unit: v, range: mapped } : { ...p, unit: v };
  });

  const grid = snapshot
    ? "grid-cols-2 md:grid-cols-3 xl:grid-cols-[1.4fr_1.2fr_auto]"
    : simple
      ? "grid-cols-2 md:grid-cols-4 xl:grid-cols-[1.2fr_1fr_1fr_1.1fr_auto]"
      : "grid-cols-2 md:grid-cols-4 xl:grid-cols-[1.3fr_1.2fr_1fr_1fr_1.1fr_1.1fr_auto]";

  return (
    <div
      className="sticky top-16 z-40 -mx-4 md:-mx-8 px-4 md:px-8 py-3.5 bg-background/85 backdrop-blur-xl border-b border-slate-200/90 shadow-[0_8px_24px_-20px_rgba(15,23,42,0.35)]"
      data-testid="filter-bar"
    >
      <div className={`grid ${grid} gap-3 items-end`}>
        {!simple && <Field label="Case type" value={f.type} onChange={upd("type")} options={meta.types} testId="filter-type" />}
        <Field label="Unit" value={f.unit} onChange={setUnit} options={meta.units} allLabel="All units" testId="filter-unit" />
        {!snapshot && (
          <>
            <Field
              label="Base period"
              value={f.base}
              onChange={setBase}
              options={periods}
              disabledOptions={baseDisabled}
              testId="filter-base-period"
            />
            <Field
              label="Latest period"
              value={f.latest}
              onChange={upd("latest")}
              options={periods}
              disabledOptions={latestDisabled}
              testId="filter-latest-period"
            />
          </>
        )}
        {!simple && (
          <Field
            label="Range"
            value={f.range}
            onChange={upd("range")}
            options={meta.ranges}
            allLabel={unitSelected ? undefined : "All ranges"}
            disabledOptions={rangeDisabled}
            testId="filter-range"
          />
        )}
        <Field label={simple ? "Category" : "Rank category"} value={f.category} onChange={upd("category")} options={meta.categories} allLabel="All categories" testId="filter-category" />
        <Button variant="ghost" size="sm" className="h-9 rounded-sm text-slate-600 hover:text-slate-900 hover:bg-teal-50" onClick={onReset} data-testid="filter-reset">
          <RotateCcw className="h-4 w-4 mr-1.5" />Reset
        </Button>
      </div>
    </div>
  );
}
