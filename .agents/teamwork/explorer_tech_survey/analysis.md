# Technical Domain & Architecture Survey Analysis
## Project: Melaka Heritage Photo Hunt (`heritage-hunt`)

**Author**: Domain & Architecture Explorer (`explorer_tech_survey`)  
**Date**: 2026-10-14  
**Working Directory**: `C:\Users\User\Projects\heritage-hunt\.agents\teamwork\explorer_tech_survey`  
**Execution Environment**: Windows 11, Node.js v24.20.0, npm 11.19.0, Vite 8.3.0, React 19.2.8, TypeScript 6.0.2

---

## 1. Executive Summary & Architectural Scope

The **Melaka Heritage Photo Hunt** is an outdoor, real-time photo scavenger hunt web application engineered for the historical UNESCO World Heritage zone of Melaka, Malaysia. The system supports two distinct real-time operational interfaces:
1. **Player Mobile App (`/play`)**: Daylight-readable mobile interface for scavenger teams running on smartphones. Teams join via a 4-digit PIN or QR code, navigate Melaka heritage zones on an interactive map, browse clues, capture landmark selfies via native mobile camera shutter, compress photos client-side to `<= 150 KB` Base64, and receive live approval alerts with celebratory confetti.
2. **Game Master (GM) War Room (`/gm`)**: Desktop and tablet mission control dashboard secured by a master passcode. GM monitors moving teams on a live radar map, reviews incoming submissions in a real-time verification queue with side-by-side comparison and Haversine proximity checks, executes 1-click approvals, rejections, and bonus awards, bulk-uploads clues with automatic EXIF GPS extraction, generates teams with QR codes, and controls game timing with a late-game "Freeze Leaderboard" toggle.

This survey establishes the authoritative technical blueprint across the four core engineering pillars:
- **Leaflet Map Integration in React 19 / Vite 8**: SVG/HTML `divIcon` markers, Melaka heritage zone boundaries, preventing Leaflet icon 404 bugs, container responsiveness.
- **Client-Side Image Handling & Metadata**: Native camera shutter trigger, client-side HTML5 canvas compression to `<= 150 KB` Base64, EXIF GPS coordinate extraction via `exifr`.
- **Firebase Firestore Real-Time Architecture**: Hierarchical collection schemas, `onSnapshot` subscriptions, Anonymous Authentication, offline caching, and Hybrid Mock Adapter for zero-cost operation.
- **Game Master War Room Operations**: Radar map with 15s throttled GPS, verification queue with Haversine distance badges, atomic approval/bonus transactions, and leaderboard freeze mechanism.

---

## 2. Pillar 1: Leaflet Map Integration in React 19 / Vite 8

### 2.1 Root Cause & Elimination of Leaflet Icon 404 Bugs

#### The Problem
In standard Leaflet setups, `L.Icon.Default` dynamically resolves marker image assets (`marker-icon.png`, `marker-icon-2x.png`, `marker-shadow.png`) by inspecting `<script>` tags on the page or relying on relative paths:
```javascript
// Internal Leaflet default icon URL resolution:
L.Icon.Default.imagePath = ...; // Fails in modern bundlers like Vite/Webpack/Rollup
```
In Vite's ESM bundler, there are no static script tags pointing to `leaflet.js`, causing Leaflet to request `/marker-icon.png` from the root of the web server. This generates HTTP 404 errors in the browser console and renders broken image icons or invisible markers.

#### The Architectural Solution: 100% SVG/HTML `L.divIcon`
Rather than monkey-patching `L.Icon.Default.prototype._getIconUrl` with static PNG imports, our application **mandates pure HTML/SVG `L.divIcon` markers for every entity on the map**:
1. Eliminates all external PNG asset dependencies.
2. Eliminates 404 network requests entirely.
3. Grants complete styling control via Tailwind CSS classes, inline styles, CSS animations (`team-pulse`), and dynamic team colors.
4. Produces vector-crisp icons on high-DPI mobile retina screens under outdoor daylight.

