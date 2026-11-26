import { TrendingUp, TrendingDown } from "lucide-react";
import { Panel } from "@/components/Primitives";
import CategoryDistributionChart from "@/components/CategoryDistributionChart";
import { fmt } from "@/lib/format";

const UnitList = ({ title, icon: Icon, rows, tone, testId }) => (
  <div data-testid={testId}>
    <div className={`flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-bold mb-2 ${tone}`}>
      <Icon className="h-3.5 w-3.5" />
      {title}
    </div>
    {(rows || []).map((r) => (
      <div key={r.unit} className="flex items-center justify-between py-1.5 border-b border-slate-100 text-sm">
        <span className="truncate">
          <span className={`font-num text-xs mr-2 ${r.rank === 1 ? "text-teal-600 font-bold" : "text-slate-400"}`}>#{r.rank}</span>
          {r.unit}
        </span>
        <span className="font-num font-semibold">{fmt(r.overall_score)}</span>
      </div>
    ))}
    {!rows?.length && <div className="text-sm text-slate-500 py-2">No scored units</div>}
  </div>
);

/**
 * Cohort panels: Top & bottom, Category distribution, Range comparison.
 * Prefer ConvictionDashboardPanels (from live rows) on domain Overview tabs.
 */
export default function DomainSnapshotPanels({ domain, snapshot, rateLabel = "Latest rate", testIdPrefix = "snap" }) {
  if (!snapshot) return null;
  const ranges = snapshot.ranges || [];
  const hasRanges = ranges.some((r) => r.range);
  const useRangeComparison = domain === "timeliness" || hasRanges;
  const totals = snapshot.totals || {};

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" data-testid={`${testIdPrefix}-cohort`}>
      <Panel title="Top & bottom units" subtitle="By overall score">
        <div className="space-y-5">
          <UnitList title="Top 5" icon={TrendingUp} rows={snapshot.top} tone="text-emerald-700" testId={`${testIdPrefix}-top`} />
          <UnitList title="Bottom 5" icon={TrendingDown} rows={snapshot.bottom} tone="text-rose-700" testId={`${testIdPrefix}-bottom`} />
        </div>
      </Panel>
      <Panel title="Category distribution" subtitle="Units per category" bodyClassName="flex items-center justify-center">
        <CategoryDistributionChart
          dist={snapshot.distribution}
          unitsByCategory={snapshot.units_by_category || {}}
          testId={`${testIdPrefix}-categories`}
        />
      </Panel>
      <Panel
        title={useRangeComparison ? "Range comparison" : "Unit snapshot"}
        subtitle={useRangeComparison ? "Average overall score per range" : "Average score"}
      >
        <div className="space-y-2.5" data-testid={`${testIdPrefix}-ranges`}>
          {useRangeComparison ? (
            ranges.length ? ranges.map((r, i) => (
              <div key={r.range || i} className="text-xs" style={{ animationDelay: `${i * 40}ms` }}>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-700 truncate">
                    {r.range || "Unassigned"} <span className="text-slate-400">({r.unit_count})</span>
                  </span>
                  <span className="font-num font-semibold">{fmt(r.avg_overall_score, 1)}</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-sm overflow-hidden">
                  <div
                    className="h-full bg-brand-navy bar-grow rounded-sm"
                    style={{ width: `${Math.max(0, r.avg_overall_score || 0)}%`, animationDelay: `${80 + i * 50}ms` }}
                  />
                </div>
              </div>
            )) : (
              <div className="text-sm text-slate-500 py-2">No range data</div>
            )
          ) : (
            <div className="text-sm text-slate-600">
              <div className="flex justify-between py-1">
                <span>Units scored</span>
                <span className="font-num font-semibold">{totals.scored_count} / {totals.unit_count}</span>
              </div>
              <div className="flex justify-between py-1">
                <span>Avg score</span>
                <span className="font-num font-semibold">{fmt(totals.avg_overall_score)}</span>
              </div>
              {totals.latest_rate != null && (
                <div className="flex justify-between py-1">
                  <span>{rateLabel}</span>
                  <span className="font-num font-semibold">{fmt(totals.latest_rate)}%</span>
                </div>
              )}
            </div>
          )}
        </div>
      </Panel>
    </div>
  );
}
