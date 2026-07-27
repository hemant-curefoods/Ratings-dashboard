import React from "react";

export default function DineInReviewsPage() {
  return (
    <div style={{ padding: "24px 28px", overflowY: "auto", height: "100%", boxSizing: "border-box" }}>
      <div style={{ marginBottom: 16, padding: "12px 16px", background: "#0c1117", borderRadius: 8, border: "1px solid #3b82f6", borderLeft: "3px solid #3b82f6" }}>
        <div style={{ fontSize: 12, color: "#3b82f6", fontFamily: "'JetBrains Mono', monospace", marginBottom: 4 }}>GOOGLE DINE-IN REVIEWS</div>
        <div style={{ fontSize: 12, color: "#a0b4c8" }}>
          AI Automated Reply System. Monitor recent reviews and auto-generate intelligent, contextual responses.
        </div>
      </div>
      
      <div style={{ color: "#e2e8f0", fontSize: 14, marginTop: 60, textAlign: "center", opacity: 0.6 }}>
        Review automation dashboard is initializing...
      </div>
    </div>
  );
}