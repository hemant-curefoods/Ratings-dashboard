import { useCallback, useEffect, useState } from "react";
import { C, FONT, cardStyle, pillButton, spinnerStyle } from "../../theme";

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? "" : "http://localhost:3001");

const STAR_COLOR = { 5: "#15803d", 4: "#2563eb", 3: "#b45309", 2: "#dc2626", 1: "#7f1d1d" };

function StarBadge({ rating }) {
  const color = STAR_COLOR[rating] || C.primary;
  return (
    <span style={{ fontSize: 12, fontWeight: 800, color, border: `1.5px solid ${color}33`, borderRadius: 20, padding: "4px 10px", whiteSpace: "nowrap" }}>
      ★ {rating}.0
    </span>
  );
}

function Spin({ white }) {
  return (
    <span style={{ ...spinnerStyle, width: 11, height: 11, ...(white ? { borderColor: "#fff", borderTopColor: "transparent" } : {}) }} />
  );
}

export default function ReviewsPage() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch(`${API_BASE}/api/reviews`)
      .then((r) => r.json())
      .then((d) => setReviews(Array.isArray(d) ? d : d.reviews || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const fetchNew = async () => {
    setFetching(true);
    try {
      const res = await fetch(`${API_BASE}/api/reviews/fetch-new`);
      const d = await res.json();
      if (d.reviews) setReviews(Array.isArray(d.reviews) ? d.reviews : []);
    } catch (e) {
      setError(e.message);
    } finally {
      setFetching(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, fontFamily: FONT }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <div style={{ fontSize: 13, color: C.muted }}>
          {reviews.length} review{reviews.length !== 1 ? "s" : ""} loaded
        </div>
        <button style={{ ...pillButton(true), display: "flex", alignItems: "center", gap: 7 }} onClick={fetchNew} disabled={fetching || loading}>
          {fetching ? <Spin white /> : null}
          {fetching ? "Fetching…" : "↻ Fetch New Reviews"}
        </button>
      </div>

      {loading && (
        <div style={{ ...cardStyle, display: "flex", alignItems: "center", gap: 10, padding: 20 }}>
          <span style={spinnerStyle} />
          <span style={{ fontSize: 13, color: C.muted }}>Loading reviews…</span>
        </div>
      )}

      {error && (
        <div style={{ ...cardStyle, padding: 20, backgroundColor: "#fee2e2", borderColor: "#dc3545" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#b91c1c" }}>{error}</div>
          <button style={{ ...pillButton(true), marginTop: 12, fontSize: 12 }} onClick={load}>Retry</button>
        </div>
      )}

      {!loading && !error && reviews.length === 0 && (
        <div style={{ ...cardStyle, padding: 28, textAlign: "center" }}>
          <div style={{ fontSize: 13, color: C.muted }}>No reviews loaded. Click "Fetch New Reviews" to pull from Google.</div>
        </div>
      )}

      {reviews.map((review) => (
        <div key={review.id} style={{ ...cardStyle, padding: "18px 20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: C.primary }}>{review.reviewer_name || "Anonymous"}</div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                {[review.store_name, review.brand, review.review_date ? new Date(review.review_date).toLocaleDateString("en-IN") : null].filter(Boolean).join(" · ")}
              </div>
            </div>
            <StarBadge rating={review.star_rating} />
          </div>

          <div style={{ fontSize: 12.5, color: C.text, marginTop: 10, lineHeight: 1.65 }}>
            {review.review_text}
          </div>
        </div>
      ))}
    </div>
  );
}
