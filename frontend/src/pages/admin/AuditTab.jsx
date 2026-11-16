import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Panel } from "@/components/Primitives";
import ExportMenu from "@/components/ExportMenu";
import { useApi } from "@/lib/api";
import { fmtDate } from "@/lib/format";

const ACTIONS = ["All", "login", "upload", "upload_failed", "dataset_activated", "dataset_archived", "export", "policy_proposed", "policy_approved", "policy_rejected", "policy_withdrawn", "report_generated", "report_settings_changed", "source_schedule_changed", "role_changed", "source_created", "source_test", "source_test_failed", "source_sync", "source_sync_failed", "source_deleted"];
const COLS = [{ key: "ts", label: "Time" }, { key: "action", label: "Action" }, { key: "email", label: "User" }, { key: "detail_text", label: "Detail" }];

export default function AuditTab() {
  const api = useApi();
  const [action, setAction] = useState("All");
  const [rows, setRows] = useState([]);
  const load = useCallback(() => api("get", "/audit", { params: { action, limit: 500 } }).then((r) => setRows(r.map((x) => ({ ...x, detail_text: Object.entries(x.detail || {}).map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`).join(" · ") })))), [api, action]);
  useEffect(() => { load(); }, [load]);
  return (
    <Panel title="Audit log" subtitle="Logins, uploads, exports, policy and role changes"
      right={
        <div className="flex gap-2">
          <Select value={action} onValueChange={setAction}>
            <SelectTrigger className="h-9 w-48 rounded-sm" data-testid="audit-action-filter"><SelectValue /></SelectTrigger>
            <SelectContent>{ACTIONS.map((a) => <SelectItem key={a} value={a}>{a === "All" ? "All actions" : a}</SelectItem>)}</SelectContent>
          </Select>
          <Button size="sm" variant="outline" className="rounded-sm h-9" onClick={load} data-testid="audit-refresh"><RefreshCw className="h-4 w-4" /></Button>
          <ExportMenu title="Audit Log" view="audit" columns={COLS} rows={rows} context={{ Action: action }} testId="audit-export" />
        </div>
      }>
      <div className="overflow-auto max-h-[600px] -mx-5 -mb-5">
        <table className="w-full text-sm" data-testid="audit-table">
          <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500 sticky top-0"><tr>{COLS.map((c) => <th key={c.key} className="text-left px-4 py-2.5">{c.label}</th>)}</tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-slate-100">
                <td className="px-4 py-2 text-xs whitespace-nowrap font-num">{fmtDate(r.ts)}</td>
                <td className="px-4 py-2"><span className="text-xs bg-slate-100 px-2 py-0.5 rounded-sm font-medium">{r.action}</span></td>
                <td className="px-4 py-2 text-xs">{r.email || "system"}</td>
                <td className="px-4 py-2 text-xs text-slate-600 max-w-xl truncate" title={r.detail_text}>{r.detail_text}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-500 text-sm">No events yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