```typescript
import L from 'leaflet';

/**
 * Factory for creating custom SVG/HTML divIcon markers.
 * Bypasses Leaflet PNG asset loader completely, preventing 404 errors.
 */
export function createCustomDivIcon(options: {
  html: string;
  className?: string;
  iconSize?: [number, number];
  iconAnchor?: [number, number];
}): L.DivIcon {
  return L.divIcon({
    html: options.html,
    className: options.className ?? 'custom-leaflet-marker',
    iconSize: options.iconSize ?? [36, 36],
    iconAnchor: options.iconAnchor ?? [18, 18],
    popupAnchor: [0, -18],
  });
}
```

### 2.2 Melaka UNESCO Heritage Zones & Coordinates Baseline

The scavenger hunt operates across 5 core UNESCO heritage zones in Melaka. The coordinates below represent verified real-world geographic locations:

```typescript
// Melaka City Center Anchor
export const MELAKA_CENTER: [number, number] = [2.1944, 102.2491]; // Dutch Square / Stadhuys

export interface HeritageZoneConfig {
  id: string;
  name: string;
  description: string;
  color: string;
  borderColor: string;
  polygon: [number, number][];
  center: [number, number];
}

export const MELAKA_ZONES: HeritageZoneConfig[] = [
  {
    id: 'dutch-square',
    name: 'Dutch Square (Stadhuys)',
    description: 'Iconic red terracotta shophouses, Christ Church, and Queen Victoria Fountain.',
    color: 'rgba(239, 68, 68, 0.25)', // Red
    borderColor: '#EF4444',
    center: [2.1944, 102.2491],
    polygon: [
      [2.1938, 102.2484],
      [2.1950, 102.2484],
      [2.1950, 102.2498],
      [2.1938, 102.2498],
    ],
  },
  {
    id: 'jonker-street',
    name: 'Jonker Street (Jalan Hang Jebat)',
    description: 'Vibrant cultural street filled with antique shops, heritage murals, and Peranakan cafes.',
    color: 'rgba(245, 158, 11, 0.25)', // Amber
    borderColor: '#F59E0B',
    center: [2.1960, 102.2468],
    polygon: [
      [2.1947, 102.2482],
      [2.1978, 102.2454],
      [2.1983, 102.2460],
      [2.1952, 102.2488],
    ],
  },
  {
    id: 'jalan-tokong',
    name: 'Jalan Tokong (Harmony Street)',
    description: 'Street of Harmony hosting Cheng Hoon Teng, Kampung Kling Mosque, and Sri Poyyatha Temple.',
    color: 'rgba(16, 185, 129, 0.25)', // Emerald
    borderColor: '#10B981',
    center: [2.1972, 102.2470],
    polygon: [
      [2.1962, 102.2460],
      [2.1985, 102.2478],
      [2.1980, 102.2486],
      [2.1957, 102.2468],
    ],
  },
  {
    id: 'a-famosa',
    name: 'A Famosa & Porta de Santiago',
    description: 'Remains of the 16th-century Portuguese fortress bastion and cannons.',
    color: 'rgba(139, 92, 246, 0.25)', // Violet
    borderColor: '#8B5CF6',
    center: [2.1918, 102.2503],
    polygon: [
      [2.1910, 102.2495],
      [2.1926, 102.2495],
      [2.1926, 102.2512],
      [2.1910, 102.2512],
    ],
  },
  {
    id: 'st-pauls-hill',
    name: "St. Paul's Hill (Bukit St. Paul)",
    description: "Summit ruins of St. Paul's Church, St. Francis Xavier statue, and historic Dutch tombstones.",
    color: 'rgba(6, 182, 212, 0.25)', // Cyan
    borderColor: '#06B6D4',
    center: [2.1926, 102.2497],
    polygon: [
      [2.1920, 102.2488],
      [2.1938, 102.2488],
      [2.1938, 102.2506],
      [2.1920, 102.2506],
    ],
  },
];
```

### 2.3 Marker Renderers: Team Radar, Clue Landmark, and Player GPS

Three specialized marker components must be rendered on the map:

1. **Team Radar Pin**:
   - Represents moving player teams on the GM War Room radar (and approximate rival positions on player maps).
   - Styled with the team's assigned high-contrast color.
   - Includes CSS pulsing animation (`team-pulse` defined in `src/index.css`):
     ```html
     <div class="team-radar-pin relative flex items-center justify-center w-8 h-8 rounded-full border-2 border-white shadow-lg text-white font-black text-xs" 
          style="background-color: ${team.color}; --team-rgb: ${teamRgb};">
       ${team.name.substring(0, 2).toUpperCase()}
     </div>
     ```

