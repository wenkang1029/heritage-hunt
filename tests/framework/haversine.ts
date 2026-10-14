import type { GeoCoordinate } from './contracts.ts';

const EARTH_RADIUS_METERS = 6371000;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Calculates the great-circle distance between two GPS coordinates in meters
 * using the Haversine formula specified in ARCHITECTURE.md §5.B.
 */
export function calculateHaversineDistance(
  coord1: GeoCoordinate,
  coord2: GeoCoordinate
): number {
  if (
    coord1.lat === coord2.lat &&
    coord1.lng === coord2.lng
  ) {
    return 0;
  }

  const phi1 = toRadians(coord1.lat);
  const phi2 = toRadians(coord2.lat);
  const deltaPhi = toRadians(coord2.lat - coord1.lat);
  const deltaLambda = toRadians(coord2.lng - coord1.lng);

  const sinHalfDeltaPhi = Math.sin(deltaPhi / 2);
  const sinHalfDeltaLambda = Math.sin(deltaLambda / 2);

  const a =
    sinHalfDeltaPhi * sinHalfDeltaPhi +
    Math.cos(phi1) * Math.cos(phi2) * sinHalfDeltaLambda * sinHalfDeltaLambda;

  // Protect against floating-point inaccuracies pushing 'a' slightly > 1
  const clampedA = Math.min(1, Math.max(0, a));
  const c = 2 * Math.atan2(Math.sqrt(clampedA), Math.sqrt(1 - clampedA));

  return Math.round((EARTH_RADIUS_METERS * c) * 100) / 100;
}

/**
 * Checks if two coordinates are within a specified threshold in meters.
 */
export function isWithinProximity(
  coord1: GeoCoordinate,
  coord2: GeoCoordinate,
  thresholdMeters: number
): boolean {
  return calculateHaversineDistance(coord1, coord2) <= thresholdMeters;
}
