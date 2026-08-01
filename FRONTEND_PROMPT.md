# Curefoods Partner Dashboard — Complete Frontend Prompt

Build a full-stack operations dashboard called **"CUREFOODS Partner Dashboard"** using **Vite + React** (no TypeScript, no CSS framework). All styling must use inline style objects. The backend is a Node.js Express server on port 3001. Use `bun` as the package manager.

---

## Design System

- **Primary color**: `#132664` (Royal Blue)
- **Background**: `#ffffff` (pure white)
- **Text**: `#132664`
- **Borders**: `rgba(19, 38, 100, 0.15)`
- **Zero external UI libraries** — all components built with inline styles
- **Font**: System font stack (no Google Fonts import needed)

---

## Application Layout

Two-column layout: **collapsible sidebar (260px wide)** + **main content area (flex: 1)**.

**Sidebar** (`background: #132664`):
- Header shows "CUREFOODS" in white, subtitle "Partner Dashboard"
- Collapse/expand button (chevron icon, animated with `transition: width 0.3s cubic-bezier(...)`)
- Nav items with inline SVG icons: Toggle, Timing, Dine-in Reviews, Route Backfilling, Ratings & Insights, Settings, System Theme
- Active nav item: `background: #ffffff`, `color: #132664`, `fontWeight: 700`
- Inactive: `color: rgba(255,255,255,0.8)`, transparent background
- Bottom section with Logout in `color: #ff8888`
- When collapsed: sidebar width becomes 0, a circular button (white with blue border, `position: absolute`) appears in the main content area to re-expand

**Main content area**:
- **Topbar**: page title (24px, 800 weight, `#132664`), subtitle (13px, muted), and a global filter row
- **Content area**: scrollable, renders the active page

---

## Global Filters (shown in topbar for all pages except Toggle)

The filter row has these controls as pill-shaped buttons (`borderRadius: 18px`):

1. **Brands** — multi-select checkbox popover (no search)
2. **Cities** — multi-select checkbox popover (with search input)
3. **Zones** — multi-select checkbox popover (no search)
4. **Areas** — multi-select checkbox popover (with search input)
5. **Date Range** — popover with "From Date" and "To Date" `<input type="date">` fields + Apply/Clear buttons
6. **Time Range** — popover with "From Time" and "To Time" `<input type="time">` fields + Apply/Clear buttons
7. **"Clear All"** link button (visible only when any filter is active)

Each checkbox popover button shows `"Label (N)"` when N items are selected, `"Label: All"` otherwise. Active state: `background: #132664`, `color: #ffffff`. Idle: white background, blue border.

**CheckboxFilterPopover component** logic:
- Opens/closes on click, closes on outside click (via `mousedown` listener)
- Has "All" and "None" quick-select links inside header
- Optional search box filters the option list
- "Apply" button dismisses the popover
- Uses `accentColor: #132664` on checkboxes

**Filter data** is fetched once on mount from `GET /api/filters` which returns `{ masterData: [{brand, city, zone, area}, ...] }`. Options are derived dynamically from masterData filtered by currently active selections (cascading filter logic — selecting a brand limits city/zone/area options to only those belonging to that brand).

**Global filters state shape**:
```js
{
  brands: [],    // string[]
  cities: [],    // string[]
  zones: [],     // string[]
  areas: [],     // string[]
  dateFrom: "",  // "YYYY-MM-DD"
  dateTo: "",    // "YYYY-MM-DD"
  timeFrom: "",  // "HH:MM"
  timeTo: ""     // "HH:MM"
}
```
Default dateFrom = 7 days ago, dateTo = 1 day ago.

---

## Pages

**Toggle**, **Timing**, **Reviews**, **Route Backfilling** — simple pages that receive `globalFilters` as a prop.

**Settings** — static page showing user profile (Name: Curefoods Admin, Role: Operations Manager) and connected platforms (Swiggy, Zomato, Google — all "Connected").

**System Theme** — static page explaining the theme is locked to Royal Blue & White.

**Logout** — centered page with logout icon, "Logged Out" message, and "Sign In Again" button that returns to the Toggle tab.

---

## Ratings & Insights Page (`RatingsPage`)

This is the core complex page. It receives:
- `globalFilters` — the filter state object
- `allBrands` — string array of brand names
- `masterData` — raw location data rows
- `onUpdateFilters(partialFilters)` — callback to patch filters from inside the page

### Insights List (27 insights in 5 categories)

