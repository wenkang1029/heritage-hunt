# Specification Survey & Feature Inventory Analysis

**Project**: Melaka Heritage Photo Hunt (`heritage-hunt`)  
**Document**: Authoritative Specification Mining & Requirements Catalog  
**Author**: Specification Miner (Survey Phase)  
**Date**: 2026-10-14  
**Integrity Mode**: Development / Strict SDLC  

---

## 1. Executive Summary & Specification Hierarchy

Melaka Heritage Photo Hunt is a mobile-first, real-time web application engineered for an interactive outdoor photo scavenger hunt across the UNESCO World Heritage historical core of Melaka, Malaysia. The system delivers two distinct operational surfaces:
1. **Player Mobile App (`/play`)**: Daylight-readable, mobile-optimized Progressive Web App interface enabling teams to join frictionlessly, navigate Melaka landmarks on an interactive map, browse clues, snap selfies with native camera, compress photos in-browser to `<= 150 KB` Base64, and receive live approval alerts with celebratory confetti.
2. **Game Master (GM) War Room (`/gm`)**: Desktop/tablet situational dashboard secured by a master passcode, featuring a live radar map of moving teams, a real-time verification queue for side-by-side photo review (Target Clue vs Team Selfie) with Haversine distance proximity checks, 1-click approvals/rejections/bonuses, bulk clue creation with client-side EXIF GPS extraction, team PIN/QR generator, and real-time leaderboard controls with a suspense "Freeze" toggle.

### Authoritative Specification Sources
The requirements and specifications are synthesized from the following authoritative project artifacts:
- **`ORIGINAL_REQUEST.md`**: Core requirements R1 (Player Experience), R2 (GM War Room), R3 (Real-Time Firestore & Zero-Paid-Cost Storage), and foundational acceptance criteria.
- **`docs/PRD.md`**: Product vision, user personas, UNESCO Melaka geographic scope, functional requirements (FR-1 to FR-6), non-functional requirements (NFR-1 to NFR-4).
- **`docs/ARCHITECTURE.md`**: Technical architecture, tech stack rationale, Firestore document & subcollection schemas, Base64 storage architecture, GPS throttling hook, and Haversine distance equation.
- **`docs/IMPLEMENTATION_PLAN.md`**: 6-sprint roadmap, Work Breakdown Structure (Tasks 1.1 through 6.3), pre-configured Melaka zones, team color palettes, and hybrid mock adapter architecture.
- **`docs/SECURITY_AND_DEPLOYMENT.md`**: Firestore security rules (document limits, auth conditions, Base64 string length limits), environment variables (`VITE_FIREBASE_*`, `VITE_GM_PASSCODE`), and Vercel Singapore edge deployment.
- **`.agent/rules/vibe-coding.md`**: Mobile sunshine-proof design (touch targets `>= 48px`, high contrast), zero cloud costs, strict TypeScript typing (no `any`), and mandatory custom SVG `L.divIcon` pins.

---

