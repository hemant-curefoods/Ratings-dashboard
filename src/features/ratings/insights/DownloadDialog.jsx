import { useState } from "react";
import * as XLSX from "xlsx-js-style";
import { C, FONT } from "../../../theme";
import { sendReportEmail } from "../ratingsApi";

const FORMATS = ["XLSX", "CSV", "PDF", "HTML"];

const toggleStyle = (active) => ({
  flex: 1,
  padding: "8px 0",
  borderRadius: 8,
  border: `1.5px solid ${C.primary}`,
  backgroundColor: active ? C.primary : "transparent",
  color: active ? "#ffffff" : C.primary,
  fontSize: 11.5,
  fontWeight: 800,
  cursor: "pointer",
  fontFamily: FONT,
});

const ratingOf = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 && n <= 5 ? n : null;
};

const HEADER_STYLE = {
  font: { bold: true, color: { rgb: "FFFFFF" } },
  fill: { patternType: "solid", fgColor: { rgb: "132664" } },
  alignment: { horizontal: "center" },
};

const ratingFill = (rating) => {
  if (rating >= 4) return { patternType: "solid", fgColor: { rgb: "132664" } };
  if (rating >= 3) return { patternType: "solid", fgColor: { rgb: "AEBBDE" } };
  return { patternType: "solid", fgColor: { rgb: "E4E8F5" } };
};

const ratingFont = (rating) =>
  rating >= 4 ? { color: { rgb: "FFFFFF" }, bold: true } : { color: { rgb: "132664" } };

function buildWorkbook(dataSheets) {
  const wb = XLSX.utils.book_new();
  dataSheets.forEach((s, i) => {
    const rows = s.rows || [];
    const ws = XLSX.utils.json_to_sheet(rows);
    const range = XLSX.utils.decode_range(ws["!ref"] || "A1");

    // Style header row
    for (let C2 = range.s.c; C2 <= range.e.c; C2++) {
      const addr = XLSX.utils.encode_cell({ r: 0, c: C2 });
      if (ws[addr]) ws[addr].s = HEADER_STYLE;
    }

    // Style rating cells in body
    for (let R = 1; R <= range.e.r; R++) {
      for (let C2 = range.s.c; C2 <= range.e.c; C2++) {
        const addr = XLSX.utils.encode_cell({ r: R, c: C2 });
        if (!ws[addr]) continue;
        const rating = ratingOf(ws[addr].v);
        if (rating !== null) {
          ws[addr].s = { fill: ratingFill(rating), font: ratingFont(rating), alignment: { horizontal: "center" } };
        }
      }
    }

    XLSX.utils.book_append_sheet(wb, ws, (s.sheetName || `Sheet${i + 1}`).slice(0, 28));
  });
  return wb;
}

function saveBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

