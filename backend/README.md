# DILG POV Upload System - Backend

Express.js server for handling OAuth2 authorization and uploading documents to Google Drive.

## Setup

1. **Navigate to backend folder:**
   ```powershell
   cd C:\DILG_SYSTEM\backend
   ```

2. **Install dependencies:**
   ```powershell
   npm install
   ```

3. **Set OAuth2 credentials** (from Google Cloud Console):
   ```powershell
   $env:CLIENT_ID = "your_client_id_here"
   $env:CLIENT_SECRET = "your_client_secret_here"
   $env:REDIRECT_URI = "http://localhost:3000/oauth2callback"
   ```

4. **(Optional) Set a Drive folder destination:**
   ```powershell
   $env:DRIVE_FOLDER_ID = "your_google_drive_folder_id"
   ```

5. **Start the server:**
   ```powershell
   npm start
   ```

The server will listen on `http://localhost:3000`.

## Endpoints

- `GET /` - Serves the upload portal (portal.html)
- `GET /auth` - OAuth2 authorization redirect
- `GET /oauth2callback` - OAuth2 callback handler
- `POST /upload` - File upload endpoint (requires authorization)
- `POST /logout` - Clear OAuth2 token

## OAuth2 Flow

1. User clicks municipality to open upload form
2. If not authorized, they click a link that directs to `/auth`
3. Google OAuth2 authorization page appears
4. User grants permission, token is saved to `oauth2-token.json`
5. User can now upload files to Google Drive

## Municipality Folders

If `DRIVE_FOLDER_ID` is set, the server automatically creates a subfolder for each municipality:
- `parent_folder/Abra de Ilog/`
- `parent_folder/Calintaan/`
- etc.

Each municipality's uploads go into its own folder.

## Notes

- Token is stored in `oauth2-token.json` in the backend folder
- Frontend files are served from `../frontend/`
- The server expects Google OAuth credentials (not service account)
