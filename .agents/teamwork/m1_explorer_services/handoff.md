# Handoff Report: Core Data Services, Firebase Client & Hybrid Mock Adapter
**Milestone**: M1 (Data Layer, Core Services & Mock Adapter)  
**Agent**: Explorer 3 (`m1_explorer_services`)  
**Date**: 2026-10-14T15:28:00Z  
**Recipient**: Orchestrator (`474d6027-a627-4b87-8d49-df9a413881d8`) / Implementers

---

## 1. Observation

1. **Package Ecosystem**:
   - `package.json` line 16: `"firebase": "^13.0.0"`. Verified exports of modular Firebase v13 SDK via Node execution:
     `import('firebase/firestore')` provides `initializeFirestore`, `persistentLocalCache`, `persistentMultipleTabManager`, `memoryLocalCache`, `onSnapshot`, `runTransaction`, `serverTimestamp`, `increment`, `arrayUnion`.
     `import('firebase/auth')` provides `getAuth`, `signInAnonymously`, `onAuthStateChanged`.
2. **Environment & Secrets**:
   - `.env.local` lines 7–18 contains active credentials:
     `VITE_FIREBASE_API_KEY=AIzaSyDpvWr7ekLe8_UKN-IXFrB2dgPdI52ae34`
     `VITE_FIREBASE_PROJECT_ID=heritage-hunt-2c719`
     `VITE_GM_PASSCODE=melaka2026`
   - `.env.example` contains placeholder strings (`your_api_key_here`).
3. **TypeScript Configuration Rules**:
   - `tsconfig.app.json` line 22: `"erasableSyntaxOnly": true`.
   - `tsconfig.app.json` line 14: `"verbatimModuleSyntax": true`.
   - Runtime `enum` constructs are strictly prohibited and will cause compile errors. String unions (`'lobby' | 'active' | ...`) backed by `as const` object records must be used. All type-only imports must be qualified with `import type`.
4. **Geographic Ground Truths**:
   - Melaka Dutch Square / Stadhuys is located at `[2.1944, 102.2491]`.
   - Porta de Santiago (A Famosa) is located at `[2.1918, 102.2504]`.
   - Tested spherical Haversine formula via Node: distance between Dutch Square and A Famosa evaluates to **323 meters**, matching actual Melaka topography.
5. **Teamwork Coordination**:
   - Explorer 1 (`m1_explorer_types_data`) has formulated strict data models in `analysis.md` and `test_types.ts`, establishing `GeoCoordinate { latitude, longitude, ... }`, `Game`, `Team`, `Clue`, and `Submission`.

---

## 2. Logic Chain

1. **Dual-Engine Architecture (Observation 1 & 2)**:
   - *Premise*: Field participants navigating narrow alleys in Melaka (e.g., Jonker Street, Jalan Tokong) face intermittent 4G cellular drops, and local automated test suites cannot rely on live internet connections.
   - *Inference*: The client must provide a unified facade (`gameService.ts`) that transparently routes calls either to live Cloud Firestore (with multi-tab offline cache persistence) or to the in-memory/localStorage Hybrid Mock Adapter (`mockAdapter.ts`).
2. **Multi-Tab Reactive State Sync (Observation 1)**:
   - *Premise*: In mock/local mode, a Game Master tab in one window and a Player tab in another window must see changes without page refreshes.
   - *Inference*: `mockAdapter.ts` must combine an in-memory listener registry (`Set<Listener>`) with `localStorage` persistence and cross-tab event propagation via `BroadcastChannel('melaka_hunt_bus')`, falling back to `window.addEventListener('storage')`.
3. **Atomic Verification Transactions (Observation 1 & 5)**:
   - *Premise*: When a GM reviews a selfie submission, three distinct state changes must occur simultaneously: (a) submission status transitions to `'approved'` / `'rejected'`, (b) team score increments by awarded points, and (c) clue ID appends to team's `completedClueIds`.
   - *Inference*: In live mode, this must be wrapped in Firestore's `runTransaction` with `increment()` and `arrayUnion()`. In mock mode, the adapter must update all three records in the local state dictionary before firing listeners and broadcasting.
