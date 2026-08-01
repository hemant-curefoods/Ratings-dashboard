import { useCallback, useEffect, useMemo, useState } from "react";
import { C, FONT, cardStyle, pillButton } from "../../theme";
import { getAuthHeaders, handleApiError } from "../../api";
import StoreCard from "./StoreCard";
import ToggleSidebar from "./ToggleSidebar";
import MultiSearchableSelect from "./MultiSearchableSelect";
import BulkProgressIsland from "./BulkProgressIsland";
import AuditModal from "./AuditModal";
import ManageStoresModal from "./ManageStoresModal";

const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? "" : "http://localhost:3001");

async function post(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { ...getAuthHeaders() },
    body: JSON.stringify(body),
  });
  if (handleApiError(res)) return { success: false, error: "Session expired" };
  return res.json();
}

const selectStyle = { padding: "7px 12px", borderRadius: 10, border: `1.5px solid ${C.primary}`, color: C.primary, fontSize: 12, fontWeight: 700, fontFamily: FONT, cursor: "pointer", outline: "none" };

export default function TogglePage({ userRole }) {
  const [stores, setStores] = useState([]);
  
  // Pending filters (multi-select)
  const [brand, setBrand] = useState([]);
  const [zone, setZone] = useState([]);
  const [city, setCity] = useState([]);
  const [area, setArea] = useState([]);
  const [search, setSearch] = useState("");
  
  // Active filters (applied when "Apply" is clicked)
  const [activeFilters, setActiveFilters] = useState({ brand: [], zone: [], city: [], area: [], search: "" });
  
  const [statusFilter, setStatusFilter] = useState("Total");
  const [sidebarData, setSidebarData] = useState(null);
  const [isBulking, setIsBulking] = useState(false);
  const [showAudit, setShowAudit] = useState(false);
  const [showManage, setShowManage] = useState(false);
  const [storeStates, setStoreStates] = useState({});

  const canManageStores = ["admin", "control_tower", "clock_tower"].includes(String(userRole).toLowerCase().replace(/ /g, '_'));

  const handleBrandChange = (b) => { setBrand(b); setZone([]); setCity([]); setArea([]); };
  const handleZoneChange = (z) => { setZone(z); setCity([]); setArea([]); };
  const handleCityChange = (c) => { setCity(c); setArea([]); };

  const handleApply = () => {
    setActiveFilters({ brand, zone, city, area, search });
  };

  const handleClear = () => {
    setBrand([]);
    setZone([]);
    setCity([]);
    setArea([]);
    setSearch("");
    setActiveFilters({ brand: [], zone: [], city: [], area: [], search: "" });
  };

  const fetchSidebar = useCallback(() => {
    fetch(`${API_BASE}/api/toggle/stores`, { headers: getAuthHeaders() })
      .then((r) => { handleApiError(r); return r.json(); })
      .then((d) => { if (d.data) setStores(d.data); })
      .catch(() => {});

    fetch(`${API_BASE}/api/toggle/sidebar-data`, { headers: getAuthHeaders() })
      .then((r) => { handleApiError(r); return r.json(); })
      .then((d) => setSidebarData(d.data || null))
      .catch(() => {});
      
    fetch(`${API_BASE}/api/toggle/store-states`, { headers: getAuthHeaders() })
      .then((r) => { handleApiError(r); return r.json(); })
      .then((d) => {
        if (d.data) {
           const map = {};
           d.data.forEach(st => map[st.location_id] = st);
           setStoreStates(map);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchSidebar();
    const timer = setInterval(fetchSidebar, 15000);
    return () => clearInterval(timer);
  }, [fetchSidebar]);

  const brandsList = useMemo(() => [...new Set(stores.map(s => s.brand).filter(Boolean))].sort(), [stores]);
  
  const zonesList = useMemo(() => {
    const list = stores.filter(s => brand.length === 0 || brand.includes(s.brand))
                       .map(s => s.zone)
                       .filter(Boolean);
    return [...new Set(list)].sort();
  }, [stores, brand]);

  const citiesList = useMemo(() => {
    const list = stores.filter(s => 
                          (brand.length === 0 || brand.includes(s.brand)) &&
                          (zone.length === 0 || zone.includes(s.zone))
                       )
                       .map(s => s.city)
                       .filter(Boolean);
    return [...new Set(list)].sort();
  }, [stores, brand, zone]);

  const areasList = useMemo(() => {
    const list = stores.filter(s => 
                          (brand.length === 0 || brand.includes(s.brand)) &&
                          (zone.length === 0 || zone.includes(s.zone)) &&
                          (city.length === 0 || city.includes(s.city))
                       )
                       .map(s => s.name)
                       .filter(Boolean);
    return [...new Set(list)].sort();
  }, [stores, brand, zone, city]);

  const baseFiltered = useMemo(() => {
    const q = activeFilters.search.toLowerCase();
    return stores.filter((s) => {
      if (activeFilters.brand.length > 0 && !activeFilters.brand.includes(s.brand)) return false;
      if (activeFilters.zone.length > 0 && !activeFilters.zone.includes(s.zone)) return false;
      if (activeFilters.city.length > 0 && !activeFilters.city.includes(s.city)) return false;
      if (activeFilters.area.length > 0 && !activeFilters.area.includes(s.name)) return false;
      if (q && !s.name.toLowerCase().includes(q) && !s.location_id.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [stores, activeFilters]);

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
        
        <MultiSearchableSelect options={brandsList} selectedValues={brand} onChange={handleBrandChange} placeholder="Brand" />
        <MultiSearchableSelect options={zonesList} selectedValues={zone} onChange={handleZoneChange} placeholder="Zone" />
        <MultiSearchableSelect options={citiesList} selectedValues={city} onChange={handleCityChange} placeholder="City" />
        <MultiSearchableSelect options={areasList} selectedValues={area} onChange={setArea} placeholder="Area" />

        {/* Search */}
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search store ID or name…"
          style={{ padding: "7px 12px", borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 12, color: C.text, fontFamily: FONT, outline: "none", minWidth: 160 }}
        />

        <button
          onClick={handleApply}
          style={{ ...pillButton(false), fontSize: 11, padding: "7px 16px", backgroundColor: C.primary, color: "#fff", borderColor: C.primary }}
        >
          Apply Filters
        </button>
        <button
          onClick={handleClear}
          style={{ ...pillButton(false), fontSize: 11, padding: "7px 16px", backgroundColor: "#fff", color: C.muted, borderColor: C.border }}
        >
          Clear
        </button>

        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          {(() => {
            const hasCakeZone = filtered.some(s => s.brand === "Cake Zone");
            return (
              <>
                <button
                  style={{ ...pillButton(false), fontSize: 11, padding: "7px 16px", backgroundColor: "#dcfce7", borderColor: "#15803d", color: "#15803d", opacity: hasCakeZone ? 0.5 : 1 }}
                  onClick={() => handleBulk("enable")}
                  disabled={isBulking || hasCakeZone}
                  title={hasCakeZone ? "Bulk Actions are disabled for Cake Zone" : ""}
                >
                  Enable Visible
                </button>
                <button
                  style={{ ...pillButton(false), fontSize: 11, padding: "7px 16px", backgroundColor: "#fee2e2", borderColor: "#dc3545", color: "#dc3545", opacity: hasCakeZone ? 0.5 : 1 }}
                  onClick={() => handleBulk("disable")}
                  disabled={isBulking || hasCakeZone}
                  title={hasCakeZone ? "Bulk Actions are disabled for Cake Zone" : ""}
                >
                  Disable Visible
                </button>
              </>
            );
          })()}
          {canManageStores && (
            <button
              style={{ ...pillButton(false), fontSize: 11, padding: "7px 16px", backgroundColor: "#fff", color: C.primary, borderColor: C.primary }}
              onClick={() => setShowManage(true)}
            >
              Manage Stores
            </button>
          )}
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
            <StoreCard 
              key={store.id} 
              store={store} 
              dbState={storeStates[store.location_id]}
              onToggle={handleToggle} 
              isBulking={isBulking} 
            />
          ))}
        </div>
      )}

      {/* Sidebar, bulk island, audit modal */}
      <ToggleSidebar data={sidebarData} fetchData={fetchSidebar} />
      <BulkProgressIsland activeBulkJob={sidebarData?.activeBulkJob} fetchData={fetchSidebar} />
      {showAudit && <AuditModal onClose={() => setShowAudit(false)} stores={stores} selectedBrands={activeFilters.brand} />}
      {showManage && <ManageStoresModal onClose={() => setShowManage(false)} refreshStores={fetchSidebar} stores={stores} />}
    </div>
  );
}
