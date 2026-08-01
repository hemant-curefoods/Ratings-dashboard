import express from "express";

const router = express.Router();

const METABASE_API_URL = "https://clickhouse.eatfit.in/api/card/1847/query";
const METABASE_API_URL_KITCHEN = "https://clickhouse.eatfit.in/api/card/2523/query";

const BRAND_ZONES = {
  Delhi: 'NORTH', Gurgaon: 'NORTH', Noida: 'NORTH', Lucknow: 'NORTH', Chandigarh: 'NORTH',
  Ludhiana: 'NORTH', Jaipur: 'NORTH', Faridabad: 'NORTH', Ghaziabad: 'NORTH', Amritsar: 'NORTH',
  Dehradun: 'NORTH', Bengaluru: 'SOUTH', Bangalore: 'SOUTH', Chennai: 'SOUTH', Hyderabad: 'SOUTH',
  Coimbatore: 'SOUTH', Mysuru: 'SOUTH', Cochin: 'SOUTH', Thiruvananthapuram: 'SOUTH', Vizag: 'SOUTH',
  Hosur: 'SOUTH', Mangalore: 'SOUTH', Manipal: 'SOUTH', Palakkad: 'SOUTH', Puducherry: 'SOUTH',
  Tumakuru: 'SOUTH', Anantapur: 'SOUTH', Calicut: 'SOUTH', Ernakulam: 'SOUTH', Kakinada: 'SOUTH',
  Nellore: 'SOUTH', Rajahmundry: 'SOUTH', Tirupati: 'SOUTH', Vijayawada: 'SOUTH', Warangal: 'SOUTH',
  Mumbai: 'WEST', Pune: 'WEST', Ahemadabad: 'WEST', Goa: 'WEST', Surat: 'WEST', Nagpur: 'WEST',
  Vadodara: 'WEST', Indore: 'WEST', Bhopal: 'WEST', Aurangabad: 'WEST', Nashik: 'WEST',
  Kolkata: 'EAST', Guwahati: 'EAST', Bhubaneswar: 'EAST', Patna: 'EAST', Ranchi: 'EAST',
  Siliguri: 'EAST', Cuttack: 'EAST', Raipur: 'EAST'
};

const queryCache = new Map();

const getIsoDate = (daysAgo) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
};

