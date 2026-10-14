# AGENTS.md - Workspace Agent Instructions

## Melaka Heritage Photo Scavenger Hunt (`heritage-hunt`)

Welcome, Agent. This workspace contains the full-stack codebase for the Melaka Heritage Photo Scavenger Hunt web app.

### Project References
- **PRD:** [`docs/PRD.md`](file:///C:/Users/User/Projects/heritage-hunt/docs/PRD.md)
- **Architecture:** [`docs/ARCHITECTURE.md`](file:///C:/Users/User/Projects/heritage-hunt/docs/ARCHITECTURE.md)
- **SDLC Roadmap:** [`docs/IMPLEMENTATION_PLAN.md`](file:///C:/Users/User/Projects/heritage-hunt/docs/IMPLEMENTATION_PLAN.md)
- **Vibe Coding Rules:** [`.agent/rules/vibe-coding.md`](file:///C:/Users/User/Projects/heritage-hunt/.agent/rules/vibe-coding.md)

### Key Architectural Invariants
1. **Frontend:** React 19 + TypeScript + Vite + Tailwind CSS v4 + Leaflet.
2. **Backend:** Firebase Firestore (Realtime `onSnapshot`), Anonymous Auth.
3. **Storage Strategy:** Zero paid storage. Photos are compressed client-side to <= 150KB Base64 and stored directly inside Firestore documents.
4. **GPS Strategy:** Throttled to 15s intervals to protect player battery life and mobile network data.
