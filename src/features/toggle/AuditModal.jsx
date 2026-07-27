import { useEffect, useMemo, useState } from "react";
import { C, FONT } from "../../theme";

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? "" : "http://localhost:3001");

export default function AuditModal({ onClose, stores = [], selectedBrand = "" }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSystemSyncs, setShowSystemSyncs] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/api/toggle/audit-log`)
      .then((r) => r.json())
      .then((d) => setLogs(d.logs || []))
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  }, []);

  // Only show logs for stores belonging to the currently selected brand.
  // When no brand is selected (""), show all.
  const validStoreIds = useMemo(() => {
    if (!selectedBrand) return null;
    return new Set(stores.filter((s) => s.brand === selectedBrand).map((s) => s.location_id));
  }, [stores, selectedBrand]);

  const filteredLogs = useMemo(
    () =>
      logs.filter((log) => {
        if (!showSystemSyncs && log.is_automated) return false;
        if (validStoreIds && !validStoreIds.has(log.store_id)) return false;
        return true;
      }),
    [logs, showSystemSyncs, validStoreIds]
  );

  return (
    <div
      style={{ position: "fixed", inset: 0, backgroundColor: "rgba(19,38,100,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000, fontFamily: FONT }}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={{ width: "min(860px, 94vw)", maxHeight: "82vh", backgroundColor: "#ffffff", borderRadius: 16, display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 16px 48px rgba(19,38,100,0.22)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 24px", borderBottom: `1px solid ${C.border}` }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: C.primary }}>
              Toggle Audit Log{selectedBrand ? ` (${selectedBrand})` : ""}
            </div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>Full history of all toggle actions</div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: C.muted, cursor: "pointer", userSelect: "none" }}>
              <input
                type="checkbox"
                checked={showSystemSyncs}
                onChange={(e) => setShowSystemSyncs(e.target.checked)}
                style={{ accentColor: C.primary, cursor: "pointer" }}
              />
              System syncs
            </label>
            <a
              href={`${API_BASE}/api/history/download`}
              style={{ fontSize: 12, fontWeight: 700, color: C.primary, textDecoration: "none", border: `1.5px solid ${C.primary}`, borderRadius: 8, padding: "6px 14px" }}
            >
              ⬇ CSV
            </a>
            <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, color: C.muted, cursor: "pointer", lineHeight: 1 }}>×</button>
          </div>
        </div>

        <div style={{ overflowY: "auto", flex: 1 }}>
          {loading ? (
            <div style={{ padding: 32, textAlign: "center", color: C.muted, fontSize: 13 }}>Loading…</div>
          ) : filteredLogs.length === 0 ? (
            <div style={{ padding: 32, textAlign: "center", color: C.muted, fontSize: 13 }}>
              No recent activity for {selectedBrand || "all brands"}.
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead style={{ position: "sticky", top: 0 }}>
                <tr style={{ backgroundColor: C.primary, color: "#fff" }}>
                  {["Store Name", "Store ID", "By", "Action", "Result", "Time"].map((h) => (
                    <th key={h} style={{ padding: "9px 14px", textAlign: "left", fontWeight: 700, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((l, i) => {
                  const ok = l.result === "SUCCESS";
                  return (
                    <tr key={i} style={{ backgroundColor: i % 2 ? "rgba(19,38,100,0.01)" : "#fff" }}>
                      <td style={{ padding: "7px 14px", color: C.text }}>{l.store_name}</td>
                      <td style={{ padding: "7px 14px", color: C.muted, fontFamily: "monospace", fontSize: 11 }}>{l.store_id}</td>
                      <td style={{ padding: "7px 14px", color: C.muted }}>
                        {l.is_automated ? (
                          <span style={{ fontSize: 10, fontWeight: 800, color: "#fff", backgroundColor: C.primary, borderRadius: 6, padding: "2px 7px" }}>🤖 Bot</span>
                        ) : (
                          l.email || "—"
                        )}
                      </td>
                      <td style={{ padding: "7px 14px", fontWeight: 700, color: l.action === "ENABLE" ? "#15803d" : "#b91c1c" }}>{l.action}</td>
                      <td style={{ padding: "7px 14px", fontWeight: 800, color: ok ? "#15803d" : "#b91c1c" }}>{l.result}</td>
                      <td style={{ padding: "7px 14px", color: C.muted, whiteSpace: "nowrap" }}>
                        {new Date(l.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
