import 'dotenv/config';
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function getAuthClient() {
  const credentials = JSON.parse(fs.readFileSync(path.join(__dirname, 'gmail_credentials.json')));
  const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

  const token = JSON.parse(fs.readFileSync(path.join(__dirname, 'gmail_token.json')));
  oAuth2Client.setCredentials(token);
  return oAuth2Client;
}

function getEmailBody(payload) {
  let body = '';
  if (payload.body && payload.body.data) {
    body += Buffer.from(payload.body.data, 'base64').toString('utf-8');
  }
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' || part.mimeType === 'text/html') {
        if (part.body && part.body.data) {
          body += Buffer.from(part.body.data, 'base64').toString('utf-8');
        }
      } else if (part.parts) {
        body += getEmailBody(part);
      }
    }
  }
  return body;
}

async function run() {
  const auth = await getAuthClient();
  const gmail = google.gmail({ version: 'v1', auth });

  console.log("Fetching emails from ranjith.r@swiggy.in since April 1st 2026...");
  
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

  console.log(`Found ${messages.length} total emails from Ranjith since April 1st.`);

  let matchedSubjects = new Set();
  let missedCount = 0;

  for (const message of messages) {
    const msgData = await gmail.users.messages.get({ userId: 'me', id: message.id });
    const payload = msgData.data.payload;
    const headers = payload.headers;
    const subject = headers.find(h => h.name.toLowerCase() === 'subject')?.value || '';
    
    if (subject.toLowerCase().includes('funnel')) {
      matchedSubjects.add(subject);
      
      const hasAttachments = payload.parts && payload.parts.some(p => p.body && p.body.attachmentId);
      if (!hasAttachments) {
          missedCount++;
          const bodyText = getEmailBody(payload);
          const urlRegex = /(https?:\/\/[^\s"'<>]+)/g;
          const urls = bodyText.match(urlRegex) || [];
          console.log(`\nMissing attachment in: ${subject}`);
          console.log(`URLs:`, urls.slice(0, 3));
      }
    }
  }
  console.log(`\nFound these unique 'Funnel' subjects:`);
  for (const sub of matchedSubjects) {
      console.log(sub);
  }
  console.log(`\nTotal emails with 'funnel' in subject missing attachments: ${missedCount}`);
}

run();