function buildHtml(dataSheets) {
  const tables = dataSheets
    .map((s) => {
      const rows = s.rows || [];
      const cols = rows.length ? Object.keys(rows[0]) : [];
      const body = rows
        .map(
          (r, i) =>
            `<tr class="${i % 2 ? "alt" : ""}">${cols
              .map((c) => {
                const rating = /rating|avg/i.test(c) ? ratingOf(r[c]) : null;
                const cls = rating === null ? "" : rating >= 4 ? "hi" : rating >= 3 ? "mid" : "low";
                return `<td class="${cls}">${r[c] ?? ""}</td>`;
              })
              .join("")}</tr>`,
        )
        .join("");
      return `<h2>${s.sheetName}</h2><table><thead><tr>${cols.map((c) => `<th>${c}</th>`).join("")}</tr></thead><tbody>${body}</tbody></table>`;
    })
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>Curefoods Ratings Report</title><style>
body{font-family:Helvetica,Arial,sans-serif;color:#132664;padding:24px}
h1{font-size:20px;letter-spacing:1px}h2{font-size:14px;margin-top:28px}
table{border-collapse:collapse;width:100%;font-size:12px}
th{position:sticky;top:0;background:#132664;color:#fff;padding:8px;text-align:left}
td{padding:7px 8px;border-bottom:1px solid rgba(19,38,100,.1)}
tr.alt td{background:#f9fafc}
td.hi{background:#132664;color:#fff;font-weight:700}
td.mid{background:#aebbde}td.low{background:#e4e8f5}
</style></head><body><h1>CUREFOODS RATINGS REPORT</h1><div>${new Date().toLocaleString()}</div>${tables}</body></html>`;
}

async function buildPdf(dataSheets) {
  const [{ default: jsPDF }, autoTableMod] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const autoTable = autoTableMod.default || autoTableMod.autoTable;
  const wide = dataSheets.some((s) => /matrix/i.test(s.sheetName) || Object.keys(s.rows?.[0] || {}).length > 6);
  const doc = new jsPDF({ orientation: wide ? "landscape" : "portrait" });
  dataSheets.forEach((s, i) => {
    if (i > 0) doc.addPage();
    doc.setTextColor(19, 38, 100);
    doc.setFontSize(14);
    doc.text("CUREFOODS RATINGS REPORT", 14, 14);
    doc.setFontSize(8);
    doc.text(`${s.sheetName} · ${new Date().toLocaleString()}`, 14, 20);
    const rows = s.rows || [];
    const cols = rows.length ? Object.keys(rows[0]) : [];
    const fontSize = Math.max(4.5, Math.min(7, 42 / Math.max(cols.length, 1)));
    autoTable(doc, {
      startY: 25,
      head: [cols],
      body: rows.map((r) => cols.map((c) => (r[c] ?? "") + "")),
      styles: { fontSize, cellPadding: 1.5, textColor: [19, 38, 100] },
      headStyles: { fillColor: [19, 38, 100], textColor: [255, 255, 255], fontSize },
      didParseCell: (d) => {
        if (d.section !== "body") return;
        const rating = ratingOf(d.cell.raw);
        if (rating === null) return;
        if (rating >= 4) {
          d.cell.styles.fillColor = [19, 38, 100];
          d.cell.styles.textColor = [255, 255, 255];
        } else if (rating >= 3) {
          d.cell.styles.fillColor = [174, 187, 222];
        } else {
          d.cell.styles.fillColor = [228, 232, 245];
        }
      },
    });
  });
  return doc.output("blob");
}

export default function DownloadDialog({ dataSheets = [], onClose }) {
  const [format, setFormat] = useState("XLSX");
  const [destination, setDestination] = useState("device");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState(null);

  const totalRows = dataSheets.reduce((a, s) => a + (s.rows?.length || 0), 0);
  const fileName = `curefoods-ratings-${new Date().toISOString().slice(0, 10)}`;

  const buildFile = async () => {
    if (format === "XLSX") {
      const out = XLSX.write(buildWorkbook(dataSheets), { bookType: "xlsx", type: "array" });
      return { blob: new Blob([out], { type: "application/octet-stream" }), name: `${fileName}.xlsx` };
    }
    if (format === "CSV") {
      const first = dataSheets[0];
      const ws = XLSX.utils.json_to_sheet(first?.rows || []);
      return { blob: new Blob([XLSX.utils.sheet_to_csv(ws)], { type: "text/csv" }), name: `${fileName}.csv` };
    }
    if (format === "HTML") {
      return { blob: new Blob([buildHtml(dataSheets)], { type: "text/html" }), name: `${fileName}.html` };
    }
    return { blob: await buildPdf(dataSheets), name: `${fileName}.pdf` };
  };

  const run = async () => {
    setStatus({ kind: "loading", msg: destination === "email" ? "Sending report..." : "Preparing file..." });
    try {
      const { blob, name } = await buildFile();
      if (destination === "device") {
        saveBlob(blob, name);
        setStatus({ kind: "success", msg: `${name} downloaded.` });
        return;
      }
      if (!/.+@.+\..+/.test(email)) {
        setStatus({ kind: "error", msg: "Enter a valid email address." });
        return;
      }
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      await sendReportEmail({
        email,
        subject: "Curefoods Ratings Report",
        body: "Your requested ratings report is attached.",
        fileName: name,
        fileBase64: base64,
      });
      setStatus({ kind: "success", msg: `Report sent to ${email}.` });
    } catch (e) {
      setStatus({ kind: "error", msg: e.message || "Export failed." });
    }
  };

  const statusStyle =
    status?.kind === "success"
      ? { backgroundColor: "#dcfce7", color: "#15803d" }
      : status?.kind === "error"
        ? { backgroundColor: "#fee2e2", color: "#b91c1c" }
        : { backgroundColor: "#f1f5f9", color: "#475569" };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(19,38,100,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 2000,
        fontFamily: FONT,
      }}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={{ width: 380, backgroundColor: "#ffffff", borderRadius: 12, padding: 24, boxShadow: "0 4px 20px rgba(19,38,100,0.15)" }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: C.primary }}>Download Report</div>
        <div style={{ fontSize: 11.5, color: C.muted, marginTop: 4 }}>
          {dataSheets.length} sheet{dataSheets.length === 1 ? "" : "s"} · {totalRows.toLocaleString()} rows ready for export.
        </div>

        <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", color: C.muted, margin: "16px 0 6px" }}>
          Format
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {FORMATS.map((f) => (
            <button key={f} style={toggleStyle(format === f)} onClick={() => setFormat(f)}>
              {f}
            </button>
          ))}
        </div>

        <div style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", color: C.muted, margin: "16px 0 6px" }}>
          Destination
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button style={toggleStyle(destination === "device")} onClick={() => setDestination("device")}>
            Device
          </button>
          <button style={toggleStyle(destination === "email")} onClick={() => setDestination("email")}>
            Email
          </button>
        </div>

        {destination === "email" && (
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ops@curefoods.com"
            style={{
              width: "100%",
              boxSizing: "border-box",
              marginTop: 12,
              padding: "9px 11px",
              borderRadius: 8,
              border: `1px solid ${C.border}`,
              fontSize: 12.5,
              color: C.text,
              fontFamily: FONT,
              outline: "none",
            }}
          />
        )}

        {status && (
          <div style={{ ...statusStyle, marginTop: 14, padding: "9px 12px", borderRadius: 8, fontSize: 11.5, fontWeight: 700 }}>
            {status.msg}
          </div>
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
          <button
            onClick={onClose}
            style={{ ...toggleStyle(false), padding: "10px 0" }}
          >
            Cancel
          </button>
          <button
            onClick={run}
            style={{ ...toggleStyle(true), padding: "10px 0" }}
          >
            {destination === "email" ? "Send" : "Download"} {format}
          </button>
        </div>
      </div>
    </div>
  );
}
