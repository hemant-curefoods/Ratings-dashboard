import { supabase } from './supabaseClient.js';
async function run() {
  const { data, error } = await supabase.rpc('get_schema');
  console.log(error || data);
}
run();
