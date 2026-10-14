# Forensic Audit Report: Milestone 1 (Data Layer, Core Services & Mock Adapter)

**Auditor Agent**: `m1_auditor`  
**Milestone**: Milestone 1 (Data Layer, Core Services & Mock Adapter)  
**Profile**: General Project (`Integrity mode: development` per `ORIGINAL_REQUEST.md`)  
**Verdict**: **CLEAN** (Zero Integrity Violations; 1 Numerical Stability Edge-Case Finding Documented)  
**Timestamp**: 2026-10-14T16:05:00Z  
**Recipient**: Orchestrator (`474d6027-a627-4b87-8d49-df9a413881d8`)  

---

## 1. Observation

### 1.1 Dependency & Storage Audit (`package.json`)
Direct inspection of `package.json` confirms:
- **Zero Smuggled Paid Dependencies**: All production dependencies (`browser-image-compression`, `canvas-confetti`, `exifr`, `firebase`, `leaflet`, `lucide-react`, `qrcode.react`, `react`, `react-dom`, `react-leaflet`) are standard open-source packages (MIT/ISC/BSD/Hippocratic).
- **Zero Paid Storage Infrastructure**: No AWS S3, Google Cloud Storage, Mapbox, or Twilio SDKs are installed. In conformance with `ORIGINAL_REQUEST.md § R3`, photos are compressed client-side and saved directly into Firestore document Base64 strings.

### 1.2 Static Analysis & Prohibited Patterns Check
Direct inspection of all 10 Milestone 1 files:
1. `src/types/index.ts`:
   - Contains zero TypeScript runtime `enum` keywords (`erasableSyntaxOnly` strictly preserved).
   - Uses `as const` dictionaries (`GAME_STATUS`, `SUBMISSION_STATUS`, `REVIEW_ACTION`) and string literal unions.
   - Contains genuine type guards (`isGeoCoordinate`, `isGameStatus`, `isGame`, `isTeam`, `isClue`, `isSubmission`, `isZone`) and coordinate conversion utilities.
2. `src/data/melakaZones.ts`:
   - Contains 5 UNESCO zones (`dutch-square`, `jonker-street`, `jalan-tokong`, `a-famosa`, `st-pauls-hill`) with valid multi-vertex polygons and center coordinates.
   - Contains 14 authentic Melaka clues with authentic point values (80–150), historical hints, and self-contained SVG Data URLs (`data:image/svg+xml;utf8,...`), guaranteeing zero 404 image errors.
   - Contains 5 high-contrast team palettes and 5 starter teams with 4-digit PINs (`1111`, `2222`, `3333`, `4444`, `5555`).
3. `src/services/imageCompression.ts`:
   - Browser execution utilizes genuine canvas resizing and multi-iteration compression (`browser-image-compression` with `useWebWorker: false` for offline reliability) backed by a 3-tier adaptive fallback loop (800px@55%, 640px@45%, 480px@35%) to enforce the $\le 150 \text{ KB}$ ($153,600 \text{ bytes}$) Base64 ceiling.
   - Headless Node.js test environment incorporates a simulated JPEG payload generator so test suites do not crash on missing browser DOM Canvas APIs.
   - EXIF GPS extraction uses `exifr.gps(input)` with `ArrayBuffer` conversion in Node, finite number checks, and strict coordinate bounds checks ($[-90, 90]$ and $[-180, 180]$).
4. `src/services/firebase.ts`:
   - Genuine Firebase v13 initialization with multi-tab offline cache (`persistentLocalCache` + `persistentMultipleTabManager`), anonymous auth, and synthetic persistent local UID fallback.
5. `src/services/mockAdapter.ts`:
   - Genuine in-memory state collections (`game`, `teams`, `clues`, `submissions`).
   - Mutations execute authentic business logic: PIN validation regex `/^\d{4}$/`, duplicate PIN detection, duplicate clue completion rejection, duplicate pending submission rejection, Haversine proximity computation, GM review actions (`approve`, `bonus` +20, `reject` with reason), and state reset.
   - Multi-tab synchronization via `BroadcastChannel('melaka_hunt_bus')` and `localStorage` (`melaka_hunt_mock_state_v1`).
6. `src/services/gameService.ts`:
   - Unified interface routing dynamically via `getDataSourceMode()` (`?mock=` URL parameter, `VITE_USE_MOCK`, or `isFirebaseConfigured()`).
   - Real Firestore transaction and snapshot listener calls with graceful fallback to `mockAdapter`.
