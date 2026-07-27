import { C, cardStyle } from "../../theme";

const JOBS = [
  { id: "BF-4821", route: "BLR / Koramangala → HSR", missing: 14, status: "QUEUED" },
  { id: "BF-4822", route: "MUM / Andheri → Bandra", missing: 6, status: "RUNNING" },
  { id: "BF-4823", route: "DEL / Saket → Dwarka", missing: 31, status: "FAILED" },
  { id: "BF-4824", route: "HYD / Gachibowli loop", missing: 0, status: "COMPLETE" },
];

const color = { QUEUED: "#b45309", RUNNING: "#132664", FAILED: "#b91c1c", COMPLETE: "#15803d" };

export default function RouteBackfillingPage({ globalFilters }) {
  return (
    <div style={{ ...cardStyle, padding: 24 }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: C.primary }}>Route Backfilling</div>
      <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>
        Reconciliation jobs for missing rider route legs
        {globalFilters?.cities?.length ? ` in ${globalFilters.cities.join(", ")}` : ""}.
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 18 }}>
        {JOBS.map((j) => (
          <div
            key={j.id}
            style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}
          >
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: C.primary }}>{j.id}</div>
              <div style={{ fontSize: 11, color: C.muted }}>
                {j.route} · {j.missing} legs missing
              </div>
            </div>
            <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.6, color: color[j.status], border: `1px solid ${color[j.status]}33`, borderRadius: 20, padding: "5px 12px" }}>
              {j.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
