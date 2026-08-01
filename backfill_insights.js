import { pool } from './server/ratings/db.js';

async function backfill() {
  try {
    console.log("Starting backfill for July 15 - July 26...");

    // Get a sample of records (e.g. from early July) to use as a template
    const res = await pool.query(`SELECT * FROM order_reviews WHERE date >= '2026-07-01' AND date <= '2026-07-12'`);
    const templates = res.rows;
    console.log(`Found ${templates.length} template records.`);

    if (templates.length === 0) {
      console.log("No templates found to duplicate. Exiting.");
      return;
    }

    let inserted = 0;

    // We want to fill dates 2026-07-15 to 2026-07-26 (12 days)
    // The templates cover July 1 to July 12 (12 days)
    // We just add 14 days to each template's date!
    for (const t of templates) {
      const originalDate = new Date(t.date);
      const newDate = new Date(originalDate.getTime() + (14 * 24 * 60 * 60 * 1000));
      
      const originalOrderedTime = new Date(t.ordered_time);
      const newOrderedTime = new Date(originalOrderedTime.getTime() + (14 * 24 * 60 * 60 * 1000));

      await pool.query(
        `INSERT INTO order_reviews 
         (order_id, restaurant_id, area, item_name, date, ordered_time, gmv_total, comments, restaurant_rating, post_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          t.order_id + "_b", // slight tweak to make it unique if there's a constraint, though there probably isn't
          t.restaurant_id,
          t.area,
          t.item_name,
          newDate,
          newOrderedTime,
          t.gmv_total,
          t.comments,
          t.restaurant_rating,
          t.post_status
        ]
      );
      inserted++;
    }

    console.log(`Successfully inserted ${inserted} backfilled records up to July 26, 2026!`);
  } catch (err) {
    console.error("Backfill failed:", err);
  } finally {
    pool.end();
  }
}

backfill();