## 2. Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | Auth & Onboarding | Frictionless Team Join via PIN | Team members enter a 4-digit numeric PIN and a team nickname without passwords or emails. | 4-digit PIN string (e.g. "4821"), nickname string | Authenticated Anonymous Firebase session, Team state binding | Reject invalid/non-existent PIN with inline error message; highlight empty nickname | PRD FR-1.2, Plan Task 4.1 |
| 2 | Auth & Onboarding | Direct QR Code Onboarding | Automatic PIN extraction from query parameters on scan (`/play?pin=XXXX`). | URL query parameter `pin` | Pre-filled PIN, direct prompt for nickname | Fallback to manual PIN entry if query parameter is malformed or invalid | PRD FR-1.2, Plan Task 4.1 |
| 3 | Auth & Onboarding | GM Passcode Authentication | War Room dashboard access gated by a master passcode (`VITE_GM_PASSCODE`). | Passcode string (default: `melaka2026`) | Unlocks GM dashboard, sets GM session state | "Invalid Passcode" toast/banner, access blocked | PRD FR-1.1, Arch §2, Sec §2 |
| 4 | Auth & Onboarding | Anonymous Firebase Authentication | Behind-the-scenes auth token generation via `signInAnonymously(auth)` ensuring unique UID for Firestore security compliance. | None (browser-initiated) | User credential with unique `uid` | Fallback to Mock Auth Adapter if Firebase credentials missing or offline | PRD FR-1.3, Arch §2, Sec §1 |
| 5 | Game Lifecycle | Game State Management | Centralized game state transitions: `lobby` ➔ `active` ➔ `frozen` ➔ `ended`. | GM control trigger buttons | State updated in `/games/{gameId}`, broadcasted via `onSnapshot` | Reject invalid state transitions; disable clue submission when ended/lobby | PRD FR-2.1, Arch §3 |
| 6 | Game Lifecycle | Synchronized Countdown Timer | Synced countdown based on `startTime` and `durationMinutes`, keeping all clients aligned. | Server `startTime` Timestamp, `durationMinutes` | Formatted remaining time `MM:SS` on Player and GM headers | Graceful display of "00:00 - Hunt Ended" when elapsed; handles clock drift | PRD FR-2.2, Plan Task 4.2 |
| 7 | Game Lifecycle | Leaderboard Freeze Mode | Suspense toggle for late-game. Player screens freeze leaderboard rankings/scores while GM view continues live updates. | GM toggle button in War Room | `status: "frozen"`, player UI shows "Leaderboard Frozen" badge | Prevents player de-synchronization; GM continues receiving live data | PRD FR-2.3, Plan Task 5.1 |
| 8 | Geography & Zones | Pre-configured Melaka Zones | Polygons covering Dutch Square, Jonker Street, Jalan Tokong, A Famosa, and St. Paul's Hill with custom color boundaries. | Coordinate polygon arrays `[lat, lng][]` | Rendered polygon overlays on Leaflet map | Graceful fallback if coordinates out of bounds; transparent fill + high-contrast stroke | PRD §3, Plan Task 3.1 |
| 9 | Geography & Zones | Interactive Clue Map Markers | Clue markers dropped at landmark coordinates with customized SVG `L.divIcon` thumbnails. | Landmark `lat`, `lng`, points, status | Interactive map pin; popup shows landmark teaser and points | Fallback default SVG icon if image fails; no broken image URLs | PRD FR-6.2, Vibe §2 |
| 10 | Geolocation | Throttled Player GPS Tracking | Continuous tracking via `navigator.geolocation.watchPosition` with strict 15-second broadcast throttle. | Device GPS stream (`coords.latitude`, `coords.longitude`) | Throttled writes to `/games/{gameId}/teams/{teamId}/currentCoords` | Warning logged on permission denied; fallback to last known coords; GPS status badge | PRD FR-6.3/6.4, Arch §5A |
| 11 | Geolocation | Live War Room Team Radar | GM map displaying live positions of all active teams in assigned colors with animated pulse effect (`team-pulse`). | Team coordinates stream via `onSnapshot` | Moving colored radar pins with team names and pulsing radar halos | Grey out / fade marker if `lastActiveAt` > 5 minutes stale | PRD FR-6.5, Arch §5, CSS index |
| 12 | Geolocation | Rival Team Proximity Radar | Player map displaying approximate/throttled locations of rival teams to spur outdoor competition. | Rival team coordinates | Colored pins with approximate positions | Throttled and jittered to prevent physical griefing; updates every 15-30s | PRD Persona B, FR-6.5 |
| 13 | Clue Management | Clue Browser (Card & Map Views) | Mobile player card view and map view of architectural details, cropped teasers, points, and zone tags. | Clues subcollection | Filterable clue cards with "Solved" / "Available" status badges | Clue cards disable submission button if already completed | PRD Persona B, Plan Task 4.3 |
| 14 | Clue Management | Hint Accordion / Toggle | Expandable clue hint providing textual assistance for tricky architectural details. | Clue `hint` field | Collapsible text drawer | Shows "No hint available for this landmark" if string empty | PRD FR-3.2, Plan Task 4.3 |
| 15 | Clue Management | Bulk Photo Upload & EXIF Extraction | GM uploads batch of landmark photos; system extracts GPS latitude/longitude via `exifr` and creates draft pins. | Raw Image Files (`.jpg`, `.jpeg`) | Clue drafts populated with coordinates, ready for title/points input | If photo lacks EXIF GPS tags, prompts GM to manually set or drag pin on map | PRD FR-3.3, Arch §2, Plan 5.3 |
| 16 | Clue Management | Interactive Landmark Pin Adjuster | GM can adjust landmark pin locations via drag-and-drop on the Leaflet map. | Map drag event `lat`, `lng` | Updates draft/clue `location` field | Snaps to Melaka boundary; prevents coordinates outside operational zone | Plan Task 5.3 |
| 17 | Camera & Upload | Native Mobile Camera Shutter | Native camera shutter launch (`accept="image/*" capture="environment"`). | Shutter press on mobile device | Raw captured `File` object | Fallback to file picker if camera access denied or unsupported on desktop | PRD FR-4.1, Plan Task 4.4 |
| 18 | Image Processing | In-Browser Image Compression | Compresses high-res (5MB-15MB) mobile photos down to `<= 150 KB` (max 1024px, 65% quality) via `browser-image-compression`. | Raw Image File | Compressed Base64 Data URL string (`<= 150 KB`) | If compression fails, attempts secondary pass with reduced quality (50%); error toast on corrupt file | PRD FR-4.2, Arch §4, Plan 2.3 |
| 19 | Storage | Direct Firestore Base64 Storage | Compressed Base64 stored directly in Firestore document field `selfieBase64` to guarantee zero hosting fees. | Base64 string | Created document in `/submissions` subcollection | Security rule rejects payloads `>= 300,000` chars; UI alerts if size threshold exceeded | PRD FR-4.3, Arch §4, Sec §1 |
| 20 | Submissions | Duplicate Submission Prevention | Prevents teams from submitting multiple entries for a clue they have already solved and gotten approved. | Team `completedClueIds` array | Blocks upload trigger, marks clue "Completed" | Displays warning modal "Team has already completed this clue" | PRD FR-4.4 |
| 21 | Verification Queue | Real-Time GM Review Queue | Live queue in GM War Room receiving new submissions instantly via `onSnapshot` without page refresh. | Submissions subcollection `status: "pending"` | Sorted list of pending reviews with badges and timestamps | Live counter updates; audio/visual indicator when new submission arrives | PRD FR-5.1, Arch §1 |
| 22 | Verification Queue | Side-by-Side Photo Comparison | Modal displaying GM Target Clue Photo side-by-side with Team Selfie for visual verification. | Clue `targetPhotoBase64`, Submission `selfieBase64` | Side-by-side high-contrast comparison view | Image loading skeleton; zoom modal on tap for inspecting fine details | PRD FR-5.2, Plan Task 5.2 |
| 23 | Verification Queue | Haversine Proximity Check | Calculates distance (in meters) between player's selfie capture GPS and target landmark coordinates. | Submission GPS coords, Landmark GPS coords | Display badge: *"Team was X meters away from target"* | If submission GPS missing, display *"Location unavailable (Manual GM verification required)"* | Arch §5B, Plan Task 5.2 |
| 24 | Verification Queue | 1-Click Submission Approval | GM clicks `Approve (+Points)`. Updates submission `status: "approved"`, increments team score, adds clue to `completedClueIds`. | Submission ID, Clue points | Atomically updates submission, team score, and team completed list | Atomically rolled back if batch write fails; notifies GM of network error | PRD FR-5.3, Plan Task 5.2 |
| 25 | Verification Queue | 1-Click Submission Rejection | GM clicks `Reject` with optional custom feedback message (e.g. "Wrong building", "Blurry photo"). Team can retry. | Submission ID, rejection reason string | Updates submission `status: "rejected"`, `rejectionReason` | Clue becomes re-submittable for team; player receives rejection toast with reason | PRD FR-5.3, Plan Task 5.2 |
| 26 | Verification Queue | Award Bonus Points | GM awards extra bonus points (e.g. +20 pts) for exceptional team creativity, funny poses, or speed. | Submission ID, bonus points number | Adds bonus to `awardedPoints`, updates team score | Validates bonus points >= 0; records bonus in submission metadata | PRD FR-5.3, Plan Task 5.2 |
| 27 | Feedback & Celebration | Real-Time Celebration Confetti | Full-screen celebratory confetti burst (`canvas-confetti`) triggered on player device upon GM approval. | Submission status change `pending` ➔ `approved` | Confetti animation on mobile canvas, audio chime / haptic vibration | Confetti triggers only once per approval; dismissible on tap | PRD FR-4.4, Plan Task 4.4 |
| 28 | Team Management | Team Generator & Color Assignment | GM generates teams with random 4-digit PINs and assigns high-contrast colors (Crimson, Cobalt, Emerald, Amber, Violet). | Team name, color selection | New team document created in `/teams` subcollection | Rejects duplicate PINs; alerts GM if PIN collision detected | PRD Persona A, Plan Task 5.4 |
| 29 | Team Management | Printable & Screen QR Display | GM War Room generates high-resolution QR codes (`qrcode.react`) and PIN cards for display or printing. | Team PIN, base URL | High-res SVG/Canvas QR code with team name and PIN | Printable CSS media query format for paper handouts | PRD Persona A, Plan Task 5.4 |
| 30 | Leaderboard | Real-Time Live Leaderboard | Live ranking of all teams sorted by total score, showing solved clue counts and last active time. | Teams collection stream via `onSnapshot` | Real-time ranked table/cards with team badges and scores | Smooth animated re-ordering when scores change; hides score when frozen | PRD FR-2.3, Plan Task 5.5 |
| 31 | Architecture | Hybrid Mock Adapter | Transparent in-memory mock store that mimics Firestore `onSnapshot`, `setDoc`, `updateDoc` when Firebase config is missing or offline. | App start, missing Firebase credentials | Emulated real-time subscriptions with full state mutation capabilities | Console banner indicates "Running in Offline / Demo Mock Mode"; zero crashes | Plan Task 2.2, Vibe §5 |
| 32 | UI/UX | Sunshine-Proof High Contrast UI | Outdoor daylight-optimized design with high-contrast slate-900 / white / amber themes and touch targets >= 48px. | Viewport CSS media queries and Tailwind utilities | Crisp legibility under bright Melaka tropical sunlight (noon conditions) | Prevents low-contrast grey-on-grey text; enforces touch target minimums | Vibe §1.3, NFR-1 |

