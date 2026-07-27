require('dotenv').config();
const xlsx = require('xlsx');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function pushOutletMaster(filePath) {
  const wb = xlsx.readFile(filePath, { defval: null });
  const rows = xlsx.utils.sheet_to_json(wb.Sheets['outlet_master'], { defval: null });
  console.log(`Total rows in sheet: ${rows.length}`);

  // Deduplicate by restaurant_id before pushing
  const uniqueMap = new Map();
  for (const row of rows) {
    if (!row.restaurant_id) continue;
    const key = `${String(row.restaurant_id).replace(/\.0$/, '').trim()}_${row.area || ''}`;
    if (!uniqueMap.has(key)) {
      uniqueMap.set(key, {
        restaurant_id:   String(row.restaurant_id).replace(/\.0$/, '').trim(),
        brand_name:      row.brand_name      || null,
        business_entity: row.business_entity || null,
        city:            row.city            || null,
        area:            row.area            || null,
        zone:            row.Zone            || null,
      });
    }
  }

  const records = Array.from(uniqueMap.values());
  console.log(`Unique restaurants to upsert: ${records.length}`);

  const CHUNK = 500;
  for (let i = 0; i < records.length; i += CHUNK) {
    const chunk = records.slice(i, i + CHUNK);
    const { error } = await supabase
      .from('outlet_master')
      .upsert(chunk, { onConflict: 'restaurant_id,area' });
    if (error) console.error(`Upsert error (batch ${i}):`, error.message);
    else console.log(`Upserted rows ${i + 1}–${i + chunk.length}`);
  }

  console.log('Done.');
}

const filePath = process.argv[2] || '/Users/ajelhenry/CFI_website/server/curefoods_tables_with_zone_mumbai.xlsx';
pushOutletMaster(filePath);
