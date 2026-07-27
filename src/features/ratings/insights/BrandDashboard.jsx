import { useEffect, useMemo, useState } from "react";
import { C, cardStyle } from "../../../theme";

const ZONE_ABBR = { North: "N", South: "S", East: "E", West: "W" };
const PAGE = 100;

export default function BrandDashboard({ reviews = [], onClose, allBrands = [], masterData = [], onRegisterDownload }) {
  const [page, setPage] = useState(1);

  const rows = useMemo(() => {
    const orderMap = new Map();
    reviews.forEach((r) => {
      const key = `${r.order_id}::${r.brand_name}`;
      if (!orderMap.has(key)) orderMap.set(key, { brand: r.brand_name, ratings: [], hasComment: false });
      const g = orderMap.get(key);
      if (r.restaurant_rating) g.ratings.push(Number(r.restaurant_rating));
      if (r.comments) g.hasComment = true;
    });
    const brands = new Map();
    orderMap.forEach((g) => {
      if (!brands.has(g.brand)) brands.set(g.brand, { ordersCount: 0, feedbacksCount: 0, ratings: [], above: 0, below: 0 });
      const b = brands.get(g.brand);
      b.ordersCount++;
      if (g.hasComment) b.feedbacksCount++;
      if (g.ratings.length) {
        const avg = g.ratings.reduce((x, y) => x + y, 0) / g.ratings.length;
        b.ratings.push(avg);
        if (avg >= 4) b.above++;
        else b.below++;
      }
    });
    const meta = new Map();
    masterData.forEach((m) => {
      if (!meta.has(m.brand)) meta.set(m.brand, { zones: new Set(), cities: new Set(), areas: new Set(), outlets: 0 });
      const x = meta.get(m.brand);
      x.zones.add(m.zone);
      x.cities.add(m.city);
      x.areas.add(m.area);
      x.outlets++;
    });
    const names = [...new Set([...allBrands, ...brands.keys()])];
    const out = names.map((name) => {
      const b = brands.get(name);
      const mt = meta.get(name) || { zones: new Set(), cities: new Set(), areas: new Set(), outlets: 0 };
      const avg = b && b.ratings.length ? b.ratings.reduce((x, y) => x + y, 0) / b.ratings.length : null;
      return {
        brand: name,
        avg,
        zones: [...mt.zones].map((z) => ZONE_ABBR[z] || z).join(", ") || "-",
        cities: mt.cities.size,
        areas: mt.areas.size,
        outlets: mt.outlets,
        orders: b?.ordersCount || 0,
        feedbacks: b?.feedbacksCount || 0,
        above: b?.above || 0,
        below: b?.below || 0,
      };
    });
    const rated = out.filter((r) => r.avg !== null).sort((a, b) => b.avg - a.avg);
    const unrated = out.filter((r) => r.avg === null).sort((a, b) => a.brand.localeCompare(b.brand));
    return [...rated, ...unrated];
  }, [reviews, allBrands, masterData]);

  const totals = useMemo(
    () =>
      rows.reduce(
        (a, r) => ({
          outlets: a.outlets + r.outlets,
          orders: a.orders + r.orders,
          feedbacks: a.feedbacks + r.feedbacks,
          above: a.above + r.above,
          below: a.below + r.below,
        }),
        { outlets: 0, orders: 0, feedbacks: 0, above: 0, below: 0 },
      ),
    [rows],
  );

  useEffect(() => {
    if (!onRegisterDownload) return;
    onRegisterDownload(() => [
      {
        sheetName: "Brand Summary",
        rows: rows.map((r) => ({
          Brand: r.brand,
          Rating: r.avg === null ? "-" : r.avg.toFixed(2),
          Zones: r.zones,
          Cities: r.cities,
          Areas: r.areas,
          Outlets: r.outlets,
          Orders: r.orders,
          Feedbacks: r.feedbacks,
          "Above 4★": r.above,
          "Below 4★": r.below,
        })),
      },
    ]);
  }, [rows, onRegisterDownload]);

  const pageRows = rows.slice((page - 1) * PAGE, page * PAGE);
  const th = {
    backgroundColor: C.headerBg,
    padding: "10px 12px",
    textAlign: "left",
    fontWeight: 800,
    fontSize: 11.5,
    color: C.primary,
    position: "sticky",
    top: 0,
    zIndex: 10,
    borderBottom: `2.5px solid rgba(19,38,100,0.2)`,
    whiteSpace: "nowrap",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.primary }}>Brand Ratings</div>
          {onClose && (
            <button onClick={onClose} style={{ border: "none", background: "none", cursor: "pointer", color: C.muted }}>
              ✕
            </button>
          )}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 12 }}>
          {pageRows.map((r) => (
            <div key={r.brand} style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: C.primary, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {r.brand}
              </div>
              <div style={{ fontSize: 13, fontWeight: 800, color: C.primary, marginTop: 6 }}>
                ★ {r.avg === null ? "—" : r.avg.toFixed(2)}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={cardStyle}>
        <div style={{ fontSize: 14, fontWeight: 800, color: C.primary, marginBottom: 12 }}>Brand Summary</div>
        <div style={{ maxHeight: 400, overflow: "auto" }}>
          <table style={{ borderCollapse: "collapse", fontSize: 11.5, width: "100%" }}>
            <thead>
              <tr>
                <th style={{ ...th, position: "sticky", left: 0, zIndex: 20, borderRight: `2.5px solid rgba(19,38,100,0.2)` }}>Brand</th>
                {["Rating", "Zones", "Cities", "Areas", "Outlets", "Orders", "Feedbacks", "Above 4★", "Below 4★"].map((h) => (
                  <th key={h} style={th}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((r, i) => {
                const bg = i % 2 === 0 ? "#ffffff" : "#f7f8fc";
                return (
                  <tr key={r.brand} style={{ backgroundColor: bg }}>
                    <td style={{ padding: "9px 12px", fontWeight: 800, color: C.primary, position: "sticky", left: 0, zIndex: 9, backgroundColor: bg, borderRight: `2.5px solid rgba(19,38,100,0.2)`, whiteSpace: "nowrap" }}>
                      {r.brand}
                    </td>
                    {[r.avg === null ? "—" : r.avg.toFixed(2), r.zones, r.cities, r.areas, r.outlets, r.orders, r.feedbacks, r.above, r.below].map((v, vi) => (
                      <td key={vi} style={{ padding: "9px 12px", color: C.text, borderBottom: `1px solid ${C.borderSoft}` }}>
                        {v}
                      </td>
                    ))}
                  </tr>
                );
              })}
              <tr style={{ backgroundColor: "#e8ebf5", fontWeight: 800 }}>
                <td style={{ padding: "10px 12px", position: "sticky", left: 0, zIndex: 9, backgroundColor: "#e8ebf5", borderRight: `2.5px solid rgba(19,38,100,0.2)`, color: C.primary }}>
                  Grand Total
                </td>
                <td style={{ padding: "10px 12px", color: C.primary }}>—</td>
                <td style={{ padding: "10px 12px", color: C.primary }}>—</td>
                <td style={{ padding: "10px 12px", color: C.primary }}>—</td>
                <td style={{ padding: "10px 12px", color: C.primary }}>—</td>
                <td style={{ padding: "10px 12px", color: C.primary }}>{totals.outlets}</td>
                <td style={{ padding: "10px 12px", color: C.primary }}>{totals.orders}</td>
                <td style={{ padding: "10px 12px", color: C.primary }}>{totals.feedbacks}</td>
                <td style={{ padding: "10px 12px", color: C.primary }}>{totals.above}</td>
                <td style={{ padding: "10px 12px", color: C.primary }}>{totals.below}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