7. `src/utils/haversine.ts`:
   - Genuine great-circle distance computation:
     $$\text{toRad}(\theta) = \frac{\theta \cdot \pi}{180}$$
     $$a = \sin^2\left(\frac{\Delta \varphi}{2}\right) + \cos(\varphi_1) \cos(\varphi_2) \sin^2\left(\frac{\Delta \lambda}{2}\right)$$
     $$c = 2 \operatorname{atan2}(\sqrt{a}, \sqrt{1 - a})$$
     $$d = \operatorname{round}(R \cdot c), \quad R = 6,371,000 \text{ m}$$
   - Zero hardcoded output lookups, zero facade returns, zero pre-populated verification logs.

### 1.3 Behavioral Execution Results

#### Build & Typecheck (`npm run build`)
```text
> tsc -b && vite build

vite v8.3.4 building client environment for production...
transforming...
✓ 20 modules transformed.
rendering chunks...
dist/index.html                   0.93 kB │ gzip:  0.53 kB
dist/assets/react-CHdo91hT.svg    4.12 kB │ gzip:  2.06 kB
dist/assets/vite-BF8QNONU.svg     8.70 kB │ gzip:  1.60 kB
dist/assets/hero-CLDdwZDr.png    13.05 kB
dist/assets/index-CwbdyaWL.css   35.60 kB │ gzip: 11.25 kB
dist/assets/index-DwPAzo_7.js   222.45 kB │ gzip: 69.28 kB
✓ built in 358ms
```

#### Linter (`npm run lint`)
```text
> oxlint
Found 0 warnings and 0 errors.
Finished in 19ms on 39 files with 116 rules using 8 threads.
```

#### Milestone 1 Unit Tests (`node --test tests/unit/imageCompression.test.ts tests/unit/gameService.test.ts`)
```text
ℹ tests 25
ℹ suites 5
ℹ pass 25
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 401.4025
```

#### E2E Specification Tests (`node --test tests/tier*/*.test.ts`)
```text
ℹ tests 210
ℹ suites 53
ℹ pass 210
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 1225.4125
```

### 1.4 Empirical Adversarial Finding (FINDING-01)
When running the full test suite including the adversarial test (`tests/unit/challenger2_empirical.test.ts`), test `CHAL-GEO-02` failed:
```text
✖ CHAL-GEO-02: Antipodal coordinates must return ~20,015,087m without producing NaN (1.4188ms)
  AssertionError [ERR_ASSERTION]: Randomized antipode 22 produced NaN
      at TestContext.<anonymous> (tests/unit/challenger2_empirical.test.ts:123:14)
```

**Root Cause Analysis**:
In `src/utils/haversine.ts` (lines 47-55):
```ts
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(p1.lat)) *
      Math.cos(toRad(p2.lat)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(EARTH_RADIUS_METERS * c);
```
For antipodal coordinates ($\Delta \sigma = \pi$, distance $\approx 20,015 \text{ km}$), theoretical $a = 1.0$. However, in IEEE 754 double precision floating point arithmetic, rounding errors cause $a$ to evaluate to $1 + \epsilon$ (e.g. $1.0000000000000002$). Consequently, $1 - a < 0$, making `Math.sqrt(1 - a)` evaluate to `NaN`, which propagates to `calculateHaversineDistance` returning `NaN`.
Empirical stress testing over 1,000 random antipodal pairs produced `NaN` in 26 cases (~2.6%).
Clamping $a$ via `Math.sqrt(Math.max(0, 1 - a))` completely eliminates all `NaN` occurrences (0 out of 1,000 produced `NaN`).

---

## 2. Logic Chain

1. **Integrity Mode Classification**: Under `ORIGINAL_REQUEST.md`, the project is designated `Integrity mode: development`. In development mode, the audit focus is identifying hardcoded test outputs, facade/dummy implementations, fabricated verification artifacts, and smuggled paid dependencies.
2. **Evaluation of Prohibited Patterns**:
   - *Hardcoded test results*: None found. All distance, compression, and game state calculations execute authentic algorithmic logic.
   - *Facade implementations*: None found. Types, mock adapter, and services maintain real state structures, collections, and event dispatchers.
   - *Fabricated outputs*: None found. Zero pre-existing result files or fake logs exist.
   - *Smuggled paid dependencies*: None found. Entire stack uses free/open-source tools and client-side Base64 storage in Firestore documents.
