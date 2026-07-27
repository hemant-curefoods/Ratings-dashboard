import { useCallback, useEffect, useMemo, useState } from "react";
import { C, FONT, cardStyle, pillButton } from "../../theme";
import { STORES } from "./stores";
import StoreCard from "./StoreCard";
import ToggleSidebar from "./ToggleSidebar";
import BulkProgressIsland from "./BulkProgressIsland";
import AuditModal from "./AuditModal";

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? "" : "http://localhost:3001");

async function post(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

const selectStyle = { padding: "7px 12px", borderRadius: 10, border: `1.5px solid ${C.primary}`, color: C.primary, fontSize: 12, fontWeight: 700, fontFamily: FONT, cursor: "pointer", outline: "none" };

export default function TogglePage() {
  const [stores, setStores] = useState(STORES);
  const [brand, setBrand] = useState("All");
  const [zone, setZone] = useState("All");
  const [city, setCity] = useState("All");
  const [area, setArea] = useState("All");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("Total");
  const [sidebarData, setSidebarData] = useState(null);
  const [isBulking, setIsBulking] = useState(false);
  const [showAudit, setShowAudit] = useState(false);

  const handleBrandChange = (b) => { setBrand(b); setZone("All"); setCity("All"); setArea("All"); };
  const handleZoneChange = (z) => { setZone(z); setCity("All"); setArea("All"); };
  const handleCityChange = (c) => { setCity(c); setArea("All"); };

  const fetchSidebar = useCallback(() => {
    fetch(`${API_BASE}/api/toggle/sidebar-data`)
      .then((r) => r.json())
      .then((d) => setSidebarData(d.data || null))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchSidebar();
    const timer = setInterval(fetchSidebar, 15000);
    return () => clearInterval(timer);
  }, [fetchSidebar]);

  const brandsList = useMemo(() => ["All", ...new Set(stores.map(s => s.brand).filter(Boolean))].sort(), [stores]);
  
  const zonesList = useMemo(() => {
    const list = stores.filter(s => brand === "All" || s.brand === brand)
                       .map(s => s.zone)
                       .filter(Boolean);
    return ["All", ...new Set(list)].sort();
  }, [stores, brand]);

  const citiesList = useMemo(() => {
    const list = stores.filter(s => 
                          (brand === "All" || s.brand === brand) &&
                          (zone === "All" || s.zone === zone)
                       )
                       .map(s => s.city)
                       .filter(Boolean);
    return ["All", ...new Set(list)].sort();
  }, [stores, brand, zone]);

  const areasList = useMemo(() => {
    const list = stores.filter(s => 
                          (brand === "All" || s.brand === brand) &&
                          (zone === "All" || s.zone === zone) &&
                          (city === "All" || s.city === city)
                       )
                       .map(s => s.name)
                       .filter(Boolean);
    return ["All", ...new Set(list)].sort();
  }, [stores, brand, zone, city]);

  const baseFiltered = useMemo(() => {
    const q = search.toLowerCase();
    return stores.filter((s) => {
      if (brand !== "All" && s.brand !== brand) return false;
      if (zone !== "All" && s.zone !== zone) return false;
      if (city !== "All" && s.city !== city) return false;
      if (area !== "All" && s.name !== area) return false;
      if (q && !s.name.toLowerCase().includes(q) && !s.location_id.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [stores, brand, zone, city, area, search]);

  const onlineCount = baseFiltered.filter((s) => s.status === "online").length;
  const offlineCount = baseFiltered.length - onlineCount;

  const filtered = useMemo(() => {
    if (statusFilter === "Total") return baseFiltered;
    return baseFiltered.filter(s => s.status === statusFilter.toLowerCase());
  }, [baseFiltered, statusFilter]);

  const handleToggle = async (store, action) => {
    const res = await post("/api/toggle", {
      location_id: store.location_id,
      store_name: store.name,
      action,
      brand: store.brand.toLowerCase().replace(/[^a-z]/g, "_"),
    });
    if (res.success) {
      setStores((prev) => prev.map((s) => s.id === store.id ? { ...s, status: action === "enable" ? "online" : "offline" } : s));
      fetchSidebar();
    } else {
      alert(`Toggle failed: ${res.error || "Unknown error"}`);
    }
  };

  const handleBulk = async (action) => {
    const targets = filtered.filter((s) => action === "enable" ? s.status !== "online" : s.status === "online");
    if (!targets.length) return;
    if (!confirm(`${action === "enable" ? "Enable" : "Disable"} ${targets.length} stores?`)) return;
    setIsBulking(true);
    const storePayload = targets.map((s) => ({
      location_id: s.location_id,
      store_name: s.name,
      brand: s.brand.toLowerCase().replace(/[^a-z]/g, "_"),
    }));
    const res = await post("/api/toggle/bulk", { stores: storePayload, action }).catch(() => null);
    if (res?.success) fetchSidebar();
    else if (res?.error) alert(`Bulk failed: ${res.error}`);
    setIsBulking(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, fontFamily: FONT }}>

      {/* Stat bar as filters */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
        {[
          { label: "Total", value: baseFiltered.length, filterVal: "Total" },
          { label: "Online", value: onlineCount, color: "#15803d", filterVal: "Online" },
          { label: "Offline", value: offlineCount, color: "#dc2626", filterVal: "Offline" },
        ].map((s) => (
          <button 
            key={s.label} 
            onClick={() => setStatusFilter(s.filterVal)}
            style={{ 
              ...cardStyle, 
              padding: "12px 16px", 
              cursor: "pointer", 
              border: statusFilter === s.filterVal ? `2px solid ${s.color || C.primary}` : cardStyle.border,
              textAlign: "left",
              backgroundColor: statusFilter === s.filterVal ? (s.color ? s.color + "11" : C.primary + "11") : "#fff",
              outline: "none"
            }}
          >
            <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5 }}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: s.color || C.primary, marginTop: 3 }}>{s.value}</div>
          </button>
        ))}
      </div>

      {/* Filters + actions */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        
        <select value={brand} onChange={(e) => handleBrandChange(e.target.value)} style={selectStyle}>
          {brandsList.map((b) => <option key={b} value={b}>{b === "All" ? "All Brands" : b}</option>)}
        </select>
        
        <select value={zone} onChange={(e) => handleZoneChange(e.target.value)} style={selectStyle}>
          {zonesList.map((z) => <option key={z} value={z}>{z === "All" ? "All Zones" : z}</option>)}
        </select>

        <select value={city} onChange={(e) => handleCityChange(e.target.value)} style={selectStyle}>
          {citiesList.map((c) => <option key={c} value={c}>{c === "All" ? "All Cities" : c}</option>)}
        </select>
        
        <select value={area} onChange={(e) => setArea(e.target.value)} style={selectStyle}>
          {areasList.map((a) => <option key={a} value={a}>{a === "All" ? "All Areas" : a}</option>)}
        </select>

        {/* Search */}
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search stores…"
          style={{ padding: "7px 12px", borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 12, color: C.text, fontFamily: FONT, outline: "none", minWidth: 180 }}
        />

        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button
            style={{ ...pillButton(false), fontSize: 11, padding: "7px 16px", backgroundColor: "#dcfce7", borderColor: "#15803d", color: "#15803d" }}
            onClick={() => handleBulk("enable")}
            disabled={isBulking}
          >
            Enable Visible
          </button>
          <button
            style={{ ...pillButton(false), fontSize: 11, padding: "7px 16px", backgroundColor: "#fee2e2", borderColor: "#dc3545", color: "#dc3545" }}
            onClick={() => handleBulk("disable")}
            disabled={isBulking}
          >
            Disable Visible
          </button>
          <button
            style={{ ...pillButton(false), fontSize: 11, padding: "7px 16px" }}
            onClick={() => setShowAudit(true)}
          >
            Audit Log
          </button>
        </div>
      </div>

      {/* Store card grid */}
      {filtered.length === 0 ? (
        <div style={{ ...cardStyle, padding: 32, textAlign: "center" }}>
          <div style={{ fontSize: 13, color: C.muted }}>No stores match the current filters.</div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14 }}>
          {filtered.map((store) => (
            <StoreCard key={store.id} store={store} onToggle={handleToggle} isBulking={isBulking} />
          ))}
        </div>
      )}

      {/* Sidebar, bulk island, audit modal */}
      <ToggleSidebar data={sidebarData} fetchData={fetchSidebar} />
      <BulkProgressIsland activeBulkJob={sidebarData?.activeBulkJob} fetchData={fetchSidebar} />
      {showAudit && <AuditModal onClose={() => setShowAudit(false)} stores={stores} selectedBrand={brand === "All" ? "" : brand} />}
    </div>
  );
}
