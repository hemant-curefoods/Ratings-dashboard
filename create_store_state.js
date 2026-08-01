import { pool } from './server/ratings/db.js';

async function run() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS store_state (
        location_id VARCHAR(100) PRIMARY KEY,
        brand VARCHAR(100),
        desired_state VARCHAR(20) DEFAULT 'ONLINE',
        active_orders INTEGER DEFAULT 0,
        last_updated TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log("store_state table created.");
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}
run();
