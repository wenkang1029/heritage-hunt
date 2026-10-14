# Specification Miner Survey Handoff Report

**Agent**: Specification Miner (`spec_miner_survey`)  
**Parent Orchestrator**: `474d6027-a627-4b87-8d49-df9a413881d8`  
**Milestone**: Survey Phase Completed  
**Working Directory**: `C:\Users\User\Projects\heritage-hunt\.agents\teamwork\spec_miner_survey`  

---

## 1. Observation

1. **Authoritative Specification Files**:
   - `ORIGINAL_REQUEST.md`: Contains primary user requirements R1 (Player Mobile Experience `/play`), R2 (GM War Room `/gm`), and R3 (Real-Time Firestore Integration & Zero-Paid-Cost Storage).
   - `docs/PRD.md` (96 lines): Details user personas (GM and Player), Melaka UNESCO target zones (Dutch Square, Jonker Street, Jalan Tokong, A Famosa, St. Paul's Hill), Functional Requirements FR-1 through FR-6, and Non-Functional Requirements NFR-1 through NFR-4.
   - `docs/ARCHITECTURE.md` (140 lines): Specifies client/server architecture diagram, full Firestore document schema (`/games/{gameId}`, `/teams`, `/clues`, `/submissions`), Base64 storage invariants, and the 15-second throttled GPS hook with Haversine distance formula.
   - `docs/IMPLEMENTATION_PLAN.md` (110 lines): Details 6 development sprints with Work Breakdown Structure (Tasks 1.1 through 6.3), pre-configured Melaka zones, team color palettes (Crimson, Cobalt, Emerald, Amber, Violet), and a mandatory Hybrid Mock Adapter.
   - `docs/SECURITY_AND_DEPLOYMENT.md` (101 lines): Defines Firestore security rules with a submission size ceiling (`request.resource.data.selfieBase64.size() < 300000`), environment variables, and Vercel Singapore edge deployment.
   - `.agent/rules/vibe-coding.md` (32 lines): Mandates mobile daylight-proof design, touch targets `>= 48px`, zero cloud costs, strict TypeScript typing (no `any`), and custom SVG `L.divIcon` map pins.

2. **Current Codebase State**:
   - `package.json`: Contains React 19.2.8, Vite 8.3.0, TypeScript 6.0.2, Tailwind CSS 4.3.3, Leaflet 1.9.4, `react-leaflet` 5.0.0, `browser-image-compression` 2.0.2, `exifr` 7.1.3, `canvas-confetti` 1.9.4, `qrcode.react` 4.2.0, and `lucide-react` 1.57.0.
   - `src/App.tsx`: Currently contains the default Vite starter template (123 lines). Sprint 2 through Sprint 5 components and services are ready to be created.
   - Toolchain environment check: Node.js is installed at `C:\Program Files\nodejs\node.exe` (v24.20.0, npm 11.19.0). Baseline build command `$env:Path = "C:\Program Files\nodejs;$env:Path"; npm run build` completes cleanly with exit code 0 in 258ms.

---

## 2. Logic Chain

1. **From Requirements to Feature Architecture**:
   - `ORIGINAL_REQUEST.md` specifies three distinct pillars: Player Mobile App (`/play`), GM War Room (`/gm`), and Firestore Base64 Storage.
   - `docs/PRD.md` and `docs/ARCHITECTURE.md` specify that player access must be zero-friction (4-digit numeric PIN or QR code with nickname, no email or password), while GM access is gated by `VITE_GM_PASSCODE`.
   - Underneath, Firebase Anonymous Auth (`signInAnonymously`) provides a distinct Firebase UID to satisfy Firestore security rules (`request.auth != null`) while maintaining friction-free onboarding.

2. **From Storage Constraints to Image Pipeline**:
   - Cloud Storage on Firebase requires the paid Blaze plan. To maintain the zero-cost guarantee (`$0.00` Spark free tier), images must be stored directly in Firestore documents.
   - Firestore imposes a strict 1 MB per-document ceiling. A standard smartphone photo is 5MB–15MB.
   - Therefore, client-side compression via `browser-image-compression` targeting `<= 150 KB` (max 1024px, 65% quality) is a mandatory architectural invariant before sending any Base64 string to Firestore.
   - The security rules enforce `selfieBase64.size() < 300000` (~225 KB binary equivalent) as a firewall check.

3. **From Battery & Rate Limit Constraints to GPS Architecture**:
   - Mobile GPS tracking continuously broadcasted would drain smartphone batteries in hot outdoor conditions and exhaust Firestore's 20,000 free writes/day limit.
   - Therefore, `navigator.geolocation.watchPosition` must be gated by a 15-second throttle (`Date.now() - lastBroadcastTime > 15000`), updating `currentCoords` on the team document.
   - Haversine distance is calculated client-side in the GM queue using target clue coordinates and player capture coordinates, providing the GM with physical distance verification (e.g. *"Team was 14m away"*).

4. **From Mapping Engine to Asset Reliability**:
   - Standard Leaflet bundler integrations frequently fail with 404s for default marker icons (`marker-icon.png`).
   - The specification and vibe-coding directives mandate custom HTML/SVG `L.divIcon` pins for all map markers (landmarks, teams, user location), styled with CSS radar pulse animations (`team-pulse` defined in `src/index.css`).

5. **From Offline Field Realities to Hybrid Mock Adapter**:
   - Melaka heritage alleys (narrow shophouse lanes) suffer from spotty 4G connectivity. Furthermore, initial development and CI/CD environments may lack active Firebase project credentials.
   - Task 2.2 explicitly requires an in-memory Mock State Adapter that seamlessly mirrors Firestore `onSnapshot` listeners and writes when demo keys are used or when the network is unreachable.

---

## 3. Caveats

- **Caveat 1 (Firebase Project Binding)**: `.env.local` contains existing project credentials for `heritage-hunt-2c719`. However, the security rules in `docs/SECURITY_AND_DEPLOYMENT.md` must be deployed to the live Firebase console for production enforcement. The application must seamlessly fall back to the Hybrid Mock Adapter if network or Firebase rules block requests.
- **Caveat 2 (Camera Desktop Testing)**: Mobile devices with rear cameras trigger `capture="environment"`, whereas desktop browsers ignore the attribute and open a file chooser. Automated testing must mock `File` inputs.
- **Caveat 3 (EXIF GPS Stripping)**: Photos shared through messaging apps (WhatsApp, Telegram) often strip EXIF metadata. The GM bulk upload interface must provide a fallback for manually clicking on the Leaflet map to drop clue pins.

---

## 4. Conclusion

The specification mining phase is complete. The system architecture, data models, boundary constraints, and edge cases are thoroughly mapped and cataloged in `C:\Users\User\Projects\heritage-hunt\.agents\teamwork\spec_miner_survey\analysis.md`:
- **32 discrete features** cataloged across 9 categories.
- **20 edge cases** with concrete mitigation strategies defined.
- Complete Firestore document schemas and TypeScript interfaces specified.
- Key invariants documented: `<= 150 KB` Base64 compression, 15-second GPS throttle, 4-digit PINs, Melaka geographic center `[2.1944, 102.2491]`, touch targets `>= 48px`, and custom SVG `L.divIcon` map pins.
- Ready for implementation dispatch according to the sprint roadmap.

---

## 5. Verification Method

To independently verify this specification survey and the project environment:
1. **Inspect Analysis Report**:
   - Path: `C:\Users\User\Projects\heritage-hunt\.agents\teamwork\spec_miner_survey\analysis.md`
   - Verify feature catalog table, data schemas, invariants, and edge case matrix.
2. **Execute Clean Build**:
   ```powershell
   $env:Path = "C:\Program Files\nodejs;$env:Path"
   cd C:\Users\User\Projects\heritage-hunt
   npm run build
   ```
   *Expected Result*: Clean build with zero errors in ~300ms.
3. **Verify Environment Variables**:
   - Inspect `C:\Users\User\Projects\heritage-hunt\.env.local`
   - Verify presence of `VITE_FIREBASE_*` and `VITE_GM_PASSCODE=melaka2026`.
