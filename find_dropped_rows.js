import xlsx from 'xlsx';
import fs from 'fs';

// Update this path to the file you want to check
const filePath = '/Users/ajelhenry/Downloads/Daily-MTD - May-31-2026 - Funnel,IGCC,RDC,Serviceability & RHI -  Report  (1).xlsx';

if (!fs.existsSync(filePath)) {
  console.error(`File not found at path: ${filePath}`);
  process.exit(1);
}

const workbook = xlsx.readFile(filePath, { cellDates: true });
const droppedRows = [];
const seenKeys = new Set();

workbook.SheetNames.forEach(sheetName => {
  const normalizedSheetName = sheetName.trim().toLowerCase();
  if (normalizedSheetName.includes('rating & feedback')) {
    const sheet = workbook.Sheets[sheetName];
    const rawRows = xlsx.utils.sheet_to_json(sheet, { defval: null });
    
    rawRows.forEach((row, index) => {
      const rowNum = index + 2; // +1 because array is 0-indexed, +1 because of Excel headers
      const orderId = row['Order ID'] || row['order_id'];
      
      // Reason 1: No Order ID
      if (!orderId || String(orderId).trim() === '' || String(orderId).trim() === 'null') {
        droppedRows.push({ row_number: rowNum, reason: 'Missing Order ID', data: row });
        return;
      }

      // Reason 2: Duplicate Business Key
      const safeOrderId = String(orderId).replace(/\.0$/, '').trim();
      const safeRestId = String(row['Restaurant ID'] || row['restaurant_id'] || 'null').replace(/\.0$/, '').trim();
      const safeItemName = String(row['Item Name'] || row['item_name'] || '').replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
      const dedupeKey = `${safeOrderId}_${safeRestId}_${safeItemName}`;
      
      if (seenKeys.has(dedupeKey)) droppedRows.push({ row_number: rowNum, reason: 'Duplicate (Same Order ID + Rest ID + Item Name)', data: row });
      else seenKeys.add(dedupeKey);
    });
  }
});

fs.writeFileSync('dropped_rows_report.json', JSON.stringify(droppedRows, null, 2));
console.log(`\nScan complete! Found ${droppedRows.length} dropped rows.`);
console.log(`Open 'dropped_rows_report.json' in your code editor to see the full list of missing rows.`);