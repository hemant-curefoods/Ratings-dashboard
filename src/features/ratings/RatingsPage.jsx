import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { C, FONT, cardStyle, spinnerStyle } from "../../theme";
import { fetchInsight } from "./ratingsApi";
import InsightResult from "./InsightResult";
import DefaultDashboard from "./insights/DefaultDashboard";
import DownloadDialog from "./insights/DownloadDialog";

export const INSIGHTS = [
  { id: 14, label: "Weekend vs Weekday Ratings", category: "Time" },
  { id: 15, label: "Peak Complaint Hours", category: "Time" },
  { id: 23, label: "Hourly Daypart Split", category: "Time" },
  { id: 12, label: "Monthly Trends Comparison", category: "Time" },
  { id: 2, label: "Zone Level Rating", category: "Location" },
  { id: 3, label: "City Level Rating", category: "Location" },
  { id: 4, label: "Area Level Rating", category: "Location" },
  { id: 26, label: "Best & Worst Brand per City", category: "Location" },
  { id: 27, label: "Outlet vs Kitchen Average Gap", category: "Location" },
  { id: 28, label: "Best Item per Outlet", category: "Location" },
  { id: 6, label: "SKU Leaderboard - Top Rated", category: "SKUs" },
  { id: 7, label: "SKU Leaderboard - Worst Rated (Kill List)", category: "SKUs" },
  { id: 8, label: "High Volume SKUs", category: "SKUs" },
  { id: 10, label: "High Volume, Low Rating items", category: "SKUs" },
  { id: 29, label: "SKU Consistency (Variance)", category: "SKUs" },
  { id: 1, label: "Brand Level Rating", category: "Performance" },
  { id: 9, label: "Category Ratings", category: "Performance" },
  { id: 11, label: "Rating Distribution Stats", category: "Performance" },
  { id: 21, label: "Comments Insight", category: "Performance" },
  { id: 17, label: "AI Department Blame Split", category: "Performance" },
  { id: 16, label: "AI Repeat Complaint Finder", category: "Performance" },
  { id: 18, label: "AI Weekly Operations Brief", category: "Performance" },
  { id: 19, label: "AI Action Items Generator", category: "Performance" },
  { id: 20, label: "AI Packaging Issues Tracker", category: "Performance" },
  { id: 30, label: "Item Rating by City", category: "Item-wise" },
  { id: 31, label: "Item Trend Over Time", category: "Item-wise" },
  { id: 32, label: "Item vs Company Average Gap", category: "Item-wise" },
];

const daysBetween = (from, to) => {
  if (!from || !to) return 0;
  return Math.round((new Date(to) - new Date(from)) / 86400000) + 1;
};

function buildValidation(insightId, f, allBrands) {
  const issues = [];
  const days = daysBetween(f.dateFrom, f.dateTo);
  const timeSet = Boolean(f.timeFrom || f.timeTo);
  const setDays = (n) => ({
    label: `⚡ Set date range to ${n} days`,
    patch: () => {
      const to = new Date();
      to.setDate(to.getDate() - 1);
      const from = new Date(to);
      from.setDate(from.getDate() - (n - 1));
      return { dateFrom: from.toISOString().slice(0, 10), dateTo: to.toISOString().slice(0, 10) };
    },
  });
  const clearTime = { label: "⚡ Clear time filter", patch: () => ({ timeFrom: "", timeTo: "" }) };
  const allBrandsFix = { label: "⚡ Select all brands (Clear brand filter)", patch: () => ({ brands: [] }) };
  const oneBrandFix = allBrands.length
    ? { label: `⚡ Select '${allBrands[0]}'`, patch: () => ({ brands: [allBrands[0]] }) }
    : null;

  const needDays = (n, level) => {
    if (days < n) issues.push({ level, msg: `This insight needs at least ${n} days of data (currently ${days}).`, fixes: [setDays(n)] });
  };

  if ([14].includes(insightId)) needDays(7, "error");
  if ([15, 23].includes(insightId)) needDays(3, "error");
  if ([14, 15, 23].includes(insightId) && timeSet)
    issues.push({ level: "warn", msg: "A time filter will hide part of the daily cycle for this insight.", fixes: [clearTime] });
  if (insightId === 12 && days < 15)
    issues.push({ level: "error", msg: `Monthly trends need at least 15 days of history (currently ${days}).`, fixes: [setDays(30)] });
  if (insightId === 2 && f.zones.length === 1) issues.push({ level: "warn", msg: "Only one zone selected — comparison needs at least two.", fixes: [{ label: "⚡ Clear zone filter", patch: () => ({ zones: [] }) }] });
  if (insightId === 3 && f.cities.length === 1) issues.push({ level: "warn", msg: "Only one city selected — comparison needs at least two.", fixes: [{ label: "⚡ Clear city filter", patch: () => ({ cities: [] }) }] });
  if (insightId === 4 && f.areas.length === 1) issues.push({ level: "warn", msg: "Only one area selected — comparison needs at least two.", fixes: [{ label: "⚡ Clear area filter", patch: () => ({ areas: [] }) }] });
  if ([26, 1].includes(insightId) && f.brands.length === 1)
    issues.push({ level: "warn", msg: "Only one brand selected — this insight compares brands.", fixes: [allBrandsFix] });
  if ([6, 7, 8, 10, 29].includes(insightId) && f.brands.length !== 1)
    issues.push({
      level: f.brands.length > 1 ? "warn" : "warn",
      msg: "SKU insights are cleanest with exactly one brand selected.",
      fixes: oneBrandFix ? [oneBrandFix] : [],
    });
  if ([30, 31, 32].includes(insightId) && f.brands.length !== 1)
    issues.push({ level: "error", msg: "Item-wise insights require exactly one brand selected.", fixes: oneBrandFix ? [oneBrandFix] : [] });
  if (insightId === 31) needDays(3, "error");
  if (insightId === 18 && (days < 7 || days > 14))
    issues.push({ level: "warn", msg: "The weekly brief reads best over a 7–14 day window.", fixes: [setDays(7)] });

  return issues;
}

