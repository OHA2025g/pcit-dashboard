import { useState } from "react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { CategoryBadge } from "@/components/Primitives";
import { CATEGORY_STYLES } from "@/lib/format";
import { CHART } from "@/lib/chartTheme";

function unitsFor(unitsByCategory, name) {
  const list = unitsByCategory?.[name];
  return Array.isArray(list) ? list : [];
}

function CategoryUnitsTip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const entry = payload[0];
  const name = entry.name;
  const count = entry.value;
  const units = entry.payload?.units || [];
  const color = (CATEGORY_STYLES[name] || CATEGORY_STYLES["Not scored"]).color;
  return (
    <div
      className="rounded-sm bg-[#0B1220] text-white text-xs px-3 py-2 shadow-lg border border-slate-800 max-w-[260px] max-h-56 overflow-y-auto"
      data-testid="category-units-tooltip"
    >
      <div className="font-semibold mb-1.5 text-slate-200 flex items-center gap-2">
        <span className="h-2 w-2 rounded-full shrink-0" style={{ background: color }} />
        <span className="min-w-0 truncate">{name}</span>
        <span className="font-num text-slate-400 shrink-0">({count})</span>
      </div>
      {units.length ? (
        <ul className="space-y-0.5">
          {units.map((u) => (
            <li key={u} className="text-slate-300 leading-snug">{u}</li>
          ))}
        </ul>
      ) : (
        <div className="text-slate-500">No units listed</div>
      )}
    </div>
  );
}

/**
 * Donut + legend for category counts. Hover (slice or legend) lists unit names in that category.
 */
export default function CategoryDistributionChart({ dist = {}, unitsByCategory = {}, testId = "category-distribution" }) {
  const [legendHover, setLegendHover] = useState(null);

  const pieData = Object.entries(dist)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({
      name,
      value,
      units: unitsFor(unitsByCategory, name),
    }));

  if (!pieData.length) {
    return <div className="text-sm text-slate-500 py-6 text-center">No category data</div>;
  }

  return (
    <div className="flex h-full min-h-[200px] items-center justify-center gap-6 w-full" data-testid={testId}>
      <div className="h-44 w-44 shrink-0">
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={pieData}
              dataKey="value"
              nameKey="name"
              innerRadius={48}
              outerRadius={80}
              paddingAngle={2}
              stroke="none"
              isAnimationActive
              animationDuration={CHART.animationDuration}
            >
              {pieData.map((d) => (
                <Cell key={d.name} fill={(CATEGORY_STYLES[d.name] || CATEGORY_STYLES["Not scored"]).color} />
              ))}
            </Pie>
            <Tooltip content={<CategoryUnitsTip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="space-y-2.5">
        {Object.entries(dist).map(([k, v]) => {
          const units = unitsFor(unitsByCategory, k);
          const showTip = legendHover === k && units.length > 0;
          return (
            <div
              key={k}
              className="relative flex items-center gap-2.5 text-xs"
              onMouseEnter={() => setLegendHover(k)}
              onMouseLeave={() => setLegendHover(null)}
              data-testid={`category-legend-${k}`}
            >
              <CategoryBadge value={k} />
              <span className="font-num font-semibold text-slate-800">{v}</span>
              {showTip && (
                <div
                  className="absolute left-0 top-full mt-1.5 z-30 rounded-sm bg-[#0B1220] text-white text-xs px-3 py-2 shadow-lg border border-slate-800 max-w-[260px] max-h-48 overflow-y-auto"
                  data-testid={`category-legend-units-${k}`}
                >
                  <div className="font-semibold mb-1 text-slate-200">
                    {k} <span className="text-slate-400 font-num">({units.length})</span>
                  </div>
                  <ul className="space-y-0.5">
                    {units.map((u) => (
                      <li key={u} className="text-slate-300 leading-snug whitespace-nowrap">{u}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Build category → sorted unit names from scored dashboard rows. */
export function unitsByCategoryFromRows(rows) {
  const map = {};
  for (const r of rows || []) {
    const c = r?.category || "Not scored";
    if (!map[c]) map[c] = [];
    if (r?.unit) map[c].push(r.unit);
  }
  for (const c of Object.keys(map)) {
    map[c] = [...new Set(map[c])].sort((a, b) => a.localeCompare(b));
  }
  return map;
}
