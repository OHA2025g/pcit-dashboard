import { useEffect, useState } from "react";
import { Loader2, Info } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Panel } from "@/components/Primitives";
import ExportMenu from "@/components/ExportMenu";
import { useApi, errMsg } from "@/lib/api";
import { fmt } from "@/lib/format";
import { CHART, TipBox } from "@/lib/chartTheme";

const Pick = ({ label, value, onChange, options, testId }) => (
  <div className="min-w-0">
    <div className="text-[10px] uppercase tracking-[0.14em] font-semibold text-slate-500 mb-1.5">{label}</div>
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-9 rounded-sm bg-white focus:ring-2 focus:ring-teal-600/35" data-testid={testId}><SelectValue /></SelectTrigger>
      <SelectContent className="max-h-72 rounded-sm">{options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
    </Select>
  </div>
);

const Tip = (props) => <TipBox {...props} unit="%" />;

export default function TrendsPage() {
  const api = useApi();
  const [meta, setMeta] = useState(null);
  const [sel, setSel] = useState(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([
      api("get", "/meta", { params: { domain: "conviction" } }),
      api("get", "/meta", { params: { domain: "timeliness" } }),
      api("get", "/meta", { params: { domain: "emergency112" } }).catch(() => null),
      api("get", "/meta", { params: { domain: "hsp" } }).catch(() => null),
      api("get", "/meta", { params: { domain: "training" } }).catch(() => null),
      api("get", "/meta", { params: { domain: "antf" } }).catch(() => null),
    ])
      .then(([c, t, e112, hsp, tr, antf]) => {
        setMeta({ c, t, e112, hsp, tr, antf });
        setSel({ unit: c.units[0], conv_type: c.types[c.types.length - 1], tim_type: t.types[t.types.length - 1] });
      })
      .catch((e) => setError(errMsg(e)));
  }, [api]);
  useEffect(() => {
    if (!sel) return;
    setData(null);
    api("get", "/trend", { params: sel }).then(setData).catch((e) => setError(errMsg(e)));
  }, [api, sel]);

  if (error) return <div className="text-rose-700 text-sm mt-10" data-testid="trends-error">{error}</div>;
  if (!meta || !sel) return <div className="flex items-center gap-2 text-slate-500 mt-20 justify-center"><Loader2 className="h-5 w-5 animate-spin" />Loading…</div>;
  const upd = (k) => (v) => setSel((s) => ({ ...s, [k]: v }));
  const bench = data?.benchmark_label || "State average";
  const cols = [
    { key: "period", label: "Period" },
    { key: "conviction", label: "Conviction rate %" }, { key: "conviction_benchmark", label: `Conviction ${bench} %` },
    { key: "timeliness", label: "Within-time rate %" }, { key: "timeliness_benchmark", label: `Within-time ${bench} %` },
    { key: "emergency112", label: "112 % ≤100m" }, { key: "emergency112_benchmark", label: `112 ${bench} %` },
    { key: "hsp", label: "HSP killed / accidents %" }, { key: "hsp_benchmark", label: `HSP ${bench} %` },
    { key: "training", label: "% people trained" }, { key: "training_benchmark", label: `Training ${bench} %` },
    { key: "antf", label: "ANTF MoM / meetings %" }, { key: "antf_benchmark", label: `ANTF ${bench} %` },
  ];

  return (
    <div className="space-y-5" data-testid="trends-page">
      <div>
        <div className="text-[11px] uppercase tracking-[0.2em] text-teal-700 font-semibold">Unit trend</div>
        <div className="h-0.5 w-8 bg-teal-600 mt-2 mb-2 rounded-full" />
        <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">Performance over time</h1>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 surface-panel p-4 rounded-sm">
        <Pick label="Unit" value={sel.unit} onChange={upd("unit")} options={meta.c.units} testId="trend-unit-select" />
        <Pick label="Conviction case type" value={sel.conv_type} onChange={upd("conv_type")} options={meta.c.types} testId="trend-conv-type-select" />
        <Pick label="Timeliness case type" value={sel.tim_type} onChange={upd("tim_type")} options={meta.t.types} testId="trend-tim-type-select" />
      </div>
      <Panel testId="trend-chart-panel" title={`${sel.unit} · conviction, timeliness, 112, HSP, training, ANTF`}
        subtitle={`Half-year, monthly, quarter, and YTD periods · dashed lines = ${bench.toLowerCase()}`}
        right={data && <ExportMenu title={`Trend - ${sel.unit}`} view="trend" columns={cols} rows={data.points} context={{ Unit: sel.unit, "Conviction type": sel.conv_type, "Timeliness type": sel.tim_type }} testId="trend-export" />}>
        {!data ? <div className="h-[380px] flex items-center justify-center text-slate-500"><Loader2 className="h-5 w-5 animate-spin" /></div> : (
          <>
            {!data.matched.timeliness && <div className="mb-3 flex items-center gap-2 text-xs bg-teal-50 border border-teal-200 text-teal-800 px-3 py-2 rounded-sm" data-testid="trend-no-timeliness"><Info className="h-4 w-4" />This unit has no matching record in the timeliness data.</div>}
            {!data.matched.emergency112 && <div className="mb-3 flex items-center gap-2 text-xs bg-teal-50 border border-teal-200 text-teal-800 px-3 py-2 rounded-sm" data-testid="trend-no-112"><Info className="h-4 w-4" />This unit has no matching record in the 112 data.</div>}
            {!data.matched.hsp && <div className="mb-3 flex items-center gap-2 text-xs bg-teal-50 border border-teal-200 text-teal-800 px-3 py-2 rounded-sm" data-testid="trend-no-hsp"><Info className="h-4 w-4" />This unit has no matching record in the HSP data.</div>}
            {!data.matched.training && <div className="mb-3 flex items-center gap-2 text-xs bg-teal-50 border border-teal-200 text-teal-800 px-3 py-2 rounded-sm" data-testid="trend-no-training"><Info className="h-4 w-4" />This unit has no matching record in the training data.</div>}
            {!data.matched.antf && <div className="mb-3 flex items-center gap-2 text-xs bg-teal-50 border border-teal-200 text-teal-800 px-3 py-2 rounded-sm" data-testid="trend-no-antf"><Info className="h-4 w-4" />This unit has no matching record in the ANTF meetings data.</div>}
            <div className="h-[260px] sm:h-[320px] md:h-[380px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.points} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="2 4" stroke={CHART.grid} />
                  <XAxis dataKey="period" tick={{ fontSize: 10, fill: CHART.tick }} interval="preserveStartEnd" />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: CHART.tick }} unit="%" width={36} />
                  <Tooltip content={<Tip />} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="linear" dataKey="conviction" name="Conviction rate" stroke={CHART.navy} strokeWidth={2.5} dot={{ r: 4 }} connectNulls isAnimationActive animationDuration={CHART.animationDuration} />
                  <Line type="linear" dataKey="conviction_benchmark" name={`Conviction · ${bench}`} stroke={CHART.navy} strokeDasharray="5 5" strokeWidth={1.5} dot={false} connectNulls isAnimationActive animationDuration={CHART.animationDuration} />
                  <Line type="linear" dataKey="timeliness" name="Within-time rate" stroke={CHART.amber} strokeWidth={2.5} dot={{ r: 4 }} connectNulls isAnimationActive animationDuration={CHART.animationDuration} />
                  <Line type="linear" dataKey="timeliness_benchmark" name={`Within-time · ${bench}`} stroke={CHART.amber} strokeDasharray="5 5" strokeWidth={1.5} dot={false} connectNulls isAnimationActive animationDuration={CHART.animationDuration} />
                  <Line type="linear" dataKey="emergency112" name="112 % ≤100m" stroke="#0F766E" strokeWidth={2.5} dot={{ r: 4 }} connectNulls isAnimationActive animationDuration={CHART.animationDuration} />
                  <Line type="linear" dataKey="emergency112_benchmark" name={`112 · ${bench}`} stroke="#0F766E" strokeDasharray="5 5" strokeWidth={1.5} dot={false} connectNulls isAnimationActive animationDuration={CHART.animationDuration} />
                  <Line type="linear" dataKey="hsp" name="HSP killed / accidents %" stroke="#C2410C" strokeWidth={2.5} dot={{ r: 4 }} connectNulls isAnimationActive animationDuration={CHART.animationDuration} />
                  <Line type="linear" dataKey="hsp_benchmark" name={`HSP · ${bench}`} stroke="#C2410C" strokeDasharray="5 5" strokeWidth={1.5} dot={false} connectNulls isAnimationActive animationDuration={CHART.animationDuration} />
                  <Line type="linear" dataKey="training" name="% people trained" stroke="#7C3AED" strokeWidth={2.5} dot={{ r: 4 }} connectNulls isAnimationActive animationDuration={CHART.animationDuration} />
                  <Line type="linear" dataKey="training_benchmark" name={`Training · ${bench}`} stroke="#7C3AED" strokeDasharray="5 5" strokeWidth={1.5} dot={false} connectNulls isAnimationActive animationDuration={CHART.animationDuration} />
                  <Line type="linear" dataKey="antf" name="ANTF MoM / meetings %" stroke="#BE123C" strokeWidth={2.5} dot={{ r: 4 }} connectNulls isAnimationActive animationDuration={CHART.animationDuration} />
                  <Line type="linear" dataKey="antf_benchmark" name={`ANTF · ${bench}`} stroke="#BE123C" strokeDasharray="5 5" strokeWidth={1.5} dot={false} connectNulls isAnimationActive animationDuration={CHART.animationDuration} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="overflow-x-auto mt-4 -mx-3 sm:-mx-5 -mb-3 sm:-mb-5 border-t border-slate-100">
              <table className="w-full min-w-[960px] text-sm" data-testid="trend-table">
                <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500"><tr>{cols.map((c) => <th key={c.key} className="text-left px-3 sm:px-4 py-2 whitespace-nowrap">{c.label}</th>)}</tr></thead>
                <tbody>{data.points.map((p) => <tr key={p.period} className="border-t border-slate-100">{cols.map((c) => <td key={c.key} className="px-3 sm:px-4 py-2 font-num text-xs whitespace-nowrap">{c.key === "period" ? p.period : fmt(p[c.key])}</td>)}</tr>)}</tbody>
              </table>
            </div>
          </>
        )}
      </Panel>
    </div>
  );
}
