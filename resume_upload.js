import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { parseExcel } from './parseExcel.js';
import { insertRows } from './supabaseClient.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
  const downloadsDir = path.join(__dirname, 'downloads');
  const files = fs.readdirSync(downloadsDir).filter(f => f.endsWith('.xlsx'));
  
  if (files.length === 0) {
    console.log("No files found in downloads directory.");
    return;
  }
  
  console.log(`Found ${files.length} files in downloads directory. Resuming upload...`);
  
  for (const file of files) {
    const filePath = path.join(downloadsDir, file);
    console.log(`\n--- Processing File: ${filePath} ---`);
    try {
      const rows = parseExcel(filePath);
      console.log(`Parsed ${rows.length} valid rows from file. Uploading to DB...`);
      await insertRows(rows);
      console.log(`Successfully processed and uploaded data from ${filePath}.`);
    } catch (error) {
      console.error(`Error processing file ${filePath}:`, error);
    }
  }
  
  console.log("\nFinished processing all emails and uploading data.");
}

run();
