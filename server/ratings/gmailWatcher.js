import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { google } from 'googleapis';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
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

/**
 * Cleans a URL and extracts the Google Sheet/Drive file ID.
 * @param {string} url The raw URL from the email body.
 * @returns {string|null} The extracted file ID or null.
 */
function extractFileId(url) {
  const cleanUrl = url
    .replace(/\*/g, '')        // remove * character
    .replace(/\s/g, '')        // remove spaces
    .split('#')[0]             // remove #gid=... fragment
    .trim();
  
  const match = cleanUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

/**
 * Downloads a Google Sheet as an .xlsx file using an authenticated request.
 * @param {object} auth The authenticated Google OAuth2 client.
 * @param {string} fileId The ID of the Google Sheet.
 * @param {string} destPath The full path to save the downloaded file.
 * @returns {Promise<string>} The path to the saved file.
 */
async function downloadGoogleSheet(auth, fileId, destPath) {
  console.log("Getting access token...");
  const tokenResponse = await auth.getAccessToken();
  const accessToken = tokenResponse.token;
  console.log("Access token retrieved ✓");

  const exportUrl = `https://docs.google.com/spreadsheets/d/${fileId}/export?format=xlsx`;
  console.log(`Downloading sheet with file ID: ${fileId}`);

  const response = await fetch(exportUrl, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    }
  });
  console.log(`Download response status: ${response.status}`);
  if (response.ok) {
    const buffer = await response.arrayBuffer();
    fs.writeFileSync(destPath, Buffer.from(buffer));
    return destPath;
  }

  console.log(`Export failed with HTTP ${response.status}. Attempting direct file download for ID: ${fileId}...`);
  const drive = google.drive({ version: 'v3', auth });
  try {
    const rawResponse = await drive.files.get(
      { fileId: fileId, alt: 'media' },
      { responseType: 'stream' }
    );
    const dest = fs.createWriteStream(destPath);
    await new Promise((resolve, reject) => {
      rawResponse.data
        .on('end', () => resolve())
        .on('error', err => reject(err))
        .pipe(dest);
    });
    console.log(`Direct file download successful! Saved to: ${destPath}`);
    return destPath;
  } catch (err) {
    console.error("Direct file download failed:", err.message);
    throw new Error(`HTTP ${response.status} & Drive error: ${err.message}`);
  }
}

async function checkForNewReports(targetDateStr) {
  const auth = await getAuthClient();
  const gmail = google.gmail({ version: 'v1', auth });
  const drive = google.drive({ version: 'v3', auth });
  const downloadedFiles = [];

  // Search for emails containing all these words in the subject in any order
  let query = `from:ranjith.r@swiggy.in subject:(Funnel IGCC RDC Serviceability RHI)`;
  if (!targetDateStr) {
    query += ` -label:swiggy-processed`;
  }

  console.log(`Checking Gmail for Swiggy reports...`);
  
  const res = await gmail.users.messages.list({ userId: 'me', q: query });
  const messages = res.data.messages || [];

  if (messages.length === 0) {
    console.log('No new reports found.');
    return downloadedFiles;
  }

  let targetDateObj = null;
  if (targetDateStr) {
    // Use UTC to prevent timezone-related off-by-one-day errors.
    targetDateObj = new Date(`${targetDateStr}T00:00:00.000Z`);
    console.log(`Filtering inbox strictly for emails received on: ${targetDateStr}`);
  }

  for (const message of messages) {
    const msgData = await gmail.users.messages.get({ userId: 'me', id: message.id });

    // Strict JavaScript date filtering (ignores Gmail's confusing search engine logic)
    if (targetDateObj) {
      const headers = msgData.data.payload.headers;
      const dateHeader = headers.find(h => h.name === 'Date')?.value;
      if (dateHeader) {
        const emailDate = new Date(dateHeader);
        if (emailDate.getUTCFullYear() !== targetDateObj.getUTCFullYear() ||
            emailDate.getUTCMonth() !== targetDateObj.getUTCMonth() ||
            emailDate.getUTCDate() !== targetDateObj.getUTCDate()) {
          continue; // Instantly skip emails that don't match the exact day
        }
      }
    }

    // 1. Process standard file attachments
    const attachmentParts = getAttachmentParts(msgData.data.payload);
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
    }

    // 2. Extract and download from links in the email body
    const bodyText = getEmailBody(msgData.data.payload);
    const urlRegex = /(https?:\/\/[^\s"'<>]+)/g;
    const urls = [...new Set(bodyText.match(urlRegex) || [])];

    for (let url of urls) {
      // Get a fresh access token to authorize the download
      const accessToken = (await auth.getAccessToken()).token;
      const authHeaders = {
        'Authorization': `Bearer ${accessToken}`
      };

      url = url.replace(/&amp;/g, '&').replace(/[)>"']+$/, '').trim();
      const lowerUrl = url.toLowerCase();

      // Skip obvious non-file links
      if (lowerUrl.includes('unsubscribe') || lowerUrl.includes('mailto:')) continue;
      
      try {
        // Case 1: Google Sheets link — convert to xlsx export
        const fileId = extractFileId(url);
        if (fileId) {
          const filePath = path.join(DOWNLOAD_DIR, `${Date.now()}_report.xlsx`);
          await downloadGoogleSheet(auth, fileId, filePath);
          downloadedFiles.push(filePath);
          console.log(`Sheet saved to: ${filePath}`);
          continue;
        }

        // Case 3: Direct file link (.xlsx / .xls / .csv)
        // This case is now less likely but kept as a fallback
        if (lowerUrl.includes('.xlsx') || lowerUrl.includes('.xls') || lowerUrl.includes('.csv')) {
          console.log(`Found direct file link: ${url}`);
          const response = await fetch(url, { headers: authHeaders, redirect: 'follow' });
          if (response.ok) {
            const buffer = Buffer.from(await response.arrayBuffer());
            const fileName = url.split('/').pop().split('?')[0] || 'report.xlsx';
            const filePath = path.join(DOWNLOAD_DIR, `${Date.now()}_${fileName}`);
            fs.writeFileSync(filePath, buffer);
            downloadedFiles.push(filePath);
            console.log(`Saved: ${filePath}`);
          }
          continue;
        }

        // Case 4: Unknown link — follow redirect and check content-type
        const response = await fetch(url, { headers: authHeaders, redirect: 'follow' });
        if (response.ok) {
          const contentType = response.headers.get('content-type') || '';
          const finalUrl = response.url.toLowerCase();
          const isFile = contentType.includes('spreadsheet') ||
                         contentType.includes('octet-stream') ||
                         contentType.includes('excel') ||
                         finalUrl.includes('.xlsx') ||
                         finalUrl.includes('.xls') ||
                         finalUrl.includes('.csv');
          if (isFile) {
            console.log(`Downloaded file via redirect: ${url}`);
            const buffer = Buffer.from(await response.arrayBuffer());
            const filePath = path.join(DOWNLOAD_DIR, `${Date.now()}_redirect_report.xlsx`);
            fs.writeFileSync(filePath, buffer);
            downloadedFiles.push(filePath);
          }
        }
      } catch (err) {
        console.error(`Failed to process link ${url}:`, err.message);
      }
    }

    if (!targetDateStr) {
      await markEmailAsProcessed(gmail, message.id);
    } else {
      console.log(`Running for a specific date, skipping 'processed' label to allow re-runs.`);
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