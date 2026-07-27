import 'dotenv/config';
import xlsx from 'xlsx';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function importMaster() {
  const filePath = '/Users/ajelhenry/Downloads/curefoods_tables_with_zone_mumbai.xlsx'; // Updated to your new file
  
  if (!fs.existsSync(filePath)) {
    console.error(`File not found at path: ${filePath}`);
    return;
  }

  console.log(`Reading master file: ${filePath}`);
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0]; // Assumes master data is on the first sheet
  const sheet = workbook.Sheets[sheetName];
  const rawRows = xlsx.utils.sheet_to_json(sheet, { defval: null });

  const uniqueOutletsMap = new Map();

  rawRows.forEach(row => {
    // Helper to find columns regardless of exact uppercase/lowercase matches
    const getVal = (keyStr) => {
      const foundKey = Object.keys(row).find(k => k && k.toLowerCase().includes(keyStr.toLowerCase()));
      return foundKey ? String(row[foundKey]).trim() : null;
    };

    const restId = getVal('restaurant_id') || getVal('restaurant id') || getVal('id');
    if (!restId || restId === 'null') return;
    const area = getVal('area');
    const dedupeKey = `${restId}_${area || 'no_area'}`;

    // If we haven't seen this restaurant_id + area combination yet, add it.
    if (!uniqueOutletsMap.has(dedupeKey)) {
      uniqueOutletsMap.set(dedupeKey, {
        restaurant_id: restId,
        brand_name: getVal('brand') || null,
        business_entity: getVal('business') || getVal('entity') || null,
        city: getVal('city') || null,
        area: area,
        zone: getVal('zone') || null
      });
    }
  });

  const outletsToUpsert = Array.from(uniqueOutletsMap.values());
  console.log(`Found ${outletsToUpsert.length} unique outlets. Upserting to outlet_master...`);

  if (outletsToUpsert.length > 0) {
    const CHUNK_SIZE = 1000; // Batch upsert to prevent payload too large errors
    for (let i = 0; i < outletsToUpsert.length; i += CHUNK_SIZE) {
      const chunk = outletsToUpsert.slice(i, i + CHUNK_SIZE);
      // Use the composite unique key for onConflict
      const { error } = await supabase.from('outlet_master').upsert(chunk, { onConflict: 'restaurant_id,area' });
      
      if (error) {
        console.error(`Error upserting outlets (Batch ${i}):`, error.message);
      }
    }
    console.log("✅ Successfully imported outlets to master table!");
  }
}

importMaster();