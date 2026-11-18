import { useCallback, useEffect, useState } from "react";
import { Loader2, Send, FileText, CalendarClock, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Panel } from "@/components/Primitives";
import { useApi, useMe, errMsg } from "@/lib/api";
import { fmtDate } from "@/lib/format";

const Deliveries = ({ list }) => (
  <div className="space-y-0.5">
    {list.length === 0 && <span className="text-xs text-slate-400">No recipients</span>}
    {list.map((d) => (
      <div key={d.to} className="text-xs" title={d.error || ""}>
        <span className={`font-semibold ${d.status === "sent" ? "text-emerald-700" : "text-rose-700"}`}>{d.status}</span> · {d.to}
        {d.error && <div className="text-[11px] text-rose-600">{d.error}</div>}
      </div>
    ))}
  </div>
);

const Settings = ({ settings, onSaved }) => {
  const api = useApi();
  const [text, setText] = useState(settings.recipients.join("\n"));
  const [enabled, setEnabled] = useState(settings.enabled);
  const [sending, setSending] = useState(false);
  const save = async () => {
    try { await api("put", "/reports/settings", { data: { recipients: text.split(/[\n,]+/), enabled } }); toast.success("Recipients saved"); onSaved(); } catch (e) { toast.error(errMsg(e)); }
  };
  const sendNow = async () => {
    setSending(true);
    try {
      const r = await api("post", "/reports/send-now");
      const failed = r.deliveries.filter((d) => d.status !== "sent");
      failed.length ? toast.warning("Report created, but some emails were not delivered", { description: failed[0].error }) : toast.success("Report sent", { description: `${r.deliveries.length} recipient(s)` });
      onSaved();
    } catch (e) { toast.error(errMsg(e)); }
    setSending(false);
  };
  return (
    <Panel title="Leadership email" subtitle="Sent automatically on the 1st of every month at 9:00 IST" testId="report-settings">
      <div className="flex items-center gap-2 mb-3 text-sm"><Switch checked={enabled} onCheckedChange={setEnabled} data-testid="report-enabled-switch" /><CalendarClock className="h-4 w-4 text-slate-500" />Monthly email {enabled ? "on" : "off"}</div>
      <div className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1.5">Recipients (one per line)</div>
      <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} className="rounded-sm font-num text-sm" data-testid="report-recipients-input" />
      <div className="flex flex-wrap gap-2 mt-3">
        <Button className="rounded-sm bg-brand-navy hover:bg-brand-navy/90" onClick={save} data-testid="report-settings-save"><Save className="h-4 w-4 mr-1.5" />Save</Button>
        <Button variant="outline" className="rounded-sm" onClick={sendNow} disabled={sending} data-testid="report-send-now">{sending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Send className="h-4 w-4 mr-1.5" />}Send report now</Button>
      </div>
      <p className="text-[11px] text-slate-500 mt-3">The email has headline rates, top units and biggest improvers for both areas, plus a link to download the full PDF here after signing in.</p>
    </Panel>
  );
};

export default function ReportsPage() {
  const api = useApi();
  const { me } = useMe();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const load = useCallback(() => api("get", "/reports").then(setData).catch((e) => setError(errMsg(e))), [api]);
  useEffect(() => { load(); }, [load]);

  const download = async (r) => {
    try {
      const blob = await api("get", `/reports/${r.id}/pdf`, { responseType: "blob" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${r.title.replace(/\s+/g, "_")}.pdf`;
      a.click();
    } catch (e) { toast.error(errMsg(e)); }
  };

  if (error) return <div className="text-rose-700 text-sm mt-10" data-testid="reports-error">{error}</div>;
  if (!data) return <div className="flex items-center gap-2 text-slate-500 mt-20 justify-center"><Loader2 className="h-5 w-5 animate-spin" />Loading…</div>;
  return (
    <div className="space-y-5" data-testid="reports-page">
      <div>
        <div className="text-[11px] uppercase tracking-[0.2em] text-teal-700 font-semibold">Leadership reports</div>
        <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 mt-1">Monthly performance reports</h1>
      </div>
      <div className={`grid grid-cols-1 ${me.role === "admin" ? "lg:grid-cols-[380px_1fr]" : ""} gap-5`}>
        {me.role === "admin" && data.settings && <Settings settings={data.settings} onSaved={load} />}
        <Panel title="Report history" subtitle={`${data.reports.length} report(s)`}>
          <div className="overflow-x-auto -mx-5 -mb-5">
            <table className="w-full text-sm" data-testid="reports-table">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500"><tr>{["Report", "Created", "Trigger", "Email delivery", ""].map((h) => <th key={h} className="text-left px-4 py-2.5">{h}</th>)}</tr></thead>
              <tbody>
                {data.reports.map((r) => (
                  <tr key={r.id} className="border-t border-slate-100 align-top" data-testid={`report-row-${r.id}`}>
                    <td className="px-4 py-2.5 font-medium">{r.title}<div className="text-[11px] text-slate-500">scoring policy v{r.policy_version}</div></td>
                    <td className="px-4 py-2.5 text-xs">{fmtDate(r.created_at)}<div className="text-slate-500">{r.created_by}</div></td>
                    <td className="px-4 py-2.5 text-xs capitalize">{r.trigger === "schedule" ? "Monthly schedule" : "Sent manually"}</td>
                    <td className="px-4 py-2.5"><Deliveries list={r.deliveries} /></td>
                    <td className="px-4 py-2.5 text-right"><Button size="sm" variant="outline" className="rounded-sm" onClick={() => download(r)} data-testid={`report-download-${r.id}`}><FileText className="h-4 w-4 mr-1.5" />PDF</Button></td>
                  </tr>
                ))}
                {data.reports.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500 text-sm">No reports yet. The first one goes out on the 1st of next month.</td></tr>}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </div>
  );
}
