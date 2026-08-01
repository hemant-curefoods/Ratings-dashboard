import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { google } from 'googleapis';
import xlsx from 'xlsx';

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

async function run() {
  try {
    const auth = await getAuthClient();
    const gmail = google.gmail({ version: 'v1', auth });
    
    const msgId = '19e1c18fcf986809';
    const msg = await gmail.users.messages.get({ userId: 'me', id: msgId });
    
    const parts = msg.data.payload.parts || [];
    const attachmentPart = parts.find(p => p.filename && p.filename.toLowerCase().includes('.xlsx'));
    if (!attachmentPart) {
      console.log('No Excel attachment found.');
      return;
    }
    
    console.log(`Downloading attachment: ${attachmentPart.filename}`);
    const attachment = await gmail.users.messages.attachments.get({
      userId: 'me',
      messageId: msgId,
      id: attachmentPart.body.attachmentId
    });
    
    const buffer = Buffer.from(attachment.data.data, 'base64url');
    const tempPath = path.join(__dirname, 'temp_search_report.xlsx');
    fs.writeFileSync(tempPath, buffer);
    console.log('File saved locally.');
    
    const wb = xlsx.readFile(tempPath);
    console.log('Sheet names:', wb.SheetNames);
    
    for (const sheetName of wb.SheetNames) {
      const sheet = wb.Sheets[sheetName];
      const json = xlsx.utils.sheet_to_json(sheet, { header: 1 });
      console.log(`Searching sheet: ${sheetName}`);
      
      for (let r = 0; r < json.length; r++) {
        const row = json[r];
        if (!row) continue;
        for (let c = 0; c < row.length; c++) {
          const val = String(row[c]);
          if (val.toLowerCase().includes('made_in_oven') || val.toLowerCase().includes('oven')) {
            console.log(`Found match at Row ${r + 1}, Col ${c + 1} (${xlsx.utils.encode_cell({r, c})}): "${val}"`);
          }
        }
      }
    }
    
    fs.unlinkSync(tempPath);
  } catch (err) {
    console.error('Error:', err.message);
  }
}
run();
