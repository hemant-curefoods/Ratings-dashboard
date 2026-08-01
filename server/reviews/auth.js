import fs from 'fs/promises';
import { google } from 'googleapis';
import express from 'express';
import 'dotenv/config';

const CREDENTIALS_PATH = process.env.GOOGLE_CREDENTIALS_PATH || './server/reviews/credentials.json';
const TOKEN_PATH = './server/reviews/token.json';

async function authorize() {
  const content = await fs.readFile(CREDENTIALS_PATH, 'utf8');
  const credentials = JSON.parse(content);
  const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
  
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/business.manage']
  });

  console.log('------------------------------------------------');
  console.log('AUTHORIZE THIS APP BY VISITING THIS URL:\n', authUrl);
  console.log('------------------------------------------------');

  const app = express();
  const redirectUrl = new URL(redirect_uris[0]);
  const port = redirectUrl.port || 3000;
  const callbackPath = redirectUrl.pathname || '/oauth2callback';
  
  const server = app.listen(port, () => console.log(`Waiting for callback on port ${port}...`));

  app.get(callbackPath, async (req, res) => {
    const code = req.query.code;
    try {
      const { tokens } = await oAuth2Client.getToken(code);
      oAuth2Client.setCredentials(tokens);
      await fs.writeFile(TOKEN_PATH, JSON.stringify(tokens));
      console.log(`\n✅ Token successfully stored to ${TOKEN_PATH}`);
      res.send('Authentication successful! You can close this window and return to your terminal.');
    } catch (err) {
      console.error('Error retrieving access token', err);
      res.status(500).send('Authentication failed.');
    } finally {
      server.close();
      process.exit(0);
    }
  });
}
authorize().catch(console.error);