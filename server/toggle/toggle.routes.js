import express from "express";
import { pool } from "../ratings/db.js";
import { checkAndIncrementRateLimit, logProblemStore, runBulkJob } from "./queue.js";

const router = express.Router();

// ─── URBANPIPER CONFIG ───────────────────────────────────────
const UP_LOCATION_URL = "https://api.urbanpiper.com/hub/api/v1/location/";
const UP_PLATFORMS    = ["swiggy", "zomato"];

const UP_BRANDS = {
  ovenfresh: {
    username : process.env.UP_USERNAME_OVENFRESH || "biz_adm_pmNKQXRHStVR",
    apikey   : process.env.UP_APIKEY_OVENFRESH   || "78cb85198b12fa391437679c5878bc7b50e38896",
    biz_id   : process.env.UP_BIZ_ID_OVENFRESH   || "62978428",
  },
  paris_cakes___desserts: {
    username : process.env.UP_USERNAME_OVENFRESH || "biz_adm_pmNKQXRHStVR",
    apikey   : process.env.UP_APIKEY_OVENFRESH   || "78cb85198b12fa391437679c5878bc7b50e38896",
    biz_id   : process.env.UP_BIZ_ID_OVENFRESH   || "62978428",
  },
  eatfit: {
    username : process.env.UP_USERNAME_EATFIT || "biz_adm_QXJeFIgABXFq",
    apikey   : process.env.UP_APIKEY_EATFIT   || "a7d35eac21f5e6eab9d760d25d71a899c3ba2178",
    biz_id   : process.env.UP_BIZ_ID_EATFIT   || "60578050",
  },
  eatfit___: {
    username : "biz_adm_QXJeFIgABXFq",
    apikey   : "a7d35eac21f5e6eab9d760d25d71a899c3ba2178",
    biz_id   : "60578050",
  },
  cake_zone: {
    username : process.env.UP_USERNAME_CAKEZONE || "biz_adm_zzXEiLApvfel",
    apikey   : process.env.UP_APIKEY_CAKEZONE   || "e4d7ccbe7e7342169523c37a516488fe3146a46c",
  },
};

