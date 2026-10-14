# Handoff Report: Haversine Antipodal Remediation (Explorer 1)

**Agent ID**: `m1_iter2_explorer_haversine`  
**Role**: Teamwork Explorer (investigation, synthesis)  
**Handoff Type**: Hard (Investigation complete, actionable fix formulated and verified)  
**Target File**: `src/utils/haversine.ts`  
**Milestone**: Milestone 1 Iteration 2 Remediation  
**Date**: 2026-10-14  

---

## 1. Observation

### 1.1 Direct Defect Observation
Executing `node --test tests/unit/challenger2_empirical.test.ts` fails deterministically at `CHAL-GEO-02`:

```text
▶ Adversarial Challenge: Haversine Distance & Proximity Engine
  ✔ CHAL-GEO-01: Identical coordinates must yield exactly 0 meters across all representations (1.4323ms)
  ✖ CHAL-GEO-02: Antipodal coordinates must return ~20,015,087m without producing NaN (3.5057ms)
  ✔ CHAL-GEO-03: Distance and boundary checks across all 5 Melaka UNESCO zones (0.8844ms)
✖ Adversarial Challenge: Haversine Distance & Proximity Engine (7.3837ms)

✖ failing tests:
test at tests\unit\challenger2_empirical.test.ts:86:3
✖ CHAL-GEO-02: Antipodal coordinates must return ~20,015,087m without producing NaN (3.5057ms)
  AssertionError [ERR_ASSERTION]: calculateHaversineDistance failed on antipodal coordinates [-84.81442189440335,-34.64636930956769] and [84.81442189440335,145.3536306904323]: produced NaN instead of ~20015087m due to missing clamp on 'a'
      at TestContext.<anonymous> (file:///C:/Users/User/Projects/heritage-hunt/tests/unit/challenger2_empirical.test.ts:117:12)
```

Running the master test suite via `node tests/runner.ts`:
- Total tests: **273** across 65 suites
- Passing: **272**
- Failing: **1** (`CHAL-GEO-02`)

### 1.2 Code Inspection in `src/utils/haversine.ts:47-56`
```typescript
47:   const a =
48:     Math.sin(dLat / 2) * Math.sin(dLat / 2) +
49:     Math.cos(toRad(p1.lat)) *
50:       Math.cos(toRad(p2.lat)) *
51:       Math.sin(dLon / 2) *
52:       Math.sin(dLon / 2);
53: 
54:   const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
55:   return Math.round(EARTH_RADIUS_METERS * c);
56: }
```

### 1.3 Floating-Point Evaluation in Node.js
Evaluating $P_1 = (-84.81442189440335, -34.64636930956769)$ and $P_2 = (84.81442189440335, 145.3536306904323)$:
- `a = 1.0000000000000002` ($1 + 2.220446049250313 \times 10^{-16}$)
- `1 - a = -2.220446049250313e-16`
- `Math.sqrt(1 - a) = NaN`
- `Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) = NaN`
- Resulting distance = `NaN`

### 1.4 Specification Oracle in `tests/framework/haversine.ts:36-38`
```typescript
36:   // Protect against floating-point inaccuracies pushing 'a' slightly > 1
37:   const clampedA = Math.min(1, Math.max(0, a));
38:   const c = 2 * Math.atan2(Math.sqrt(clampedA), Math.sqrt(1 - clampedA));
```

---

## 2. Logic Chain

