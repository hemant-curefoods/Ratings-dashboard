import InsightSummaryPanel from "./insights/InsightSummaryPanel";
import GenericTableInsight from "./insights/GenericTableInsight";
import BrandDashboard from "./insights/BrandDashboard";
import LocationMatrixAndSummary from "./insights/LocationMatrixAndSummary";
import CommentsInsight from "./insights/CommentsInsight";
import TextAIInsight from "./insights/TextAIInsight";

// Column keys MUST match the exact field names the backend returns
// (server/ratings/insights.routes.js). The backend uses { name, avg, count }
// for grouped "overall" results, plus insight-specific camelCase keys.
const COLS = {
  6: [{ header: "Item Name", key: "name", bold: true }, { header: "Average Rating", key: "avg" }, { header: "Total Reviews", key: "count" }],
  7: [{ header: "Item Name", key: "name", bold: true }, { header: "Average Rating", key: "avg" }, { header: "Total Reviews", key: "count" }],
  8: [{ header: "Item Name", key: "name", bold: true }, { header: "Total Reviews", key: "count" }, { header: "Average Rating", key: "avg" }],
  10: [{ header: "Kitchen Area", key: "name", bold: true }, { header: "Average Rating", key: "avg" }, { header: "Total Reviews", key: "count" }],
  9: [{ header: "Product Category", key: "name", bold: true }, { header: "Average Rating", key: "avg" }, { header: "Total Reviews", key: "count" }],
  11: [{ header: "Star Rating", key: "name", bold: true }, { header: "Count of Reviews", key: "count" }, { header: "Percentage", key: "pct", render: (v) => `${v}%` }],
  12: [{ header: "Month", key: "name", bold: true }, { header: "Average Rating", key: "avg" }],
  14: [{ header: "Day Category", key: "name", bold: true }, { header: "Average Rating", key: "avg" }, { header: "Total Reviews", key: "count" }],
  15: [{ header: "Hour of Day", key: "name", bold: true }, { header: "Complaint Count (≤2★)", key: "count" }, { header: "Peak Status", key: "worst", render: (v) => (v ? "🔴 Peak" : "Normal") }],
  23: [{ header: "Daypart Slot", key: "name", bold: true }, { header: "Average Rating", key: "avg" }, { header: "Total Reviews", key: "count" }],
  26: [{ header: "City", key: "city", bold: true }, { header: "Best Brand", key: "bestBrand" }, { header: "Best Avg", key: "bestAvg" }, { header: "Worst Brand", key: "worstBrand" }, { header: "Worst Avg", key: "worstAvg" }],
  27: [{ header: "Outlet ID", key: "outletId", bold: true }, { header: "Area", key: "area" }, { header: "Brand", key: "brand" }, { header: "Outlet Avg", key: "outletAvg" }, { header: "Kitchen Avg", key: "kitchenAvg" }, { header: "Rating Gap", key: "gap" }, { header: "Status", key: "status" }],
  28: [{ header: "Outlet ID", key: "outletId", bold: true }, { header: "Outlet Name (Area)", key: "name" }, { header: "Best Item", key: "bestItem" }, { header: "Item Rating", key: "rating" }, { header: "Reviews Count", key: "count" }],
  29: [{ header: "Item Name", key: "name", bold: true }, { header: "Average Rating", key: "avg" }, { header: "Reviews Count", key: "count" }, { header: "Std Dev (Variance)", key: "stddev" }, { header: "Consistency", key: "status" }],
  30: [{ header: "Item Name", key: "item", bold: true }, { header: "City", key: "city" }, { header: "Average Rating", key: "avg" }, { header: "Reviews Count", key: "count" }],
  31: [{ header: "Item Name", key: "item", bold: true }, { header: "Month", key: "month" }, { header: "Average Rating", key: "avg" }, { header: "Reviews Count", key: "count" }],
  32: [{ header: "Item Name", key: "name", bold: true }, { header: "Item Average", key: "avg" }, { header: "Company Average", key: "companyAvg" }, { header: "Rating Gap", key: "gap" }, { header: "Performance Status", key: "status" }],
  17: [{ header: "Fault Responsibility", key: "cause", bold: true }, { header: "Classified Complaints", key: "count" }, { header: "Percentage", key: "percentage", render: (v) => `${v}%` }],
};

