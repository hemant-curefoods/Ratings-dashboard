import { C, FONT } from "../../theme";

export default function ActivityLog({ actions = [] }) {
  if (!actions.length) {
    return <div style={{ fontSize: 12, color: C.muted, padding: "12px 0" }}>No recent activity.</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 340, overflowY: "auto" }}>
      {actions.map((a, i) => {
        const ok = a.result === "SUCCESS";
        return (
          <div
            key={i}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 10,
              padding: "8px 12px",
              borderRadius: 8,
              backgroundColor: ok ? "#f0fdf4" : "#fff5f5",
              border: `1px solid ${ok ? "#bbf7d0" : "#fecaca"}`,
              fontFamily: FONT,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.primary, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {a.store_name || "—"}
              </div>
              <div style={{ fontSize: 10, color: C.muted, marginTop: 1 }}>
                {new Date(a.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
              <span style={{ fontSize: 10, fontWeight: 800, color: a.action === "ENABLE" ? "#15803d" : "#b91c1c" }}>
                {a.action}
              </span>
              <span style={{ fontSize: 10, fontWeight: 800, color: ok ? "#15803d" : "#b91c1c", backgroundColor: ok ? "#dcfce7" : "#fee2e2", borderRadius: 6, padding: "2px 6px" }}>
                {a.result}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