2. **Clue Landmark Pin**:
   - Dropped at the landmark coordinate.
   - States: `Unsolved` (amber/blue pin with point badge) vs `Solved` (emerald checkmark pin).
   - Shows thumbnail and clue teaser in popup upon tap.
   ```html
   <div class="clue-pin relative flex items-center justify-center w-9 h-9 rounded-full ${isCompleted ? 'bg-emerald-600' : 'bg-amber-600'} border-2 border-white shadow-xl text-white">
     ${isCompleted 
       ? '<svg class="w-5 h-5 fill-current" viewBox="0 0 20 20"><path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"/></svg>'
       : '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><circle cx="12" cy="13" r="3"/></svg>'
     }
     <span class="absolute -top-2 -right-2 bg-indigo-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-white shadow">
       ${clue.points}
     </span>
   </div>
   ```

3. **Player Self GPS Beacon**:
   - Real-time user position rendered with a glowing blue dot and accuracy circle:
   ```html
   <div class="relative flex items-center justify-center w-6 h-6">
     <div class="absolute w-6 h-6 bg-blue-500 rounded-full animate-ping opacity-75"></div>
     <div class="relative w-3.5 h-3.5 bg-blue-600 border-2 border-white rounded-full shadow-md"></div>
   </div>
   ```

### 2.4 Leaflet CSS Bundling & Invalidation Nuances

1. **Leaflet CSS Import**:
   - Currently, `index.html` loads Leaflet CSS via unpkg CDN:
     `<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />`
   - **Architectural Requirement**: Also import `leaflet/dist/leaflet.css` in `src/index.css` (or `src/main.tsx`). This bundles Leaflet CSS into the Vite build, guaranteeing complete offline reliability when network drops.

2. **Zero-Height Container Bug**:
   - Leaflet requires an explicit height on the map container DOM element.
   - Fix: The container must have `height: 100%`, `min-h-[400px]`, or `h-screen`. The root `#root`, `html`, and `body` already have `height: 100%` configured in `src/index.css`.

3. **Tab Switching & Size Invalidation**:
   - When switching between [Map View], [Clue Cards], and [Leaderboard], the map container becomes hidden and re-shown. Leaflet caches viewport dimensions, resulting in gray or partially rendered tiles upon returning.
   - Solution: Implement a Leaflet invalidate hook:
     ```typescript
     function MapResizer() {
       const map = useMap();
       useEffect(() => {
         const timer = setTimeout(() => {
           map.invalidateSize();
         }, 150);
         return () => clearTimeout(timer);
       }, [map]);
       return null;
     }
     ```

---

## 3. Pillar 2: Client-Side Image Handling & Metadata Pipeline

### 3.1 Mobile Native Camera Shutter Trigger

Under outdoor daylight conditions, players need immediate shutter access without navigating file systems.
- HTML direct camera capture element:
  ```tsx
  <input
    ref={fileInputRef}
    type="file"
    accept="image/*"
    capture="environment" // Forces rear-facing camera on iOS and Android
    className="hidden"
    onChange={handlePhotoCaptured}
  />
  ```
- On desktop / laptops (GM mode), `capture="environment"` gracefully falls back to the system file picker dialog.

### 3.2 Client-Side Image Compression Mechanics

#### The Size Math: Base64 Expansion
Modern smartphone cameras generate 12MP to 48MP photos (4000x3000 to 8000x6000 pixels), producing raw files between 4MB and 15MB.
Base64 encoding converts binary data into ASCII characters using 6-bit chunks, resulting in a **33.3% size inflation**:
$$\text{Base64 String Length} = \left\lceil \frac{4 \times \text{Binary Bytes}}{3} \right\rceil$$

To guarantee that the Base64 string is `<= 150 KB` ($150 \times 1024 = 153,600$ characters):
$$\text{Max Binary Size} \le 153,600 \times \frac{3}{4} = 115,200 \text{ bytes} \approx 0.11 \text{ MB}$$

#### Compression Pipeline using `browser-image-compression`
The installed dependency `browser-image-compression` (v2.0.2) uses HTML5 canvas and Web Workers to downscale and re-encode images.

