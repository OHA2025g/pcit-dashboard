import { useEffect } from "react";
import { ChevronDown, RotateCcw } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { clampLatestToBase, periodsAtOrBefore } from "@/lib/periodFilters";

const Field = ({ label, value, onChange, options, testId, allLabel, disabledOptions = [], disabled = false }) => (
  <div className="min-w-0">
    <div className="text-[10px] uppercase tracking-[0.14em] font-semibold text-slate-500 mb-1.5">{label}</div>
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger
        className={cn(
          "h-9 rounded-sm bg-white text-sm border-slate-200 focus:ring-2 focus:ring-teal-600/35",
          disabled && "opacity-60 cursor-not-allowed bg-slate-50",
        )}
        data-testid={testId}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="max-h-72 rounded-sm">
        {allLabel && <SelectItem value="All">{allLabel}</SelectItem>}
        {options.map((o) => {
          const optValue = typeof o === "object" && o != null ? o.value : o;
          const optLabel = typeof o === "object" && o != null ? (o.label ?? o.value) : o;
          const optDisabled = disabledOptions.includes(optValue);
          return (
            <SelectItem
              key={optValue}
              value={optValue}
              disabled={optDisabled}
              className={optDisabled ? "text-slate-400 opacity-50" : undefined}
            >
              {optLabel}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  </div>
);

/** Rank category is locked for multi unit/range picks, or mirrored from a single unit. */
function resolveCategory(units, ranges, unitCategories, prevCategory = "All") {
  if (units.length > 1 || ranges.length > 1) return "All";
  if (units.length === 1) return unitCategories?.[units[0]] || prevCategory || "All";
  return prevCategory === undefined ? "All" : prevCategory;
}

function summarize(selected, allLabel) {
  if (!selected?.length) return allLabel;
  if (selected.length === 1) return selected[0];
  if (selected.length === 2) return `${selected[0]}, ${selected[1]}`;
  return `${selected[0]} +${selected.length - 1}`;
}

export const MultiField = ({ label, values, onChange, options, allLabel, testId, disabledOptions = [] }) => {
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

export default function FilterBar({
  meta,
  f,
  set,
  onReset,
  embedded = false,
  testId = "filter-bar",
  singleSelectUnitRange = false,
  unitCategories = {},
}) {
  const upd = (k) => (v) => set((p) => ({ ...p, [k]: v }));
  const simple = meta.domain === "emergency112" || meta.domain === "training" || meta.domain === "antf" || meta.domain === "hsp";
  const snapshot = meta.domain === "antf";
  const hasPeriodGrain = (meta.domain === "emergency112" || meta.domain === "hsp")
    && Array.isArray(meta.period_grain_options) && meta.period_grain_options.length > 0;
  const grainId = f.period_grain || meta.default_period_grain || "monthly";
  const grainMeta = hasPeriodGrain ? (meta.period_grains?.[grainId] || null) : null;
  const periods = grainMeta?.periods || meta.periods || [];
  const unitRanges = meta.unit_ranges || {};
  const latestDisabled = periodsAtOrBefore(periods, f.base);
  const baseDisabled = periods.length ? [periods[periods.length - 1]] : [];

  const setPeriodGrain = (nextGrain) => set((p) => {
    const next = meta.period_grains?.[nextGrain];
    const nextPeriods = next?.periods || meta.periods || [];
    const nextBase = next?.default_base || nextPeriods[Math.max(0, nextPeriods.length - 2)] || p.base;
    const nextLatest = next?.default_latest || nextPeriods[nextPeriods.length - 1] || p.latest;
    return { ...p, period_grain: nextGrain, base: nextBase, latest: nextLatest };
  });

  const selectedUnitsRaw = Array.isArray(f.unit) ? f.unit : (f.unit && f.unit !== "All" ? [f.unit] : []);
  const selectedRangesRaw = Array.isArray(f.range) ? f.range : (f.range && f.range !== "All" ? [f.range] : []);
  const selectedUnits = singleSelectUnitRange ? selectedUnitsRaw.slice(0, 1) : selectedUnitsRaw;
  const selectedRanges = singleSelectUnitRange ? selectedRangesRaw.slice(0, 1) : selectedRangesRaw;
  const unitsSelected = selectedUnits.length > 0;
  const rangesSelected = selectedRanges.length > 0;
  const multiUnitOrRange = selectedUnits.length > 1 || selectedRanges.length > 1;
  const singleUnitSelected = selectedUnits.length === 1;
  const categoryFrozen = multiUnitOrRange || singleUnitSelected;

  const allowedRangesFromUnits = unitsSelected
    ? [...new Set(selectedUnits.map((u) => unitRanges[u]).filter(Boolean))]
    : [];
  const rangeDisabled = unitsSelected
    ? (meta.ranges || []).filter((r) => !allowedRangesFromUnits.includes(r))
    : [];
  const unitsForRange = rangesSelected
    ? (meta.units || []).filter((u) => selectedRanges.includes(unitRanges[u]))
    : (meta.units || []);

  const setBase = (v) => set((p) => ({
    ...p,
    base: v,
    latest: clampLatestToBase(periods, v, p.latest),
  }));

  const setUnit = (next) => set((p) => {
    const unit = singleSelectUnitRange ? next.slice(0, 1) : next;
    const cur = Array.isArray(p.range) ? p.range : (p.range && p.range !== "All" ? [p.range] : []);
    const clippedCur = singleSelectUnitRange ? cur.slice(0, 1) : cur;
    if (!unit.length) {
      return {
        ...p,
        unit: [],
        category: resolveCategory([], clippedCur, unitCategories, "All"),
      };
    }
    const allowed = [...new Set(unit.map((u) => unitRanges[u]).filter(Boolean))];
    const range = clippedCur.length ? clippedCur.filter((r) => allowed.includes(r)) : [];
    return {
      ...p,
      unit,
      range,
      category: resolveCategory(unit, range, unitCategories, "All"),
    };
  });

  const setRange = (next) => set((p) => {
    const range = singleSelectUnitRange ? next.slice(0, 1) : next;
    const cur = Array.isArray(p.unit) ? p.unit : (p.unit && p.unit !== "All" ? [p.unit] : []);
    const clippedCur = singleSelectUnitRange ? cur.slice(0, 1) : cur;
    if (!range.length) {
      return {
        ...p,
        range: [],
        category: resolveCategory(clippedCur, [], unitCategories, singleUnitSelected ? (unitCategories?.[clippedCur[0]] || "All") : "All"),
      };
    }
    const unit = clippedCur.filter((u) => range.includes(unitRanges[u]));
    return {
      ...p,
      range,
      unit,
      category: resolveCategory(unit, range, unitCategories, "All"),
    };
  });

  useEffect(() => {
    if (!singleUnitSelected) return undefined;
    const unitName = selectedUnits[0];
    const cat = unitCategories?.[unitName];
    if (!cat || cat === f.category) return undefined;
    set((p) => ({ ...p, category: cat }));
    return undefined;
  }, [singleUnitSelected, selectedUnits, unitCategories, f.category, set]);

  const grid = snapshot
    ? "grid-cols-1 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-[1.2fr_1.1fr_1.2fr_auto]"
    : hasPeriodGrain
      ? "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-[1.2fr_1.1fr_1.1fr_1fr_1fr_1.1fr_auto]"
      : simple
        ? "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-[1.2fr_1.1fr_1fr_1fr_1.1fr_auto]"
        : "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-[1.3fr_1.1fr_1.2fr_1fr_1fr_1.1fr_auto]";

  const unitField = singleSelectUnitRange ? (
    <Field
      label="Unit"
      value={selectedUnits[0] || "All"}
      onChange={(v) => setUnit(v === "All" ? [] : [v])}
      options={unitsForRange}
      allLabel="All units"
      testId="filter-unit"
    />
  ) : (
    <MultiField
      label="Unit"
      values={selectedUnits}
      onChange={setUnit}
      options={unitsForRange}
      allLabel="All units"
      testId="filter-unit"
    />
  );

  const rangeField = singleSelectUnitRange ? (
    <Field
      label="Range"
      value={selectedRanges[0] || "All"}
      onChange={(v) => setRange(v === "All" ? [] : [v])}
      options={meta.ranges || []}
      allLabel="All ranges"
      disabledOptions={rangeDisabled}
      testId="filter-range"
    />
  ) : (
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
      className={embedded
        ? "surface-panel rounded-sm p-3"
        : "sticky top-14 z-40 -mx-3 sm:-mx-4 md:-mx-8 px-3 sm:px-4 md:px-8 py-3 sm:py-3.5 bg-background/85 backdrop-blur-xl border-b border-slate-200/90 shadow-[0_8px_24px_-20px_rgba(15,23,42,0.35)]"}
      data-testid={testId}
    >
      <div className={`grid ${grid} gap-3 items-end`}>
        {hasPeriodGrain && (
          <Field
            label="Period view"
            value={grainId}
            onChange={setPeriodGrain}
            options={(meta.period_grain_options || []).map((o) => ({ value: o.id, label: o.label }))}
            testId="filter-period-grain"
          />
        )}
        {!simple && <Field label="Case type" value={f.type} onChange={upd("type")} options={meta.types} testId="filter-type" />}
        {rangeField}
        {unitField}
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
        <Field
          label={simple ? "Category" : "Rank category"}
          value={f.category || "All"}
          onChange={upd("category")}
          options={meta.categories}
          allLabel="All categories"
          disabled={categoryFrozen}
          testId="filter-category"
        />
        <Button variant="ghost" size="sm" className="h-9 w-full sm:w-auto rounded-sm text-slate-600 hover:text-slate-900 hover:bg-teal-50 justify-center" onClick={onReset} data-testid="filter-reset">
          <RotateCcw className="h-4 w-4 mr-1.5" />Reset
        </Button>
      </div>
    </div>
  );
}
