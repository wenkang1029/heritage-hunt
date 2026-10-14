# Original User Request

## Initial Request — 2026-10-14T15:07:46Z

Build a mobile-first, real-time web application for an interactive outdoor photo scavenger hunt across historical Melaka (Jonker Street, Dutch Square, A Famosa, Jalan Tokong, and St. Paul's Hill), featuring dedicated Game Master (GM) and Player team experiences.

Working directory: C:\Users\User\Projects\heritage-hunt
Integrity mode: development

References:
- Requirements & Specifications: docs/PRD.md
- Architecture & Data Schema: docs/ARCHITECTURE.md
- Implementation Plan: docs/IMPLEMENTATION_PLAN.md

## Requirements

### R1. Player Mobile Experience (`/play`)
A mobile-optimized, daylight-friendly interface for scavenger hunt teams. Players join frictionless via a 4-digit PIN or QR code with a nickname. An interactive Leaflet map displays heritage zones, clue markers, live GPS position, and approximate radar positions of other teams (throttled to 15s). Players can browse clue cards with cropped landmark teasers, take selfies using the native camera, compress them client-side to <= 150 KB Base64, submit them, and receive live approval alerts with celebratory confetti.

### R2. Game Master (GM) War Room (`/gm`)
A wide-screen dashboard for event organizers secured by a master passcode. Features:
- Live War Room radar map showing moving teams in assigned high-contrast colors.
- Real-time photo verification queue with side-by-side comparison (target clue vs player selfie) and 1-click actions: Approve (+points), Reject, or Award Bonus.
- Clue & Zone Manager with bulk photo upload and automatic EXIF GPS coordinate extraction to drop pins on the map.
- Team generator with automatic 4-digit PINs, high-contrast color assignment, and printable/screen-displayable QR codes.
- Live Leaderboard with countdown timer controls and a "Freeze Leaderboard" toggle for late-game suspense.

### R3. Real-Time Cloud Firestore Integration & Zero-Paid-Cost Storage
Complete integration with Firebase Firestore using real-time `onSnapshot` listeners and Anonymous Auth. Photos must be compressed and stored directly within Firestore documents as Base64 strings to eliminate external paid storage dependencies.

## Acceptance Criteria

### Build & Code Quality
- [ ] TypeScript compiles cleanly with zero errors (`npm run build`).
- [ ] All Leaflet icons use custom styled HTML/SVG `divIcon` with no broken image URLs.

### Functional Verification
- [ ] Players can join with PIN and see clue pins on the Melaka map.
- [ ] Taking a selfie compresses the image in-browser to under 150 KB and creates a pending submission.
- [ ] GM dashboard displays new submissions in real-time without requiring a page refresh.
- [ ] GM approving a submission instantly increments the team's score on both the GM and player views.
- [ ] Player GPS updates broadcast periodically to the GM radar map.
