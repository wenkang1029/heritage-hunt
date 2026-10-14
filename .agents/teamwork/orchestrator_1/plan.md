# Orchestration Plan: Heritage Hunt

## Objective
Deliver a production-ready, mobile-first, real-time web application for an interactive outdoor photo scavenger hunt across historical Melaka, satisfying all R1, R2, R3 requirements, with verified zero TypeScript build errors, styled SVG Leaflet icons, client-side selfie compression <= 150KB, real-time Firestore integration, and comprehensive verification.

## Phases
1. **Phase 0: Survey & Scope Mapping**
   - Survey docs and existing code via 3 parallel subagents (1 Spec Miner, 2 Explorers).
   - Produce unified feature inventory and architecture baseline in `PROJECT.md`.
2. **Phase 1: Decomposition & Track Setup**
   - Define milestones (M1: Core Models & Firebase/Offline Services; M2: Player Experience /play; M3: GM War Room /gm & Live Verification; M4: E2E Integration & Polish).
   - Establish E2E testing framework and opaque-box test suites.
3. **Phase 2: Milestone Iteration Loop**
   - Execute each milestone using the Explorer -> Worker -> Reviewer -> Challenger -> Auditor cycle.
   - Enforce clean build, zero TypeScript errors, and zero integrity violations.
4. **Phase 3: E2E Verification & Adversarial Hardening**
   - Run end-to-end verification covering all acceptance criteria.
   - Forensic audit and adversarial coverage hardening.
5. **Phase 4: Final Synthesis & Parent Reporting**
   - Present final results with full verification logs and handoff report.
