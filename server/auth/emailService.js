import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { google } from 'googleapis';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Re-use the existing automation credentials
const CREDENTIALS_PATH = path.join(__dirname, '../ratings/gmail_credentials.json');
const TOKEN_PATH = path.join(__dirname, '../ratings/gmail_token.json');

let oauth2Client = null;

async function getAuthClient() {
  if (oauth2Client) return oauth2Client;
  
  if (!fs.existsSync(CREDENTIALS_PATH) || !fs.existsSync(TOKEN_PATH)) {
    throw new Error('Gmail API credentials or token missing. Email functionality disabled.');
  }

  const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH));
  const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
  
  oauth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
  const token = JSON.parse(fs.readFileSync(TOKEN_PATH));
  oauth2Client.setCredentials(token);
  
  return oauth2Client;
}

export async function sendEmail(to, subject, message) {
  try {
    const auth = await getAuthClient();
    const gmail = google.gmail({ version: 'v1', auth });

    // RFC 2822 format
    const str = [
      'Content-Type: text/plain; charset="UTF-8"\n',
      'MIME-Version: 1.0\n',
      `To: ${to}\n`,
      `Subject: ${subject}\n\n`,
      message
    ].join('');

    const encodedMail = Buffer.from(str).toString('base64url');

    const res = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: encodedMail
      }
    });

    console.log(`[EMAIL] Successfully sent email to ${to}, Message ID: ${res.data.id}`);
    return true;
  } catch (error) {
    console.error(`[EMAIL] Failed to send email to ${to}:`, error.message);
    return false;
  }
}
