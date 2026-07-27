import { pool } from './db.js';

async function run() {
  try {
    await pool.query(`ALTER TABLE bulk_toggle_jobs ADD COLUMN IF NOT EXISTS completed_store_ids TEXT[] DEFAULT '{}'`);
    console.log("Migration successful");
  } catch (err) {
    console.error("Migration failed", err);
  } finally {
    await pool.end();
  }
}

run();