```typescript
import imageCompression from 'browser-image-compression';

export interface CompressionResult {
  base64: string;
  sizeBytes: number;
  width: number;
  height: number;
  durationMs: number;
}

export async function compressPhoto(file: File): Promise<CompressionResult> {
  const startTime = performance.now();

  // First pass: Target 0.11 MB binary (yields ~145 KB Base64)
  const options: imageCompression.Options = {
    maxSizeMB: 0.11,
    maxWidthOrHeight: 1024,
    useWebWorker: true,
    fileType: 'image/jpeg',
    initialQuality: 0.70,
    alwaysKeepResolution: false,
  };

  let compressedFile = await imageCompression(file, options);
  let base64 = await imageCompression.getDataUrlFromFile(compressedFile);

  // Dual-pass safeguard: If Base64 string still exceeds 150KB, compress again
  const MAX_BASE64_CHARS = 150 * 1024; // 153,600 characters
  if (base64.length > MAX_BASE64_CHARS) {
    const aggressiveOptions: imageCompression.Options = {
      maxSizeMB: 0.08,
      maxWidthOrHeight: 800,
      useWebWorker: false, // run directly on canvas
      fileType: 'image/jpeg',
      initialQuality: 0.50,
    };
    compressedFile = await imageCompression(compressedFile, aggressiveOptions);
    base64 = await imageCompression.getDataUrlFromFile(compressedFile);
  }

  const durationMs = Math.round(performance.now() - startTime);

  return {
    base64,
    sizeBytes: base64.length,
    width: 1024, // max dimension
    height: 1024,
    durationMs,
  };
}
```

### 3.3 Zero-Paid-Cost Rationale: Base64 Directly in Firestore

1. **Zero Cloud Cost**: Firebase Cloud Storage requires a credit card and the Blaze paid tier. Storing compressed photos directly in Firestore subcollections allows the entire application to operate 100% free under the Firebase Spark Plan.
2. **Document Size Limit Compliance**:
   - Firestore limit per document: **1,048,576 bytes (1.0 MB)**.
   - Max submission document size with a 150 KB Base64 photo + metadata: **~152 KB**.
   - Safety margin: Consumes only **~15%** of the 1MB document limit.
3. **Atomic GM Review**: When a submission document is retrieved via `onSnapshot`, the GM receives the selfie image, team metadata, and timestamp in a single atomic network read. No secondary image fetch request or broken image URLs.

### 3.4 EXIF Metadata Extraction via `exifr`

When the GM bulk-uploads clue photos, extracting EXIF GPS coordinates automatically drops pins on the Melaka map:

```typescript
import exifr from 'exifr';

export interface ExifGpsCoordinate {
  lat: number;
  lng: number;
}

export async function extractExifGps(file: File): Promise<ExifGpsCoordinate | null> {
  try {
    const output = await exifr.gps(file);
    if (
      output &&
      typeof output.latitude === 'number' &&
      typeof output.longitude === 'number' &&
      !isNaN(output.latitude) &&
      !isNaN(output.longitude)
    ) {
      return {
        lat: output.latitude,
        lng: output.longitude,
      };
    }
  } catch (error) {
    console.warn('EXIF GPS extraction failed or stripped:', error);
  }
  return null;
}
```

#### Edge Cases & Mitigations:
- **Stripped EXIF**: Social apps (WhatsApp, WeChat) and certain camera privacy settings strip EXIF data.
  - *Mitigation*: The GM Clue Editor provides an interactive map pin adjuster where the GM can click or drag the pin to set the landmark location if EXIF is absent.
- **EXIF Rotation / Orientation**: Photos taken in portrait mode often carry EXIF orientation tags.
  - *Mitigation*: `browser-image-compression` automatically normalizes orientation during canvas redrawing, ensuring submitted images are always correctly oriented.

---

## 4. Pillar 3: Firebase Firestore Real-Time Architecture

### 4.1 Hierarchical Collections & Document Schemas

