import 'dotenv/config';
import { parseExcel } from './parseExcel.js';
import { insertRows } from './supabaseClient.js';
import { checkForNewReports } from './gmailWatcher.js';
import fs from 'fs';

async function run() {
  console.log("Starting full email fetch for all reports...");
  
  // Call with targetDateStr = null, forceAll = true
  const downloadedFiles = await checkForNewReports(null, true);
  
  if (downloadedFiles.length === 0) {
    console.log("No files downloaded. Perhaps there are no matching emails?");
    return;
  }
  
  console.log(`Downloaded ${downloadedFiles.length} files. Starting processing...`);
  
  for (const filePath of downloadedFiles) {
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
