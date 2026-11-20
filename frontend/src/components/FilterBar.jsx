import { ChevronDown, RotateCcw } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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

function summarize(selected, allLabel) {
  if (!selected?.length) return allLabel;
  if (selected.length === 1) return selected[0];
  if (selected.length === 2) return `${selected[0]}, ${selected[1]}`;
  return `${selected[0]} +${selected.length - 1}`;
}

const MultiField = ({ label, values, onChange, options, allLabel, testId, disabledOptions = [] }) => {
  const selected = values || [];
  const isAll = selected.length === 0;

  const toggle = (opt) => {
    if (selected.includes(opt)) onChange(selected.filter((x) => x !== opt));
    else onChange([...selected, opt]);
  };

  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-[0.14em] font-semibold text-slate-500 mb-1.5">{label}</div>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            data-testid={testId}
            className={cn(
              "flex h-9 w-full items-center justify-between gap-2 rounded-sm border border-slate-200 bg-white px-3 text-sm",
              "focus:outline-none focus:ring-2 focus:ring-teal-600/35",
            )}
          >
            <span className="truncate text-left">{summarize(selected, allLabel)}</span>
            <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-[220px] p-1.5 rounded-sm max-h-72 overflow-auto">
          <button
            type="button"
            data-testid={`${testId}-all`}
            onClick={() => onChange([])}
            className={cn(
              "flex w-full items-center rounded-sm px-2.5 py-1.5 text-left text-sm hover:bg-teal-50",
              isAll && "bg-teal-50 text-teal-900 font-medium",
            )}
          >
            {allLabel}
          </button>
          <div className="my-1 h-px bg-slate-100" />
          {options.map((o) => {
            const disabled = disabledOptions.includes(o);
            const active = selected.includes(o);
            return (
              <button
                key={o}
                type="button"
                data-testid={`${testId}-option-${o}`}
                disabled={disabled}
                onClick={() => { if (!disabled) toggle(o); }}
                className={cn(
                  "flex w-full items-center rounded-sm px-2.5 py-1.5 text-left text-sm truncate",
                  disabled && "cursor-not-allowed opacity-40",
                  !disabled && "hover:bg-teal-50",
                  active && "bg-teal-50 text-teal-900 font-medium",
                )}
              >
                {o}
              </button>
            );
          })}
        </PopoverContent>
      </Popover>
    </div>
  );
};

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
  const simple = meta.domain === "emergency112" || meta.domain === "training" || meta.domain === "antf" || meta.domain === "hsp";
  const snapshot = meta.domain === "antf";
  const periods = meta.periods || [];
  const unitRanges = meta.unit_ranges || {};
  const latestDisabled = periodsAtOrBefore(periods, f.base);
  const baseDisabled = periods.length ? [periods[periods.length - 1]] : [];

  const selectedUnits = Array.isArray(f.unit) ? f.unit : (f.unit && f.unit !== "All" ? [f.unit] : []);
  const selectedRanges = Array.isArray(f.range) ? f.range : (f.range && f.range !== "All" ? [f.range] : []);
  const unitsSelected = selectedUnits.length > 0;
  const rangesSelected = selectedRanges.length > 0;

  const allowedRangesFromUnits = unitsSelected
    ? [...new Set(selectedUnits.map((u) => unitRanges[u]).filter(Boolean))]
    : [];
  const rangeDisabled = unitsSelected
    ? (meta.ranges || []).filter((r) => !allowedRangesFromUnits.includes(r))
    : [];
  const unitsForRange = rangesSelected
    ? (meta.units || []).filter((u) => selectedRanges.includes(unitRanges[u]))
    : (meta.units || []);

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

  const setUnit = (next) => set((p) => {
    if (!next.length) return { ...p, unit: [] };
    const allowed = [...new Set(next.map((u) => unitRanges[u]).filter(Boolean))];
    const cur = Array.isArray(p.range) ? p.range : (p.range && p.range !== "All" ? [p.range] : []);
    const range = cur.length ? cur.filter((r) => allowed.includes(r)) : [];
    return { ...p, unit: next, range };
  });

  const setRange = (next) => set((p) => {
    if (!next.length) return { ...p, range: [] };
    const cur = Array.isArray(p.unit) ? p.unit : (p.unit && p.unit !== "All" ? [p.unit] : []);
    const unit = cur.filter((u) => next.includes(unitRanges[u]));
    return { ...p, range: next, unit };
  });

  const grid = snapshot
    ? "grid-cols-2 md:grid-cols-4 xl:grid-cols-[1.2fr_1.1fr_1.2fr_auto]"
    : simple
      ? "grid-cols-2 md:grid-cols-3 xl:grid-cols-[1.2fr_1.1fr_1fr_1fr_1.1fr_auto]"
      : "grid-cols-2 md:grid-cols-4 xl:grid-cols-[1.3fr_1.1fr_1.2fr_1fr_1fr_1.1fr_auto]";

  const unitField = (
    <MultiField
      label="Unit"
      values={selectedUnits}
      onChange={setUnit}
      options={unitsForRange}
      allLabel="All units"
      testId="filter-unit"
    />
  );

  const rangeField = (
    <MultiField
      label="Range"
      values={selectedRanges}
      onChange={setRange}
      options={meta.ranges || []}
      allLabel="All ranges"
      disabledOptions={rangeDisabled}
      testId="filter-range"
    />
  );

  return (
    <div
      className="sticky top-14 z-40 -mx-4 md:-mx-8 px-4 md:px-8 py-3.5 bg-background/85 backdrop-blur-xl border-b border-slate-200/90 shadow-[0_8px_24px_-20px_rgba(15,23,42,0.35)]"
      data-testid="filter-bar"
    >
      <div className={`grid ${grid} gap-3 items-end`}>
        {!simple && <Field label="Case type" value={f.type} onChange={upd("type")} options={meta.types} testId="filter-type" />}
        {simple && unitField}
        {rangeField}
        {!simple && unitField}
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
        <Field label={simple ? "Category" : "Rank category"} value={f.category} onChange={upd("category")} options={meta.categories} allLabel="All categories" testId="filter-category" />
        <Button variant="ghost" size="sm" className="h-9 rounded-sm text-slate-600 hover:text-slate-900 hover:bg-teal-50" onClick={onReset} data-testid="filter-reset">
          <RotateCcw className="h-4 w-4 mr-1.5" />Reset
        </Button>
      </div>
    </div>
  );
}
