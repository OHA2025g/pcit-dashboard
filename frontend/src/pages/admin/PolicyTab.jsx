import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, Save, RotateCcw, Clock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Panel } from "@/components/Primitives";
import { useApi, errMsg } from "@/lib/api";
import { fmtDate } from "@/lib/format";

const num = (v) => (v === "" ? "" : Number(v));

const DomainEditor = ({ name, dp, onChange }) => {
  const setBand = (i, k, v) => onChange({ ...dp, bands: dp.bands.map((b, j) => (j === i ? { ...b, [k]: v } : b)) });
  return (
    <Panel title={`${name} scoring`} subtitle="Weights and improvement-mark bands" testId={`policy-${name.toLowerCase()}`}>
      <div className="text-xs font-semibold text-slate-600 mb-2">Weight: <span className="font-num text-brand-navy">{Math.round(dp.perf_weight * 100)}% performance</span> / <span className="font-num text-teal-700">{100 - Math.round(dp.perf_weight * 100)}% improvement</span></div>
      <Slider value={[Math.round(dp.perf_weight * 100)]} min={0} max={100} step={5} onValueChange={([v]) => onChange({ ...dp, perf_weight: v / 100 })} data-testid={`policy-${name.toLowerCase()}-weight`} />
      <div className="mt-6 text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-2">Improvement bands (evaluated top to bottom, in pp)</div>
      <div className="space-y-2">
        {dp.bands.map((b, i) => (
          <div key={i} className="grid grid-cols-[auto_80px_90px_auto_80px_auto] items-center gap-2 text-sm">
            <span className="text-slate-500 text-xs">If improvement</span>
            <select value={b.op} onChange={(e) => setBand(i, "op", e.target.value)} className="h-8 border rounded-sm px-2 text-sm bg-white" data-testid={`band-op-${name}-${i}`}><option>{"<"}</option><option>{"<="}</option></select>
            <Input type="number" value={b.value} onChange={(e) => setBand(i, "value", num(e.target.value))} className="h-8 rounded-sm font-num" data-testid={`band-value-${name}-${i}`} />
            <span className="text-slate-500 text-xs">→ marks</span>
            <Input type="number" value={b.marks} onChange={(e) => setBand(i, "marks", num(e.target.value))} className="h-8 rounded-sm font-num" data-testid={`band-marks-${name}-${i}`} />
            <button onClick={() => onChange({ ...dp, bands: dp.bands.filter((_, j) => j !== i) })} className="text-slate-400 hover:text-rose-600" data-testid={`band-remove-${name}-${i}`}><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
        <div className="grid grid-cols-[auto_80px] items-center gap-2 text-sm">
          <span className="text-slate-500 text-xs">Otherwise → marks</span>
          <Input type="number" value={dp.default_marks} onChange={(e) => onChange({ ...dp, default_marks: num(e.target.value) })} className="h-8 rounded-sm font-num" data-testid={`band-default-${name}`} />
        </div>
        <Button size="sm" variant="ghost" className="rounded-sm" onClick={() => onChange({ ...dp, bands: [...dp.bands, { op: "<", value: 0, marks: 0 }] })} data-testid={`band-add-${name}`}><Plus className="h-4 w-4 mr-1" />Add band</Button>
      </div>
    </Panel>
  );
};

const TrainingRankingEditor = ({ dp, onChange }) => {
  const setBand = (i, k, v) => onChange({ ...dp, ranking_bands: dp.ranking_bands.map((b, j) => (j === i ? { ...b, [k]: v } : b)) });
  const setClub = (i, k, v) => onChange({ ...dp, rank_bands: dp.rank_bands.map((b, j) => (j === i ? { ...b, [k]: v } : b)) });
  return (
    <Panel title="Training Ranking" subtitle="Excel Ranking marks from % people trained + rank clubbing" testId="policy-training">
      <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-2">Ranking bands (% trained → marks)</div>
      <div className="space-y-2 mb-5">
        {(dp.ranking_bands || []).map((b, i) => (
          <div key={i} className="grid grid-cols-[auto_80px_auto_80px_auto] items-center gap-2 text-sm">
            <span className="text-slate-500 text-xs">If % ≥</span>
            <Input type="number" value={b.min_pct} onChange={(e) => setBand(i, "min_pct", num(e.target.value))} className="h-8 rounded-sm font-num" data-testid={`training-band-pct-${i}`} />
            <span className="text-slate-500 text-xs">→ marks</span>
            <Input type="number" value={b.marks} onChange={(e) => setBand(i, "marks", num(e.target.value))} className="h-8 rounded-sm font-num" data-testid={`training-band-marks-${i}`} />
            <button onClick={() => onChange({ ...dp, ranking_bands: dp.ranking_bands.filter((_, j) => j !== i) })} className="text-slate-400 hover:text-rose-600" data-testid={`training-band-remove-${i}`}><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
        <div className="grid grid-cols-[auto_80px] items-center gap-2 text-sm">
          <span className="text-slate-500 text-xs">Otherwise → marks</span>
          <Input type="number" value={dp.default_marks ?? 0} onChange={(e) => onChange({ ...dp, default_marks: num(e.target.value) })} className="h-8 rounded-sm font-num" data-testid="training-band-default" />
        </div>
        <Button size="sm" variant="ghost" className="rounded-sm" onClick={() => onChange({ ...dp, ranking_bands: [...(dp.ranking_bands || []), { min_pct: 0, marks: 0 }] })} data-testid="training-band-add"><Plus className="h-4 w-4 mr-1" />Add band</Button>
      </div>
      <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-2">Rank clubbing</div>
      <div className="space-y-2">
        {(dp.rank_bands || []).map((b, i) => (
          <div key={i} className="grid grid-cols-[auto_80px_1fr] gap-2 items-center">
            <span className="text-xs text-slate-500">Rank ≤</span>
            <Input type="number" value={b.max_rank} onChange={(e) => setClub(i, "max_rank", num(e.target.value))} className="h-8 rounded-sm font-num" data-testid={`training-rank-max-${i}`} />
            <Input value={b.label} onChange={(e) => setClub(i, "label", e.target.value)} className="h-8 rounded-sm" data-testid={`training-rank-label-${i}`} />
          </div>
        ))}
        <div className="grid grid-cols-[auto_1fr] gap-2 items-center">
          <span className="text-xs text-slate-500">Otherwise</span>
          <Input value={dp.rank_default || "Low Performer"} onChange={(e) => onChange({ ...dp, rank_default: e.target.value })} className="h-8 rounded-sm" data-testid="training-rank-default" />
        </div>
      </div>
    </Panel>
  );
};

const AntfPolicyEditor = ({ dp, onChange }) => {
  const setClub = (i, k, v) => onChange({ ...dp, rank_bands: dp.rank_bands.map((b, j) => (j === i ? { ...b, [k]: v } : b)) });
  return (
    <Panel title="ANTF Meetings" subtitle="Marks = meetings × meeting mark + MoM uploads × upload mark" testId="policy-antf">
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div>
          <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1">Per meeting</div>
          <Input type="number" value={dp.meeting_mark ?? 3} onChange={(e) => onChange({ ...dp, meeting_mark: num(e.target.value) })} className="h-8 rounded-sm font-num" data-testid="antf-meeting-mark" />
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1">Per MoM upload</div>
          <Input type="number" value={dp.upload_mark ?? 2} onChange={(e) => onChange({ ...dp, upload_mark: num(e.target.value) })} className="h-8 rounded-sm font-num" data-testid="antf-upload-mark" />
        </div>
      </div>
      <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-2">Rank clubbing</div>
      <div className="space-y-2">
        {(dp.rank_bands || []).map((b, i) => (
          <div key={i} className="grid grid-cols-[auto_80px_1fr] gap-2 items-center">
            <span className="text-xs text-slate-500">Rank ≤</span>
            <Input type="number" value={b.max_rank} onChange={(e) => setClub(i, "max_rank", num(e.target.value))} className="h-8 rounded-sm font-num" data-testid={`antf-rank-max-${i}`} />
            <Input value={b.label} onChange={(e) => setClub(i, "label", e.target.value)} className="h-8 rounded-sm" data-testid={`antf-rank-label-${i}`} />
          </div>
        ))}
        <div className="grid grid-cols-[auto_1fr] gap-2 items-center">
          <span className="text-xs text-slate-500">Otherwise</span>
          <Input value={dp.rank_default || "Low Performer"} onChange={(e) => onChange({ ...dp, rank_default: e.target.value })} className="h-8 rounded-sm" data-testid="antf-rank-default" />
        </div>
      </div>
    </Panel>
  );
};

export default function PolicyTab() {
  const api = useApi();
  const [p, setP] = useState(null);
  const [history, setHistory] = useState([]);
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(null);
  const load = useCallback(() => api("get", "/policy").then((r) => { setP(r.policy); setHistory(r.history); setPending(r.pending); }), [api]);
  useEffect(() => { load(); }, [load]);
  if (!p) return null;

  const save = async () => {
    try { await api("put", "/policy", { data: { ...p, note } }); toast.success("Sent for approval", { description: "The new rules take effect once an Approver signs off" }); setNote(""); load(); } catch (e) { toast.error("Not submitted", { description: errMsg(e) }); }
  };
  const reset = async () => { await api("post", "/policy/reset"); toast.success("Reset sent for approval"); load(); };
  const withdraw = async () => { await api("post", `/policy/proposals/${pending.id}/withdraw`); toast.success("Proposal withdrawn"); load(); };
  const setRank = (i, k, v) => setP({ ...p, rank_bands: p.rank_bands.map((b, j) => (j === i ? { ...b, [k]: v } : b)) });

  return (
    <div className="space-y-5">
      {pending && (
        <div className="flex flex-wrap items-center gap-3 bg-teal-50 border border-teal-300 text-teal-900 px-4 py-3 rounded-sm text-sm" data-testid="policy-pending-banner">
          <Clock className="h-4 w-4" />
          <span><b>Change awaiting approval</b> · proposed by {pending.proposed_by} on {fmtDate(pending.proposed_at)}{pending.note ? ` · "${pending.note}"` : ""}. Dashboards still use v{p.version}.</span>
          <Button size="sm" variant="outline" className="ml-auto rounded-sm" onClick={withdraw} data-testid="policy-withdraw-btn">Withdraw</Button>
        </div>
      )}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <DomainEditor name="Conviction" dp={p.conviction} onChange={(d) => setP({ ...p, conviction: d })} />
        <DomainEditor name="Timeliness" dp={p.timeliness} onChange={(d) => setP({ ...p, timeliness: d })} />
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {p.emergency112 && <DomainEditor name="112" dp={p.emergency112} onChange={(d) => setP({ ...p, emergency112: { ...p.emergency112, ...d } })} />}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {p.training && <TrainingRankingEditor dp={p.training} onChange={(d) => setP({ ...p, training: d })} />}
        {p.antf && <AntfPolicyEditor dp={p.antf} onChange={(d) => setP({ ...p, antf: d })} />}
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <Panel title="Rank categories & combined index" subtitle="Map overall rank to a category; weight of each area in the combined index">
          {(() => {
            const equal = 0.2;
            const cw = p.combined_weights || { conviction: equal, timeliness: equal, emergency112: equal, training: equal, antf: equal };
            const setCw = (key, pct) => {
              const next = { ...cw, [key]: pct / 100 };
              const rest = Object.keys(next).filter((k) => k !== key);
              const left = Math.max(0, 1 - next[key]);
              const otherSum = rest.reduce((s, k) => s + (cw[k] || 0), 0) || 1;
              rest.forEach((k) => { next[k] = left * ((cw[k] || 0) / otherSum); });
              setP({ ...p, combined_weights: next, combined_weight: next.conviction });
            };
            return (
              <div className="space-y-3 mb-5">
                <div className="text-xs font-semibold text-slate-600">Combined index: <span className="font-num text-brand-navy">{Math.round((cw.conviction || 0) * 100)}% conviction</span> · <span className="font-num text-teal-700">{Math.round((cw.timeliness || 0) * 100)}% timeliness</span> · <span className="font-num text-cyan-700">{Math.round((cw.emergency112 || 0) * 100)}% 112</span> · <span className="font-num text-slate-700">{Math.round((cw.training || 0) * 100)}% training</span> · <span className="font-num text-rose-700">{Math.round((cw.antf || 0) * 100)}% ANTF</span></div>
                <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Conviction share</div>
                <Slider value={[Math.round((cw.conviction || 0) * 100)]} min={0} max={100} step={5} onValueChange={([v]) => setCw("conviction", v)} data-testid="policy-combined-weight" />
                <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Timeliness share</div>
                <Slider value={[Math.round((cw.timeliness || 0) * 100)]} min={0} max={100} step={5} onValueChange={([v]) => setCw("timeliness", v)} data-testid="policy-combined-timeliness" />
                <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500">112 share</div>
                <Slider value={[Math.round((cw.emergency112 || 0) * 100)]} min={0} max={100} step={5} onValueChange={([v]) => setCw("emergency112", v)} data-testid="policy-combined-112" />
                <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Training share</div>
                <Slider value={[Math.round((cw.training || 0) * 100)]} min={0} max={100} step={5} onValueChange={([v]) => setCw("training", v)} data-testid="policy-combined-training" />
                <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500">ANTF share</div>
                <Slider value={[Math.round((cw.antf || 0) * 100)]} min={0} max={100} step={5} onValueChange={([v]) => setCw("antf", v)} data-testid="policy-combined-antf" />
              </div>
            );
          })()}
          <div className="space-y-2">
            {p.rank_bands.map((b, i) => (
              <div key={i} className="grid grid-cols-[auto_80px_1fr] gap-2 items-center">
                <span className="text-xs text-slate-500">Rank ≤</span>
                <Input type="number" value={b.max_rank} onChange={(e) => setRank(i, "max_rank", num(e.target.value))} className="h-8 rounded-sm font-num" data-testid={`rank-max-${i}`} />
                <Input value={b.label} onChange={(e) => setRank(i, "label", e.target.value)} className="h-8 rounded-sm" data-testid={`rank-label-${i}`} />
              </div>
            ))}
            <div className="grid grid-cols-[auto_1fr] gap-2 items-center">
              <span className="text-xs text-slate-500">Otherwise</span>
              <Input value={p.rank_default} onChange={(e) => setP({ ...p, rank_default: e.target.value })} className="h-8 rounded-sm" data-testid="rank-default" />
            </div>
          </div>
        </Panel>
        <Panel title="Submit for approval" subtitle={`Live version v${p.version} · an Approver must sign off before changes apply`}>
          <Input placeholder="Reason for change (recorded in audit log)" value={note} onChange={(e) => setNote(e.target.value)} className="rounded-sm" data-testid="policy-note-input" />
          <div className="flex gap-2 mt-3">
            <Button className="rounded-sm bg-brand-navy hover:bg-brand-navy/90" onClick={save} data-testid="policy-save-btn"><Save className="h-4 w-4 mr-1.5" />{pending ? "Replace pending proposal" : "Submit for approval"}</Button>
            <Button variant="outline" className="rounded-sm" onClick={reset} data-testid="policy-reset-btn"><RotateCcw className="h-4 w-4 mr-1.5" />Propose reset to defaults</Button>
          </div>
          <div className="mt-5 text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-2">Version history</div>
          <div className="max-h-48 overflow-auto text-xs space-y-1.5" data-testid="policy-history">
            {history.length === 0 && <div className="text-slate-500">Using workbook defaults (v1).</div>}
            {history.map((h) => <div key={h.version} className="flex justify-between border-b border-slate-100 pb-1"><span><b className="font-num">v{h.version}</b> · {h.note || "—"}</span><span className="text-slate-500">{h.updated_by}{h.approved_by ? ` · approved by ${h.approved_by}` : ""} · {fmtDate(h.updated_at)}</span></div>)}
          </div>
        </Panel>
      </div>
    </div>
  );
}
