import { useCallback, useEffect, useRef, useState } from "react";
import { Upload, CheckCircle2, Loader2, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/Primitives";
import { useApi, errMsg } from "@/lib/api";
import { fmtDate } from "@/lib/format";

export default function DataTab() {
  const api = useApi();
  const input = useRef(null);
  const [list, setList] = useState([]);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => api("get", "/datasets").then(setList).catch((e) => toast.error(errMsg(e))), [api]);
  useEffect(() => { load(); }, [load]);

  const upload = async (file) => {
    if (!file) return;
    setBusy(true);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const ds = await api("post", "/datasets/upload", { data: fd });
      toast.success("Workbook imported", { description: `${ds.domain} · ${ds.record_count} records · ${ds.periods.join(", ")}` });
      load();
    } catch (e) {
      toast.error("Upload rejected", { description: errMsg(e) });
    } finally {
      setBusy(false);
      input.current.value = "";
    }
  };
  const activate = async (id) => {
    try { await api("post", `/datasets/${id}/activate`); toast.success("Dataset activated"); load(); } catch (e) { toast.error(errMsg(e)); }
  };
  const archive = async (id) => {
    try { await api("post", `/datasets/${id}/archive`); toast.success("Version archived"); load(); } catch (e) { toast.error(errMsg(e)); }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-5">
      <Panel title="Upload a newer workbook" subtitle="Same layout as the Conviction or 60/90 Day workbook">
        <button onClick={() => input.current.click()} disabled={busy} data-testid="upload-dropzone"
          onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); upload(e.dataTransfer.files[0]); }}
          className="w-full border-2 border-dashed border-slate-300 hover:border-blue-900 hover:bg-blue-50/40 transition-colors rounded-sm p-8 flex flex-col items-center text-center">
          {busy ? <Loader2 className="h-8 w-8 animate-spin text-blue-900" /> : <Upload className="h-8 w-8 text-blue-900" />}
          <div className="mt-3 text-sm font-semibold">{busy ? "Validating & importing…" : "Drop .xlsm / .xlsx here or click to browse"}</div>
          <div className="text-xs text-slate-500 mt-1">The "Source Data" sheet is read; macros are never run. Domain is detected automatically.</div>
        </button>
        <input ref={input} type="file" accept=".xlsx,.xlsm" className="hidden" onChange={(e) => upload(e.target.files[0])} data-testid="upload-file-input" />
        <p className="text-xs text-slate-500 mt-4 leading-relaxed">A new upload becomes the active dataset for its domain. Earlier versions are kept and can be re-activated at any time.</p>
      </Panel>
      <Panel title="Dataset versions" subtitle={`${list.length} versions`}>
        <div className="overflow-x-auto -mx-5 -mb-5">
          <table className="w-full text-sm" data-testid="datasets-table">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500"><tr>{["Domain", "File / source", "Periods", "Records", "Uploaded", "Issues", ""].map((h) => <th key={h} className="text-left px-4 py-2.5">{h}</th>)}</tr></thead>
            <tbody>
              {list.map((d) => (
                <tr key={d.id} className="border-t border-slate-100" data-testid={`dataset-row-${d.id}`}>
                  <td className="px-4 py-2.5 capitalize font-medium">{d.domain}</td>
                  <td className="px-4 py-2.5"><div className="flex items-center gap-1.5"><FileSpreadsheet className="h-4 w-4 text-emerald-700" />{d.filename}</div><div className="text-[11px] text-slate-500">{d.source}</div></td>
                  <td className="px-4 py-2.5 text-xs">{d.periods.join(", ")}</td>
                  <td className="px-4 py-2.5 font-num">{d.record_count}</td>
                  <td className="px-4 py-2.5 text-xs">{fmtDate(d.uploaded_at)}<div className="text-slate-500">{d.uploaded_by}</div></td>
                  <td className="px-4 py-2.5 text-xs" title={(d.issues || []).join("\n")}>{d.issues?.length || 0}</td>
                  <td className="px-4 py-2.5 text-right">
                    {d.active ? <span className="inline-flex items-center gap-1 text-xs text-emerald-700 font-semibold" data-testid={`dataset-active-${d.id}`}><CheckCircle2 className="h-4 w-4" />Active</span>
                      : <div className="flex gap-1.5 justify-end"><Button size="sm" variant="outline" className="rounded-sm" onClick={() => activate(d.id)} data-testid={`dataset-activate-${d.id}`}>Activate</Button><Button size="sm" variant="ghost" className="rounded-sm text-slate-500" onClick={() => archive(d.id)} data-testid={`dataset-archive-${d.id}`}>Archive</Button></div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
