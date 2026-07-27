import xlsx from 'xlsx';
import { pool } from './server/ratings/db.js';
import fs from 'fs';

async function run() {
  try {
    const res = await pool.query('SELECT DISTINCT city, zone FROM outlet_master WHERE city IS NOT NULL AND zone IS NOT NULL');
    const cityToZone = {};
    const cityToStandard = {};
    for (const row of res.rows) {
      if (row.city && row.zone) {
        let city = row.city.trim().toLowerCase();
        cityToZone[city] = row.zone.trim();
        cityToStandard[city] = row.city.trim();
      }
    }
    
    // Add manual aliases for spelling differences
    cityToZone['bengaluru'] = cityToZone['bangalore'];
    cityToStandard['bengaluru'] = 'Bangalore';
    
    cityToZone['ahemadabad'] = cityToZone['ahmedabad'];
    cityToStandard['ahemadabad'] = 'Ahmedabad';
    
    cityToZone['delhi ncr'] = cityToZone['delhi'];
    cityToStandard['delhi ncr'] = 'Delhi';
    
    cityToZone['ghaziabad'] = 'North';
    cityToStandard['ghaziabad'] = 'Ghaziabad';
    
    cityToZone['cochin'] = cityToZone['kochi'];
    cityToStandard['cochin'] = 'Kochi';
    
    cityToZone['ernakulam'] = cityToZone['kochi'];
    cityToStandard['ernakulam'] = 'Kochi';
    
    cityToZone['mangalore'] = cityToZone['mangaluru'];
    cityToStandard['mangalore'] = 'Mangaluru';
    
    cityToZone['goa'] = cityToZone['central goa'];
    cityToStandard['goa'] = 'Central Goa';
    
    cityToZone['tiruppur'] = cityToZone['tirupur'];
    cityToStandard['tiruppur'] = 'Tirupur';
    
    cityToZone['patiala'] = 'North'; // Manual fallback
    cityToStandard['patiala'] = 'Patiala';
    
    const workbook = xlsx.readFile('/Users/ajelhenry/Downloads/CakeZone Toggle On Off.xlsx');
    const sheet = workbook.Sheets['Test Sheet'];
    const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 });
    
    const cakezoneStores = [];
    
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length < 4) continue;
      
      let city = (row[0] || '').toString().trim();
      let brand = (row[1] || '').toString().trim();
      let kitchen = (row[2] || '').toString().trim();
      const ref_id = (row[3] || '').toString().trim();
      const statusRaw = (row[4] || '').toString().trim().toLowerCase();
      
      if (!ref_id) continue;
      brand = 'Cake Zone'; // Force grouping all sheet brands under Cake Zone
      
      // Clean Kitchen Name (strip " - Online" or "- Online")
      kitchen = kitchen.replace(/\s*-\s*Online\s*$/i, '');
      kitchen = kitchen.replace(/\s*-\s*Offline\s*$/i, '');
      
      const zone = cityToZone[city.toLowerCase()] || 'Unknown';
      const normalizedCity = cityToStandard[city.toLowerCase()] || city;
      const status = statusRaw === 'on' ? 'online' : 'offline';
      
      cakezoneStores.push({
        id: `CZ_${i}`,
        name: kitchen,
        brand: brand,
        city: normalizedCity,
        zone: zone,
        location_id: ref_id,
        status: status
      });
    }
    
    fs.writeFileSync('src/features/toggle/cakezone_stores.json', JSON.stringify(cakezoneStores, null, 2));
    console.log("Written to src/features/toggle/cakezone_stores.json");
    
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}

run();
