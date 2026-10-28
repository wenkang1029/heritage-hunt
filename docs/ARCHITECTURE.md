# System Architecture Document (SAD)
## Project: Melaka Heritage Photo Hunt (`heritage-hunt`)

---

## 1. System Overview & Data Flow

```mermaid
flowchart TD
    subgraph Clients["Frontend Clients (Vercel CDN)"]
        PlayerApp["Mobile Player App (/play)\nReact + Vite + Leaflet"]
        GMApp["GM War Room (/gm)\nReact + Vite + Leaflet"]
    end

    subgraph FirebaseBaaS["Backend Services (Firebase Spark Plan)"]
        Auth["Firebase Auth\n(Anonymous / PIN-based)"]
        Firestore["Cloud Firestore\n(Realtime Database)"]
    end

    PlayerApp -- "1. Join via PIN & Anonymous Auth" --> Auth
    GMApp -- "GM Master Login" --> Auth

    PlayerApp -- "2. Throttled GPS Watch (every 15s)" --> Firestore
    PlayerApp -- "3. Upload Compressed Selfie (Base64)" --> Firestore

    Firestore -- "4. Realtime onSnapshot Push" --> GMApp
    GMApp -- "5. 1-Click Approve / Reject" --> Firestore

    Firestore -- "6. Realtime Score & State Sync" --> PlayerApp
```

---

## 2. Tech Stack Rationale

| Tier | Technology | Technical Rationale |
| :--- | :--- | :--- |
| **Language** | **TypeScript 5.x** | End-to-end type safety for Game, Team, Clue, Submission, and Geo coordinate interfaces. |
| **Frontend Framework** | **React 19 + Vite 8** | Single Page Application (SPA) architecture with zero Server-Side Rendering (SSR) headaches for Leaflet. Sub-second build times. |
| **UI & Styling** | **Tailwind CSS v4** | Utility-first styling with high-contrast color badges for team identities and mobile-first touch optimization. |
| **Mapping Engine** | **Leaflet 1.9 + OpenStreetMap** | 100% open-source and free mapping. Supports custom SVG colored divIcon markers, zone polygons, and mobile touch pinch-zoom. |
| **Database & Realtime** | **Google Cloud Firestore** | Native `onSnapshot` real-time listeners for live review queues, leaderboard updates, and team radar locations. |
| **Authentication** | **Firebase Anonymous Auth** | Instant friction-free sign-in without passwords, emails, or OAuth redirects. |
| **Image Compression** | **`browser-image-compression`** | Compresses 10MB raw mobile photos to <= 150KB Base64 in the browser before network transmission. |
| **EXIF Parsing** | **`exifr`** | Client-side extraction of GPS Latitude & Longitude from GM clue photos for instant automated map pinning. |
| **Hosting & CI/CD** | **Vercel Hobby Tier** | Global CDN with Singapore edge nodes (`sin1`), automatic HTTPS (required for mobile GPS and camera APIs), and zero-configuration GitHub CI/CD. |

---

## 3. Firestore Data Schema & Collections Design

### Document Structure:

```text
📁 games (collection)
   └── 📄 {gameId}
         ├── name: string
         ├── status: "lobby" | "active" | "frozen" | "ended"
         ├── startTime: Timestamp | null
         ├── durationMinutes: number
         ├── passCode: string (GM password)
         ├── zones: Array<{ id: string, name: string, color: string, polygon: [number, number][] }>
         │
         ├── 📁 teams (sub-collection)
         │     └── 📄 {teamId}
         │           ├── name: string
         │           ├── pin: string (e.g. "4821")
         │           ├── color: string (e.g. "#EF4444")
         │           ├── score: number
         │           ├── completedClueIds: string[]
         │           ├── currentCoords: { lat: number, lng: number, updatedAt: Timestamp }
         │           └── lastActiveAt: Timestamp
         │
         ├── 📁 clues (sub-collection)
         │     └── 📄 {clueId}
         │           ├── title: string
         │           ├── zoneId: string
         │           ├── points: number
         │           ├── targetPhotoBase64: string (Compressed Base64 Data URL)
         │           ├── location: { lat: number, lng: number }
         │           ├── hint: string
         │           └── createdAt: Timestamp
         │
         └── 📁 submissions (sub-collection)
               └── 📄 {submissionId}
                     ├── teamId: string
                     ├── teamName: string
                     ├── teamColor: string
                     ├── clueId: string
                     ├── clueTitle: string
                     ├── selfieBase64: string (Compressed Base64 Data URL <= 150KB fallback)
                     ├── photoUrl?: string (High-resolution uncompressed photo URL from NAS)
                     ├── fileId?: number (xinya album_files.id)
                     ├── status: "pending" | "approved" | "rejected"
                     ├── rejectionReason?: string
                     ├── awardedPoints: number
                     ├── submittedAt: Timestamp
                     └── reviewedAt: Timestamp | null
```

---

## 4. Image Storage Architecture: Dual-Mode NAS & Firestore

The application implements a **Dual-Mode Image Pipeline** providing high visual fidelity while preserving 100% free hosting and offline resilience:

### A. Primary Mode: Uncompressed NAS Upload
1. **Full Photographic Quality:** Players capture photos using native camera resolution. The raw file is uploaded via `/api/upload-photo` directly to the organization's NAS through the Xinya API.
2. **Lightweight Document State:** Rather than stuffing large binaries into Firestore, Firestore documents store the resulting `photoUrl` (`https://utba.my/UTBA/media_file/NAS/UTBA/event_photo/...`) and `fileId`, keeping Firestore documents ultra-lightweight (< 2 KB).
3. **One-Click Uncropped Download:** GMs and players can inspect uncropped photos in the Image Lightbox and download the original file via `/api/download-photo` without cross-origin blocks.
4. **Strict Security Defenses:**
   * Magic bytes header inspection (JPEG, PNG, WebP, HEIC).
   * Stored XSS defense (SVG and script rejection).
   * 20 MB payload ceiling.
   * Server-controlled UUID filenames (eliminates file overwrites and path traversal).
   * SSRF protection on proxy downloads.

### B. Resilient Fallback Mode: Client-Side Base64 in Firestore
1. **Zero-Configuration Fallback:** If NAS credentials are not provided (e.g. initial demo testing) or mobile network connection drops in the field, the app automatically falls back to client-side compression (`<= 150 KB` Base64) saved into `selfieBase64`.
2. **Document Size Compliance:** Target compressed selfie size is ~100 KB – 150 KB, staying well below the 1 MB Firestore document limit.
3. **Continuous Gameplay:** Players never experience submission failures due to external storage downtime.

---

## 5. Map & Geolocation System

### A. Geolocation Polling & Throttling
```typescript
// Throttled Geolocation Hook Architecture
navigator.geolocation.watchPosition(
  (position) => {
    const now = Date.now();
    if (now - lastBroadcastTime > 15000) { // 15-second throttle
      updateTeamCoordinates(teamId, {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        updatedAt: new Date()
      });
      lastBroadcastTime = now;
    }
  },
  (error) => console.warn("GPS error:", error),
  { enableHighAccuracy: true, timeout: 10000, maximumAge: 10000 }
);
```

### B. Haversine Distance Calculation
Used to compute the physical distance between the player's live selfie location and the target clue coordinates:
$$d = 2R \cdot \arcsin\left(\sqrt{\sin^2\left(\frac{\Delta\phi}{2}\right) + \cos(\phi_1)\cos(\phi_2)\sin^2\left(\frac{\Delta\lambda}{2}\right)}\right)$$
This value is displayed in the GM review queue (e.g., *"Team was 14 meters away from target"*), helping the GM verify authenticity.
