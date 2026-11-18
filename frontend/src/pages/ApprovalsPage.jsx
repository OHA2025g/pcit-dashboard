import { useCallback, useEffect, useState } from "react";
import { Check, X, Stamp, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Panel } from "@/components/Primitives";
import { useApi, useMe, errMsg } from "@/lib/api";
import { fmtDate } from "@/lib/format";

const bandText = (dp) => [...dp.bands.map((b) => `${b.op} ${b.value} pp → ${b.marks}`), `otherwise → ${dp.default_marks}`];
const rankText = (p) => [...p.rank_bands.map((b) => `rank ≤ ${b.max_rank} → ${b.label}`), `otherwise → ${p.rank_default}`];

const Row = ({ label, before, after }) => {
  const changed = JSON.stringify(before) !== JSON.stringify(after);
  const list = (v) => (Array.isArray(v) ? v : [v]).map((x, i) => <div key={i}>{x}</div>);
  return (
    <tr className={`border-t border-slate-100 align-top ${changed ? "bg-teal-50/60" : ""}`}>
      <td className="px-4 py-2.5 font-medium text-sm whitespace-nowrap">{label}{changed && <span className="ml-2 text-[10px] font-bold text-teal-700">CHANGED</span>}</td>
      <td className="px-4 py-2.5 font-num text-xs text-slate-600">{list(before)}</td>
      <td className={`px-4 py-2.5 font-num text-xs ${changed ? "text-slate-900 font-semibold" : "text-slate-600"}`}>{list(after)}</td>
    </tr>
  );
};

const Diff = ({ current, proposed }) => (
  <table className="w-full" data-testid="proposal-diff">
    <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="text-left px-4 py-2">Rule</th><th className="text-left px-4 py-2">Live (v{current.version})</th><th className="text-left px-4 py-2">Proposed</th></tr></thead>
    <tbody>
      {["conviction", "timeliness", "emergency112"].filter((d) => current[d]?.bands && proposed[d]?.bands).map((d) => {
        const label = d === "conviction" ? "Conviction" : d === "timeliness" ? "Timeliness" : "112";
        return [
          <Row key={`${d}w`} label={`${label} weight`} before={`${Math.round(current[d].perf_weight * 100)}% / ${100 - Math.round(current[d].perf_weight * 100)}%`} after={`${Math.round(proposed[d].perf_weight * 100)}% / ${100 - Math.round(proposed[d].perf_weight * 100)}%`} />,
          <Row key={`${d}b`} label={`${label} improvement bands`} before={bandText(current[d])} after={bandText(proposed[d])} />,
        ];
      })}
      {current.training && proposed.training && (
        <Row
          key="training-bands"
          label="Training Ranking bands"
          before={[...(current.training.ranking_bands || []).map((b) => `≥${b.min_pct}% → ${b.marks}`), `otherwise → ${current.training.default_marks ?? 0}`]}
          after={[...(proposed.training.ranking_bands || []).map((b) => `≥${b.min_pct}% → ${b.marks}`), `otherwise → ${proposed.training.default_marks ?? 0}`]}
        />
      )}
      {current.antf && proposed.antf && (
        <Row
          key="antf-marks"
          label="ANTF mark weights"
          before={`${current.antf.meeting_mark ?? 3} / meeting · ${current.antf.upload_mark ?? 2} / MoM`}
          after={`${proposed.antf.meeting_mark ?? 3} / meeting · ${proposed.antf.upload_mark ?? 2} / MoM`}
        />
      )}
      <Row label="Rank categories" before={rankText(current)} after={rankText(proposed)} />
      <Row
        label="Combined index weight"
        before={current.combined_weights ? `${Math.round(current.combined_weights.conviction * 100)}/${Math.round(current.combined_weights.timeliness * 100)}/${Math.round((current.combined_weights.emergency112 || 0) * 100)}/${Math.round((current.combined_weights.training || 0) * 100)}/${Math.round((current.combined_weights.antf || 0) * 100)}` : `${Math.round((current.combined_weight ?? 0.5) * 100)}% conviction`}
        after={proposed.combined_weights ? `${Math.round(proposed.combined_weights.conviction * 100)}/${Math.round(proposed.combined_weights.timeliness * 100)}/${Math.round((proposed.combined_weights.emergency112 || 0) * 100)}/${Math.round((proposed.combined_weights.training || 0) * 100)}/${Math.round((proposed.combined_weights.antf || 0) * 100)}` : `${Math.round((proposed.combined_weight ?? 0.5) * 100)}% conviction`}
      />
    </tbody>
  </table>
);

