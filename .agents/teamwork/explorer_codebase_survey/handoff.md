# Handoff Report: Codebase Survey

**Agent:** explorer_codebase_survey  
**Milestone:** Phase 0 - Survey & Scope Mapping  
**Working Directory:** `C:\Users\User\Projects\heritage-hunt\.agents\teamwork\explorer_codebase_survey`  
**Target Path:** `C:\Users\User\Projects\heritage-hunt`  
**Timestamp:** 2026-10-14T15:15:30Z  

---

## 1. Observation

1. **Project Toolchain & Build:**
   - Command `$env:PATH = "C:\Program Files\nodejs;" + $env:PATH; npm run build` executed `tsc -b && vite build`.
   - Output:
     ```text
     vite v8.3.4 building client environment for production...
     transforming...
     ✓ 20 modules transformed.
     rendering chunks...
     computing gzip size...
     dist/index.html                   0.93 kB │ gzip:  0.53 kB
     dist/assets/react-CHdo91hT.svg    4.12 kB │ gzip:  2.06 kB
     dist/assets/vite-BF8QNONU.svg     8.70 kB │ gzip:  1.60 kB
     dist/assets/hero-CLDdwZDr.png    13.05 kB
     dist/assets/index-C3FMLmas.css   10.11 kB │ gzip:  3.06 kB
     dist/assets/index-BBOUPiGK.js   222.45 kB │ gzip: 69.28 kB

     ✓ built in 279ms
     ```
   - Lint check `$env:PATH = "C:\Program Files\nodejs;" + $env:PATH; npm run lint` (`oxlint`) returned:
     ```text
     Found 0 warnings and 0 errors.
     Finished in 14ms on 3 files with 116 rules using 8 threads.
     ```

2. **Source Code Status (`src/`):**
   - Direct inspection of `src/` revealed only 5 files and 1 assets subfolder:
     - `src/main.tsx` (11 lines) — mounts `<App />` into `document.getElementById('root')!`.
     - `src/App.tsx` (123 lines) — default Vite + React starter template with `count` state, hero images, and links to `vite.dev` and `react.dev`.
     - `src/App.css` (185 lines) — default Vite counter and logo CSS styling.
     - `src/index.css` (38 lines) — contains `@import "tailwindcss";`, `@keyframes team-pulse`, `.team-radar-pin`, and `.leaflet-popup-content-wrapper` dark theme overrides.
     - `src/assets/` containing `hero.png`, `react.svg`, `vite.svg`.
   - No subdirectories for `types`, `config`, `services`, `hooks`, `data`, or `components` exist yet in `src/`.

3. **Public Assets (`public/`):**
   - `public/favicon.svg` (Vite SVG icon).
   - `public/icons.svg` (Vite template SVG symbols for social links).
   - `index.html` lines 6-11:
     - `<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />`
     - `<meta name="theme-color" content="#b91c1c" />`
     - `<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />`

4. **Dependencies (`package.json`):**
   - Tested Node runtime resolution for all listed runtime packages:
     - `browser-image-compression` (v2.0.2): PASS
     - `canvas-confetti` (v1.9.4): PASS
     - `exifr` (v7.1.3): PASS
     - `firebase` (v13.0.0): PASS (`firebase/app`, `firebase/firestore`, `firebase/auth`)
     - `leaflet` (v1.9.4): PASS
     - `lucide-react` (v1.57.0): PASS
     - `qrcode.react` (v4.2.0): PASS
     - `react` (v19.2.8) & `react-dom` (v19.2.8): PASS
     - `react-leaflet` (v5.0.0): PASS
     - `@tailwindcss/vite` (v4.3.3) & `tailwindcss` (v4.3.3): PASS

5. **Environment Configuration:**
   - `.env.local` contains active Firebase credentials:
     - `VITE_FIREBASE_API_KEY=AIzaSy...`
     - `VITE_FIREBASE_AUTH_DOMAIN=heritage-hunt-2c719.firebaseapp.com`
     - `VITE_FIREBASE_PROJECT_ID=heritage-hunt-2c719`
     - `VITE_FIREBASE_STORAGE_BUCKET=heritage-hunt-2c719.firebasestorage.app`
     - `VITE_FIREBASE_MESSAGING_SENDER_ID=917812049429`
     - `VITE_FIREBASE_APP_ID=1:917812049429:web:b9f1b7d42c23deb9f7801c`
     - `VITE_GM_PASSCODE=melaka2026`

6. **Documentation & Roadmap Alignment:**
   - `docs/IMPLEMENTATION_PLAN.md`: Sprint 1 tasks (1.1 to 1.5) are marked complete `[x]`. Sprints 2 through 6 are unstarted `[ ]`.

---

## 2. Logic Chain

1. **Observation 1 & 4** show that the build pipeline (`tsc -b && vite build`) and linting (`oxlint`) succeed with zero errors, and all required runtime packages are resolved in `node_modules`.
   * **Inference:** The development baseline is healthy and has no dependency or bundler conflicts.