```
TIME:
  14 — Weekend vs Weekday Ratings
  15 — Peak Complaint Hours
  23 — Hourly Daypart Split
  12 — Monthly Trends Comparison

LOCATION LEVEL RATINGS:
  2  — Zone Level Rating
  3  — City Level Rating
  4  — Area Level Rating
  26 — Best & Worst Brand per City
  27 — Outlet vs Kitchen Average Gap
  28 — Best Item per Outlet

SKUs:
  6  — SKU Leaderboard - Top Rated
  7  — SKU Leaderboard - Worst Rated (Kill List)
  8  — High Volume SKUs
  10 — High Volume, Low Rating items
  29 — SKU Consistency (Variance)

PERFORMANCE & DIAGNOSTICS:
  1  — Brand Level Rating
  9  — Category Ratings (Pizza/Dessert/etc)
  11 — Rating Distribution Stats
  21 — Comments Insight
  17 — AI Department Blame Split
  16 — AI Repeat Complaint Finder
  18 — AI Weekly Operations Brief
  19 — AI Action Items Generator
  20 — AI Packaging Issues Tracker

ITEM-WISE:
  30 — Item Rating by City
  31 — Item Trend Over Time
  32 — Item vs Company Average Gap
```

All insights are fetched via `POST /api/insights/:id` with `globalFilters` as the JSON body.

### Command Palette Search Bar

A search `<input>` (pill-shaped, `borderRadius: 24px`, `border: 2px solid #132664`) with an "Apply" button next to it. Max width 540px.

- Press `/` anywhere on the page to focus it
- Typing shows a floating dropdown (absolute positioned, `border: 2px solid #132664`, `borderRadius: 12px`, `maxHeight: 260px`, scrollable, `zIndex: 1001`)
- Each dropdown option shows: `{id}. {label}` on the left and a category badge on the right
- Highlighted option: `background: #132664`, `color: #ffffff`; idle: white/blue
- Arrow keys navigate, Enter selects, Escape closes
- Matching text in options is highlighted inline: matched portion gets `background: #132664`, `color: #ffffff`
- Clicking an option fills the input and closes the dropdown
- "Apply" button triggers the fetch for the selected insight
- While loading: button shows "Calculating..." and is disabled

To the right of the search bar, when a download function is registered: a "📥 Download Report" outline button appears (same height, `border: 2px solid #132664`, transparent background).

### Filter Optimizer Panel

After a user selects an insight, a validation panel appears below the search bar. It reads the current filters and checks against per-insight rules:

- Red border (`#dc3545`) + "Critical Filter Adjustment Required" for errors
- Amber border (`#ffc107`) + "Filter Optimization Recommendations" for warnings
- Green border (`#28a745`) + "Filters Optimized" for success

**Rules per insight:**

| Insight | Rule |
|---------|------|
| 14 | needs ≥7 days; warns if time filter is set |
| 15 | needs ≥3 days; warns if time filter is set |
| 23 | needs ≥3 days; warns if time filter is set |
| 12 | critical if <15 days |
| 2 | warns if only 1 zone selected |
| 3 | warns if only 1 city selected |
| 4 | warns if only 1 area selected |
| 26 | warns if only 1 brand selected |
| 6, 7, 8, 10, 29 | critical/warns if not exactly 1 brand selected |
| 1 | warns if only 1 brand selected |
| 18 | warns if not 7–14 days |
| 30, 31, 32 | critical if not exactly 1 brand selected; 31 also needs ≥3 days |

Each warning includes "⚡ Fix" action buttons that call `onUpdateFilters` to auto-correct (e.g., "⚡ Set date range to 7 days", "⚡ Select all brands (Clear brand filter)", "⚡ Select 'BrandName'").

### Default Dashboard

When no insight is active (page load), automatically fetch insight 1 (brand ratings) and insight 22 (lightweight reviews) in parallel and render a `DefaultDashboard` component showing brand-level overview cards.

### Error States

- `NO_DATA`: "No rating/insights data matches the selected global filters."
- `RATE_LIMITED`: "Rate limit reached. Please wait 60 seconds." + Retry button
- `ERROR`: "Analytical service unavailable. Please retry." + Retry button

---

## InsightResult Component

Routes each insightId to its specific renderer.

**Insights 1, 2, 3, 4** — render `<InsightSummaryPanel>` + a specialized dashboard component (BrandDashboard for id=1, LocationMatrixAndSummary for 2/3/4 with `locationKey` = "zone"/"city"/"area").

**Insight 21** — `CommentsInsight` (raw review comments viewer).

**Insights 16, 18, 19, 20** — `TextAIInsight` (AI-generated text display).

**All other insights** — `<InsightSummaryPanel>` + `<GenericTableInsight>`.

### Multi-Dimensional Breakdown

For insights 6, 7, 8, 9, 10, 11, 12, 14, 15, 23: the backend may return either:
- A plain array (flat overall data), OR
- `{ overall: [...], breakdown: [...], breakdownDims: [{field, label}, ...] }`

