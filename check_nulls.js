import { supabase } from './server/ratings/supabaseClient.js';

async function run() {
  console.log("Analyzing outlet_master for NULL values...");

  const { data: allOutlets, error } = await supabase
    .from('outlet_master')
    .select('*');

  if (error) {
    console.error("Error fetching outlets:", error.message);
    return;
  }

  const total = allOutlets.length;
  console.log(`Total outlets in database: ${total}`);

  const nullCounts = {
    restaurant_id: 0,
    brand_name: 0,
    business_entity: 0,
    city: 0,
    area: 0,
    zone: 0
  };

  allOutlets.forEach(o => {
    if (o.restaurant_id === null) nullCounts.restaurant_id++;
    if (o.brand_name === null) nullCounts.brand_name++;
    if (o.business_entity === null) nullCounts.business_entity++;
    if (o.city === null) nullCounts.city++;
    if (o.area === null) nullCounts.area++;
    if (o.zone === null) nullCounts.zone++;
  });

  console.log("\n--- NULL COUNT PER COLUMN ---");
  Object.entries(nullCounts).forEach(([col, count]) => {
    console.log(`${col}: ${count} nulls (${((count/total)*100).toFixed(1)}%)`);
  });

  const nullBrands = allOutlets.filter(o => o.brand_name === null);
  console.log(`\n--- EXAMPLES OF OUTLETS WITH NULL BRAND (Total: ${nullBrands.length}) ---`);
  nullBrands.slice(0, 15).forEach((o, index) => {
    console.log(`${index + 1}. Restaurant ID: ${o.restaurant_id} | Area: ${o.area} | Zone: ${o.zone}`);
  });

  const nullZones = allOutlets.filter(o => o.zone === null);
  console.log(`\n--- EXAMPLES OF OUTLETS WITH NULL ZONE (Total: ${nullZones.length}) ---`);
  
  nullZones.slice(0, 15).forEach((o, index) => {
    console.log(`${index + 1}. Restaurant ID: ${o.restaurant_id} | Brand: ${o.brand_name} | City: ${o.city} | Area: ${o.area}`);
  });
}

run();
