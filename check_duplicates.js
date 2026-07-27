import xlsx from 'xlsx';
import fs from 'fs';

const COLUMN_MAPPING = {
  'date': 'date',
  'restaurant_id': 'restaurant_id',
  'brand_name': 'brand_name',
  'business_entity': 'business_entity',
  'city': 'city',
  'area': 'area',
  'toing': 'toing',
  'order_id': 'order_id',
  'ordered_time': 'ordered_time',
  'gmv_total': 'gmv_total',
  'item_name': 'item_name',
  'comments': 'comments',
  'restaurant_rating': 'restaurant_rating',
  'post_status': 'post_status'
};

const filePath = '/Users/ajelhenry/Downloads/Daily-MTD - May-31-2026 - Funnel,IGCC,RDC,Serviceability & RHI -  Report .xlsx';

if (!fs.existsSync(filePath)) {
  console.error(`File not found at path: ${filePath}`);
  process.exit(1);
}

const workbook = xlsx.readFile(filePath, { cellDates: true });
const duplicateMap = new Map();

console.log(`Scanning file for duplicates...`);

workbook.SheetNames.forEach(sheetName => {
  const normalizedSheetName = sheetName.trim().toLowerCase();
  
  // Process only the tab specifically named "Rating & Feedback"
  if (normalizedSheetName.includes('rating & feedback')) {
    const sheet = workbook.Sheets[sheetName];
    const rawRows = xlsx.utils.sheet_to_json(sheet, { defval: null });
    
    rawRows.forEach((row, index) => {
      // Skip completely blank/summary rows that have no order ID
      if (!row['Order ID'] && !row['order_id']) return;

      const safeOrderId = String(row['Order ID'] || row['order_id'] || '').replace(/\.0$/, '').trim();
      const safeRestId = String(row['Restaurant ID'] || row['restaurant_id'] || 'null').replace(/\.0$/, '').trim();
      const safeItemName = String(row['Item Name'] || row['item_name'] || '').replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
      
      const dedupeKey = `Order: ${safeOrderId} | Rest: ${safeRestId} | Item: ${safeItemName}`;
      
      if (!duplicateMap.has(dedupeKey)) duplicateMap.set(dedupeKey, { count: 0, rows: [] });
      
      duplicateMap.get(dedupeKey).count++;
      duplicateMap.get(dedupeKey).rows.push(index + 2); // +2 correctly aligns with the Excel row number (1-based index + header)
    });
  }
});

let duplicateCount = 0;
console.log("\n--- DUPLICATE REPORT ---");
duplicateMap.forEach((data, key) => {
  if (data.count > 1) {
    duplicateCount++;
    console.log(`\nDuplicate Found: [${key}]`);
    console.log(`  -> Occurrences: ${data.count}`);
    console.log(`  -> Excel Row Numbers: ${data.rows.join(', ')}`);
  }
});

if (duplicateCount === 0) {
  console.log("\nNo duplicates found! Every order_id + restaurant_id + item_name is unique.");
} else {
  console.log(`\nTotal unique combinations with duplicates: ${duplicateCount}`);
}