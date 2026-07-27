import { useEffect, useMemo, useState } from "react";
import { C, FONT, cardStyle } from "../../../theme";

const PAGE_SIZE = 25;

export default function GenericTableInsight({
  title,
  data,
  columns,
  searchField,
  onClose,
  onRegisterDownload,
  sheetName,
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState({ key: null, dir: "asc" });
  const [page, setPage] = useState(1);

  const rows = Array.isArray(data) ? data : [];

  const filtered = useMemo(() => {
    if (!query || !searchField) return rows;
    return rows.filter((r) => String(r[searchField] ?? "").toLowerCase().includes(query.toLowerCase()));
  }, [rows, query, searchField]);

  const sorted = useMemo(() => {
    if (!sort.key) return filtered;
    const copy = [...filtered];
    copy.sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      const an = typeof av === "number" ? av : parseFloat(av);
      const bn = typeof bv === "number" ? bv : parseFloat(bv);
      const cmp =
        !Number.isNaN(an) && !Number.isNaN(bn)
          ? an - bn
          : String(av ?? "").localeCompare(String(bv ?? ""));
      return sort.dir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [filtered, sort]);

  useEffect(() => setPage(1), [query, sort.key, sort.dir, rows.length]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const start = (page - 1) * PAGE_SIZE;
  const pageRows = sorted.slice(start, start + PAGE_SIZE);

  useEffect(() => {
    if (!onRegisterDownload) return;
    onRegisterDownload(() => [
      {
        sheetName: (sheetName || title || "Report").slice(0, 28),
        rows: sorted.map((r) => {
          const out = {};
          columns.forEach((c) => {
            out[c.header] = r[c.key];
          });
          return out;
        }),
      },
    ]);
  }, [sorted, columns, title, sheetName, onRegisterDownload]);

  const indicator = (key) => (sort.key !== key ? "↕" : sort.dir === "asc" ? "▲" : "▼");

  return (
    <div style={cardStyle}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: C.primary }}>{title}</div>
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Close insight"
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 15, color: C.muted, fontFamily: FONT }}
          >
            ✕
          </button>
        )}
      </div>

      {searchField && rows.length > 5 && (
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search..."
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: `1px solid ${C.border}`,
            fontSize: 12,
            color: C.text,
            fontFamily: FONT,
            outline: "none",
            marginBottom: 12,
            width: 260,
            maxWidth: "100%",
          }}
        />
      )}

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ backgroundColor: C.headerBg }}>
              {columns.map((col) => (
                <th
                  key={col.key + col.header}
                  onClick={() => setSort((s) => ({ key: col.key, dir: s.key === col.key && s.dir === "asc" ? "desc" : "asc" }))}
                  style={{
                    textAlign: "left",
                    padding: "11px 12px",
                    fontWeight: 800,
                    color: C.primary,
                    borderBottom: `2.5px solid rgba(19,38,100,0.2)`,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    fontSize: 11.5,
                  }}
                >
                  {col.header} <span style={{ opacity: 0.55 }}>{indicator(col.key)}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, i) => (
              <tr key={i} style={{ backgroundColor: i % 2 === 0 ? "#ffffff" : C.rowAlt }}>
                {columns.map((col) => (
                  <td
                    key={col.key + col.header}
                    style={{
                      padding: "10px 12px",
                      borderBottom: `1px solid ${C.borderSoft}`,
                      fontWeight: col.bold ? 800 : 500,
                      color: C.text,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {col.render ? col.render(row[col.key], row) : (row[col.key] ?? "-")}
                  </td>
                ))}
              </tr>
            ))}
            {pageRows.length === 0 && (
              <tr>
                <td colSpan={columns.length} style={{ padding: 20, textAlign: "center", color: C.muted }}>
                  No records match this view.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 14, gap: 12, flexWrap: "wrap" }}>
        <div style={{ fontSize: 11.5, color: C.muted, fontWeight: 600 }}>
          Showing records {sorted.length === 0 ? 0 : start + 1}-{Math.min(start + PAGE_SIZE, sorted.length)} of {sorted.length}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            disabled={page === 1}
            onClick={() => setPage((p) => p - 1)}
            style={pagerStyle(page === 1)}
          >
            Prev
          </button>
          <span style={{ fontSize: 11.5, color: C.muted, fontWeight: 700 }}>
            {page} / {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            style={pagerStyle(page >= totalPages)}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

const pagerStyle = (disabled) => ({
  padding: "6px 14px",
  borderRadius: 8,
  border: `1.5px solid ${C.primary}`,
  backgroundColor: "#ffffff",
  color: C.primary,
  fontSize: 11.5,
  fontWeight: 700,
  cursor: disabled ? "not-allowed" : "pointer",
  opacity: disabled ? 0.4 : 1,
  fontFamily: FONT,
});