When `breakdownDims` is present and `breakdown` is non-empty, prepend dimension columns dynamically:
```js
const dimCols = breakdownDims.map((d, i) => ({ header: d.label, key: d.field, bold: i === 0 }))
// Then spread [...dimCols, ...insightSpecificCols]
```
Table title suffix: `" — by City > Brand"` etc.

**Per-insight columns (no breakdown):**

| insightId | Columns |
|-----------|---------|
| 6  | Item Name (bold), Average Rating, Total Reviews |
| 7  | Item Name (bold), Average Rating, Total Reviews |
| 8  | Item Name (bold), Average Rating, Total Reviews |
| 10 | Kitchen Area (bold), Average Rating, Total Reviews |
| 9  | Product Category (bold), Average Rating, Total Reviews |
| 11 | Star Rating (bold), Count of Reviews, Percentage |
| 12 | Month (bold), Average Rating |
| 14 | Day Category (bold), Average Rating, Total Reviews |
| 15 | Hour of Day (bold), Complaint Count (ratings ≤2★), Peak Status |
| 23 | Daypart Slot (bold), Average Rating, Total Reviews |
| 26 | City (bold), Best Brand, Best Avg, Worst Brand, Worst Avg |
| 27 | Outlet ID (bold), Area, Brand, Outlet Avg, Kitchen Avg, Rating Gap, Status |
| 28 | Outlet ID (bold), Outlet Name (Area), Best Item, Item Rating, Reviews Count |
| 29 | Item Name (bold), Average Rating, Reviews Count, Std Dev (Variance), Consistency |
| 30 | Item Name (bold), City, Average Rating, Reviews Count |
| 31 | Item Name (bold), Month, Average Rating, Reviews Count |
| 32 | Item Name (bold), Item Average, Company Average, Rating Gap, Performance Status |
| 17 | Fault Responsibility (bold), Classified Complaints Count, Percentage |

**Breakdown metric columns (after dim cols):**

| insightId | Breakdown metric cols |
|-----------|----------------------|
| 6  | Top Rated Item, Avg Rating, Reviews |
| 7  | Worst Rated Item, Avg Rating, Reviews |
| 8  | Best Selling Item, Total Orders, Avg Rating |
| 10 | Avg Rating, Total Reviews |
| 9  | Avg Rating, Total Reviews |
| 11 | Weighted Avg, Promoter %, Detractor %, Total Reviews |
| 12 | Avg Rating, Trend, Best Month, Worst Month |
| 14 | Weekday Avg, Wkdy Reviews, Weekend Avg, Wknd Reviews, Delta (Wknd−Wkdy) |
| 15 | Total Complaints, Peak Hour, Peak Hour Count |
| 23 | Overall Avg, Best Daypart, Best Avg, Worst Daypart, Worst Avg |

---

## GenericTableInsight Component

Reusable table component with:
- Title + close button (✕) header
- Search input (filters by `searchField` prop; only shown if `data.length > 5`)
- Sortable columns (click header → toggle asc/desc; shows ▲/▼/↕ indicator)
- Alternating row backgrounds (white / `rgba(19,38,100,0.01)`)
- Pagination: 25 rows per page, "Showing records X-Y of Z", Prev/Next buttons
- Column config: `[{ header, key, bold?, render? }]` — `render(value, row)` for custom cell display
- Excel download registration via `onRegisterDownload` prop (callback that receives a `getDownloadDataSheets` function returning `[{sheetName, rows}]`)
- Table header background: `#f4f6fa`, `fontWeight: 800`, `borderBottom: 2.5px solid rgba(19,38,100,0.2)`
- Card wrapper: `border: 1px solid rgba(19,38,100,0.15)`, `borderRadius: 12px`, `padding: 20px`

---

## InsightSummaryPanel Component

Renders above the table for each insight. Two sections stacked vertically with a 12px gap.

### Section 1 — AI Narrative Card

Signal themes:

| Signal | Gradient | Dot Color | Badge |
|--------|----------|-----------|-------|
| `good` | `linear-gradient(135deg, #064e3b 0%, #059669 100%)` | `#34d399` | ✓  On Track |
| `monitor` | `linear-gradient(135deg, #78350f 0%, #d97706 100%)` | `#fbbf24` | ⚠  Monitor |
| `warn` | `linear-gradient(135deg, #7f1d1d 0%, #dc2626 100%)` | `#f87171` | !  Action Required |

Card layout (white text, `borderRadius: 14px`, `padding: 20px 22px`, `boxShadow: 0 4px 20px rgba(0,0,0,0.18)`):

