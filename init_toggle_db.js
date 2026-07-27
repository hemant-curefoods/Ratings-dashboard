import { pool } from './server/ratings/db.js';
import fs from 'fs';

async function run() {
  try {
    const sql = fs.readFileSync('server/toggle/schema.sql', 'utf8');
    await pool.query(sql);
    console.log('Tables created successfully');
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}
run();