export async function warmUpOpsCache() {
  console.log("[WORKERS] Starting Ops Matrix Cache Warmup...");
  const ranges = [
    { s: getIsoDate(8), e: getIsoDate(1) },   // 7 days
    { s: getIsoDate(15), e: getIsoDate(1) },  // 14 days
    { s: getIsoDate(31), e: getIsoDate(1) },  // 30 days
    { s: getIsoDate(91), e: getIsoDate(1) },  // 90 days
    { s: getIsoDate(182), e: getIsoDate(1) }  // 6 months
  ];

  const apiKey = process.env.METABASE_API;
  if (!apiKey) return;

  for (const { s, e } of ranges) {
    try {
      const payload = {
        parameters: [
          { type: "date/single", target: ["variable", ["template-tag", "s"]], value: s },
          { type: "date/single", target: ["variable", ["template-tag", "e"]], value: e }
        ]
      };
      
      const response = await fetch(METABASE_API_URL_KITCHEN, {
        method: "POST",
        headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      
      if (response.ok) {
        const json = await response.json();
        if (json.data && json.data.rows) {
          const cacheKey = JSON.stringify({ startDate: s, endDate: e, brand: "", zone: "", city: "", area: "" });
          queryCache.set(cacheKey, { data: json.data, timestamp: Date.now() });
          console.log(`[WORKERS] Successfully warmed up ops cache for ${s} to ${e}`);
        }
      }
      
      // Wait a bit to not overwhelm the clickhouse db
      await new Promise(r => setTimeout(r, 5000));
    } catch (err) {
      console.error(`[WORKERS] Failed to warm up ops cache for ${s} to ${e}`, err);
    }
  }
}


router.post("/prep-time", async (req, res) => {
  try {
    const { startDate, endDate, brand, subBrand, zone, city, area } = req.body;
    
    // Ensure the API Key is loaded
    const apiKey = process.env.METABASE_API;
    if (!apiKey) {
      return res.status(500).json({ success: false, error: "Metabase API Key not configured in .env" });
    }

    const payload = {
      parameters: [
        { type: "date/single", target: ["variable", ["template-tag", "s"]], value: startDate || "2026-07-01" },
        { type: "date/single", target: ["variable", ["template-tag", "e"]], value: endDate || "2026-07-19" },
      ]
    };

    if (brand) {
      payload.parameters.push({ type: "category", target: ["variable", ["template-tag", "Brand"]], value: brand });
    }
    if (subBrand) {
      payload.parameters.push({ type: "category", target: ["variable", ["template-tag", "sub_brand"]], value: subBrand });
    }
    if (zone) {
      payload.parameters.push({ type: "category", target: ["variable", ["template-tag", "zone"]], value: zone });
    }
    if (city) {
      payload.parameters.push({ type: "category", target: ["variable", ["template-tag", "city"]], value: city });
    }
    if (area) {
      payload.parameters.push({ type: "category", target: ["variable", ["template-tag", "area"]], value: area });
    }

    const response = await fetch(METABASE_API_URL, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Metabase API Error]", errorText);
      return res.status(response.status).json({ success: false, error: "Failed to fetch data from Metabase", details: errorText });
    }

    const data = await response.json();
    
    // DEBUG: Log the structure so we know how to map it in the frontend!
    if (data.data && data.data.rows && data.data.rows.length > 0) {
      console.log("=== METABASE DATA STRUCTURE ===");
      console.log("Columns:", data.data.cols.map(c => c.name));
      console.log("Sample Row:", data.data.rows[0]);
    }
    
    // The data comes back as { data: { rows: [...], cols: [...] } }
    return res.json({ success: true, data: data.data });

  } catch (err) {
    console.error("[Ops Matrix Error]", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post("/prep-time/kitchen", async (req, res) => {
  try {
    const { startDate, endDate, brand, subBrand, zone, city, area } = req.body;
    
    const apiKey = process.env.METABASE_API;
    if (!apiKey) {
      return res.status(500).json({ success: false, error: "Metabase API Key not configured in .env" });
    }

    const masterCacheKey = JSON.stringify({ startDate: startDate || "2026-07-01", endDate: endDate || "2026-07-19", brand: "", zone: "", city: "", area: "" });
    const exactCacheKey = JSON.stringify(req.body);

    // 1. Check exact cache match
    if (queryCache.has(exactCacheKey)) {
      const cacheEntry = queryCache.get(exactCacheKey);
      if (Date.now() - cacheEntry.timestamp < 24 * 60 * 60 * 1000) {
        return res.json({ success: true, data: cacheEntry.data, cached: true });
      }
    }

    // 2. Check if we have the master data and can just filter it in Node
    if (queryCache.has(masterCacheKey) && (brand || zone || city || area)) {
      const masterEntry = queryCache.get(masterCacheKey);
      if (Date.now() - masterEntry.timestamp < 24 * 60 * 60 * 1000) {
        let filteredRows = masterEntry.data.rows;
        
        if (brand) filteredRows = filteredRows.filter(r => r[0] === brand);
        if (city) filteredRows = filteredRows.filter(r => r[2] === city);
        if (area) filteredRows = filteredRows.filter(r => r[3] === area); // r[3] is kitchen
        if (zone) {
           filteredRows = filteredRows.filter(r => {
             const z = BRAND_ZONES[r[2]] || "OTHER";
             return z === zone;
           });
        }
        
        return res.json({ 
          success: true, 
          data: { ...masterEntry.data, rows: filteredRows }, 
          cached: true, 
          localFiltered: true 
        });
      }
    }

    const payload = {
      parameters: [
        { type: "date/single", target: ["variable", ["template-tag", "s"]], value: startDate || "2026-07-01" },
        { type: "date/single", target: ["variable", ["template-tag", "e"]], value: endDate || "2026-07-19" },
      ]
    };

    if (brand) {
      payload.parameters.push({ type: "category", target: ["variable", ["template-tag", "Brand"]], value: brand });
    }
    if (subBrand) {
      payload.parameters.push({ type: "category", target: ["variable", ["template-tag", "sub_brand"]], value: subBrand });
    }
    if (zone) {
      payload.parameters.push({ type: "category", target: ["variable", ["template-tag", "zone"]], value: zone });
    }
    if (city) {
      payload.parameters.push({ type: "category", target: ["variable", ["template-tag", "city"]], value: city });
    }
    if (area) {
      payload.parameters.push({ type: "category", target: ["variable", ["template-tag", "area"]], value: area });
    }

    const response = await fetch(METABASE_API_URL_KITCHEN, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Metabase API Error 2523]", errorText);
      return res.status(response.status).json({ success: false, error: "Failed to fetch kitchen data from Metabase", details: errorText });
    }

    const data = await response.json();
    
    // Save live fetch to cache for 24h
    queryCache.set(exactCacheKey, { data: data.data, timestamp: Date.now() });
    
    return res.json({ success: true, data: data.data });

  } catch (err) {
    console.error("[Ops Matrix Kitchen Error]", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
