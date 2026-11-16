import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const download = (blob, name) => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};

const cell = (v) => (v === null || v === undefined ? "" : typeof v === "number" ? Math.round(v * 100) / 100 : v);
const ASCII = { "−": "-", "→": "->", "≤": "<=", "≥": ">=", "÷": "/", "×": "x", "·": "|", "—": "-", "–": "-" };
const pdfSafe = (v) => (typeof v === "string" ? v.replace(/[−→≤≥÷×·—–]/g, (c) => ASCII[c]) : v);
const deep = (x) => (Array.isArray(x) ? x.map(deep) : pdfSafe(x));

// columns: [{key,label}], context: {label: value}
export function exportData(format, { title, columns, rows, context, notes = [] }) {
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
  const base = `${title.replace(/[^a-z0-9]+/gi, "_")}_${stamp}`;
  const body = rows.map((r) => columns.map((c) => cell(r[c.key])));
  const ctx = [...Object.entries(context), ["Generated", new Date().toLocaleString("en-IN")]];

  if (format === "csv") {
    const esc = (v) => `"${String(v).replace(/"/g, '""')}"`;
    const lines = [...ctx.map(([k, v]) => `${esc(k)},${esc(v)}`), "", columns.map((c) => esc(c.label)).join(","), ...body.map((r) => r.map(esc).join(","))];
    notes.forEach((n) => lines.push(esc(n)));
    download(new Blob([lines.join("\n")], { type: "text/csv" }), `${base}.csv`);
  } else if (format === "xlsx") {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([columns.map((c) => c.label), ...body]), "Data");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Context", ""], ...ctx, [], ...notes.map((n) => [n])]), "Context & Definitions");
    XLSX.writeFile(wb, `${base}.xlsx`);
  } else {
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    doc.setFontSize(14);
    doc.text(pdfSafe(title), 32, 36);
    doc.setFontSize(8);
    doc.text(pdfSafe(ctx.map(([k, v]) => `${k}: ${v}`).join("   |   ")), 32, 52, { maxWidth: 780 });
    autoTable(doc, {
      startY: 66, head: [deep(columns.map((c) => c.label))], body: deep(body),
      styles: { fontSize: 7, cellPadding: 3 }, headStyles: { fillColor: [15, 23, 42] },
      alternateRowStyles: { fillColor: [244, 246, 250] },
    });
    if (notes.length) {
      doc.setFontSize(7);
      doc.text(deep(notes), 32, doc.lastAutoTable.finalY + 16, { maxWidth: 780 });
    }
    doc.save(`${base}.pdf`);
  }
}

export function exportSteps({ title, steps, context }) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  doc.setFontSize(14);
  doc.text(pdfSafe(title), 36, 40);
  doc.setFontSize(8);
  doc.text(pdfSafe(Object.entries(context).map(([k, v]) => `${k}: ${v}`).join("  |  ")), 36, 56, { maxWidth: 520 });
  const body = steps.map((s) => [
    `Step ${s.step}`, s.title,
    [...(s.lines || []).map((l) => `${l[0]}: ${l[1]}`), ...(s.table || []).map((t) => `${t[0]} → ${t[1]}`), s.formula || ""].filter(Boolean).join("\n"),
  ]);
  autoTable(doc, { startY: 70, head: [["Step", "Parameter", "Working"]], body: deep(body), styles: { fontSize: 8 }, headStyles: { fillColor: [15, 23, 42] }, columnStyles: { 2: { cellWidth: 340 } } });
  doc.save(`${title.replace(/[^a-z0-9]+/gi, "_")}.pdf`);
}
