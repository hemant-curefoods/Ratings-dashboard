import fs from 'fs';

async function run() {
  const username = 'biz_adm_QXJeFIgABXFq';
  const apikey = 'a7d35eac21f5e6eab9d760d25d71a899c3ba2178';
  const bizId = '60578050';

  console.log("Fetching Master Location List from UrbanPiper...");
  
  const response = await fetch(`https://api.urbanpiper.com/external/api/v1/inventory/locations/?biz_id=${bizId}`, {
    method: "GET",
    headers: {
      "Authorization": `apikey ${username}:${apikey}`,
      "Content-Type": "application/json"
    }
  });

  if (!response.ok) {
    console.error("Failed to fetch from UP:", response.status, await response.text());
    return;
  }

  const result = await response.json();
  const upLocations = result.locations || result; 
  
  if (!Array.isArray(upLocations)) {
    console.log("Unexpected UP response format:", upLocations);
    return;
  }

  // Build a set of all valid ref IDs in UP
  const validUpIds = new Set();
  const upMap = {};
  upLocations.forEach(loc => {
    const id = loc.ref_id ? loc.ref_id.toString() : loc.id.toString();
    validUpIds.add(id);
    upMap[id] = loc.name || loc.city;
  });

  console.log(`Successfully fetched ${validUpIds.size} total locations from UrbanPiper Eatfit Account.`);

  // Load our generated eatfit_stores.json
  const eatfitStores = JSON.parse(fs.readFileSync('src/features/toggle/eatfit_stores.json', 'utf8'));
  console.log(`We have ${eatfitStores.length} stores in our UI.`);

  let matched = 0;
  let missing = [];

  eatfitStores.forEach(store => {
    if (validUpIds.has(store.location_id)) {
      matched++;
    } else {
      missing.push({ kitchen: store.name, ref_id: store.location_id });
    }
  });

  console.log(`\n--- VERIFICATION RESULTS ---`);
  console.log(`Total matched exactly in UP: ${matched} / ${eatfitStores.length}`);
  
  if (missing.length > 0) {
    console.log(`\nWARNING: The following ${missing.length} Ref IDs from the Apps Script DO NOT EXIST in UrbanPiper!`);
    console.log(missing.slice(0, 15), missing.length > 15 ? `...and ${missing.length - 15} more` : "");
  } else {
    console.log("\n✅ ALL 717 Ref IDs from the Apps Script perfectly match real locations in UrbanPiper!");
  }
}

run();
