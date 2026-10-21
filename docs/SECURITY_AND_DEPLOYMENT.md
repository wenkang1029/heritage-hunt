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

The project uses Vite environment variables (prefixed with `VITE_`).

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
```

---

## 3. GitHub & Vercel Automated Deployment

### Step A: Push Code to GitHub
```powershell
cd C:\Users\User\Projects\heritage-hunt
git init
git add .
git commit -m "feat: initial commit for Melaka Heritage Photo Hunt"
git branch -M main
git remote add origin https://github.com/<your-username>/heritage-hunt.git
git push -u origin main
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
6. Click **Deploy**.
7. Your app is live with free automatic SSL (e.g. `https://heritage-hunt.vercel.app`)! Every future push to GitHub will auto-deploy in under 30 seconds.
