import { RotateCcw } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

const Field = ({ label, value, onChange, options, testId, allLabel, disabledOptions = [] }) => (
  <div className="min-w-0">
    <div className="text-[10px] uppercase tracking-[0.14em] font-semibold text-slate-500 mb-1.5">{label}</div>
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 rounded-sm bg-white text-sm border-slate-200 focus:ring-2 focus:ring-amber-400/40" data-testid={testId}>
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

function nextDistinctPeriod(periods, current, blocked) {
  const from = periods.indexOf(current);
  for (let i = from + 1; i < periods.length; i += 1) {
    if (periods[i] !== blocked) return periods[i];
  }
  for (let i = from - 1; i >= 0; i -= 1) {
    if (periods[i] !== blocked) return periods[i];
  }
  return periods.find((p) => p !== blocked) || current;
}

export default function FilterBar({ meta, f, set, onReset }) {
  const upd = (k) => (v) => set((p) => ({ ...p, [k]: v }));
  const simple = meta.domain === "emergency112" || meta.domain === "training";

  const setBase = (v) => set((p) => {
    if (v === p.latest) {
      return { ...p, base: v, latest: nextDistinctPeriod(meta.periods, p.latest, v) };
    }
    return { ...p, base: v };
  });

  const grid = simple
    ? "grid-cols-2 md:grid-cols-4 xl:grid-cols-[1.2fr_1fr_1fr_1.1fr_auto]"
    : "grid-cols-2 md:grid-cols-4 xl:grid-cols-[1.3fr_1.2fr_1fr_1fr_1.1fr_1.1fr_auto]";

  return (
    <div
      className="sticky top-16 z-40 -mx-4 md:-mx-8 px-4 md:px-8 py-3.5 bg-background/85 backdrop-blur-xl border-b border-slate-200/90 shadow-[0_8px_24px_-20px_rgba(15,23,42,0.35)]"
      data-testid="filter-bar"
    >
      <div className={`grid ${grid} gap-3 items-end`}>
        {!simple && <Field label="Case type" value={f.type} onChange={upd("type")} options={meta.types} testId="filter-type" />}
        <Field label="Unit" value={f.unit} onChange={upd("unit")} options={meta.units} allLabel="All units" testId="filter-unit" />
        <Field label="Base period" value={f.base} onChange={setBase} options={meta.periods} testId="filter-base-period" />
        <Field
          label="Latest period"
          value={f.latest}
          onChange={upd("latest")}
          options={meta.periods}
          disabledOptions={[f.base]}
          testId="filter-latest-period"
        />
        {!simple && <Field label="Range" value={f.range} onChange={upd("range")} options={meta.ranges} allLabel="All ranges" testId="filter-range" />}
        <Field label={simple ? "Category" : "Rank category"} value={f.category} onChange={upd("category")} options={meta.categories} allLabel="All categories" testId="filter-category" />
        <Button variant="ghost" size="sm" className="h-9 rounded-sm text-slate-600 hover:text-slate-900 hover:bg-amber-50" onClick={onReset} data-testid="filter-reset">
          <RotateCcw className="h-4 w-4 mr-1.5" />Reset
        </Button>
      </div>
    </div>
  );
}
