import { pool } from './server/ratings/db.js';

async function fixStuckJobs() {
  const res = await pool.query(`UPDATE bulk_toggle_jobs SET status = 'CANCELLED' WHERE status IN ('RUNNING', 'PAUSED') RETURNING id`);
  console.log(`Cancelled stuck jobs:`, res.rows);
  process.exit(0);
}

fixStuckJobs();
