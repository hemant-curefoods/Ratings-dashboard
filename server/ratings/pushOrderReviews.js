require('dotenv').config();
const xlsx = require('xlsx');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

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
  if (parts.length === 3 && parts[0].length === 2 && parts[2].length === 4) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
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

async function pushOrderReviews(filePath) {
  const wb = xlsx.readFile(filePath, { cellDates: true });

  const sheetName = wb.SheetNames.find(s => s.trim() === 'Rating & Feedback');
  if (!sheetName) {
    console.error('Sheet "Rating & Feedback" not found. Available:', wb.SheetNames);
    process.exit(1);
  }

  const rawRows = xlsx.utils.sheet_to_json(wb.Sheets[sheetName], { defval: null });
  console.log(`Total rows in sheet: ${rawRows.length}`);

  // Build only the columns we need, skip rows missing the 3 key fields
  const uniqueMap = new Map();
  for (const row of rawRows) {
    const orderId    = row.order_id    != null ? String(row.order_id).replace(/\.0$/, '').trim() : null;
    const restId     = row.restaurant_id != null ? String(row.restaurant_id).replace(/\.0$/, '').trim() : null;
    const itemName   = row.item_name   != null ? String(row.item_name).replace(/\u00A0/g, ' ').trim() : null;

    if (!orderId || !restId || !itemName) continue;

    const key = `${orderId}_${restId}_${itemName}`;
    if (!uniqueMap.has(key)) {
      uniqueMap.set(key, {
        order_id:           orderId,
        restaurant_id:      restId,
        date:               normalizeDate(row.date),
        ordered_time:       normalizeTime(row.ordered_time),
        gmv_total:          row.gmv_total   ?? null,
        item_name:          itemName,
        comments:           row.comments    ?? null,
        restaurant_rating:  row.restaurant_rating ?? null,
        post_status:        row.post_status ?? null,
      });
    }
  }

  const localRecords = Array.from(uniqueMap.values());
  console.log(`Unique records (local dedupe): ${localRecords.length}`);

  // Fetch existing keys from Supabase in chunks to avoid duplicates in DB
  const allOrderIds = [...new Set(localRecords.map(r => r.order_id))];
  console.log(`Checking ${allOrderIds.length} unique order_ids against Supabase...`);

  const existingKeys = new Set();
  const FETCH_CHUNK = 200;
  for (let i = 0; i < allOrderIds.length; i += FETCH_CHUNK) {
    const chunk = allOrderIds.slice(i, i + FETCH_CHUNK);
    let from = 0;
    while (true) {
      const { data, error } = await supabase
        .from('order_reviews')
        .select('order_id, restaurant_id, item_name')
        .in('order_id', chunk)
        .range(from, from + 999);
      if (error) { console.error('Fetch error:', error.message); break; }
      (data || []).forEach(r => existingKeys.add(`${r.order_id}_${r.restaurant_id}_${r.item_name}`));
      if (!data || data.length < 1000) break;
      from += 1000;
    }
  }

  const toInsert = localRecords.filter(r => !existingKeys.has(`${r.order_id}_${r.restaurant_id}_${r.item_name}`));
  console.log(`Skipped ${localRecords.length - toInsert.length} already existing rows.`);
  console.log(`Inserting ${toInsert.length} new rows...`);

  if (toInsert.length === 0) {
    return console.log('Nothing new to insert.');
  }

  const INSERT_CHUNK = 500;
  for (let i = 0; i < toInsert.length; i += INSERT_CHUNK) {
    const chunk = toInsert.slice(i, i + INSERT_CHUNK);
    const { error } = await supabase.from('order_reviews').insert(chunk);
    if (error) console.error(`Insert error (batch ${i}):`, error.message);
    else console.log(`Inserted rows ${i + 1}–${i + chunk.length}`);
  }

  console.log('Done.');
}

const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage: node pushOrderReviews.js "<path-to-excel>"');
  process.exit(1);
}

pushOrderReviews(filePath);
