import { pool } from './server/ratings/db.js';
async function run() {
  const res = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'outlet_master'`);
  console.log(res.rows.map(r => r.column_name));
  pool.end();
}
run();
