import express from "express";
import { Groq } from "groq-sdk";
import "dotenv/config";
import path from "path";
import fs from "fs";
import { pool } from "./db.js";

const router = express.Router();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const TABLE = "order_reviews";

// Simple local cache to store outlet_master rows so we can join them without complex SQL foreign keys
let outletCache = null;
let lastFetchTime = 0;
const CACHE_TTL = 30000; // 30 seconds cache TTL to avoid stale data issues

async function getOutletMap() {
  const now = Date.now();
  if (outletCache && (now - lastFetchTime < CACHE_TTL)) {
    return outletCache;
  }

  try {
    const res = await pool.query('SELECT * FROM outlet_master ORDER BY restaurant_id');
    const allData = res.rows;
    
    const map = new Map();
    for (const r of allData) {
      map.set(r.restaurant_id, r);
    }
    outletCache = map;
    lastFetchTime = now;
    return outletCache;
  } catch (err) {
    console.error("Failed to query outlet_master:", err.message);
    throw err;
  }
}

function splitDateRange(startDateStr, endDateStr, numChunks) {
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  const totalDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
  const chunkDays = Math.max(1, Math.ceil(totalDays / numChunks));
  
  const chunks = [];
  let currentStart = new Date(start);
  
  while (currentStart <= end) {
    let currentEnd = new Date(currentStart);
    currentEnd.setDate(currentEnd.getDate() + chunkDays - 1);
    if (currentEnd > end) currentEnd = new Date(end);
    
    chunks.push({
      start: currentStart.toISOString().split('T')[0],
      end: currentEnd.toISOString().split('T')[0]
    });
    
    currentStart = new Date(currentEnd);
    currentStart.setDate(currentStart.getDate() + 1);
  }
  return chunks;
}

function getParentBrand(brandName) {
  if (!brandName) return "Other";
  const norm = brandName.toLowerCase().replace(/[^a-z0-9]/g, "");

  const Groups = {
    "olio": [
      "99slicebyoliopizza",
      "crustospizza",
      "junospizzathethincrustpizzeria",
      "oliothewoodfiredpizzeria",
      "phatchickenburgers",
      "pomppizzaonmyplate"
    ],
    "Eatfit": [
      "eatfit",
      "eatfitallthingshealthy",
      "eatfitdesimealsburgersmore",
      "gharkakhanabyeatfit",
      "greatindiankhichdibyeatfit",
      "homeplatebyeatfit",
      "hrxbyeatfit",
      "hrxrollsandwraps",
      "rollsonwheelsshawarmawraps",
      "homeplatexgharkakhana"
    ],
    "cakezone": [
      "ovenfreshcakesanddesserts",
      "ovenfreshpizzas",
      "thedessertheaven",
      "thedessertheavenpureveg"
    ],
    "Sharief Bhai Biryani": [
      "rozshawarmabyshariefbhai",
      "shariefbhaibiryani"
    ],
    "Millet Express": [
      "madrascurdricecompany"
    ],
    "Krispy Kreme": [
      "krispykreme"
    ]
  };

  for (const [parent, children] of Object.entries(Groups)) {
    if (children.includes(norm)) {
      return parent;
    }
  }
  return brandName.replace(/_/g, " ").replace(/\s+/g, " ").trim();
}

// The `date` column can come back from Postgres as a JS Date object (for
// DATE/TIMESTAMP columns) or as a string. Extract the "YYYY-MM" month safely
// in both cases — calling .substring() directly on a Date throws.
function toMonth(d) {
  if (!d) return null;
  if (typeof d === "string") return d.substring(0, 7);
  if (d instanceof Date) return d.toISOString().substring(0, 7);
  return String(d).substring(0, 7);
}

