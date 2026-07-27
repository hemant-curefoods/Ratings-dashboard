import { useEffect, useMemo } from "react";
import { C, cardStyle } from "../../../theme";

const ZONE_ORDER = { North: 1, South: 2, East: 3, West: 4 };

const cellStyle = (avg) => {
  if (avg === null || avg === undefined) return { backgroundColor: "transparent", color: C.primary };
  if (avg >= 4) return { backgroundColor: "#132664", color: "#ffffff" };
  if (avg >= 3) return { backgroundColor: "rgba(19, 38, 100, 0.45)", color: C.primary };
  return { backgroundColor: "rgba(19, 38, 100, 0.12)", color: C.primary };
};

export default function LocationMatrixAndSummary({
  reviews = [],
  locationKey,
  locationTitle,
  onClose,
  masterData = [],
  onRegisterDownload,
}) {
  const { locations, matrix, summary } = useMemo(() => {
    const orders = new Map();
    reviews.forEach((r) => {
      const loc = r[locationKey];
      const key = `${r.order_id}::${loc}::${r.brand_name}`;
      if (!orders.has(key)) orders.set(key, { loc, brand: r.brand_name, ratings: [], hasComment: false });
      const g = orders.get(key);
      if (r.restaurant_rating) g.ratings.push(Number(r.restaurant_rating));
      if (r.comments) g.hasComment = true;
    });

    const matrixMap = new Map();
    const summaryMap = new Map();
    orders.forEach((g) => {
      const avg = g.ratings.length ? g.ratings.reduce((x, y) => x + y, 0) / g.ratings.length : null;
      if (!matrixMap.has(g.loc)) matrixMap.set(g.loc, new Map());
      const brands = matrixMap.get(g.loc);
      if (!brands.has(g.brand)) brands.set(g.brand, { sum: 0, count: 0 });
      if (avg !== null) {
        const cell = brands.get(g.brand);
        cell.sum += avg;
        cell.count++;
      }
      const sk = `${g.loc}|||${g.brand}`;
      if (!summaryMap.has(sk)) summaryMap.set(sk, { loc: g.loc, brand: g.brand, ratings: [], orders: 0, feedbacks: 0 });
      const s = summaryMap.get(sk);
      s.orders++;
      if (g.hasComment) s.feedbacks++;
      if (avg !== null) s.ratings.push(avg);
    });

    const geo = new Map();
    masterData.forEach((m) => {
      const k = `${m[locationKey]}|||${m.brand}`;
      if (!geo.has(k)) geo.set(k, { cities: new Set(), areas: new Set(), outlets: 0 });
      const x = geo.get(k);
      x.cities.add(m.city);
      x.areas.add(m.area);
      x.outlets++;
    });

    const locs = [...matrixMap.entries()]
      .map(([name, brands]) => {
        const cells = [...brands.entries()].map(([brand, v]) => ({ brand, avg: v.count ? v.sum / v.count : null }));
        const rated = cells.filter((c) => c.avg !== null);
        return {
          name,
          cells,
          avg: rated.length ? rated.reduce((a, c) => a + c.avg, 0) / rated.length : null,
          outlets: masterData.filter((m) => m[locationKey] === name).length,
        };
      })
      .sort((a, b) => (b.avg || 0) - (a.avg || 0));

    const summaryRows = [...summaryMap.values()]
      .map((s) => {
        const g = geo.get(`${s.loc}|||${s.brand}`) || { cities: new Set(), areas: new Set(), outlets: 0 };
        const avg = s.ratings.length ? s.ratings.reduce((x, y) => x + y, 0) / s.ratings.length : null;
        return {
          loc: s.loc,
          brand: s.brand,
          avg,
          cities: g.cities.size,
          areas: g.areas.size,
          outlets: g.outlets,
          orders: s.orders,
          feedbacks: s.feedbacks,
          above: s.ratings.filter((r) => r >= 4).length,
          below: s.ratings.filter((r) => r < 4).length,
        };
      })
      .sort((a, b) => {
        const la = locationKey === "zone" ? (ZONE_ORDER[a.loc] || 9) - (ZONE_ORDER[b.loc] || 9) : a.loc.localeCompare(b.loc);
        return la !== 0 ? la : a.brand.localeCompare(b.brand);
      });

    return { locations: locs, matrix: matrixMap, summary: summaryRows };
  }, [reviews, locationKey, masterData]);

  useEffect(() => {
    if (!onRegisterDownload) return;
    onRegisterDownload(() => [
      {
        sheetName: `${locationTitle} Matrix`,
        rows: locations.map((l) => {
          const row = { [locationTitle]: l.name };
          l.cells.forEach((c) => {
            row[c.brand] = c.avg === null ? "" : Number(c.avg.toFixed(2));
          });
          row["Location Avg"] = l.avg === null ? "" : Number(l.avg.toFixed(2));
          return row;
        }),
      },
      {
        sheetName: `${locationTitle} Summary`,
        rows: summary.map((s) => ({
          [locationTitle]: s.loc,
          Brand: s.brand,
          Rating: s.avg === null ? "-" : s.avg.toFixed(2),
          Cities: s.cities,
          Areas: s.areas,
          Outlets: s.outlets,
          Orders: s.orders,
          Feedbacks: s.feedbacks,
          "Above 4★": s.above,
          "Below 4★": s.below,
        })),
      },
    ]);
  }, [locations, summary, locationTitle, onRegisterDownload]);

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
  const headers = ["Brand", "Rating"]
    .concat(locationKey !== "city" ? ["Cities"] : [])
    .concat(locationKey !== "area" ? ["Areas"] : [])
    .concat(["Outlets", "Orders", "Feedbacks", "Above 4★", "Below 4★"]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ ...cardStyle, padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.primary }}>{locationTitle} × Brand Ratings</div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            {[
              ["≥ 4.0", 4.2],
              ["3.0 – 3.9", 3.4],
              ["≤ 2.9", 2.4],
            ].map(([label, v]) => (
              <span key={label} style={{ fontSize: 10, fontWeight: 700, padding: "4px 10px", borderRadius: 20, ...cellStyle(v) }}>
                {label}
              </span>
            ))}
            {onClose && (
              <button onClick={onClose} style={{ border: "none", background: "none", cursor: "pointer", color: C.muted }}>
                ✕
              </button>
            )}
          </div>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))",
            gap: 12,
            maxHeight: 540,
            overflowY: "auto",
            marginTop: 16,
          }}
        >
          {locations.slice(0, 100).map((l) => (
            <div key={l.name} style={{ border: "1px solid rgba(19,38,100,0.12)", borderRadius: 12, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: C.primary }}>{l.name}</span>
                <span style={{ fontSize: 10.5, color: C.muted }}>{l.outlets} active outlets</span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                {l.cells.map((c) => (
                  <span key={c.brand} style={{ padding: "4px 10px", borderRadius: 20, fontSize: 10, fontWeight: 700, ...cellStyle(c.avg) }}>
                    {c.brand} {c.avg === null ? "—" : c.avg.toFixed(1)}
                  </span>
                ))}
              </div>
              <div style={{ marginTop: 12, paddingTop: 8, borderTop: "1px dashed rgba(19,38,100,0.2)", fontSize: 11, fontWeight: 700, color: C.primary }}>
                Location Avg: {l.avg === null ? "—" : l.avg.toFixed(2)}★
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={cardStyle}>
        <div style={{ fontSize: 14, fontWeight: 800, color: C.primary, marginBottom: 12 }}>{locationTitle} Summary</div>
        <div style={{ maxHeight: 400, overflow: "auto" }}>
          <table style={{ borderCollapse: "collapse", fontSize: 11.5, width: "100%" }}>
            <thead>
              <tr>
                <th style={{ ...th, position: "sticky", left: 0, zIndex: 20, borderRight: `2.5px solid rgba(19,38,100,0.2)` }}>{locationTitle}</th>
                {headers.map((h) => (
                  <th key={h} style={th}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {summary.slice(0, 100).map((s, i) => {
                const bg = i % 2 === 0 ? "#ffffff" : "#f7f8fc";
                const values = [s.brand, s.avg === null ? "—" : s.avg.toFixed(2)]
                  .concat(locationKey !== "city" ? [s.cities] : [])
                  .concat(locationKey !== "area" ? [s.areas] : [])
                  .concat([s.outlets, s.orders, s.feedbacks, s.above, s.below]);
                return (
                  <tr key={`${s.loc}-${s.brand}`} style={{ backgroundColor: bg }}>
                    <td style={{ padding: "9px 12px", fontWeight: 800, color: C.primary, position: "sticky", left: 0, zIndex: 9, backgroundColor: bg, borderRight: `2.5px solid rgba(19,38,100,0.2)`, whiteSpace: "nowrap" }}>
                      {s.loc}
                    </td>
                    {values.map((v, vi) => (
                      <td key={vi} style={{ padding: "9px 12px", color: C.text, borderBottom: `1px solid ${C.borderSoft}` }}>
                        {v}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
