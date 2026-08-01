import { getAuthHeaders, handleApiError } from "../../api";
const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? "" : "http://localhost:3001");

export async function fetchInsight(insightId, filters) {
  const res = await fetch(`${API_BASE}/api/insights/${insightId}`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(filters || {}),
  });
  if (handleApiError(res)) throw new Error("Session expired. Redirecting to login...");
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to fetch insight");
  }
  return res.json();
}

export async function fetchFilters() {
  const res = await fetch(`${API_BASE}/api/filters`, { headers: getAuthHeaders() });
  if (handleApiError(res)) throw new Error("Session expired");
  if (!res.ok) throw new Error("Failed to fetch filters");
  return res.json();
}

const make = (id) => (filters) => fetchInsight(id, filters);

export const fetchBrandRating = make(1);
export const fetchZoneRating = make(2);
export const fetchCityRating = make(3);
export const fetchKitchenRating = make(4);
export const fetchPlatformComparison = make(5);
export const fetchTopSKU = make(6);
export const fetchWorstSKU = make(7);
export const fetchBestSellingSKU = make(8);
export const fetchCategoryRating = make(9);
export const fetchHighVolumeLowRating = make(10);
export const fetchStarDistribution = make(11);
export const fetchMoMTrend = make(12);
export const fetchVolumeVsRating = make(13);
export const fetchWeekendVsWeekday = make(14);
export const fetchPeakBadHours = make(15);
export const fetchRepeatComplaints = make(16);
export const fetchDeliveryVsKitchen = make(17);
export const fetchWeeklyBrief = make(18);
export const fetchActionItems = make(19);
export const fetchPackagingIssues = make(20);
export const fetchRawReviews = make(21);
export const fetchLightweightReviews = make(22);
export const fetchHourlyDaypartSplit = make(23);
export const fetchBestWorstBrandCity = make(26);
export const fetchOutletKitchenGap = make(27);
export const fetchBestItemOutlet = make(28);
export const fetchSKUConsistency = make(29);
export const fetchItemRatingCity = make(30);
export const fetchItemTrendTime = make(31);
export const fetchItemCompanyGap = make(32);

export async function sendReportEmail(payload) {
  const res = await fetch(`${API_BASE}/api/insights/send-email`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to send email");
  return res.json();
}
