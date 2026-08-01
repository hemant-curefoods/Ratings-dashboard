import 'dotenv/config';
import fs from 'fs';
import { pool } from './server/ratings/db.js';

const CITY_TO_ZONE_MAP = {
  // South
  'bangalore': 'South', 'bengaluru': 'South', 'hyderabad': 'South', 'chennai': 'South', 
  'trichy': 'South', 'nellore': 'South', 'mysore': 'South', 'mysuru': 'South', 
  'vizag': 'South', 'visakhapatnam': 'South', 'kochi': 'South', 'coimbatore': 'South', 
  'dharwad': 'South', 'kurnool': 'South', 'madurai': 'South', 'vijayawada': 'South', 
  'mangalore': 'South', 'mangaluru': 'South', 'pondicherry': 'South', 'manipal': 'South', 
  'tumakuru': 'South', 'tumkur': 'South', 'kozhikode': 'South', 'warangal': 'South', 
  'rajahmundry': 'South', 'thiruvananthapuram': 'South', 'trivandrum': 'South', 
  'goa': 'South', 'central goa': 'South', 'erode': 'South', 'guntur': 'South', 
  'kakinada': 'South', 'thrissur': 'South', 'anantapur': 'South', 'salem': 'South', 
  'tirupati': 'South', 'hosur': 'South', 'palakkad': 'South', 'tirupur': 'South',

  // North
  'delhi': 'North', 'new delhi': 'North', 'karnal': 'North', 'gurgaon': 'North', 
  'gurugram': 'North', 'gwalior': 'North', 'chandigarh': 'North', 'faridabad': 'North', 
  'noida 1': 'North', 'noida': 'North', 'indore': 'North', 'jaipur': 'North', 
  'bhopal': 'North', 'dehradun': 'North', 'lucknow': 'North', 'ludhiana': 'North', 
  'amritsar': 'North', 'ujjain': 'North',

  // West
  'mumbai': 'West', 'bombay': 'West', 'pune': 'West', 'ahmedabad': 'West', 
  'nagpur': 'West', 'aurangabad': 'West', 'nashik': 'West', 'nasik': 'West', 
  'surat': 'West', 'jamshedpur': 'West', 'vadodara': 'West', 'baroda': 'West',

  // East
  'guwahati': 'East', 'bhubaneswar': 'East', 'ranchi': 'East', 'kolkata': 'East', 
  'calcutta': 'East', 'cuttack': 'East', 'raipur': 'East', 'patna': 'East', 
  'siliguri': 'East'
};

const ALLOWED_BRANDS = [
  "99 Slice by Olio Pizza",
  "Crusto's Pizza",
  "Olio - The Wood Fired Pizzeria",
  "PHAT - Chicken & Burgers",
  "POMP - Pizza On My Plate",
  "Juno's Pizza The Thin Crust Pizzeria",
  "Ovenfresh Cakes and Desserts",
  "Ovenfresh Pizzas",
  "The Dessert Heaven",
  "The Dessert Heaven Pure Veg",
  "EatFit",
  "EatFit All Things Healthy",
  "EatFit Desi Meals Burgers More",
  "Home Plate X Ghar ka Khana",
  "Great Indian Khichdi by EatFit",
  "HRX by Eatfit",
  "HRX Rolls and Wraps",
  "Rolls On Wheels - Shawarma & Wraps",
  "Madras Curd Rice Company",
  "Sharief Bhai Biryani",
  "Roz Shawarma by Sharief Bhai",
  "Krispy Kreme"
];

