import 'dotenv/config';
import path from 'path';
import fs from 'fs';
import { parseExcel } from './parseExcel.js';
import { insertRows } from './supabaseClient.js';

// START_DATE logic temporarily disabled for the initial historical data load.
// In the future, you can uncomment this to limit how far back the script looks.
// const START_DATE = '2024-06-01'; 

function normalizeDate(d) {
  if (!d) return null;
  if (d instanceof Date) return d.toISOString().split('T')[0];
  if (typeof d === 'string') return d.split('T')[0];
  return d;
}

async function test() {
  const filePath = '/Users/ajelhenry/Downloads/Daily-MTD - May-31-2026 - Funnel,IGCC,RDC,Serviceability & RHI -  Report  (1).xlsx';

  if (!fs.existsSync(filePath)) {
    console.error(`File not found at path: ${filePath}`);
    return;
  }

  console.log(`\n--- Processing Specific Local File: ${filePath} ---`);
  const rows = parseExcel(filePath);
  
  console.log(`Found ${rows.length} total rows in sheet. Pushing all of them for the initial load.`);
  await insertRows(rows);
  
  console.log("\nFile has been successfully processed and pushed to Supabase!");
}

test();