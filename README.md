# DILG POV Upload System

A complete system for uploading POV (Purchase of Motor Vehicles) documents to Google Drive, organized by municipality.

## Project Structure

```
DILG_SYSTEM/
├── backend/              # Express.js server
│   ├── server.js         # Main backend server
│   ├── package.json      # Node dependencies
│   ├── oauth2-token.json # OAuth2 token (auto-generated)
│   └── README.md         # Backend setup guide
│
├── frontend/             # Web interface
│   ├── portal.html       # Main upload portal (11 municipalities)
│   ├── dashboard.html    # Admin dashboard
│   ├── signup.html       # Authentication page
│   ├── dilg-logo-*.png   # DILG logo
│   └── 486755339_*.jpg   # Hero background image
│
└── README.md             # This file
```

## Quick Start

### 1. Setup Backend

```powershell
cd C:\DILG_SYSTEM\backend
npm install

# Set OAuth2 credentials from Google Cloud Console
$env:CLIENT_ID = "your_client_id"
$env:CLIENT_SECRET = "your_client_secret"
$env:REDIRECT_URI = "http://localhost:3000/oauth2callback"

# (Optional) Set Google Drive folder
$env:DRIVE_FOLDER_ID = "your_drive_folder_id"

npm start
```

### 2. Access the Portal

Open browser: `http://localhost:3000`

- Click on a municipality from the dropdown
- Fill in your details and upload documents
- Files are automatically organized in Google Drive by municipality

## Features

✅ **11 Municipalities Support**: Abra de Ilog, Calintaan, Looc, Lubang, Magsaysay, Mamburao, Paluan, Rizal, Sablayan, San Jose, Santa Cruz

✅ **OAuth2 Authentication**: Secure Google Drive access

✅ **Automatic Folder Organization**: Each municipality gets its own Drive folder

✅ **5 Required + Optional Files**: Upload POV documents with metadata

✅ **Logout Functionality**: Clear session and authorize as different user

## Google Drive Integration

### Files Organization
Each municipality's uploads are placed in:
```
Your Drive Folder/
├── Abra de Ilog/
│   ├── LCE_Request_Letter.pdf
│   ├── Certificate_of_Funds.pdf
│   └── ...
├── Calintaan/
│   └── ...
└── ...
```

### Required Files per Request
1. LCE Request Letter
2. Certificate of Availability of Funds
3. Certified True Copy of Ordinance + Resolution
4. Updated Inventory of Existing Motor Vehicles
5. Others (optional - for additional supporting documents)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `CLIENT_ID` | Yes | Google OAuth2 Client ID |
| `CLIENT_SECRET` | Yes | Google OAuth2 Client Secret |
| `REDIRECT_URI` | No | OAuth callback (default: `http://localhost:3000/oauth2callback`) |
| `DRIVE_FOLDER_ID` | No | Parent Google Drive folder ID for organizing uploads |
| `PORT` | No | Server port (default: 3000) |

## Setup Google OAuth2

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. Enable Google Drive API
4. Create OAuth2 credentials (Desktop application)
5. Add authorized redirect URI: `http://localhost:3000/oauth2callback`
6. Copy `Client ID` and `Client Secret`

## Troubleshooting

**Error: "OAuth2 token not found"**
- Visit `http://localhost:3000/auth` to authorize
- Grant permission to the Google account

**Error: "Municipality folder cannot be created"**
- Ensure `DRIVE_FOLDER_ID` exists and you have write access
- Try logging out (`🚪` button) and re-authorizing

**Files not appearing in Drive**
- Check that you're logged in with the correct Google account
- Verify `DRIVE_FOLDER_ID` permission

## Support

For issues or questions, contact DILG Occidental Mindoro administrative office.

---

**Last Updated**: May 2026  
**Version**: 1.0.0