1. **Header row**: left side — 6px dot + "AI INSIGHT" label (9px, 800 weight, uppercase, 65% opacity); right side — signal badge pill (`background: rgba(255,255,255,0.18)`, `backdropFilter: blur(8px)`)
2. **Narrative text**: 14.5px, fontWeight 600, lineHeight 1.55
3. **Recommendation pill**: dark bg (`background: rgba(0,0,0,0.2)`, `backdropFilter: blur(4px)`), `💡` icon + "RECOMMENDATION" label (9px uppercase, 55% opacity) + action text (12px, 500 weight, 92% opacity)

### Section 2 — Key Metrics

"KEY METRICS" divider: label centered between two horizontal 1px lines (`rgba(19,38,100,0.1)`), 9px, 800 weight, uppercase.

Stat cards in a `flex, flexWrap: wrap, gap: 10px` row.

**StatCard** (`minWidth: 130px, flex: 1`):
- `borderLeft: 4px solid {leftColor}` — accent → `#132664`, warn → `#dc2626`, default → `#94a3b8`
- Background: accent → `#f5f7ff`, warn → `#fff5f5`, default → `#ffffff`
- Number color: accent → `#132664`, warn → `#dc2626`, default → `#1e293b`
- Label: 9px, 800 weight, uppercase, `rgba(19,38,100,0.42)`, letterSpacing 0.7px
- Value: 21px, 900 weight, lineHeight 1.05, letterSpacing -0.4px
- Detail: 10.5px, 500 weight, `rgba(19,38,100,0.52)`, lineHeight 1.4

### Narrative Generation (deterministic, no API calls)

Produces `{signal: "good"|"monitor"|"warn", text: string, action: string}`:

| insightId | Logic |
|-----------|-------|
| 1–4 | Compute rating spread. spread > 1.0 → warn, > 0.4 → monitor, else good. Text: "{Top} leads at {X}★ while {Bottom} trails at {Y}★ — a {spread}★ gap." Action: if spread > 1 → investigate weakest; else amplify best practices. |
| 6 | signal=good. "'{name}' is the portfolio champion at {X}★ — customers rate it consistently above the menu average." Action: ensure always in stock and featured. |
| 7 | signal=warn. "'{name}' is actively dragging ratings at {X}★ across {N} reviews — highest-risk item on your menu." Action: audit immediately — reformulate, retrain, or remove. |
| 8 | signal=monitor. "'{name}' is your highest-volume SKU — outsized influence on brand perception." Action: 0.1★ improvement affects thousands of customers — prioritise consistency. |
| 9 | Compare best/worst category. Gap > 1 → warn, > 0.5 → monitor. Text: "{Best} leads at {X}★ while {Worst} trails at {Y}★." |
| 10 | signal=warn. High order volume + low ratings = systemic issue. Action: immediate area-level audit. |
| 11 | NPS = (promoters−detractors)/total×100. NPS ≥ 30 → good, ≥ 0 → monitor, < 0 → warn. Text includes promoter/detractor counts. |
| 12 | Linear regression slope. slope > 0.005 → Rising (good), < −0.005 → Falling (warn), else Stable (monitor). Text includes best/worst month. |
| 14 | `|delta|` > 0.3 → warn, > 0.1 → monitor, else good. Text: "{better} orders score {X}★ — {delta}★ gap vs {worse}s." Action: staffing SOPs. |
| 15 | Always warn. "{peakHour} is the highest-complaint hour with {N} flagged windows — {pct}% of complaints concentrate here." Action: pre-position staff and QC checkpoints. |
| 17 | Always warn. "{cause} is primary driver at {pct}% of classified complaints." Action: corrective action on that department. |
| 23 | Gap > 0.5 → warn, > 0.2 → monitor. Best vs worst daypart comparison. Action: align worst daypart to best standards. |

### Stat Card Computation per Insight

