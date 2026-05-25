require('dotenv').config();
const express = require('express');
const multer = require('multer');
const { google } = require('googleapis');
const stream = require('stream');
const path = require('path');
const fs = require('fs').promises;
const cors = require('cors');

// ===== DATABASE & AUTH =====
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

// ===== CONFIGURATION =====
const SERVICE_ACCOUNT_FILE = process.env.SERVICE_ACCOUNT_FILE || path.join(__dirname, 'service-account.json');
const DRIVE_FOLDER_ID = process.env.DRIVE_FOLDER_ID || null;
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || process.env.CLIENT_ID || null;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || process.env.CLIENT_SECRET || null;
const REDIRECT_URI = process.env.GOOGLE_CALLBACK_URL || process.env.REDIRECT_URI || `http://localhost:${process.env.PORT || 3000}/oauth2callback`;
const TOKEN_PATH = process.env.OAUTH_TOKEN_FILE || path.join(__dirname, 'oauth2-token.json');
const PORT = process.env.PORT || 3000;
const REQUESTS_PATH = process.env.REQUESTS_FILE || path.join(__dirname, 'requests.json');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ===== HELPERS =====
function bufferToStream(buffer) {
  const passthrough = new stream.PassThrough();
  passthrough.end(buffer);
  return passthrough;
}

function createOAuth2Client() {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error('Missing OAuth2 CLIENT_ID and CLIENT_SECRET environment variables.');
  }
  return new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
}

async function loadSavedToken() {
  try {
    const tokenJson = await fs.readFile(TOKEN_PATH, 'utf8');
    return JSON.parse(tokenJson);
  } catch (err) {
    return null;
  }
}

async function saveToken(token) {
  await fs.writeFile(TOKEN_PATH, JSON.stringify(token, null, 2));
}

async function loadRequests() {
  try {
    const requestsJson = await fs.readFile(REQUESTS_PATH, 'utf8');
    return JSON.parse(requestsJson);
  } catch (err) {
    return [];
  }
}

async function saveRequests(requests) {
  await fs.writeFile(REQUESTS_PATH, JSON.stringify(requests, null, 2));
}

async function getDriveClient() {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error('OAuth2 not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env file');
  }
  const oauth2Client = createOAuth2Client();
  const token = await loadSavedToken();
  if (!token) {
    throw new Error('OAuth2 token not found. Please visit http://localhost:3000/auth to authorize.');
  }
  oauth2Client.setCredentials(token);
  return google.drive({ version: 'v3', auth: oauth2Client });
}

async function findOrCreateFolder(drive, folderName, parentId = 'root') {
  const safeName = folderName.replace(/'/g, "\'");
  const query = `name = '${safeName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false and '${parentId}' in parents`;
  const listRes = await drive.files.list({
    q: query,
    fields: 'files(id,name)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    corpora: 'allDrives'
  });

  if (listRes.data.files && listRes.data.files.length > 0) {
    return listRes.data.files[0].id;
  }

  const fileMetadata = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder'
  };
  if (parentId !== 'root') {
    fileMetadata.parents = [parentId];
  }

  const createRes = await drive.files.create({
    resource: fileMetadata,
    fields: 'id',
    supportsAllDrives: true
  });
  return createRes.data.id;
}

// ===== AUTH ENDPOINTS =====
app.post('/api/signup', async (req, res) => {
  const { name, email, password, role, adminCode } = req.body;
  if (role === 'admin' && adminCode !== process.env.ADMIN_CODE) {
    return res.status(403).json({ error: 'Invalid admin code' });
  }
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    await pool.query(
      'INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4)',
      [name, email, hashedPassword, role || 'user']
    );
    res.status(201).json({ message: 'Account created' });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email already registered' });
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (rows.length === 0) return res.status(401).json({ error: 'Invalid email or password' });
    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid email or password' });
    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '2h' });
    res.json({ token, role: user.role, name: user.name });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ===== GOOGLE DRIVE & UPLOAD ENDPOINTS =====
app.get('/auth', (req, res) => {
  try {
    const oauth2Client = createOAuth2Client();
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/drive.file'],
      prompt: 'consent'
    });
    res.redirect(authUrl);
  } catch (err) {
    res.status(500).send(`<h1>OAuth2 configuration required</h1><p>${err.message}</p>`);
  }
});

