import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseExcel } from './parseExcel.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DOWNLOAD_DIR = path.join(__dirname, 'downloads');

function run() {
  console.log("Reading downloaded files to search for 'Made in Oven' brand name...");
  const files = fs.readdirSync(DOWNLOAD_DIR).filter(f => f.endsWith('.xlsx'));
  
  let found = false;
  for (const file of files) {
    const filePath = path.join(DOWNLOAD_DIR, file);
    try {
      const rows = parseExcel(filePath);
      const matchedRow = rows.find(r => r.brand_name && r.brand_name.toLowerCase().includes('made') && r.brand_name.toLowerCase().includes('oven'));
      if (matchedRow) {
        console.log(`\n>>> FOUND MATCH IN FILE: ${file}`);
        console.log(`Row details:`, matchedRow);
        found = true;
      }
    } catch (err) {
      // Some files might fail to parse, just skip them
      // console.error(`Error parsing ${file}:`, err.message);
    }
  }

  if (!found) {
    console.log("No file in downloads/ contained 'Made in Oven'. Checking raw sheet contents in case it was mapped differently...");
    // Let's do a broader check if any file has 'Made' or 'Oven' in brand_name
    for (const file of files) {
      const filePath = path.join(DOWNLOAD_DIR, file);
      try {
        const rows = parseExcel(filePath);
        const match = rows.find(r => r.brand_name && r.brand_name.toLowerCase().includes('made'));
        if (match) {
          console.log(`\nFound 'made' in file: ${file}`);
          console.log(`Brand Name: ${match.brand_name}`);
        }
      } catch (err) {}
    }
  }
}

run();
