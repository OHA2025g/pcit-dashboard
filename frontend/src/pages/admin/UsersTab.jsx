import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Panel } from "@/components/Primitives";
import { useApi, useMe, errMsg } from "@/lib/api";
import { ROLE_LABELS, fmtDate } from "@/lib/format";

export default function UsersTab() {
  const api = useApi();
  const { me } = useMe();
  const [data, setData] = useState(null);
  const load = useCallback(() => api("get", "/users").then(setData).catch((e) => toast.error(errMsg(e))), [api]);
  useEffect(() => { load(); }, [load]);
  if (!data) return null;

  const update = async (u, role, range) => {
    if (role === "range_viewer" && !range) range = data.ranges[0];
    try { await api("patch", `/users/${u.user_id}/role`, { data: { role, range } }); toast.success(`${u.email} → ${ROLE_LABELS[role]}${role === "range_viewer" ? ` (${range})` : ""}`); load(); } catch (e) { toast.error(errMsg(e)); }
  };

  return (
    <Panel title="Users & roles" subtitle="New registrations stay Pending and cannot sign in until you assign a role. Range viewers see only their range's units.">
      <div className="overflow-x-auto -mx-5 -mb-5">
        <table className="w-full text-sm" data-testid="users-table">
          <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500"><tr>{["User", "Role", "Range scope", "Joined"].map((h) => <th key={h} className="text-left px-4 py-2.5">{h}</th>)}</tr></thead>
          <tbody>
            {data.users.map((u) => (
              <tr key={u.user_id} className="border-t border-slate-100" data-testid={`user-row-${u.user_id}`}>
                <td className="px-4 py-2.5"><div className="font-medium">{u.email || u.user_id}</div><div className="text-xs text-slate-500">{u.name}{u.user_id === me.user_id ? " (you)" : ""}</div></td>
                <td className="px-4 py-2.5 w-52">
                  <Select value={u.role} onValueChange={(r) => update(u, r, u.range)}>
                    <SelectTrigger className="h-8 rounded-sm" data-testid={`user-role-select-${u.user_id}`}><SelectValue /></SelectTrigger>
                    <SelectContent>{data.roles.map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}</SelectContent>
                  </Select>
                </td>
                <td className="px-4 py-2.5 w-60">
                  {u.role === "range_viewer" ? (
                    <Select value={u.range || ""} onValueChange={(r) => update(u, "range_viewer", r)}>
                      <SelectTrigger className="h-8 rounded-sm" data-testid={`user-range-select-${u.user_id}`}><SelectValue placeholder="Choose range" /></SelectTrigger>
                      <SelectContent>{data.ranges.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                    </Select>
                  ) : <span className="text-xs text-slate-500">{u.role === "pending" ? "No access" : "Statewide"}</span>}
                </td>
                <td className="px-4 py-2.5 text-xs text-slate-500">{fmtDate(u.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
