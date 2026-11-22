export const fmt = (v, d = 2) => (v === null || v === undefined || Number.isNaN(v) ? "—" : Number(v).toFixed(d));
export const fmtInt = (v) => (v === null || v === undefined ? "—" : Math.round(v).toLocaleString("en-IN"));
export const fmtPP = (v) => (v === null || v === undefined ? "—" : `${v > 0 ? "+" : ""}${Number(v).toFixed(2)}`);
export const fmtDate = (iso) => (iso ? new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—");

/** District / unit performance colours (Maharashtra map legend). */
export const MAP_CATEGORY_COLORS = {
  "Top Performer": "#008000",
  "Good Performer": "#50C878",
  "Moderate Performer": "#FFBF00",
  "Low Performer": "#FF4433",
  "Needs Improvement": "#C41E3A",
};

export const MAP_LEGEND = [
  { label: "Top Performer", color: MAP_CATEGORY_COLORS["Top Performer"] },
  { label: "Good Performer", color: MAP_CATEGORY_COLORS["Good Performer"] },
  { label: "Moderate Performer", color: MAP_CATEGORY_COLORS["Moderate Performer"] },
  { label: "Low Performer", color: MAP_CATEGORY_COLORS["Low Performer"] },
  { label: "Needs Improvement", color: MAP_CATEGORY_COLORS["Needs Improvement"] },
];

/** Map domain-specific category labels onto the shared five-band palette. */
export function mapCategoryColor(category) {
  if (!category || category === "Not scored") return "#E2E8F0";
  if (MAP_CATEGORY_COLORS[category]) return MAP_CATEGORY_COLORS[category];
  const aliases = {
    "Excellent Performer": "Top Performer",
    Excellent: "Top Performer",
    "Very Good": "Good Performer",
    Good: "Moderate Performer",
    Poor: "Low Performer",
  };
  const mapped = aliases[category];
  return (mapped && MAP_CATEGORY_COLORS[mapped]) || "#94A3B8";
}

export const CATEGORY_STYLES = {
  "Excellent Performer": { cls: "bg-emerald-50 text-emerald-900 border-emerald-200", dot: "bg-[#008000]", color: "#008000" },
  Excellent: { cls: "bg-emerald-50 text-emerald-900 border-emerald-200", dot: "bg-[#008000]", color: "#008000" },
  "Top Performer": { cls: "bg-emerald-50 text-emerald-900 border-emerald-200", dot: "bg-[#008000]", color: "#008000" },
  "Very Good": { cls: "bg-emerald-50 text-emerald-800 border-emerald-200", dot: "bg-[#50C878]", color: "#50C878" },
  "Good Performer": { cls: "bg-emerald-50 text-emerald-800 border-emerald-200", dot: "bg-[#50C878]", color: "#50C878" },
  Good: { cls: "bg-amber-50 text-amber-900 border-amber-200", dot: "bg-[#FFBF00]", color: "#FFBF00" },
  "Moderate Performer": { cls: "bg-amber-50 text-amber-900 border-amber-200", dot: "bg-[#FFBF00]", color: "#FFBF00" },
  "Needs Improvement": { cls: "bg-red-50 text-red-950 border-red-200", dot: "bg-[#C41E3A]", color: "#C41E3A" },
  "Low Performer": { cls: "bg-rose-50 text-rose-900 border-rose-200", dot: "bg-[#FF4433]", color: "#FF4433" },
  Poor: { cls: "bg-rose-50 text-rose-900 border-rose-200", dot: "bg-[#FF4433]", color: "#FF4433" },
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
