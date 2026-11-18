export const fmt = (v, d = 2) => (v === null || v === undefined || Number.isNaN(v) ? "—" : Number(v).toFixed(d));
export const fmtInt = (v) => (v === null || v === undefined ? "—" : Math.round(v).toLocaleString("en-IN"));
export const fmtPP = (v) => (v === null || v === undefined ? "—" : `${v > 0 ? "+" : ""}${Number(v).toFixed(2)}`);
export const fmtDate = (iso) => (iso ? new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—");

export const CATEGORY_STYLES = {
  "Excellent Performer": { cls: "bg-emerald-50 text-emerald-900 border-emerald-200", dot: "bg-emerald-600", color: "#059669" },
  "Top Performer": { cls: "bg-emerald-50 text-emerald-900 border-emerald-200", dot: "bg-emerald-600", color: "#059669" },
  "Good Performer": { cls: "bg-sky-50 text-sky-950 border-sky-200", dot: "bg-[#0F3D5E]", color: "#0F3D5E" },
  "Moderate Performer": { cls: "bg-teal-50 text-teal-900 border-teal-200", dot: "bg-teal-700", color: "#0F766E" },
  "Needs Improvement": { cls: "bg-orange-50 text-orange-900 border-orange-200", dot: "bg-orange-500", color: "#EA580C" },
  "Low Performer": { cls: "bg-rose-50 text-rose-900 border-rose-200", dot: "bg-rose-600", color: "#E11D48" },
  "Not scored": { cls: "bg-slate-100 text-slate-600 border-slate-200", dot: "bg-slate-400", color: "#94A3B8" },
};

export const fmtDuration = (sec) => {
  if (sec === null || sec === undefined || Number.isNaN(sec)) return "—";
  const s = Math.max(0, Math.round(Number(sec)));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}` : `${m}:${String(r).padStart(2, "0")}`;
};

export const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export const ROLE_LABELS = { admin: "Admin", approver: "Approver", state_viewer: "State viewer", range_viewer: "Range viewer", pending: "Pending approval" };
