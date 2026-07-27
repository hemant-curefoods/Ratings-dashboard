import xlsx from 'xlsx';

const COLUMN_MAPPING = {
  'date': 'date',
  'restaurant_id': 'restaurant_id',
  'brand_name': 'brand_name',
  'business_entity': 'business_entity',
  'city': 'city',
  'area': 'area',
  'zone': 'zone',
  'toing': 'toing',
  'order_id': 'order_id',
  'ordered_time': 'ordered_time',
  'gmv_total': 'gmv_total',
  'item_name': 'item_name',
  'comments': 'comments',
  'restaurant_rating': 'restaurant_rating',
  'post_status': 'post_status'
};

function normalizeDateString(d) {
  if (!d) return 'nodate';
  if (d instanceof Date) return d.toISOString().split('T')[0];
  if (typeof d === 'string') {
    let cleanDate = d.split('T')[0].trim();
    const parts = cleanDate.split(/[-/]/);
    if (parts.length === 3 && parts[0].length === 2 && parts[2].length === 4) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    if (cleanDate.match(/^\d{4}-\d{2}-\d{2}/)) return cleanDate.substring(0, 10);
    const parsed = new Date(cleanDate);
    if (!isNaN(parsed)) {
      const year = parsed.getFullYear();
      const month = String(parsed.getMonth() + 1).padStart(2, '0');
      const day = String(parsed.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    return cleanDate;
  }
  return String(d);
}

function parseExcel(filePath) {
  const workbook = xlsx.readFile(filePath, { cellDates: true });
  const uniqueRowsMap = new Map();

  workbook.SheetNames.forEach(sheetName => {
    const normalizedSheetName = sheetName.trim().toLowerCase();
    
    // Process only the tab specifically named "Rating & Feedback"
    if (normalizedSheetName.includes('rating & feedback')) {
      const sheet = workbook.Sheets[sheetName];
      const rawRows = xlsx.utils.sheet_to_json(sheet, { defval: null });
      
      rawRows.forEach(row => {
        const cleanedRow = {};
        
        // Pre-fill all mapped columns with null so missing ones are explicitly defined
        const allDbColumns = [...new Set(Object.values(COLUMN_MAPPING))];
        allDbColumns.forEach(col => {
          cleanedRow[col] = null;
        });

        for (let [key, val] of Object.entries(row)) {
          const normalizedKey = key.trim().toLowerCase();
          const mappedKey = COLUMN_MAPPING[normalizedKey];
          
          if (mappedKey) {
            if (typeof val === 'string') val = val.replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim();
            if (val === "" || val === "None" || val === "none") val = null;
            cleanedRow[mappedKey] = val;
          }
        }
        
        // Skip completely blank/summary rows that have no order ID
        if (!cleanedRow.order_id) return;

        // Deduplicate using order_id, restaurant_id, and item_name as the business key
        const safeOrderId = String(cleanedRow.order_id).replace(/\.0$/, '').trim();
        const safeRestId = cleanedRow.restaurant_id == null ? 'null' : String(cleanedRow.restaurant_id).replace(/\.0$/, '').trim();
        const safeItemName = cleanedRow.item_name == null ? '' : String(cleanedRow.item_name).replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
        const dedupeKey = `${safeOrderId}_${safeRestId}_${safeItemName}`;
        uniqueRowsMap.set(dedupeKey, cleanedRow);
      });
    }
  });

  return Array.from(uniqueRowsMap.values());
}

export { parseExcel };