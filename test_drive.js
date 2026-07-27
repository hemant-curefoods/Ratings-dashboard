import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
  const creds = JSON.parse(fs.readFileSync(path.join(__dirname, 'gmail_credentials.json')));
  const oAuth2Client = new google.auth.OAuth2(creds.installed.client_id, creds.installed.client_secret, creds.installed.redirect_uris[0]);
  oAuth2Client.setCredentials(JSON.parse(fs.readFileSync(path.join(__dirname, 'gmail_token.json'))));
  
  const drive = google.drive({ version: 'v3', auth: oAuth2Client });
  
  const fileId = '1pjlJqPdGSrasPlIuAx0gzh9d0WQfdOSO';
  console.log(`Downloading Google Sheet ${fileId} as Excel...`);
  
  try {
    const response = await drive.files.export(
      { fileId: fileId, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
      { responseType: 'stream' }
    );
    
    const dest = fs.createWriteStream(path.join(__dirname, 'test_download.xlsx'));
    response.data.pipe(dest);
    
    dest.on('finish', () => {
      console.log('Download complete!');
    });
  } catch (err) {
    console.error('Error downloading:', err.message);
  }
}

run();
