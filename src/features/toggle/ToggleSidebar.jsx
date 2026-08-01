import { useState } from "react";
import { getAuthHeaders } from "../../api";
import { C, FONT } from "../../theme";
import ActivityLog from "./ActivityLog";

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? "" : "http://localhost:3001");

const TAB = ["Health", "Recent", "Problems"];

async function post(path, body) {
  return fetch(`${API_BASE}${path}`, { headers: getAuthHeaders(), 
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export default function ToggleSidebar({ data, fetchData }) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("Health");

  const { apiHealth, recentActions = [], problemStores = [], dailyStats = {} } = data || {};

  const resolveProblems = (id, endpoint) =>
    post(`/api/toggle/problem/${endpoint}`, { id }).then(fetchData);

  return (
    <>
      {/* Floating open button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          style={{
            position: "fixed",
            right: 0,
            top: "50%",
            transform: "translateY(-50%)",
            backgroundColor: C.primary,
            color: "#fff",
            border: "none",
            borderRadius: "10px 0 0 10px",
            padding: "14px 10px",
            cursor: "pointer",
            fontFamily: FONT,
            fontSize: 11,
            fontWeight: 800,
            writingMode: "vertical-rl",
            letterSpacing: 1,
            zIndex: 400,
            boxShadow: "-4px 0 16px rgba(19,38,100,0.15)",
          }}
        >
          STATUS ▲
        </button>
      )}

      {/* Sidebar panel */}
      <div
        style={{
          position: "fixed",
          top: 0,
          right: isOpen ? 0 : -340,
          width: 320,
          height: "100vh",
          backgroundColor: "#ffffff",
          borderLeft: `2px solid ${C.border}`,
          boxShadow: isOpen ? "-8px 0 32px rgba(19,38,100,0.12)" : "none",
          transition: "right 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          zIndex: 450,
          display: "flex",
          flexDirection: "column",
          fontFamily: FONT,
          overflowY: "auto",
        }}
      >
        {/* Header */}
        <div style={{ padding: "18px 20px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: C.primary }}>System Status</div>
          <button onClick={() => setIsOpen(false)} style={{ background: "none", border: "none", fontSize: 20, color: C.muted, cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, padding: "12px 20px", borderBottom: `1px solid ${C.border}` }}>
          {TAB.map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              style={{
                flex: 1,
                padding: "6px 0",
                borderRadius: 8,
                border: `1.5px solid ${C.primary}`,
                backgroundColor: activeTab === t ? C.primary : "transparent",
                color: activeTab === t ? "#fff" : C.primary,
                fontSize: 11,
                fontWeight: 800,
                cursor: "pointer",
                fontFamily: FONT,
              }}
            >
              {t}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, padding: "16px 20px", overflowY: "auto" }}>
          {/* Health tab */}
          {activeTab === "Health" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                { label: "API Status", value: apiHealth?.status ?? "—" },
                { label: "Requests / min", value: apiHealth ? `${apiHealth.requestsThisMinute} / ${apiHealth.maxLimit}` : "—" },
                { label: "Today Successes", value: dailyStats.successCount ?? "—" },
                { label: "Problem Stores", value: dailyStats.problemCount ?? "—" },
                { label: "Last Sync", value: apiHealth?.lastSyncTime ? new Date(apiHealth.lastSyncTime).toLocaleTimeString("en-IN") : "—" },
              ].map((r) => (
                <div key={r.label} style={{ display: "flex", justifyContent: "space-between", padding: "9px 12px", borderRadius: 8, backgroundColor: "rgba(19,38,100,0.03)", border: `1px solid ${C.border}` }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: C.muted }}>{r.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 800, color: C.primary }}>{r.value}</span>
                </div>
              ))}
            </div>
          )}

          {/* Recent tab */}
          {activeTab === "Recent" && <ActivityLog actions={recentActions} />}

          {/* Problems tab */}
          {activeTab === "Problems" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {problemStores.length === 0 ? (
                <div style={{ fontSize: 12, color: C.muted, padding: "12px 0" }}>No problem stores — all clear.</div>
              ) : problemStores.map((s) => (
                <div key={s.id} style={{ border: "1px solid rgba(220,53,69,0.2)", borderRadius: 10, padding: "10px 12px", backgroundColor: "#fff5f5" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.primary }}>{s.store_name || s.name}</div>
                  <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>
                    {s.brand} · {s.store_id || s.location_id} · {s.fail_count || 1} fail(s)
                  </div>
                  <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                    <button
                      onClick={() => resolveProblems(s.id, "retry")}
                      style={{ flex: 1, padding: "5px 0", borderRadius: 7, border: `1.5px solid ${C.primary}`, backgroundColor: "transparent", color: C.primary, fontSize: 10, fontWeight: 800, cursor: "pointer", fontFamily: FONT }}
                    >
                      Retry
                    </button>
                    <button
                      onClick={() => resolveProblems(s.id, "force-sync")}
                      style={{ flex: 1, padding: "5px 0", borderRadius: 7, border: "none", backgroundColor: C.primary, color: "#fff", fontSize: 10, fontWeight: 800, cursor: "pointer", fontFamily: FONT }}
                    >
                      Force Sync
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Backdrop */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          style={{ position: "fixed", inset: 0, zIndex: 440, backgroundColor: "rgba(19,38,100,0.08)" }}
        />
      )}
    </>
  );
}