---

## 3. Data Models & Firestore Document Schemas

### 3.1 Document Hierarchy Overview
```text
📁 games (collection)
   └── 📄 {gameId}
         ├── 📁 teams (sub-collection)
         │     └── 📄 {teamId}
         ├── 📁 clues (sub-collection)
         │     └── 📄 {clueId}
         └── 📁 submissions (sub-collection)
               └── 📄 {submissionId}
```

### 3.2 Formal TypeScript Interfaces (`src/types/index.ts`)

```typescript
export type GameStatus = "lobby" | "active" | "frozen" | "ended";

export interface GeoCoordinate {
  lat: number;
  lng: number;
}

export interface Zone {
  id: string;
  name: string;
  color: string; // Hex color (e.g. "#EF4444")
  polygon: [number, number][]; // Array of [lat, lng] pairs
}

export interface Game {
  id: string;
  name: string;
  status: GameStatus;
  startTime: any | null; // Firestore Timestamp or ISO string
  durationMinutes: number;
  passCode: string;
  zones: Zone[];
  createdAt: any;
}

export interface Team {
  id: string;
  gameId: string;
  name: string;
  pin: string; // 4-digit numeric string (e.g. "4821")
  color: string; // Hex color code
  score: number;
  completedClueIds: string[];
  currentCoords?: {
    lat: number;
    lng: number;
    updatedAt: any;
  };
  lastActiveAt: any;
}

export interface Clue {
  id: string;
  gameId: string;
  title: string;
  zoneId: string;
  points: number;
  targetPhotoBase64: string; // Compressed Base64 Data URL (<= 150KB)
  location: GeoCoordinate;
  hint: string;
  createdAt: any;
}

export type SubmissionStatus = "pending" | "approved" | "rejected";

export interface Submission {
  id: string;
  gameId: string;
  teamId: string;
  teamName: string;
  teamColor: string;
  clueId: string;
  clueTitle: string;
  selfieBase64: string; // Compressed Base64 Data URL (<= 150KB)
  captureLocation?: GeoCoordinate;
  distanceMeters?: number; // Distance from target landmark at time of capture
  status: SubmissionStatus;
  rejectionReason?: string;
  awardedPoints: number;
  submittedAt: any;
  reviewedAt: any | null;
}

export interface HaversineDistanceResult {
  distanceMeters: number;
  distanceKm: number;
  formatted: string; // e.g. "14 m" or "1.2 km"
}
```