| insightId | Stat Cards |
|-----------|-----------|
| 1 | Top Brand (accent), Weakest Brand (warn), Portfolio Avg, Rating Spread, Above Portfolio count, Total Reviews |
| 2 | Best Zone (accent), Weakest Zone (warn), Zone Fleet Avg, Zone Spread, Total Reviews |
| 3 | Best City (accent), Weakest City (warn), City Fleet Avg, City Spread, City Std Dev σ, Above Avg Cities |
| 4 | Best Area (accent), Worst Area (warn), Area Fleet Avg, Area Spread, Above Avg Areas, Total Reviews |
| 6/7/8/10 | Champion/Kill Candidate/Top Volume/Critical Area, Mean Rating, Median Rating, Std Dev σ, Rating Spread, Total Reviews |
| 9 | Best Category (accent), Weakest Category (warn), Category Mean, Category Gap, Above Portfolio count, Total Reviews |
| 11 | Weighted Avg★ (accent), Promoter Rate, Detractor Rate (warn if >20%), Satisfaction Score (NPS), 5★ Reviews, 1★ Reviews |
| 12 | Peak Month (accent), Worst Month (warn), Trend Direction, Monthly Volatility σ, Latest MoM Δ, Rating Range |
| 14 | Weekday Rating, Weekend Rating, Rating Delta, Higher Volume, Better Ratings, Total Reviews |
| 15 | Peak Hour (warn), Flagged Peak Hours, Peak Concentration %, Total Complaints, Safest Hour (accent), Zero-Complaint Hours |
| 17 | Primary Cause (warn), Kitchen %, Delivery %, Packaging %, Total Classified |
| 23 | Best Daypart (accent), Worst Daypart (warn), Daypart Spread, Busiest Slot, Slot Mean Avg, Total Reviews |
| 26 | Most Cities Won (accent), Most Cities Lost (warn), Avg City Gap, Largest City Gap, Cities Analyzed |
| 27 | Poor Outliers (warn if >0), Star Stores (accent), Normal Outlets, Fleet Mean Gap, Worst Outlet Gap (warn), Best Outlet Gap (accent) |
| 28 | Most Common #1 Item (accent), Fleet Best-Item Avg, Top 5 Avg, Bottom 5 Avg (warn), Outlets Analyzed, Unique #1 Items |
| 29 | Consistent SKUs (accent), Inconsistent SKUs (warn if >0), Moderate SKUs, Fleet Avg Variance, Most Consistent (accent), Most Volatile (warn) |
| 30 | Best Pairing (accent), Worst Pairing (warn), Mean Rating, Rating Spread, Cities Covered, Items Tracked |
| 31 | Peak Rating (accent), Lowest Rating (warn), Overall Trend, Rating Volatility σ, Months Tracked, Items Tracked |
| 32 | Company Baseline, Above Avg Items (accent), Below Avg Items (warn), Best Outperformer (accent), Biggest Laggard (warn), Avg Absolute Dev |

**Math utilities used internally:**
- `mean(arr)`, `median(arr)`, `stddev(arr)`, `range(arr)`, `pct(count, total)`
- `slope(vals)` — linear regression slope for trend detection
- `groupBy(rows, key)` — groups raw review rows by a field, returns `[{name, avg, count}]`
- `mode(arr)` — most frequent value

---

## DownloadDialog Component

Modal overlay for Excel export. Uses `SheetJS (xlsx)` library to generate `.xlsx` files. Accepts:
- `dataSheets: [{sheetName: string, rows: object[]}]`
- `onClose: () => void`

Shows a preview of what will be exported with a "Download Excel" button.

---

## API Layer (`ratingsApi.js`)

