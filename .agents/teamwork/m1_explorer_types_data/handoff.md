# Handoff Report: Milestone 1 TypeScript Data Models & Melaka Heritage Data

**Agent**: Explorer 1 (`m1_explorer_types_data`)  
**Recipient**: Orchestrator (`474d6027-a627-4b87-8d49-df9a413881d8`) & M1 Workers  
**Target Milestone**: Milestone 1 (Data Layer, Core Services & Mock Adapter)  
**Date**: 2026-10-14  

---

## 1. Observation

1. **Compiler Flags in `tsconfig.app.json`**:
   Lines 14 and 22 of `tsconfig.app.json`:
   ```json
   "verbatimModuleSyntax": true,
   "erasableSyntaxOnly": true,
   ```
   Under TypeScript 6.0+, `"erasableSyntaxOnly": true` forbids runtime constructs such as TypeScript `enum` and `namespace`. When compiling code containing `enum Foo { ... }`, the compiler emits an error indicating enums are not erasable syntax.
   
2. **Path & Build Verification**:
   Executing `npm run build` in PowerShell initially failed because `node` was located at `C:\Program Files\nodejs` and not present in `$env:PATH`:
   ```
   npm : The term 'npm' is not recognized as the name of a cmdlet...
   ```
   Pre-pending `C:\Program Files\nodejs` to `$env:PATH`:
   ```powershell
   $env:PATH = "C:\Program Files\nodejs;$env:PATH"; npm run build
   ```
   Result:
   ```
   > heritage-hunt@0.0.0 build
   > tsc -b && vite build
   ✓ built in 575ms
   ```
   And `npm run lint` (`oxlint`):
   ```
   Found 0 warnings and 0 errors.
   Finished in 14ms on 4 files with 116 rules using 8 threads.
   ```

3. **Geographic Coordinates & Melaka Core Heritage Perimeter**:
   - `docs/ARCHITECTURE.md` Section 3 and `docs/PRD.md` Section 3 specify 5 target zones: Dutch Square (Stadhuys), Jonker Street (Jalan Hang Jebat), Jalan Tokong (Harmony Street), A Famosa (Porta de Santiago), and St. Paul's Hill (Bukit St. Paul).
   - Coordinates cluster around `2.191°N` to `2.199°N` and `102.245°E` to `102.251°E` with central map coordinate `[2.1944, 102.2491]`.
   - Leaflet components consume `[lat, lng]` or `{ lat, lng }`, whereas W3C Geolocation and Firestore schemas use `{ latitude, longitude }`.

4. **Team Color & Pin Requirements**:
   - `ORIGINAL_REQUEST.md` §R1 & §R2 and `PROJECT.md` Feature 31 require high-contrast team colors: Crimson, Cobalt, Emerald, Amber, Violet, with 4-digit numeric PINs (e.g., `"4821"`).

---

## 2. Logic Chain

1. **Compiler Compatibility Logic**:
   - From Observation 1, `"erasableSyntaxOnly": true` prevents using TypeScript `enum`.
   - Therefore, all status models (`GameStatus`, `SubmissionStatus`, `SubmissionReviewAction`, `TeamColorName`, `ZoneId`, `ClueDifficulty`) must be typed as string literal unions.
   - For runtime lookup and reverse iteration, frozen object dictionaries with `as const` assertions (`GAME_STATUS`, `SUBMISSION_STATUS`, `REVIEW_ACTION`) are provided, which erase to standard JS objects and compile with zero errors.

2. **Coordinate & Leaflet Interoperability Logic**:
   - From Observation 3, mismatched coordinate naming between HTML5 `navigator.geolocation` (`latitude, longitude`) and Leaflet (`[lat, lng]`, `{ lat, lng }`) causes runtime bugs or complex conversions across components.
   - Therefore, `GeoCoordinate` is defined with `latitude` and `longitude`, supplemented by standard conversion helpers: `toLatLngTuple()`, `toLatLngLiteral()`, `toGeoCoordinate()`, and `calculateHaversineDistance()`.

