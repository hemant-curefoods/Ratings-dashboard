import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
  const credentials = JSON.parse(fs.readFileSync(path.join(__dirname, 'gmail_credentials.json')));
  const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
  oAuth2Client.setCredentials(JSON.parse(fs.readFileSync(path.join(__dirname, 'gmail_token.json'))));

  const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });
  
  console.log("Fetching emails to list their dates and subjects...");
  const query = `from:ranjith.r@swiggy.in after:2026/04/01`;
  
  let messages = [];
  let pageToken = undefined;
  do {
    const res = await gmail.users.messages.list({ userId: 'me', q: query, maxResults: 100, pageToken });
    if (res.data.messages) {
      messages = messages.concat(res.data.messages);
    }
    pageToken = res.data.nextPageToken;
  } while (pageToken);

  console.log(`Found ${messages.length} total emails from Ranjith.`);
  
  const emailList = [];

  for (const message of messages) {
    const msgData = await gmail.users.messages.get({ userId: 'me', id: message.id });
    const payload = msgData.data.payload;
    const headers = payload.headers;
    const subject = headers.find(h => h.name.toLowerCase() === 'subject')?.value || '';
    const dateStr = headers.find(h => h.name.toLowerCase() === 'date')?.value || '';
    
    if (subject.toLowerCase().includes("funnel")) {
      const emailDate = new Date(dateStr);
      emailList.push({
        subject,
        rawDate: dateStr,
        parsedDate: emailDate
      });
    }
  }

  // Sort by date ascending (oldest to newest)
  emailList.sort((a, b) => a.parsedDate - b.parsedDate);

  console.log("\n--- LIST OF PROCESSED EMAILS ---");
  emailList.forEach((email, index) => {
    console.log(`${index + 1}. Date: ${email.rawDate} | Subject: ${email.subject}`);
  });
}

run().catch(console.error);