```js
const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";

async function fetchInsight(insightId, filters) {
  const res = await fetch(`${API_BASE}/api/insights/${insightId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(filters || {})
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to fetch insight");
  }
  return res.json();
}
```

Named exports: `fetchBrandRating` (1), `fetchZoneRating` (2), `fetchCityRating` (3), `fetchKitchenRating` (4), `fetchPlatformComparison` (5), `fetchTopSKU` (6), `fetchWorstSKU` (7), `fetchBestSellingSKU` (8), `fetchCategoryRating` (9), `fetchHighVolumeLowRating` (10), `fetchStarDistribution` (11), `fetchMoMTrend` (12), `fetchVolumeVsRating` (13), `fetchWeekendVsWeekday` (14), `fetchPeakBadHours` (15), `fetchRepeatComplaints` (16), `fetchDeliveryVsKitchen` (17), `fetchWeeklyBrief` (18), `fetchActionItems` (19), `fetchPackagingIssues` (20), `fetchRawReviews` (21), `fetchLightweightReviews` (22), `fetchHourlyDaypartSplit` (23), `fetchBestWorstBrandCity` (26), `fetchOutletKitchenGap` (27), `fetchBestItemOutlet` (28), `fetchSKUConsistency` (29), `fetchItemRatingCity` (30), `fetchItemTrendTime` (31), `fetchItemCompanyGap` (32).

> Note: Insights 1, 2, 3, 4 fetch their data via insight 22 (lightweight reviews) client-side.

---

## Backend API Contract

**`GET /api/filters`** → `{ masterData: [{brand, city, zone, area}, ...] }`

**`POST /api/insights/:id`** with body:
```json
{
  "brands": ["BrandA"],
  "cities": ["Bangalore", "Mumbai"],
  "zones": [],
  "areas": [],
  "dateFrom": "2025-07-01",
  "dateTo": "2025-07-25",
  "timeFrom": "",
  "timeTo": ""
}
```

Returns insight-specific data. For breakdown-capable insights (6, 7, 8, 9, 10, 11, 12, 14, 15, 23), when multiple filter dimensions have >1 value selected, returns:
```json
{
  "overall": [...],
  "breakdown": [...],
  "breakdownDims": [
    {"field": "city", "label": "City"},
    {"field": "brand_name", "label": "Brand"}
  ]
}
```

Breakdown dimension hierarchy (in order): cities → zones → areas → brands. Breakdown rows are grouped by composite key across all active dims (concatenated with `"|||"` separator internally).

When no breakdown applies, returns a flat array.

---

## DefaultDashboard Component

Shown on page load when no insight is selected. Receives `{ data: { brandRatings, reviews }, allBrands, masterData, onClose, onRegisterDownload }`.

**Data processing:**
- Groups `reviews` by `order_id` to compute unique order-level metrics (avoids double-counting rows per order)
- Per order group: collects all `restaurant_rating` values and whether any row has a comment
- Computes `companyRating` = mean of all per-order average ratings
- Counts: `totalOrders`, `totalOutlets` (unique `restaurant_id`), `totalBrandsCount` (unique `brand_name`), `totalFeedbacks` (orders with comments), `ratingsAbove4` (orders with avg ≥ 4.0), `ratingsBelow4`

**Layout (3 sections, 24px gap):**

1. **Company Hero Card** — centered, `padding: 30px 24px`:
   - "CUREFOODS" in 36px, 900 weight, letterSpacing 1px
   - `★ {companyRating}` in 32px, 900 weight
   - "Overall Company Rating" label in 11px, uppercase, muted

2. **Company Overview stats grid** — `gridTemplateColumns: repeat(auto-fill, minmax(160px, 1fr))`, 6 cards:
   - Brands, Outlets, Orders, Feedbacks, Ratings Above 4★, Ratings Below 4★
   - Each card: 22px value (900 weight), 11px title, 10px subtitle text

3. **Curefoods Brands pill row** — flex wrap, each brand as a pill with brand-specific color:
```js
const BRAND_COLORS = {
  cakezone:      { bg: "#fce7f3", text: "#db2777" },  // Pink
  eatfit:        { bg: "#dcfce7", text: "#15803d" },  // Green
  "chaat street":{ bg: "#fef9c3", text: "#a16207" },  // Yellow
  olio:          { bg: "#ffedd5", text: "#c2410c" },  // Orange
  ovenfresh:     { bg: "#fee2e2", text: "#b91c1c" },  // Red
  "krispy kreme":{ bg: "#d1fae5", text: "#047857" },  // Emerald
  lunchbox:      { bg: "#fef3c7", text: "#b45309" },  // Gold
  "firangi bake":{ bg: "#ffe4e6", text: "#be123c" },  // Rose
  "nomad pizza": { bg: "#fee2e2", text: "#991b1b" },  // Crimson
  default:       { bg: "#f1f5f9", text: "#475569" }
};
```
Pill: `padding: 8px 16px`, `borderRadius: 20px`, `border: 1px solid {text}33`, 12px, 700 weight. Match by `brandName.toLowerCase()`.

**Download sheets:** "Company Overview" (metric/value/detail rows) + "Brand Ratings" (from `data.brandRatings`).

---

## BrandDashboard Component

Used for insight 1. Receives `{ reviews, onClose, allBrands, masterData, onRegisterDownload }`.

**Data processing (order-level deduplication):**
- Groups `reviews` by composite key `{order_id}::{brand_name}` to get per-brand per-order stats
- Then aggregates to brand level: `ordersCount`, `feedbacksCount`, `ratings[]` (array of per-order avg ratings), `avg`, `ratingsAbove4`, `ratingsBelow4`
- From `masterData`, builds per-brand meta: `zones` (Set), `cities` (Set), `areas` (Set), `outletsCount`
- Zone abbreviations: North→"N", South→"S", East→"E", West→"W", joined as "N, S" etc.
- Sort: rated brands by avg descending; unrated brands after, alphabetical

**Layout (2 sections, 24px gap):**

1. **Brand Cards grid** — `gridTemplateColumns: repeat(auto-fill, minmax(130px, 1fr))`, `gap: 12px`:
   - Each card: brand name (12px, 800 weight, ellipsis overflow) + `★ {avg}` (13px, 800 weight)
   - Pagination: 100 per page

2. **Brand Summary table** (inside Card with `maxHeight: 400px` scroll):
   - **Frozen first column** (sticky left, zIndex 9): `borderRight: 2.5px solid rgba(19,38,100,0.2)`
   - Sticky header row (top=0, zIndex 10–20): `backgroundColor: #f4f6fa`
   - Columns: Brand (frozen), Rating, Zones, Cities, Areas, Outlets, Orders, Feedbacks, Above 4★, Below 4★
   - **Grand Total row** at bottom: `backgroundColor: #e8ebf5`, 800 weight, shows fleet-wide totals
   - Alternating row backgrounds

