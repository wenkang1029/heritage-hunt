# Product Requirements Document (PRD)
## Project: Melaka Heritage Photo Hunt (`heritage-hunt`)

---

## 1. Executive Summary & Vision
**Melaka Heritage Photo Hunt** is a mobile-first, real-time web application designed to facilitate an interactive outdoor photo scavenger hunt in the historical core of Melaka, Malaysia (covering Jonker Street, Dutch Square / Stadhuys, A Famosa, Jalan Tokong, and St. Paul's Hill). 

The application serves two distinct user roles:
1. **Game Master (GM):** Organizes the event, sets game rules/zones, bulk-uploads clue photos with GPS metadata, manages teams, monitors live player locations on a radar map, and reviews incoming photo submissions in real time.
2. **Players (Teams):** Participants explore Melaka on foot, identify landmark details from cropped clue photos, take team selfies at the designated spots, upload selfies with instant client-side compression, and track their ranking on a live leaderboard.

---

## 2. User Personas & Core Journeys

### Persona A: Game Master (GM) - Event Organizer
* **Device:** Laptop / Tablet (wide screen)
* **Needs:**
  - Fast game configuration (game timer, zone boundaries, number of teams).
  - Bulk clue upload with automatic EXIF GPS coordinate extraction to drop pins on the map.
  - Team management with auto-generated 4-digit PINs and printable/screen-displayable QR codes.
  - Real-time "War Room" dashboard with:
    - Live radar map showing all team positions in their respective team colors.
    - Live verification queue with side-by-side comparison of Target Clue vs Team Selfie.
    - One-click actions: **Approve (+Points)**, **Reject**, **Award Bonus**.
    - Leaderboard control (including a "Freeze Leaderboard" toggle for dramatic suspense in the final minutes).

### Persona B: Player (Team Member) - Scavenger Hunter
* **Device:** Smartphone (iOS Safari / Android Chrome) under outdoor daylight conditions.
* **Needs:**
  - Frictionless onboarding: Scan QR code or enter Team PIN + Nickname (no passwords, emails, or account registration).
  - Interactive Melaka Map: Displays historic zones, clue pins, their own position, and approximate positions of rival teams.
  - Clue Browser: Card view and map view of cropped architectural details/murals with point values.
  - Camera Capture: Native mobile camera shutter trigger (`capture="environment"`).
  - Real-time Feedback: Instant upload confirmation, live approval alerts with confetti, and live score updates.

---

## 3. Geographic Scope & Target Zones
The event takes place across the UNESCO World Heritage zone of Melaka:
1. **Dutch Square / Stadhuys:** Red shophouses, Christ Church, Victoria Queen Fountain, Tan Beng Swee Clock Tower.
2. **Jonker Street (Jalan Hang Jebat):** Heritage shophouse murals, antique facades, stage square.
3. **Jalan Tokong (Harmony Street):** Cheng Hoon Teng Temple, Kampung Kling Mosque, Sri Poyyatha Vinayagar Moorthi Temple.
4. **A Famosa & Porta de Santiago:** Historical Portuguese fortress ruins and Santiago gate.
5. **St. Paul’s Hill (Bukit St. Paul):** Historic church ruins, St. Francis Xavier statue, Dutch tombstones.

---

## 4. Functional Requirements

### FR-1: Authentication & Access Control
- **FR-1.1:** GM access secured via GM Master Passcode (configurable).
- **FR-1.2:** Team access via unique 4-digit numeric PIN or direct QR code URL (`/play?pin=XXXX`).
- **FR-1.3:** Anonymous Firebase Authentication ensures each participant has a unique authenticated session without credential friction.

### FR-2: Game State & Lifecycle
- **FR-2.1:** Game states: `Lobby` ➔ `Active` ➔ `Frozen` ➔ `Ended`.
- **FR-2.2:** Configurable countdown timer with real-time sync across all connected clients.
- **FR-2.3:** "Freeze Leaderboard" mode hides live score updates from player devices while keeping GM view active.

### FR-3: Clue & Zone Management
- **FR-3.1:** GM can create and edit zones with custom boundary polygons and color tags.
- **FR-3.2:** Clues support title, point value, zone tag, location coordinates (latitude/longitude), hint text, and target photo.
- **FR-3.3:** Bulk photo upload extracts EXIF GPS tags using client-side metadata parsing to automatically drop map pins.

### FR-4: Camera, Image Compression & Submissions
- **FR-4.1:** Mobile direct camera capture enforcement (`accept="image/*" capture="environment"`).
- **FR-4.2:** Client-side image compression: Compresses multi-megabyte mobile photos to **<= 150 KB** (max 1024px width, 65% quality) *before* network transmission.
- **FR-4.3:** Direct Firestore storage of compressed Base64 strings, ensuring zero external storage bucket dependencies and zero hosting fees.
- **FR-4.4:** Duplicate submission prevention: Teams cannot re-submit for an already approved clue.

### FR-5: Real-Time Verification Queue
- **FR-5.1:** Instant push notification to GM review queue upon submission.
- **FR-5.2:** Side-by-side modal displaying target clue photo and submitted team selfie.
- **FR-5.3:** GM review actions:
  - `Approve`: Awards clue points to team, marks clue completed.
  - `Reject`: Allows team to retry, provides optional rejection reason.
  - `Bonus`: Awards extra custom points for exceptional creativity.

### FR-6: Interactive Map & Live Radar
- **FR-6.1:** OpenStreetMap base layer rendered via Leaflet (`react-leaflet`).
- **FR-6.2:** Colored zone overlays and interactive clue pins.
- **FR-6.3:** Player live GPS tracking via `navigator.geolocation.watchPosition`.
- **FR-6.4:** Battery-saving GPS throttling: Updates broadcasted to Firestore at 15–30 second intervals.
- **FR-6.5:** Custom team markers with distinct color codes and pulsing radar animations.

---

## 5. Non-Functional Requirements (NFR)

* **NFR-1: Mobile Performance & Responsiveness:** Clean layout on standard mobile screen resolutions (375px to 430px width). Touch targets >= 44x44px.
* **NFR-2: Zero Cloud Costs:** Runs entirely within Firebase Spark free tier (Firestore 1GB, 50k reads/day) and Vercel Hobby free tier (100GB CDN bandwidth).
* **NFR-3: Network Resilience:** Graceful handling of spotty 4G connections in dense Melaka heritage alleys; offline UI indicators and retry queues.
* **NFR-4: Battery Preservation:** GPS throttling and lightweight Leaflet canvas rendering to prevent excessive device heat and battery drain.