async function fetchJoined(filters, limit = 200000, extraSQL = '') {
  const map = await getOutletMap();
  
  let valid = Array.from(map.values());
  let hasOutletFilter = false;

  // Filter valid outlets exactly matching user criteria
  if (filters.brand) { valid = valid.filter(r => r.brand_name && r.brand_name.toLowerCase() === filters.brand.toLowerCase()); hasOutletFilter = true; }
  if (filters.city) { valid = valid.filter(r => r.city && r.city.toLowerCase() === filters.city.toLowerCase()); hasOutletFilter = true; }
  if (filters.zone) { valid = valid.filter(r => r.zone && r.zone.toLowerCase() === filters.zone.toLowerCase()); hasOutletFilter = true; }
  if (filters.area) { valid = valid.filter(r => r.area && r.area.toLowerCase() === filters.area.toLowerCase()); hasOutletFilter = true; }

  if (filters.brands && filters.brands.length > 0) { valid = valid.filter(r => filters.brands.includes(r.brand_name)); hasOutletFilter = true; }
  if (filters.cities && filters.cities.length > 0) { valid = valid.filter(r => filters.cities.includes(r.city)); hasOutletFilter = true; }
  if (filters.zones && filters.zones.length > 0) { valid = valid.filter(r => filters.zones.includes(r.zone)); hasOutletFilter = true; }
  if (filters.areas && filters.areas.length > 0) { valid = valid.filter(r => filters.areas.includes(r.area)); hasOutletFilter = true; }

  const validIds = [...new Set(valid.map(r => r.restaurant_id).filter(Boolean))];

  // If a filter is applied but no outlets match, there are no reviews to return
  if (hasOutletFilter && validIds.length === 0) return [];

  const startDate = filters.dateFrom || filters.startDate;
  const endDate = filters.dateTo || filters.endDate;

  let queryText = 'SELECT * FROM order_reviews WHERE 1=1';
  const queryParams = [];

  if (startDate) {
    queryParams.push(startDate);
    queryText += ` AND date >= $${queryParams.length}`;
  }
  if (endDate) {
    queryParams.push(endDate);
    queryText += ` AND date <= $${queryParams.length}`;
  }
  if (hasOutletFilter) {
    queryParams.push(validIds);
    queryText += ` AND restaurant_id = ANY($${queryParams.length})`;
  }
  if (extraSQL) {
    queryText += ` ${extraSQL}`;
  }

  queryText += ' ORDER BY date DESC, id DESC';

  try {
    const dbRes = await pool.query(queryText, queryParams);
    let result = dbRes.rows;

    // Filter by time of day in memory since ordered_time is a full timestamp with timezone
    if (filters.timeFrom || filters.timeTo) {
      result = result.filter(row => {
        if (!row.ordered_time) return false;
        try {
          const dateObj = new Date(row.ordered_time);
          if (isNaN(dateObj.getTime())) return false;
          
          // Format to IST (Asia/Kolkata) since Curefoods operates in India
          const options = { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false };
          const localTimeStr = dateObj.toLocaleTimeString("en-US", options); // "HH:MM"
          
          if (filters.timeFrom && localTimeStr < filters.timeFrom) return false;
          if (filters.timeTo && localTimeStr > filters.timeTo) return false;
        } catch (err) {
          return false;
        }
        return true;
      });
    }

    result = result.slice(0, limit);

    // Attach the correct brand, city, area, zone fields to every review for Insight functions to use
    for (const row of result) {
      const outlet = map.get(row.restaurant_id);
      if (outlet) {
        row.outlet_id = outlet.id;
        row.brand_name = outlet.brand_name;
        row.main_brand = getParentBrand(outlet.brand_name);
        row.city = outlet.city;
        row.zone = outlet.zone;
        row.area = outlet.area || row.area;
        row.business_entity = outlet.business_entity;
      }
    }
    
    return result;
  } catch (err) {
    console.error("Failed to query reviews from Postgres:", err.message);
    throw err;
  }
}

function groupBy(rows, keyFn, valFn) {
  const map = new Map();
  for (const row of rows) {
    const k = keyFn(row);
    if (!k) continue;
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(valFn(row));
  }
  const result = [];
  for (const [key, vals] of map) {
    const nums = vals.filter((v) => v != null && !isNaN(v));
    result.push({
      name: key,
      avg: nums.length ? +(nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2) : 0,
      count: vals.length,
    });
  }
  return result;
}

// Returns ALL active breakdown dimensions (city → zone → area → brand order).
// Each active multi-value filter gets its own column in the breakdown table.
function getBreakdownDimensions(filters) {
  const dims = [];
  if (filters.cities && filters.cities.length > 1) dims.push({ field: "city", label: "City" });
  if (filters.zones && filters.zones.length > 1) dims.push({ field: "zone", label: "Zone" });
  if (filters.areas && filters.areas.length > 1) dims.push({ field: "area", label: "Area" });
  if (filters.brands && filters.brands.length > 1) dims.push({ field: "brand_name", label: "Brand" });
  if (dims.length === 0) {
    const hasFilter = (filters.brands?.length || filters.cities?.length || filters.zones?.length || filters.areas?.length);
    if (!hasFilter) dims.push({ field: "brand_name", label: "Brand" });
  }
  return dims;
}

// Groups rows by all active breakdown dimensions into a Map.
// Returns Map<compositeKey, { dimVals: {field: value, ...}, rows: [] }>
function buildDimMap(rows, dims) {
  const map = new Map();
  rows.forEach(r => {
    const keyParts = dims.map(d => r[d.field]);
    if (keyParts.some(k => !k)) return;
    const key = keyParts.join('|||');
    if (!map.has(key)) {
      const dimVals = {};
      dims.forEach((d, i) => { dimVals[d.field] = keyParts[i]; });
      map.set(key, { dimVals, rows: [] });
    }
    map.get(key).rows.push(r);
  });
  return map;
}

// Legacy single-dim helper kept for any callers that still use it.
function getBreakdownDimension(filters) {
  const dims = getBreakdownDimensions(filters);
  return dims.length ? dims[0] : null;
}

async function fetchLowRatingComments(filters) {
  const data = await fetchJoined(filters, 100, 'AND restaurant_rating <= 3 AND comments IS NOT NULL');
  return data.map((r) => r.comments).filter(Boolean).join("\n");
}

async function callGroq(prompt) {
  const completion = await groq.chat.completions.create({
    messages: [{ role: "user", content: prompt }],
    model: "llama-3.1-8b-instant",
    max_tokens: 400,
  });
  return completion.choices[0].message.content;
}

