import { C, FONT } from "../../../theme";

/* ---------- math utils ---------- */
export const mean = (a) => (a.length ? a.reduce((x, y) => x + Number(y || 0), 0) / a.length : 0);
export const median = (a) => {
  if (!a.length) return 0;
  const s = [...a].map(Number).sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
export const stddev = (a) => {
  if (!a.length) return 0;
  const m = mean(a);
  return Math.sqrt(mean(a.map((v) => (Number(v) - m) ** 2)));
};
export const range = (a) => (a.length ? Math.max(...a.map(Number)) - Math.min(...a.map(Number)) : 0);
export const pct = (count, total) => (total ? (count / total) * 100 : 0);
export const slope = (vals) => {
  const n = vals.length;
  if (n < 2) return 0;
  const xs = vals.map((_, i) => i);
  const mx = mean(xs);
  const my = mean(vals);
  const num = xs.reduce((acc, x, i) => acc + (x - mx) * (Number(vals[i]) - my), 0);
  const den = xs.reduce((acc, x) => acc + (x - mx) ** 2, 0);
  return den ? num / den : 0;
};
export const mode = (a) => {
  const m = new Map();
  a.forEach((v) => m.set(v, (m.get(v) || 0) + 1));
  return [...m.entries()].sort((x, y) => y[1] - x[1])[0]?.[0] ?? "-";
};
export const groupBy = (rows, key) => {
  const m = new Map();
  rows.forEach((r) => {
    const k = r[key];
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(Number(r.restaurant_rating || 0));
  });
  return [...m.entries()].map(([name, vals]) => ({ name, avg: mean(vals), count: vals.length }));
};

const f1 = (n) => Number(n || 0).toFixed(1);
const f2 = (n) => Number(n || 0).toFixed(2);

/* ---------- generic shape detection ---------- */
function shape(data) {
  const rows = Array.isArray(data) ? data : [];
  if (!rows.length) return { rows: [], labelKey: null, valueKey: null, countKey: null };
  const keys = Object.keys(rows[0]);
  const labelKey = keys.find((k) => typeof rows[0][k] === "string") || keys[0];
  const valueKey =
    keys.find((k) => /avg|rating|item_avg|weighted/.test(k) && typeof rows[0][k] === "number") ||
    keys.find((k) => typeof rows[0][k] === "number");
  const countKey = keys.find((k) => /count|reviews|orders/.test(k));
  return { rows, labelKey, valueKey, countKey };
}

/* ---------- narrative ---------- */
export function buildNarrative(insightId, data) {
  const { rows, labelKey, valueKey, countKey } = shape(data);
  if (!rows.length) return { signal: "monitor", text: "No records returned for this scope.", action: "Widen the filters and re-run." };
  const vals = valueKey ? rows.map((r) => Number(r[valueKey] || 0)).filter((v) => v > 0) : [];
  const sortedDesc = valueKey ? [...rows].filter((r) => Number(r[valueKey]) > 0).sort((a, b) => b[valueKey] - a[valueKey]) : rows;
  const top = sortedDesc[0];
  const bottom = sortedDesc[sortedDesc.length - 1];
  const spread = vals.length ? Math.max(...vals) - Math.min(...vals) : 0;

  const spreadNarrative = (noun) => ({
    signal: spread > 1 ? "warn" : spread > 0.4 ? "monitor" : "good",
    text: `${top?.[labelKey]} leads at ${f1(top?.[valueKey])}★ while ${bottom?.[labelKey]} trails at ${f1(bottom?.[valueKey])}★ — a ${f2(spread)}★ gap across ${rows.length} ${noun}.`,
    action:
      spread > 1
        ? `Investigate ${bottom?.[labelKey]} first — the gap is wide enough to be an operational defect, not noise.`
        : `Codify what ${top?.[labelKey]} is doing well and amplify those practices fleet-wide.`,
  });

  switch (insightId) {
    case 1:
      return spreadNarrative("brands");
    case 2:
      return spreadNarrative("zones");
    case 3:
      return spreadNarrative("cities");
    case 4:
      return spreadNarrative("areas");
    case 6:
      return {
        signal: "good",
        text: `'${top?.[labelKey]}' is the portfolio champion at ${f1(top?.[valueKey])}★ — customers rate it consistently above the menu average.`,
        action: "Ensure it is always in stock and featured at the top of every menu listing.",
      };
    case 7: {
      const worst = [...rows].sort((a, b) => a[valueKey] - b[valueKey])[0];
      return {
        signal: "warn",
        text: `'${worst?.[labelKey]}' is actively dragging ratings at ${f1(worst?.[valueKey])}★ across ${worst?.[countKey] ?? 0} reviews — the highest-risk item on your menu.`,
        action: "Audit immediately — reformulate, retrain the kitchen, or remove it from the menu.",
      };
    }
    case 8:
      return {
        signal: "monitor",
        text: `'${rows[0]?.[labelKey]}' is your highest-volume SKU with ${rows[0]?.[countKey] ?? 0} reviews — it has outsized influence on brand perception.`,
        action: "A 0.1★ improvement here affects thousands of customers — prioritise consistency over novelty.",
      };
    case 9:
      return {
        signal: spread > 1 ? "warn" : spread > 0.5 ? "monitor" : "good",
        text: `${top?.[labelKey]} leads at ${f1(top?.[valueKey])}★ while ${bottom?.[labelKey]} trails at ${f1(bottom?.[valueKey])}★ across ${rows.length} categories.`,
        action: `Run a category-level QC pass on ${bottom?.[labelKey]} recipes and portioning.`,
      };
    case 10:
      return {
        signal: "warn",
        text: `${rows[0]?.[labelKey]} combines high order volume with a ${f1(rows[0]?.[valueKey])}★ rating — a systemic issue, not isolated bad luck.`,
        action: "Trigger an immediate area-level audit covering kitchen throughput, packaging and rider handover.",
      };
    case 11: {
      const total = rows.reduce((a, r) => a + Number(r.count || 0), 0);
      const promoters = rows.filter((r) => Number(r.star) >= 4).reduce((a, r) => a + Number(r.count || 0), 0);
      const detractors = rows.filter((r) => Number(r.star) <= 2).reduce((a, r) => a + Number(r.count || 0), 0);
      const nps = pct(promoters - detractors, total);
      return {
        signal: nps >= 30 ? "good" : nps >= 0 ? "monitor" : "warn",
        text: `${promoters} promoters vs ${detractors} detractors out of ${total} reviews — satisfaction score of ${Math.round(nps)}.`,
        action: nps >= 30 ? "Protect this base — publish the win and keep QC unchanged." : "Close the loop on detractors within 24h and fix the top repeat complaint.",
      };
    }
    case 12: {
      const s = slope(rows.map((r) => Number(r[valueKey] || 0)));
      const best = sortedDesc[0];
      const worst = sortedDesc[sortedDesc.length - 1];
      const dir = s > 0.005 ? "Rising" : s < -0.005 ? "Falling" : "Stable";
      return {
        signal: s > 0.005 ? "good" : s < -0.005 ? "warn" : "monitor",
        text: `Trend is ${dir.toLowerCase()} — best month ${best?.[labelKey]} at ${f1(best?.[valueKey])}★, worst ${worst?.[labelKey]} at ${f1(worst?.[valueKey])}★.`,
        action: dir === "Falling" ? "Investigate what changed operationally in the declining months." : "Lock in the practices behind the strongest month.",
      };
    }
    case 14: {
      const wd = rows.find((r) => /weekday/i.test(String(r[labelKey])));
      const we = rows.find((r) => /weekend/i.test(String(r[labelKey])));
      const delta = Number(we?.[valueKey] || 0) - Number(wd?.[valueKey] || 0);
      const better = delta >= 0 ? "Weekend" : "Weekday";
      const worse = delta >= 0 ? "Weekday" : "Weekend";
      const abs = Math.abs(delta);
      return {
        signal: abs > 0.3 ? "warn" : abs > 0.1 ? "monitor" : "good",
        text: `${better} orders score ${f1(delta >= 0 ? we?.[valueKey] : wd?.[valueKey])}★ — a ${f2(abs)}★ gap vs ${worse}s.`,
        action: `Align ${worse} staffing SOPs and prep buffers to the ${better} playbook.`,
      };
    }
    case 15: {
      const totalC = rows.reduce((a, r) => a + Number(r.count || 0), 0);
      const peak = [...rows].sort((a, b) => Number(b.count) - Number(a.count))[0];
      return {
        signal: "warn",
        text: `${peak?.name} is the highest-complaint hour with ${peak?.count} flagged windows — ${Math.round(pct(Number(peak?.count || 0), totalC))}% of complaints concentrate here.`,
        action: "Pre-position staff and add a QC checkpoint 30 minutes before this window opens.",
      };
    }
    case 17: {
      const first = rows[0];
      return {
        signal: "warn",
        text: `${first?.cause} is the primary driver at ${f1(first?.percentage)}% of classified complaints.`,
        action: `Open a corrective action plan with the ${first?.cause} function this week.`,
      };
    }
    case 23: {
      const best = sortedDesc[0];
      const worst = sortedDesc[sortedDesc.length - 1];
      const gap = Number(best?.[valueKey] || 0) - Number(worst?.[valueKey] || 0);
      return {
        signal: gap > 0.5 ? "warn" : gap > 0.2 ? "monitor" : "good",
        text: `${best?.[labelKey]} performs best at ${f1(best?.[valueKey])}★ while ${worst?.[labelKey]} lags at ${f1(worst?.[valueKey])}★.`,
        action: `Align ${worst?.[labelKey]} staffing and prep standards to the ${best?.[labelKey]} baseline.`,
      };
    }
    default:
      return spreadNarrative("records");
  }
}

/* ---------- selected-scope + combination narrative ---------- */
// Describe the brands / locations the user has actually selected so the AI
// banner speaks to their filter choices, not just "the fleet".
export function scopeLabel(filters) {
  if (!filters) return "";
  const chunks = [];
  const named = (arr, many) => (arr && arr.length ? (arr.length <= 3 ? arr.join(", ") : `${arr.length} ${many}`) : null);
  const b = named(filters.brands, "brands");
  const c = named(filters.cities, "cities");
  const z = named(filters.zones, "zones");
  const a = named(filters.areas, "areas");
  if (b) chunks.push(b);
  if (c) chunks.push(c);
  if (z) chunks.push(z);
  if (a) chunks.push(a);
  return chunks.join(" · ");
}

// When the active filters produce a multi-dimensional breakdown (e.g.
// City > Brand), rank the actual combinations and headline the best/worst
// pair so the insight reflects the selected combinations directly.
export function breakdownNarrative(breakdown) {
  const rows = breakdown?.rows || [];
  const dims = breakdown?.dims || [];
  if (!rows.length || !dims.length) return null;
  const comboLabel = (r) => dims.map((d) => r[d.field]).filter((v) => v != null && v !== "").join(" · ");
  const valueKey = Object.keys(rows[0]).find((k) => /avg|weighted|rating/i.test(k) && typeof rows[0][k] === "number");
  if (!valueKey) return null;
  const ranked = rows.filter((r) => Number(r[valueKey]) > 0).sort((a, b) => Number(b[valueKey]) - Number(a[valueKey]));
  if (ranked.length < 2) return null;
  const best = ranked[0];
  const worst = ranked[ranked.length - 1];
  const spread = Number(best[valueKey]) - Number(worst[valueKey]);
  const dimPath = dims.map((d) => d.label).join(" > ");
  return {
    signal: spread > 1 ? "warn" : spread > 0.4 ? "monitor" : "good",
    text: `Across ${dimPath}, ${comboLabel(best)} leads at ${f1(best[valueKey])}★ while ${comboLabel(worst)} trails at ${f1(worst[valueKey])}★ — a ${f2(spread)}★ gap over ${ranked.length} combinations in your selected scope.`,
    action:
      spread > 1
        ? `Drill into ${comboLabel(worst)} first — it is the weakest combination among the filters you selected.`
        : `Replicate what ${comboLabel(best)} is doing across the other selected combinations.`,
  };
}

/* ---------- stat cards ---------- */
function card(label, value, detail, tone) {
  return { label, value: String(value), detail, tone };
}

export function buildStats(insightId, data) {
  const { rows, labelKey, valueKey, countKey } = shape(data);
  if (!rows.length) return [];
  const vals = rows.map((r) => Number(r[valueKey] || 0)).filter((v) => v > 0);
  const counts = countKey ? rows.map((r) => Number(r[countKey] || 0)) : [];
  const totalReviews = counts.reduce((a, b) => a + b, 0);
  const desc = [...rows].filter((r) => Number(r[valueKey]) > 0).sort((a, b) => b[valueKey] - a[valueKey]);
  const top = desc[0];
  const bottom = desc[desc.length - 1];
  const m = mean(vals);

  const locationSet = (noun) => [
    card(`Best ${noun}`, top?.[labelKey] ?? "-", `${f2(top?.[valueKey])}★ average`, "accent"),
    card(`Weakest ${noun}`, bottom?.[labelKey] ?? "-", `${f2(bottom?.[valueKey])}★ average`, "warn"),
    card(`${noun} Fleet Avg`, f2(m), `${rows.length} ${noun.toLowerCase()}s in scope`),
    card(`${noun} Spread`, f2(range(vals)), "best-to-worst delta"),
    card(`${noun} Std Dev σ`, f2(stddev(vals)), "dispersion of ratings"),
    card(`Above Avg ${noun}s`, vals.filter((v) => v >= m).length, `out of ${rows.length}`),
  ];

  switch (insightId) {
    case 1:
      return [
        card("Top Brand", top?.[labelKey] ?? "-", `${f2(top?.[valueKey])}★ average`, "accent"),
        card("Weakest Brand", bottom?.[labelKey] ?? "-", `${f2(bottom?.[valueKey])}★ average`, "warn"),
        card("Portfolio Avg", f2(m), `${rows.length} brands rated`),
        card("Rating Spread", f2(range(vals)), "top-to-bottom gap"),
        card("Above Portfolio", vals.filter((v) => v >= m).length, "brands beating the mean"),
        card("Total Reviews", totalReviews.toLocaleString(), "in filtered scope"),
      ];
    case 2:
      return locationSet("Zone").slice(0, 4).concat(card("Total Reviews", totalReviews.toLocaleString(), "in filtered scope"));
    case 3:
      return locationSet("City");
    case 4:
      return locationSet("Area").slice(0, 4).concat([
        card("Above Avg Areas", vals.filter((v) => v >= m).length, `out of ${rows.length}`),
        card("Total Reviews", totalReviews.toLocaleString(), "in filtered scope"),
      ]);
    case 6:
    case 7:
    case 8:
    case 10: {
      const headline =
        insightId === 6
          ? card("Champion", top?.[labelKey] ?? "-", `${f2(top?.[valueKey])}★`, "accent")
          : insightId === 7
            ? card("Kill Candidate", bottom?.[labelKey] ?? "-", `${f2(bottom?.[valueKey])}★`, "warn")
            : insightId === 8
              ? card("Top Volume", rows[0]?.[labelKey] ?? "-", `${rows[0]?.[countKey] ?? 0} reviews`, "accent")
              : card("Critical Area", rows[0]?.[labelKey] ?? "-", `${f2(rows[0]?.[valueKey])}★`, "warn");
      return [
        headline,
        card("Mean Rating", f2(m), `${rows.length} records`),
        card("Median Rating", f2(median(vals)), "midpoint of scope"),
        card("Std Dev σ", f2(stddev(vals)), "consistency measure"),
        card("Rating Spread", f2(range(vals)), "best-to-worst"),
        card("Total Reviews", totalReviews.toLocaleString(), "in filtered scope"),
      ];
    }
    case 9:
      return [
        card("Best Category", top?.[labelKey] ?? "-", `${f2(top?.[valueKey])}★`, "accent"),
        card("Weakest Category", bottom?.[labelKey] ?? "-", `${f2(bottom?.[valueKey])}★`, "warn"),
        card("Category Mean", f2(m), `${rows.length} categories`),
        card("Category Gap", f2(range(vals)), "best-to-worst"),
        card("Above Portfolio", vals.filter((v) => v >= m).length, "categories above mean"),
        card("Total Reviews", totalReviews.toLocaleString(), "in filtered scope"),
      ];
    case 11: {
      const total = rows.reduce((a, r) => a + Number(r.count || 0), 0);
      const get = (star) => Number(rows.find((r) => Number(r.star) === star)?.count || 0);
      const promoters = get(5) + get(4);
      const detractors = get(2) + get(1);
      const weighted = total ? rows.reduce((a, r) => a + Number(r.star) * Number(r.count || 0), 0) / total : 0;
      const nps = pct(promoters - detractors, total);
      return [
        card("Weighted Avg★", f2(weighted), `${total.toLocaleString()} reviews`, "accent"),
        card("Promoter Rate", `${f1(pct(promoters, total))}%`, "4★ and 5★ reviews"),
        card("Detractor Rate", `${f1(pct(detractors, total))}%`, "1★ and 2★ reviews", pct(detractors, total) > 20 ? "warn" : undefined),
        card("Satisfaction Score", Math.round(nps), "promoters − detractors"),
        card("5★ Reviews", get(5).toLocaleString(), "top of scale"),
        card("1★ Reviews", get(1).toLocaleString(), "bottom of scale"),
      ];
    }
    case 12: {
      const s = slope(rows.map((r) => Number(r[valueKey] || 0)));
      const last = rows[rows.length - 1];
      const prev = rows[rows.length - 2];
      const mom = prev ? Number(last[valueKey]) - Number(prev[valueKey]) : 0;
      return [
        card("Peak Month", top?.[labelKey] ?? "-", `${f2(top?.[valueKey])}★`, "accent"),
        card("Worst Month", bottom?.[labelKey] ?? "-", `${f2(bottom?.[valueKey])}★`, "warn"),
        card("Trend Direction", s > 0.005 ? "Rising" : s < -0.005 ? "Falling" : "Stable", `slope ${f2(s)}`),
        card("Monthly Volatility σ", f2(stddev(vals)), "month-over-month spread"),
        card("Latest MoM Δ", `${mom >= 0 ? "+" : ""}${f2(mom)}`, "vs previous month"),
        card("Rating Range", f2(range(vals)), "peak to trough"),
      ];
    }
    case 14: {
      const wd = rows.find((r) => /weekday/i.test(String(r[labelKey])));
      const we = rows.find((r) => /weekend/i.test(String(r[labelKey])));
      const delta = Number(we?.[valueKey] || 0) - Number(wd?.[valueKey] || 0);
      return [
        card("Weekday Rating", f2(wd?.[valueKey]), `${Number(wd?.[countKey] || 0).toLocaleString()} reviews`),
        card("Weekend Rating", f2(we?.[valueKey]), `${Number(we?.[countKey] || 0).toLocaleString()} reviews`),
        card("Rating Delta", `${delta >= 0 ? "+" : ""}${f2(delta)}`, "weekend minus weekday", Math.abs(delta) > 0.3 ? "warn" : undefined),
        card("Higher Volume", Number(we?.[countKey] || 0) > Number(wd?.[countKey] || 0) ? "Weekend" : "Weekday", "by review count"),
        card("Better Ratings", delta >= 0 ? "Weekend" : "Weekday", "higher average", "accent"),
        card("Total Reviews", totalReviews.toLocaleString(), "in filtered scope"),
      ];
    }
    case 15: {
      const sortedC = [...rows].sort((a, b) => Number(b.count) - Number(a.count));
      const totalC = rows.reduce((a, r) => a + Number(r.count || 0), 0);
      const peak = sortedC[0];
      const safest = sortedC[sortedC.length - 1];
      return [
        card("Peak Hour", peak?.name ?? "-", `${peak?.count ?? 0} complaints`, "warn"),
        card("Flagged Peak Hours", rows.filter((r) => r.worst).length, "hours above normal"),
        card("Peak Concentration", `${f1(pct(Number(peak?.count || 0), totalC))}%`, "share in worst hour"),
        card("Total Complaints", totalC.toLocaleString(), "ratings ≤ 2★"),
        card("Safest Hour", safest?.name ?? "-", `${safest?.count ?? 0} complaints`, "accent"),
        card("Hours Tracked", rows.length, "with complaint activity"),
      ];
    }
    case 17: {
      const total = rows.reduce((a, r) => a + Number(r.count || 0), 0);
      const of = (name) => f1(Number(rows.find((r) => r.cause === name)?.percentage || 0));
      return [
        card("Primary Cause", rows[0]?.cause ?? "-", `${f1(rows[0]?.percentage)}% of complaints`, "warn"),
        card("Kitchen %", `${of("Kitchen")}%`, "prep and quality"),
        card("Delivery %", `${of("Delivery")}%`, "rider and transit"),
        card("Packaging %", `${of("Packaging")}%`, "spill and seal"),
        card("Total Classified", total.toLocaleString(), "complaints with comments"),
      ];
    }
    case 23: {
      const busiest = [...rows].sort((a, b) => Number(b[countKey]) - Number(a[countKey]))[0];
      return [
        card("Best Daypart", top?.[labelKey] ?? "-", `${f2(top?.[valueKey])}★`, "accent"),
        card("Worst Daypart", bottom?.[labelKey] ?? "-", `${f2(bottom?.[valueKey])}★`, "warn"),
        card("Daypart Spread", f2(range(vals)), "best-to-worst"),
        card("Busiest Slot", busiest?.[labelKey] ?? "-", `${Number(busiest?.[countKey] || 0).toLocaleString()} reviews`),
        card("Slot Mean Avg", f2(m), `${rows.length} slots`),
        card("Total Reviews", totalReviews.toLocaleString(), "in filtered scope"),
      ];
    }
    case 26: {
      const gaps = rows.map((r) => Number(r.bestAvg || 0) - Number(r.worstAvg || 0));
      return [
        card("Most Cities Won", mode(rows.map((r) => r.bestBrand)), "top brand by city wins", "accent"),
        card("Most Cities Lost", mode(rows.map((r) => r.worstBrand)), "bottom brand by city", "warn"),
        card("Avg City Gap", f2(mean(gaps)), "best vs worst brand"),
        card("Largest City Gap", f2(Math.max(...gaps, 0)), "widest single city"),
        card("Cities Analyzed", rows.length, "in filtered scope"),
      ];
    }
    case 27: {
      const gaps = rows.map((r) => Number(r.gap || 0));
      const poor = rows.filter((r) => /Outlier/i.test(String(r.status)));
      const stars = rows.filter((r) => /Star/i.test(String(r.status)));
      const worst = [...rows].sort((a, b) => a.gap - b.gap)[0];
      const best = [...rows].sort((a, b) => b.gap - a.gap)[0];
      return [
        card("Poor Outliers", poor.length, "≥0.5★ below kitchen avg", poor.length > 0 ? "warn" : undefined),
        card("Star Stores", stars.length, "≥0.5★ above kitchen avg", "accent"),
        card("Normal Outlets", rows.length - poor.length - stars.length, "within tolerance"),
        card("Fleet Mean Gap", f2(mean(gaps)), "average outlet delta"),
        card("Worst Outlet Gap", f2(worst?.gap), worst?.outletId ?? "-", "warn"),
        card("Best Outlet Gap", f2(best?.gap), best?.outletId ?? "-", "accent"),
      ];
    }
    case 28: {
      const ratings = rows.map((r) => Number(r.rating || 0));
      const sortedR = [...rows].sort((a, b) => b.rating - a.rating);
      return [
        card("Most Common #1", mode(rows.map((r) => r.bestItem)), "top item across outlets", "accent"),
        card("Fleet Best-Item Avg", f2(mean(ratings)), `${rows.length} outlets`),
        card("Top 5 Avg", f2(mean(sortedR.slice(0, 5).map((r) => Number(r.rating)))), "strongest outlets"),
        card("Bottom 5 Avg", f2(mean(sortedR.slice(-5).map((r) => Number(r.rating)))), "weakest outlets", "warn"),
        card("Outlets Analyzed", rows.length, "with rated items"),
        card("Unique #1 Items", new Set(rows.map((r) => r.bestItem)).size, "distinct winners"),
      ];
    }
    case 29: {
      const sds = rows.map((r) => Number(r.stddev || 0));
      const consistent = rows.filter((r) => /Consistent/.test(String(r.status)) && !/Inconsistent/.test(String(r.status)));
      const bad = rows.filter((r) => /Inconsistent/.test(String(r.status)));
      const sortedSd = [...rows].sort((a, b) => a.stddev - b.stddev);
      return [
        card("Consistent SKUs", consistent.length, "σ below 0.5", "accent"),
        card("Inconsistent SKUs", bad.length, "σ above 1.2", bad.length > 0 ? "warn" : undefined),
        card("Moderate SKUs", rows.length - consistent.length - bad.length, "σ 0.5 – 1.2"),
        card("Fleet Avg Variance", f2(mean(sds)), "mean σ across SKUs"),
        card("Most Consistent", sortedSd[0]?.name ?? "-", `σ ${f2(sortedSd[0]?.stddev)}`, "accent"),
        card("Most Volatile", sortedSd[sortedSd.length - 1]?.name ?? "-", `σ ${f2(sortedSd[sortedSd.length - 1]?.stddev)}`, "warn"),
      ];
    }
    case 30:
      return [
        card("Best Pairing", `${top?.item} · ${top?.city}`, `${f2(top?.avg)}★`, "accent"),
        card("Worst Pairing", `${bottom?.item} · ${bottom?.city}`, `${f2(bottom?.avg)}★`, "warn"),
        card("Mean Rating", f2(m), `${rows.length} item-city pairs`),
        card("Rating Spread", f2(range(vals)), "best-to-worst"),
        card("Cities Covered", new Set(rows.map((r) => r.city)).size, "in filtered scope"),
        card("Items Tracked", new Set(rows.map((r) => r.item)).size, "distinct SKUs"),
      ];
    case 31: {
      const s = slope(rows.map((r) => Number(r.avg || 0)));
      return [
        card("Peak Rating", f2(top?.avg), `${top?.item} · ${top?.month}`, "accent"),
        card("Lowest Rating", f2(bottom?.avg), `${bottom?.item} · ${bottom?.month}`, "warn"),
        card("Overall Trend", s > 0.005 ? "Rising" : s < -0.005 ? "Falling" : "Stable", `slope ${f2(s)}`),
        card("Rating Volatility σ", f2(stddev(vals)), "across months"),
        card("Months Tracked", new Set(rows.map((r) => r.month)).size, "in filtered scope"),
        card("Items Tracked", new Set(rows.map((r) => r.item)).size, "distinct SKUs"),
      ];
    }
    case 32: {
      const company = Number(rows[0]?.companyAvg || 0);
      const above = rows.filter((r) => Number(r.gap) > 0);
      const below = rows.filter((r) => Number(r.gap) < 0);
      const sortedG = [...rows].sort((a, b) => b.gap - a.gap);
      return [
        card("Company Baseline", f2(company), "fleet-wide average"),
        card("Above Avg Items", above.length, `of ${rows.length} SKUs`, "accent"),
        card("Below Avg Items", below.length, `of ${rows.length} SKUs`, "warn"),
        card("Best Outperformer", sortedG[0]?.name ?? "-", `+${f2(sortedG[0]?.gap)}★`, "accent"),
        card("Biggest Laggard", sortedG[sortedG.length - 1]?.name ?? "-", `${f2(sortedG[sortedG.length - 1]?.gap)}★`, "warn"),
        card("Avg Absolute Dev", f2(mean(rows.map((r) => Math.abs(Number(r.gap || 0))))), "mean |gap| vs company"),
      ];
    }
    default:
      return [
        card("Records", rows.length, "rows in this view"),
        card("Mean Value", f2(m), "average of primary metric"),
        card("Spread", f2(range(vals)), "max minus min"),
        card("Total Reviews", totalReviews.toLocaleString(), "in filtered scope"),
      ];
  }
}

/* ---------- presentation ---------- */
const SIGNALS = {
  good: { gradient: "linear-gradient(135deg, #064e3b 0%, #059669 100%)", dot: "#34d399", badge: "✓  On Track" },
  monitor: { gradient: "linear-gradient(135deg, #78350f 0%, #d97706 100%)", dot: "#fbbf24", badge: "⚠  Monitor" },
  warn: { gradient: "linear-gradient(135deg, #7f1d1d 0%, #dc2626 100%)", dot: "#f87171", badge: "!  Action Required" },
};

function StatCard({ label, value, detail, tone }) {
  const leftColor = tone === "accent" ? C.primary : tone === "warn" ? "#dc2626" : "#94a3b8";
  const bg = tone === "accent" ? "#f5f7ff" : tone === "warn" ? "#fff5f5" : "#ffffff";
  const numColor = tone === "accent" ? C.primary : tone === "warn" ? "#dc2626" : "#1e293b";
  return (
    <div
      style={{
        minWidth: 130,
        flex: 1,
        borderLeft: `4px solid ${leftColor}`,
        border: `1px solid ${C.border}`,
        borderLeftWidth: 4,
        borderLeftColor: leftColor,
        backgroundColor: bg,
        borderRadius: 10,
        padding: "12px 14px",
      }}
    >
      <div style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", color: "rgba(19,38,100,0.42)", letterSpacing: 0.7 }}>
        {label}
      </div>
      <div style={{ fontSize: 21, fontWeight: 900, lineHeight: 1.05, letterSpacing: -0.4, color: numColor, marginTop: 6 }}>
        {value}
      </div>
      {detail && (
        <div style={{ fontSize: 10.5, fontWeight: 500, color: "rgba(19,38,100,0.52)", lineHeight: 1.4, marginTop: 5 }}>
          {detail}
        </div>
      )}
    </div>
  );
}

export default function InsightSummaryPanel({ insightId, data, filters, breakdown }) {
  const bd = breakdown ? breakdownNarrative(breakdown) : null;
  const narrative = bd || buildNarrative(insightId, data);
  const stats = buildStats(insightId, data);
  const theme = SIGNALS[narrative.signal] || SIGNALS.monitor;
  const scope = scopeLabel(filters);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, fontFamily: FONT }}>
      <div
        style={{
          background: theme.gradient,
          color: "#ffffff",
          borderRadius: 14,
          padding: "20px 22px",
          boxShadow: "0 4px 20px rgba(0,0,0,0.18)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: theme.dot, display: "inline-block" }} />
            <span style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1, opacity: 0.65 }}>
              AI Insight
            </span>
          </div>
          <span
            style={{
              fontSize: 10,
              fontWeight: 800,
              padding: "5px 12px",
              borderRadius: 20,
              backgroundColor: "rgba(255,255,255,0.18)",
              backdropFilter: "blur(8px)",
            }}
          >
            {theme.badge}
          </span>
        </div>
        {scope && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1, opacity: 0.55 }}>
              Scope
            </span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: "3px 10px",
                borderRadius: 14,
                backgroundColor: "rgba(255,255,255,0.14)",
              }}
            >
              {scope}
            </span>
          </div>
        )}
        <div style={{ fontSize: 14.5, fontWeight: 600, lineHeight: 1.55, marginTop: 12 }}>{narrative.text}</div>
        <div
          style={{
            marginTop: 14,
            backgroundColor: "rgba(0,0,0,0.2)",
            backdropFilter: "blur(4px)",
            borderRadius: 10,
            padding: "10px 14px",
            display: "flex",
            gap: 10,
            alignItems: "flex-start",
          }}
        >
          <span style={{ fontSize: 13 }}>💡</span>
          <div>
            <div style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1, opacity: 0.55 }}>
              Recommendation
            </div>
            <div style={{ fontSize: 12, fontWeight: 500, opacity: 0.92, marginTop: 3, lineHeight: 1.5 }}>
              {narrative.action}
            </div>
          </div>
        </div>
      </div>

      {stats.length > 0 && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <span style={{ flex: 1, height: 1, backgroundColor: "rgba(19,38,100,0.1)" }} />
            <span style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1, color: C.muted }}>
              Key Metrics
            </span>
            <span style={{ flex: 1, height: 1, backgroundColor: "rgba(19,38,100,0.1)" }} />
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {stats.map((s) => (
              <StatCard key={s.label} {...s} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
