import { supabase } from './server/ratings/supabaseClient.js';

async function run() {
  let allData = [];
  let page = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('outlet_master')
      .select('brand_name, city, zone, area')
      .range(page * pageSize, (page + 1) * pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    allData = allData.concat(data);
    if (data.length < pageSize) break;
    page++;
  }
  console.log("Total rows in outlet_master:", allData.length);
  
  const cakezoneBlr = allData.filter(r => r.brand_name && r.brand_name.toLowerCase().includes('cake') && r.city && r.city.toLowerCase().includes('bangalore'));
  console.log("Cakezone Bangalore count:", cakezoneBlr.length);
  
  const zones = new Set(cakezoneBlr.map(r => r.zone ? r.zone.trim() : 'NULL'));
  console.log("Cakezone Bangalore Zones:", Array.from(zones));
}
run();
