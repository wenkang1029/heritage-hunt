# Project: Heritage Hunt (Melaka Heritage Photo Hunt)

## Architecture
Mobile-first, real-time web application for an interactive outdoor photo scavenger hunt across historical Melaka (Jonker Street, Dutch Square, A Famosa, Jalan Tokong, and St. Paul's Hill), featuring dedicated Game Master (GM) and Player team experiences.

- **Frontend**: React 19 + TypeScript + Vite 8 + Tailwind CSS v4 + Leaflet 1.9 / React-Leaflet 5 + Lucide Icons + Canvas-Confetti + QRCode.React.
- **Backend / Storage**: Firebase Cloud Firestore with real-time `onSnapshot` listeners + Anonymous Authentication + Zero-Paid-Cost client-side compressed Base64 photo storage in documents.
- **Offline / CI Resilience**: Hybrid Mock Adapter (`src/services/mockAdapter.ts`) supporting seamless in-memory + `localStorage` + `BroadcastChannel` operation for development, automated testing, and disconnected field scenarios.
- **Map & Geolocation**: Custom HTML/SVG `L.divIcon` markers with zero 404 image errors, 15s GPS watch throttle, Haversine formula proximity validation.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | GM Passcode Authentication | Secure GM War Room access via `VITE_GM_PASSCODE` (melaka2026) | M3 | ORIGINAL_REQUEST §R2 |
| 2 | Player Frictionless Join | Join game using 4-digit numeric PIN and team nickname | M2 | ORIGINAL_REQUEST §R1 |
| 3 | QR Code Join | Direct QR code scanning encoding join URL with PIN | M2 | ORIGINAL_REQUEST §R1, PRD |
| 4 | Firebase Anonymous Auth | Frictionless session UID satisfying Firestore security rules | M1 | ORIGINAL_REQUEST §R3 |
| 5 | Game State Management | Game creation, status (`draft`, `active`, `paused`, `frozen`, `completed`) | M1 | ARCHITECTURE §Schema |
| 6 | Game Countdown Timer | GM controlled countdown timer with start/pause/reset controls | M3 | PRD §FR-5 |
| 7 | Freeze Leaderboard Toggle | Toggle to hide scores and freeze ranking for late-game suspense | M3 | ORIGINAL_REQUEST §R2 |
| 8 | Melaka Heritage Leaflet Map | Interactive Leaflet map centered at `[2.1944, 102.2491]` with OpenStreetMap tiles | M2 | ORIGINAL_REQUEST §R1 |
| 9 | 5 UNESCO Heritage Zones | Polygon overlays & bounding coordinates for Jonker, Dutch Sq, A Famosa, Tokong, St. Paul's | M1 | PRD §Locations |
| 10 | Custom SVG divIcon Clue Markers | SVG/HTML pins styled with zone colors, zero broken 404 images | M2 | ORIGINAL_REQUEST §AC |
| 11 | Custom SVG divIcon Team Markers | Dynamic team colors and CSS radar pulse animations | M2, M3 | ARCHITECTURE, vibe-coding |
| 12 | Live GPS Position Hook | Browser `navigator.geolocation` tracking with accuracy display | M2 | ARCHITECTURE §Hooks |
| 13 | 15s GPS Broadcast Throttle | Rate-limited GPS write to Firestore to conserve battery & quota | M2 | ORIGINAL_REQUEST §R1 |
| 14 | Radar Map of Other Teams | Approximate/throttled team positions visible on player/GM maps | M2, M3 | ORIGINAL_REQUEST §R1, R2 |
| 15 | Haversine Proximity Check | Client-side distance calculation for clue capture verification | M1, M3 | ARCHITECTURE §Calculations |
| 16 | Clue Discovery & Teaser Cards | Landmark clue cards with cropped teaser, hint text, points | M2 | ORIGINAL_REQUEST §R1 |
| 17 | GM Clue Manager | Create, edit, and delete clues with points, zone, hint, image | M3 | PRD §FR-3 |
| 18 | GM Bulk Clue Upload | Upload reference photos with automatic EXIF GPS extraction | M3 | ORIGINAL_REQUEST §R2 |
| 19 | Manual Map Picker Fallback | Click/drag pin on map when photo lacks EXIF GPS metadata | M3 | IMPLEMENTATION_PLAN |
| 20 | Native Camera Capture | Mobile camera launch using `capture="environment"` input | M2 | ORIGINAL_REQUEST §R1 |
| 21 | In-Browser Canvas Compression | Compress selfie photo to <= 150 KB Base64 (max 1024px, 65% quality) | M1 | ORIGINAL_REQUEST §R1, AC |
| 22 | Selfie Submission Flow | Submit compressed photo + teamId + clueId + GPS coordinates | M2 | ORIGINAL_REQUEST §R1 |
| 23 | Submission State Tracking | Status lifecycle (`pending`, `approved`, `rejected`) | M1 | ARCHITECTURE §Schema |
| 24 | Zero-Cost Base64 Storage | Direct storage of Base64 photos in Firestore documents (0 storage cost) | M1 | ORIGINAL_REQUEST §R3 |
| 25 | Real-Time onSnapshot Sync | Real-time multi-client state updates without page refresh | M1 | ORIGINAL_REQUEST §R3 |
| 26 | Hybrid Mock Adapter | In-memory + localStorage fallback for offline / mock testing | M1 | IMPLEMENTATION_PLAN §2.2 |
| 27 | Real-Time GM Verification Queue | Incoming submissions displayed immediately for GM review | M3 | ORIGINAL_REQUEST §R2 |
| 28 | Side-by-Side Photo Comparison | Reference landmark teaser vs player selfie with distance badge | M3 | ORIGINAL_REQUEST §R2 |
| 29 | 1-Click GM Review Actions | Instant Approve (+points), Reject (reason), or Award Bonus | M3 | ORIGINAL_REQUEST §R2 |
| 30 | Instant Score Synchronization | Score increments immediately reflected on GM & player views | M3, M4 | ORIGINAL_REQUEST §AC |
| 31 | GM Team Generator | Auto-generate teams with 4-digit PINs, high-contrast colors, QR | M3 | ORIGINAL_REQUEST §R2 |
| 32 | Live Leaderboard | Real-time ranked leaderboard with scores and clues found | M3, M4 | PRD §FR-5 |
| 33 | Celebratory Confetti Alert | Confetti burst (`canvas-confetti`) when player submission approved | M2 | ORIGINAL_REQUEST §R1 |
| 34 | App Router & Navigation | Clean client routing (`/`, `/play`, `/gm`, `/leaderboard`) | M4 | IMPLEMENTATION_PLAN §Sprint 5 |
| 35 | Daylight-Proof UI & Touch Targets | High-contrast mobile design with touch targets >= 48px | M4 | vibe-coding.md |
| 36 | End-to-End Test Suite | Comprehensive opaque-box test suites (Tiers 1-4) & adversarial test (Tier 5) | E2E / Final | Dual Track |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Data Layer, Core Services & Mock Adapter | TypeScript types, Melaka zones seed data, image compression & EXIF, Firebase client & Hybrid Mock Adapter | none | PLANNED |
| M2 | Player Mobile Experience (`/play`) | PIN/QR join, Leaflet map with custom SVG divIcon, 15s GPS throttle, clue cards, camera compression <=150KB, selfie submission, confetti | M1 | PLANNED |
| M3 | Game Master War Room (`/gm`) | GM passcode auth, live radar map, real-time photo verification queue, side-by-side comparison, 1-click actions, team generator with QR, clue manager with EXIF bulk upload | M1 | PLANNED |
| M4 | App Shell, Routing & Full Integration | SPA routing (`/`, `/play`, `/gm`, `/leaderboard`), daylight-proof UI, touch targets >= 48px, score sync, clean build & lint | M2, M3 | PLANNED |
| M-Final | E2E Test Suite Pass (Tiers 1-4) & Adversarial Hardening (Tier 5) | Validate 100% pass on E2E test suite and adversarial coverage hardening | M4, E2E Track | PLANNED |

## E2E Testing Track (Parallel)
| Track | Scope | Output | Status |
|-------|-------|--------|--------|
| E2E Testing Track | Requirement-driven opaque-box test runner, Tiers 1-4 test cases (>= 5 per feature, boundary, pairwise, workload) | `TEST_INFRA.md`, `TEST_READY.md`, test suites | IN_PROGRESS |

## Code Layout
```
src/
├── types/
│   └── index.ts                 # Strict TypeScript data models (Game, Team, Clue, Submission, Zone)
├── data/
│   └── melakaZones.ts           # 5 UNESCO Melaka zones, polygons, landmarks, default clues & colors
├── services/
│   ├── firebase.ts              # Firebase app, firestore, auth initialization
│   ├── imageCompression.ts      # Browser canvas compression to <= 150KB Base64 & exifr GPS extraction
│   ├── mockAdapter.ts           # Hybrid Mock Adapter (in-memory + localStorage + BroadcastChannel)
│   └── gameService.ts           # Unified data access layer (Firestore with MockAdapter fallback)
├── hooks/
│   ├── useGeolocation.ts        # 15s throttled GPS watch hook with Haversine distance
│   └── useGameState.ts          # Real-time subscriptions for teams, clues, submissions, gameState
├── components/
│   ├── common/                  # SVG Icons, Badges, Modals, Touch-friendly Buttons
│   ├── map/
│   │   ├── MelakaMap.tsx        # Leaflet interactive map with custom SVG divIcon markers
│   │   └── MapMarkers.ts        # SVG divIcon factory functions (landmarks, teams, user beacon)
│   ├── player/
│   │   ├── PlayerJoin.tsx       # 4-digit PIN + Nickname + QR scanner entry
│   │   ├── ClueDrawer.tsx       # Clue card list with cropped teaser image & zone badge
│   │   ├── CameraCapture.tsx    # Native camera capture + compression <= 150KB preview
│   │   └── PlayerView.tsx       # Complete /play mobile interface with confetti celebration
│   └── gm/
│       ├── GmAuth.tsx           # Passcode lock screen (melaka2026)
│       ├── VerificationQueue.tsx # Side-by-side review cards with 1-click approve/reject/bonus
│       ├── RadarMap.tsx         # Live radar tracking of all teams with team colors & pulse
│       ├── TeamManager.tsx      # Team generator with 4-digit PINs, colors, and QR codes
│       ├── ClueManager.tsx      # Clue list, EXIF GPS bulk upload, map coordinate picker
│       ├── LeaderboardView.tsx  # Live leaderboard with timer controls & freeze toggle
│       └── GmDashboard.tsx      # Complete /gm wide-screen war room tabs
├── App.tsx                      # SPA router (/play, /gm, /leaderboard, /)
├── index.css                    # Tailwind v4, custom radar pulse animations, Leaflet styles
└── main.tsx                     # React root mount
```

## Interface Contracts
### `imageCompression.ts`
- `compressPhoto(file: File): Promise<{ base64: string; sizeBytes: number; mimeType: string }>`
  - Invariant: `sizeBytes <= 150 * 1024` (<= 150 KB Base64 payload).
- `extractExifGps(file: File): Promise<{ latitude: number; longitude: number } | null>`

### `gameService.ts`
- `subscribeToGame(gameId: string, callback: (game: Game) => void): Unsubscribe`
- `subscribeToTeams(gameId: string, callback: (teams: Team[]) => void): Unsubscribe`
- `subscribeToClues(gameId: string, callback: (clues: Clue[]) => void): Unsubscribe`
- `subscribeToSubmissions(gameId: string, callback: (submissions: Submission[]) => void): Unsubscribe`
- `createTeam(gameId: string, name: string, color: string, pin: string): Promise<Team>`
- `joinTeamByPin(gameId: string, pin: string, nickname: string): Promise<{ team: Team; playerId: string }>`
- `updateTeamGps(gameId: string, teamId: string, coords: GeoCoordinate): Promise<void>`
- `submitCluePhoto(gameId: string, submission: Omit<Submission, 'id' | 'status' | 'submittedAt'>): Promise<Submission>`
- `verifySubmission(gameId: string, submissionId: string, action: 'approve' | 'reject' | 'bonus', points?: number, reason?: string): Promise<void>`
- `toggleFreezeLeaderboard(gameId: string, isFrozen: boolean): Promise<void>`
- `updateGameTimer(gameId: string, timeRemainingSeconds: number, status?: GameStatus): Promise<void>`