export default function RatingsPage({ globalFilters, allBrands, masterData, onUpdateFilters }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [defaultData, setDefaultData] = useState(null);
  const [showDownload, setShowDownload] = useState(false);
  const downloadRef = useRef(null);
  const [hasDownload, setHasDownload] = useState(false);
  const inputRef = useRef(null);

  const registerDownload = useCallback((fn) => {
    downloadRef.current = fn;
    setHasDownload(Boolean(fn));
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "/" && document.activeElement !== inputRef.current) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const matches = useMemo(() => {
    const q = query.replace(/^\d+\.\s*/, "").trim().toLowerCase();
    if (!q) return INSIGHTS;
    return INSIGHTS.filter((i) => i.label.toLowerCase().includes(q) || String(i.id) === q);
  }, [query]);

  const loadDefault = useCallback(() => {
    setLoading(true);
    Promise.all([fetchInsight(1, globalFilters), fetchInsight(22, globalFilters)])
      .then(([brandRatings, rv]) => {
        setDefaultData({ brandRatings, reviews: rv });
        setError(null);
      })
      .catch((e) => setError(e.message === "NO_DATA" ? "NO_DATA" : "ERROR"))
      .finally(() => setLoading(false));
  }, [globalFilters]);

  useEffect(() => {
    if (!selected) loadDefault();
  }, [selected, loadDefault]);

  const runInsight = useCallback(
    async (insight) => {
      setLoading(true);
      setError(null);
      registerDownload(null);
      try {
        if ([1, 2, 3, 4].includes(insight.id)) {
          const [agg, rv] = await Promise.all([fetchInsight(insight.id, globalFilters), fetchInsight(22, globalFilters)]);
          setResult(agg);
          setReviews(rv);
        } else {
          const data = await fetchInsight(insight.id, globalFilters);
          setResult(data);
          setReviews([]);
        }
        setDefaultData(null);
      } catch (e) {
        setResult(null);
        setError(e.message === "NO_DATA" ? "NO_DATA" : e.message === "RATE_LIMITED" ? "RATE_LIMITED" : "ERROR");
      } finally {
        setLoading(false);
      }
    },
    [globalFilters, registerDownload],
  );

  const pick = (insight) => {
    setSelected(insight);
    setQuery(`${insight.id}. ${insight.label}`);
    setOpen(false);
  };

  const issues = selected ? buildValidation(selected.id, globalFilters, allBrands) : [];
  const hasError = issues.some((i) => i.level === "error");
  const panelColor = hasError ? C.danger : issues.length ? C.warn : C.ok;
  const panelTitle = hasError
    ? "Critical Filter Adjustment Required"
    : issues.length
      ? "Filter Optimization Recommendations"
      : "Filters Optimized";

  const highlightText = (text) => {
    const q = query.replace(/^\d+\.\s*/, "").toLowerCase();
    const idx = q ? text.toLowerCase().indexOf(q) : -1;
    if (idx < 0) return text;
    return (
      <>
        {text.slice(0, idx)}
        <span style={{ backgroundColor: C.primary, color: "#ffffff" }}>{text.slice(idx, idx + q.length)}</span>
        {text.slice(idx + q.length)}
      </>
    );
  };

  const errorCopy = {
    NO_DATA: "No rating/insights data matches the selected global filters.",
    RATE_LIMITED: "Rate limit reached. Please wait 60 seconds.",
    ERROR: "Analytical service unavailable. Please retry.",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, fontFamily: FONT }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: "1 1 380px", maxWidth: 540 }}>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
              setHighlight(0);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (!open || !matches.length) return;
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setHighlight((h) => (h + 1) % matches.length);
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setHighlight((h) => (h - 1 + matches.length) % matches.length);
              } else if (e.key === "Enter") {
                e.preventDefault();
                pick(matches[highlight]);
              } else if (e.key === "Escape") {
                setOpen(false);
              }
            }}
            placeholder="Press / and search 27 insights..."
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "11px 18px",
              borderRadius: 24,
              border: `2px solid ${C.primary}`,
              fontSize: 13,
              color: C.text,
              fontFamily: FONT,
              outline: "none",
            }}
          />
          {open && matches.length > 0 && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 6px)",
                left: 0,
                right: 0,
                border: `2px solid ${C.primary}`,
                borderRadius: 12,
                backgroundColor: "#ffffff",
                maxHeight: 260,
                overflowY: "auto",
                zIndex: 1001,
              }}
            >
              {matches.map((m, i) => (
                <div
                  key={m.id}
                  onMouseDown={() => pick(m)}
                  onMouseEnter={() => setHighlight(i)}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 10,
                    padding: "9px 14px",
                    cursor: "pointer",
                    fontSize: 12.5,
                    backgroundColor: highlight === i ? C.primary : "#ffffff",
                    color: highlight === i ? "#ffffff" : C.primary,
                  }}
                >
                  <span style={{ fontWeight: 600 }}>
                    {m.id}. {highlightText(m.label)}
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 800, opacity: 0.7, whiteSpace: "nowrap" }}>{m.category}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          disabled={loading || !selected}
          onClick={() => selected && runInsight(selected)}
          style={{
            padding: "11px 22px",
            borderRadius: 24,
            border: "none",
            backgroundColor: C.primary,
            color: "#ffffff",
            fontSize: 13,
            fontWeight: 800,
            cursor: loading || !selected ? "not-allowed" : "pointer",
            opacity: loading || !selected ? 0.6 : 1,
            fontFamily: FONT,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          {loading && <span style={{ ...spinnerStyle, borderColor: "#ffffff", borderTopColor: "transparent" }} />}
          {loading ? "Calculating..." : "Apply"}
        </button>

        {hasDownload && (
          <button
            onClick={() => setShowDownload(true)}
            style={{
              padding: "10px 18px",
              borderRadius: 24,
              border: `2px solid ${C.primary}`,
              backgroundColor: "transparent",
              color: C.primary,
              fontSize: 12.5,
              fontWeight: 800,
              cursor: "pointer",
              fontFamily: FONT,
            }}
          >
            📥 Download Report
          </button>
        )}
      </div>

      {selected && (
        <div style={{ ...cardStyle, borderLeft: `4px solid ${panelColor}`, padding: "14px 18px" }}>
          <div style={{ fontSize: 12.5, fontWeight: 800, color: panelColor }}>{panelTitle}</div>
          {issues.length === 0 ? (
            <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>
              Current filters are a good fit for “{selected.label}”.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
              {issues.map((iss, i) => (
                <div key={i} style={{ fontSize: 12, color: C.text }}>
                  <div style={{ fontWeight: 600 }}>
                    {iss.level === "error" ? "⛔" : "⚠️"} {iss.msg}
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
                    {iss.fixes.map((fix) => (
                      <button
                        key={fix.label}
                        onClick={() => onUpdateFilters(fix.patch())}
                        style={{
                          padding: "5px 12px",
                          borderRadius: 18,
                          border: `1.5px solid ${C.primary}`,
                          backgroundColor: "#ffffff",
                          color: C.primary,
                          fontSize: 11,
                          fontWeight: 800,
                          cursor: "pointer",
                          fontFamily: FONT,
                        }}
                      >
                        {fix.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {error && (
        <div style={{ ...cardStyle, textAlign: "center" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.primary }}>{errorCopy[error]}</div>
          {error !== "NO_DATA" && (
            <button
              onClick={() => (selected ? runInsight(selected) : loadDefault())}
              style={{
                marginTop: 12,
                padding: "8px 20px",
                borderRadius: 20,
                border: "none",
                backgroundColor: C.primary,
                color: "#ffffff",
                fontSize: 12,
                fontWeight: 800,
                cursor: "pointer",
                fontFamily: FONT,
              }}
            >
              Retry
            </button>
          )}
        </div>
      )}

      {!error && selected && result && (
        <InsightResult
          insightId={selected.id}
          label={selected.label}
          data={result}
          reviews={reviews}
          allBrands={allBrands}
          masterData={masterData}
          filters={globalFilters}
          onClose={() => {
            setSelected(null);
            setResult(null);
            setQuery("");
            registerDownload(null);
          }}
          onRegisterDownload={registerDownload}
        />
      )}

      {!error && !selected && defaultData && (
        <DefaultDashboard
          data={defaultData}
          allBrands={allBrands}
          masterData={masterData}
          onRegisterDownload={registerDownload}
        />
      )}

      {showDownload && (
        <DownloadDialog dataSheets={downloadRef.current ? downloadRef.current() : []} onClose={() => setShowDownload(false)} />
      )}
    </div>
  );
}
