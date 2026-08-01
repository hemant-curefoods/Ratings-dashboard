import { pool } from './server/ratings/db.js';

async function fetchDbInfo() {
  try {
    const res = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    const tables = res.rows.map(r => r.table_name);
    console.log("TABLES FOUND:", tables.join(', '));
    console.log("--------------------------------------------------");
    
    for (const table of tables) {
      console.log(`\n--- TABLE: ${table} ---`);
      
      const columnsRes = await pool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = $1
      `, [table]);
      console.log("Columns:", columnsRes.rows.map(c => `${c.column_name} (${c.data_type})`).join(', '));
      
      const countRes = await pool.query(`SELECT COUNT(*) FROM ${table}`);
      console.log(`Total Rows: ${countRes.rows[0].count}`);
      
      const dataRes = await pool.query(`SELECT * FROM ${table} LIMIT 3`);
      if (dataRes.rows.length > 0) {
        console.log("Sample Data:");
        console.table(dataRes.rows);
      } else {
        console.log("Sample Data: (Empty)");
      }
    }
  } catch (err) {
    console.error("Error:", err);
  } finally {
    pool.end();
  }
}

fetchDbInfo();
