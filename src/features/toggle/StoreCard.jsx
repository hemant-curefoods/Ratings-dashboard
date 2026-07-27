import { useState } from "react";
import { C, FONT } from "../../theme";

const BRAND_COLOR = {
  "Cake Zone": "#d97706",
  "Ovenfresh": "#132664",
  "EatFit": "#15803d",
};

export default function StoreCard({ store, onToggle, isBulking }) {
  const [loading, setLoading] = useState(false);
  const [hovered, setHovered] = useState(false);
  const isOnline = store.status === "online";
  const busy = loading || isBulking;

  const handleClick = async () => {
    if (busy) return;
    setLoading(true);
    await onToggle(store, isOnline ? "disable" : "enable");
    setLoading(false);
  };

  const brandColor = BRAND_COLOR[store.brand] || C.primary;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        backgroundColor: "#ffffff",
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        opacity: busy ? 0.7 : 1,
        transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
        boxShadow: hovered ? "0 8px 24px rgba(19,38,100,0.12)" : "0 2px 8px rgba(19,38,100,0.04)",
        transform: hovered ? "translateY(-2px)" : "none",
        fontFamily: FONT,
      }}
    >
      {/* Status bar */}
      <div style={{ height: 4, backgroundColor: isOnline ? "#22c55e" : "#ef4444", transition: "background-color 0.3s" }} />

      <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
        {/* Brand badge + status */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <span style={{ fontSize: 10, fontWeight: 800, color: brandColor, textTransform: "uppercase", letterSpacing: 0.8, backgroundColor: `${brandColor}12`, borderRadius: 6, padding: "3px 7px" }}>
            {store.brand}
          </span>
          <span style={{ fontSize: 10, fontWeight: 800, color: isOnline ? "#15803d" : "#dc2626", border: `1px solid ${isOnline ? "#15803d" : "#dc2626"}33`, borderRadius: 20, padding: "3px 9px" }}>
            {isOnline ? "ONLINE" : "OFFLINE"}
          </span>
        </div>

        {/* Store name */}
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: C.primary, lineHeight: 1.3 }}>{store.name}</div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>
            {[store.city, store.zone].filter(Boolean).join(" · ")}
          </div>
          <div style={{ fontSize: 10, color: C.muted, marginTop: 2, fontFamily: "monospace" }}>{store.location_id}</div>
        </div>

        {/* Toggle button */}
        <button
          onClick={handleClick}
          disabled={busy}
          style={{
            marginTop: "auto",
            padding: "8px 0",
            borderRadius: 8,
            border: "none",
            fontSize: 12,
            fontWeight: 800,
            cursor: busy ? "not-allowed" : "pointer",
            fontFamily: FONT,
            transition: "all 0.2s",
            backgroundColor: isOnline ? "#fee2e2" : "#dcfce7",
            color: isOnline ? "#b91c1c" : "#15803d",
          }}
        >
          {loading ? "Working…" : isOnline ? "Disable" : "Enable"}
        </button>
      </div>
    </div>
  );
}
