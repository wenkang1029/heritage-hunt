# Melaka Heritage Photo Hunt - Codebase Survey Analysis

**Survey Date:** 2026-10-14  
**Explorer:** explorer_codebase_survey  
**Codebase Root:** `C:\Users\User\Projects\heritage-hunt`  
**Execution Environment:** Windows (PowerShell), Node.js v24.20.0, npm 11.19.0 located at `C:\Program Files\nodejs`

---

## 1. Executive Summary

A comprehensive architectural and code inspection of the `heritage-hunt` repository was conducted. 

### Key Findings:
1. **Foundation & Toolchain (Sprint 1 Completed):**
   - The Vite 8 + React 19 + TypeScript + Tailwind CSS v4 environment is initialized and fully functional.
   - Production build (`npm run build` executing `tsc -b && vite build`) compiles with **0 errors in 279ms**.
   - Linter (`oxlint`) checks all files with **0 errors and 0 warnings**.
   - All specified third-party dependencies (Firebase, Leaflet, React-Leaflet, Lucide-React, Browser-Image-Compression, Exifr, Canvas-Confetti, QRCode.React) are installed in `node_modules` and verified importable.
   - Comprehensive SDLC documentation exists under `docs/` (`PRD.md`, `ARCHITECTURE.md`, `IMPLEMENTATION_PLAN.md`, `SECURITY_AND_DEPLOYMENT.md`).

2. **Application Implementation Status (Sprint 2+ Pending):**
   - `src/App.tsx` remains the default Vite starter counter template.
   - **Zero** domain modules, components, types, or services exist yet under `src/`.
   - **No routing mechanism** is implemented (the app currently loads only the starter template). `vercel.json` has full SPA rewrite support for `/index.html`.
   - Firebase is **not yet initialized** in application code; however, `.env.local` contains valid credentials for Firebase project `heritage-hunt-2c719` and the GM passcode `melaka2026`.
   - There are **no build blockers**. The project is an immaculate clean slate ready for Milestone 1 (Sprint 2) implementation.

---

## 2. Directory Layout & Existing Files Inventory

### Root & Configuration Files
| File Path | Size / Lines | Purpose & Assessment |
| :--- | :--- | :--- |
| `package.json` | 970 B, 40 lines | Dependencies & build scripts. `type: "module"`. |
| `package-lock.json` | 116 KB | Lockfile verifying reproducible dependencies. |
| `tsconfig.json` | 119 B, 8 lines | Project references to `tsconfig.app.json` and `tsconfig.node.json`. |
| `tsconfig.app.json` | 655 B, 27 lines | TypeScript app config: `target: "es2023"`, `moduleResolution: "bundler"`, `verbatimModuleSyntax: true`, `erasableSyntaxOnly: true`, `allowImportingTsExtensions: true`, strict unused locals/params. |
| `tsconfig.node.json` | 558 B, 23 lines | TypeScript config for Vite configuration files. |
| `vite.config.ts` | 220 B, 9 lines | Configured with `@vitejs/plugin-react` and `@tailwindcss/vite`. |
| `.oxlintrc.json` | 245 B | Oxlint fast linter configuration. |
| `vercel.json` | 96 B, 9 lines | SPA rewrite routing `/(.*)` to `/index.html`. |
| `index.html` | 841 B, 18 lines | HTML shell: viewport configured for mobile daylight use (`maximum-scale=1.0, user-scalable=no, viewport-fit=cover`), theme-color `#b91c1c`, Leaflet CSS v1.9.4 CDN stylesheet, entry `/src/main.tsx`. |
| `.env.example` | 462 B, 11 lines | Firebase template env vars. |
| `.env.local` | 932 B, 19 lines | Active Firebase credentials for `heritage-hunt-2c719` and `VITE_GM_PASSCODE=melaka2026`. |
| `AGENTS.md` | 1,133 B, 18 lines | Architectural invariants and reference pointers for AI agents. |
| `README.md` | 2,507 B, 54 lines | Overview, documentation suite index, and local development instructions. |

