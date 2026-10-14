# BRIEFING — 2026-10-14T15:28:30Z

## Mission
Design Firebase client initialization, Hybrid Mock Adapter (in-memory + localStorage + BroadcastChannel), unified GameService routing, and Haversine formula calculation for Milestone 1.

## 🔒 My Identity
- Archetype: explorer
- Roles: explorer, investigator, architect
- Working directory: C:\Users\User\Projects\heritage-hunt\.agents\teamwork\m1_explorer_services
- Original parent: 474d6027-a627-4b87-8d49-df9a413881d8
- Milestone: Milestone 1 (Data Layer, Core Services & Mock Adapter)

## 🔒 Key Constraints
- Read-only investigation — do NOT implement directly in `src/`
- All outputs (architecture blueprints, interfaces, mock designs, analysis) written to working directory
- Design must provide full feature fidelity for both live Firebase Firestore (with Anonymous Auth & offline persistence) and Mock Adapter (in-memory + localStorage + BroadcastChannel)
- Mirror Firestore real-time `onSnapshot` semantics cleanly

## Current Parent
- Conversation ID: 474d6027-a627-4b87-8d49-df9a413881d8
- Updated: not yet

## Investigation State
- **Explored paths**: `PROJECT.md`, `ORIGINAL_REQUEST.md`, `package.json`, `.env.example`, `.env.local`, `docs/ARCHITECTURE.md`, `docs/IMPLEMENTATION_PLAN.md`, `docs/SECURITY_AND_DEPLOYMENT.md`, `m1_explorer_types_data/analysis.md`, `m1_explorer_types_data/test_types.ts`.
- **Key findings**:
  1. Firebase v13.0.0 supports modern `persistentLocalCache({ tabManager: persistentMultipleTabManager() })`.
  2. Mock Adapter requires three-layer sync: in-memory state listeners, `localStorage` persistence, and `BroadcastChannel` with `storage` event fallback.
  3. `gameService.ts` seamlessly toggles between Firestore and Mock Adapter based on URL param (`?mock=true`), environment flags, or credential presence.
  4. Haversine distance formula validated against Melaka landmarks (Dutch Square to A Famosa = 323m, Dutch Square to Christ Church = 31m).
  5. Harmonized with Explorer 1's strict models in `m1_explorer_types_data`.
- **Unexplored areas**: None remaining for Milestone 1 services scope.

## Key Decisions Made
- Designed complete drop-in blueprints for `src/services/firebase.ts`, `src/services/mockAdapter.ts`, `src/services/gameService.ts`, and `src/utils/haversine.ts`.
- Formulated atomic transaction flow for photo review verification (status update + score increment + completed clue union).
- Documented multi-tab verification steps in `handoff.md`.

## Artifact Index
- `DISPATCH.md` — Record of parent dispatch message
- `BRIEFING.md` — Working memory and context
- `progress.md` — Heartbeat tracking
- `analysis.md` — Complete architectural designs and implementation blueprint
- `handoff.md` — 5-component handoff report