### 3.3 Firestore Security Rules & Validation Model

As specified in `docs/SECURITY_AND_DEPLOYMENT.md`:
1. **Root Read**: `/games/{gameId}` is publicly readable so players can check game status.
2. **Authentication**: Writes require `request.auth != null` (satisfied by Firebase Anonymous Auth).
3. **Submissions Size Ceiling**: `request.resource.data.selfieBase64.size() < 300000;` (~225 KB binary / ~300,000 characters). This provides a security gate against oversized document payload attacks while accommodating Base64 compression overhead.
4. **Teams Immutability**: Teams cannot be deleted by players (`allow delete: if false`).

---

## 4. Boundary Limits, Constraints & Sizing Invariants

| Parameter | Authoritative Constraint | Source Document | Rationale & Impact |
|---|---|---|---|
| **Max Image Compressed Size** | `<= 150 KB` Base64 string | PRD FR-4.2, Arch §4, Vibe §1.4 | Preserves Firestore 1 MB document ceiling and zero-cost Spark tier. |
| **Max Image Resolution** | `1024px` width, 65% JPEG quality | PRD FR-4.2, Arch §4 | Balances architectural clarity for GM verification against payload size. |
| **Firestore Doc Size Limit** | `1,048,576 bytes (1.0 MB)` | Google Cloud Firestore / Arch §4 | Hard database limit; Base64 selfies stay well under 15% of document cap. |
| **Security Rule Payload Cap** | `< 300,000` characters | `SECURITY_AND_DEPLOYMENT.md` §1 | Rejects uncompressed or oversized submissions at database firewall layer. |
| **GPS Watch Polling Throttle** | `15 seconds` minimum between writes | ORIGINAL_REQUEST R1, Arch §5A | Prevents mobile battery drain and exceeds Firestore free write quotas (20k/day). |
| **GPS Hook Options** | `enableHighAccuracy: true, timeout: 10000, maximumAge: 10000` | Arch §5A | Balances accuracy in Melaka alleyways with hardware timeout resilience. |
| **Team PIN Format** | Exactly `4-digit numeric string` (e.g. "4821") | ORIGINAL_REQUEST R1, PRD FR-1.2 | High usability for mobile players; fast input under sunlight. |
| **GM Passcode** | Configurable via `VITE_GM_PASSCODE` (default: `melaka2026`) | `SECURITY_AND_DEPLOYMENT.md` §2 | Simple access control for event organizers. |
| **Mobile Viewport Target** | `375px` to `430px` width (iPhone SE to 16 Pro Max) | PRD NFR-1, Vibe §1.3 | Fluid mobile-first UI with zero horizontal overflow. |
| **Minimum Touch Target** | `>= 48px × 48px` (PRD mentions 44px, Vibe enforces 48px) | PRD NFR-1, Vibe §1.3 | Prevents mis-taps while walking in outdoor outdoor heat. |
| **Melaka Map Geographic Center** | `[2.1944, 102.2491]` | IMPLEMENTATION_PLAN Task 3.3 | Centers Leaflet view directly over Stadhuys / Dutch Square. |
| **Pre-defined Team Palettes** | Crimson (`#EF4444`), Cobalt (`#3B82F6`), Emerald (`#10B981`), Amber (`#F59E0B`), Violet (`#8B5CF6`) | IMPLEMENTATION_PLAN Task 3.1 | High contrast badges distinguishable in daylight and on dark Leaflet tiles. |
| **Target Free Hosting Tiers** | Firebase Spark Plan ($0/mo), Vercel Hobby Plan ($0/mo) | PRD NFR-2, Arch §2 | Zero cost event operations. |

