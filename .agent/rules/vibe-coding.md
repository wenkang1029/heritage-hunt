# Vibe Coding & Agent Guidelines
## Project: Melaka Heritage Photo Hunt (`heritage-hunt`)

---

## 1. Vibe Coding Core Principles
1. **Speed with Structural Integrity:** Build fast, write clean, modular TypeScript code, and ensure all features are directly testable.
2. **SDLC Documentation Alignment:** Every feature implemented must reflect and update [`docs/IMPLEMENTATION_PLAN.md`](file:///C:/Users/User/Projects/heritage-hunt/docs/IMPLEMENTATION_PLAN.md). Never leave broken specs.
3. **Mobile-First & Sunshine-Proof:** The UI must be optimized for mobile screens (375px - 430px) under bright outdoor sunlight in Melaka:
   - High-contrast colors and large touch targets (>= 48px).
   - High-visibility team badges (Crimson, Cobalt, Emerald, Amber, Violet).
4. **Zero-Cloud-Cost Guarantee:** 
   - Never introduce paid dependencies.
   - Photos must always be compressed client-side to <= 150 KB Base64 and stored directly in Firestore documents to stay 100% within the free Spark plan.
5. **Fail-Safe & Offline-Tolerant:** Old heritage alleys in Melaka may have patchy cellular connection. Always cache UI state and show clear connection status indicators.

---

## 2. Tech Stack Directives
- **React 19 + Vite 8 + TypeScript:** Strict typing. No `any` types for Game, Team, Clue, or Submission models.
- **Tailwind CSS v4:** Use modern Tailwind v4 utilities. Avoid legacy arbitrary classes where semantic tokens exist.
- **Leaflet & OpenStreetMap:** All map icons must use custom styled `L.divIcon` to prevent 404 missing asset images.
- **Firebase / Firestore:** Use real-time `onSnapshot` for queues, scores, and radar tracking. Throttling of GPS updates to 15s is mandatory.

---

## 3. Development Workflow Checklist
Before marking any feature complete:
- [ ] TypeScript compiles cleanly with zero errors (`npm run build`).
- [ ] Both mobile viewport and desktop GM views render without horizontal overflows.
- [ ] Real-time updates sync accurately between Player view and GM War Room.
