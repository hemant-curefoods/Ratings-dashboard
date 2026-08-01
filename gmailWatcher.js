import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CREDENTIALS_PATH = path.join(__dirname, 'gmail_credentials.json');
const TOKEN_PATH = path.join(__dirname, 'gmail_token.json');
const DOWNLOAD_DIR = path.join(__dirname, 'downloads');

// Ensure the downloads folder exists
if (!fs.existsSync(DOWNLOAD_DIR)) {
  fs.mkdirSync(DOWNLOAD_DIR);
}

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
    
    // Aggressively capture ALL attachments. Force an extension if one is missing or non-standard.
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

async function checkForNewReports(targetDateStr, forceAll = false) {
  const auth = await getAuthClient();
  const gmail = google.gmail({ version: 'v1', auth });
  const drive = google.drive({ version: 'v3', auth });
  const downloadedFiles = [];

  let query = `from:ranjith.r@swiggy.in`;
  if (!targetDateStr && !forceAll) {
    query += ` -label:swiggy-processed`;
  }

  console.log(`Checking Gmail for Swiggy reports...`);
  
  let messages = [];
  let pageToken = undefined;
  do {
    const res = await gmail.users.messages.list({ userId: 'me', q: query, maxResults: 100, pageToken });
    if (res.data.messages) {
      messages = messages.concat(res.data.messages);
    }
    pageToken = res.data.nextPageToken;
  } while (pageToken);

  if (messages.length === 0) {
    console.log('No new reports found.');
    return downloadedFiles;
  }

  let targetDateObj = null;
  if (targetDateStr) {
    targetDateObj = new Date(targetDateStr.replace(/-/g, '/'));
    console.log(`Filtering inbox strictly for emails received on: ${targetDateStr}`);
  }

  for (const message of messages) {
    const msgData = await gmail.users.messages.get({ userId: 'me', id: message.id });
    const payload = msgData.data.payload;
    const headers = payload.headers;
    const subject = headers.find(h => h.name.toLowerCase() === 'subject')?.value || '';
    
    if (!subject.toLowerCase().includes("funnel")) continue; // Only care about funnel reports

    // Strict JavaScript date filtering
    if (targetDateObj) {
      const dateHeader = headers.find(h => h.name.toLowerCase() === 'date')?.value;
      if (dateHeader) {
        const emailDate = new Date(dateHeader);
        if (emailDate.getFullYear() !== targetDateObj.getFullYear() ||
            emailDate.getMonth() !== targetDateObj.getMonth() ||
            emailDate.getDate() !== targetDateObj.getDate()) {
          continue; // Skip emails that don't match the exact day
        }
      }
    }

    let fileDownloadedFromEmail = false;

    // 1. Process standard file attachments
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
      fileDownloadedFromEmail = true;
    }

    // 2. Extract and download from links in the email body
    const bodyText = getEmailBody(payload);
    const urlRegex = /(https?:\/\/[^\s"'<>]+)/g;
    const urls = bodyText.match(urlRegex) || [];

    // Deduplicate URLs to avoid downloading the same sheet twice
    const uniqueUrls = [...new Set(urls.map(u => u.replace(/&amp;/g, '&')))];

    for (let url of uniqueUrls) {
      const lowerUrl = url.toLowerCase();
      const sheetMatch = url.match(/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      
      if (sheetMatch) {
        const fileId = sheetMatch[1];
        console.log(`Found Google Sheet link in email. Downloading file ID: ${fileId}...`);
        try {
          const response = await drive.files.export(
            { fileId: fileId, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
            { responseType: 'stream' }
          );
          
          const safeSubject = subject.replace(/[^a-z0-9]/gi, '_').substring(0, 50);
          const filePath = path.join(DOWNLOAD_DIR, `${Date.now()}_${safeSubject}.xlsx`);
          const dest = fs.createWriteStream(filePath);
          
          await new Promise((resolve, reject) => {
            response.data
              .on('end', () => resolve())
              .on('error', err => reject(err))
              .pipe(dest);
          });
          downloadedFiles.push(filePath);
          fileDownloadedFromEmail = true;
          console.log(`Successfully downloaded Google Sheet: ${filePath}`);
        } catch (err) {
          if (err.message && err.message.toLowerCase().includes('export only supports docs editors files')) {
            console.log(`File is not a Google Sheet, downloading raw media for ID: ${fileId}...`);
            try {
              const response = await drive.files.get(
                { fileId: fileId, alt: 'media' },
                { responseType: 'stream' }
              );
              
              const safeSubject = subject.replace(/[^a-z0-9]/gi, '_').substring(0, 50);
              const filePath = path.join(DOWNLOAD_DIR, `${Date.now()}_${safeSubject}.xlsx`);
              const dest = fs.createWriteStream(filePath);
              
              await new Promise((resolve, reject) => {
                response.data
                  .on('end', () => resolve())
                  .on('error', err => reject(err))
                  .pipe(dest);
              });
              downloadedFiles.push(filePath);
              fileDownloadedFromEmail = true;
              console.log(`Successfully downloaded raw file: ${filePath}`);
            } catch (err2) {
              console.error(`Failed to download raw file from Drive:`, err2.message);
            }
          } else {
            console.error(`Failed to download Google Sheet:`, err.message);
          }
        }
      } else if (lowerUrl.includes('.xlsx') || lowerUrl.includes('.xls') || lowerUrl.includes('.csv')) {
        console.log(`Found report link in email: ${url}`);
        try {
          const response = await fetch(url);
          if (response.ok) {
            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const fileName = url.split('/').pop().split('?')[0] || 'download_link.xlsx';
            const filePath = path.join(DOWNLOAD_DIR, `${Date.now()}_${fileName}`);
            fs.writeFileSync(filePath, buffer);
            downloadedFiles.push(filePath);
            fileDownloadedFromEmail = true;
          }
        } catch (err) {
          console.error(`Failed to download from link:`, err.message);
        }
      }
    }

    if (!targetDateStr && fileDownloadedFromEmail) {
      await markEmailAsProcessed(gmail, message.id);
    } else if (targetDateStr) {
      console.log(`Testing mode (Target Date Provided): Skipping label application so email can be fetched again.`);
    }
  }

  return downloadedFiles;
}

async function markEmailAsProcessed(gmail, messageId) {
  const labelsRes = await gmail.users.labels.list({ userId: 'me' });
  let label = labelsRes.data.labels.find(l => l.name === 'swiggy-processed');

  if (!label) {
    const createdLabel = await gmail.users.labels.create({
      userId: 'me',
      requestBody: {
        name: 'swiggy-processed',
        labelListVisibility: 'labelShow',
        messageListVisibility: 'show'
      }
    });
    label = createdLabel.data;
  }

  await gmail.users.messages.modify({
    userId: 'me', id: messageId, requestBody: { addLabelIds: [label.id] }
  });
}

export { checkForNewReports };