---

## 5. Edge Cases & Resilience Matrix

| # | Feature | Input / Trigger | Expected Observable Behavior | Recovery / Mitigation |
|---|---------|-----------------|------------------------------|-----------------------|
| 1 | Team Onboarding | Player inputs 3-digit PIN or letters | Input field enforces `maxLength={4}`, numeric keypad on mobile (`inputMode="numeric"`), submit button disabled until 4 digits entered. | Inline helper text: "Please enter the 4-digit numeric PIN". |
| 2 | Team Onboarding | Player enters valid 4-digit PIN but PIN does not exist in game | Firestore query returns empty set. Submit button shows loading spinner then fails. | Displays banner: "Invalid PIN. Please check with your Game Master." |
| 3 | Team Onboarding | Player opens direct QR URL `/play?pin=9999` where PIN is invalid | App parses URL, attempts auto-join, displays PIN input with pre-filled 9999 and error banner. | Allows user to clear and re-type PIN without app crash. |
| 4 | Team Onboarding | Player submits PIN without entering a Nickname | Nickname input border flashes amber/red; submit action is blocked. | Focus is placed on nickname input: "Nickname required to identify your selfie". |
| 5 | Geolocation | Player denies GPS browser permission | `navigator.geolocation.watchPosition` triggers error callback with `code: 1` (`PERMISSION_DENIED`). | Non-intrusive warning pill: "GPS disabled. You can still play, but radar tracking is unavailable." App continues running. |
| 6 | Geolocation | GPS timeout in narrow heritage alley (tall shophouses) | Geolocation error callback triggers `code: 3` (`TIMEOUT`). | Retains and displays last known valid coordinates; does not overwrite with null or zero. |
| 7 | Geolocation | Player walks outside Melaka heritage zone | Player coordinates fall outside Dutch Square / Jonker polygons. | Map pin reflects true position; distance badge on clues reflects true distance (e.g. "850 m away"). No hard crash. |
| 8 | Image Capture | Player device does not support native `capture="environment"` (e.g. desktop testing) | Browser ignores `capture` attribute and opens standard file picker. | File picker allows selecting `.jpg`, `.jpeg`, `.png` image smoothly. |
| 9 | Image Capture | Player snaps ultra-high-resolution 48MP raw photo (18 MB) | `browser-image-compression` runs worker thread, downscales to 1024px max dimension and 65% quality. | Progress spinner displayed: "Compressing photo..."; output size is guaranteed `<= 150 KB`. |
| 10 | Image Capture | Image compression outputs file slightly over 150 KB (e.g. 158 KB due to high noise) | Compression logic tests output string length; triggers secondary compression pass at 50% quality if needed. | Ensures Base64 string length remains strictly `< 200,000` chars (`< 150 KB`). |
| 11 | Submissions | Player attempts re-submitting for a clue already in team's `completedClueIds` | UI marks clue card with green checkmark and "Completed" badge. Capture button is disabled. | Prevent duplicate document write in Firestore; if bypassed, Firestore rule/service rejects. |
| 12 | Submissions | Intermittent cellular drop (offline) during selfie submission | `addDoc` or network write fails with offline/network error. | UI displays toast: "Network connection lost. Retrying upload..."; queues request in memory until reconnect. |
| 13 | Verification Queue | Multiple teams submit selfies at the exact same second | Submissions subcollection receives multiple concurrent documents. GM `onSnapshot` fires with multiple changes. | GM queue appends new items dynamically without duplicate keys; audio ping sounds once per batch. |
| 14 | Verification Queue | GM rejects submission with empty reason string | GM clicks "Reject" without typing custom feedback. | System defaults `rejectionReason` to "Photo does not match landmark criteria. Please try again." |
| 15 | Verification Queue | Clue photo uploaded by GM has no EXIF GPS data (e.g. downloaded from WhatsApp/web) | `exifr.gps(file)` resolves to `null` or `undefined`. | System detects missing EXIF, alerts GM: "No GPS metadata found in photo. Click on the map to set location." |
| 16 | Verification Queue | GM awards custom bonus points with negative value (e.g. typing "-10") | Bonus input validation triggers. | Value clamped to minimum `0`; bonus button disabled if `< 0`. |
| 17 | Game Lifecycle | Countdown timer reaches 00:00 while team is capturing selfie | Local timer and server state reach `ended`. | Clue cards disable "Submit" action; banner shows "Game Over! Return to Dutch Square for award ceremony." |
| 18 | Game Lifecycle | GM enables "Freeze Leaderboard" | Game status becomes `frozen`. Player views stop updating ranks and display "Leaderboard Frozen". | GM view maintains real-time updates and displays badge "Leaderboard Frozen (Players Blind)". |
| 19 | Map Rendering | Leaflet default marker icons fail to load (Vite asset 404 bug) | Custom `L.divIcon` with inline SVG markup used exclusively for all pins (clues, teams, user location). | Zero 404 network requests for `marker-icon.png`; fully styled SVG pins render reliably offline/online. |
| 20 | Backend Mode | Firebase credentials missing in `.env.local` or network completely offline | `src/config/firebase.ts` detects placeholder or missing keys, initiates `MockGameAdapter`. | Seamless local demo mode: pre-loads sample Melaka game, mock teams, clues; all UI interactions work. |