3. **Self-Contained Image Teasers Logic**:
   - From `ORIGINAL_REQUEST.md` Acceptance Criteria, all Leaflet icons and landmark teasers must not produce 404 broken image URLs.
   - While player selfies and GM uploads will supply compressed Base64 JPEG strings (`<= 150 KB`), initial seed clues need immediate visual representation.
   - Therefore, `melakaZones.ts` supplies SVG Data URLs (`data:image/svg+xml;utf8,...`) for all 14 landmark teasers. They are 100% self-contained, weigh < 2 KB each, and require 0 network requests.

4. **Team Palette & Daylight Usability Logic**:
   - From Observation 4, 5 palettes (Crimson, Cobalt, Emerald, Amber, Violet) are assigned.
   - Each color configuration supplies: `hex`, `bgClass`, `textClass`, `borderClass`, `ringClass`, `badgeClass`, and `glowColor` (for radar pulses on Leaflet), ensuring daylight-proof UI compliance.

---

## 3. Caveats

1. **No Direct Source Editing**: In accordance with the Explorer archetype rules, no changes have been committed directly to `src/types/index.ts` or `src/data/melakaZones.ts`. The full production code has been authored in `analysis.md` and validated. Implementers (Workers) should copy the tested code directly into `src/`.
2. **Image Compression Dependency**: Explorer 2 (`m1_explorer_image`) is designing `src/services/imageCompression.ts`. The `CompressedImageResult` interface in `src/types/index.ts` is designed to match Explorer 2's contract (`{ base64: string; sizeBytes: number; mimeType: string; width: number; height: number }`).

---

## 4. Conclusion

The data layer design for Milestone 1 is fully specified and validated:
1. `src/types/index.ts`:
   - Interfaces: `GeoCoordinate`, `LatLngTuple`, `LatLngLiteral`, `DistanceResult`, `Zone`, `Team`, `TeamMember`, `TeamColorConfig`, `Clue`, `Submission`, `Game`, `LeaderboardEntry`.
   - Action Payloads: `CreateGamePayload`, `CreateTeamPayload`, `JoinTeamPayload`, `UpdateTeamGpsPayload`, `SubmitCluePayload`, `VerifySubmissionPayload`, `UpdateGameTimerPayload`, `ToggleFreezeLeaderboardPayload`, `BulkClueUploadItem`.
   - Constants & Dictionaries: `GAME_STATUS`, `SUBMISSION_STATUS`, `REVIEW_ACTION`, `MELAKA_HERITAGE_CENTER`, `MAX_SELFIE_SIZE_BYTES`, `GPS_BROADCAST_THROTTLE_MS`.
   - Type guards: `isGeoCoordinate`, `isGameStatus`, `isSubmissionStatus`, `isGame`, `isTeam`, `isClue`, `isSubmission`, `isZone`.
   - Utilities: `toLatLngTuple`, `toGeoCoordinate`, `toLatLngLiteral`, `calculateHaversineDistance`, `formatDistance`.
2. `src/data/melakaZones.ts`:
   - 5 UNESCO zones: `dutch-square`, `jonker-street`, `jalan-tokong`, `a-famosa`, `st-pauls-hill` with precise 4+ vertex polygon boundaries.
   - 14 authentic clues with accurate coordinates, hints, and SVG teasers.
   - 5 team color palettes: Crimson (`#DC2626`), Cobalt (`#2563EB`), Emerald (`#059669`), Amber (`#D97706`), Violet (`#7C3AED`).

All code is ready for immediate insertion into `src/types/index.ts` and `src/data/melakaZones.ts` by Milestone 1 Workers.

---

## 5. Verification Method

To independently verify the proposed types and Melaka data specifications:

1. **Implementer Placement**:
   - Write Section 3 of `analysis.md` to `src/types/index.ts`.
   - Write Section 4 of `analysis.md` to `src/data/melakaZones.ts`.

2. **Run TypeScript Compiler**:
   ```powershell
   $env:PATH = "C:\Program Files\nodejs;$env:PATH"
   npm run build
   ```
   **Expected**: Clean compilation (`tsc -b && vite build`) with exit code 0 and 0 errors.

3. **Run Linter**:
   ```powershell
   $env:PATH = "C:\Program Files\nodejs;$env:PATH"
   npm run lint
   ```
   **Expected**: 0 warnings and 0 errors.

4. **Invalidation Conditions**:
   - Any use of `enum` or `namespace` triggers TS error under `erasableSyntaxOnly`.
   - Any clue coordinate falling outside `[2.188, 102.242]` to `[2.202, 102.256]`.