// ─── HELPER: PERFORM API CALL ────────────────────────────────
async function performToggleAPI(location_id, action, brand) {
  const brandKey = brand.toLowerCase().replace(/[^a-z]/g, "_");
  const creds = UP_BRANDS[brandKey];
  if (!creds) return { success: false, error: `Unknown brand: ${brand}` };

  if (brandKey === "cake_zone" || brandKey === "eatfit___") {
    return { success: true, message: `[TEST MODE] Store ${action}d (API bypassed for ${brand})` };
  }

  let currentPlatforms = [...UP_PLATFORMS];
  let finalStatus = 500;
  let finalResponseText = "";

  while (currentPlatforms.length > 0) {
    const payload = {
      location_ref_id: String(location_id),
      action: action,
      platforms: currentPlatforms,
    };

    const response = await fetch(UP_LOCATION_URL, {
      method: "POST",
      headers: {
        "Authorization": `apikey ${creds.username}:${creds.apikey}`,
        "Content-Type": "application/json",
        ...(creds.biz_id ? { "x-upr-biz-id": creds.biz_id } : {})
      },
      body: JSON.stringify(payload),
    });

    finalStatus = response.status;
    finalResponseText = await response.text();
    console.log("[UP] Raw Response:", finalStatus, finalResponseText);

    if (response.status >= 200 && response.status < 300) {
      return { success: true, message: `Store ${action}d across platforms`, status: finalStatus };
    }

    if (response.status === 400) {
      try {
        const errBody = JSON.parse(finalResponseText);
        if (errBody.message && errBody.message.includes("not valid for platform")) {
          const badPlatformMatch = errBody.message.match(/platform['"\s]*([\w]+)/i);
          if (badPlatformMatch && badPlatformMatch[1]) {
            const badPlatform = badPlatformMatch[1].toLowerCase();
            currentPlatforms = currentPlatforms.filter(p => p !== badPlatform);
            continue;
          }
        } else if (errBody.message && (errBody.message.includes("Invalid platform") || errBody.message.includes("not associated"))) {
          if (currentPlatforms.length > 2) {
            currentPlatforms = ["swiggy", "zomato"];
            continue;
          }
        }
      } catch (e) {}
    }
    break;
  }

  let upErrorMsg = `UrbanPiper returned ${finalStatus}`;
  try {
    const errObj = JSON.parse(finalResponseText);
    if (errObj.message) upErrorMsg += ` - ${errObj.message}`;
  } catch (e) {}

  return { success: false, error: upErrorMsg, status: finalStatus };
}

// ─── SINGLE TOGGLE ENDPOINT ──────────────────────────────────
router.post("/toggle", async (req, res) => {
  const { location_id, store_name, action, brand = "ovenfresh" } = req.body;
  if (!location_id || !action) return res.status(400).json({ error: "location_id and action required" });
  if (!["enable", "disable"].includes(action)) return res.status(400).json({ error: 'action must be enable or disable' });

  // Rate Limiting check
  const rl = await checkAndIncrementRateLimit(brand);
  if (rl === -1) {
    await logProblemStore({ location_id, name: store_name, brand }, action, "Rate Limit Exceeded locally");
    await pool.query(`INSERT INTO toggle_activity (store_name, store_id, email, action, result, error_msg) VALUES ($1, $2, $3, $4, $5, $6)`, 
      [store_name, location_id, 'ajel@curefoods.in', action.toUpperCase(), 'FAILED', 'Rate Limit Exceeded']);
    return res.status(429).json({ error: "Rate limit exceeded (18/min). Try again later." });
  }

  try {
    const apiRes = await performToggleAPI(location_id, action, brand);
    
    if (apiRes.success) {
      await pool.query(`INSERT INTO toggle_activity (store_name, store_id, email, action, result) VALUES ($1, $2, $3, $4, $5)`, 
        [store_name, location_id, 'ajel@curefoods.in', action.toUpperCase(), 'SUCCESS']);
      await pool.query(`UPDATE api_health SET last_sync_time = NOW() WHERE brand = $1`, [brand]);
      return res.json(apiRes);
    } else {
      await pool.query(`INSERT INTO toggle_activity (store_name, store_id, email, action, result, error_msg) VALUES ($1, $2, $3, $4, $5, $6)`, 
        [store_name, location_id, 'ajel@curefoods.in', action.toUpperCase(), 'FAILED', apiRes.error]);
      await logProblemStore({ location_id, name: store_name, brand }, action, apiRes.error);
      return res.status(apiRes.status || 500).json(apiRes);
    }
  } catch (err) {
    console.error("[TOGGLE ERROR]", err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── BULK TOGGLE ENDPOINT ──────────────────────────────────
router.post("/toggle/bulk", async (req, res) => {
  const { stores, action, filterContext = "" } = req.body;
  if (!stores || !Array.isArray(stores) || stores.length === 0 || !action) {
    return res.status(400).json({ error: "stores array and action required" });
  }

  try {
    const jobRes = await pool.query(
      `INSERT INTO bulk_toggle_jobs (action, total_stores, pending_count) VALUES ($1, $2, $3) RETURNING id`,
      [action, stores.length, stores.length]
    );
    const jobId = jobRes.rows[0].id;
    
    // Kick off async worker
    runBulkJob(jobId, stores, action, filterContext, performToggleAPI).catch(err => console.error("Bulk job error:", err));
    
    return res.json({ success: true, jobId, message: "Bulk job initiated" });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── SIDEBAR DATA API ──────────────────────────────────────
router.get("/toggle/sidebar-data", async (req, res) => {
  try {
    // 1. API Health
    const healthRes = await pool.query(`SELECT * FROM api_health`);
    let healthStatus = "Healthy";
    let requestsUsed = 0;
    healthRes.rows.forEach(r => {
      requestsUsed = Math.max(requestsUsed, r.requests_this_minute);
    });

    // 2. Latest Bulk Job (Running, Paused, or recently Completed)
    const bulkRes = await pool.query(`SELECT * FROM bulk_toggle_jobs ORDER BY id DESC LIMIT 1`);
    const activeBulkJob = bulkRes.rows[0] || null;

    // 3. Recent Actions (last 30)
    await pool.query(`DELETE FROM toggle_activity WHERE created_at < NOW() - INTERVAL '48 hours'`);
    const actionsRes = await pool.query(`SELECT * FROM toggle_activity ORDER BY id DESC LIMIT 30`);
    
    // 4. Problem Stores
    const problemsRes = await pool.query(`SELECT * FROM problem_stores WHERE resolved = false ORDER BY last_attempt_at DESC`);

    // 5. Daily Stats
    const todayRes = await pool.query(`SELECT COUNT(*) as count FROM toggle_activity WHERE result = 'SUCCESS' AND created_at >= CURRENT_DATE`);
    const dailySuccessCount = parseInt(todayRes.rows[0].count, 10);

    return res.json({
      success: true,
      data: {
        apiHealth: {
          status: healthStatus,
          requestsThisMinute: requestsUsed, // Max among brands
          maxLimit: 18,
          lastSyncTime: healthRes.rows[0]?.last_sync_time || new Date(),
          keepaliveStatus: "Stopped"
        },
        activeBulkJob,
        recentActions: actionsRes.rows,
        problemStores: problemsRes.rows,
        dailyStats: {
          successCount: dailySuccessCount,
          problemCount: problemsRes.rows.length
        }
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── AUDIT LOG ENDPOINT ──────────────────────────────────────
router.get("/toggle/audit-log", async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM toggle_activity ORDER BY created_at DESC LIMIT 500`);
    res.json({ success: true, logs: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── RESOLVE PROBLEM ENDPOINTS ────────────────────────────────
router.post("/toggle/problem/retry", async (req, res) => {
  const { id } = req.body;
  await pool.query(`UPDATE problem_stores SET resolved = true WHERE id = $1`, [id]);
  res.json({ success: true });
});

router.post("/toggle/problem/force-sync", async (req, res) => {
  const { id } = req.body;
  await pool.query(`UPDATE problem_stores SET resolved = true WHERE id = $1`, [id]);
  res.json({ success: true });
});

router.post("/toggle/bulk/cancel", async (req, res) => {
  const { jobId } = req.body;
  await pool.query(`UPDATE bulk_toggle_jobs SET status = 'CANCELLED' WHERE id = $1`, [jobId]);
  res.json({ success: true });
});

router.post("/toggle/bulk/pause", async (req, res) => {
  const { jobId } = req.body;
  await pool.query(`UPDATE bulk_toggle_jobs SET status = 'PAUSED' WHERE id = $1`, [jobId]);
  res.json({ success: true });
});

router.post("/toggle/bulk/resume", async (req, res) => {
  const { jobId } = req.body;
  await pool.query(`UPDATE bulk_toggle_jobs SET status = 'RUNNING' WHERE id = $1`, [jobId]);
  res.json({ success: true });
});

// ─── UTILITY LOCATIONS (EXISTING) ─────────────────────────
router.get("/locations", async (req, res) => {
  const brand = req.query.brand || "ovenfresh";
  const brandKey = brand.toLowerCase().replace(/[^a-z]/g, "_");
  const creds = UP_BRANDS[brandKey];
  if (!creds) return res.status(400).json({ error: `Unknown brand: ${brand}` });
  try {
    const response = await fetch(UP_LOCATION_URL, {
      method  : "GET",
      headers : { "Authorization" : `apikey ${creds.username}:${creds.apikey}`, ...(creds.biz_id ? { "x-upr-biz-id": creds.biz_id } : {}) }
    });
    const responseText = await response.text();
    try { return res.json({ success: true, locations: JSON.parse(responseText) }); } catch(e) { return res.status(500).json({error: "Parse failed"}); }
  } catch (err) { return    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/history/download', async (req, res) => {
  try {
    const historyRes = await pool.query(`SELECT * FROM toggle_activity ORDER BY created_at DESC`);
    
    let csvStr = "Date/Time,User Email,Action Type,Result,Is Automated,Details\n";
    historyRes.rows.forEach(row => {
      const dt = new Date(row.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
      const email = row.email || 'System';
      const action = row.action;
      const result = row.result;
      const isAuto = row.is_automated ? "Yes" : "No";
      // Escape commas in store_name for CSV
      const details = `"${(row.store_name || '').replace(/"/g, '""')}"`;
      
      csvStr += `"${dt}","${email}","${action}","${result}","${isAuto}",${details}\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="Toggle_History_48h.csv"');
    res.send(csvStr);
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;