2. **Observation 2** shows that `src/App.tsx` contains only the boilerplate starter counter, and no application subdirectories or files exist under `src/` (`src/types/`, `src/config/`, `src/services/`, `src/hooks/`, `src/components/`, `src/data/`).
   * **Inference:** None of the core domain logic for Melaka Heritage Photo Hunt has been written yet. The application is at the exact boundary between Sprint 1 (Baseline) and Sprint 2 (Data & Services).

3. **Observation 4 & 5** demonstrate that Firebase v13 is present in `node_modules`, and `.env.local` contains active Firebase web credentials for project `heritage-hunt-2c719`. However, no `src/config/firebase.ts` file exists to initialize Firebase or Firestore.
   * **Inference:** Firebase initialization and Firestore service abstraction must be created in Sprint 2. A hybrid fallback/mock state adapter should also be provided as planned in `docs/IMPLEMENTATION_PLAN.md` (Task 2.2) to prevent development blocking when offline.

4. **Observation 3 & package.json** show that `react-router-dom` is not installed, but `vercel.json` provides an SPA rewrite rule (`/(.*) -> /index.html`).
   * **Inference:** Application navigation between Player view (`/play`), GM War Room (`/gm`), and Landing/Lobby (`/`) can be achieved cleanly via a lightweight URL pathname parser (`window.location.pathname`) or state switcher without introducing unnecessary routing library bloat.

5. **Observation 3 & index.css** show that Leaflet CSS is loaded in `index.html` and custom team radar pulse keyframes are defined in `src/index.css`.
   * **Inference:** The CSS foundation for dark-mode map markers and pulsating radar pins is already established. Leaflet markers must use `L.divIcon` as mandated by `.agent/rules/vibe-coding.md` to avoid missing PNG asset 404s.

---

## 3. Caveats

1. **Node.js Path in Shell:** In child PowerShell processes, Node is installed at `C:\Program Files\nodejs`. Commands like `npm` or `node` must be executed with full path or with `$env:PATH = "C:\Program Files\nodejs;" + $env:PATH;`.
2. **Firebase Rules & Live DB:** While valid Firebase API keys are present in `.env.local`, live Firestore rules from `docs/SECURITY_AND_DEPLOYMENT.md` must be active in the Firebase console for authenticated writes. A local fallback mock state adapter is essential for continuous development and test suites.
3. **No git.exe in Standard User Path:** While MinGit was mentioned in Task 1.1, `git` was not found in the immediate execution path. Local build and lint scripts (`npm run build`, `npm run lint`) run independently of git.

---

## 4. Conclusion

The `heritage-hunt` codebase is in an ideal initial state:
- **Baseline (Sprint 1) is 100% complete and healthy:** Clean build (0 TypeScript errors), clean lint (0 warnings), all 10 required dependencies installed, Tailwind v4 + Leaflet CSS configured, and detailed SDLC specs in place.
- **Sprint 2 (Data & Services) is the immediate next step:**
  1. Define TypeScript interfaces in `src/types/index.ts`.
  2. Implement Firebase client and mock adapter in `src/config/firebase.ts`.
  3. Implement client-side photo compression (`<= 150KB Base64`) and EXIF GPS parser in `src/services/imageCompression.ts`.
  4. Implement real-time Firestore listeners and CRUD in `src/services/gameService.ts`.
- **Sprint 3 (Map & Melaka Geo) follows:** Pre-populate Melaka zones in `src/data/melakaZones.ts`, implement throttled geolocation hook (`useGeolocation.ts`), and build `HuntMap.tsx`.

---

## 5. Verification Method

To independently verify all findings:

1. **Verify TypeScript Compilation & Production Build:**
   ```powershell
   $env:PATH = "C:\Program Files\nodejs;" + $env:PATH; cd C:\Users\User\Projects\heritage-hunt; npm run build
   ```
   *Expected Result:* Exit code 0, Vite reports ~20 modules transformed and bundle generated in `dist/`.

2. **Verify Code Quality & Linting:**
   ```powershell
   $env:PATH = "C:\Program Files\nodejs;" + $env:PATH; cd C:\Users\User\Projects\heritage-hunt; npm run lint
   ```
   *Expected Result:* Exit code 0, 0 warnings and 0 errors.

3. **Verify Dependency Resolution in Node:**
   ```powershell
   & "C:\Program Files\nodejs\node.exe" -e "['firebase/app', 'firebase/firestore', 'firebase/auth', 'leaflet', 'react-leaflet', 'browser-image-compression', 'exifr', 'canvas-confetti', 'qrcode.react', 'lucide-react'].forEach(p => console.log(p, require.resolve(p)))"
   ```
   *Expected Result:* All modules resolve to valid paths inside `node_modules`.

4. **Verify Existing Source Files:**
   Inspect `src/` to confirm that only `main.tsx`, `App.tsx`, `App.css`, `index.css`, and `assets/` exist.