### Source Files (`src/`)
| File Path | Size / Lines | Status / Content |
| :--- | :--- | :--- |
| `src/main.tsx` | 230 B, 11 lines | Standard React 19 root mounting `App` into `#root` in `StrictMode`. Imports `./index.css`. |
| `src/App.tsx` | 3,646 B, 123 lines | **Default Vite Starter Component**: Counter button and Vite/React documentation links. Must be replaced with application router/shell. |
| `src/App.css` | 2,891 B, 185 lines | Default Vite starter styling. Unused by future application components. |
| `src/index.css` | 777 B, 38 lines | Tailwind CSS v4 `@import "tailwindcss";`, dark body reset, custom `@keyframes team-pulse`, `.team-radar-pin`, and dark theme Leaflet popup styling. |
| `src/assets/hero.png` | 13.05 KB | Default Vite starter asset. |
| `src/assets/react.svg` | 4.12 KB | Default Vite starter asset. |
| `src/assets/vite.svg` | 8.70 KB | Default Vite starter asset. |

### Public Assets (`public/`)
| File Path | Size | Description |
| :--- | :--- | :--- |
| `public/favicon.svg` | 9.52 KB | Vite template SVG icon. |
| `public/icons.svg` | 5.03 KB | Vite template SVG symbol definitions (`bluesky`, `discord`, `documentation`, `github`, `social`, `x`). |

### Documentation Files (`docs/` & `.agent/`)
| File Path | Description |
| :--- | :--- |
| `docs/PRD.md` | Requirements for Player View (`/play`), GM War Room (`/gm`), Melaka landmarks, camera capture, compression <= 150KB Base64, review queue, Leaflet map with radar. |
| `docs/ARCHITECTURE.md` | System context, Firestore data schema (`games/{gameId}`, `teams`, `clues`, `submissions`), Base64 storage architecture, GPS 15s throttling, Haversine formula. |
| `docs/IMPLEMENTATION_PLAN.md` | 6-Sprint roadmap detailing WBS tasks from environment baseline through deployment. |
| `docs/SECURITY_AND_DEPLOYMENT.md` | Firestore security rules with size checks (`< 300000`), env specs, and Vercel deployment instructions. |
| `.agent/rules/vibe-coding.md` | Coding invariants: mobile-first daylight visibility, zero cloud cost, 15s GPS throttle, Leaflet `L.divIcon` requirement. |

---

## 3. Dependency Inventory & Verification

Verification was executed via Node.js module resolution tests against `node_modules`:

| Dependency | Specified Version | Node Resolution Check | Purpose |
| :--- | :--- | :--- | :--- |
| `react` | `^19.2.8` | **PASS** | UI framework |
| `react-dom` | `^19.2.8` | **PASS** | DOM rendering engine |
| `firebase` | `^13.0.0` | **PASS** (`firebase/app`, `firebase/firestore`, `firebase/auth`) | Realtime database & anonymous auth |
| `leaflet` | `^1.9.4` | **PASS** | Interactive mapping library |
| `react-leaflet` | `^5.0.0` | **PASS** | React Leaflet bindings |
| `@types/leaflet` | `^1.9.22` | **PASS** | TypeScript definitions for Leaflet |
| `lucide-react` | `^1.57.0` | **PASS** | Icons suite |
| `browser-image-compression` | `^2.0.2` | **PASS** | In-browser image compression (<= 150KB Base64) |
| `exifr` | `^7.1.3` | **PASS** | Client-side EXIF GPS coordinate extraction |
| `canvas-confetti` | `^1.9.4` | **PASS** | Celebratory confetti on clue approval |
| `@types/canvas-confetti` | `^1.9.0` | **PASS** | Confetti TypeScript typings |
| `qrcode.react` | `^4.2.0` | **PASS** | QR code generation for Team PIN join |
| `@tailwindcss/vite` | `^4.3.3` | **PASS** | Tailwind CSS v4 Vite compiler plugin |
| `tailwindcss` | `^4.3.3` | **PASS** | Tailwind CSS v4 core engine |
| `vite` | `^8.3.0` | **PASS** | Build tool and dev server |
| `typescript` | `~6.0.2` | **PASS** | TypeScript typechecker |
| `oxlint` | `^1.81.0` | **PASS** | High performance linter |

---

