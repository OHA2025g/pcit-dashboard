import { useEffect, useState } from "react";
import { Loader2, FileText, Mail } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CategoryBadge } from "@/components/Primitives";
import ExplainVisuals from "@/components/ExplainVisuals";
import { useApi, errMsg } from "@/lib/api";
import { exportSteps } from "@/lib/exports";
import { fmt } from "@/lib/format";

const Step = ({ s }) => (
  <div className="grid grid-cols-[56px_minmax(0,1fr)] gap-4 py-4 border-b border-slate-100 last:border-0" data-testid={`explain-step-${s.step}`}>
    <div className="font-num text-xs font-bold text-teal-700 pt-0.5">STEP {String(s.step).padStart(2, "0")}</div>
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
      {s.formula && <div className="mt-2 font-num text-[12.5px] bg-brand-chrome text-teal-200 px-3 py-2 rounded-sm overflow-x-auto whitespace-nowrap">{s.formula}</div>}
    </div>
  </div>
);

export default function ExplainDialog({ open, onOpenChange, params, labels }) {
  const api = useApi();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareTo, setShareTo] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open || !params?.unit) return;
    setData(null); setError(null); setShareOpen(false); setShareTo("");
    api("get", "/explain", { params }).then(setData).catch((e) => setError(errMsg(e)));
  }, [open, params, api]);

  const pdf = async () => {
    const context = { Domain: labels.label, Type: params.type, Unit: params.unit, "Base period": params.base, "Latest period": params.latest };
    exportSteps({ title: `Score explanation - ${params.unit}`, steps: data.steps, context });
    await api("post", "/audit/export", { data: { format: "pdf", view: `${params.domain}-explanation`, context, rows: data.steps.length } });
  };

  const shareEmail = async () => {
    const to = shareTo.trim();
    if (!to) {
      toast.error("Enter a recipient email");
      return;
    }
    setSending(true);
    try {
      await api("post", "/explain/email", {
        data: {
          domain: params.domain,
          type: params.type,
          base: params.base,
          latest: params.latest,
          unit: params.unit,
          to,
        },
      });
      toast.success("Report emailed", { description: `Sent to ${to}` });
      setShareOpen(false);
      setShareTo("");
    } catch (e) {
      toast.error("Could not send email", { description: errMsg(e) });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[88vh] overflow-y-auto overflow-x-hidden rounded-sm" data-testid="explain-dialog">
        <DialogHeader>
          <div className="text-[10px] uppercase tracking-[0.2em] text-teal-700 font-semibold">{labels.label} · worked explanation</div>
          <DialogTitle className="font-display text-2xl" data-testid="explain-unit-name">{params?.unit}</DialogTitle>
          <DialogDescription>{params?.type} · {params?.base} → {params?.latest}</DialogDescription>
        </DialogHeader>
        {error && <div className="text-sm text-rose-700" data-testid="explain-error">{error}</div>}
        {!data && !error && <div className="flex items-center gap-2 text-slate-500 py-10"><Loader2 className="h-4 w-4 animate-spin" />Calculating…</div>}
        {data && (
          <>
            {data.message && <div className="text-sm text-slate-600">{data.message}</div>}
            {data.steps.length > 0 && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-4 bg-slate-50 border p-4 rounded-sm">
                  <div><div className="text-[10px] uppercase text-slate-500 font-semibold">Overall score</div><div className="font-num text-2xl font-bold text-brand-navy" data-testid="explain-overall-score">{fmt(data.row.overall_score)}</div></div>
                  <div><div className="text-[10px] uppercase text-slate-500 font-semibold">Rank</div><div className="font-num text-2xl font-bold" data-testid="explain-rank">#{data.row.rank}</div></div>
                  <CategoryBadge value={data.row.category} testId="explain-category" />
                  <div className="ml-auto flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-sm"
                      onClick={() => setShareOpen((v) => !v)}
                      data-testid="explain-share-email"
                    >
                      <Mail className="h-4 w-4 mr-1.5" />Share over email
                    </Button>
                    <Button size="sm" variant="outline" className="rounded-sm" onClick={pdf} data-testid="explain-export-pdf">
                      <FileText className="h-4 w-4 mr-1.5" />Download PDF
                    </Button>
                  </div>
                </div>
                {shareOpen && (
                  <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center bg-white border border-slate-200 rounded-sm p-3" data-testid="explain-share-panel">
                    <Input
                      type="email"
                      placeholder="Recipient email"
                      value={shareTo}
                      onChange={(e) => setShareTo(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && shareEmail()}
                      className="h-9 rounded-sm flex-1"
                      data-testid="explain-share-email-input"
                    />
                    <Button
                      size="sm"
                      className="h-9 rounded-sm bg-brand-navy hover:bg-brand-navy/90"
                      onClick={shareEmail}
                      disabled={sending}
                      data-testid="explain-share-email-send"
                    >
                      {sending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Mail className="h-4 w-4 mr-1.5" />}
                      Send report
                    </Button>
                  </div>
                )}
              </div>
            )}
            {data.steps.length > 0 && (
              <ExplainVisuals
                domain={params?.domain}
                row={data.row}
                cohort={data.cohort}
                labels={labels}
                base={params?.base}
                latest={params?.latest}
              />
            )}
            <div>{data.steps.map((s) => <Step key={s.step} s={s} />)}</div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
