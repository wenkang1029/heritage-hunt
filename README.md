# 🏛️ Melaka Heritage Photo Hunt (`heritage-hunt`)

> A mobile-first, real-time web application for conducting interactive outdoor photo scavenger hunts across the historical core of Melaka (Jonker Street, Dutch Square, A Famosa, Jalan Tokong, and St. Paul's Hill).

---

## 📚 SDLC Documentation Suite

This project follows software development life cycle (SDLC) best practices. Detailed specifications and guides are available in the [`docs/`](file:///C:/Users/User/Projects/heritage-hunt/docs) directory:

1. **[Product Requirements Document (PRD)](file:///C:/Users/User/Projects/heritage-hunt/docs/PRD.md):** User personas, functional requirements, game rules, and scope.
2. **[System Architecture Document (SAD)](file:///C:/Users/User/Projects/heritage-hunt/docs/ARCHITECTURE.md):** System context, tech stack tradeoffs, Firestore data schema, and Base64 compression pipeline.
3. **[Implementation Plan & Roadmap](file:///C:/Users/User/Projects/heritage-hunt/docs/IMPLEMENTATION_PLAN.md):** Phased sprint breakdown, work breakdown structure (WBS), and acceptance criteria.
4. **[Security & Deployment Guide](file:///C:/Users/User/Projects/heritage-hunt/docs/SECURITY_AND_DEPLOYMENT.md):** Firestore security rules, environment variables, and Vercel CI/CD setup.

---

## 🛠️ Tech Stack

* **Frontend:** React 19, TypeScript, Vite 8, Tailwind CSS v4, Lucide Icons
* **Mapping Engine:** Leaflet, `react-leaflet`, OpenStreetMap
* **Backend & Realtime:** Firebase (Cloud Firestore with real-time `onSnapshot` listeners & Anonymous Auth)
* **Photo Storage & NAS Pipeline:** Xinya / UTBA NAS integration with uncompressed original upload (`/api/upload-photo`), secure SSRF-protected download proxy (`/api/download-photo`), and automatic client-side fallback compression (<= 150KB Base64 via `browser-image-compression`)
* **Metadata & GPS:** `exifr` (EXIF GPS extractor)
* **Hosting & CI/CD:** Vercel (Hobby Tier with global CDN and serverless API endpoints)

---

## 🚀 Quick Start for Local Development

### Prerequisites
* **Node.js:** v20+ LTS (Tested on v24 LTS)
* **npm:** v10+

### Installation & Run
```powershell
# Navigate to project directory
cd C:\Users\User\Projects\heritage-hunt

# Install dependencies (already installed)
npm install

# Start local development server
npm run dev
```

Visit `http://localhost:5173` in your browser.

---

## 📸 High-Resolution NAS Photo Upload & Security

The app supports uploading full uncompressed original camera photos directly to the organization's NAS via the Xinya API:

1. **Uncompressed High-Res Uploads:** Photos captured by players retain full camera quality and upload through `/api/upload-photo` directly to the NAS.
2. **One-Click Downloads:** Game Masters and players can download crystal-clear original photos directly from the Image Lightbox via the secure download proxy.
3. **Resilient Offline Fallback:** If NAS credentials are not configured or mobile connection drops, the app automatically falls back to client-compressed Base64 in Firestore without interrupting gameplay.
4. **Security Guardrails:**
   * Magic byte verification (strictly accepts JPEG, PNG, WebP, HEIC; blocks SVG and script payloads).
   * 20 MB payload ceiling.
   * Server-controlled UUID filenames to prevent path traversal and file overwrites.
   * SSRF protection on proxy downloads.

### Running Security & Integration Tests
```powershell
node scripts/test_nas_security_and_upload.mjs
```

---

## 📱 User Roles & Access

* **Player View (`/play`):** Scan team QR code or enter 4-digit PIN. View interactive map, hunt landmarks, take selfies, and track live ranking.
* **Game Master View (`/gm`):** Access the live War Room with the master passcode (`melaka2026`). Monitor moving teams on radar, review incoming selfies with 1-click approvals, and manage clues.