## 4. Architectural Analysis & Current Implementation Status

### 4.1 Routing & Navigation Status
- **Current State:** No routing mechanism is configured.
- **Specification:**
  - Route `/play` (or `/play?pin=XXXX`): Mobile Player Experience.
  - Route `/gm`: Game Master War Room Dashboard.
  - Route `/`: Welcome / Role Selection Landing Page.
- **Observations:**
  - `react-router-dom` is **not** included in `package.json`.
  - `vercel.json` has a rewrite rule sending all URLs (`/(.*)`) to `/index.html`.
  - **Recommendation:** Implement client-side routing via either lightweight HTML5 History / URL path inspection (`window.location.pathname`) or state-driven tab/view controller. Since Vite SPA with Vercel rewrites supports clean paths (`/play`, `/gm`), a lightweight router hook or small router component is easily maintained without bloating dependencies.

### 4.2 Firebase & State Architecture
- **Current State:** Firebase SDK is installed (`firebase@13.0.0`), but no initialization code or Firestore client exists.
- **Configuration Available:** `.env.local` contains valid production-ready keys:
  - `VITE_FIREBASE_API_KEY`
  - `VITE_FIREBASE_AUTH_DOMAIN` (`heritage-hunt-2c719.firebaseapp.com`)
  - `VITE_FIREBASE_PROJECT_ID` (`heritage-hunt-2c719`)
  - `VITE_FIREBASE_STORAGE_BUCKET` (`heritage-hunt-2c719.firebasestorage.app`)
  - `VITE_FIREBASE_MESSAGING_SENDER_ID` (`917812049429`)
  - `VITE_FIREBASE_APP_ID` (`1:917812049429:web:b9f1b7d42c23deb9f7801c`)
  - `VITE_GM_PASSCODE` (`melaka2026`)
- **Required Architecture:**
  - `src/config/firebase.ts`: Initialize Firebase App, Firestore instance, and Anonymous Auth.
  - Hybrid Mock / Fallback Adapter: As specified in `docs/IMPLEMENTATION_PLAN.md` (Task 2.2), an offline/mock adapter ensures seamless local testing even when offline or testing without live Firestore quotas.
  - Real-time `onSnapshot` listeners for Game (`/games/{gameId}`), Teams (`/games/{gameId}/teams`), Clues (`/games/{gameId}/clues`), and Submissions (`/games/{gameId}/submissions`).

### 4.3 Data Layer & TypeScript Models
- **Current State:** `src/types/` does not exist.
- **Required Models:**
  - `Game`: `id`, `name`, `status` (`lobby` | `active` | `frozen` | `ended`), `startTime`, `durationMinutes`, `passCode`, `zones`.
  - `Zone`: `id`, `name`, `color`, `polygon: [number, number][]`.
  - `Team`: `id`, `name`, `pin`, `color`, `score`, `completedClueIds: string[]`, `currentCoords: { lat: number, lng: number, updatedAt: any }`, `lastActiveAt: any`.
  - `Clue`: `id`, `title`, `zoneId`, `points`, `targetPhotoBase64`, `location: { lat: number, lng: number }`, `hint`, `createdAt: any`.
  - `Submission`: `id`, `teamId`, `teamName`, `teamColor`, `clueId`, `clueTitle`, `selfieBase64`, `status` (`pending` | `approved` | `rejected`), `rejectionReason?`, `awardedPoints`, `submittedAt: any`, `reviewedAt: any`.
  - Geolocation interfaces: `Coordinate`, `HaversineDistance`.

### 4.4 Mapping & Leaflet Integration
- **Current State:**
  - Leaflet CSS is linked in `index.html` (line 11).
  - Dark popup styling and pulse animations are ready in `src/index.css`.
  - No map components exist under `src/components/Map/`.
- **Key Invariants:**
  - As stated in `.agent/rules/vibe-coding.md` and `docs/PRD.md`, map icons must use `L.divIcon` with inline SVGs/HTML. Leaflet's default image markers often 404 in Vite bundler environments without asset-loader shims. Using custom `divIcon` prevents broken marker images and enables dynamic team-colored pulsing radar markers.