app.get('/oauth2callback', async (req, res) => {
  try {
    const code = req.query.code;
    if (!code) return res.status(400).send('<h1>Authorization failed</h1><p>No code provided.</p>');
    const oauth2Client = createOAuth2Client();
    const { tokens } = await oauth2Client.getToken(code);
    await saveToken(tokens);
    res.send('<h1>Authorization complete</h1><p>You may close this tab.</p>');
  } catch (err) {
    console.error('OAuth2 callback error', err);
    res.status(500).send(`<h1>Authorization error</h1><p>${err.message}</p>`);
  }
});

app.post('/logout', async (req, res) => {
  try {
    await fs.unlink(TOKEN_PATH);
    res.json({ ok: true, message: 'Token cleared successfully' });
  } catch (err) {
    if (err.code === 'ENOENT') {
      res.json({ ok: true, message: 'Token already cleared' });
    } else {
      console.error('Logout error', err);
      res.status(500).json({ ok: false, error: String(err) });
    }
  }
});

app.get('/requests', async (req, res) => {
  try {
    res.json({ ok: true, requests: await loadRequests() });
  } catch (err) {
    console.error('Load requests error', err);
    res.status(500).json({ ok: false, error: String(err) });
  }
});

app.patch('/requests/:id/reviewed', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const requests = await loadRequests();
    const request = requests.find(item => item.id === id);
    if (!request) return res.status(404).json({ ok: false, error: 'Request not found' });
    request.status = 'reviewed';
    request.reviewedAt = new Date().toISOString();
    await saveRequests(requests);
    res.json({ ok: true, request });
  } catch (err) {
    console.error('Review request error', err);
    res.status(500).json({ ok: false, error: String(err) });
  }
});

app.delete('/requests/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const requests = await loadRequests();
    const nextRequests = requests.filter(item => item.id !== id);
    await saveRequests(nextRequests);
    res.json({ ok: true });
  } catch (err) {
    console.error('Delete request error', err);
    res.status(500).json({ ok: false, error: String(err) });
  }
});

app.post('/upload', upload.fields([{ name: 'requiredFiles' }, { name: 'optionalFiles' }]), async (req, res) => {
  try {
    const drive = await getDriveClient();
    const metadata = {
      fullName: req.body.fullName,
      municipality: req.body.municipality,
      contact: req.body.contact,
      refNo: req.body.refNo,
      date: req.body.date
    };
    const saved = [];
    const municipality = metadata.municipality || 'Uncategorized';

    const saveFile = async (file) => {
      const fileName = file.originalname;
      const mimeType = file.mimetype || 'application/octet-stream';
      const fileMetadata = { name: fileName };
      const parentFolderId = await findOrCreateFolder(drive, municipality, DRIVE_FOLDER_ID || 'root');
      if (parentFolderId) fileMetadata.parents = [parentFolderId];
      const media = { mimeType, body: bufferToStream(file.buffer) };
      const resDrive = await drive.files.create({
        resource: fileMetadata,
        media,
        fields: 'id, name',
        supportsAllDrives: true
      });
      if (resDrive?.data?.id) {
        try {
          await drive.files.update({
            fileId: resDrive.data.id,
            requestBody: { description: JSON.stringify(metadata) },
            supportsAllDrives: true
          });
        } catch (e) { /* ignore */ }
      }
      saved.push({ id: resDrive.data.id, name: resDrive.data.name });
    };

    const required = req.files['requiredFiles'] || [];
    const optional = req.files['optionalFiles'] || [];
    for (const f of required) await saveFile(f);
    for (const f of optional) await saveFile(f);

    const requests = await loadRequests();
    requests.unshift({
      id: Date.now(),
      refNo: metadata.refNo,
      fullName: metadata.fullName,
      municipality: metadata.municipality,
      contact: metadata.contact,
      requestedByName: req.body.requestedByName || '',
      requestedByEmail: req.body.requestedByEmail || '',
      date: metadata.date,
      submittedAt: new Date().toISOString(),
      requiredAttachedCount: required.length,
      requiredTotal: 4,
      optionalCount: optional.length,
      files: [...required, ...optional].map(file => file.originalname),
      driveFiles: saved,
      status: 'submitted'
    });
    await saveRequests(requests);
    res.json({ ok: true, uploaded: saved });
  } catch (err) {
    console.error('Upload error', err);
    res.status(500).json({ ok: false, error: String(err) });
  }
});

// Serve static frontend
app.use(express.static(path.join(__dirname, '../frontend')));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`OAuth2 auth URL: http://localhost:${PORT}/auth`);
});