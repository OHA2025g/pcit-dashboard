import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Panel, CategoryBadge } from "@/components/Primitives";
import ExportMenu from "@/components/ExportMenu";
import { useApi } from "@/lib/api";
import { fmt, slug } from "@/lib/format";

const COLS = [
  { key: "rank", label: "Rank" }, { key: "unit", label: "Unit" }, { key: "range", label: "Range" },
  { key: "conviction_score", label: "Conviction score" }, { key: "conviction_rank", label: "Conv. rank" },
  { key: "timeliness_score", label: "Timeliness score" }, { key: "timeliness_rank", label: "Tim. rank" },
  { key: "emergency112_score", label: "112 score" }, { key: "emergency112_rank", label: "112 rank" },
  { key: "training_score", label: "Training score" }, { key: "training_rank", label: "Train. rank" },
  { key: "combined_score", label: "Combined index" }, { key: "category", label: "Category" },
];

function weightLabel(weight) {
  if (weight && typeof weight === "object") {
    const c = Math.round((weight.conviction ?? 0) * 100);
    const t = Math.round((weight.timeliness ?? 0) * 100);
    const e = Math.round((weight.emergency112 ?? 0) * 100);
    const tr = Math.round((weight.training ?? 0) * 100);
    return `${c}% conviction · ${t}% timeliness · ${e}% 112 · ${tr}% training`;
  }
  const w = Math.round((weight ?? 0.5) * 100);
  return `${w}% conviction / ${100 - w}% other`;
}

export default function CombinedIndex() {
  const api = useApi();
  const [data, setData] = useState(null);
  const [all, setAll] = useState(false);
  useEffect(() => { api("get", "/combined").then(setData).catch(() => setData({ rows: [], error: true })); }, [api]);
  if (!data) return <div className="flex items-center gap-2 text-slate-500 py-6"><Loader2 className="h-4 w-4 animate-spin" />Loading combined index…</div>;
  if (data.error) return <div className="text-sm text-rose-700" data-testid="combined-error">Combined index is unavailable: conviction, timeliness, 112, and training datasets must all be active.</div>;
  const rows = [...data.rows].sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));
  const label = weightLabel(data.weight);
  const win = data.windows || {};
  const shown = all ? rows : rows.slice(0, 10);
  return (
    <Panel testId="combined-index-panel" title="Combined police performance index"
      subtitle={`${label}${win.conviction ? ` · conviction ${win.conviction.base} → ${win.conviction.latest}` : ""} · policy v${data.policy_version ?? "-"}`}
      right={<ExportMenu title="Combined Performance Index" view="combined-index" columns={COLS} rows={rows} context={{ Weight: label }} testId="combined-export" />}>
      <div className="overflow-x-auto -mx-5">
        <table className="w-full text-[12.5px]" data-testid="combined-table">
          <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500"><tr>{COLS.map((c) => <th key={c.key} className="text-left px-3 py-2 whitespace-nowrap">{c.label}</th>)}</tr></thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.unit} className="border-t border-slate-100 hover:bg-amber-50/50" data-testid={`combined-row-${slug(r.unit)}`}>
                <td className="px-3 py-2 font-num font-bold">{r.rank ?? "—"}</td>
                <td className="px-3 py-2 font-medium whitespace-nowrap">{r.unit}</td>
                <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{r.range}</td>
                <td className="px-3 py-2 font-num">{fmt(r.conviction_score)}</td>
                <td className="px-3 py-2 font-num text-slate-500">{r.conviction_rank ?? "—"}</td>
                <td className="px-3 py-2 font-num">{fmt(r.timeliness_score)}</td>
                <td className="px-3 py-2 font-num text-slate-500">{r.timeliness_rank ?? "—"}</td>
                <td className="px-3 py-2 font-num">{fmt(r.emergency112_score)}</td>
                <td className="px-3 py-2 font-num text-slate-500">{r.emergency112_rank ?? "—"}</td>
                <td className="px-3 py-2 font-num">{fmt(r.training_score)}</td>
                <td className="px-3 py-2 font-num text-slate-500">{r.training_rank ?? "—"}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-20 bg-slate-100 rounded-sm overflow-hidden"><div className="h-full bg-blue-900" style={{ width: `${Math.max(0, r.combined_score || 0)}%` }} /></div>
                    <span className="font-num font-bold text-blue-900">{fmt(r.combined_score)}</span>
                  </div>
                </td>
                <td className="px-3 py-2"><CategoryBadge value={r.category} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > 10 && (
        <button onClick={() => setAll(!all)} className="mt-3 text-sm text-blue-900 hover:text-amber-700 font-medium" data-testid="combined-toggle-all">
          {all ? "Show top 10 only" : `Show all ${rows.length} units`}
        </button>
      )}
    </Panel>
  );
}
