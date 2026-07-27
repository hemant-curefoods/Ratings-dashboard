require('dotenv').config();
const path = require('path');
const fs = require('fs');
const { parseExcel } = require('./parseExcel');
const { insertRows } = require('./supabaseClient');

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
  const downloadsDir = path.join(__dirname, 'downloads');
  
  if (!fs.existsSync(downloadsDir)) {
    console.log("Creating downloads directory. Please place your 5 Excel sheets inside it and run again.");
    fs.mkdirSync(downloadsDir);
    return;
  }
  
  const files = fs.readdirSync(downloadsDir).filter(f => f.endsWith('.xlsx') && !f.startsWith('~'));
  
  if (files.length === 0) {
    console.log("No .xlsx files found in the 'downloads' folder. Please place them there and try again.");
    return;
  }

  for (const file of files) {
    console.log(`\n--- Processing Local File: ${file} ---`);
    const filePath = path.join(downloadsDir, file);
    const rows = parseExcel(filePath);
    
    console.log(`Found ${rows.length} total rows in sheet. Pushing all of them for the initial load.`);
    await insertRows(rows);
  }
  
  console.log("\nAll local files have been processed!");
}

test();