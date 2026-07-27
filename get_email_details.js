import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { google } from 'googleapis';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CREDENTIALS_PATH = path.join(__dirname, 'server/ratings/gmail_credentials.json');
const TOKEN_PATH = path.join(__dirname, 'server/ratings/gmail_token.json');

async function getAuthClient() {
  const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH));
  const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
  const token = JSON.parse(fs.readFileSync(TOKEN_PATH));
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
  try {
    const auth = await getAuthClient();
    const gmail = google.gmail({ version: 'v1', auth });
    
    const msgId = '19e1c18fcf986809';
    console.log(`Fetching message ID: ${msgId}`);
    const msg = await gmail.users.messages.get({ userId: 'me', id: msgId });
    
    console.log('Subject:', msg.data.payload.headers.find(h => h.name === 'Subject')?.value);
    console.log('Snippet:', msg.data.snippet);
    
    const body = getEmailBody(msg.data.payload);
    console.log('--- Email Body ---');
    console.log(body.substring(0, 1000)); // Print first 1000 chars of body
    
    const attachments = msg.data.payload.parts ? msg.data.payload.parts.filter(p => p.filename) : [];
    console.log('Attachments:', attachments.map(a => a.filename));
  } catch (err) {
    console.error('Error:', err.message);
  }
}
run();