function getNormalizedBrand(brand) {
  if (!brand) return "";
  return brand.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function getCanonicalBrandName(brandName) {
  if (!brandName) return null;
  const norm = brandName.toLowerCase().replace(/[^a-z0-9]/g, "");

  // Rule 1: Juno's Pizza
  if (norm.includes("junospizza") || norm.includes("junospizzathethincrustpizzeria")) {
    return "Juno's Pizza The Thin Crust Pizzeria";
  }

  // Rule 2: Crusto's Pizza
  if (norm.includes("crustoscheeseburstpizza") || norm.includes("crustospizza")) {
    return "Crusto's Pizza";
  }

  // Rule 3: HRX Rolls and Wraps
  if (norm.includes("rollswrapsbyhrx") || norm.includes("hrxrollsandwraps")) {
    return "HRX Rolls and Wraps";
  }

  // Rule 4: Ovenfresh Pizzas
  if (norm.includes("ovenfreshpizzas")) {
    return "Ovenfresh Pizzas";
  }

  // Rule 5: Home Plate X Ghar ka Khana
  if (norm.includes("homeplatebyeatfit") || norm.includes("gharkakhanabyeatfit") || norm.includes("homeplatexgharkakhana")) {
    return "Home Plate X Ghar ka Khana";
  }

  // Otherwise, return a matched name from ALLOWED_BRANDS to ensure exact casing
  const matched = ALLOWED_BRANDS.find(b => getNormalizedBrand(b) === norm);
  return matched || brandName.replace(/_/g, " ").replace(/\s+/g, " ").trim();
}

const ALLOWED_BRANDS_NORMALIZED = new Set(ALLOWED_BRANDS.map(b => getNormalizedBrand(b)));

function normalizeDate(d) {
  if (!d) return null;
  if (d instanceof Date) {
    return d.toISOString().split('T')[0]; // xlsx outputs UTC dates, this is safe
  }
  if (typeof d === 'string') {
    let cleanDate = d.split('T')[0].trim();
    
    // Catch DD-MM-YYYY or DD/MM/YYYY and flip to YYYY-MM-DD
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
  return String(d).trim();
}

function generateDedupeKey(orderId, restId, itemName) {
  const safeOrderId = orderId == null ? 'null' : String(orderId).replace(/\.0$/, '').trim();
  const safeRestId = restId == null ? 'null' : String(restId).replace(/\.0$/, '').trim();
  const safeItem = itemName == null ? '' : String(itemName).replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
  return `${safeOrderId}_${safeRestId}_${safeItem}`;
}

async function insertRows(rows) {
  if (!rows || rows.length === 0) {
    return console.log("No valid rows found to insert.");
  }

  console.log(`Checking ${rows.length} rows against PostgreSQL for exact duplicates...`);

  // 1. Format rows and drop empty/garbage Excel rows instantly
  const formattedRows = rows
    .map(row => {
      const orderId = row.order_id != null ? String(row.order_id).replace(/\.0$/, '').trim() : null;
      return {
        ...row,
        order_id: orderId,
        brand_name: getCanonicalBrandName(row.brand_name),
        date: normalizeDate(row.date),
        ordered_time: row.ordered_time instanceof Date ? row.ordered_time.toISOString() : row.ordered_time
      };
    })
    .filter(row => {
      const isValidOrder = row.order_id && row.order_id !== 'null' && row.order_id !== '';
      if (!isValidOrder) return false;
      
      const normRowBrand = getNormalizedBrand(row.brand_name);
      return ALLOWED_BRANDS_NORMALIZED.has(normRowBrand);
    });

  // Validate and extract unique outlets into outlet_master
  const uniqueOutletsMap = new Map();
  let dataInconsistent = false;

  formattedRows.forEach(row => {
    if (!row.restaurant_id || !row.area) return; // Need both for the unique key
    
    const restId = String(row.restaurant_id).trim();
    const area = String(row.area).trim();
    const dedupeKey = `${restId}_${area}`;
    const cleanCity = row.city ? String(row.city).trim().toLowerCase() : '';

    const currentOutlet = {
      restaurant_id: restId,
      brand_name: row.brand_name,
      business_entity: row.business_entity,
      city: row.city,
      area: area
    };
    
    // Assign zone if explicitly provided in email row
    if (row.zone != null && String(row.zone).trim() !== '') {
      currentOutlet.zone = String(row.zone).trim();
    } else {
      // Auto-assign zone based on city map
      const mappedZone = CITY_TO_ZONE_MAP[cleanCity];
      if (mappedZone) {
        currentOutlet.zone = mappedZone;
      } else {
        // DETECTOR WARNING: If city is unknown, print an explicit log alert
        console.warn(`\n⚠️ [ALERT] UNKNOWN CITY ZONE: A new restaurant ID ${restId} in city '${row.city}' (Area: '${area}') was found, but its zone is unknown. Please add '${cleanCity}' to CITY_TO_ZONE_MAP in supabaseClient.js.\n`);
        currentOutlet.zone = null;

        // Log this warning to a warnings.json file in the root
        try {
          const warningPath = './warnings.json';
          let warnings = [];
          if (fs.existsSync(warningPath)) {
            try {
              warnings = JSON.parse(fs.readFileSync(warningPath, 'utf8'));
            } catch (e) {}
          }
          if (!warnings.some(w => w.restaurant_id === restId && w.area === area)) {
            warnings.push({
              restaurant_id: restId,
              brand_name: row.brand_name || null,
              city: row.city || null,
              area: area,
              detected_at: new Date().toISOString(),
              issue: "Unknown city zone. Please update CITY_TO_ZONE_MAP."
            });
            fs.writeFileSync(warningPath, JSON.stringify(warnings, null, 2));
          }
        } catch (err) {
          console.error("Failed to write to warnings.json:", err.message);
        }
      }
    }
    
    if (uniqueOutletsMap.has(dedupeKey)) {
      const existing = uniqueOutletsMap.get(dedupeKey);
      if (existing.brand_name !== currentOutlet.brand_name || existing.business_entity !== currentOutlet.business_entity || existing.city !== currentOutlet.city || existing.zone !== currentOutlet.zone) {
        console.warn(`[WARNING] Inconsistent data found in Excel for restaurant_id+area: ${dedupeKey}`);
        dataInconsistent = true;
      }
    } else {
      uniqueOutletsMap.set(dedupeKey, currentOutlet);
    }
  });

  const outletsToUpsert = Array.from(uniqueOutletsMap.values());

  if (outletsToUpsert.length > 0) {
    console.log(`Upserting ${outletsToUpsert.length} unique outlets to outlet_master in Postgres...`);
    for (const o of outletsToUpsert) {
      await pool.query(`
        INSERT INTO outlet_master (restaurant_id, brand_name, business_entity, city, area, zone)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (restaurant_id, area) 
        DO UPDATE SET 
          brand_name = EXCLUDED.brand_name,
          business_entity = EXCLUDED.business_entity,
          city = EXCLUDED.city,
          zone = EXCLUDED.zone
      `, [o.restaurant_id, o.brand_name, o.business_entity, o.city, o.area, o.zone]);
    }
  }

  // Find unique Order IDs in this sheet
  const uniqueOrderIds = [...new Set(formattedRows.map(r => r.order_id))];
  console.log(`Querying PostgreSQL for existing records...`);

  // Fetch existing records by Order ID in chunks
  let existingData = [];
  const FETCH_CHUNK_SIZE = 100;
  
  for (let i = 0; i < uniqueOrderIds.length; i += FETCH_CHUNK_SIZE) {
    const chunkIds = uniqueOrderIds.slice(i, i + FETCH_CHUNK_SIZE);
    try {
      const res = await pool.query(
        `SELECT id, date, order_id, restaurant_id, item_name, comments, restaurant_rating, post_status 
         FROM order_reviews 
         WHERE order_id = ANY($1)`,
        [chunkIds]
      );
      existingData = existingData.concat(res.rows || []);
    } catch (err) {
      console.error("Error fetching existing data from Postgres:", err.message);
    }
  }

  // Create a fast-lookup Map of existing records
  const existingMap = new Map();
  existingData.forEach(record => {
    existingMap.set(generateDedupeKey(record.order_id, record.restaurant_id, record.item_name), record);
  });

  const newRowsToInsert = [];
  const rowsToUpdate = [];
  const processedKeys = new Set();

  // Separate rows into "Completely New", "Needs Update", and "Unchanged Duplicates"
  formattedRows.forEach(row => {
    const key = generateDedupeKey(row.order_id, row.restaurant_id, row.item_name);
    
    if (processedKeys.has(key)) return;
    processedKeys.add(key);

    const existingDbRow = existingMap.get(key);

    const reviewPayload = {
      order_id: row.order_id,
      restaurant_id: row.restaurant_id,
      area: row.area,
      item_name: row.item_name,
      date: row.date,
      ordered_time: row.ordered_time,
      gmv_total: row.gmv_total,
      comments: row.comments,
      restaurant_rating: row.restaurant_rating,
      post_status: row.post_status,
      updated_at: new Date().toISOString()
    };

    if (!existingDbRow) {
      newRowsToInsert.push(reviewPayload);
    } else {
      const hasNewComments = row.comments != null && row.comments !== existingDbRow.comments;
      const hasNewRating = row.restaurant_rating != null && row.restaurant_rating !== existingDbRow.restaurant_rating;
      const hasNewStatus = row.post_status != null && row.post_status !== existingDbRow.post_status;

      if (hasNewComments || hasNewRating || hasNewStatus) {
        rowsToUpdate.push({ ...reviewPayload, id: existingDbRow.id });
      }
    }
  });
  
  const skipped = formattedRows.length - newRowsToInsert.length - rowsToUpdate.length;
  console.log(`Skipped ${skipped} completely unchanged duplicate rows.`);

  if (newRowsToInsert.length === 0 && rowsToUpdate.length === 0) {
    return console.log("No new inserts or delayed feedback updates needed.");
  }

  // Insert genuinely new orders
  if (newRowsToInsert.length > 0) {
    console.log(`Attempting to insert ${newRowsToInsert.length} brand new rows into Postgres...`);
    for (const r of newRowsToInsert) {
      try {
        await pool.query(`
          INSERT INTO order_reviews (
            order_id, restaurant_id, area, item_name, date, 
            ordered_time, gmv_total, comments, restaurant_rating, 
            post_status, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          ON CONFLICT (order_id, restaurant_id, item_name) 
          DO NOTHING
        `, [
          r.order_id, r.restaurant_id, r.area, r.item_name, r.date,
          r.ordered_time, r.gmv_total, r.comments, r.restaurant_rating,
          r.post_status, r.updated_at
        ]);
      } catch (err) {
        console.error(`Postgres insert error for order ${r.order_id}:`, err.message);
      }
    }
    console.log("Successfully inserted new rows!");
  }

  // Update older orders that received delayed feedback
  if (rowsToUpdate.length > 0) {
    console.log(`Attempting to update ${rowsToUpdate.length} existing rows with new delayed feedback...`);
    for (const r of rowsToUpdate) {
      try {
        await pool.query(`
          UPDATE order_reviews 
          SET 
            comments = $1, 
            restaurant_rating = $2, 
            post_status = $3, 
            updated_at = $4
          WHERE id = $5
        `, [
          r.comments, r.restaurant_rating, r.post_status, r.updated_at, r.id
        ]);
      } catch (err) {
        console.error(`Postgres update error for ID ${r.id}:`, err.message);
      }
    }
    console.log("Successfully updated existing rows with fresh feedback!");
  }
}

export { insertRows };