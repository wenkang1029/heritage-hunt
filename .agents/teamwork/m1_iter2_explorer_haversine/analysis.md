# Analysis Report: Haversine Antipodal IEEE 754 Precision Fix

**Author**: Explorer 1 (`m1_iter2_explorer_haversine`)  
**Target File**: `src/utils/haversine.ts`  
**Milestone**: Milestone 1 Iteration 2 Remediation  
**Date**: 2026-10-14  

---

## 1. Executive Summary

Milestone 1 was rejected at the review gate due to a single adversarial test failure in `tests/unit/challenger2_empirical.test.ts` (`CHAL-GEO-02`). In `src/utils/haversine.ts:54`, antipodal coordinates cause IEEE 754 floating-point overshoot where parameter $a$ evaluates to $1.0000000000000002$ ($1 + 2.22 \times 10^{-16}$). When calculating $\sqrt{1 - a}$, JavaScript evaluates $\sqrt{-2.22 \times 10^{-16}}$ to `NaN`, propagating through `Math.atan2` and resulting in `NaN` instead of approximately half Earth's circumference ($20,015,087 \text{ m}$).

This investigation formulates the exact mathematical fix, verifies the clamping behavior across identical and antipodal coordinate pairs, and provides the patch specification for the worker to implement.

---

## 2. Root Cause Analysis

### 2.1 The Haversine Great-Circle Formula
The spherical Haversine formula determines the great-circle distance $d$ between points $(\phi_1, \lambda_1)$ and $(\phi_2, \lambda_2)$ with radius $R = 6,371,000 \text{ m}$:

$$\Delta \phi = \phi_2 - \phi_1, \quad \Delta \lambda = \lambda_2 - \lambda_1$$

$$a = \sin^2\left(\frac{\Delta \phi}{2}\right) + \cos(\phi_1)\cos(\phi_2)\sin^2\left(\frac{\Delta \lambda}{2}\right)$$

$$c = 2 \cdot \operatorname{atan2}\left(\sqrt{a}, \sqrt{1 - a}\right)$$

$$d = R \cdot c$$

Mathematically, for any two points on a Euclidean 2-sphere, $a \in [0, 1]$.
- For identical points: $\Delta \phi = 0, \Delta \lambda = 0 \implies a = 0 \implies c = 0 \implies d = 0$.
- For antipodal points (points directly opposite each other through the center of the sphere): $a = 1 \implies \sqrt{1 - a} = 0 \implies c = 2 \cdot \operatorname{atan2}(1, 0) = 2 \cdot (\pi / 2) = \pi \implies d = \pi R \approx 20,015,087 \text{ m}$.

### 2.2 The IEEE 754 Floating-Point Defect
In 64-bit binary floating-point representation (IEEE 754 double precision), trigonometric functions (`Math.sin`, `Math.cos`) and multiplication introduce rounding errors at the machine epsilon level ($\varepsilon \approx 2.220446 \times 10^{-16}$).

For coordinates such as:
- $P_1 = (-84.81442189440335^\circ, -34.64636930956769^\circ)$
- $P_2 = (84.81442189440335^\circ, 145.3536306904323^\circ)$

Evaluating line 47–52 of `src/utils/haversine.ts`:
```typescript
const a =
  Math.sin(dLat / 2) * Math.sin(dLat / 2) +
  Math.cos(toRad(p1.lat)) *
    Math.cos(toRad(p2.lat)) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);
```
produces:
$$a = 1.0000000000000002 = 1 + \varepsilon$$

In line 54 of `src/utils/haversine.ts`:
```typescript
const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
```
- $1 - a = 1 - (1 + 2.220446049250313 \times 10^{-16}) = -2.220446049250313 \times 10^{-16}$
- `Math.sqrt(1 - a)` $\implies \sqrt{\text{negative}} \implies \text{NaN}$
- `Math.atan2(Math.sqrt(a), NaN)` $\implies \text{NaN}$
- `Math.round(EARTH_RADIUS_METERS * NaN)` $\implies \text{NaN}$

### 2.3 Verification Against Test Oracle
In `tests/framework/haversine.ts:36-38`, the specification oracle authored for tests contains:
```typescript
// Protect against floating-point inaccuracies pushing 'a' slightly > 1
const clampedA = Math.min(1, Math.max(0, a));
const c = 2 * Math.atan2(Math.sqrt(clampedA), Math.sqrt(1 - clampedA));
```
The implementation in `src/utils/haversine.ts` inadvertently omitted `clampedA`.

---

## 3. Formulated Solution

### 3.1 Clamping Logic
Clamp $a$ to the closed unit interval $[0, 1]$ before passing to `Math.sqrt`:
```typescript
const clampedA = Math.min(1, Math.max(0, a));
const c = 2 * Math.atan2(Math.sqrt(clampedA), Math.sqrt(1 - clampedA));
```

### 3.2 Bidirectional Protection
1. **Upper Bound (`Math.min(1, ...)`):**
   - When floating-point inaccuracies push $a > 1$ (e.g. $a = 1.0000000000000002$), `clampedA` becomes exactly `1`.
   - $1 - \text{clampedA} = 0$.
   - $\sqrt{\text{clampedA}} = 1$, $\sqrt{1 - \text{clampedA}} = 0$.
   - $\operatorname{atan2}(1, 0) = \frac{\pi}{2}$.
   - $c = 2 \times \frac{\pi}{2} = \pi \approx 3.141592653589793$.
   - Distance: $\text{round}(6,371,000 \times \pi) = 20,015,087 \text{ meters}$.

