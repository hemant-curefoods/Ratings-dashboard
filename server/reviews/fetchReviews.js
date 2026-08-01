import fs from 'fs/promises';
import { google } from 'googleapis';
import { STORES } from './config.js';
import 'dotenv/config';

export async function getAuthClient() {
  const credentials = JSON.parse(await fs.readFile(process.env.GOOGLE_CREDENTIALS_PATH, 'utf8'));
  const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
  
  let token;
  try {
    token = JSON.parse(await fs.readFile('./server/reviews/token.json', 'utf8'));
  } catch (error) {
    throw new Error("Google Auth Token not found! Please run 'node server/reviews/auth.js' in your terminal to log in.");
  }
  
  oAuth2Client.setCredentials(token);
  return oAuth2Client;
}

export async function fetchGoogleReviews() {
  // --- TEMPORARY DUMMY DATA FOR TESTING ---
  console.log("[REVIEWS] Returning dummy data to bypass Google API locks...");
  return [
    {
      id: "dummy_1",
      name: "accounts/123/locations/456/reviews/dummy_1",
      store_id: STORES[0].id,
      store_name: STORES[0].name,
      brand: STORES[0].brand,
      place_id: STORES[0].place_id,
      reviewer_name: "Rahul M.",
      star_rating: 2,
      review_text: "The biryani lacked salt and the pieces were too bony. Disappointed with today's order.",
      review_date: new Date().toISOString(),
      status: "pending",
      final_reply: null,
      ai_reply: ""
    },
    {
      id: "dummy_2",
      name: "accounts/123/locations/456/reviews/dummy_2",
      store_id: STORES[0].id,
      store_name: STORES[0].name,
      brand: STORES[0].brand,
      place_id: STORES[0].place_id,
      reviewer_name: "Sarah S.",
      star_rating: 5,
      review_text: "Absolutely delicious! The spices were perfect and the meat was so tender. Will order again.",
      review_date: new Date(Date.now() - 86400000).toISOString(),
      status: "pending",
      final_reply: null,
      ai_reply: ""
    }
  ];
}