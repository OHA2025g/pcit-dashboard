import { useCallback, useEffect, useState } from "react";
import { Plug, Trash2, Play, RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Panel } from "@/components/Primitives";
import { useApi, errMsg } from "@/lib/api";
import { fmtDate } from "@/lib/format";

const EMPTY = { name: "", url: "", domain: "conviction", auth_header: "", auth_value: "", schedule: "daily" };
const SAMPLE = `{
  "periods": ["Jul-Dec 2025", "Jan-Jun 2026"],
  "records": [
    { "unit": "Akola", "range": "Amravati Range", "type": "JMFC",
      "period": "Jan-Jun 2026", "denominator": 2860, "numerator": 1977, "beyond": 0 }
  ]
}`;

export default function SourcesTab() {
  const api = useApi();
  const [list, setList] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(null);
  const load = useCallback(() => api("get", "/sources").then(setList), [api]);
  useEffect(() => { load(); }, [load]);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const create = async () => {
    try { await api("post", "/sources", { data: form }); toast.success("Source saved"); setForm(EMPTY); load(); } catch (e) { toast.error("Not saved", { description: errMsg(e) }); }
  };
  const run = async (s, action) => {
    setBusy(`${s.id}-${action}`);
    try { const r = await api("post", `/sources/${s.id}/${action}`); toast.success(`${action === "sync" ? "Synced" : "Connection OK"}`, { description: `${r.records} records · ${r.units} units` }); } catch (e) { toast.error(`${action} failed`, { description: errMsg(e) }); }
    setBusy(null); load();
  };
  const remove = async (s) => { await api("delete", `/sources/${s.id}`); load(); };
  const setSchedule = async (s, schedule) => { await api("patch", `/sources/${s.id}`, { data: { schedule } }); toast.success(schedule === "daily" ? "Daily auto-sync on" : "Switched to manual sync"); load(); };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-5">
      <Panel title="Connect an authorised source API" subtitle="Read-only JSON endpoint; Sync creates a new dataset version">
        <div className="space-y-3">
          <Input placeholder="Source name (e.g. CCTNS aggregate feed)" value={form.name} onChange={set("name")} className="rounded-sm" data-testid="source-name-input" />
          <Input placeholder="https://source.example.gov/api/conviction" value={form.url} onChange={set("url")} className="rounded-sm" data-testid="source-url-input" />
          <select value={form.domain} onChange={set("domain")} className="w-full h-9 border rounded-sm px-2 text-sm bg-white" data-testid="source-domain-select">
            <option value="conviction">Conviction</option><option value="timeliness">Charge Sheet Timeliness</option><option value="emergency112">112 Performance</option><option value="training">Training Performance</option>
          </select>
          <select value={form.schedule} onChange={set("schedule")} className="w-full h-9 border rounded-sm px-2 text-sm bg-white" data-testid="source-schedule-select">
            <option value="daily">Sync automatically every day (6:00 IST)</option><option value="manual">Manual sync only</option>
          </select>
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Auth header (optional)" value={form.auth_header} onChange={set("auth_header")} className="rounded-sm" data-testid="source-auth-header-input" />
            <Input type="password" placeholder="Header value" value={form.auth_value} onChange={set("auth_value")} className="rounded-sm" data-testid="source-auth-value-input" />
          </div>
          <Button className="rounded-sm bg-blue-900 hover:bg-blue-800 w-full" onClick={create} disabled={!form.name || !form.url} data-testid="source-save-btn"><Plug className="h-4 w-4 mr-1.5" />Save source</Button>
        </div>
        <div className="mt-5 text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-1.5">Expected response format</div>
        <pre className="text-[11px] bg-slate-950 text-amber-200 p-3 rounded-sm overflow-x-auto font-num">{SAMPLE}</pre>
        <p className="text-[11px] text-slate-500 mt-2">denominator = trial / registered cases · numerator = convicted / within-time · beyond = beyond-time (timeliness only).</p>
      </Panel>
      <Panel title="Configured sources" subtitle={`${list.length} source(s)`}>
        {list.length === 0 && <div className="text-sm text-slate-500 py-8 text-center" data-testid="sources-empty">No API sources yet. Data currently comes from uploaded workbooks.</div>}
        <div className="space-y-3">
          {list.map((s) => (
            <div key={s.id} className="border border-slate-200 rounded-sm p-4 flex flex-wrap items-center gap-4" data-testid={`source-row-${s.id}`}>
              <div className="flex-1 min-w-[220px]">
                <div className="font-semibold">{s.name} <span className="text-xs font-normal text-slate-500 capitalize">· {s.domain}</span></div>
                <div className="text-xs text-slate-500 font-num truncate">{s.url}</div>
                <div className="text-xs mt-1">{s.last_status} {s.last_run && <span className="text-slate-400">· {fmtDate(s.last_run)}</span>}</div>
              </div>
              <select value={s.schedule || "manual"} onChange={(e) => setSchedule(s, e.target.value)} className="h-8 border rounded-sm px-2 text-xs bg-white" data-testid={`source-row-schedule-${s.id}`}>
                <option value="daily">Daily auto-sync</option><option value="manual">Manual only</option>
              </select>
              <Button size="sm" variant="outline" className="rounded-sm" onClick={() => run(s, "test")} disabled={!!busy} data-testid={`source-test-${s.id}`}>{busy === `${s.id}-test` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}<span className="ml-1">Test</span></Button>
              <Button size="sm" className="rounded-sm bg-slate-900" onClick={() => run(s, "sync")} disabled={!!busy} data-testid={`source-sync-${s.id}`}>{busy === `${s.id}-sync` ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}<span className="ml-1">Sync now</span></Button>
              <button onClick={() => remove(s)} className="text-slate-400 hover:text-rose-600" data-testid={`source-delete-${s.id}`}><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
