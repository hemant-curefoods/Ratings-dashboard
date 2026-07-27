import { supabase } from './supabaseClient.js';
async function run() {
  const { data, error } = await supabase.from('order_reviews').select('*').limit(1);
  if (error) console.error(error);
  else if (data && data.length > 0) console.log(Object.keys(data[0]));
  else console.log("No data");
}
run();
