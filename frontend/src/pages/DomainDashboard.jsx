import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Database, Info } from "lucide-react";
import { useApi, errMsg } from "@/lib/api";
import FilterBar from "@/components/FilterBar";
import ChartsPanel from "@/components/ChartsPanel";
import RankingTable from "@/components/RankingTable";
import ExplainDialog from "@/components/ExplainDialog";
import KpiRow from "@/components/KpiRow";
import ConvictionDetailedOverview from "@/components/ConvictionDetailedOverview";
import TimelinessDetailedOverview from "@/components/TimelinessDetailedOverview";
import Emergency112DetailedOverview from "@/components/Emergency112DetailedOverview";
import HspDetailedOverview from "@/components/HspDetailedOverview";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fmtDate } from "@/lib/format";

const initial = (m) => ({
  type: m.types[m.types.length - 1],
  unit: [],
  base: m.default_base,
  latest: m.default_latest,
  range: [],
  category: "All",
  period_grain: m.default_period_grain || "monthly",
});

function filterParam(v) {
  if (Array.isArray(v)) return v.length ? v.join(",") : "All";
  return v && v !== "All" ? v : "All";
}

function filterLabel(v) {
  if (Array.isArray(v)) return v.length ? v.join(", ") : "All";
  return v || "All";
}

