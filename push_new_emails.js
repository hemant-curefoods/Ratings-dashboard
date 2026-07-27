import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';
import { fileURLToPath } from 'url';
import { parseExcel } from './parseExcel.js';
import { insertRows } from './supabaseClient.js';
import { pool } from './server/ratings/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CREDENTIALS_PATH = path.join(__dirname, 'gmail_credentials.json');
const TOKEN_PATH = path.join(__dirname, 'gmail_token.json');
const DOWNLOAD_DIR = path.join(__dirname, 'downloads');

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

function getAttachmentParts(part) {
  let attachments = [];
  const hasAttachmentId = part.body && part.body.attachmentId;
  
  if (hasAttachmentId && part.filename) {
    const fname = part.filename.toLowerCase();
    if (!fname.endsWith('.xlsx') && !fname.endsWith('.xls') && !fname.endsWith('.csv')) {
      part.filename += '.xlsx'; 
    }
    attachments.push(part);
  }
  if (part.parts) {
    for (const subPart of part.parts) {
      attachments = attachments.concat(getAttachmentParts(subPart));
    }
  }
  return attachments;
}

async function run() {
  try {
    // 1. Get max date from DB
    const resMax = await pool.query('SELECT max(date) as max_date FROM order_reviews');
    const maxDateVal = resMax.rows[0].max_date;
    let afterDate = '2026-07-13'; // fallback
    if (maxDateVal) {
      const dateObj = new Date(maxDateVal);
      const year = dateObj.getFullYear();
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const day = String(dateObj.getDate()).padStart(2, '0');
      afterDate = `${year}-${month}-${day}`;
    }
    console.log(`Last date in Postgres DB is: ${afterDate}`);
    console.log(`Ingesting Swiggy emails sent AFTER ${afterDate}...`);

    // 2. Fetch from Swiggy after afterDate
    const auth = await getAuthClient();
    const gmail = google.gmail({ version: 'v1', auth });
    const drive = google.drive({ version: 'v3', auth });

    const query = `from:ranjith.r@swiggy.in after:${afterDate}`;
    console.log(`Gmail Query: ${query}`);

    let messages = [];
    let pageToken = undefined;
    do {
      const res = await gmail.users.messages.list({ userId: 'me', q: query, maxResults: 100, pageToken });
      if (res.data.messages) {
        messages = messages.concat(res.data.messages);
      }
      pageToken = res.data.nextPageToken;
    } while (pageToken);

    console.log(`Found ${messages.length} matching emails.`);

    const downloadedFiles = [];

    for (const message of messages) {
      const msgData = await gmail.users.messages.get({ userId: 'me', id: message.id });
      const payload = msgData.data.payload;
      const headers = payload.headers;
      const subject = headers.find(h => h.name.toLowerCase() === 'subject')?.value || '';
      
      if (!subject.toLowerCase().includes("funnel")) continue;

      console.log(`Processing email Subject: "${subject}"`);
      let fileDownloaded = false;

      // Attachment processing
      const attachmentParts = getAttachmentParts(payload);
      for (const part of attachmentParts) {
        console.log(`Downloading attachment: ${part.filename}`);
        const attachmentId = part.body.attachmentId;
        const attachment = await gmail.users.messages.attachments.get({
          userId: 'me',
          messageId: message.id,
          id: attachmentId
        });
        const buffer = Buffer.from(attachment.data.data, 'base64url');
        const filePath = path.join(DOWNLOAD_DIR, `${Date.now()}_${part.filename}`);
        fs.writeFileSync(filePath, buffer);
        downloadedFiles.push(filePath);
        fileDownloaded = true;
      }

      // Link processing
      const bodyText = getEmailBody(payload);
      const urlRegex = /(https?:\/\/[^\s"'<>]+)/g;
      const urls = bodyText.match(urlRegex) || [];
      const uniqueUrls = [...new Set(urls.map(u => u.replace(/&amp;/g, '&')))];

      for (let url of uniqueUrls) {
        const lowerUrl = url.toLowerCase();
        const sheetMatch = url.match(/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
        
        if (sheetMatch) {
          const fileId = sheetMatch[1];
          console.log(`Downloading Google Sheet ID: ${fileId} from link...`);
          try {
            const response = await drive.files.export(
              { fileId: fileId, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
              { responseType: 'stream' }
            );
            const safeSubject = subject.replace(/[^a-z0-9]/gi, '_').substring(0, 50);
            const filePath = path.join(DOWNLOAD_DIR, `${Date.now()}_${safeSubject}.xlsx`);
            const dest = fs.createWriteStream(filePath);
            await new Promise((resolve, reject) => {
              response.data.on('end', () => resolve()).on('error', err => reject(err)).pipe(dest);
            });
            downloadedFiles.push(filePath);
            fileDownloaded = true;
            console.log(`Successfully downloaded: ${filePath}`);
          } catch (err) {
            console.error(`Drive export failed: ${err.message}`);
          }
        }
      }
    }

    if (downloadedFiles.length === 0) {
      console.log("No new Swiggy reports found to download.");
      return;
    }

    console.log(`Downloaded ${downloadedFiles.length} files. Starting Excel parse & DB upload...`);

    for (const filePath of downloadedFiles) {
      console.log(`\n--- Processing File: ${filePath} ---`);
      try {
        const rows = parseExcel(filePath);
        console.log(`Parsed ${rows.length} rows. Uploading to PostgreSQL...`);
        await insertRows(rows);
        console.log(`Successfully uploaded ${filePath}!`);
      } catch (err) {
        console.error(`Error processing ${filePath}:`, err);
      }
    }

    console.log("\nIngestion run completed successfully.");

  } catch (err) {
    console.error("Runner failed:", err);
  } finally {
    await pool.end();
  }
}

run();
