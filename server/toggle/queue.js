import { pool } from '../ratings/db.js';

export async function checkAndIncrementRateLimit(brand) {
  const res = await pool.query(`SELECT requests_this_minute, EXTRACT(EPOCH FROM (NOW() - minute_start_time)) as elapsed_seconds FROM api_health WHERE brand = $1`, [brand]);
  let health = res.rows[0];
  
  if (!health) {
    await pool.query(`INSERT INTO api_health (brand, requests_this_minute, minute_start_time) VALUES ($1, 1, NOW())`, [brand]);
    return 1;
  }
  
  if (health.elapsed_seconds >= 60 || health.elapsed_seconds < 0) {
    // New minute
    await pool.query(`UPDATE api_health SET requests_this_minute = 1, minute_start_time = NOW() WHERE brand = $1`, [brand]);
    return 1;
  } else {
    // Same minute
    if (health.requests_this_minute >= 18) {
      return -1; // Exceeded
    }
    const updatedCount = health.requests_this_minute + 1;
    await pool.query(`UPDATE api_health SET requests_this_minute = $1 WHERE brand = $2`, [updatedCount, brand]);
    return updatedCount;
  }
}

export async function logProblemStore(store, action, errorMsg) {
  const check = await pool.query(`SELECT id, fail_count FROM problem_stores WHERE store_id = $1 AND issue_type = 'FAILED'`, [store.location_id]);
  if (check.rows.length > 0) {
    await pool.query(`UPDATE problem_stores SET fail_count = fail_count + 1, last_attempt_at = NOW(), resolved = false WHERE id = $1`, [check.rows[0].id]);
  } else {
    await pool.query(`INSERT INTO problem_stores (store_name, store_id, brand, issue_type) VALUES ($1, $2, $3, 'FAILED')`, [store.name, store.location_id, store.brand]);
  }
}

export async function runBulkJob(jobId, stores, action, filterContext, performToggleAPI) {
  for (const store of stores) {
    let jobRes = await pool.query('SELECT status FROM bulk_toggle_jobs WHERE id = $1', [jobId]);
    let status = jobRes.rows[0]?.status;
    
    if (status === 'CANCELLED') break;
    
    while (status === 'PAUSED') {
      await new Promise(r => setTimeout(r, 2000));
      jobRes = await pool.query('SELECT status FROM bulk_toggle_jobs WHERE id = $1', [jobId]);
      status = jobRes.rows[0]?.status;
      if (status === 'CANCELLED') break;
    }
    
    if (status === 'CANCELLED') break;
    
    const brand = store.brand || "ovenfresh";

    // ─── JUST-IN-TIME VALIDATION & THRESHOLD CHECK ───
    try {
      const stateRes = await pool.query(`SELECT desired_state, active_orders FROM store_state WHERE location_id = $1`, [store.location_id]);
      if (stateRes.rows.length > 0) {
        const { desired_state, active_orders } = stateRes.rows[0];
        
        // Skip if manual override happened during the queue
        if (desired_state === 'OFFLINE' && action === 'enable') {
          console.log(`[JIT] Skipping ${store.location_id} - user set to OFFLINE manually.`);
          await pool.query('UPDATE bulk_toggle_jobs SET success_count = success_count + 1, pending_count = pending_count - 1 WHERE id = $1', [jobId]);
          continue;
        }

        // Apply 8-order threshold
        if (desired_state === 'ONLINE') {
          if (active_orders > 8) {
             console.log(`[THROTTLE] ${store.location_id} active_orders = ${active_orders} > 8. Auto-throttling to OFFLINE.`);
             action = 'disable';
          } else {
             action = 'enable';
          }
        }
      }
    } catch (err) {
      console.error("[JIT Check Error]", err);
    }
    
    // Wait for rate limit
    while (true) {
      const rl = await checkAndIncrementRateLimit(brand);
      if (rl === -1) {
        const hRes = await pool.query(`SELECT minute_start_time FROM api_health WHERE brand = $1`, [brand]);
        const start = new Date(hRes.rows[0].minute_start_time);
        const elapsed = new Date() - start;
        const sleepTime = Math.max(0, 60000 - elapsed) + 500;
        await new Promise(r => setTimeout(r, sleepTime));
      } else {
        break; // Allowed
      }
    }
    
    // Perform toggle
    try {
      const toggleRes = await performToggleAPI(store.location_id, action, brand);
      
      if (toggleRes.status === 429) {
        // Urban Piper returned 429. Force wait 61s and retry once.
        await new Promise(r => setTimeout(r, 61000));
        const retryRes = await performToggleAPI(store.location_id, action, brand);
        if (!retryRes.success) throw new Error(retryRes.error || "429 Retry failed");
      } else if (!toggleRes.success) {
        throw new Error(toggleRes.error);
      }
      
      await pool.query(`UPDATE managed_stores SET status = $1 WHERE location_id = $2`, [action === 'enable' ? 'online' : 'offline', store.location_id]);
      await pool.query('UPDATE bulk_toggle_jobs SET success_count = success_count + 1, pending_count = pending_count - 1, completed_store_ids = array_append(completed_store_ids, $1) WHERE id = $2', [store.location_id, jobId]);
      await pool.query(`UPDATE api_health SET last_sync_time = NOW() WHERE brand = $1`, [brand]);
    } catch (err) {
       await pool.query('UPDATE bulk_toggle_jobs SET failed_count = failed_count + 1, pending_count = pending_count - 1 WHERE id = $1', [jobId]);
       await logProblemStore(store, action, err.message);
    }
    
    // Delay 2s between requests for UP strictness
    await new Promise(r => setTimeout(r, 2000));
  }
  
  await pool.query('UPDATE bulk_toggle_jobs SET status = $1 WHERE id = $2 AND status IN ($3, $4)', ['COMPLETED', jobId, 'RUNNING', 'PAUSED']);
  const finalJob = await pool.query('SELECT * FROM bulk_toggle_jobs WHERE id = $1', [jobId]);
  const j = finalJob.rows[0];
  const uniqueBrands = [...new Set(stores.map(s => s.brand))].filter(Boolean).join(", ");
  const summaryMsg = `Bulk ${action.toUpperCase()} [${uniqueBrands}]${filterContext} — ${j.total_stores} Total ✅ ${j.success_count} ❌ ${j.failed_count}`;
  await pool.query(`INSERT INTO toggle_activity (store_name, email, action, result, is_bulk, bulk_job_id) VALUES ($1, $2, $3, $4, $5, $6)`, [summaryMsg, 'ajel@curefoods.in', action.toUpperCase(), 'SUCCESS', true, jobId]);
}
