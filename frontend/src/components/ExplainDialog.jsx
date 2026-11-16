import { useEffect, useState } from "react";
import { Loader2, FileText } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CategoryBadge } from "@/components/Primitives";
import { useApi, errMsg } from "@/lib/api";
import { exportSteps } from "@/lib/exports";
import { fmt } from "@/lib/format";

const Step = ({ s }) => (
  <div className="grid grid-cols-[56px_minmax(0,1fr)] gap-4 py-4 border-b border-slate-100 last:border-0" data-testid={`explain-step-${s.step}`}>
    <div className="font-num text-xs font-bold text-amber-700 pt-0.5">STEP {String(s.step).padStart(2, "0")}</div>
    <div>
      <div className="font-display font-semibold text-slate-900">{s.title}</div>
      {s.lines && (
        <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-6 gap-y-1 text-sm max-w-lg">
          {s.lines.map(([k, v]) => [<dt key={k} className="text-slate-500">{k}</dt>, <dd key={k + "v"} className="font-num text-right text-slate-900">{typeof v === "number" ? v.toLocaleString("en-IN") : v}</dd>])}
        </dl>
      )}
      {s.table && (
        <table className="mt-2 text-xs border border-slate-200 max-w-sm w-full">
          <tbody>{s.table.map(([k, v]) => <tr key={k} className="border-b border-slate-100"><td className="px-2 py-1 text-slate-600">{k}</td><td className="px-2 py-1 font-num font-semibold text-right">{v}</td></tr>)}</tbody>
        </table>
      )}
      {s.formula && <div className="mt-2 font-num text-[12.5px] bg-slate-950 text-amber-200 px-3 py-2 rounded-sm overflow-x-auto whitespace-nowrap">{s.formula}</div>}
    </div>
  </div>
);

export default function ExplainDialog({ open, onOpenChange, params, labels }) {
  const api = useApi();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (!open || !params?.unit) return;
    setData(null); setError(null);
    api("get", "/explain", { params }).then(setData).catch((e) => setError(errMsg(e)));
  }, [open, params, api]);

  const pdf = async () => {
    const context = { Domain: labels.label, Type: params.type, Unit: params.unit, "Base period": params.base, "Latest period": params.latest };
    exportSteps({ title: `Score explanation - ${params.unit}`, steps: data.steps, context });
    await api("post", "/audit/export", { data: { format: "pdf", view: `${params.domain}-explanation`, context, rows: data.steps.length } });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[88vh] overflow-y-auto overflow-x-hidden rounded-sm" data-testid="explain-dialog">
        <DialogHeader>
          <div className="text-[10px] uppercase tracking-[0.2em] text-amber-700 font-semibold">{labels.label} · worked explanation</div>
          <DialogTitle className="font-display text-2xl" data-testid="explain-unit-name">{params?.unit}</DialogTitle>
          <DialogDescription>{params?.type} · {params?.base} → {params?.latest}</DialogDescription>
        </DialogHeader>
        {error && <div className="text-sm text-rose-700" data-testid="explain-error">{error}</div>}
        {!data && !error && <div className="flex items-center gap-2 text-slate-500 py-10"><Loader2 className="h-4 w-4 animate-spin" />Calculating…</div>}
        {data && (
          <>
            {data.message && <div className="text-sm text-slate-600">{data.message}</div>}
            {data.steps.length > 0 && (
              <div className="flex flex-wrap items-center gap-4 bg-slate-50 border p-4 rounded-sm">
                <div><div className="text-[10px] uppercase text-slate-500 font-semibold">Overall score</div><div className="font-num text-2xl font-bold text-blue-900" data-testid="explain-overall-score">{fmt(data.row.overall_score)}</div></div>
                <div><div className="text-[10px] uppercase text-slate-500 font-semibold">Rank</div><div className="font-num text-2xl font-bold" data-testid="explain-rank">#{data.row.rank}</div></div>
                <CategoryBadge value={data.row.category} testId="explain-category" />
                <Button size="sm" variant="outline" className="ml-auto rounded-sm" onClick={pdf} data-testid="explain-export-pdf"><FileText className="h-4 w-4 mr-1.5" />Download PDF</Button>
              </div>
            )}
            <div>{data.steps.map((s) => <Step key={s.step} s={s} />)}</div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
