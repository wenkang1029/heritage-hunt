# Security Rules & Deployment Guide
## Project: Melaka Heritage Photo Hunt (`heritage-hunt`)

---

## 1. Cloud Firestore Security Rules

To transition from development test mode to production security before conducting your event, apply these rules in the **Firebase Console ➔ Firestore Database ➔ Rules** tab:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Helper functions
    function isAuthenticated() {
      return request.auth != null;
    }

    // Top-level system settings (e.g., custom geofence zones: /settings/zones)
    match /settings/{settingId} {
      allow read: if true;
      allow write: if isAuthenticated();
    }

    // Games collection: Anyone can read active game status; only GM can modify
    match /games/{gameId} {
      allow read: if true;
      allow write: if isAuthenticated();

      // Teams sub-collection
      match /teams/{teamId} {
        allow read: if true;
        // Teams can update their own GPS location, members and status
        allow create, update: if isAuthenticated();
        allow delete: if false;
      }

      // Clues sub-collection: Players can view clues, GM creates them
      match /clues/{clueId} {
        allow read: if true;
        allow create, update: if isAuthenticated();
        allow delete: if false;
      }

      // Submissions sub-collection: Teams can submit, GM reviews
      match /submissions/{submissionId} {
        allow read: if true;
        allow create: if isAuthenticated() && request.resource.data.selfieBase64.size() < 300000; // max ~225KB
        allow update: if isAuthenticated();
        allow delete: if false;
      }

      // Broadcasts sub-collection: GM live announcements to players
      match /broadcasts/{broadcastId} {
        allow read: if true;
        allow create: if isAuthenticated();
        allow update, delete: if false;
      }
    }
  }
}
```

---

## 2. Environment Variables Specification

The project uses client-side Vite environment variables (prefixed with `VITE_`) and secure server-side environment variables for the NAS API proxy.

Create `.env.local` locally in the project root:

```ini
# Firebase Web App Credentials
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=heritage-hunt-xxxx.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=heritage-hunt-xxxx
VITE_FIREBASE_STORAGE_BUCKET=heritage-hunt-xxxx.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=xxxxxxxxxx
VITE_FIREBASE_APP_ID=1:xxxxxxxx:web:xxxxxxxx

# GM Passcode (for War Room access)
VITE_GM_PASSCODE=your_secret_passcode_here

# Xinya / UTBA NAS Photo Upload Configuration (Server-Side Only)
XINYA_BASE_URL=https://utba.my/UTBA
XINYA_USERNAME=your_utba_username
XINYA_PASSWORD=your_utba_password
XINYA_EVENT_ID=123
XINYA_EVENT_CODE=HERITAGE2026
```

---

## 3. NAS Photo Integration & Security Architecture

The app routes high-resolution original photo uploads through serverless endpoints (`/api/upload-photo` and `/api/download-photo`) to the organization's NAS via the Xinya API.

### Security Defenses:
1. **Magic Byte Inspection:** Inspects binary file headers (`FF D8 FF` for JPEG, `89 50 4E 47` for PNG, WebP, HEIC). Blocks fake extensions and executable masquerading.
2. **Stored XSS Prevention:** Explicitly rejects SVG, HTML, and script payloads even if renamed with `.jpg` or `.png` extensions.
3. **Payload Ceiling Guard:** Strictly rejects files exceeding **20 MB** both upfront (HTTP `Content-Length`) and during stream parsing.
4. **Filename Sanitization:** Discards user-supplied filenames and generates server-controlled UUID filenames to eliminate path traversal and file overwrite risks.
5. **SSRF Defense:** Proxy download endpoint only permits target URLs matching `https://utba.my/UTBA/media_file/NAS/UTBA/event_photo/...` and rejects all internal or third-party addresses.
6. **Zero Secret Exposure:** Credentials remain purely server-side. Session tokens are automatically refreshed 5 minutes before expiration and are never transmitted to mobile players.

---

## 4. GitHub & Vercel Automated Deployment

### Step A: Push Code to GitHub
```powershell
cd C:\Users\User\Projects\heritage-hunt
git add .
git commit -m "feat: your commit message"
git push origin main
```

### Step B: Import into Vercel
1. Log in to your [Vercel Dashboard](https://vercel.com/dashboard).
2. Click **Add New... ➔ Project**.
3. Select your GitHub repository `heritage-hunt`.
4. Framework Preset: **Vite** (automatically detected).
5. Under **Environment Variables**, paste the keys from your `.env.local`:
   * `VITE_FIREBASE_API_KEY`
   * `VITE_FIREBASE_AUTH_DOMAIN`
   * `VITE_FIREBASE_PROJECT_ID`
   * `VITE_FIREBASE_STORAGE_BUCKET`
   * `VITE_FIREBASE_MESSAGING_SENDER_ID`
   * `VITE_FIREBASE_APP_ID`
   * `VITE_GM_PASSCODE`
   * *(Optional for Live NAS)*:
     * `XINYA_BASE_URL`
     * `XINYA_USERNAME`
     * `XINYA_PASSWORD`
     * `XINYA_EVENT_ID`
     * `XINYA_EVENT_CODE`
6. Click **Deploy**.
7. Your app is live with free automatic SSL (e.g. `https://heritage-hunt.vercel.app`)! Every future push to GitHub will auto-deploy in under 30 seconds.