2. **Lower Bound (`Math.max(0, ...)`):**
   - For nearly identical coordinates or precision underflow where $a$ could evaluate to $-0.0$ or a microscopic negative value (e.g., $-1 \times 10^{-17}$), `clampedA` becomes `0`.
   - $\sqrt{\text{clampedA}} = 0$, $\sqrt{1 - \text{clampedA}} = 1$.
   - $\operatorname{atan2}(0, 1) = 0$.
   - $c = 0 \implies \text{distance} = 0 \text{ meters}$.

---

## 4. Empirical Mathematical Verification

The mathematical behavior of the clamped formulation was empirically verified across 10 distinct coordinate scenarios:

| Scenario | Point 1 (Lat, Lng) | Point 2 (Lat, Lng) | Computed $a$ | Clamped $a$ | Distance (m) | Expected | Status |
|---|---|---|---|---|---|---|---|
| **Identical Origin** | $(0, 0)$ | $(0, 0)$ | $0.0$ | $0.0$ | $0$ | $0 \text{ m}$ | PASS |
| **Identical Melaka Center** | $(2.1944, 102.2491)$ | $(2.1944, 102.2491)$ | $0.0$ | $0.0$ | $0$ | $0 \text{ m}$ | PASS |
| **Identical North Pole** | $(90, 0)$ | $(90, 0)$ | $0.0$ | $0.0$ | $0$ | $0 \text{ m}$ | PASS |
| **Poles Antipodal** | $(90, 0)$ | $(-90, 0)$ | $1.0$ | $1.0$ | $20,015,087$ | $20,015,087 \text{ m}$ | PASS |
| **Equator Antipodal (+180)** | $(0, 0)$ | $(0, 180)$ | $1.0$ | $1.0$ | $20,015,087$ | $20,015,087 \text{ m}$ | PASS |
| **Equator Antipodal (-180)** | $(0, 0)$ | $(0, -180)$ | $1.0$ | $1.0$ | $20,015,087$ | $20,015,087 \text{ m}$ | PASS |
| **Overshoot Antipodal** | $(-84.8144, -34.6464)$ | $(84.8144, 145.3536)$ | $1.0000000000000002$ | $1.0$ | $20,015,087$ | $20,015,087 \text{ m}$ | PASS |
| **Melaka Center Antipodal** | $(2.1944, 102.2491)$ | $(-2.1944, -77.7509)$ | $1.0$ | $1.0$ | $20,015,087$ | $20,015,087 \text{ m}$ | PASS |
| **Stadhuys $\to$ Christ Church** | $(2.1942, 102.2493)$ | $(2.1944, 102.2491)$ | $6.09 \times 10^{-12}$ | $6.09 \times 10^{-12}$ | $31$ | $31 \text{ m}$ | PASS |
| **Dutch Square $\to$ A Famosa** | $(2.1942, 102.2493)$ | $(2.1918, 102.2505)$ | $5.48 \times 10^{-10}$ | $5.48 \times 10^{-10}$ | $298$ | $298 \text{ m}$ | PASS |

### 4.1 Verification of Adversarial Suite `CHAL-GEO-02`
All 6 antipodal pairs tested in `tests/unit/challenger2_empirical.test.ts` pass with zero deviation (`diff = 0 m`) against `HALF_CIRCUMFERENCE` ($20,015,087 \text{ m}$):
- `Equator Prime Meridian vs Date Line Neg` $\to 20,015,087 \text{ m}$
- `North Pole vs South Pole` $\to 20,015,087 \text{ m}$
- `Mid-Latitude Antipode` $\to 20,015,087 \text{ m}$
- `Southern Antipode` $\to 20,015,087 \text{ m}$
- `Melaka Center Antipode` $\to 20,015,087 \text{ m}$
- `Deterministic Overshoot Antipode` $\to 20,015,087 \text{ m}$

---

## 5. Scope & Regression Impact Assessment

- **Local Melaka Gameplay**: In normal gameplay within the 1.5 km UNESCO perimeter in Melaka, $a \approx 10^{-12} \dots 10^{-9} \ll 1$. Clamping does not alter any existing calculations.
- **Performance Overhead**: `Math.min` and `Math.max` are single-cycle primitive CPU operations (`Math.min(1, Math.max(0, a))` executes in $< 1 \text{ ns}$).
- **E2E & Unit Test Impact**: Resolves the only failing test out of 273 across the entire suite (bringing passing tests to 273/273, 100%).

---

## 6. Proposed Code Change for Worker

### Target File: `src/utils/haversine.ts`
Line 54:

```typescript
// BEFORE:
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

// AFTER:
  const clampedA = Math.min(1, Math.max(0, a));
  const c = 2 * Math.atan2(Math.sqrt(clampedA), Math.sqrt(1 - clampedA));
```

The unified diff is also exported as `haversine.patch` in this agent's directory.
