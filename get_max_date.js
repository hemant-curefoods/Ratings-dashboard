import { pool } from './server/ratings/db.js';

async function run() {
  try {
    const res = await pool.query('SELECT max(date) as max_date FROM order_reviews');
    console.log("MAX DATE IN DB:", res.rows[0].max_date);
    const countRes = await pool.query('SELECT count(*) as total_rows FROM order_reviews');
    console.log("TOTAL ROWS IN DB:", countRes.rows[0].total_rows);
  } catch (err) {
    console.error("DB Query error:", err);
  } finally {
    await pool.end();
  }
}

run();
