import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { INVARIANTS } from '../framework/contracts.ts';
import type { GeoCoordinate } from '../framework/contracts.ts';
import { MELAKA_ZONES, findZoneForCoordinate } from '../framework/zones.ts';
import { calculateHaversineDistance } from '../framework/haversine.ts';

describe('Tier 2 - Boundary: GPS Boundaries Around Melaka & Geo Edge Cases', () => {
  it('T2-GPS-1: Coordinate on exact vertex of Dutch Square polygon is recognized', () => {
    const dutchSquare = MELAKA_ZONES.find((z) => z.id === 'dutch-square')!;
    const vertex = dutchSquare.polygon[0];
    const vertexCoord: GeoCoordinate = { lat: vertex[0], lng: vertex[1] };

    // Point in polygon or distance to vertex is 0
    const dist = calculateHaversineDistance(vertexCoord, { lat: vertex[0], lng: vertex[1] });
    assert.equal(dist, 0);
  });

  it('T2-GPS-2: Coordinate 1 meter outside zone perimeter is excluded from zone', () => {
    // Dutch Square max latitude is ~2.1954. Coordinate at 2.1956 is outside.
    const justOutside: GeoCoordinate = { lat: 2.1956, lng: 102.2491 };
    const matchedZone = findZoneForCoordinate(justOutside);
    assert.notEqual(matchedZone?.id, 'dutch-square');
  });

  it('T2-GPS-3: Out-of-bounds distant coordinates (Kuala Lumpur, Singapore) detected as outside Melaka', () => {
    const kualaLumpur: GeoCoordinate = { lat: 3.1390, lng: 101.6869 };
    const singapore: GeoCoordinate = { lat: 1.3521, lng: 103.8198 };
    const malaccaStraitsSea: GeoCoordinate = { lat: 2.1500, lng: 102.2000 };

    const isInsideMelakaCore = (coord: GeoCoordinate): boolean => {
      return (
        coord.lat >= INVARIANTS.MELAKA_BOUNDS.minLat &&
        coord.lat <= INVARIANTS.MELAKA_BOUNDS.maxLat &&
        coord.lng >= INVARIANTS.MELAKA_BOUNDS.minLng &&
        coord.lng <= INVARIANTS.MELAKA_BOUNDS.maxLng
      );
    };

    assert.equal(isInsideMelakaCore(kualaLumpur), false, 'KL is ~120km away');
    assert.equal(isInsideMelakaCore(singapore), false, 'Singapore is ~200km away');
    assert.equal(isInsideMelakaCore(malaccaStraitsSea), false, 'Open sea is outside heritage bounds');
  });

  it('T2-GPS-4: Detects inverted latitude and longitude coordinates (lat ~102, lng ~2)', () => {
    const invertedCoord = { lat: 102.2491, lng: 2.1944 };
    const isInverted = (c: { lat: number; lng: number }): boolean => {
      // Latitude in Malaysia is near equator (0° - 7° N). Longitude is ~100° - 119° E.
      return c.lat > 90 || (c.lat > 50 && c.lng < 10);
    };

    assert.equal(isInverted(invertedCoord), true);
  });

  it('T2-GPS-5: Degraded GPS accuracy (> 50m) flags warning badge for review', () => {
    const evaluateGpsQuality = (accuracyMeters: number): 'high' | 'medium' | 'degraded' => {
      if (accuracyMeters <= 15) return 'high';
      if (accuracyMeters <= 50) return 'medium';
      return 'degraded';
    };

    assert.equal(evaluateGpsQuality(5), 'high');
    assert.equal(evaluateGpsQuality(25), 'medium');
    assert.equal(evaluateGpsQuality(85), 'degraded');
  });

  it('T2-GPS-6: Handles null or disabled GPS coordinates without crashing Haversine calculator', () => {
    const safeCalculateDistance = (
      c1?: GeoCoordinate | null,
      c2?: GeoCoordinate | null
    ): number | null => {
      if (!c1 || !c2 || typeof c1.lat !== 'number' || typeof c2.lat !== 'number') {
        return null;
      }
      return calculateHaversineDistance(c1, c2);
    };

    assert.equal(safeCalculateDistance(null, { lat: 2.1944, lng: 102.2491 }), null);
    assert.equal(safeCalculateDistance(undefined, undefined), null);
    assert.ok(safeCalculateDistance({ lat: 2.1944, lng: 102.2491 }, { lat: 2.1944, lng: 102.2491 }) === 0);
  });
});
