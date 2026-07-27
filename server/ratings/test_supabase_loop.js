import { supabase } from './supabaseClient.js';
async function run() {
  console.time("loop");
  let allData = [];
  let page = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('outlet_master')
      .select('brand_name, city, zone, area')
      .range(page * pageSize, (page + 1) * pageSize - 1)
      .order('brand_name'); // Stabilize sort
    if (error) throw error;
    if (!data || data.length === 0) break;
    allData = allData.concat(data);
    if (data.length < pageSize) break;
    page++;
  }
  console.timeEnd("loop");
  console.log("Total rows:", allData.length);
}
run();