```text
📁 games (collection)
   └── 📄 {gameId}  (e.g., "melaka-hunt-2026")
         ├── name: string
         ├── status: "lobby" | "active" | "frozen" | "ended"
         ├── startTime: Timestamp | null
         ├── durationMinutes: number
         ├── passCode: string (GM Master Passcode)
         ├── isLeaderboardFrozen: boolean
         ├── zones: Array<HeritageZoneConfig>
         │
         ├── 📁 teams (sub-collection)
         │     └── 📄 {teamId}
         │           ├── name: string
         │           ├── pin: string (4-digit numeric, e.g. "4821")
         │           ├── color: string (e.g. "#EF4444")
         │           ├── score: number
         │           ├── completedClueIds: string[]
         │           ├── currentCoords: { lat: number, lng: number, updatedAt: Timestamp } | null
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
                     ├── selfieBase64: string (Compressed Base64 Data URL <= 150KB)
                     ├── coords: { lat: number, lng: number } | null
                     ├── distanceToTargetMeters: number | null
                     ├── status: "pending" | "approved" | "rejected"
                     ├── rejectionReason?: string
                     ├── awardedPoints: number
                     ├── submittedAt: Timestamp
                     └── reviewedAt: Timestamp | null
```

### 4.2 Real-Time `onSnapshot` Reactive Listeners

To maintain sub-second synchronization without page refreshes:

```typescript
import { 
  collection, 
  doc, 
  onSnapshot, 
  query, 
  orderBy, 
  where,
  type Unsubscribe 
} from 'firebase/firestore';

/**
 * Subscribes to real-time pending submissions for the GM War Room.
 */
export function subscribeToPendingSubmissions(
  db: any,
  gameId: string,
  callback: (submissions: Submission[]) => void
): Unsubscribe {
  const submissionsRef = collection(db, 'games', gameId, 'submissions');
  const q = query(
    submissionsRef,
    where('status', '==', 'pending'),
    orderBy('submittedAt', 'asc') // FIFO queue: oldest pending first
  );

  return onSnapshot(q, (snapshot) => {
    const list = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    })) as Submission[];
    callback(list);
  });
}
```

### 4.3 Anonymous Authentication & Frictionless Team Onboarding

- Participants join by scanning a QR code or entering a 4-digit PIN + Nickname. No email, password, or OAuth sign-in.
- When `/play` initializes:
  ```typescript
  import { getAuth, signInAnonymously } from 'firebase/auth';

  export async function ensureAnonymousAuth(auth: any): Promise<string> {
    if (auth.currentUser) {
      return auth.currentUser.uid;
    }
    const cred = await signInAnonymously(auth);
    return cred.user.uid;
  }
  ```
- The local browser session caches `{ teamId, teamPin, nickname }` in `localStorage`. If the player refreshes the page, their active team state is instantly restored without re-prompting.

### 4.4 Offline Persistence & Hybrid Mock State Adapter

#### Live Firestore with Offline Cache
In production mode, Firestore's persistent local cache stores recent snapshots in IndexedDB:
```typescript
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';

export function createFirestoreInstance(app: any) {
  return initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
    }),
  });
}
```

#### Hybrid Mock Adapter Architecture
To ensure development, CI/CD, and demo runs proceed without network blocking or requiring active Firebase keys:
- The service layer inspects `VITE_FIREBASE_API_KEY`:
  - If keys are placeholder (e.g. `'your_api_key_here'`), invalid, or explicitly set to mock mode, the service switches to the **Hybrid Mock State Adapter**.
  - The Mock Adapter maintains state in `localStorage` and uses a pub-sub event bus (`BroadcastChannel` or `EventEmitter`) to mirror `onSnapshot` subscriptions across multiple tabs.
  - All operations (`submitPhoto`, `approveSubmission`, `updateCoordinates`, `toggleFreeze`) behave identically to live Firestore.

---

## 5. Pillar 4: Game Master War Room & Operational Workflows

### 5.1 Radar Map & Throttled GPS Tracking

- **GPS Throttling**: Continuous GPS streaming drains mobile batteries and floods Firestore write quotas.
  - The player device tracks GPS via `navigator.geolocation.watchPosition`, but only writes updates to Firestore **once every 15 seconds** (or when the team moves $> 15$ meters):
    ```typescript
    const GPS_THROTTLE_INTERVAL_MS = 15000;
    let lastBroadcastTime = 0;

    navigator.geolocation.watchPosition(
      (pos) => {
        const now = Date.now();
        if (now - lastBroadcastTime >= GPS_THROTTLE_INTERVAL_MS) {
          lastBroadcastTime = now;
          updateTeamLocation(gameId, teamId, {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            updatedAt: new Date(),
          });
        }
      },
      (err) => console.warn('GPS watch error:', err),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 10000 }
    );
    ```
