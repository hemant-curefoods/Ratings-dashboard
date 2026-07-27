import { pool } from './db.js';

/**
 * Main handler to fetch ALL outlet master data once so the frontend can do instant cascading filtering.
 */
async function handleFilterRequest(req, res) {
  try {
    // Fetch ALL outlets in a single query since Postgres has no 1000-row return limit
    const outletsResult = await pool.query('SELECT brand_name, city, zone, area FROM outlet_master ORDER BY brand_name');
    const allData = outletsResult.rows;

    // Clean the data (spaces & trim)
    const cleanedData = allData.map(row => ({
      brand: row.brand_name ? String(row.brand_name).replace(/\s+/g, ' ').trim() : null,
      city: row.city ? String(row.city).replace(/\s+/g, ' ').trim() : null,
      zone: row.zone ? String(row.zone).replace(/\s+/g, ' ').trim() : null,
      area: row.area ? String(row.area).replace(/\s+/g, ' ').trim() : null,
    }));

    // Fetch max date from order_reviews
    const dateResult = await pool.query('SELECT date FROM order_reviews ORDER BY date DESC LIMIT 1');
    
    // Format date string to YYYY-MM-DD safely
    let maxDate = null;
    if (dateResult.rows.length > 0 && dateResult.rows[0].date) {
      const d = new Date(dateResult.rows[0].date);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      maxDate = `${year}-${month}-${day}`;
    }

    res.json({ masterData: cleanedData, maxDate });
  } catch (error) {
    console.error('Error fetching filter options:', error);
    res.status(500).json({ error: 'Failed to load filter options.' });
  }
}

export { handleFilterRequest };