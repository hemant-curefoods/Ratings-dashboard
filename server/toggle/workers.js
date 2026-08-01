import { pool } from '../ratings/db.js';
import { warmUpOpsCache } from '../ops_matrix/ops.routes.js';

// Define the URL to hit our own bulk endpoint (assuming running on port 3000 locally, or deployed host)
const API_URL = process.env.API_URL || "http://localhost:3000/api";

export function startWorkers() {
  console.log("[WORKERS] Starting background workers...");

  // Hourly Recheck Cron (Runs every 60 minutes)
  // Grabs all stores where desired_state = 'ONLINE' and pushes to the bulk queue.
  setInterval(async () => {
    try {
      console.log("[WORKERS] Running Hourly Recheck Cron...");
      
      // Check if there is already a RUNNING or PAUSED bulk job. If so, skip this hour to prevent overlap lock.
      const lockRes = await pool.query(`SELECT id FROM bulk_toggle_jobs WHERE status IN ('RUNNING', 'PAUSED')`);
      if (lockRes.rows.length > 0) {
         console.log("[WORKERS] Hourly Recheck skipped due to active bulk job lock.");
         return;
      }

      // Fetch all stores that should be online
      const storesRes = await pool.query(`SELECT location_id, brand FROM store_state WHERE desired_state = 'ONLINE'`);
      const stores = storesRes.rows;

      if (stores.length === 0) return;

      console.log(`[WORKERS] Hourly Recheck found ${stores.length} ONLINE stores to verify.`);

      // Send to our own bulk endpoint to process them properly through the queue
      await fetch(`${API_URL}/toggle/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "enable",
          stores: stores,
          filterContext: " (Hourly Recheck)"
        })
      });

    } catch (err) {
      console.error("[WORKERS] Hourly Recheck failed:", err);
    }
  }, 60 * 60 * 1000); // 60 minutes


  // Watchdog Cron (Runs every 5 minutes)
  // Grabs stores where desired_state = 'ONLINE' but they are physically OFFLINE due to threshold cooling
  setInterval(async () => {
    try {
      console.log("[WORKERS] Running Watchdog Cron...");
      
      // Look for stores that want to be online, but currently have <= 8 active_orders
      const storesRes = await pool.query(`
        SELECT location_id, brand 
        FROM store_state 
        WHERE desired_state = 'ONLINE' AND active_orders <= 8
      `);
      
      const stores = storesRes.rows;
      if (stores.length === 0) return;
      
      // Find stores that we recently disabled automatically (Auto-throttled).
      const coolingRes = await pool.query(`
        SELECT DISTINCT store_id as location_id
        FROM toggle_activity 
        WHERE created_at >= NOW() - INTERVAL '2 hour'
        AND action = 'DISABLE'
        AND (is_automated = true OR store_name LIKE 'Bulk%')
      `);
      const coolingStoreIds = coolingRes.rows.map(r => r.location_id);

      const storesToWakeUp = stores.filter(s => coolingStoreIds.includes(s.location_id));

      if (storesToWakeUp.length === 0) return;

      console.log(`[WORKERS] Watchdog found ${storesToWakeUp.length} cooled stores ready to wake up.`);

      await fetch(`${API_URL}/toggle/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "enable",
          stores: storesToWakeUp,
          filterContext: " (Watchdog Wakeup)"
        })
      });

    } catch (err) {
      console.error("[WORKERS] Watchdog failed:", err);
    }
  }, 5 * 60 * 1000); // 5 minutes

  // Warmup Ops Cache (Runs every 1 hour)
  setInterval(() => {
    warmUpOpsCache();
  }, 60 * 60 * 1000);
  
  // Initial run on startup
  setTimeout(() => warmUpOpsCache(), 5000);

}