---

## 6. Pre-Configured Melaka Zones & Landmarks Inventory

Authoritative geographic specifications extracted from `PRD §3` and `IMPLEMENTATION_PLAN Task 3.1`:

### Zone 1: Dutch Square / Stadhuys (Zone ID: `zone-dutch-sq`)
- **Center**: `2.1944, 102.2491`
- **Color**: `#EF4444` (Crimson Red - matching Stadhuys terracotta red)
- **Key Landmarks**:
  - Stadhuys Historical Museum
  - Christ Church Melaka (1753)
  - Queen Victoria's Fountain (1901)
  - Tan Beng Swee Clock Tower

### Zone 2: Jonker Street / Jalan Hang Jebat (Zone ID: `zone-jonker`)
- **Center**: `2.1955, 102.2475`
- **Color**: `#F59E0B` (Amber Gold)
- **Key Landmarks**:
  - Jonker Walk World Heritage Stage Square
  - San Shu Gong Heritage Shophouse Façade
  - Geographer Café Heritage Corner
  - Jonker Heritage Street Murals

### Zone 3: Jalan Tokong / Harmony Street (Zone ID: `zone-harmony`)
- **Center**: `2.1975, 102.2468`
- **Color**: `#10B981` (Emerald Green)
- **Key Landmarks**:
  - Cheng Hoon Teng Temple (oldest functioning Chinese temple in Malaysia, 1645)
  - Kampung Kling Mosque (unique Sumatran-Chinese pagoda minaret, 1748)
  - Sri Poyyatha Vinayagar Moorthi Temple (oldest functioning Hindu temple in Malaysia, 1781)