// Breakdown tables have a different row shape than the "overall" table — keys
// must match the per-dimension objects the backend emits in data.breakdown.
const BREAKDOWN_METRICS = {
  6: [{ header: "Top Rated Item", key: "topItem" }, { header: "Avg Rating", key: "topAvg" }, { header: "Reviews", key: "topCount" }],
  7: [{ header: "Worst Rated Item", key: "worstItem" }, { header: "Avg Rating", key: "worstAvg" }, { header: "Reviews", key: "worstCount" }],
  8: [{ header: "Best Selling Item", key: "topItem" }, { header: "Total Orders", key: "topCount" }, { header: "Avg Rating", key: "topAvg" }],
  9: [{ header: "Average Rating", key: "avg" }, { header: "Total Reviews", key: "count" }],
  10: [{ header: "Average Rating", key: "avg" }, { header: "Total Reviews", key: "count" }],
  11: [{ header: "Weighted Avg", key: "weightedAvg" }, { header: "Promoter %", key: "promoterPct", render: (v) => `${v}%` }, { header: "Detractor %", key: "detractorPct", render: (v) => `${v}%` }, { header: "Total", key: "total" }],
  12: [{ header: "Avg Rating", key: "avgRating" }, { header: "Trend", key: "trend" }, { header: "Best Month", key: "bestMonth" }, { header: "Worst Month", key: "worstMonth" }],
  14: [{ header: "Weekday Avg", key: "weekdayAvg" }, { header: "Weekday Reviews", key: "weekdayCount" }, { header: "Weekend Avg", key: "weekendAvg" }, { header: "Weekend Reviews", key: "weekendCount" }, { header: "Delta", key: "delta" }],
  15: [{ header: "Total Complaints", key: "totalComplaints" }, { header: "Peak Hour", key: "peakHour" }, { header: "Peak Count", key: "peakCount" }],
  23: [{ header: "Overall Avg", key: "overallAvg" }, { header: "Best Daypart", key: "bestDaypart" }, { header: "Best Avg", key: "bestAvg" }, { header: "Worst Daypart", key: "worstDaypart" }, { header: "Worst Avg", key: "worstAvg" }],
};

const BREAKDOWN_IDS = [6, 7, 8, 9, 10, 11, 12, 14, 15, 23];

export default function InsightResult({ insightId, label, data, reviews, allBrands, masterData, filters, onClose, onRegisterDownload }) {
  if (insightId === 21) return <CommentsInsight reviews={Array.isArray(data) ? data : []} onClose={onClose} onRegisterDownload={onRegisterDownload} />;

  if ([16, 18, 19, 20].includes(insightId))
    return <TextAIInsight title={label} textContent={data?.text || data} onClose={onClose} onRegisterDownload={onRegisterDownload} />;

  if ([1, 2, 3, 4].includes(insightId)) {
    const keyMap = { 2: ["zone", "Zone"], 3: ["city", "City"], 4: ["area", "Area"] };
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <InsightSummaryPanel insightId={insightId} data={data} filters={filters} />
        {insightId === 1 ? (
          <BrandDashboard reviews={reviews} allBrands={allBrands} masterData={masterData} onClose={onClose} onRegisterDownload={onRegisterDownload} />
        ) : (
          <LocationMatrixAndSummary
            reviews={reviews}
            locationKey={keyMap[insightId][0]}
            locationTitle={keyMap[insightId][1]}
            masterData={masterData}
            onClose={onClose}
            onRegisterDownload={onRegisterDownload}
          />
        )}
      </div>
    );
  }

  // Insight 17 returns a plain object { delivery, kitchen, packaging, other },
  // not an array — reshape it into rows the generic table can render.
  if (insightId === 17 && data && !Array.isArray(data)) {
    const total = Object.values(data).reduce((a, b) => a + (Number(b) || 0), 0) || 1;
    const rows17 = Object.entries(data).map(([cause, count]) => ({
      cause: cause.charAt(0).toUpperCase() + cause.slice(1),
      count: Number(count) || 0,
      percentage: +(((Number(count) || 0) / total) * 100).toFixed(1),
    }));
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <GenericTableInsight
          title={label}
          data={rows17}
          columns={COLS[17]}
          searchField="cause"
          onClose={onClose}
          onRegisterDownload={onRegisterDownload}
          sheetName={label}
        />
      </div>
    );
  }

  const hasBreakdown =
    BREAKDOWN_IDS.includes(insightId) && data && !Array.isArray(data) && Array.isArray(data.breakdown) && data.breakdown.length > 0;
  const rows = hasBreakdown ? data.breakdown : Array.isArray(data) ? data : data?.overall || [];
  const dims = hasBreakdown ? data.breakdownDims || [] : [];
  const dimCols = dims.map((d, i) => ({ header: d.label, key: d.field, bold: i === 0 }));
  const baseCols = (hasBreakdown ? BREAKDOWN_METRICS[insightId] : null) || COLS[insightId] || [
    { header: "Label", key: "name", bold: true },
    { header: "Average Rating", key: "avg" },
    { header: "Total Reviews", key: "count" },
  ];
  const columns = [...dimCols, ...baseCols];
  const suffix = dims.length ? ` — by ${dims.map((d) => d.label).join(" > ")}` : "";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <InsightSummaryPanel
        insightId={insightId}
        data={Array.isArray(data) ? data : data?.overall || rows}
        filters={filters}
        breakdown={hasBreakdown ? { rows, dims } : null}
      />
      <GenericTableInsight
        title={`${label}${suffix}`}
        data={rows}
        columns={columns}
        searchField={columns[0]?.key}
        onClose={onClose}
        onRegisterDownload={onRegisterDownload}
        sheetName={label}
      />
    </div>
  );
}
