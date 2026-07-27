import { useEffect, useState } from "react";
import { C, cardStyle, FONT } from "../../../theme";

const FIELDS = [
  ["review_id", "Review ID"],
  ["outlet_id", "Outlet ID"],
  ["restaurant_id", "Restaurant ID"],
  ["brand_name", "Brand Name"],
  ["business_entity", "Business Entity"],
  ["city", "City"],
  ["area", "Area"],
  ["zone", "Zone"],
  ["order_id", "Order ID"],
  ["date", "Date"],
  ["ordered_time", "Ordered Time"],
  ["gmv_total", "GMV Total"],
  ["item_name", "Item Name"],
  ["comments", "Comments"],
  ["restaurant_rating", "Rating"],
  ["post_status", "Post Status"],
  ["updated_at", "Updated At"],
];

const fmt = (key, val) => {
  if (val === null || val === undefined || val === "") return "-";
  if (key === "ordered_time" || key === "updated_at") return new Date(val).toLocaleString();
  if (key === "gmv_total") return Number(val).toFixed(2);
  if (key === "restaurant_rating") return `${val}★`;
  return val;
};

const PAGE_SIZE = 100;

export default function CommentsInsight({ reviews = [], onClose, onRegisterDownload }) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(reviews.length / PAGE_SIZE));
  const start = (page - 1) * PAGE_SIZE;
  const pageRows = reviews.slice(start, start + PAGE_SIZE);

  useEffect(() => {
    if (!onRegisterDownload) return;
    onRegisterDownload(() => [
      {
        sheetName: "Comments",
        rows: reviews.map((r) => {
          const out = {};
          FIELDS.forEach(([k, h]) => {
            out[h] = r[k] ?? "";
          });
          return out;
        }),
      },
    ]);
  }, [reviews, onRegisterDownload]);

  return (
    <div style={{ ...cardStyle, overflowX: "auto", fontFamily: FONT }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: C.primary }}>
          Comments Insight <span style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>({reviews.length} reviews)</span>
        </div>
        {onClose && (
          <button onClick={onClose} style={{ border: "none", background: "none", cursor: "pointer", color: C.muted, fontSize: 15 }}>
            ✕
          </button>
        )}
      </div>

      <div style={{ maxHeight: 600, overflow: "auto", border: `1px solid ${C.border}`, borderRadius: 8 }}>
        <table style={{ borderCollapse: "collapse", fontSize: 11.5, minWidth: 1800 }}>
          <thead>
            <tr>
              {FIELDS.map(([key, header], i) => (
                <th
                  key={key}
                  style={{
                    backgroundColor: C.primary,
                    color: "#ffffff",
                    padding: "10px 12px",
                    textAlign: "left",
                    fontWeight: 800,
                    whiteSpace: "nowrap",
                    position: "sticky",
                    top: 0,
                    left: i === 0 ? 0 : undefined,
                    zIndex: i === 0 ? 12 : 10,
                  }}
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((r, i) => (
              <tr key={r.review_id || i} style={{ backgroundColor: i % 2 === 0 ? "#ffffff" : C.rowAlt }}>
                {FIELDS.map(([key], ci) => (
                  <td
                    key={key}
                    style={{
                      padding: "9px 12px",
                      borderBottom: `1px solid ${C.borderSoft}`,
                      color: C.text,
                      whiteSpace: key === "comments" ? "pre-wrap" : "nowrap",
                      minWidth: key === "comments" ? 260 : undefined,
                      position: ci === 0 ? "sticky" : undefined,
                      left: ci === 0 ? 0 : undefined,
                      zIndex: ci === 0 ? 9 : undefined,
                      backgroundColor: ci === 0 ? (i % 2 === 0 ? "#ffffff" : "#f7f8fc") : undefined,
                      borderRight: ci === 0 ? `2.5px solid rgba(19,38,100,0.2)` : undefined,
                      fontWeight: ci === 0 ? 800 : 500,
                    }}
                  >
                    {fmt(key, r[key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
        <div style={{ fontSize: 11.5, color: C.muted, fontWeight: 600 }}>
          Showing records {reviews.length ? start + 1 : 0}-{Math.min(start + PAGE_SIZE, reviews.length)} of {reviews.length}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} style={pager(page === 1)}>
            Prev
          </button>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: C.muted }}>
            {page} / {totalPages}
          </span>
          <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} style={pager(page >= totalPages)}>
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

const pager = (disabled) => ({
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
