import { useMemo, useState } from "react";
import { ArrowUpDown, Search, Calculator } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Panel, CategoryBadge, Delta } from "@/components/Primitives";
import ExportMenu from "@/components/ExportMenu";
import { fmt, fmtInt, fmtDuration, slug } from "@/lib/format";

export const tableColumns = (domain, labels) => {
  if (domain === "emergency112") {
    return [
      { key: "rank", label: "Rank" },
      { key: "unit", label: "District" },
      { key: "base_total_sec", label: "Base response time" },
      { key: "latest_total_sec", label: "Latest response time" },
      { key: "base_rate", label: "Base % ≤100m" },
      { key: "latest_rate", label: "Latest % ≤100m" },
      { key: "time_improvement_pct", label: "Time improvement %" },
      { key: "pct_improvement", label: "100m improvement (pp)" },
      { key: "performance_score", label: "Period performance" },
      { key: "improvement_score", label: "Final improvement" },
      { key: "overall_score", label: "Final score" },
      { key: "category", label: "Category" },
      { key: "rank_movement", label: "Rank move" },
    ];
  }
  if (domain === "training") {
    return [
      { key: "rank", label: "Rank" },
      { key: "unit", label: "Unit" },
      { key: "base_den", label: "Base headcount" },
      { key: "base_num", label: "Base trained" },
      { key: "base_rate", label: "Base % trained" },
      { key: "latest_den", label: "Latest headcount" },
      { key: "latest_num", label: "Latest trained" },
      { key: "latest_rate", label: "Latest % trained" },
      { key: "marks", label: "Marks" },
      { key: "overall_score", label: "Score (×10)" },
      { key: "category", label: "Category" },
      { key: "rank_movement", label: "Rank move" },
    ];
  }
  if (domain === "antf") {
    return [
      { key: "rank", label: "Rank of unit" },
      { key: "unit", label: "Unit" },
      { key: "meetings", label: "Meetings from Jan 2026" },
      { key: "mom_uploaded", label: "MoM uploaded (NCORD)" },
      { key: "meeting_marks", label: "Meeting marks (×3)" },
      { key: "upload_marks", label: "Minutes marks (×2)" },
      { key: "marks", label: "Total marks scored" },
      { key: "category", label: "Performance" },
    ];
  }
  return [
    { key: "rank", label: "Rank" },
    { key: "unit", label: "Unit" },
    { key: "range", label: "Range" },
    { key: "base_den", label: `Base ${labels.den.toLowerCase()}` },
    { key: "base_num", label: `Base ${labels.num.toLowerCase()}` },
    { key: "base_rate", label: "Base rate %" },
    { key: "latest_den", label: `Latest ${labels.den.toLowerCase()}` },
    { key: "latest_num", label: `Latest ${labels.num.toLowerCase()}` },
    { key: "latest_rate", label: "Latest rate %" },
    { key: "improvement", label: "Improvement (pp)" },
    ...(domain === "timeliness"
      ? [{ key: "latest_beyond", label: "Latest beyond-time" }, { key: "base_beyond_rate", label: "Base beyond %" }, { key: "latest_beyond_rate", label: "Latest beyond %" },
         { key: "latest_pending", label: "Latest pending" }, { key: "latest_pending_rate", label: "Pending %" }]
      : [{ key: "latest_acquittal_rate", label: "Acquittal %" }, { key: "session_jmfc_gap", label: "Session − JMFC gap (pp)" }]),
    { key: "rank_movement", label: "Rank move" },
    { key: "volatility", label: "Volatility (pp)" },
    { key: "workload_share", label: "Workload share %" },
    { key: "performance_score", label: "Performance score" },
    { key: "improvement_marks", label: "Imp. marks" },
    { key: "improvement_score", label: "Imp. score" },
    { key: "overall_score", label: "Overall score" },
    { key: "category", label: "Rank category" },
  ];
};

const NUM_INT = ["base_den", "base_num", "latest_den", "latest_num", "latest_beyond", "latest_pending", "improvement_marks", "improvement_score", "meetings", "mom_uploaded", "meeting_marks", "upload_marks", "marks"];

