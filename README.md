# 🏛️ Melaka Heritage Photo Hunt (`heritage-hunt`)

> A mobile-first, real-time web application for conducting interactive outdoor photo scavenger hunts across the historical core of Melaka (Jonker Street, Dutch Square, A Famosa, Jalan Tokong, and St. Paul's Hill).

---

## 📚 SDLC Documentation Suite

This project follows software development life cycle (SDLC) best practices. Detailed specifications and guides are available in the [`docs/`](file:///C:/Users/User/Projects/heritage-hunt/docs) directory:

1. **[Product Requirements Document (PRD)](file:///C:/Users/User/Projects/heritage-hunt/docs/PRD.md):** User personas, functional requirements, game rules, and scope.
2. **[System Architecture Document (SAD)](file:///C:/Users/User/Projects/heritage-hunt/docs/ARCHITECTURE.md):** System context, tech stack tradeoffs, Firestore data schema, and Base64 compression pipeline.
3. **[Implementation Plan & Roadmap](file:///C:/Users/User/Projects/heritage-hunt/docs/IMPLEMENTATION_PLAN.md):** Phased sprint breakdown, work breakdown structure (WBS), and acceptance criteria.
4. **[Security & Deployment Guide](file:///C:/Users/User/Projects/heritage-hunt/docs/SECURITY_AND_DEPLOYMENT.md):** Firestore security rules, environment variables, and Vercel CI/CD setup.

---

## 🛠️ Tech Stack

* **Frontend:** React 19, TypeScript, Vite 8, Tailwind CSS v4, Lucide Icons
* **Mapping Engine:** Leaflet, `react-leaflet`, OpenStreetMap
* **Backend & Realtime:** Firebase (Cloud Firestore with real-time `onSnapshot` listeners & Anonymous Auth)
* **Image Processing:** `browser-image-compression` (client-side compression <= 150KB Base64), `exifr` (EXIF GPS extractor)
* **Hosting & CI/CD:** Vercel (100% Free Hobby Tier with global CDN)

---

## 🚀 Quick Start for Local Development

### Prerequisites
* **Node.js:** v20+ LTS (Tested on v24 LTS)
* **npm:** v10+

### Installation & Run
```powershell
# Navigate to project directory
cd C:\Users\User\Projects\heritage-hunt

# Install dependencies (already installed)
npm install

# Start local development server
npm run dev
```

Visit `http://localhost:5173` in your browser.

---

## 📱 User Roles & Access

* **Player View (`/play`):** Scan team QR code or enter 4-digit PIN. View interactive map, hunt landmarks, take selfies, and track live ranking.
* **Game Master View (`/gm`):** Access the live War Room with the master passcode (`melaka2026`). Monitor moving teams on radar, review incoming selfies with 1-click approvals, and manage clues.