router.post("/:id", async (req, res) => {
  try {
    const insightId = parseInt(req.params.id);
    const filters = req.body || {};
    let data = null;

    switch (insightId) {
      case 1: {
        const rows = await fetchJoined(filters);
        data = groupBy(rows, r => r.brand_name, r => r.restaurant_rating).sort((a, b) => b.avg - a.avg);
        break;
      }
      case 2: {
        const rows = await fetchJoined(filters);
        data = groupBy(rows, r => r.zone, r => r.restaurant_rating).sort((a, b) => b.avg - a.avg);
        break;
      }
      case 3: {
        const rows = await fetchJoined(filters);
        data = groupBy(rows, r => r.city, r => r.restaurant_rating).sort((a, b) => b.avg - a.avg).slice(0, 20);
        break;
      }
      case 4: {
        const rows = await fetchJoined(filters);
        const all = groupBy(rows, r => r.area, r => r.restaurant_rating).filter(r => r.count >= 5).sort((a, b) => b.avg - a.avg);
        data = { best: all.slice(0, 10), worst: all.slice(-10).reverse() };
        break;
      }
      case 5: {
        const rows = await fetchJoined(filters);
        const nums = rows.map(r => r.restaurant_rating).filter(v => v != null);
        const avg = nums.length ? +(nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2) : 0;
        data = [{ name: "Swiggy", avg, count: nums.length }];
        break;
      }
      case 6: {
        const rows = await fetchJoined(filters);
        const overall6 = groupBy(rows, r => r.item_name, r => r.restaurant_rating).filter(r => r.name !== 'NO_ITEM' && r.count >= 10).sort((a, b) => b.avg - a.avg).slice(0, 20);
        const dims6 = getBreakdownDimensions(filters);
        if (dims6.length) {
          const dmap6 = buildDimMap(rows, dims6);
          const breakdown = [...dmap6.values()].map(({ dimVals, rows: gr }) => {
            const iMap = new Map();
            gr.forEach(r => { const item = r.item_name; const v = r.restaurant_rating; if (!item || item==='NO_ITEM' || v==null) return; if (!iMap.has(item)) iMap.set(item,[]); iMap.get(item).push(v); });
            const items = [...iMap.entries()].map(([item,vals]) => { const n=vals.filter(v=>v!=null); return {item,avg:n.length?+(n.reduce((a,b)=>a+b,0)/n.length).toFixed(2):0,count:n.length}; }).filter(i=>i.count>=3).sort((a,b)=>b.avg-a.avg);
            const top = items[0] || { item: '-', avg: 0, count: 0 };
            return { ...dimVals, topItem: top.item, topAvg: top.avg, topCount: top.count };
          }).sort((a,b)=>(a[dims6[0].field]||'').localeCompare(b[dims6[0].field]||'')||b.topAvg-a.topAvg);
          data = { overall: overall6, breakdown, breakdownDims: dims6 };
        } else { data = overall6; }
        break;
      }
      case 7: {
        const rows = await fetchJoined(filters);
        const overall7 = groupBy(rows, r => r.item_name, r => r.restaurant_rating).filter(r => r.name !== 'NO_ITEM' && r.count >= 10).sort((a, b) => a.avg - b.avg).slice(0, 20);
        const dims7 = getBreakdownDimensions(filters);
        if (dims7.length) {
          const dmap7 = buildDimMap(rows, dims7);
          const breakdown = [...dmap7.values()].map(({ dimVals, rows: gr }) => {
            const iMap = new Map();
            gr.forEach(r => { const item = r.item_name; const v = r.restaurant_rating; if (!item || item==='NO_ITEM' || v==null) return; if (!iMap.has(item)) iMap.set(item,[]); iMap.get(item).push(v); });
            const items = [...iMap.entries()].map(([item,vals]) => { const n=vals.filter(v=>v!=null); return {item,avg:n.length?+(n.reduce((a,b)=>a+b,0)/n.length).toFixed(2):0,count:n.length}; }).filter(i=>i.count>=3).sort((a,b)=>a.avg-b.avg);
            const worst = items[0] || { item: '-', avg: 0, count: 0 };
            return { ...dimVals, worstItem: worst.item, worstAvg: worst.avg, worstCount: worst.count };
          }).sort((a,b)=>(a[dims7[0].field]||'').localeCompare(b[dims7[0].field]||'')||a.worstAvg-b.worstAvg);
          data = { overall: overall7, breakdown, breakdownDims: dims7 };
        } else { data = overall7; }
        break;
      }
      case 8: {
        const rows = await fetchJoined(filters);
        const overall8 = groupBy(rows, r => r.item_name, r => r.restaurant_rating).filter(r => r.name !== 'NO_ITEM').sort((a, b) => b.count - a.count).slice(0, 20);
        const dims8 = getBreakdownDimensions(filters);
        if (dims8.length) {
          const dmap8 = buildDimMap(rows, dims8);
          const breakdown = [...dmap8.values()].map(({ dimVals, rows: gr }) => {
            const iMap = new Map();
            gr.forEach(r => { const item = r.item_name; const v = r.restaurant_rating; if (!item || item==='NO_ITEM' || v==null) return; if (!iMap.has(item)) iMap.set(item,[]); iMap.get(item).push(v); });
            const items = [...iMap.entries()].map(([item,vals]) => { const n=vals.filter(v=>v!=null); return {item,avg:n.length?+(n.reduce((a,b)=>a+b,0)/n.length).toFixed(2):0,count:n.length}; }).sort((a,b)=>b.count-a.count);
            const top = items[0] || { item: '-', avg: 0, count: 0 };
            return { ...dimVals, topItem: top.item, topCount: top.count, topAvg: top.avg };
          }).sort((a,b)=>(a[dims8[0].field]||'').localeCompare(b[dims8[0].field]||'')||b.topCount-a.topCount);
          data = { overall: overall8, breakdown, breakdownDims: dims8 };
        } else { data = overall8; }
        break;
      }
      case 9: {
        const BRAND_CATEGORY = { Dessert: ["Crustos", "EatFit", "CakeZone"], Pizza: ["Olio", "Pizza"], Burger: ["PHAT", "Burger"], Indian: ["Rolls", "Biryani", "Khichdi"] };
        const rows = await fetchJoined(filters);
        const cats = { Dessert: [], Pizza: [], Burger: [], Indian: [], Other: [] };
        rows.forEach(r => {
          const brand = r.brand_name || "";
          let matched = false;
          for (const [cat, keywords] of Object.entries(BRAND_CATEGORY)) {
            if (keywords.some(k => brand.toLowerCase().includes(k.toLowerCase()))) {
              cats[cat].push(r.restaurant_rating);
              matched = true; break;
            }
          }
          if (!matched) cats.Other.push(r.restaurant_rating);
        });
        const overall9 = Object.entries(cats).map(([name, vals]) => {
          const nums = vals.filter(v => v != null);
          return { name, avg: nums.length ? +(nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2) : 0, count: nums.length };
        });
        const dims9 = getBreakdownDimensions(filters);
        if (dims9.length) {
          const dmap9 = buildDimMap(rows, dims9);
          const breakdown = [...dmap9.values()].map(({ dimVals, rows: gr }) => {
            const nums = gr.map(r => r.restaurant_rating).filter(v => v != null);
            return { ...dimVals, avg: nums.length ? +(nums.reduce((a,b)=>a+b,0)/nums.length).toFixed(2) : 0, count: nums.length };
          }).sort((a, b) => b.avg - a.avg);
          data = { overall: overall9, breakdown, breakdownDims: dims9 };
        } else { data = overall9; }
        break;
      }
      case 10: {
        const rows = await fetchJoined(filters);
        const overall10 = groupBy(rows, r => r.area, r => r.restaurant_rating).filter(r => r.count >= 50 && r.avg < 3.5).sort((a, b) => a.avg - b.avg);
        const dims10 = getBreakdownDimensions(filters).filter(d => d.field !== "area");
        if (dims10.length) {
          const dmap10 = buildDimMap(rows, dims10);
          const breakdown = [...dmap10.values()].map(({ dimVals, rows: gr }) => {
            const nums = gr.map(r => r.restaurant_rating).filter(v => v != null);
            return { ...dimVals, avg: nums.length ? +(nums.reduce((a,b)=>a+b,0)/nums.length).toFixed(2) : 0, count: nums.length };
          }).sort((a, b) => a.avg - b.avg);
          data = { overall: overall10, breakdown, breakdownDims: dims10 };
        } else { data = overall10; }
        break;
      }
      case 11: {
        const rows = await fetchJoined(filters);
        const dist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        rows.forEach(r => { if (r.restaurant_rating >= 1 && r.restaurant_rating <= 5) dist[r.restaurant_rating]++; });
        const total = Object.values(dist).reduce((a, b) => a + b, 0);
        const overall11 = Object.entries(dist).map(([star, count]) => ({ name: `${star}★`, star: +star, count, pct: total ? +((count / total) * 100).toFixed(1) : 0 }));
        const dims11 = getBreakdownDimensions(filters);
        if (dims11.length) {
          const dmap11 = buildDimMap(rows, dims11);
          const breakdown = [...dmap11.values()].map(({ dimVals, rows: gr }) => {
            const d = { 1:0,2:0,3:0,4:0,5:0 };
            gr.forEach(r => { const v = r.restaurant_rating; if (v >= 1 && v <= 5) d[v]++; });
            const tot = d[1]+d[2]+d[3]+d[4]+d[5];
            const wAvg = tot ? +((1*d[1]+2*d[2]+3*d[3]+4*d[4]+5*d[5])/tot).toFixed(2) : 0;
            return { ...dimVals, weightedAvg: wAvg, promoterPct: tot ? +((d[4]+d[5])/tot*100).toFixed(1) : 0, detractorPct: tot ? +((d[1]+d[2])/tot*100).toFixed(1) : 0, total: tot };
          }).sort((a, b) => b.weightedAvg - a.weightedAvg);
          data = { overall: overall11, breakdown, breakdownDims: dims11 };
        } else { data = overall11; }
        break;
      }
      case 12: {
        const rows = await fetchJoined(filters);
        const map12 = new Map();
        rows.forEach(r => {
          if (!r.date) return;
          const month = toMonth(r.date);
          if (!map12.has(month)) map12.set(month, []);
          map12.get(month).push(r.restaurant_rating);
        });
        const overall12 = [...map12.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, vals]) => {
          const nums = vals.filter(v => v != null);
          return { name: month, avg: nums.length ? +(nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2) : 0 };
        });
        const dims12 = getBreakdownDimensions(filters);
        if (dims12.length) {
          const dmap12 = buildDimMap(rows, dims12);
          const breakdown = [...dmap12.values()].map(({ dimVals, rows: gr }) => {
            const monthMap = new Map();
            gr.forEach(r => { if (!r.date || r.restaurant_rating == null) return; const m = toMonth(r.date); if (!monthMap.has(m)) monthMap.set(m,[]); monthMap.get(m).push(r.restaurant_rating); });
            const months = [...monthMap.entries()].sort(([a],[b]) => a.localeCompare(b));
            const avgs = months.map(([,vals]) => { const n=vals.filter(v=>v!=null); return n.length ? +(n.reduce((a,b)=>a+b,0)/n.length).toFixed(2) : 0; });
            const n = avgs.length; let slope = 0;
            if (n >= 2) { const xM=(n-1)/2, yM=avgs.reduce((a,b)=>a+b,0)/n; const num=avgs.reduce((s,y,i)=>s+(i-xM)*(y-yM),0), den=avgs.reduce((s,_,i)=>s+(i-xM)**2,0); slope=den?+(num/den).toFixed(4):0; }
            return { ...dimVals, avgRating: avgs.length ? +(avgs.reduce((a,b)=>a+b,0)/avgs.length).toFixed(2) : 0, trend: slope > 0.005 ? "↑ Rising" : slope < -0.005 ? "↓ Falling" : "→ Stable", bestMonth: months[avgs.indexOf(Math.max(...avgs))]?.[0]||"-", worstMonth: months[avgs.indexOf(Math.min(...avgs))]?.[0]||"-" };
          }).sort((a, b) => b.avgRating - a.avgRating);
          data = { overall: overall12, breakdown, breakdownDims: dims12 };
        } else { data = overall12; }
        break;
      }
      case 13: {
        const rows = await fetchJoined(filters);
        data = groupBy(rows, r => r.area, r => r.restaurant_rating).filter(r => r.count >= 5).map(r => ({ name: r.name, volume: r.count, rating: r.avg }));
        break;
      }
      case 14: {
        const rows = await fetchJoined(filters);
        const calcAvg14 = arr => arr.length ? +(arr.filter(v => v != null).reduce((a, b) => a + b, 0) / arr.length).toFixed(2) : 0;
        const wkd14 = [], wke14 = [];
        rows.forEach(r => { if (!r.ordered_time) return; ([0,6].includes(new Date(r.ordered_time).getDay()) ? wke14 : wkd14).push(r.restaurant_rating); });
        const overall14 = [{ name: "Weekday", avg: calcAvg14(wkd14), count: wkd14.length }, { name: "Weekend", avg: calcAvg14(wke14), count: wke14.length }];
        const dims14 = getBreakdownDimensions(filters);
        if (dims14.length) {
          const dmap14 = buildDimMap(rows, dims14);
          const breakdown = [...dmap14.values()].map(({ dimVals, rows: gr }) => {
            const wd = [], we = [];
            gr.forEach(r => { if (!r.ordered_time || r.restaurant_rating == null) return; ([0,6].includes(new Date(r.ordered_time).getDay()) ? we : wd).push(r.restaurant_rating); });
            return { ...dimVals, weekdayAvg: calcAvg14(wd), weekdayCount: wd.length, weekendAvg: calcAvg14(we), weekendCount: we.length, delta: +(calcAvg14(we) - calcAvg14(wd)).toFixed(2) };
          }).sort((a, b) => (a[dims14[0].field] || '').localeCompare(b[dims14[0].field] || '') || b.weekdayAvg - a.weekdayAvg);
          data = { overall: overall14, breakdown, breakdownDims: dims14 };
        } else { data = overall14; }
        break;
      }
      case 15: {
        const rows = await fetchJoined(filters);
        const hourMap15 = {};
        for (let h = 0; h < 24; h++) hourMap15[h] = 0;
        rows.forEach(r => { if (!r.ordered_time || r.restaurant_rating > 2) return; hourMap15[new Date(r.ordered_time).getHours()]++; });
        const arr15 = Object.entries(hourMap15).map(([h, count]) => ({ name: `${h}:00`, hour: +h, count }));
        const max3 = [...arr15].sort((a, b) => b.count - a.count).slice(0, 3).map(r => r.hour);
        const overall15 = arr15.sort((a, b) => a.hour - b.hour).map(r => ({ ...r, worst: max3.includes(r.hour) }));
        const dims15 = getBreakdownDimensions(filters);
        if (dims15.length) {
          const dmap15 = buildDimMap(rows, dims15);
          const breakdown = [...dmap15.values()].map(({ dimVals, rows: gr }) => {
            const hMap = {};
            gr.forEach(r => { if (!r.ordered_time || r.restaurant_rating > 2 || r.restaurant_rating == null) return; const h = new Date(r.ordered_time).getHours(); hMap[h] = (hMap[h]||0)+1; });
            const total = Object.values(hMap).reduce((a,b)=>a+b,0);
            const worst = Object.entries(hMap).sort(([,a],[,b])=>b-a)[0];
            return { ...dimVals, totalComplaints: total, peakHour: worst ? `${worst[0]}:00` : "-", peakCount: worst ? worst[1] : 0 };
          }).sort((a, b) => (a[dims15[0].field]||'').localeCompare(b[dims15[0].field]||'') || b.totalComplaints - a.totalComplaints);
          data = { overall: overall15, breakdown, breakdownDims: dims15 };
        } else { data = overall15; }
        break;
      }
      case 16: {
        const comments = await fetchLowRatingComments(filters);
        if (!comments) { data = "No bad reviews found."; break; }
        data = await callGroq(`Here are customer complaints from a food delivery app:\n${comments}\nFind the top 5 most repeated problems.\nFormat as numbered list. Each line:\nProblem: [issue] | Frequency: [approx count] | Example: [quote]\nMax 150 words.`);
        break;
      }
      case 17: {
        const comments = await fetchLowRatingComments(filters);
        if (!comments) { data = { delivery: 0, kitchen: 0, packaging: 0, other: 0 }; break; }
        const text = await callGroq(`Classify each complaint as DELIVERY, KITCHEN, PACKAGING or OTHER.\nComplaints: ${comments}\nCount how many fall into each category.\nRespond ONLY with JSON:\n{"delivery": 45, "kitchen": 30, "packaging": 15, "other": 10}`);
        const match = text.match(/\{[\s\S]*\}/);
        data = match ? JSON.parse(match[0]) : { delivery: 0, kitchen: 0, packaging: 0, other: 0 };
        break;
      }
      case 18: {
        const comments = await fetchLowRatingComments(filters);
        if (!comments) { data = "No bad reviews found."; break; }
        data = await callGroq(`You are a restaurant ops analyst.\nThese are customer complaints this week: ${comments}\nWrite a brief with:\n1. Top 3 problems (one line each)\n2. Most affected brand or location\n3. One urgent action to take this week\nKeep under 120 words. Use bullet points.`);
        break;
      }
      case 19: {
        const comments = await fetchLowRatingComments(filters);
        if (!comments) { data = "No bad reviews found."; break; }
        data = await callGroq(`Based on these complaints: ${comments}\nGive 5 specific action items for the ops team.\nFormat each as:\nAction: [what to do]\nOwner: Kitchen / Delivery / Packaging / Management\nImpact: High / Medium / Low`);
        break;
      }
      case 20: {
        const comments = await fetchLowRatingComments(filters);
        if (!comments) { data = "No bad reviews found."; break; }
        data = await callGroq(`From these complaints identify packaging problems only:\n${comments}\nList the top packaging issues found.\nFormat: numbered list, max 5 items, one line each.`);
        break;
      }
      case 21: {
        const rows = await fetchJoined(filters, 200000); // Increased limit to retrieve all active reviews safely
        data = rows.map(r => ({
          review_id: r.id,
          outlet_id: r.outlet_id || null,
          restaurant_id: r.restaurant_id,
          brand_name: r.brand_name || null,
          business_entity: r.business_entity || null,
          city: r.city || null,
          area: r.area || null,
          zone: r.zone || null,
          order_id: r.order_id,
          date: r.date,
          ordered_time: r.ordered_time,
          gmv_total: r.gmv_total,
          item_name: r.item_name,
          comments: r.comments,
          restaurant_rating: r.restaurant_rating,
          post_status: r.post_status,
          updated_at: r.updated_at
        }));
        break;
      }
      case 22: {
        const rows = await fetchJoined(filters, 200000);
        data = rows.map(r => ({
          restaurant_id: r.restaurant_id,
          brand_name: r.brand_name || null,
          city: r.city || null,
          area: r.area || null,
          zone: r.zone || null,
          restaurant_rating: r.restaurant_rating,
          has_comment: !!(r.comments && r.comments.trim() !== ""),
          order_id: r.order_id
        }));
        break;
      }
      case 23: {
        const rows = await fetchJoined(filters);
        const DAYPARTS = ["Morning (06:00 - 12:00)", "Afternoon (12:00 - 16:00)", "Evening (16:00 - 19:00)", "Night (19:00 - 06:00)"];
        const getDaypart = h => { if (h>=6&&h<12) return DAYPARTS[0]; if (h>=12&&h<16) return DAYPARTS[1]; if (h>=16&&h<19) return DAYPARTS[2]; return DAYPARTS[3]; };
        const dayparts23 = { [DAYPARTS[0]]: [], [DAYPARTS[1]]: [], [DAYPARTS[2]]: [], [DAYPARTS[3]]: [] };
        rows.forEach(r => { if (!r.ordered_time) return; dayparts23[getDaypart(new Date(r.ordered_time).getHours())].push(r.restaurant_rating); });
        const overall23 = Object.entries(dayparts23).map(([name, vals]) => {
          const nums = vals.filter(v => v != null && !isNaN(v));
          return { name, avg: nums.length ? +(nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2) : 0, count: vals.length };
        });
        const calcAvg23 = arr => { const n=arr.filter(v=>v!=null&&!isNaN(v)); return n.length?+(n.reduce((a,b)=>a+b,0)/n.length).toFixed(2):0; };
        const dims23 = getBreakdownDimensions(filters);
        if (dims23.length) {
          const dmap23 = buildDimMap(rows, dims23);
          const breakdown = [...dmap23.values()].map(({ dimVals, rows: gr }) => {
            const dps = { [DAYPARTS[0]]:[], [DAYPARTS[1]]:[], [DAYPARTS[2]]:[], [DAYPARTS[3]]:[] };
            gr.forEach(r => { if (!r.ordered_time || r.restaurant_rating == null) return; dps[getDaypart(new Date(r.ordered_time).getHours())].push(r.restaurant_rating); });
            const dpAvgs = DAYPARTS.map(dp => ({ dp, avg: calcAvg23(dps[dp]) })).sort((a,b)=>b.avg-a.avg);
            return { ...dimVals, overallAvg: calcAvg23(DAYPARTS.flatMap(dp=>dps[dp])), bestDaypart: dpAvgs[0].dp.split(" ")[0], bestAvg: dpAvgs[0].avg, worstDaypart: dpAvgs[dpAvgs.length-1].dp.split(" ")[0], worstAvg: dpAvgs[dpAvgs.length-1].avg };
          }).sort((a, b) => (a[dims23[0].field]||'').localeCompare(b[dims23[0].field]||'') || b.overallAvg - a.overallAvg);
          data = { overall: overall23, breakdown, breakdownDims: dims23 };
        } else { data = overall23; }
        break;
      }
      case 26: {
        const rows = await fetchJoined(filters);
        const groupMap = new Map();
        rows.forEach(r => {
          const loc = r.city;
          const brand = r.brand_name;
          if (!loc || !brand) return;
          const key = `${loc}::${brand}`;
          if (!groupMap.has(key)) groupMap.set(key, { loc, brand, ratings: [] });
          if (r.restaurant_rating != null) groupMap.get(key).ratings.push(Number(r.restaurant_rating));
        });
        const locBrands = {};
        for (const [_, item] of groupMap) {
          if (!locBrands[item.loc]) locBrands[item.loc] = [];
          const nums = item.ratings.filter(v => v != null && !isNaN(v));
          if (nums.length >= 5) {
            locBrands[item.loc].push({
              brand: item.brand,
              avg: +(nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2),
              count: nums.length
            });
          }
        }
        data = Object.entries(locBrands).map(([city, list]) => {
          if (list.length === 0) return null;
          const sorted = [...list].sort((a, b) => b.avg - a.avg);
          return {
            city,
            bestBrand: sorted[0].brand,
            bestAvg: sorted[0].avg,
            worstBrand: sorted[sorted.length - 1].brand,
            worstAvg: sorted[sorted.length - 1].avg
          };
        }).filter(Boolean);
        break;
      }
      case 27: {
        const rows = await fetchJoined(filters);
        const areaBrandMap = new Map();
        const outletMap = new Map();
        rows.forEach(r => {
          const area = r.area;
          const brand = r.brand_name;
          const outletId = r.restaurant_id;
          const rating = r.restaurant_rating;
          if (!area || !brand || !outletId || rating == null) return;
          const abKey = `${area}::${brand}`;
          if (!areaBrandMap.has(abKey)) areaBrandMap.set(abKey, []);
          areaBrandMap.get(abKey).push(rating);
          const oKey = `${outletId}::${brand}`;
          if (!outletMap.has(oKey)) outletMap.set(oKey, { area, outletId, brand, ratings: [] });
          outletMap.get(oKey).ratings.push(rating);
        });
        const abAvg = {};
        for (const [key, vals] of areaBrandMap) {
          abAvg[key] = +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2);
        }
        data = [];
        for (const [_, item] of outletMap) {
          const oAvg = +(item.ratings.reduce((a, b) => a + b, 0) / item.ratings.length).toFixed(2);
          const abKey = `${item.area}::${item.brand}`;
          const kAvg = abAvg[abKey] || oAvg;
          const gap = +(oAvg - kAvg).toFixed(2);
          data.push({
            outletId: item.outletId,
            area: item.area,
            brand: item.brand,
            outletAvg: oAvg,
            kitchenAvg: kAvg,
            gap,
            status: gap <= -0.5 ? "⚠️ Outlier (Poor)" : gap >= 0.5 ? "🟢 Star Store" : "Normal"
          });
        }
        data.sort((a, b) => a.gap - b.gap);
        break;
      }
      case 28: {
        const rows = await fetchJoined(filters);
        const outletItemMap = new Map();
        rows.forEach(r => {
          const outletId = r.restaurant_id;
          const item = r.item_name;
          const rating = r.restaurant_rating;
          if (!outletId || !item || item === "NO_ITEM" || rating == null) return;
          const key = `${outletId}::${item}`;
          if (!outletItemMap.has(key)) outletItemMap.set(key, { outletId, item, ratings: [] });
          outletItemMap.get(key).ratings.push(rating);
        });
        const outletBests = {};
        for (const [_, val] of outletItemMap) {
          const avg = +(val.ratings.reduce((a, b) => a + b, 0) / val.ratings.length).toFixed(2);
          if (!outletBests[val.outletId] || outletBests[val.outletId].avg < avg) {
            outletBests[val.outletId] = { item: val.item, avg, count: val.ratings.length };
          }
        }
        const names = {};
        rows.forEach(r => { if (r.restaurant_id) names[r.restaurant_id] = r.area || r.restaurant_id; });
        data = Object.entries(outletBests).map(([outletId, itemObj]) => ({
          outletId,
          name: names[outletId] || outletId,
          bestItem: itemObj.item,
          rating: itemObj.avg,
          count: itemObj.count
        })).sort((a, b) => b.rating - a.rating);
        break;
      }
      case 29: {
        const rows = await fetchJoined(filters);
        const itemMap = new Map();
        rows.forEach(r => {
          const item = r.item_name;
          const rating = r.restaurant_rating;
          if (!item || item === "NO_ITEM" || rating == null) return;
          if (!itemMap.has(item)) itemMap.set(item, []);
          itemMap.get(item).push(rating);
        });
        data = [...itemMap.entries()].map(([name, ratings]) => {
          const count = ratings.length;
          if (count < 5) return null;
          const avg = +(ratings.reduce((a, b) => a + b, 0) / count).toFixed(2);
          const variance = ratings.reduce((sum, r) => sum + Math.pow(r - avg, 2), 0) / count;
          const stddev = +Math.sqrt(variance).toFixed(2);
          return {
            name,
            avg,
            count,
            stddev,
            status: stddev <= 0.5 ? "🟢 Highly Consistent" : stddev >= 1.2 ? "🔴 Inconsistent" : "Moderate"
          };
        }).filter(Boolean).sort((a, b) => b.stddev - a.stddev);
        break;
      }
      case 30: {
        const rows = await fetchJoined(filters);
        const itemLocMap = new Map();
        rows.forEach(r => {
          const item = r.item_name;
          const city = r.city;
          const rating = r.restaurant_rating;
          if (!item || item === "NO_ITEM" || !city || rating == null) return;
          const key = `${item}::${city}`;
          if (!itemLocMap.has(key)) itemLocMap.set(key, []);
          itemLocMap.get(key).push(rating);
        });
        data = [...itemLocMap.entries()].map(([key, ratings]) => {
          const [item, city] = key.split("::");
          const avg = +(ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(2);
          return { item, city, avg, count: ratings.length };
        }).sort((a, b) => b.count - a.count);
        break;
      }
      case 31: {
        const rows = await fetchJoined(filters);
        const itemTrend = new Map();
        rows.forEach(r => {
          const item = r.item_name;
          const date = r.date;
          const rating = r.restaurant_rating;
          if (!item || item === "NO_ITEM" || !date || rating == null) return;
          const month = toMonth(date);
          const key = `${item}::${month}`;
          if (!itemTrend.has(key)) itemTrend.set(key, []);
          itemTrend.get(key).push(rating);
        });
        data = [...itemTrend.entries()].map(([key, ratings]) => {
          const [item, month] = key.split("::");
          const avg = +(ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(2);
          return { item, month, avg, count: ratings.length };
        }).sort((a, b) => a.month.localeCompare(b.month));
        break;
      }
      case 32: {
        const rows = await fetchJoined(filters);
        const companyRatings = rows.map(r => r.restaurant_rating).filter(v => v != null);
        const companyAvg = companyRatings.length ? +(companyRatings.reduce((a, b) => a + b, 0) / companyRatings.length).toFixed(2) : 0;
        const itemMap = new Map();
        rows.forEach(r => {
          const item = r.item_name;
          const rating = r.restaurant_rating;
          if (!item || item === "NO_ITEM" || rating == null) return;
          if (!itemMap.has(item)) itemMap.set(item, []);
          itemMap.get(item).push(rating);
        });
        data = [...itemMap.entries()].map(([name, ratings]) => {
          const avg = +(ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(2);
          const gap = +(avg - companyAvg).toFixed(2);
          return {
            name,
            avg,
            companyAvg,
            gap,
            status: gap >= 0.2 ? "🟢 Above Avg" : gap <= -0.2 ? "🔴 Below Avg" : "Average"
          };
        }).sort((a, b) => a.gap - b.gap);
        break;
      }
      default:
        return res.status(400).json({ error: "Invalid insight ID" });
    }
    res.json(data);
  } catch (err) {
    console.error(`[INSIGHT ${req.params.id} ERROR]`, err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post("/send-email", async (req, res) => {
  const { email, subject, body, fileName, fileBase64 } = req.body;
  if (!email || !fileBase64) {
    return res.status(400).json({ error: "Email and file data are required" });
  }

  try {
    const credentialsPath = path.join(process.cwd(), "server", "ratings", "gmail_credentials.json");
    const tokenPath = path.join(process.cwd(), "server", "ratings", "gmail_token.json");
    
    if (!fs.existsSync(credentialsPath) || !fs.existsSync(tokenPath)) {
      throw new Error("Gmail API credentials or token file not found on server.");
    }

    const credentials = JSON.parse(fs.readFileSync(credentialsPath, "utf8"));
    const { client_secret, client_id, redirect_uris } = credentials.installed;
    
    const { google } = await import("googleapis");
    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
    const token = JSON.parse(fs.readFileSync(tokenPath, "utf8"));
    oAuth2Client.setCredentials(token);
    
    const gmail = google.gmail({ version: "v1", auth: oAuth2Client });

    // Format MIME message
    const boundary = "boundary_" + Date.now().toString(16);
    
    const headers = [
      `To: ${email}`,
      `Subject: ${subject || "Curefoods Report"}`,
      `MIME-Version: 1.0`,
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      ``
    ];

    let contentType = "application/octet-stream";
    if (fileName.endsWith(".pdf")) contentType = "application/pdf";
    else if (fileName.endsWith(".html")) contentType = "text/html";
    else if (fileName.endsWith(".xlsx")) contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    else if (fileName.endsWith(".csv")) contentType = "text/csv";

    const bodyParts = [
      `--${boundary}`,
      `Content-Type: text/plain; charset="UTF-8"`,
      `Content-Transfer-Encoding: 7bit`,
      ``,
      body || "Please find attached your requested report.",
      ``,
      `--${boundary}`,
      `Content-Type: ${contentType}; name="${fileName}"`,
      `Content-Disposition: attachment; filename="${fileName}"`,
      `Content-Transfer-Encoding: base64`,
      ``,
      fileBase64,
      ``,
      `--${boundary}--`
    ];

    const message = headers.join("\r\n") + bodyParts.join("\r\n");
    const encodedMessage = Buffer.from(message)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw: encodedMessage
      }
    });

    res.json({ success: true, message: "Email sent successfully!" });
  } catch (err) {
    console.error("[EMAIL ERROR]", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;