### 4.5 Image Compression & Client Storage
- **Current State:** `browser-image-compression` and `exifr` are installed; service file `src/services/imageCompression.ts` is not yet created.
- **Constraints:**
  - All submitted photos must compress to **<= 150 KB Base64** in browser before upload.
  - EXIF GPS extraction must parse coordinates from GM uploaded clue photos to auto-populate pin coordinates.

---

## 5. Build & Quality Baseline

| Check | Command | Result | Notes |
| :--- | :--- | :--- | :--- |
| **TypeScript Typecheck & Build** | `tsc -b && vite build` | **PASS (0 errors, 279ms)** | Produced `dist/index.html` (0.93 kB), `dist/assets/index.js` (222.45 kB), `dist/assets/index.css` (10.11 kB). |
| **Linting** | `oxlint` | **PASS (0 errors, 0 warnings)** | 3 files checked with 116 rules in 14ms. |
| **Node.js Environment** | Node v24.20.0, npm 11.19.0 | **PASS** | Installed at `C:\Program Files\nodejs`. Commands require prefixing `$env:PATH = "C:\Program Files\nodejs;" + $env:PATH;` in PowerShell child processes if not globally exposed in current session. |
| **Vite / Tailwind Integration** | Vite 8 + `@tailwindcss/vite` 4.3.3 | **PASS** | `@import "tailwindcss";` compiles correctly. |

---

## 6. Implementation Gap & Roadmap Alignment

| Milestone / Sprint | Task / Module | Exists? | Action Required |
| :--- | :--- | :---: | :--- |
| **Sprint 1: Baseline & SDLC** | Vite, Tailwind, Leaflet CSS, Docs, `.env.local` | **YES** | Completed and verified. |
| **Sprint 2: Data & Core Services** | `src/types/index.ts` | **NO** | Implement data models (Game, Team, Clue, Submission, Zone). |
| | `src/config/firebase.ts` | **NO** | Initialize Firebase App, Auth, Firestore, and fallback mock adapter. |
| | `src/services/imageCompression.ts` | **NO** | Implement `compressPhoto` (<=150KB Base64) and `extractExifGps`. |
| | `src/services/gameService.ts` | **NO** | Implement Firestore CRUD and `onSnapshot` subscriptions. |
| **Sprint 3: Maps & Melaka Geo** | `src/data/melakaZones.ts` | **NO** | Define authentic Melaka polygons, landmark clues, and team color palettes. |
| | `src/hooks/useGeolocation.ts` | **NO** | Implement GPS tracking with 15s throttled Firestore broadcast & Haversine distance. |
| | `src/components/Map/HuntMap.tsx` | **NO** | Interactive Leaflet map with zone polygons, clue pins, and pulsing team markers via `L.divIcon`. |
| **Sprint 4: Player Mobile App** | `src/components/Player/JoinModal.tsx` | **NO** | 4-digit PIN join and QR code handler. |
| | `src/components/Player/PlayerHeader.tsx` | **NO** | Team badge, live score, countdown timer, tab navigation. |
| | `src/components/Player/ClueCard.tsx` | **NO** | Landmark teasers, point badges, hint toggle. |
| | `src/components/Player/SelfieCapture.tsx` | **NO** | Camera trigger, compression progress, submission status banner, confetti celebration. |
| **Sprint 5: GM War Room** | `src/components/GM/GMLoginModal.tsx` | **NO** | Passcode authentication (`melaka2026`). |
| | `src/components/GM/WarRoomMap.tsx` | **NO** | Realtime radar map of all teams. |
| | `src/components/GM/VerificationQueue.tsx` | **NO** | Side-by-side comparison modal with Approve / Reject / Bonus actions and distance proximity. |
| | `src/components/GM/ClueManager.tsx` | **NO** | Bulk clue photo uploader with EXIF GPS pin extraction. |
| | `src/components/GM/TeamManager.tsx` | **NO** | Team generator with color picker and QR codes. |
| | `src/components/GM/Leaderboard.tsx` | **NO** | Live rankings and "Freeze Leaderboard" toggle. |
| **Sprint 6: Polish & QA** | E2E Integration & Responsive QA | **NO** | Mobile viewport checks (375px-430px) and multi-team simulation. |
