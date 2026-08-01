import { useCallback, useEffect, useState } from "react";
import { C, FONT, cardStyle, pillButton, spinnerStyle } from "../../theme";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

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
  const [generating, setGenerating] = useState({});
  const [approving, setApproving] = useState({});
  const [replies, setReplies] = useState({});

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

  const generate = async (review) => {
    setGenerating((g) => ({ ...g, [review.id]: true }));
    try {
      const res = await fetch(`${API_BASE}/api/reviews/${review.id}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ review_text: review.review_text, star_rating: review.star_rating, store_name: review.store_name, brand: review.brand }),
      });
      const d = await res.json();
      if (d.reply) setReplies((r) => ({ ...r, [review.id]: d.reply }));
    } finally {
      setGenerating((g) => { const n = { ...g }; delete n[review.id]; return n; });
    }
  };

  const approve = async (review) => {
    const replyText = replies[review.id];
    if (!replyText) return;
    setApproving((a) => ({ ...a, [review.id]: true }));
    try {
      await fetch(`${API_BASE}/api/reviews/${review.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ replyText, name: review.name }),
      });
      setReplies((r) => { const n = { ...r }; delete n[review.id]; return n; });
      setReviews((rv) => rv.map((r) => r.id === review.id ? { ...r, status: "replied", final_reply: replyText } : r));
    } finally {
      setApproving((a) => { const n = { ...a }; delete n[review.id]; return n; });
    }
  };

  const discardReply = (id) => setReplies((r) => { const n = { ...r }; delete n[id]; return n; });

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

      {reviews.map((review) => {
        const draft = replies[review.id];
        const isReplied = review.status === "replied" || Boolean(review.final_reply);

        return (
          <div key={review.id} style={{ ...cardStyle, padding: "18px 20px", opacity: isReplied ? 0.72 : 1 }}>
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

            {isReplied && review.final_reply && (
              <div style={{ marginTop: 10, padding: "10px 14px", borderRadius: 8, backgroundColor: "#f0fdf4", border: "1px solid #86efac", fontSize: 12, color: "#15803d" }}>
                <span style={{ fontWeight: 800 }}>Reply posted: </span>{review.final_reply}
              </div>
            )}

            {!isReplied && (
              <div style={{ marginTop: 14 }}>
                {draft ? (
                  <>
                    <div style={{ padding: "10px 14px", borderRadius: 8, backgroundColor: "#f8fafc", border: `1px solid ${C.border}`, fontSize: 12, color: C.text, lineHeight: 1.65, marginBottom: 10 }}>
                      <span style={{ fontWeight: 800, color: C.primary }}>AI Draft: </span>{draft}
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button
                        style={{ ...pillButton(true), fontSize: 11, padding: "7px 18px", display: "flex", alignItems: "center", gap: 6 }}
                        onClick={() => approve(review)}
                        disabled={approving[review.id]}
                      >
                        {approving[review.id] ? <Spin white /> : "✓"} Approve & Post
                      </button>
                      <button style={{ ...pillButton(false), fontSize: 11, padding: "7px 18px" }} onClick={() => generate(review)} disabled={generating[review.id]}>
                        Regenerate
                      </button>
                      <button style={{ ...pillButton(false), fontSize: 11, padding: "7px 18px" }} onClick={() => discardReply(review.id)}>
                        Discard
                      </button>
                    </div>
                  </>
                ) : (
                  <button
                    style={{ ...pillButton(false), fontSize: 11, padding: "7px 18px", display: "flex", alignItems: "center", gap: 6 }}
                    onClick={() => generate(review)}
                    disabled={generating[review.id]}
                  >
                    {generating[review.id] ? <><Spin /> Generating…</> : "✨ Generate AI Reply"}
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
