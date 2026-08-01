import 'dotenv/config';
import xlsx from 'xlsx';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const tempPath = './temp_reference.xlsx';

async function run() {
  // Copy the reference sheet from Downloads to workspace
  console.log("Copying reference sheet from Downloads...");
  try {
    fs.copyFileSync('/Users/ajelhenry/Downloads/curefoods_tables_with_zone_mumbai.xlsx', tempPath);
  } catch (err) {
    console.error("Failed to copy file from Downloads:", err.message);
    return;
  }

  console.log("Reading reference sheet...");
  const workbook = xlsx.readFile(tempPath);
  let sheetName = workbook.SheetNames.find(s => s.toLowerCase().includes('outlet'));
  if (!sheetName) sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rawRows = xlsx.utils.sheet_to_json(sheet, { defval: null });

  console.log("Parsing reference sheet rows...");
  const uniqueOutletsMap = new Map();

  rawRows.forEach(row => {
    const getVal = (keyStr) => {
      const foundKey = Object.keys(row).find(k => k && k.toLowerCase().includes(keyStr.toLowerCase()));
      return foundKey ? String(row[foundKey]).trim() : null;
    };

    const restId = getVal('restaurant_id') || getVal('restaurant id') || getVal('id');
    if (!restId || restId === 'null') return;
    
    const area = getVal('area');
    const brand = getVal('brand') || null;
    const entity = getVal('business') || getVal('entity') || null;
    const city = getVal('city') || null;
    const zone = getVal('zone') || null;

    const dedupeKey = `${restId}_${area || 'no_area'}`;
    uniqueOutletsMap.set(dedupeKey, {
      restaurant_id: restId,
      brand_name: brand,
      business_entity: entity,
      city: city,
      area: area,
      zone: zone
    });
  });

  const referenceOutlets = Array.from(uniqueOutletsMap.values());
  console.log(`Found ${referenceOutlets.length} outlets in reference sheet.`);

  // 1. Update all reference sheet outlets in the DB (upserting ALL columns)
  console.log("Upserting all reference sheet outlets to DB...");
  const CHUNK_SIZE = 500;
  for (let i = 0; i < referenceOutlets.length; i += CHUNK_SIZE) {
    const chunk = referenceOutlets.slice(i, i + CHUNK_SIZE);
    const { error } = await supabase
      .from('outlet_master')
      .upsert(chunk, { onConflict: 'restaurant_id,area' });
    if (error) {
      console.error(`Error in batch ${i}:`, error.message);
    }
  }
  console.log("✅ Finished upserting reference outlets.");

  // 2. Fetch all outlets from DB with pagination
  console.log("Fetching all outlets from DB with pagination...");
  let dbOutlets = [];
  let page = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('outlet_master')
      .select('*')
      .order('id', { ascending: true })
      .range(page * pageSize, (page + 1) * pageSize - 1);
      
    if (error) {
      console.error("Error fetching from DB:", error.message);
      return;
    }
    if (!data || data.length === 0) break;
    dbOutlets = dbOutlets.concat(data);
    if (data.length < pageSize) break;
    page++;
  }

  console.log(`Fetched ${dbOutlets.length} total outlets from DB.`);

  // Build area -> zone and city -> zone maps from both reference sheet and DB
  const areaZoneMap = new Map();
  const cityZoneMap = new Map();

  // Populate from reference sheet first
  referenceOutlets.forEach(o => {
    if (o.area && o.zone) areaZoneMap.set(o.area.toLowerCase().trim(), o.zone.trim());
    if (o.city && o.zone) cityZoneMap.set(o.city.toLowerCase().trim(), o.zone.trim());
  });

  // Populate from DB outlets that already have zones
  dbOutlets.forEach(o => {
    if (o.area && o.zone) areaZoneMap.set(o.area.toLowerCase().trim(), o.zone.trim());
    if (o.city && o.zone) cityZoneMap.set(o.city.toLowerCase().trim(), o.zone.trim());
  });

  console.log(`Built area-to-zone map with ${areaZoneMap.size} unique areas.`);
  console.log(`Built city-to-zone map with ${cityZoneMap.size} unique cities.`);

  // 3. Heal missing zones, brands, and cities in DB
  const healedOutlets = [];
  const unknownCities = new Set();

  dbOutlets.forEach(o => {
    let changed = false;
    const updated = { ...o };

    // Fill missing brand, city, or entity if we have it in reference sheet
    const refMatch = referenceOutlets.find(r => r.restaurant_id === o.restaurant_id && r.area === o.area);
    if (refMatch) {
      if (!o.brand_name && refMatch.brand_name) { updated.brand_name = refMatch.brand_name; changed = true; }
      if (!o.city && refMatch.city) { updated.city = refMatch.city; changed = true; }
      if (!o.business_entity && refMatch.business_entity) { updated.business_entity = refMatch.business_entity; changed = true; }
      if (!o.zone && refMatch.zone) { updated.zone = refMatch.zone; changed = true; }
    }

    // Heal Zone if still null
    if (!updated.zone) {
      // 1. Try area match
      if (o.area) {
        const matchedZone = areaZoneMap.get(o.area.toLowerCase().trim());
        if (matchedZone) {
          updated.zone = matchedZone;
          changed = true;
        }
      }
      
      // 2. Try city match fallback
      if (!updated.zone && o.city) {
        const matchedZone = cityZoneMap.get(o.city.toLowerCase().trim());
        if (matchedZone) {
          updated.zone = matchedZone;
          changed = true;
        }
      }

      // If still null, log it as unknown
      if (!updated.zone) {
        unknownCities.add(o.city || "Unknown City");
      }
    }

    if (changed) {
      healedOutlets.push(updated);
    }
  });

  console.log(`Found ${healedOutlets.length} outlets that need updating / healing.`);

  if (healedOutlets.length > 0) {
    const CHUNK_SIZE = 500;
    for (let i = 0; i < healedOutlets.length; i += CHUNK_SIZE) {
      const chunk = healedOutlets.slice(i, i + CHUNK_SIZE);
      const { error } = await supabase
        .from('outlet_master')
        .upsert(chunk, { onConflict: 'restaurant_id,area' });
      if (error) {
        console.error(`Error healing batch ${i}:`, error.message);
      } else {
        console.log(`Updated/Healed outlets batch ${i + 1} to ${i + chunk.length}`);
      }
    }
    console.log("✅ Successfully healed all outlets!");
  }

  // 4. Verification and final checks
  console.log("\nFetching final DB status...");
  let finalOutlets = [];
  page = 0;
  while (true) {
    const { data, error } = await supabase
      .from('outlet_master')
      .select('*')
      .order('id', { ascending: true })
      .range(page * pageSize, (page + 1) * pageSize - 1);
    if (error) break;
    if (!data || data.length === 0) break;
    finalOutlets = finalOutlets.concat(data);
    if (data.length < pageSize) break;
    page++;
  }

  const nullBrands = finalOutlets.filter(o => o.brand_name === null).length;
  const nullCities = finalOutlets.filter(o => o.city === null).length;
  const nullZones = finalOutlets.filter(o => o.zone === null).length;
  
  console.log("\n--- REMAINING NULLS AFTER FULL HEALING ---");
  console.log(`Total Outlets: ${finalOutlets.length}`);
  console.log(`brand_name is NULL: ${nullBrands}`);
  console.log(`city is NULL: ${nullCities}`);
  console.log(`zone is NULL: ${nullZones}`);

  if (unknownCities.size > 0) {
    console.log("\n⚠️ Cities with unknown zones:");
    console.log(Array.from(unknownCities));
  }

  // Clean up
  try {
    fs.unlinkSync(tempPath);
  } catch (err) {}
}

run().catch(console.error);