export default function RankingTable({ domain, labels, rows, onExplain, exportContext, exportNotes }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState({ key: "rank", dir: 1 });
  const cols = tableColumns(domain, labels);
  const view = useMemo(() => {
    const list = rows.filter((r) => r.unit.toLowerCase().includes(q.toLowerCase()) || (r.range || "").toLowerCase().includes(q.toLowerCase()));
    return [...list].sort((a, b) => {
      const x = a[sort.key], y = b[sort.key];
      if (x === null || x === undefined) return 1;
      if (y === null || y === undefined) return -1;
      return (typeof x === "string" ? x.localeCompare(y) : x - y) * sort.dir;
    });
  }, [rows, q, sort]);
  const toggle = (key) => setSort((s) => ({ key, dir: s.key === key ? -s.dir : 1 }));

  const render = (r, c) => {
    const v = r[c.key];
    if (c.key === "category") return <CategoryBadge value={v} />;
    if (c.key === "improvement") return <Delta value={v} suffix="" />;
    if (c.key === "rank_movement") return v === null || v === undefined ? <span className="text-slate-400">—</span> : <span className={`font-num font-semibold ${v > 0 ? "text-emerald-700" : v < 0 ? "text-rose-700" : "text-slate-500"}`}>{v > 0 ? `▲ ${v}` : v < 0 ? `▼ ${-v}` : "="}</span>;
    if (c.key === "session_jmfc_gap") return <Delta value={v} suffix="" />;
    if (c.key === "unit") return <span className="font-medium text-slate-900">{v}</span>;
    if (c.key === "range") return <span className="text-slate-500">{v}</span>;
    if (c.key === "rank") return <span className={`font-num font-bold ${v === 1 ? "text-teal-600" : "text-slate-900"}`}>{v ?? "—"}</span>;
    if (c.key === "overall_score") return <span className="font-num font-bold text-brand-navy">{fmt(v)}</span>;
    if (c.key === "marks") return <span className="font-num font-bold text-teal-800">{v ?? "—"}</span>;
    if (c.key === "base_total_sec" || c.key === "latest_total_sec") return <span className="font-num">{fmtDuration(v)}</span>;
    if (c.key === "time_improvement_pct" || c.key === "pct_improvement") return <Delta value={v} suffix="" />;
    return <span className="font-num">{NUM_INT.includes(c.key) ? fmtInt(v) : fmt(v)}</span>;
  };

  return (
    <Panel testId={`ranking-table-${domain}`} title="Unit-wise ranking and score calculation" subtitle={`${view.length} of ${rows.length} units · Rank 1 = highest overall score · click a column to sort`}
      right={
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-slate-400" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search unit or range" className="h-9 pl-8 w-52 rounded-sm" data-testid="ranking-search-input" />
          </div>
          <ExportMenu title={`${labels.label} Rankings`} view={`${domain}-rankings`} columns={cols} rows={view.filter((r) => r.included)} context={exportContext} notes={exportNotes} testId="ranking-export" />
        </div>
      }>
      <div className="overflow-auto max-h-[640px] -mx-5 -mb-5 border-t border-slate-100">
        <table className="w-full text-[12.5px]" data-testid="ranking-table">
          <thead className="sticky top-0 bg-slate-50/95 backdrop-blur-sm z-10 shadow-[0_1px_0_0_rgb(241,245,249)]">
            <tr>
              {cols.map((c) => (
                <th key={c.key} onClick={() => toggle(c.key)} data-testid={`sort-${c.key}`}
                  className="text-left text-[10px] uppercase tracking-wider font-bold text-slate-500 px-3 py-2.5 whitespace-nowrap cursor-pointer select-none hover:text-slate-900 border-b border-slate-200">
                  <span className="inline-flex items-center gap-1">{c.label}{sort.key === c.key && <ArrowUpDown className="h-3 w-3" />}</span>
                </th>
              ))}
              <th className="px-3 py-2.5 border-b border-slate-200 text-[10px] uppercase tracking-wider font-bold text-slate-500">Explain</th>
            </tr>
          </thead>
          <tbody>
            {view.map((r) => (
              <tr key={r.unit} className={`border-b border-slate-100 hover:bg-teal-50/60 transition-colors ${r.rank === 1 && r.included ? "bg-teal-50/30" : ""} ${r.included ? "" : "opacity-40"}`} data-testid={`ranking-row-${slug(r.unit)}`}>
                {cols.map((c) => <td key={c.key} className="px-3 py-2 whitespace-nowrap">{render(r, c)}</td>)}
                <td className="px-3 py-2">
                  <button disabled={!r.eligible} onClick={() => onExplain(r.unit)} data-testid={`explain-btn-${slug(r.unit)}`}
                    className="inline-flex items-center gap-1 text-xs text-brand-navy hover:text-teal-700 disabled:opacity-30 transition-colors font-medium">
                    <Calculator className="h-3.5 w-3.5" />Steps
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
