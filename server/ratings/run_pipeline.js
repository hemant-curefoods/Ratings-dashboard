import 'dotenv/config';
import fs from 'fs';
import xlsx from 'xlsx';
import { pool } from './db.js';
import { checkForNewReports } from './gmailWatcher.js';

// ─── HELPERS ──────────────────────────────────────────────────

function normalizeDate(val) {
  if (!val) return null;
  if (val instanceof Date) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  if (typeof val === 'number') {
    const date = new Date(Math.round((val - 25569) * 86400 * 1000));
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const str = String(val).trim();
  const parts = str.split(/[-/]/);
  if (parts.length === 3 && parts[0].length === 2 && parts[2].length === 4)
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  return str.substring(0, 10);
}

function normalizeTime(val) {
  if (!val) return null;
  if (val instanceof Date) return val.toISOString();
  if (typeof val === 'number') {
    const date = new Date(Math.round((val - 25569) * 86400 * 1000));
    return date.toISOString();
  }
  return String(val).trim();
}

// ─── STEP 1: PARSE EXCEL ──────────────────────────────────────

function parseFile(filePath) {
  const wb = xlsx.readFile(filePath, { cellDates: true });
  const sheetName = wb.SheetNames.find(s => s.trim() === 'Rating & Feedback');
  if (!sheetName) {
    console.log('Sheet "Rating & Feedback" not found in:', filePath);
    return [];
  }
  return xlsx.utils.sheet_to_json(wb.Sheets[sheetName], { defval: null });
}

// ─── ZONE DETAILS REFERENCE MAPPING ───────────────────────────

let zoneMap = null;

async function loadZoneMap() {
  if (zoneMap) return zoneMap;
  zoneMap = new Map();

  const paths = [
    new URL('../curefoods_tables_with_zone_mumbai.xlsx', import.meta.url).pathname,
    '/Users/ajelhenry/Downloads/curefoods_tables_zone_details_mumbai.xlsx',
    '/Users/ajelhenry/Downloads/curefoods_tables_with_zone_mumbai.xlsx',
    new URL('downloads/curefoods_tables_zone_details_mumbai.xlsx', import.meta.url).pathname,
    new URL('downloads/curefoods_tables_with_zone_mumbai.xlsx', import.meta.url).pathname
  ];

  let filePath = null;
  for (const p of paths) {
    if (fs.existsSync(p)) {
      filePath = p;
      break;
    }
  }

  if (!filePath) {
    console.log('Warning: Zone details reference file not found in Downloads. Zone mapping will be skipped.');
    return zoneMap;
  }

  console.log(`Loading zone details from reference file: ${filePath}`);
  try {
    const wb = xlsx.readFile(filePath);
    const sheetName = wb.SheetNames.find(name => 
      name.toLowerCase().includes('zone') || 
      name.toLowerCase().includes('outlet_master')
    ) || wb.SheetNames[0];

    const sheet = wb.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(sheet, { defval: null });

    const getColVal = (row, keyStr) => {
      const foundKey = Object.keys(row).find(k => k && k.toLowerCase().replace(/_/g, ' ').includes(keyStr.toLowerCase().replace(/_/g, ' ')));
      return foundKey ? String(row[foundKey]).trim() : null;
    };

    for (const row of rows) {
      const city = getColVal(row, 'city');
      const area = getColVal(row, 'area');
      const zone = getColVal(row, 'zone');
      if (city && area && zone) {
        const key = `${city.toLowerCase()}_${area.toLowerCase()}`;
        zoneMap.set(key, zone);
      }
    }
    console.log(`Loaded ${zoneMap.size} zone mappings successfully from sheet "${sheetName}".`);
  } catch (err) {
    console.error('Failed to parse zone details reference file:', err.message);
  }

  return zoneMap;
}

// ─── STEP 2: SYNC OUTLET MASTER ───────────────────────────────

async function syncOutletMaster(rows) {
  // Load the zone mappings from the reference file
  const zMap = await loadZoneMap();

  // 1. Fetch all existing restaurant_id + area combinations from outlet_master along with city and zone
  console.log('Fetching existing outlets from database...');
  let existingOutlets = [];
  try {
    const res = await pool.query('SELECT restaurant_id, area, city, zone FROM outlet_master');
    existingOutlets = res.rows || [];
  } catch (err) {
    console.error('Error fetching existing outlets:', err.message);
  }

  // Create lookup maps/sets for fast checking
  const existingSet = new Set(existingOutlets.map(o => `${o.restaurant_id}_${o.area}`));
  const uniqueNewMap = new Map();

  for (const row of rows) {
    if (!row.restaurant_id || !row.area) continue;
    const restId = String(row.restaurant_id).trim();
    const area = String(row.area).trim();
    const key = `${restId}_${area}`;

    if (existingSet.has(key) || uniqueNewMap.has(key)) continue;

    const brandName = row.brand_name ? String(row.brand_name).trim() : null;
    const businessEntity = row.business_entity ? String(row.business_entity).trim() : null;
    const city = row.city ? String(row.city).trim() : null;

    let zone = null;
    if (city) {
      const cleanCity = city.toLowerCase();
      // 1. Check if the reference map has it
      if (zMap[cleanCity]) {
        zone = zMap[cleanCity];
      } else {
        // 2. Fallback to common zones mapping
        const commonZones = {
          'bangalore': 'South', 'bengaluru': 'South', 'hyderabad': 'South', 'chennai': 'South',
          'mumbai': 'West', 'bombay': 'West', 'pune': 'West', 'ahmedabad': 'West',
          'delhi': 'North', 'new delhi': 'North', 'gurgaon': 'North', 'gurugram': 'North',
          'guwahati': 'East', 'kolkata': 'East', 'calcutta': 'East', 'bhubaneswar': 'East'
        };
        if (commonZones[cleanCity]) {
          zone = commonZones[cleanCity];
        }
      }
    }

    uniqueNewMap.set(key, {
      restaurant_id: restId,
      brand_name: brandName,
      business_entity: businessEntity,
      city: city,
      area: area,
      zone: zone
    });
  }

  const outletsToInsert = Array.from(uniqueNewMap.values());
  if (outletsToInsert.length === 0) {
    console.log('No new outlets to insert.');
    return;
  }

  console.log(`Inserting ${outletsToInsert.length} new unique outlets into outlet_master...`);
  for (const o of outletsToInsert) {
    try {
      await pool.query(`
        INSERT INTO outlet_master (restaurant_id, brand_name, business_entity, city, area, zone)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (restaurant_id, area) DO NOTHING
      `, [o.restaurant_id, o.brand_name, o.business_entity, o.city, o.area, o.zone]);
    } catch (err) {
      console.error(`outlet_master insert error for ID ${o.restaurant_id}:`, err.message);
    }
  }
  console.log('Successfully completed outlet_master sync.');
}

// ─── STEP 3: PUSH ORDER REVIEWS ───────────────────────────────

async function pushOrderReviews(rows) {
  // Deduplicate locally on order_id + restaurant_id + item_name
  const uniqueMap = new Map();
  for (const row of rows) {
    const orderId  = row.order_id    != null ? String(row.order_id).replace(/\.0$/, '').trim() : null;
    const restId   = row.restaurant_id != null ? String(row.restaurant_id).replace(/\.0$/, '').trim() : null;
    const itemName = row.item_name   != null ? String(row.item_name).replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase() : '';

    if (!orderId || orderId === 'null' || !restId || restId === 'null') continue;

    const key = `${orderId}_${restId}_${itemName}`;
    if (!uniqueMap.has(key)) {
      uniqueMap.set(key, {
        order_id: orderId,
        restaurant_id: restId,
        area: row.area ? String(row.area).trim() : null,
        item_name: row.item_name ? String(row.item_name).replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim() : 'NO_ITEM',
        date: normalizeDate(row.date),
        ordered_time: normalizeTime(row.ordered_time),
        gmv_total: row.gmv_total != null ? parseFloat(row.gmv_total) : null,
        comments: row.comments ? String(row.comments).trim() : null,
        restaurant_rating: row.restaurant_rating != null ? parseInt(row.restaurant_rating) : null,
        post_status: row.post_status ? String(row.post_status).trim() : null,
        updated_at: new Date().toISOString()
      });
    }
  }

  const localRecords = Array.from(uniqueMap.values());
  console.log(`Unique records after local dedupe: ${localRecords.length}`);

  // Check PostgreSQL for already existing rows
  const allOrderIds = [...new Set(localRecords.map(r => r.order_id))];
  const existingKeys = new Set();
  const FETCH_CHUNK = 200;

  for (let i = 0; i < allOrderIds.length; i += FETCH_CHUNK) {
    const chunkIds = allOrderIds.slice(i, i + FETCH_CHUNK);
    try {
      const res = await pool.query(
        `SELECT order_id, restaurant_id, item_name 
         FROM order_reviews 
         WHERE order_id = ANY($1)`,
        [chunkIds]
      );
      (res.rows || []).forEach(r => existingKeys.add(`${r.order_id}_${r.restaurant_id}_${r.item_name}`));
    } catch (err) {
      console.error('Fetch error from Postgres:', err.message);
    }
  }

  const toInsert = localRecords.filter(r => !existingKeys.has(`${r.order_id}_${r.restaurant_id}_${r.item_name}`));
  console.log(`Skipped ${localRecords.length - toInsert.length} already existing reviews.`);
  console.log(`Inserting ${toInsert.length} new reviews into order_reviews...`);

  if (toInsert.length === 0) return console.log('Nothing new to insert.');

  for (const r of toInsert) {
    try {
      await pool.query(`
        INSERT INTO order_reviews (
          order_id, restaurant_id, area, item_name, date, 
          ordered_time, gmv_total, comments, restaurant_rating, 
          post_status, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (order_id, restaurant_id, item_name) DO NOTHING
      `, [
        r.order_id, r.restaurant_id, r.area, r.item_name, r.date,
        r.ordered_time, r.gmv_total, r.comments, r.restaurant_rating,
        r.post_status, r.updated_at
      ]);
    } catch (err) {
      console.error(`Insert error for order ${r.order_id}:`, err.message);
    }
  }
  console.log('Successfully completed order_reviews sync.');
}

// ─── MAIN PIPELINE ────────────────────────────────────────────

async function runPipeline(targetDate, attempt = 1, maxRetries = 3) {
  try {
    console.log(`\n[${new Date().toISOString()}] Running pipeline (attempt ${attempt}/${maxRetries})...`);

    const fetchTimeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('FETCH_TIMEOUT')), 300000)
    );

    const newFiles = await Promise.race([checkForNewReports(targetDate), fetchTimeout]);

    if (newFiles.length === 0) {
      console.log('No new files to process.');
      return;
    }

    for (const filePath of newFiles) {
      try {
        console.log(`\nProcessing: ${filePath}`);
        const rows = parseFile(filePath);
        if (rows.length === 0) continue;

        console.log(`Total rows in sheet: ${rows.length}`);

        // Step 1: Add any new restaurants to outlet_master
        await syncOutletMaster(rows);

        // Step 2: Push order data to order_reviews
        await pushOrderReviews(rows);
      } finally {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log(`Deleted processed file: ${filePath}`);
        }
      }
    }
  } catch (error) {
    console.error(`Pipeline error (attempt ${attempt}):`, error.message);
    if (attempt < maxRetries) {
      await runPipeline(targetDate, attempt + 1, maxRetries);
    } else {
      console.error(`Pipeline failed after ${maxRetries} attempts.`);
    }
  }
}

// ─── SCHEDULER: 12:00 PM and 12:00 AM ─────────────────────────

function msUntilNext(hour) {
  const now = new Date();
  const next = new Date();
  next.setHours(hour, 0, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next - now;
}

function startScheduler() {
  console.log('Pipeline scheduler started. Runs at 12:00 AM and 12:00 PM daily.');

  function scheduleNext(hour) {
    const ms = msUntilNext(hour);
    const nextRun = new Date(Date.now() + ms);
    console.log(`Next run at ${hour === 0 ? '12:00 AM' : '12:00 PM'}: ${nextRun.toLocaleString()}`);
    setTimeout(async () => {
      await runPipeline();
      scheduleNext(hour); // reschedule for next day
    }, ms);
  }

  scheduleNext(0);  // 12:00 AM
  scheduleNext(12); // 12:00 PM
}

export default { runPipeline };

// ─── ENTRY POINT ──────────────────────────────────────────────

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const args = process.argv.slice(2);
  if (args.includes('--schedule')) {
    startScheduler();
  } else if (args.length > 0) {
    runPipeline(args[0]);
  } else {
    runPipeline();
  }
}
