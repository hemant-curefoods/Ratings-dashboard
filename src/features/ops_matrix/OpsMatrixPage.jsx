import React, { useState, useEffect, useRef, useMemo, startTransition } from "react";
import { C, cardStyle } from "../../theme";
import { API_BASE, getAuthHeaders } from "../../api";

// --- Helpers ---
const inputStyle = {
  padding: "10px 14px",
  borderRadius: 6,
  border: `1px solid ${C.border}`,
  outline: "none",
  fontSize: 14,
  background: "#fff"
};

const getBgColor = (val, t1, t2, t3) => {
  if (!val) return "";
  if (val <= t1) return "#28a745"; // Green
  if (val <= t2) return "#ffc107"; // Yellow
  if (val <= t3) return "#fd7e14"; // Orange
  return "#dc3545"; // Red
};

const getTextColor = (val, t1, t2, t3) => {
  if (!val) return C.text;
  if (val <= t1 || val > t3) return "#ffffff"; // White text on green and red
  return C.text; // Dark text on yellow and orange
};

const iso = (offsetDays) => {
  const d = new Date();
  d.setDate(d.getDate() - offsetDays);
  return d.toISOString().slice(0, 10);
};

const CITY_TO_ZONE = {
  "Delhi": "NORTH", "Gurgaon": "NORTH", "Noida": "NORTH", "Lucknow": "NORTH", "Chandigarh": "NORTH", "Ludhiana": "NORTH", "Jaipur": "NORTH", "Faridabad": "NORTH", "Ghaziabad": "NORTH", "Amritsar": "NORTH", "Dehradun": "NORTH",
  "Bengaluru": "SOUTH", "Bangalore": "SOUTH", "Chennai": "SOUTH", "Hyderabad": "SOUTH", "Coimbatore": "SOUTH", "Mysuru": "SOUTH", "Cochin": "SOUTH", "Thiruvananthapuram": "SOUTH", "Vizag": "SOUTH", "Hosur": "SOUTH", "Mangalore": "SOUTH", "Manipal": "SOUTH", "Palakkad": "SOUTH", "Puducherry": "SOUTH", "Tumakuru": "SOUTH", "Anantapur": "SOUTH", "Calicut": "SOUTH", "Ernakulam": "SOUTH", "Kakinada": "SOUTH", "Nellore": "SOUTH", "Rajahmundry": "SOUTH", "Tirupati": "SOUTH", "Vijayawada": "SOUTH", "Warangal": "SOUTH",
  "Mumbai": "WEST", "Pune": "WEST", "Ahemadabad": "WEST", "Goa": "WEST", "Surat": "WEST", "Nagpur": "WEST", "Vadodara": "WEST", "Indore": "WEST", "Bhopal": "WEST", "Aurangabad": "WEST", "Nashik": "WEST",
  "Kolkata": "EAST", "Guwahati": "EAST", "Bhubaneswar": "EAST", "Patna": "EAST", "Ranchi": "EAST", "Siliguri": "EAST", "Cuttack": "EAST", "Raipur": "EAST"
};

// --- Date to Week Helpers ---
const getWeekInfo = (dateStr) => {
  const d = new Date(dateStr);
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil((((tmp - yearStart) / 86400000) + 1) / 7);
  const wKey = `W${weekNum}`;

  // Get Monday
  const monday = new Date(d);
  monday.setDate(d.getDate() - (d.getDay() === 0 ? 6 : d.getDay() - 1));
  
  // Get Sunday
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const sStr = monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const eStr = sunday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  
  return {
    val: wKey,
    label: `${wKey} (${sStr}-${eStr})`
  };
};

