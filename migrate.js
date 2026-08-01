import { createClient } from '@supabase/supabase-js';
import pg from 'pg';
import 'dotenv/config';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const postgresString = "postgresql://new_user:StrongPassword123!@103.172.150.31/website";

async function runMigration() {
  console.log("Starting DB migration from Supabase to PostgreSQL (Optimized Batch Mode)...");
  const pgClient = new pg.Client({ connectionString: postgresString });
  
  try {
    await pgClient.connect();
    console.log("Connected to target PostgreSQL database!");

    // ─── 1. RESUME OR SYNC OUTLETS ──────────────────────────────────
    console.log("\n[1/2] Syncing outlet master...");
    let outlets = [];
    let page = 0;
    const pageSize = 1000;
    
    while (true) {
      const { data, error } = await supabase
        .from('outlet_master')
        .select('*')
        .range(page * pageSize, (page + 1) * pageSize - 1);
        
      if (error) throw error;
      if (!data || data.length === 0) break;
      outlets = outlets.concat(data);
      if (data.length < pageSize) break;
      page++;
    }
    
    console.log(`Fetched ${outlets.length} outlets. Syncing...`);
    for (const r of outlets) {
      await pgClient.query(`
        INSERT INTO outlet_master (restaurant_id, brand_name, business_entity, city, area, zone)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (restaurant_id, area) 
        DO UPDATE SET 
          brand_name = EXCLUDED.brand_name,
          business_entity = EXCLUDED.business_entity,
          city = EXCLUDED.city,
          zone = EXCLUDED.zone
      `, [r.restaurant_id, r.brand_name, r.business_entity, r.city, r.area, r.zone]);
    }
    console.log(`Outlet master sync complete!`);

    // ─── 2. MIGRATE ORDER REVIEWS WITH OPTIMIZED BATCHES ─────────────
    console.log("\n[2/2] Resuming order reviews migration...");
    
    // Check how many reviews already exist in Postgres to resume seamlessly
    const countRes = await pgClient.query('SELECT count(*) FROM order_reviews');
    const existingCount = parseInt(countRes.rows[0].count);
    console.log(`Found ${existingCount} reviews already migrated to Postgres.`);
    
    let reviewPage = Math.floor(existingCount / 1000);
    let totalReviewsMigrated = existingCount;
    
    while (true) {
      const { data: reviews, error: reviewErr } = await supabase
        .from('order_reviews')
        .select('*')
        .order('id', { ascending: true }) // Paginate reliably by ID
        .range(reviewPage * pageSize, (reviewPage + 1) * pageSize - 1);
        
      if (reviewErr) throw reviewErr;
      if (!reviews || reviews.length === 0) break;
      
      console.log(`Fetched batch ${reviewPage + 1} (${reviews.length} rows from Supabase). Syncing to Postgres...`);
      
      // Perform batch inserts in a single SQL query
      const values = [];
      const valuePlaceholders = [];
      let paramIndex = 1;
      
      for (const r of reviews) {
        values.push(
          r.order_id, r.restaurant_id, r.area, r.item_name, r.date,
          r.ordered_time, r.gmv_total, r.comments, r.restaurant_rating,
          r.post_status, r.updated_at
        );
        valuePlaceholders.push(`($${paramIndex}, $${paramIndex+1}, $${paramIndex+2}, $${paramIndex+3}, $${paramIndex+4}, $${paramIndex+5}, $${paramIndex+6}, $${paramIndex+7}, $${paramIndex+8}, $${paramIndex+9}, $${paramIndex+10})`);
        paramIndex += 11;
      }
      
      const batchSql = `
        INSERT INTO order_reviews (
          order_id, restaurant_id, area, item_name, date, 
          ordered_time, gmv_total, comments, restaurant_rating, 
          post_status, updated_at
        )
        VALUES ${valuePlaceholders.join(', ')}
        ON CONFLICT (order_id, restaurant_id, item_name) 
        DO UPDATE SET
          area = EXCLUDED.area,
          date = EXCLUDED.date,
          ordered_time = EXCLUDED.ordered_time,
          gmv_total = EXCLUDED.gmv_total,
          comments = EXCLUDED.comments,
          restaurant_rating = EXCLUDED.restaurant_rating,
          post_status = EXCLUDED.post_status,
          updated_at = EXCLUDED.updated_at
      `;
      
      await pgClient.query(batchSql, values);
      
      totalReviewsMigrated += reviews.length;
      console.log(`Batch ${reviewPage + 1} inserted successfully! (Total progress: ${totalReviewsMigrated} reviews)`);
      
      if (reviews.length < pageSize) break;
      reviewPage++;
    }
    
    console.log(`\nMigration fully complete! Total reviews in Postgres: ${totalReviewsMigrated}`);
    
  } catch (err) {
    console.error("Migration failed:", err.message);
  } finally {
    await pgClient.end();
  }
}

runMigration();
