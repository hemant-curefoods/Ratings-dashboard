import { supabase } from './supabaseClient.js';
async function run() {
  console.time("fetch10000");
  const { data, error } = await supabase.from('outlet_master').select('brand_name, city, zone, area').limit(10000);
  console.timeEnd("fetch10000");
  console.log("Returned rows:", data ? data.length : 0);
  if (error) console.error(error);
}
run();