3. **Evaluation of Empirical Adversarial Finding**:
   - The failure of `CHAL-GEO-02` on antipodal coordinates is an authentic numerical precision limitation of the textbook Haversine formula when $a > 1.0$, rather than an integrity violation. In fact, this empirical failure proves that `calculateHaversineDistance` is performing genuine spherical trigonometry and has not cheated by embedding hardcoded distances.
   - In the real-world operational domain of Melaka ($2.19^\circ\text{N}, 102.25^\circ\text{E}$), maximum inter-landmark distances are $< 1,500 \text{ m}$ ($a < 10^{-7}$), where this floating-point boundary condition never triggers.
4. **Conclusion Derivation**: Because no prohibited patterns exist and all architectural deliverables are genuinely implemented, the integrity verdict is **CLEAN**. The antipodal floating-point clamping issue is logged as an engineering finding for remediation.

---

## 3. Caveats

- **Audit-Only Constraint**: In strict adherence to auditor constraints ("Audit-only — do NOT modify implementation code"), `src/utils/haversine.ts` was not modified by the auditor.
- **Node.js Canvas vs Browser**: In headless Node.js test execution, `simulateCompressionFallback` produces a compliant synthetic Base64 JPEG payload, whereas in the browser runtime, `browser-image-compression` utilizes real `<canvas>` elements. Both paths enforce the $\le 150 \text{ KB}$ ceiling.
- **Cloud Firestore Credentials**: Verification was conducted against the Hybrid Mock Adapter because live production Firebase credentials were not configured in `.env.local`. Firestore SDK integration logic was verified via static code inspection and TypeScript type checking.

---

## 4. Conclusion

**Verdict**: **CLEAN**

The Milestone 1 deliverable is an authentic, robust implementation of the Domain Models, Melaka Heritage Data, Haversine Proximity Engine, Image Compression Service, Firebase Client, and Hybrid Mock Adapter.
- Zero integrity violations.
- Zero hardcoded test bypasses or facades.
- Zero paid dependencies.
- 100% clean production build and linter pass.
- 25/25 Milestone 1 unit tests passed.
- 210/210 E2E specification tests (Tiers 1-4) passed.

**Recommended Remediation for Next Milestone / Worker**:
In `src/utils/haversine.ts`, update line 54 to prevent floating-point `NaN` on antipodal coordinates:
```ts
// Before:
const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

// Recommended fix:
const c = 2 * Math.atan2(Math.sqrt(Math.min(1, Math.max(0, a))), Math.sqrt(Math.max(0, 1 - a)));
```

---

## 5. Verification Method

To independently verify the forensic findings:

1. **Verify Production Build**:
   ```powershell
   $env:Path = "C:\Program Files\nodejs;$env:Path"
   npm run build
   ```
   *Expected outcome*: Exits with code 0 (`tsc -b && vite build` completes in < 500ms).

2. **Verify Linter**:
   ```powershell
   $env:Path = "C:\Program Files\nodejs;$env:Path"
   npm run lint
   ```
   *Expected outcome*: 0 warnings, 0 errors.

3. **Verify Milestone 1 Unit Tests**:
   ```powershell
   $env:Path = "C:\Program Files\nodejs;$env:Path"
   node --test tests/unit/imageCompression.test.ts tests/unit/gameService.test.ts
   ```
   *Expected outcome*: 25/25 tests pass in < 500ms.

4. **Verify E2E Specification Suites (Tiers 1-4)**:
   ```powershell
   $env:Path = "C:\Program Files\nodejs;$env:Path"
   node --test tests/tier*/*.test.ts
   ```
   *Expected outcome*: 210/210 tests pass across 53 suites in ~1.2s.

5. **Reproduce Antipodal Floating-Point Behavior (FINDING-01)**:
   ```powershell
   $env:Path = "C:\Program Files\nodejs;$env:Path"
   node -e "import('./src/utils/haversine.ts').then(({ calculateHaversineDistance }) => { let nans = 0; for(let i=0; i<1000; i++){ const lat = Math.random()*170 - 85; const lng = Math.random()*360 - 180; if(Number.isNaN(calculateHaversineDistance([lat, lng], [-lat, lng > 0 ? lng-180 : lng+180]))) nans++; } console.log('Antipodal NaNs:', nans); });"
   ```
   *Expected outcome*: Outputs ~20-30 NaNs per 1000 trials due to unclamped floating-point overshoot.