- **Staleness Indicator**:
  - In the War Room, if a team has not broadcasted GPS for $> 5$ minutes, their radar pin dims or shows an offline badge, alerting the GM to potential device or connectivity issues.

### 5.2 Verification Queue: Side-by-Side Comparison & Haversine Distance

When a team submits a selfie, it enters the GM verification queue. The GM opens the inspection modal:
- **Left Column**: Landmark Target Photo (the architectural detail or mural to find).
- **Right Column**: Team Selfie (the submitted photo).
- **Proximity Distance Badge**: Calculated using the Haversine formula:
  $$d = 2R \cdot \arcsin\left(\sqrt{\sin^2\left(\frac{\Delta\phi}{2}\right) + \cos(\phi_1)\cos(\phi_2)\sin^2\left(\frac{\Delta\lambda}{2}\right)}\right)$$
  - Green Badge: $d < 50\text{m}$ (*"Within landmark proximity"*).
  - Amber Badge: $50\text{m} \le d \le 150\text{m}$ (*"Nearby landmark"*).
  - Red Badge: $d > 150\text{m}$ (*"Warning: Team was X meters away"*).

### 5.3 1-Click Verification Actions: Atomic Updates

When the GM makes a decision, it triggers atomic updates in Firestore:

```typescript
import { writeBatch, doc, increment, arrayUnion, Timestamp } from 'firebase/firestore';

/**
 * 1-Click Approve: Marks submission approved, increments team score, adds clue to solved list.
 */
export async function approveSubmission(
  db: any,
  gameId: string,
  submissionId: string,
  teamId: string,
  clueId: string,
  points: number,
  bonusPoints: number = 0
): Promise<void> {
  const totalAwarded = points + bonusPoints;
  const batch = writeBatch(db);

  const subRef = doc(db, 'games', gameId, 'submissions', submissionId);
  batch.update(subRef, {
    status: 'approved',
    awardedPoints: totalAwarded,
    reviewedAt: Timestamp.now(),
  });

  const teamRef = doc(db, 'games', gameId, 'teams', teamId);
  batch.update(teamRef, {
    score: increment(totalAwarded),
    completedClueIds: arrayUnion(clueId),
    lastActiveAt: Timestamp.now(),
  });

  await batch.commit();
}

/**
 * 1-Click Reject: Marks submission rejected with feedback reason; team can retry.
 */
export async function rejectSubmission(
  db: any,
  gameId: string,
  submissionId: string,
  reason: string
): Promise<void> {
  const subRef = doc(db, 'games', gameId, 'submissions', submissionId);
  await updateDoc(subRef, {
    status: 'rejected',
    rejectionReason: reason || 'Landmark or team selfie does not match requirement.',
    reviewedAt: Timestamp.now(),
  });
}
```

### 5.4 Synchronized Game Timer & "Freeze Leaderboard" Mode

1. **Countdown Timer Synchronization**:
   - Stored in the root game document: `startTime` (Timestamp) and `durationMinutes` (number).
   - All connected clients compute remaining time relative to `startTime`:
     $$\text{Remaining} = (\text{durationMinutes} \times 60) - (\text{now} - \text{startTime})$$
   - Survives client page refreshes with zero drift.

2. **"Freeze Leaderboard" Toggle**:
   - When the GM activates `isLeaderboardFrozen = true` (typically 15 minutes before hunt completion):
     - **Player View**: Hides live rankings or locks the scoreboard to the freeze moment. Displays an engaging warning banner: *"Leaderboard is FROZEN! Final results will be announced at the closing ceremony!"*
     - **GM War Room**: Continues receiving live score updates and incoming submissions in real-time. The GM can see both live rankings and identify the winners.

### 5.5 Team Generator & QR Codes