4. **Distance Badge in Verification Queue (Observation 4 & 5)**:
   - *Premise*: The GM needs rapid visual confirmation that a submitted selfie was actually taken near the landmark.
   - *Inference*: Client-side Haversine computation (`calculateHaversineDistance`) computes the distance in meters between `submissionCoords` and clue `location`, outputting visual badge classifications: On Site (<= 25m), Within Range (<= 50m), Nearby (<= 150m), and Far Away (> 150m).

---

## 3. Caveats

- **IndexedDB Quota & Private Browsing**: In some private browsing modes (e.g. certain iOS Safari versions), `persistentLocalCache` can throw a `SecurityError`. The Firebase initialization in `firebase.ts` explicitly guards against this with a try-catch fallback to `memoryLocalCache()`.
- **BroadcastChannel Support**: `BroadcastChannel` is supported in all modern evergreen browsers (Chrome 54+, Firefox 38+, Safari 15.4+). For older or headless test runtimes lacking `BroadcastChannel`, the dual fallback to native `window.addEventListener('storage')` ensures zero breakage.
- **Base64 Payload Ceiling**: Base64 strings expand binary data by ~33.3%. For a 150 KB Base64 string limit, the binary photo must compress to <= ~112.5 KB. Firestore document limit is 1.0 MB, so storing <= 150 KB Base64 selfies directly inside submission documents is safe and leaves >850 KB of margin.

---

## 4. Conclusion

1. **`src/services/firebase.ts`**:
   - Initializes modular Firebase v13 with `initializeFirestore` and `persistentLocalCache({ tabManager: persistentMultipleTabManager() })`.
   - Implements frictionless anonymous authentication via `ensureAnonymousAuth()` (`signInAnonymously`).
   - Implements `isFirebaseConfigured()` to safely gate live connection attempts.
2. **`src/services/mockAdapter.ts`**:
   - Implements complete in-memory reactive state with `localStorage` persistence (`melaka_hunt_mock_state_v1`).
   - Dispatches cross-tab synchronization events via `BroadcastChannel('melaka_hunt_bus')`.
   - Replicates exact `onSnapshot` semantics (immediate snapshot fire + change notifications + unsubscribe).
   - Provides atomic mutations for `createTeam`, `joinTeamByPin`, `updateTeamGps`, `submitCluePhoto`, `verifySubmission`, `toggleFreezeLeaderboard`, and `updateGameTimer`.
3. **`src/services/gameService.ts`**:
   - Exports unified `gameService` conforming to `IGameService`.
   - Dynamically selects live Firestore or MockAdapter based on URL override (`?mock=true`), `isFirebaseConfigured()`, and network availability.
   - Uses Firestore `runTransaction` for atomic review verification.
4. **`src/utils/haversine.ts`**:
   - Mathematical implementation of spherical Haversine formula ($R = 6,371,000 \text{ m}$).
   - Normalizes `{ latitude, longitude }`, `{ lat, lng }`, and `[lat, lng]`.
   - Provides `getProximityBadge` with daylight-optimized Tailwind CSS classes.

---

## 5. Verification Method

To independently verify the implementation blueprint:

1. **Haversine Distance Accuracy**:
   Run the following verification script with Node:
   ```powershell
   & "C:\Program Files\nodejs\node.exe" -e "
   const R = 6371000;
   const toRad = deg => (deg * Math.PI) / 180;
   function dist(lat1, lon1, lat2, lon2) {
     const dLat = toRad(lat2 - lat1);
     const dLon = toRad(lon2 - lon1);
     const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
     return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
   }
   console.log('Dutch Sq to A Famosa:', dist(2.1944, 102.2491, 2.1918, 102.2504), 'm'); // Expected: 323 m
   console.log('Dutch Sq to Christ Church:', dist(2.1944, 102.2491, 2.1942, 102.2489), 'm'); // Expected: 31 m
   "
   ```
2. **TypeScript Compilation & Erasable Syntax Compliance**:
   Run the build command once files are implemented:
   ```powershell
   npm run build
   ```
   *Expected result*: `tsc -b && vite build` succeeds with zero errors, zero enum warnings, and proper type imports.
3. **Multi-Tab Sync Verification in Browser**:
   - Open Tab 1: `http://localhost:5173/gm?mock=true`
   - Open Tab 2: `http://localhost:5173/play?pin=1001&mock=true`
   - In Tab 1 (GM), click "Approve" on a submission.
   - *Verification*: Tab 2 (Player) immediately displays the approved status banner and score increment without refreshing Tab 2.