const STATUS = { approved: "text-emerald-700 bg-emerald-50", rejected: "text-rose-700 bg-rose-50", pending: "text-teal-800 bg-teal-50", withdrawn: "text-slate-600 bg-slate-100", superseded: "text-slate-600 bg-slate-100" };

export default function ApprovalsPage() {
  const api = useApi();
  const { me } = useMe();
  const [data, setData] = useState(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => api("get", "/policy").then(setData).catch((e) => toast.error(errMsg(e))), [api]);
  useEffect(() => { load(); }, [load]);
  if (!["admin", "approver"].includes(me.role)) return <div className="text-sm text-rose-700 mt-10" data-testid="approvals-forbidden">Approvers only.</div>;
  if (!data) return <div className="flex items-center gap-2 text-slate-500 mt-20 justify-center"><Loader2 className="h-5 w-5 animate-spin" />Loading…</div>;
  const p = data.pending;
  const canDecide = me.role === "approver" && p && p.proposed_by_id !== me.user_id;

  const decide = async (action) => {
    setBusy(true);
    try {
      const r = await api("post", `/policy/proposals/${p.id}/${action}`, { data: { reason } });
      toast.success(action === "approve" ? `Approved · scoring policy v${r.version} is now live` : "Proposal rejected");
      setReason(""); load();
    } catch (e) { toast.error(errMsg(e)); }
    setBusy(false);
  };

  return (
    <div className="space-y-5" data-testid="approvals-page">
      <div>
        <div className="text-[11px] uppercase tracking-[0.2em] text-teal-700 font-semibold">Maker · checker</div>
        <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 mt-1">Scoring rule approvals</h1>
        <p className="text-sm text-slate-500 mt-2 max-w-2xl">Admins propose changes to weights, bands and rank categories. A separate Approver must sign off before any dashboard uses them.</p>
      </div>
      {!p ? (
        <Panel testId="no-pending-proposal"><div className="flex items-center gap-3 text-sm text-slate-600"><Stamp className="h-5 w-5 text-emerald-600" />Nothing waiting for approval. Live scoring policy is v{data.policy.version}.</div></Panel>
      ) : (
        <Panel testId="pending-proposal" title="Pending change" subtitle={`Proposed by ${p.proposed_by} · ${fmtDate(p.proposed_at)}${p.note ? ` · "${p.note}"` : ""}`}>
          <div className="-mx-5 border-y border-slate-100 overflow-x-auto"><Diff current={data.policy} proposed={p.policy} /></div>
          {canDecide ? (
            <div className="flex flex-wrap gap-2 mt-4">
              <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Comment (required to reject)" className="rounded-sm max-w-md" data-testid="approval-reason-input" />
              <Button disabled={busy} className="rounded-sm bg-emerald-700 hover:bg-emerald-800" onClick={() => decide("approve")} data-testid="approve-btn"><Check className="h-4 w-4 mr-1.5" />Approve & apply</Button>
              <Button disabled={busy || !reason.trim()} variant="outline" className="rounded-sm text-rose-700 border-rose-300" onClick={() => decide("reject")} data-testid="reject-btn"><X className="h-4 w-4 mr-1.5" />Reject</Button>
            </div>
          ) : (
            <p className="text-xs text-slate-500 mt-4" data-testid="approval-waiting-note">Waiting for a user with the Approver role to sign off{me.role === "admin" ? " — admins cannot approve their own rule changes" : ""}.</p>
          )}
        </Panel>
      )}
      <Panel title="Decision history" subtitle="Last 30 proposals">
        <div className="overflow-x-auto -mx-5 -mb-5">
          <table className="w-full text-sm" data-testid="proposals-table">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500"><tr>{["Proposed", "By", "Note", "Status", "Decided by", "Comment"].map((h) => <th key={h} className="text-left px-4 py-2.5">{h}</th>)}</tr></thead>
            <tbody>
              {data.proposals.map((x) => (
                <tr key={x.id} className="border-t border-slate-100">
                  <td className="px-4 py-2 text-xs font-num whitespace-nowrap">{fmtDate(x.proposed_at)}</td>
                  <td className="px-4 py-2 text-xs">{x.proposed_by}</td>
                  <td className="px-4 py-2 text-xs">{x.note || "—"}</td>
                  <td className="px-4 py-2"><span className={`text-xs px-2 py-0.5 rounded-sm font-semibold capitalize ${STATUS[x.status]}`}>{x.status}{x.version ? ` · v${x.version}` : ""}</span></td>
                  <td className="px-4 py-2 text-xs">{x.decided_by || "—"}</td>
                  <td className="px-4 py-2 text-xs">{x.reason || "—"}</td>
                </tr>
              ))}
              {data.proposals.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-500 text-sm">No proposals yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
