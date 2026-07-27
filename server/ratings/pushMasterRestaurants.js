require('dotenv').config();
const xlsx = require('xlsx');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function pushMasterRestaurants(filePath) {
  const wb = xlsx.readFile(filePath, { cellDates: true });

  const sheetName = wb.SheetNames.find(s => s.trim() === 'Rating & Feedback');
  if (!sheetName) {
    console.error('Sheet "Rating & Feedback" not found. Available:', wb.SheetNames);
    process.exit(1);
  }

  const rows = xlsx.utils.sheet_to_json(wb.Sheets[sheetName], { defval: null });
  console.log(`Total rows in sheet: ${rows.length}`);

  // Deduplicate by restaurant_id
  const uniqueMap = new Map();
  for (const row of rows) {
    const id = row.restaurant_id;
    if (!id) continue;
    const key = String(id).replace(/\.0$/, '').trim();
    if (!uniqueMap.has(key)) {
      uniqueMap.set(key, {
        restaurant_id: key,
        brand_name:       row.brand_name       || null,
        business_entity:  row.business_entity  || null,
        city:             row.city             || null,
        area:             row.area             || null,
      });
    }
  }

  const records = Array.from(uniqueMap.values());
  console.log(`Unique restaurants to upsert: ${records.length}`);

  // Upsert — no duplicates, existing rows updated if info changes
  const CHUNK = 500;
  for (let i = 0; i < records.length; i += CHUNK) {
    const chunk = records.slice(i, i + CHUNK);
    const { error } = await supabase
      .from('master_restaurants')
      .upsert(chunk, { onConflict: 'restaurant_id' });
    if (error) console.error(`Upsert error (batch ${i}):`, error.message);
    else console.log(`Upserted batch ${i} — ${i + chunk.length}`);
  }

  console.log('Done.');
}

const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage: node pushMasterRestaurants.js <path-to-excel>');
  process.exit(1);
}

pushMasterRestaurants(filePath);
