import { TrendingUp, TrendingDown } from "lucide-react";
import { Panel } from "@/components/Primitives";
import CategoryDistributionChart, { unitsByCategoryFromRows } from "@/components/CategoryDistributionChart";
import { fmt } from "@/lib/format";

const UnitList = ({ title, icon: Icon, rows, tone, testId }) => (
  <div data-testid={testId}>
    <div className={`flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-bold mb-2 ${tone}`}>
      <Icon className="h-3.5 w-3.5" />
      {title}
    </div>
    {rows.map((r) => (
      <div key={r.unit} className="flex items-center justify-between py-1.5 border-b border-slate-100 text-sm">
        <span className="truncate">
          <span className={`font-num text-xs mr-2 ${r.rank === 1 ? "text-teal-600 font-bold" : "text-slate-400"}`}>#{r.rank}</span>
          {r.unit}
        </span>
        <span className="font-num font-semibold">{fmt(r.overall_score)}</span>
      </div>
    ))}
  </div>
);

function buildPanels(rows) {
  const scored = [...rows].filter((r) => r.rank != null).sort((a, b) => a.rank - b.rank);
  const top = scored.slice(0, 5);
  const bottom = scored.slice(-5).reverse();
  const dist = {};
  for (const r of rows) {
    const c = r.category || "Not scored";
    dist[c] = (dist[c] || 0) + 1;
  }
  const byRange = new Map();
  for (const r of rows) {
    const key = r.range || "Unassigned";
    if (!byRange.has(key)) byRange.set(key, []);
    byRange.get(key).push(r);
  }
  const ranges = [...byRange.entries()].map(([range, list]) => {
    const scores = list.map((r) => r.overall_score).filter((v) => v != null);
    return {
      range,
      unit_count: list.length,
      avg_overall_score: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null,
    };
  }).sort((a, b) => (b.avg_overall_score || 0) - (a.avg_overall_score || 0));
  return { top, bottom, dist, ranges };
}

export default function ConvictionDashboardPanels({ rows }) {
  const included = rows.filter((r) => r.included !== false);
  const { top, bottom, dist, ranges } = buildPanels(included);
  const unitsByCategory = unitsByCategoryFromRows(included);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="conviction-dashboard-panels">
      <Panel title="Top & bottom units" subtitle="By overall score (current filters)">
        <div className="space-y-5">
          <UnitList title="Top 5" icon={TrendingUp} rows={top} tone="text-emerald-700" testId="conviction-dash-top" />
          <UnitList title="Bottom 5" icon={TrendingDown} rows={bottom} tone="text-rose-700" testId="conviction-dash-bottom" />
        </div>
      </Panel>
      <Panel title="Category distribution" subtitle="Units per category" bodyClassName="flex items-center justify-center">
        <CategoryDistributionChart dist={dist} unitsByCategory={unitsByCategory} testId="conviction-dash-categories" />
      </Panel>
      <Panel title="Range comparison" subtitle="Average overall score per range">
        <div className="space-y-2.5" data-testid="conviction-dash-ranges">
          {ranges.map((r, i) => (
            <div key={r.range} className="text-xs">
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
  );
}