**Download sheet:** "Brand Summary" with all columns.

---

## LocationMatrixAndSummary Component

Used for insights 2, 3, 4. Receives `{ reviews, locationKey, locationTitle, onClose, allBrands, masterData, onRegisterDownload }`. `locationKey` is `"zone"` / `"city"` / `"area"`, `locationTitle` is `"Zone"` / `"City"` / `"Area"`.

**Data processing:**
- Groups reviews by composite key `{order_id}::{location}::{brand}` for order-level deduplication
- Builds two data structures: `matrixMap` (location → brand → {sum, count}) and `summaryGroupMap` (location+brand → {ratings, ordersCount, feedbacksCount})
- Also reads `masterData` for outlet/city/area counts per location+brand combination
- `sortedLocations`: sorted by avg rating descending
- Summary rows: sorted by location alphabetically (zone uses custom order: North=1, South=2, East=3, West=4), then brand alphabetically

**Rating cell color coding:**
```js
≥ 4.0  → background: #132664 (dark blue), text: #ffffff
≥ 3.0  → background: rgba(19, 38, 100, 0.45), text: #132664
< 3.0  → background: rgba(19, 38, 100, 0.12), text: #132664
null   → transparent
```

**Layout (2 cards, 24px gap):**

1. **Location × Brand Cards** (Card with `padding: 24px`):
   - Title: `"{locationTitle} × Brand Ratings"`, close button, color legend (≥4.0 / 3.0-3.9 / ≤2.9)
   - Grid: `gridTemplateColumns: repeat(auto-fill, minmax(290px, 1fr))`, `maxHeight: 540px`, scrollable
   - Each location card: border `1px solid rgba(19,38,100,0.12)`, `borderRadius: 12px`, `padding: 16px`
     - Header: location name (800 weight) + "{N} active outlets" (muted, right)
     - Brand pills (only brands present in masterData for this location): `padding: 4px 10px`, `borderRadius: 20px`, 10px font, color-coded by rating
     - Footer (dashed border top): "Location Avg: {X}★"
   - Pagination: 100 locations per page

2. **Summary Table** (Card with sticky headers and frozen first column):
   - Columns: `{locationTitle}` (frozen), Brand, Rating, [Cities if locationKey≠city], [Areas if locationKey≠area], Outlets, Orders, Feedbacks, Above 4★, Below 4★
   - `maxHeight: 400px` scrollable
   - Alternating row backgrounds
   - Pagination: 100 rows per page

**Download sheets:** `"{locationTitle} Matrix"` (location × brand rating grid) + `"{locationTitle} Summary"` (flat table).

---

## CommentsInsight Component

Used for insight 21. Receives `{ reviews, onClose, onRegisterDownload }`.

**Layout:**
- Card with `overflowX: auto`
- Title "Comments Insight" + close button
- Scrollable table container: `maxHeight: 600px`, both axes scrollable, `border: 1px solid rgba(19,38,100,0.15)`
- **Header row**: `backgroundColor: #132664`, `color: #ffffff` (inverted — unlike other tables)
- 17 columns: Review ID (sticky frozen left, zIndex 10), Outlet ID, Restaurant ID, Brand Name, Business Entity, City, Area, Zone, Order ID, Date, Ordered Time, GMV Total, Item Name, Comments, Rating, Post Status, Updated At
- Comments cell: `whiteSpace: pre-wrap` (preserves line breaks)
- Ordered Time and Updated At: formatted with `new Date(val).toLocaleString()`
- GMV Total: formatted with `Number(val).toFixed(2)`
- Rating: appends ★ symbol
- 100 rows per page

**Download sheet:** "Comments" with all 17 field columns.

---

## TextAIInsight Component

Used for insights 16, 18, 19, 20. Receives `{ title, textContent, onClose, onRegisterDownload }`.

**Layout:**
- Card with `padding: 24px`
- Header: ✨ icon + title (15px, 800 weight) + close button; `borderBottom: 2px solid rgba(19,38,100,0.15)`
- Content box: `backgroundColor: rgba(19,38,100,0.02)`, `border: 1px solid rgba(19,38,100,0.08)`, `borderRadius: 8px`, `padding: 20px`, `maxHeight: 400px`, `overflowY: auto`, `fontSize: 13px`

