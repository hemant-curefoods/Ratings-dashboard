import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { google } from 'googleapis';
import { fileURLToPath } from 'url';

// Update these paths if your files are located somewhere else
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CREDENTIALS_PATH = path.join(__dirname, 'gmail_credentials.json'); // Correctly resolves path in ESM
const TOKEN_PATH = path.join(__dirname, 'gmail_token.json');

// The scope determines what the app can do. 'modify' allows reading and adding labels.
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/drive.readonly'
];

function authorize(credentials, callback) {
  const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

  getNewToken(oAuth2Client, callback);
}

function getNewToken(oAuth2Client, callback) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });
  
  console.log('Authorize this app by visiting this url:\n', authUrl);
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  
  rl.question('\nPaste the ENTIRE URL from your browser address bar here: ', (input) => {
    rl.close();

    // Automatically extract the code even if you paste the whole URL
    let code = input.trim();
    if (code.includes('code=')) {
      try {
        code = code.split('code=')[1].split('&')[0];
      } catch (e) {
        console.log('Could not extract code from URL, trying raw input...');
      }
    }

    oAuth2Client.getToken(code, (err, token) => {
      if (err) return console.error('Error retrieving access token', err);
      oAuth2Client.setCredentials(token);
      
      // Store the token to disk for later program executions
      fs.writeFileSync(TOKEN_PATH, JSON.stringify(token));
      console.log('Token stored to', TOKEN_PATH);
      callback(oAuth2Client);
    });
  });
}

fs.readFile(CREDENTIALS_PATH, (err, content) => {
  if (err) {
    return console.log('Error loading client secret file. Make sure gmail_credentials.json exists:', err);
  }
  
  // Authorize a client with credentials, then call the Gmail API.
  authorize(JSON.parse(content), () => {
    console.log('Successfully generated gmail_token.json! You are ready to go.');
  });
});