// --- Custom MultiSelect ---
function MultiSelectDropdown({ label, options, selected, onChange }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef();
  
  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (!open) setSearch("");
  }, [open]);

  const filteredOptions = options.filter(opt => opt.toLowerCase().includes(search.toLowerCase()));
  const displayOptions = filteredOptions.slice(0, 50);

  const toggleAll = () => {
    const allVisibleSelected = filteredOptions.length > 0 && filteredOptions.every(opt => selected.includes(opt));
    startTransition(() => {
      if (allVisibleSelected) {
        onChange(selected.filter(opt => !filteredOptions.includes(opt)));
      } else {
        onChange(Array.from(new Set([...selected, ...filteredOptions])));
      }
    });
  };

  const displayText = selected.length === 0 ? `All ${label}` : 
                      selected.length === 1 ? selected[0] : 
                      `${selected.length} ${label}`;

  return (
    <div ref={ref} style={{ position: "relative", minWidth: 160, flex: 1 }}>
      <button onClick={() => setOpen(!open)} style={{...inputStyle, width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer"}}>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: selected.length > 0 ? 700 : 400, color: selected.length > 0 ? C.primary : C.text }}>
          {displayText}
        </span>
        <span style={{ fontSize: 10, color: C.muted }}>▼</span>
      </button>
      {open && (
        <div style={{ position: "absolute", top: "100%", left: 0, marginTop: 4, width: 240, background: "#fff", border: `1px solid ${C.border}`, borderRadius: 8, zIndex: 50, maxHeight: 350, display: "flex", flexDirection: "column", boxShadow: "0 8px 24px rgba(0,0,0,0.12)" }}>
          <div style={{ padding: "8px 12px", borderBottom: `1px solid ${C.borderSoft}` }}>
            <input 
              type="text" 
              placeholder={`Search ${label}...`} 
              value={search} 
              onChange={(e) => setSearch(e.target.value)} 
              style={{ width: "100%", padding: "6px 10px", borderRadius: 4, border: `1px solid ${C.border}`, fontSize: 13, outline: "none", boxSizing: "border-box" }}
            />
          </div>
          <div style={{ padding: "8px 12px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
            {displayOptions.map(opt => (
              <label key={opt} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, cursor: "pointer", color: C.text }}>
                <input type="checkbox" checked={selected.includes(opt)} onChange={(e) => {
                  startTransition(() => {
                    if (e.target.checked) onChange([...selected, opt]);
                    else onChange(selected.filter(x => x !== opt));
                  });
                }} style={{ width: 16, height: 16, cursor: "pointer" }} />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{opt}</span>
              </label>
            ))}
            {filteredOptions.length > 50 && (
              <div style={{ fontSize: 11, color: C.muted, textAlign: "center", paddingTop: 4 }}>
                Showing top 50 matches. Use search for more.
              </div>
            )}
            {filteredOptions.length === 0 && <div style={{ fontSize: 12, color: C.muted, textAlign: "center", padding: "12px 0" }}>No matches found</div>}
          </div>
          <div style={{ padding: "8px 12px", borderTop: `1px solid ${C.borderSoft}`, background: "#f8fafc", position: "sticky", bottom: 0, borderRadius: "0 0 8px 8px" }}>
            <button onClick={toggleAll} style={{ fontSize: 13, padding: "8px 12px", cursor: "pointer", background: "#e2e8f0", color: "#334155", border: "none", borderRadius: 4, width: "100%", fontWeight: 600 }}>Toggle All / None</button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div style={{ ...cardStyle, padding: "16px", flex: 1, textAlign: "left", background: "#fff", border: `1px solid ${C.borderSoft}`, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
      <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: "#1e3a8a", marginTop: 8 }}>{value}</div>
    </div>
  );
}

function CustomDatePicker({ value, min, max, onChange, hasError }) {
  const [val, setVal] = useState(value);
  
  useEffect(() => { setVal(value); }, [value]);

  const handleBlur = () => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
      onChange({ target: { value: val } });
    } else {
      setVal(value);
    }
  };

  return (
    <div style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
      <input 
        type="text" 
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={handleBlur}
        placeholder="YYYY-MM-DD"
        style={{...inputStyle, border: hasError ? "1px solid #ef4444" : inputStyle.border, paddingRight: 32, width: 110, letterSpacing: 0.5}} 
      />
      <input 
        type="date"
        value={value}
        min={min}
        max={max}
        onChange={(e) => {
          setVal(e.target.value);
          onChange(e);
        }}
        style={{
          position: "absolute",
          right: 0,
          opacity: 0,
          width: 32,
          height: "100%",
          cursor: "pointer"
        }}
      />
      <svg style={{ position: "absolute", right: 10, pointerEvents: "none", color: C.muted }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
    </div>
  );
}

// --- Main Page ---
const queryCache = new Map();

export default function OpsMatrixPage() {
  const [loading, setLoading] = useState(false);
  const [rawData, setRawData] = useState([]);
  const [weekDefs, setWeekDefs] = useState([]);
  
  // Date Filters
  const [startDate, setStartDate] = useState(iso(8));
  const [endDate, setEndDate] = useState(iso(1));

  const diffDays = (new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24);
  const dateError = diffDays < 0 ? "Start date must be before end date." :
                    diffDays > 30 ? "Please choose a range of at most 1 month." : null;
  
  // Location/Brand Filters
  const [brands, setBrands] = useState([]);
  const [zones, setZones] = useState([]);
  const [cities, setCities] = useState([]);
  const [areas, setAreas] = useState([]);

  // Available Options
  const [availBrands, setAvailBrands] = useState([]);
  const [availZones, setAvailZones] = useState([]);
  const [availCities, setAvailCities] = useState([]);
  const [availAreas, setAvailAreas] = useState([]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Pass single selections directly if length is 1, as the backend proxy supports single value passing for these params right now.
      const bPayload = brands.length === 1 ? brands[0] : "";
      const zPayload = zones.length === 1 ? zones[0] : "";
      const cPayload = cities.length === 1 ? cities[0] : "";
      const aPayload = areas.length === 1 ? areas[0] : "";

      const cacheKey = JSON.stringify({ startDate, endDate, brand: bPayload, zone: zPayload, city: cPayload, area: aPayload });
      if (queryCache.has(cacheKey)) {
        const cachedData = queryCache.get(cacheKey);
        
        // Use cached data
        let weekMapping = {};
        const mappedRows = cachedData.map(r => {
          const row = [...r];
          if (r[4]) {
            const wInfo = getWeekLabel(r[4]);
            row[4] = wInfo.val;
            weekMapping[wInfo.val] = wInfo.label;
          }
          return row;
        });

        const wDefs = Object.keys(weekMapping).sort((a,b) => a.localeCompare(b)).map(k => ({ val: k, label: weekMapping[k] }));
        setRawData(mappedRows);
        setWeekDefs(wDefs);
        
        if (brands.length === 0 && zones.length === 0 && cities.length === 0 && areas.length === 0) {
          extractOptions(mappedRows, [], [], [], []);
        }
        setLoading(false);
        return;
      }

      let json = null;
      let fetchSuccess = false;

      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const response = await fetch(`${API_BASE}/api/ops-matrix/prep-time/kitchen`, {
            method: "POST",
            headers: { 
              "Content-Type": "application/json",
              ...getAuthHeaders()
            },
            body: JSON.stringify({
              startDate,
              endDate,
              brand: bPayload,
              zone: zPayload,
              city: cPayload,
              area: aPayload
            })
          });

          if (response.ok) {
            json = await response.json();
            fetchSuccess = true;
            break;
          } else if (response.status === 504 && attempt < 3) {
            console.warn(`[OpsMatrix] Vercel 504 Timeout on attempt ${attempt}. Waiting 4s for Metabase cache...`);
            await new Promise(r => setTimeout(r, 4000));
          } else {
            break; // Break on 4xx or 500 errors
          }
        } catch (err) {
          if (attempt < 3) {
            console.warn(`[OpsMatrix] Fetch error on attempt ${attempt}:`, err);
            await new Promise(r => setTimeout(r, 3000));
          } else {
            console.error("Failed to fetch after 3 attempts", err);
          }
        }
      }

      if (!fetchSuccess || !json) {
        setRawData([]);
        setWeekDefs([]);
        setLoading(false);
        return;
      }
      
      if (json.success && json.data && json.data.rows) {
        // Map raw row[4] (date) to week format
        const rows = json.data.rows;
        
        // Extract unique weeks for sorting/display
        const weekMap = {};
        
        const mappedRows = rows.map(r => {
          const newRow = [...r];
          if (r[4]) {
            const weekInfo = getWeekInfo(r[4]);
            newRow[4] = weekInfo.val; // Replace order_date with Week Key
            weekMap[weekInfo.val] = weekInfo.label;
          }
          return newRow;
        });

        const weeks = Object.keys(weekMap)
          .sort((a, b) => a.localeCompare(b))
          .map(val => ({ val, label: weekMap[val] }));

        setRawData(mappedRows);
        setWeekDefs(weeks);
        
        // Initialize cascading options based on fetched data
        if (brands.length === 0 && zones.length === 0 && cities.length === 0 && areas.length === 0) {
          updateCascadingOptions(mappedRows, [], [], [], []);
        }
      } else {
        setRawData([]);
        setWeekDefs([]);
      }
    } catch (err) {
      console.error("Failed to fetch:", err);
      setRawData([]);
      setWeekDefs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!dateError) {
      fetchData();
    }
  }, [startDate, endDate, dateError]);

  useEffect(() => {
    if (rawData.length > 0) {
      updateCascadingOptions(rawData, brands, zones, cities, areas);
    }
  }, [brands, zones, cities, areas]);

  const updateCascadingOptions = (allRows, bFilter, zFilter, cFilter, aFilter) => {
    const bSet = new Set();
    const zSet = new Set();
    const cSet = new Set();
    const aSet = new Set();

    allRows.forEach(r => {
      const bName = r[0];
      const cName = r[2];
      const kName = r[3];
      const zName = CITY_TO_ZONE[cName] || "OTHER";

      const brandMatch = bFilter.length === 0 || bFilter.includes(bName);
      const zoneMatch = zFilter.length === 0 || zFilter.includes(zName);
      const cityMatch = cFilter.length === 0 || cFilter.includes(cName);
      const areaMatch = aFilter.length === 0 || aFilter.includes(kName);

      if (zoneMatch && cityMatch && areaMatch) bSet.add(bName);
      if (brandMatch && cityMatch && areaMatch) zSet.add(zName);
      if (brandMatch && zoneMatch && areaMatch) cSet.add(cName);
      if (brandMatch && zoneMatch && cityMatch) aSet.add(kName);
    });

    setAvailBrands(Array.from(bSet).sort());
    setAvailZones(Array.from(zSet).sort());
    setAvailCities(Array.from(cSet).sort());
    setAvailAreas(Array.from(aSet).sort());
  };

  const filteredRows = useMemo(() => {
    return rawData.filter(r => {
      const bName = r[0];
      const cName = r[2];
      const kName = r[3];
      const zName = CITY_TO_ZONE[cName] || "OTHER";
      
      if (brands.length > 0 && !brands.includes(bName)) return false;
      if (zones.length > 0 && !zones.includes(zName)) return false;
      if (cities.length > 0 && !cities.includes(cName)) return false;
      if (areas.length > 0 && !areas.includes(kName)) return false;
      return true;
    });
  }, [rawData, brands, zones, cities, areas]);

  // Overall Stats
  const stats = useMemo(() => {
    let tOrders = 0;
    let sKpt = 0;
    let sP80 = 0;
    let sO2d = 0;
    let sP80O2d = 0;
    let kitchens = new Set();
    
    filteredRows.forEach(r => {
      kitchens.add(r[3]);
      const orders = r[5] || 0;
      tOrders += orders;
      sKpt += (r[7] || 0) * orders;
      sP80 += (r[8] || 0) * orders;
      sO2d += (r[11] || 0) * orders;
      sP80O2d += (r[12] || 0) * orders;
    });

    return {
      totalKitchens: kitchens.size,
      totalOrders: tOrders,
      avgKpt: tOrders ? (sKpt / tOrders).toFixed(1) : 0,
      p80Kpt: tOrders ? (sP80 / tOrders).toFixed(1) : 0,
      avgO2d: tOrders ? (sO2d / tOrders).toFixed(1) : 0,
      avgO2del: tOrders ? (sO2d / tOrders + 15).toFixed(1) : 0,
      p80O2del: tOrders ? (sP80O2d / tOrders + 15).toFixed(1) : 0,
    };
  }, [filteredRows]);

  // Determine Deepest Filter Level
  let isDefault = false;
  if (areas.length === 0 && cities.length === 0 && zones.length === 0 && brands.length === 0) {
    isDefault = true;
  }
  
  let headerLabel = "Overall Summary";
  if (!isDefault) {
      if (brands.length > 0 && (areas.length || cities.length || zones.length)) headerLabel = "Brand / Location";
      else if (brands.length > 0) headerLabel = "Brand";
      else if (areas.length > 0) headerLabel = "Kitchen";
      else if (cities.length > 0) headerLabel = "City";
      else if (zones.length > 0) headerLabel = "Zone";
  }

  // Group Data for Display
  const groupedData = useMemo(() => {
    const groups = {};
    filteredRows.forEach(r => {
      let key = "Curefoods Overall Summary";
      
      const bName = r[0] || "Unknown Brand";
      const zName = `${CITY_TO_ZONE[r[2]] || "OTHER"} Zone`;
      const cName = r[2] || "Unknown City";
      const aName = r[3] || "Unknown Kitchen";

      if (!isDefault) {
        let locKey = "";
        if (areas.length > 0) locKey = aName;
        else if (cities.length > 0) locKey = cName;
        else if (zones.length > 0) locKey = zName;

        if (brands.length > 0 && locKey) {
            key = `${bName}  |  ${locKey}`;
        } else if (brands.length > 0) {
            key = bName;
        } else if (locKey) {
            key = locKey;
        }
      }

      if (!groups[key]) {
        groups[key] = { name: key, orders: 0, sKpt: 0, sP80: 0, sO2d: 0, sO2del: 0, sP80O2del: 0, weekMap: {} };
      }
      
      const orders = r[5] || 0;
      const kpt = r[7] || 0;
      const p80 = r[8] || 0;
      const o2d = r[11] || 0;
      const o2del = o2d + 15;
      const p80O2d = r[12] || 0;
      const p80O2del = p80O2d > 0 ? p80O2d + 15 : 0;
      const weekStr = r[4];

      groups[key].orders += orders;
      groups[key].sKpt += (kpt * orders);
      groups[key].sP80 += (p80 * orders);
      groups[key].sO2d += (o2d * orders);
      groups[key].sO2del += (o2del * orders);
      groups[key].sP80O2del += (p80O2del * orders);

      if (!groups[key].weekMap[weekStr]) {
        groups[key].weekMap[weekStr] = { orders: 0, sKpt: 0, sP80: 0, sO2d: 0, sO2del: 0, sP80O2del: 0 };
      }
      groups[key].weekMap[weekStr].orders += orders;
      groups[key].weekMap[weekStr].sKpt += (kpt * orders);
      groups[key].weekMap[weekStr].sP80 += (p80 * orders);
      groups[key].weekMap[weekStr].sO2d += (o2d * orders);
      groups[key].weekMap[weekStr].sO2del += (o2del * orders);
      groups[key].weekMap[weekStr].sP80O2del += (p80O2del * orders);
    });

    return Object.keys(groups).map(k => {
      const g = groups[k];
      const weeks = Object.keys(g.weekMap).map(w => {
        const wd = g.weekMap[w];
        const def = weekDefs.find(x => x.val === w);
        return {
          weekVal: w,
          weekLabel: def ? def.label : w,
          orders: wd.orders,
          kpt: wd.orders ? wd.sKpt / wd.orders : 0,
          p80: wd.orders ? wd.sP80 / wd.orders : 0,
          o2d: wd.orders ? wd.sO2d / wd.orders : 0,
          o2del: wd.orders ? wd.sO2del / wd.orders : 0,
          p80O2del: wd.orders ? wd.sP80O2del / wd.orders : 0,
        };
      }).sort((a, b) => a.weekVal.localeCompare(b.weekVal));

      return {
        name: g.name,
        orders: g.orders,
        kpt: g.orders ? g.sKpt / g.orders : 0,
        p80: g.orders ? g.sP80 / g.orders : 0,
        o2d: g.orders ? g.sO2d / g.orders : 0,
        o2del: g.orders ? g.sO2del / g.orders : 0,
        p80O2del: g.orders ? g.sP80O2del / g.orders : 0,
        weeks
      };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredRows, weekDefs, isDefault, brands, areas, cities, zones]);

  const handleStartDate = (e) => {
    const newStartStr = e.target.value;
    if (newStartStr) setStartDate(newStartStr);
  };

  const handleEndDate = (e) => {
    const newEndStr = e.target.value;
    if (newEndStr) setEndDate(newEndStr);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, paddingBottom: 64 }}>
      {/* Top Filters (Instant Apply) */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", background: C.surface, padding: "16px 24px", borderRadius: 12, border: `1px solid ${C.border}` }}>
        <CustomDatePicker value={startDate} onChange={handleStartDate} max={endDate} hasError={!!dateError} />
        <span style={{ color: C.muted, fontWeight: 600 }}>to</span>
        <CustomDatePicker value={endDate} onChange={handleEndDate} min={startDate} max={iso(0)} hasError={!!dateError} />
        
        {dateError && <span style={{ color: "#ef4444", fontSize: 13, fontWeight: 600 }}>{dateError}</span>}
        
        <div style={{ width: 1, height: 24, background: C.border, margin: "0 8px" }} />

        <MultiSelectDropdown label="Brands" options={availBrands} selected={brands} onChange={setBrands} />
        <MultiSelectDropdown label="Zones" options={availZones} selected={zones} onChange={setZones} />
        <MultiSelectDropdown label="Cities" options={availCities} selected={cities} onChange={setCities} />
        <MultiSelectDropdown label="Areas" options={availAreas} selected={areas} onChange={setAreas} />

        <div style={{ marginLeft: "auto" }}>
          <button style={{ padding: "8px 12px", background: "none", color: "#ef4444", border: "none", fontWeight: 600, cursor: "pointer", fontSize: 13 }} 
            onClick={() => {
              setStartDate(iso(8));
              setEndDate(iso(1));
              setBrands([]);
              setZones([]);
              setCities([]);
              setAreas([]);
            }}
          >
            Clear Filters
          </button>
        </div>
      </div>

      {dateError ? (
        <div style={{ padding: 60, textAlign: "center", color: "#ef4444", background: "#fef2f2", borderRadius: 12, border: "1px solid #fecaca" }}>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Invalid Date Range</div>
          <div style={{ fontSize: 14 }}>{dateError}</div>
        </div>
      ) : (
        <React.Fragment>
          {/* 6 Top Stat Cards */}
          <div style={{ display: "flex", gap: 16 }}>
            <StatCard label="Total Kitchens" value={stats.totalKitchens} />
            <StatCard label={`Total Orders (${weekDefs.length} Weeks)`} value={stats.totalOrders.toLocaleString()} />
            <StatCard label="Avg Kitchen Prep Time" value={`${stats.avgKpt} min`} />
            <StatCard label="P80 Kitchen Prep Time" value={`${stats.p80Kpt} min`} />
            <StatCard label="Avg Order to Dispatch" value={`${stats.avgO2d} min`} />
            <StatCard label="Avg O2Del" value={`${stats.avgO2del} min`} />
            <StatCard label="P80 O2Del" value={`${stats.p80O2del} min`} />
          </div>

          {/* Legend Block */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "16px 20px", background: "#f8fafc", border: `1px solid ${C.border}`, borderRadius: 12 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 24, fontSize: 13, fontWeight: 600, color: C.text }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}><div style={{ width: 14, height: 14, borderRadius: 3, background: "#28a745" }}></div>Excellent</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}><div style={{ width: 14, height: 14, borderRadius: 3, background: "#ffc107" }}></div>Good</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}><div style={{ width: 14, height: 14, borderRadius: 3, background: "#fd7e14" }}></div>Needs Attention</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}><div style={{ width: 14, height: 14, borderRadius: 3, background: "#dc3545" }}></div>Critical</div>
              
              <div style={{ width: 1, height: 18, background: C.border }}></div>
              
              <div style={{ display: "flex", gap: 16, color: C.muted }}>
                <div><span style={{ color: C.text }}>KPT:</span> ≤12 / ≤18 / ≤25 / {'>'}25</div>
                <div><span style={{ color: C.text }}>P80 KPT:</span> ≤18 / ≤25 / ≤35 / {'>'}35</div>
                <div><span style={{ color: C.text }}>O2D:</span> ≤20 / ≤28 / ≤35 / {'>'}35</div>
                <div><span style={{ color: C.text }}>O2Del:</span> ≤35 / ≤45 / ≤55 / {'>'}55</div>
              </div>
              
              <div style={{ width: 1, height: 18, background: C.border }}></div>
              <div style={{ display: "flex", gap: 12, color: C.muted }}>
                <div><span style={{ color: "#28a745" }}>▼</span> Improved</div>
                <div><span style={{ color: "#dc3545" }}>▲</span> Worsened (vs prev week)</div>
              </div>
            </div>
          </div>

          {/* Single Unified Table */}
          <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden", background: "#fff", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#214a70", color: "#fff", textAlign: "left" }}>
              <th style={{ padding: "14px 20px", fontSize: 14 }}>{isDefault ? "Week" : headerLabel}</th>
              <th style={{ padding: "14px 20px", fontSize: 14 }}>Orders</th>
              <th style={{ padding: "14px 20px", fontSize: 14 }}>Avg KPT (min)</th>
              <th style={{ padding: "14px 20px", fontSize: 14 }}>P80 KPT (min)</th>
              <th style={{ padding: "14px 20px", fontSize: 14 }}>Avg O2D (min)</th>
              <th style={{ padding: "14px 20px", fontSize: 14 }}>Avg O2Del (min)</th>
              <th style={{ padding: "14px 20px", fontSize: 14 }}>P80 O2Del (min)</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7} style={{ padding: 40, textAlign: "center", color: C.muted }}>Loading...</td></tr>}
            {!loading && groupedData.length === 0 && <tr><td colSpan={7} style={{ padding: 40, textAlign: "center", color: C.muted }}>No records match your selection.</td></tr>}
            
            {/* If Default Mode (No filters), just show overall weeks directly */}
            {!loading && isDefault && groupedData.map(group => (
              <React.Fragment key={group.name}>
                {group.weeks.map(row => (
                  <tr key={row.weekLabel} style={{ borderBottom: `1px solid ${C.borderSoft}` }}>
                    <td style={{ padding: "12px 20px", fontWeight: 700, color: "#1e3a8a" }}>{row.weekLabel}</td>
                    <td style={{ padding: "12px 20px" }}>{row.orders?.toLocaleString()}</td>
                    <td style={{ padding: "12px 20px", fontWeight: 700, backgroundColor: getBgColor(row.kpt, 12, 18, 25), color: getTextColor(row.kpt, 12, 18, 25) }}>{row.kpt?.toFixed(1)}</td>
                    <td style={{ padding: "12px 20px", fontWeight: 700, backgroundColor: getBgColor(row.p80, 18, 25, 35), color: getTextColor(row.p80, 18, 25, 35) }}>{row.p80?.toFixed(1)}</td>
                    <td style={{ padding: "12px 20px", fontWeight: 700, backgroundColor: getBgColor(row.o2d, 20, 28, 35), color: getTextColor(row.o2d, 20, 28, 35) }}>{row.o2d?.toFixed(1)}</td>
                    <td style={{ padding: "12px 20px", fontWeight: 700, backgroundColor: getBgColor(row.o2del, 35, 45, 55), color: getTextColor(row.o2del, 35, 45, 55) }}>{row.o2del?.toFixed(1)}</td>
                    <td style={{ padding: "12px 20px", fontWeight: 700, backgroundColor: getBgColor(row.p80O2del, 35, 45, 55), color: getTextColor(row.p80O2del, 35, 45, 55) }}>{row.p80O2del?.toFixed(1)}</td>
                  </tr>
                ))}
              </React.Fragment>
            ))}

            {/* If Filtered Mode, show Accordion Rows inside the table */}
            {!loading && !isDefault && groupedData.map(group => (
              <AccordionTableRow key={group.name} group={group} isOneWeek={weekDefs.length <= 1} />
            ))}
          </tbody>
        </table>
      </div>
        </React.Fragment>
      )}
    </div>
  );
}