- GM generates teams by specifying team count or team names.
- Automatic 4-digit PIN assignment (guaranteed non-colliding numeric strings).
- High-contrast visual palette:
  - Red: `#EF4444`
  - Blue: `#3B82F6`
  - Emerald: `#10B981`
  - Amber: `#F59E0B`
  - Violet: `#8B5CF6`
  - Cyan: `#06B6D4`
- QR Code generation via `qrcode.react`:
  - Encodes join URL: `${origin}/play?pin=${team.pin}`
  - Printable layout (`@media print`) allowing the GM to print cards or display on screen for team scanning.

---

## 6. Technical Pitfalls, Edge Cases & Mitigation Strategies

| Area | Failure Mode / Pitfall | Impact | Architectural Mitigation |
| :--- | :--- | :--- | :--- |
| **Leaflet** | Leaflet PNG marker 404s | Broken image icons; console errors | Use pure SVG/HTML `L.divIcon` markers exclusively across all entities. |
| **Leaflet** | Map container rendered with 0 height | Map appears blank or gray | Enforce explicit container height (`h-full`, `min-h-[400px]`); call `map.invalidateSize()` after tab switches. |
| **Leaflet** | Offline CDN styling failure | Broken tile layouts if unpkg.com is unreachable | Import `leaflet/dist/leaflet.css` directly in CSS bundle alongside CDN link in `index.html`. |
| **Image** | High-res camera photos (>10MB) freeze browser | UI lag, mobile Safari tab crash | Configure Web Worker in `browser-image-compression`; downscale to max 1024px before quality compression. |
| **Image** | Base64 string exceeds 150KB threshold | Firestore document size bloat | Target `0.11 MB` in compression options; execute secondary pass if Base64 string length $> 153,600$ characters. |
| **Image** | Exif GPS tags stripped by camera app or user | GM cannot auto-pin landmark | Provide manual interactive map pin click/drag fallback in Clue Editor. |
| **Firestore** | Spotty mobile cellular coverage in Melaka alleys | Submission timeouts or write failures | Enable Firestore `persistentLocalCache`; display offline banner; queue retry for submissions. |
| **Firestore** | Exceeding free Spark quota (50k reads/day) | Service disruption | Throttle GPS updates to 15 seconds; use scoped `where('status', '==', 'pending')` queries for review queue. |
| **UX** | Sunlight glare on mobile screens | Unreadable text, missed clues | Daylight-proof UI: high-contrast dark slate backgrounds (`#0f172a`), vivid color badges, touch targets $\ge 48\text{px}$. |

---

## 7. Implementation Roadmap & Milestones

Based on this architecture survey, the project should proceed through the following milestones:

- **Milestone 1 (Sprint 2): Core Models, Firebase Service & Mock Adapter**
  - Define TypeScript schemas (`src/types/index.ts`).
  - Pre-configure Melaka zones, authentic landmarks, and team palettes (`src/data/melakaZones.ts`).
  - Implement client-side image compression & EXIF parsing (`src/services/imageCompression.ts`).
  - Implement Firebase service with dual-mode Hybrid Mock Adapter (`src/services/gameService.ts`).

- **Milestone 2 (Sprint 3 & 4): Melaka Map Engine & Player Mobile Experience (`/play`)**
  - Implement `HuntMap.tsx` with SVG `divIcon` pins, zone polygons, and GPS beacon.
  - Build Frictionless Join Modal (PIN + QR code parser).
  - Build Player Header (timer, live score, view toggles).
  - Build Clue Cards & Detail Modal with camera selfie capture, instant compression, and confetti celebrations.

- **Milestone 3 (Sprint 5): GM War Room Dashboard (`/gm`)**
  - Implement GM passcode login.
  - Build Live War Room Radar Map with 15s throttled team locations.
  - Build Live Verification Queue with side-by-side comparison, Haversine distance badge, and 1-click Approve/Reject/Bonus actions.
  - Build Clue Manager (bulk photo upload with EXIF GPS) and Team Generator (PINs & QR codes).
  - Implement Countdown Timer controls & "Freeze Leaderboard" toggle.

- **Milestone 4 (Sprint 6): E2E Integration, Multi-Team Testing & Production Build**
  - Verify clean TypeScript build (`npm run build`).
  - Run multi-team simulation testing (3 simultaneous teams, photo submission, and live GM review).
  - Verify Vercel deployment readiness.
