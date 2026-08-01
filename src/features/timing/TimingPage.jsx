import { useState } from "react";
import { C, FONT, cardStyle, pillButton, spinnerStyle } from "../../theme";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

export default function TimingPage() {
  const [form, setForm] = useState({
    location_id: "",
    store_name: "",
    opening_time: "",
    closing_time: "",
    opening_time_2: "",
    closing_time_2: "",
    slot: "1",
  });
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.location_id || !form.opening_time) {
      setStatus({ ok: false, msg: "Store ID and opening time are required." });
      return;
    }
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch(`${API_BASE}/api/timing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const d = await res.json();
      setStatus({ ok: d.success, msg: d.message || d.error || "Unknown response" });
    } catch (e) {
      setStatus({ ok: false, msg: e.message });
    } finally {
      setLoading(false);
    }
  };

  const Field = ({ label, fieldKey, type = "text", placeholder = "" }) => (
    <div>
      <div style={{ fontSize: 10, fontWeight: 800, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>
        {label}
      </div>
      <input
        type={type}
        value={form[fieldKey]}
        onChange={(e) => set(fieldKey, e.target.value)}
        placeholder={placeholder}
        style={{ width: "100%", boxSizing: "border-box", padding: "9px 12px", borderRadius: 9, border: `1.5px solid ${C.border}`, fontSize: 12.5, color: C.text, fontFamily: FONT, outline: "none" }}
      />
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 560, fontFamily: FONT }}>
      <div style={{ ...cardStyle, padding: "22px 24px" }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: C.primary }}>Update Store Operating Hours</div>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 4, lineHeight: 1.6 }}>
          Triggers a GitHub Actions workflow that syncs the updated timing across aggregator platforms. Changes apply in ~60 seconds.
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 20 }}>
          <Field label="Location / Store ID *" fieldKey="location_id" placeholder="e.g. ER-KOR-001" />
          <Field label="Store Name" fieldKey="store_name" placeholder="e.g. EatFit Koramangala" />

          <div>
            <div style={{ fontSize: 10, fontWeight: 800, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
              Slot 1 — Primary Hours *
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Opening Time" fieldKey="opening_time" type="time" />
              <Field label="Closing Time" fieldKey="closing_time" type="time" />
            </div>
          </div>

          <div>
            <div style={{ fontSize: 10, fontWeight: 800, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>
              Slot 2 — Secondary Hours (optional)
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Opening Time" fieldKey="opening_time_2" type="time" />
              <Field label="Closing Time" fieldKey="closing_time_2" type="time" />
            </div>
          </div>

          <div>
            <div style={{ fontSize: 10, fontWeight: 800, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
              Active Slot
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {["1", "2"].map((s) => (
                <button key={s} style={{ ...pillButton(form.slot === s), padding: "8px 24px" }} onClick={() => set("slot", s)}>
                  Slot {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        {status && (
          <div style={{ marginTop: 16, padding: "10px 14px", borderRadius: 9, fontSize: 12.5, fontWeight: 700, backgroundColor: status.ok ? "#dcfce7" : "#fee2e2", color: status.ok ? "#15803d" : "#b91c1c" }}>
            {status.ok ? "✓" : "✗"} {status.msg}
          </div>
        )}

        <button
          onClick={submit}
          disabled={loading}
          style={{ ...pillButton(true), marginTop: 20, padding: "11px 28px", borderRadius: 12, display: "flex", alignItems: "center", gap: 8, opacity: loading ? 0.7 : 1, cursor: loading ? "not-allowed" : "pointer" }}
        >
          {loading && <span style={{ ...spinnerStyle, borderColor: "#fff", borderTopColor: "transparent" }} />}
          {loading ? "Triggering..." : "Update Timing"}
        </button>
      </div>
    </div>
  );
}