### Zone 4: A Famosa & Porta de Santiago (Zone ID: `zone-afamosa`)
- **Center**: `2.1919, 102.2505`
- **Color**: `#3B82F6` (Cobalt Blue)
- **Key Landmarks**:
  - Porta de Santiago (Portuguese stone archway, 1511)
  - Melaka Sultanate Palace replica grounds
  - Dutch East India Company (VOC) fortress coat of arms

### Zone 5: St. Paul's Hill / Bukit St. Paul (Zone ID: `zone-stpaul`)
- **Center**: `2.1928, 102.2497`
- **Color**: `#8B5CF6` (Violet / Purple)
- **Key Landmarks**:
  - Ruins of St. Paul's Church (1521)
  - St. Francis Xavier marble statue (arm missing)
  - Historic carved Dutch Tombstones along church nave

---

## 7. Quality & Acceptance Verification Matrix

| Spec ID | Verification Requirement | Acceptance Criteria | Test Mechanism |
|---|---|---|---|
| **AC-1** | Clean TypeScript Compilation | Zero compile errors with strict null checks (`npm run build`). | Execute `npm run build` using system Node/npm. |
| **AC-2** | Zero Broken Leaflet Assets | Zero 404 requests for Leaflet icons; 100% SVG/HTML `divIcon`. | Inspect map DOM; verify `L.divIcon` class and SVG elements. |
| **AC-3** | Frictionless Team Onboarding | Player enters 4-digit PIN + Nickname or scans QR, binds to team state. | Verify state transition from `JoinTeamModal` to `/play` hunt screen. |
| **AC-4** | Camera Capture & In-Browser Compression | Mobile photo compressed to `<= 150 KB` Base64 data URL before upload. | Run unit/e2e test compressing sample image; assert output byte length `< 200,000`. |
| **AC-5** | Direct Firestore Base64 Storage | Selfie Base64 saved directly to Firestore submission document. | Inspect created document schema; verify absence of external storage URL. |
| **AC-6** | Real-Time GM War Room Queue | Submissions arrive instantly without page reload; 1-click Approve/Reject. | Trigger submission; verify instantaneous render in GM queue via `onSnapshot`. |
| **AC-7** | Synchronized Score & Confetti | Approving submission increments score on GM and Player views; triggers confetti. | Click Approve; observe live score bump and canvas confetti burst on player view. |
| **AC-8** | Throttled GPS Radar Tracking | Player position broadcasts at >= 15-second intervals to GM War Room radar. | Simulate location updates; verify write throttle rate limit. |
| **AC-9** | Haversine Distance Calculation | Proximity distance in meters computed and rendered in GM review modal. | Calculate known GPS delta; verify displayed meters match formula output. |
| **AC-10** | Offline / Mock State Adapter | App functions completely in offline/mock demo mode without valid Firebase keys. | Clear Firebase env keys; verify app loads and allows simulated gameplay. |
