import { C, FONT, pillButton } from "../../theme";

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? "" : "http://localhost:3001");

async function post(path, body) {
  return fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export default function BulkProgressIsland({ activeBulkJob, fetchData }) {
  if (!activeBulkJob || ["COMPLETED", "CANCELLED"].includes(activeBulkJob.status)) return null;

  const { id, action, total_stores, pending_count, status } = activeBulkJob;
  const done = total_stores - pending_count;
  const pct = total_stores > 0 ? Math.round((done / total_stores) * 100) : 0;

  const handlePause = () => post("/api/toggle/bulk/pause", { jobId: id }).then(fetchData);
  const handleResume = () => post("/api/toggle/bulk/resume", { jobId: id }).then(fetchData);
  const handleCancel = () => { if (confirm("Cancel this bulk job?")) post("/api/toggle/bulk/cancel", { jobId: id }).then(fetchData); };

  return (
    <div style={{ ...C, position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 500, backgroundColor: "#ffffff", border: `2px solid ${C.primary}`, borderRadius: 16, padding: "16px 22px", boxShadow: "0 8px 32px rgba(19,38,100,0.18)", minWidth: 340, fontFamily: FONT }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: C.primary }}>
            Bulk {action?.toUpperCase()} — Job #{id}
          </div>
          <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>
            {done} / {total_stores} stores · {status}
          </div>
        </div>
        <span style={{ fontSize: 14, fontWeight: 900, color: C.primary }}>{pct}%</span>
      </div>

      {/* Progress bar */}
      <div style={{ height: 6, borderRadius: 6, backgroundColor: `${C.primary}1a`, overflow: "hidden", marginBottom: 12 }}>
        <div style={{ height: "100%", width: `${pct}%`, backgroundColor: C.primary, borderRadius: 6, transition: "width 0.4s ease" }} />
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        {status === "RUNNING" && (
          <button style={{ ...pillButton(false), fontSize: 11, padding: "6px 14px" }} onClick={handlePause}>Pause</button>
        )}
        {status === "PAUSED" && (
          <button style={{ ...pillButton(true), fontSize: 11, padding: "6px 14px" }} onClick={handleResume}>Resume</button>
        )}
        <button style={{ ...pillButton(false), fontSize: 11, padding: "6px 14px", borderColor: "#dc3545", color: "#dc3545" }} onClick={handleCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