export default function DomainDashboard({ domain }) {
  const api = useApi();
  const [meta, setMeta] = useState(null);
  const [f, setF] = useState(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [explainUnit, setExplainUnit] = useState(null);

  useEffect(() => {
    setMeta(null); setF(null); setData(null); setError(null);
    api("get", "/meta", { params: { domain } }).then((m) => { setMeta(m); setF(initial(m)); }).catch((e) => setError(errMsg(e)));
  }, [domain, api]);

  const load = useCallback(() => {
    if (!f) return;
    const params = {
      domain,
      type: f.type,
      base: f.base,
      latest: f.latest,
      category: f.category,
      unit: filterParam(f.unit),
      range: filterParam(f.range),
    };
    if (domain === "emergency112") params.grain = f.period_grain || "monthly";
    api("get", "/dashboard", { params }).then(setData).catch((e) => setError(errMsg(e)));
  }, [api, domain, f]);
  useEffect(load, [load]);

  const context = useMemo(() => f && ({
    Domain: meta?.labels.label,
    "Case type": f.type,
    Unit: filterLabel(f.unit),
    "Base period": f.base,
    "Latest period": f.latest,
    Range: filterLabel(f.range),
    "Rank category": f.category,
    ...(domain === "emergency112" ? { "Period view": f.period_grain || "monthly" } : {}),
    ...(meta?.scope_range ? { "Access scope": meta.scope_range } : {}),
  }), [f, meta, domain]);

  const unitCategories = useMemo(() => {
    const map = {};
    for (const r of data?.rows || []) {
      if (r?.unit && r.category) map[r.unit] = r.category;
    }
    return map;
  }, [data]);

  if (error) return <div className="text-rose-700 text-sm mt-10" data-testid="dashboard-error">{error}</div>;
  if (!meta || !f) return <div className="flex items-center gap-2 text-slate-500 mt-20 justify-center"><Loader2 className="h-5 w-5 animate-spin" />Loading…</div>;

  const labels = meta.labels;
  const included = data ? data.rows.filter((r) => r.included) : [];
  const samePeriod = f.base === f.latest;
  const w = Math.round((data?.weight ?? 0.7) * 100);
  const notes = domain === "emergency112"
    ? [
      "Period performance = 80% response-time Scale score (latest A+B+C) + 20% %≤100m Scale score.",
      `Time improvement % = (base − latest) ÷ base × 100. Final score = ${w}% period performance + ${100 - w}% final improvement (80% time / 20% %≤100m bands). Category from score thresholds (Excellent ≥90 …).`,
      `Scoring policy v${data?.policy_version ?? "-"} · dataset ${meta.dataset.filename} (${meta.dataset.source}) · as of ${fmtDate(meta.dataset.uploaded_at)}`,
    ]
    : domain === "training"
      ? [
        "% people trained = 100 × people trained ÷ unit headcount. Marks from the Excel Ranking sheet (≥25%→10 … <5%→0).",
        "Rank by Marks (1 = highest). Category from Excel clubbing: Top ≤10, Good ≤20, Needs Improvement ≤30, else Low. Score for charts/combined = Marks × 10.",
        `Scoring policy v${data?.policy_version ?? "-"} · dataset ${meta.dataset.filename} (${meta.dataset.source}) · as of ${fmtDate(meta.dataset.uploaded_at)}`,
      ]
      : domain === "antf"
        ? [
          "Total meetings from January 2026. MoM uploaded = months with minutes on the NCORD portal.",
          "Total marks = (meetings × 3) + (MoM uploaded × 2). Rank by total marks (1 = highest; ties share rank). Performance: Top ≤10, Good ≤20, Needs Improvement ≤30, else Low.",
          `Scoring policy v${data?.policy_version ?? "-"} · dataset ${meta.dataset.filename} (${meta.dataset.source}) · as of ${fmtDate(meta.dataset.uploaded_at)}`,
        ]
        : domain === "hsp"
          ? [
            "Lower accident and killed counts score better. Performance = inverted min–max on latest accidents (30%) and killed (70%).",
            `Improvement from reduction % bands (Excel Chart). Final score = ${w}% performance + ${100 - w}% improvement (accidents 20% / killed 70%). Category by rank: Excellent ≤5 … Poor.`,
            `Scoring policy v${data?.policy_version ?? "-"} · dataset ${meta.dataset.filename} (${meta.dataset.source}) · as of ${fmtDate(meta.dataset.uploaded_at)}`,
          ]
        : [
          `Rate = 100 × ${labels.num} ÷ ${labels.den}. Improvement = latest rate − base rate (percentage points).`,
          `Performance score = (unit latest rate − cohort min) ÷ (cohort max − cohort min) × 100. Overall = ${w}% performance + ${100 - w}% improvement score.`,
          `Scoring policy v${data?.policy_version ?? "-"} · dataset ${meta.dataset.filename} (${meta.dataset.source}) · as of ${fmtDate(meta.dataset.uploaded_at)}`,
        ];

  return (
    <div data-testid={`dashboard-${domain}`}>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-teal-700 font-semibold">Domain dashboard</div>
          <div className="h-0.5 w-8 bg-teal-600 mt-2 mb-2 rounded-full" />
          <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-slate-900" data-testid="dashboard-title">
            {`${String(labels.label || "").replace(/\s*Performance\s*$/i, "").trim()} Performance`}
          </h1>
        </div>
        <div className="flex items-start sm:items-center gap-2 text-xs text-slate-600 surface-panel px-3 py-2 rounded-sm max-w-full" data-testid="dataset-status">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-sm bg-emerald-50 text-emerald-700 shrink-0">
            <Database className="h-3.5 w-3.5" />
          </span>
          <span className="min-w-0 break-words">Source: {meta.dataset.filename} · {meta.dataset.record_count} records · {fmtDate(meta.dataset.uploaded_at)}</span>
        </div>
      </div>
      {domain === "conviction" ? (
        <Tabs defaultValue="overview" className="mt-2" data-testid="conviction-section-tabs">
          <TabsList className="rounded-sm bg-slate-100 h-auto p-1 grid grid-cols-1 sm:grid-cols-3 gap-1 w-full mb-4">
            <TabsTrigger
              value="overview"
              className="rounded-sm px-3 py-1.5 text-sm w-full justify-center data-[state=active]:bg-white data-[state=active]:text-brand-navy data-[state=active]:shadow-sm"
              data-testid="conviction-tab-overview"
            >
              Overview
            </TabsTrigger>
            <TabsTrigger
              value="rankings"
              className="rounded-sm px-3 py-1.5 text-sm w-full justify-center data-[state=active]:bg-white data-[state=active]:text-brand-navy data-[state=active]:shadow-sm"
              data-testid="conviction-tab-rankings"
            >
              Unit level details
            </TabsTrigger>
            <TabsTrigger
              value="score-table"
              className="rounded-sm px-3 py-1.5 text-sm w-full justify-center data-[state=active]:bg-white data-[state=active]:text-brand-navy data-[state=active]:shadow-sm"
              data-testid="conviction-tab-score-table"
            >
              Unit Level Table
            </TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="mt-0 focus-visible:ring-0">
            <ConvictionDetailedOverview />
          </TabsContent>
          <TabsContent value="rankings" className="mt-0 focus-visible:ring-0">
            <FilterBar meta={meta} f={f} set={setF} onReset={() => setF(initial(meta))} unitCategories={unitCategories} />
            {samePeriod && <div className="mt-4 flex items-center gap-2 text-xs bg-teal-50 border border-teal-200 text-teal-800 px-3 py-2 rounded-sm" data-testid="same-period-warning"><Info className="h-4 w-4" />Base and latest period are the same — improvement will be zero.</div>}
            {meta.scope_range && <div className="mt-4 text-xs text-slate-600 bg-sky-50 border border-sky-200 px-3 py-2 rounded-sm" data-testid="scope-notice">Showing units of <b>{meta.scope_range}</b> only. Ranks and scores are computed against the full statewide cohort.</div>}
            {!data ? <div className="flex items-center gap-2 text-slate-500 mt-16 justify-center"><Loader2 className="h-5 w-5 animate-spin" />Calculating scores…</div> : (
              <div className="space-y-5 mt-5">
                <KpiRow domain={domain} data={data} f={f} labels={labels} included={included} />
                <ChartsPanel domain={domain} rows={included} onSelectUnit={setExplainUnit} filterLabel={`${f.type} · ${f.base} → ${f.latest}`} />
              </div>
            )}
          </TabsContent>
          <TabsContent value="score-table" className="mt-0 focus-visible:ring-0">
            <FilterBar meta={meta} f={f} set={setF} onReset={() => setF(initial(meta))} unitCategories={unitCategories} />
            {samePeriod && <div className="mt-4 flex items-center gap-2 text-xs bg-teal-50 border border-teal-200 text-teal-800 px-3 py-2 rounded-sm" data-testid="same-period-warning"><Info className="h-4 w-4" />Base and latest period are the same — improvement will be zero.</div>}
            {meta.scope_range && <div className="mt-4 text-xs text-slate-600 bg-sky-50 border border-sky-200 px-3 py-2 rounded-sm" data-testid="scope-notice">Showing units of <b>{meta.scope_range}</b> only. Ranks and scores are computed against the full statewide cohort.</div>}
            {!data ? <div className="flex items-center gap-2 text-slate-500 mt-16 justify-center"><Loader2 className="h-5 w-5 animate-spin" />Calculating scores…</div> : (
              <div className="space-y-5 mt-5">
                <RankingTable domain={domain} labels={labels} rows={data.rows} onExplain={setExplainUnit} exportContext={context} exportNotes={notes} />
                <p className="text-[11px] text-slate-500 leading-relaxed" data-testid="definitions-note">{notes.join(" ")} Faded rows are outside the current filters.</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      ) : domain === "timeliness" ? (
        <Tabs defaultValue="overview" className="mt-2" data-testid="timeliness-section-tabs">
          <TabsList className="rounded-sm bg-slate-100 h-auto p-1 grid grid-cols-1 sm:grid-cols-3 gap-1 w-full mb-4">
            <TabsTrigger
              value="overview"
              className="rounded-sm px-3 py-1.5 text-sm w-full justify-center data-[state=active]:bg-white data-[state=active]:text-brand-navy data-[state=active]:shadow-sm"
              data-testid="timeliness-tab-overview"
            >
              Overview
            </TabsTrigger>
            <TabsTrigger
              value="rankings"
              className="rounded-sm px-3 py-1.5 text-sm w-full justify-center data-[state=active]:bg-white data-[state=active]:text-brand-navy data-[state=active]:shadow-sm"
              data-testid="timeliness-tab-rankings"
            >
              Unit level details
            </TabsTrigger>
            <TabsTrigger
              value="score-table"
              className="rounded-sm px-3 py-1.5 text-sm w-full justify-center data-[state=active]:bg-white data-[state=active]:text-brand-navy data-[state=active]:shadow-sm"
              data-testid="timeliness-tab-score-table"
            >
              Unit Level Table
            </TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="mt-0 focus-visible:ring-0">
            <TimelinessDetailedOverview />
          </TabsContent>
          <TabsContent value="rankings" className="mt-0 focus-visible:ring-0">
            <FilterBar meta={meta} f={f} set={setF} onReset={() => setF(initial(meta))} unitCategories={unitCategories} />
            {samePeriod && <div className="mt-4 flex items-center gap-2 text-xs bg-teal-50 border border-teal-200 text-teal-800 px-3 py-2 rounded-sm" data-testid="same-period-warning"><Info className="h-4 w-4" />Base and latest period are the same — improvement will be zero.</div>}
            {meta.scope_range && <div className="mt-4 text-xs text-slate-600 bg-sky-50 border border-sky-200 px-3 py-2 rounded-sm" data-testid="scope-notice">Showing units of <b>{meta.scope_range}</b> only. Ranks and scores are computed against the full statewide cohort.</div>}
            {!data ? <div className="flex items-center gap-2 text-slate-500 mt-16 justify-center"><Loader2 className="h-5 w-5 animate-spin" />Calculating scores…</div> : (
              <div className="space-y-5 mt-5">
                <KpiRow domain={domain} data={data} f={f} labels={labels} included={included} />
                <ChartsPanel domain={domain} rows={included} onSelectUnit={setExplainUnit} filterLabel={`${f.type} · ${f.base} → ${f.latest}`} />
              </div>
            )}
          </TabsContent>
          <TabsContent value="score-table" className="mt-0 focus-visible:ring-0">
            <FilterBar meta={meta} f={f} set={setF} onReset={() => setF(initial(meta))} unitCategories={unitCategories} />
            {samePeriod && <div className="mt-4 flex items-center gap-2 text-xs bg-teal-50 border border-teal-200 text-teal-800 px-3 py-2 rounded-sm" data-testid="same-period-warning"><Info className="h-4 w-4" />Base and latest period are the same — improvement will be zero.</div>}
            {meta.scope_range && <div className="mt-4 text-xs text-slate-600 bg-sky-50 border border-sky-200 px-3 py-2 rounded-sm" data-testid="scope-notice">Showing units of <b>{meta.scope_range}</b> only. Ranks and scores are computed against the full statewide cohort.</div>}
            {!data ? <div className="flex items-center gap-2 text-slate-500 mt-16 justify-center"><Loader2 className="h-5 w-5 animate-spin" />Calculating scores…</div> : (
              <div className="space-y-5 mt-5">
                <RankingTable domain={domain} labels={labels} rows={data.rows} onExplain={setExplainUnit} exportContext={context} exportNotes={notes} />
                <p className="text-[11px] text-slate-500 leading-relaxed" data-testid="definitions-note">{notes.join(" ")} Faded rows are outside the current filters.</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      ) : domain === "emergency112" ? (
        <Tabs defaultValue="overview" className="mt-2" data-testid="emergency112-section-tabs">
          <TabsList className="rounded-sm bg-slate-100 h-auto p-1 grid grid-cols-1 sm:grid-cols-3 gap-1 w-full mb-4">
            <TabsTrigger
              value="overview"
              className="rounded-sm px-3 py-1.5 text-sm w-full justify-center data-[state=active]:bg-white data-[state=active]:text-brand-navy data-[state=active]:shadow-sm"
              data-testid="emergency112-tab-overview"
            >
              Overview
            </TabsTrigger>
            <TabsTrigger
              value="rankings"
              className="rounded-sm px-3 py-1.5 text-sm w-full justify-center data-[state=active]:bg-white data-[state=active]:text-brand-navy data-[state=active]:shadow-sm"
              data-testid="emergency112-tab-rankings"
            >
              Unit level details
            </TabsTrigger>
            <TabsTrigger
              value="score-table"
              className="rounded-sm px-3 py-1.5 text-sm w-full justify-center data-[state=active]:bg-white data-[state=active]:text-brand-navy data-[state=active]:shadow-sm"
              data-testid="emergency112-tab-score-table"
            >
              Unit Level Table
            </TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="mt-0 focus-visible:ring-0">
            <Emergency112DetailedOverview />
          </TabsContent>
          <TabsContent value="rankings" className="mt-0 focus-visible:ring-0">
            <FilterBar meta={meta} f={f} set={setF} onReset={() => setF(initial(meta))} unitCategories={unitCategories} />
            {samePeriod && <div className="mt-4 flex items-center gap-2 text-xs bg-teal-50 border border-teal-200 text-teal-800 px-3 py-2 rounded-sm" data-testid="same-period-warning"><Info className="h-4 w-4" />Base and latest period are the same — improvement will be zero.</div>}
            {meta.scope_range && <div className="mt-4 text-xs text-slate-600 bg-sky-50 border border-sky-200 px-3 py-2 rounded-sm" data-testid="scope-notice">Showing units of <b>{meta.scope_range}</b> only. Ranks and scores are computed against the full statewide cohort.</div>}
            {!data ? <div className="flex items-center gap-2 text-slate-500 mt-16 justify-center"><Loader2 className="h-5 w-5 animate-spin" />Calculating scores…</div> : (
              <div className="space-y-5 mt-5">
                <KpiRow domain={domain} data={data} f={f} labels={labels} included={included} />
                <ChartsPanel
                  domain={domain}
                  rows={included}
                  onSelectUnit={setExplainUnit}
                  filterLabel={`${meta.period_grains?.[f.period_grain || "monthly"]?.label || "Monthly"} · ${f.base} → ${f.latest}`}
                />
              </div>
            )}
          </TabsContent>
          <TabsContent value="score-table" className="mt-0 focus-visible:ring-0">
            <FilterBar meta={meta} f={f} set={setF} onReset={() => setF(initial(meta))} unitCategories={unitCategories} />
            {samePeriod && <div className="mt-4 flex items-center gap-2 text-xs bg-teal-50 border border-teal-200 text-teal-800 px-3 py-2 rounded-sm" data-testid="same-period-warning"><Info className="h-4 w-4" />Base and latest period are the same — improvement will be zero.</div>}
            {meta.scope_range && <div className="mt-4 text-xs text-slate-600 bg-sky-50 border border-sky-200 px-3 py-2 rounded-sm" data-testid="scope-notice">Showing units of <b>{meta.scope_range}</b> only. Ranks and scores are computed against the full statewide cohort.</div>}
            {!data ? <div className="flex items-center gap-2 text-slate-500 mt-16 justify-center"><Loader2 className="h-5 w-5 animate-spin" />Calculating scores…</div> : (
              <div className="space-y-5 mt-5">
                <RankingTable domain={domain} labels={labels} rows={data.rows} onExplain={setExplainUnit} exportContext={context} exportNotes={notes} />
                <p className="text-[11px] text-slate-500 leading-relaxed" data-testid="definitions-note">{notes.join(" ")} Faded rows are outside the current filters.</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      ) : domain === "hsp" ? (
        <Tabs defaultValue="overview" className="mt-2" data-testid="hsp-section-tabs">
          <TabsList className="rounded-sm bg-slate-100 h-auto p-1 grid grid-cols-1 sm:grid-cols-3 gap-1 w-full mb-4">
            <TabsTrigger
              value="overview"
              className="rounded-sm px-3 py-1.5 text-sm w-full justify-center data-[state=active]:bg-white data-[state=active]:text-brand-navy data-[state=active]:shadow-sm"
              data-testid="hsp-tab-overview"
            >
              Overview
            </TabsTrigger>
            <TabsTrigger
              value="rankings"
              className="rounded-sm px-3 py-1.5 text-sm w-full justify-center data-[state=active]:bg-white data-[state=active]:text-brand-navy data-[state=active]:shadow-sm"
              data-testid="hsp-tab-rankings"
            >
              Unit level details
            </TabsTrigger>
            <TabsTrigger
              value="score-table"
              className="rounded-sm px-3 py-1.5 text-sm w-full justify-center data-[state=active]:bg-white data-[state=active]:text-brand-navy data-[state=active]:shadow-sm"
              data-testid="hsp-tab-score-table"
            >
              Unit Level Table
            </TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="mt-0 focus-visible:ring-0">
            <HspDetailedOverview />
          </TabsContent>
          <TabsContent value="rankings" className="mt-0 focus-visible:ring-0">
            <FilterBar meta={meta} f={f} set={setF} onReset={() => setF(initial(meta))} unitCategories={unitCategories} />
            {samePeriod && <div className="mt-4 flex items-center gap-2 text-xs bg-teal-50 border border-teal-200 text-teal-800 px-3 py-2 rounded-sm" data-testid="same-period-warning"><Info className="h-4 w-4" />Base and latest period are the same — improvement will be zero.</div>}
            {meta.scope_range && <div className="mt-4 text-xs text-slate-600 bg-sky-50 border border-sky-200 px-3 py-2 rounded-sm" data-testid="scope-notice">Showing units of <b>{meta.scope_range}</b> only. Ranks and scores are computed against the full statewide cohort.</div>}
            {!data ? <div className="flex items-center gap-2 text-slate-500 mt-16 justify-center"><Loader2 className="h-5 w-5 animate-spin" />Calculating scores…</div> : (
              <div className="space-y-5 mt-5">
                <KpiRow domain={domain} data={data} f={f} labels={labels} included={included} />
                <ChartsPanel
                  domain={domain}
                  rows={included}
                  onSelectUnit={setExplainUnit}
                  filterLabel={`${f.base} → ${f.latest}`}
                />
              </div>
            )}
          </TabsContent>
          <TabsContent value="score-table" className="mt-0 focus-visible:ring-0">
            <FilterBar meta={meta} f={f} set={setF} onReset={() => setF(initial(meta))} unitCategories={unitCategories} />
            {samePeriod && <div className="mt-4 flex items-center gap-2 text-xs bg-teal-50 border border-teal-200 text-teal-800 px-3 py-2 rounded-sm" data-testid="same-period-warning"><Info className="h-4 w-4" />Base and latest period are the same — improvement will be zero.</div>}
            {meta.scope_range && <div className="mt-4 text-xs text-slate-600 bg-sky-50 border border-sky-200 px-3 py-2 rounded-sm" data-testid="scope-notice">Showing units of <b>{meta.scope_range}</b> only. Ranks and scores are computed against the full statewide cohort.</div>}
            {!data ? <div className="flex items-center gap-2 text-slate-500 mt-16 justify-center"><Loader2 className="h-5 w-5 animate-spin" />Calculating scores…</div> : (
              <div className="space-y-5 mt-5">
                <RankingTable domain={domain} labels={labels} rows={data.rows} onExplain={setExplainUnit} exportContext={context} exportNotes={notes} />
                <p className="text-[11px] text-slate-500 leading-relaxed" data-testid="definitions-note">{notes.join(" ")} Faded rows are outside the current filters.</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      ) : (
        <>
          <FilterBar meta={meta} f={f} set={setF} onReset={() => setF(initial(meta))} unitCategories={unitCategories} />
          {samePeriod && domain !== "antf" && <div className="mt-4 flex items-center gap-2 text-xs bg-teal-50 border border-teal-200 text-teal-800 px-3 py-2 rounded-sm" data-testid="same-period-warning"><Info className="h-4 w-4" />Base and latest period are the same — improvement will be zero.</div>}
          {meta.scope_range && <div className="mt-4 text-xs text-slate-600 bg-sky-50 border border-sky-200 px-3 py-2 rounded-sm" data-testid="scope-notice">Showing units of <b>{meta.scope_range}</b> only. Ranks and scores are computed against the full statewide cohort.</div>}
          {!data ? <div className="flex items-center gap-2 text-slate-500 mt-16 justify-center"><Loader2 className="h-5 w-5 animate-spin" />Calculating scores…</div> : (
            <div className="space-y-5 mt-5">
              <KpiRow domain={domain} data={data} f={f} labels={labels} included={included} />
              <ChartsPanel
                domain={domain}
                rows={included}
                onSelectUnit={setExplainUnit}
                filterLabel={
                  domain === "training"
                    ? `${f.base} → ${f.latest}`
                    : domain === "antf"
                      ? (f.latest || "YTD 2026")
                      : `${f.type} · ${f.base} → ${f.latest}`
                }
              />
              <RankingTable domain={domain} labels={labels} rows={data.rows} onExplain={setExplainUnit} exportContext={context} exportNotes={notes} />
              <p className="text-[11px] text-slate-500 leading-relaxed" data-testid="definitions-note">{notes.join(" ")} Faded rows are outside the current filters.</p>
            </div>
          )}
        </>
      )}
      <ExplainDialog open={!!explainUnit} onOpenChange={(o) => !o && setExplainUnit(null)} labels={labels}
        params={explainUnit ? {
          domain,
          type: f.type,
          base: f.base,
          latest: f.latest,
          unit: explainUnit,
          ...(domain === "emergency112" ? { grain: f.period_grain || "monthly" } : {}),
        } : null} />
    </div>
  );
}