function AccordionTableRow({ group, isOneWeek }) {
  const [expanded, setExpanded] = useState(isOneWeek);

  useEffect(() => {
    if (isOneWeek) setExpanded(true);
  }, [isOneWeek]);

  return (
    <React.Fragment>
      {/* Group Summary Row */}
      <tr 
        onClick={() => !isOneWeek && setExpanded(!expanded)} 
        style={{ borderBottom: `1px solid ${C.borderSoft}`, cursor: isOneWeek ? "default" : "pointer", background: expanded ? C.surfaceHover : "#fff" }}
      >
        <td style={{ padding: "14px 20px", fontWeight: 800, color: "#1e3a8a", fontSize: 14 }}>
          {!isOneWeek && (
            <span style={{ display: "inline-block", width: 16, color: C.primary, fontSize: 12 }}>
              {expanded ? "▼" : "▶"}
            </span>
          )}
          {group.name}
        </td>
        <td style={{ padding: "14px 20px", fontWeight: 700 }}>{group.orders.toLocaleString()}</td>
        <td style={{ padding: "14px 20px", fontWeight: 700, backgroundColor: getBgColor(group.kpt, 12, 18, 25), color: getTextColor(group.kpt, 12, 18, 25) }}>{group.kpt.toFixed(1)}</td>
        <td style={{ padding: "14px 20px", fontWeight: 700, backgroundColor: getBgColor(group.p80, 18, 25, 35), color: getTextColor(group.p80, 18, 25, 35) }}>{group.p80.toFixed(1)}</td>
        <td style={{ padding: "14px 20px", fontWeight: 700, backgroundColor: getBgColor(group.o2d, 20, 28, 35), color: getTextColor(group.o2d, 20, 28, 35) }}>{group.o2d.toFixed(1)}</td>
        <td style={{ padding: "14px 20px", fontWeight: 700, backgroundColor: getBgColor(group.o2del, 35, 45, 55), color: getTextColor(group.o2del, 35, 45, 55) }}>{group.o2del.toFixed(1)}</td>
        <td style={{ padding: "14px 20px", fontWeight: 700, backgroundColor: getBgColor(group.p80O2del, 35, 45, 55), color: getTextColor(group.p80O2del, 35, 45, 55) }}>{group.p80O2del.toFixed(1)}</td>
      </tr>
      
      {/* Expanded Weeks Rows */}
      {expanded && group.weeks.map((row, idx) => (
        <tr key={idx} style={{ background: "#f8fafc", borderBottom: `1px solid ${C.borderSoft}` }}>
          <td style={{ padding: "10px 20px 10px 40px", fontWeight: 600, color: C.muted, fontSize: 13 }}>{row.weekLabel}</td>
          <td style={{ padding: "10px 20px", fontSize: 13 }}>{row.orders?.toLocaleString()}</td>
          <td style={{ padding: "10px 20px", fontWeight: 600, fontSize: 13, backgroundColor: getBgColor(row.kpt, 12, 18, 25), color: getTextColor(row.kpt, 12, 18, 25) }}>{row.kpt?.toFixed(1)}</td>
          <td style={{ padding: "10px 20px", fontWeight: 600, fontSize: 13, backgroundColor: getBgColor(row.p80, 18, 25, 35), color: getTextColor(row.p80, 18, 25, 35) }}>{row.p80?.toFixed(1)}</td>
          <td style={{ padding: "10px 20px", fontWeight: 600, fontSize: 13, backgroundColor: getBgColor(row.o2d, 20, 28, 35), color: getTextColor(row.o2d, 20, 28, 35) }}>{row.o2d?.toFixed(1)}</td>
          <td style={{ padding: "10px 20px", fontWeight: 600, fontSize: 13, backgroundColor: getBgColor(row.o2del, 35, 45, 55), color: getTextColor(row.o2del, 35, 45, 55) }}>{row.o2del?.toFixed(1)}</td>
          <td style={{ padding: "10px 20px", fontWeight: 600, fontSize: 13, backgroundColor: getBgColor(row.p80O2del, 35, 45, 55), color: getTextColor(row.p80O2del, 35, 45, 55) }}>{row.p80O2del?.toFixed(1)}</td>
        </tr>
      ))}
    </React.Fragment>
  );
}
