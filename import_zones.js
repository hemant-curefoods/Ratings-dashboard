import 'dotenv/config';
import xlsx from 'xlsx';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const pathsToCheck = [
  '/Users/ajelhenry/Downloads/curefoods_tables_with_zone_mumbai.xlsx',
  '/Users/ajelhenry/CFI_website/server/curefoods_tables_with_zone_mumbai.xlsx',
  '/Users/ajelhenry/CFI_website/curefoods_tables_with_zone_mumbai.xlsx'
];

async function run() {
  let filePath = null;
  for (const p of pathsToCheck) {
    if (fs.existsSync(p)) {
      filePath = p;
      break;
    }
  }

  if (!filePath) {
    console.error("Could not find curefoods_tables_with_zone_mumbai.xlsx in any of the checked paths!");
    console.error("Paths checked:", pathsToCheck);
    return;
  }

  console.log(`Using reference sheet: ${filePath}`);
  const workbook = xlsx.readFile(filePath);
  
  // Try to find sheet name that looks like outlet_master or check the first sheet
  let sheetName = workbook.SheetNames.find(s => s.toLowerCase().includes('outlet'));
  if (!sheetName) {
    sheetName = workbook.SheetNames[0];
  }
  console.log(`Reading sheet: ${sheetName}`);
  
  const sheet = workbook.Sheets[sheetName];
  const rawRows = xlsx.utils.sheet_to_json(sheet, { defval: null });

  const uniqueOutletsMap = new Map();

  rawRows.forEach(row => {
    const getVal = (keyStr) => {
      const foundKey = Object.keys(row).find(k => k && k.toLowerCase().includes(keyStr.toLowerCase()));
      return foundKey ? String(row[foundKey]).trim() : null;
    };

    const restId = getVal('restaurant_id') || getVal('restaurant id') || getVal('id');
    if (!restId || restId === 'null') return;
    
    const area = getVal('area');
    const zone = getVal('zone');
    
    // We only care if a zone is present in the reference sheet
    if (!zone || zone.toLowerCase() === 'null') return;

    const dedupeKey = `${restId}_${area || 'no_area'}`;
    uniqueOutletsMap.set(dedupeKey, {
      restaurant_id: restId,
      area: area,
      zone: zone
    });
  });

  const outletsToUpdate = Array.from(uniqueOutletsMap.values());
  console.log(`Found ${outletsToUpdate.length} unique outlets with zone mappings in reference sheet.`);

  if (outletsToUpdate.length > 0) {
    const CHUNK_SIZE = 500;
    let updatedCount = 0;
    for (let i = 0; i < outletsToUpdate.length; i += CHUNK_SIZE) {
      const chunk = outletsToUpdate.slice(i, i + CHUNK_SIZE);
      
      // Upsert will match restaurant_id + area and update the zone
      const { error } = await supabase
        .from('outlet_master')
        .upsert(chunk, { onConflict: 'restaurant_id,area' });
        
      if (error) {
        console.error(`Error updating outlets (Batch ${i}):`, error.message);
      } else {
        updatedCount += chunk.length;
      }
    }
    console.log(`✅ Successfully updated ${updatedCount} outlets in the database with their correct zones!`);
  }
}

run().catch(console.error);
