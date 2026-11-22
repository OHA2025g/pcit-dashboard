import { useState } from "react";
import { Info } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function ChartExplainButton({ explain, testId }) {
  const [open, setOpen] = useState(false);
  if (!explain) return null;

  return (
    <>
      <button
        type="button"
        data-testid={testId}
        aria-label={`How ${explain.title || "this chart"} is calculated`}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className="shrink-0 h-6 w-6 inline-flex items-center justify-center rounded-sm border border-slate-200 bg-white text-slate-500 hover:text-brand-navy hover:border-teal-600 hover:bg-teal-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/50 transition-colors"
      >
        <Info className="h-3.5 w-3.5" strokeWidth={2.25} />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto rounded-sm" data-testid={testId ? `${testId}-dialog` : "chart-explain-dialog"}>
          <DialogHeader>
            <div className="text-[10px] uppercase tracking-[0.18em] font-semibold text-teal-700">How this graph works</div>
            <DialogTitle className="font-display text-xl leading-snug pr-6">{explain.title}</DialogTitle>
            <DialogDescription className="text-sm text-slate-600 leading-relaxed">
              {explain.description}
            </DialogDescription>
          </DialogHeader>

          {explain.expression && (
            <div className="space-y-1.5">
              <div className="text-[10px] uppercase tracking-[0.14em] font-semibold text-slate-500">Calculation</div>
              <pre className="rounded-sm bg-brand-chrome text-teal-100 px-3 py-2.5 font-mono text-[12px] leading-relaxed whitespace-pre-wrap overflow-x-auto">
                {explain.expression}
              </pre>
            </div>
          )}

          {Array.isArray(explain.steps) && explain.steps.length > 0 && (
            <div className="space-y-2">
              <div className="text-[10px] uppercase tracking-[0.14em] font-semibold text-slate-500">Notes</div>
              <ol className="list-decimal pl-4 space-y-1.5 text-sm text-slate-700 leading-relaxed">
                {explain.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </div>
          )}

          {explain.example && (
            <div className="rounded-sm border border-slate-100 bg-slate-50 px-3 py-2.5 text-[12px] text-slate-600 leading-relaxed">
              <span className="font-semibold text-slate-800">Example · </span>
              {explain.example}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