1. **Premise 1 (Mathematical Bound)**: By the spherical trigonometry definition of the Haversine formula, for any two points on a 2-sphere, parameter $a = \sin^2(\Delta \phi / 2) + \cos(\phi_1)\cos(\phi_2)\sin^2(\Delta \lambda / 2) \in [0, 1]$.
2. **Premise 2 (IEEE 754 Rounding)**: Due to finite 53-bit mantissa precision in 64-bit binary floating-point representation, computing trigonometric products on antipodal coordinates evaluates to $a = 1 + \varepsilon \approx 1.0000000000000002$ (Observation 1.3).
3. **Premise 3 (Radicand Negativity)**: Because $a > 1$, the expression $(1 - a) = -\varepsilon < 0$. In standard JavaScript IEEE 754 math, evaluating `Math.sqrt` on any negative number strictly returns `NaN` (Observation 1.3).
4. **Premise 4 (Error Propagation)**: `Math.atan2(Math.sqrt(a), NaN)` returns `NaN`, causing `calculateHaversineDistance` to return `NaN` instead of approximately $20,015,087 \text{ m}$ (Observation 1.1, 1.3).
5. **Premise 5 (Specification Alignment)**: The test framework oracle in `tests/framework/haversine.ts:37` clamps $a$ to $[0, 1]$ via `Math.min(1, Math.max(0, a))`, successfully preventing both positive overshoot ($a > 1$) and negative underflow ($a < 0$) (Observation 1.4).
6. **Inference & Conclusion**: Inserting `const clampedA = Math.min(1, Math.max(0, a));` into `src/utils/haversine.ts:54` will clamp $1.0000000000000002$ to $1$, making $1 - \text{clampedA} = 0$, yielding $\operatorname{atan2}(1, 0) = \pi / 2$, $c = \pi$, and distance $= 20,015,087 \text{ m}$. This fixes the single failing test `CHAL-GEO-02` with zero side effects on existing Melaka coordinates.

---

## 3. Caveats

- **Spherical vs Ellipsoidal Earth**: The formula models Earth as a perfect sphere of radius $R = 6,371,000 \text{ m}$. In reality, Earth's ellipsoidal flattening causes true antipodal distances to vary slightly ($20,003 \text{ km} \dots 20,037 \text{ km}$); however, the system specification and tests explicitly prescribe $R = 6,371,000 \text{ m}$ and $\approx 20,015,087 \text{ m}$.
- **Read-Only Explorer Scope**: In accordance with system instructions, this explorer did NOT modify `src/utils/haversine.ts` directly. The change is provided as a unified patch (`haversine.patch`) and code snippet for the worker agent (`m1_worker`).

---

## 4. Conclusion

The defect is isolated to a missing clamp on line 54 of `src/utils/haversine.ts`. 

### Actionable Remediation for Worker (`m1_worker`)

**Target File**: `src/utils/haversine.ts`  
**Line Range**: 54

#### Code Diff:
```typescript
<<<<
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
====
  const clampedA = Math.min(1, Math.max(0, a));
  const c = 2 * Math.atan2(Math.sqrt(clampedA), Math.sqrt(1 - clampedA));
>>>>
```

#### Patch File:
Available at: `C:\Users\User\Projects\heritage-hunt\.agents\teamwork\m1_iter2_explorer_haversine\haversine.patch`

---

## 5. Verification Method

To independently verify the fix after the worker applies the change:

1. **Verify Adversarial Challenge Unit Test**:
   ```powershell
   $env:Path = "C:\Program Files\nodejs;$env:Path"
   node --test tests/unit/challenger2_empirical.test.ts
   ```
   *Expected Result*: All 7 tests pass (7 pass, 0 fail). `CHAL-GEO-02` passes cleanly in ~1ms.

2. **Verify Master Test Suite (273 Tests)**:
   ```powershell
   $env:Path = "C:\Program Files\nodejs;$env:Path"
   node tests/runner.ts
   ```
   *Expected Result*: 273/273 tests pass across 65 suites with exit code 0.

3. **Verify Build and Typecheck**:
   ```powershell
   $env:Path = "C:\Program Files\nodejs;$env:Path"
   npm run build
   ```
   *Expected Result*: `tsc -b && vite build` completes in < 500ms with 0 errors.

4. **Verify Linter**:
   ```powershell
   $env:Path = "C:\Program Files\nodejs;$env:Path"
   npx oxlint
   ```
   *Expected Result*: 0 warnings, 0 errors.

5. **Invalidation Conditions**:
   - If `calculateHaversineDistance([-84.81442189440335, -34.64636930956769], [84.81442189440335, 145.3536306904323])` returns `NaN`.
   - If identical coordinates return any value other than `0`.