**Text rendering** (splits `textContent` on `"\n"`):
- Lines starting with `-` or `*` → render as `<li>` with `marginBottom: 8px`, `lineHeight: 1.6`
- Lines containing `:` → render as `<p>` with `fontWeight: 700`
- All other lines → `<p>` with `fontWeight: 500`, `margin: 0 0 10px 0`, `lineHeight: 1.6`

**Download sheet:** "AI Summary" with single column "AI Operations Report".

---

## DownloadDialog Component

**Full-featured export modal.** Libraries required: `xlsx-js-style` (styled Excel), `jspdf` + `jspdf-autotable` (PDF), native Blob API (CSV/HTML).

**UI (fixed overlay modal, 380px wide):**
- Backdrop: `backgroundColor: rgba(19,38,100,0.4)`
- Card: white, `borderRadius: 12px`, `padding: 24px`, `boxShadow: 0 4px 20px rgba(19,38,100,0.15)`

**Controls:**
1. **Format selector** — 4 toggle buttons (flex row): XLSX, CSV, PDF, HTML. Active: `background: #132664`, `color: #fff`. Idle: transparent, blue border.
2. **Destination selector** — 2 buttons: Device / Email. Same toggle style.
3. **Email input** — appears only when destination=email. `<input type="email">`, full width.
4. **Status message** — success=green bg/text (`#dcfce7` / `#15803d`), error=red (`#fee2e2` / `#b91c1c`), loading=slate.
5. **Footer** — Cancel button (outline) + Download/Send button (`background: #132664`).

**Export behaviors:**

- **XLSX**: Uses `xlsx-js-style`. Creates workbook with one sheet per `{sheetName, rows}` entry. Detects "Matrix" sheets by name and applies matrix cell styles; other sheets get standard alternating row styles.
  - Matrix styles: header row → dark blue bg + white text; cells ≥4.0 → `#132664` + white; 3.0-3.9 → `#AEBDEC` + blue; >0 → `#E4E8F5` + blue; totals → `#E8EBF5` + blue.
  - Standard styles: header row → dark blue + white; body alternates white / `#F9FAFC`.
  - Font: Helvetica throughout, 10px headers / 9px body.

- **CSV**: Converts first sheet only to CSV via SheetJS. Downloads as `.csv`.

- **PDF**: Uses `jsPDF` (landscape if any Matrix sheet or >6 columns, else portrait). One page per sheet. Header: "CUREFOODS RATINGS REPORT" in blue + timestamp. Uses `autoTable` with matching color logic:
  - Matrix cells: ≥4.0 → `[19,38,100]` fill + white; 3.0-3.9 → `[174,187,222]` + blue; <3 → `[228,232,245]` + blue; totals → `[232,235,245]`.
  - Font auto-scales (4.5px–7px) based on column count to prevent overflow.

- **HTML**: Generates a standalone `.html` file with embedded CSS matching the app's visual style (dark blue headers, color-coded matrix cells, alternating row stripes, sticky headers). Downloads as `.html`.

- **Email**: All formats can be sent via `POST /api/insights/send-email` with `{ email, subject, body, fileName, fileBase64 }`. The file is base64-encoded before sending.

---

## CSS Keyframe

Add globally in `index.css`:
```css
@keyframes spin {
  to { transform: rotate(360deg); }
}
```

Loading spinner pattern:
```js
{
  width: 14, height: 14,
  border: "2px solid #132664",
  borderTopColor: "transparent",
  borderRadius: "50%",
  animation: "spin 0.6s linear infinite"
}
```

---

## File Structure

```
src/
  main.jsx
  App.jsx                          # Layout, global filters, page routing
  Sidebar.jsx                      # Collapsible nav sidebar
  features/
    ratings/
      RatingsPage.jsx              # Command palette, filter optimizer, insight loader
      InsightResult.jsx            # Routes insightId → correct renderer
      ratingsApi.js                # All API fetch functions
      insights/
        InsightSummaryPanel.jsx    # AI narrative card + stat cards
        GenericTableInsight.jsx    # Reusable sortable/paginated/searchable table
        DownloadDialog.jsx         # Excel export modal
        DefaultDashboard.jsx       # Brand overview shown on page load
        BrandDashboard.jsx         # For insight 1 (brand comparison)
        LocationMatrixAndSummary.jsx  # For insights 2, 3, 4 (zone/city/area matrix)
        CommentsInsight.jsx        # For insight 21 (raw review viewer)
        TextAIInsight.jsx          # For insights 16, 18, 19, 20 (AI text output)
    toggle/
      TogglePage.jsx
    timing/
      TimingPage.jsx
    reviews/
      ReviewsPage.jsx
    backfilling/
      RouteBackfillingPage.jsx
```
