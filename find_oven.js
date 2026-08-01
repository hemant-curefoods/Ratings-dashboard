import { supabase } from './server/ratings/supabaseClient.js';

async function run() {
  console.log("Searching outlet_master for unique brand names...");
  const { data: outlets, error: err1 } = await supabase
    .from('outlet_master')
    .select('brand_name');
  
  if (err1) {
    console.error("Error:", err1.message);
    return;
  }
  
  const uniqueBrands = [...new Set(outlets.map(o => o.brand_name))];
  console.log("All Unique Brand Names in DB:");
  uniqueBrands.forEach(b => console.log(`- ${b}`));

  console.log("\nSearching for 'made_in_oven' explicitly...");
  const match = uniqueBrands.filter(b => b && b.toLowerCase().includes('made'));
  console.log("Brands matching 'made':", match);
}

run();
