/**
 * Melaka Heritage Hunt - Haversine Distance & Proximity Engine
 * Path: src/utils/haversine.ts
 */

import type { GeoCoordinate } from '../types/index.ts';

export type GeoPointInput =
  | GeoCoordinate
  | { latitude: number; longitude: number }
  | { lat: number; lng: number }
  | [number, number]; // [lat, lng]

const EARTH_RADIUS_METERS = 6371000;

/**
 * Normalizes various coordinate representations into standard { lat, lng }.
 */
export function normalizeCoordinates(coord: GeoPointInput): { lat: number; lng: number } {
  if (Array.isArray(coord)) {
    return { lat: coord[0], lng: coord[1] };
  }
  if ('latitude' in coord && 'longitude' in coord) {
    return { lat: coord.latitude, lng: coord.longitude };
  }
  if ('lat' in coord && 'lng' in coord) {
    return { lat: coord.lat, lng: coord.lng };
  }
  throw new Error('Unsupported coordinate format');
}

/**
 * Calculates the great-circle distance between two geographic coordinates in meters
 * using the Haversine spherical formula with Earth radius R = 6,371,000 meters.
 */
export function calculateHaversineDistance(
  coord1: GeoPointInput,
  coord2: GeoPointInput
): number {
  const p1 = normalizeCoordinates(coord1);
  const p2 = normalizeCoordinates(coord2);

  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(p2.lat - p1.lat);
  const dLon = toRad(p2.lng - p1.lng);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(p1.lat)) *
      Math.cos(toRad(p2.lat)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(EARTH_RADIUS_METERS * c);
}

/**
 * Calculates the forward initial bearing from coord1 to coord2 in degrees (0..360, where 0 is North, 90 is East).
 */
export function calculateBearing(coord1: GeoPointInput, coord2: GeoPointInput): number {
  const p1 = normalizeCoordinates(coord1);
  const p2 = normalizeCoordinates(coord2);

  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;

  const lat1 = toRad(p1.lat);
  const lat2 = toRad(p2.lat);
  const dLon = toRad(p2.lng - p1.lng);

  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);

  const brng = toDeg(Math.atan2(y, x));
  return (brng + 360) % 360;
}

export interface CompassHeading {
  code: string;
  label: string;
  directionZh: string;
  arrow: string;
  bearingDeg: number;
}

export function getCompassDirection(bearingDeg: number, lang: 'en' | 'zh' = 'zh'): CompassHeading {
  const directionsEn = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const directionsZh = ['正北', '东北', '正东', '东南', '正南', '西南', '正西', '西北'];
  const phrasesZh = [
    '正北方向',
    '东北方向',
    '正东方向',
    '东南方向',
    '正南方向',
    '西南方向',
    '正西方向',
    '西北方向',
  ];
  const arrows = ['⬆️', '↗️', '➡️', '↘️', '⬇️', '↙️', '⬅️', '↖️'];

  const normalized = (bearingDeg % 360 + 360) % 360;
  const index = Math.round(normalized / 45) % 8;
  return {
    code: directionsEn[index],
    label: lang === 'zh' ? directionsZh[index] : directionsEn[index],
    directionZh: phrasesZh[index],
    arrow: arrows[index],
    bearingDeg: Math.round(normalized),
  };
}

export type RadarStage = 'target' | 'near' | 'medium' | 'far';

export function getRadarProximityStage(distanceMeters: number): RadarStage {
  if (distanceMeters <= 20) return 'target';
  if (distanceMeters <= 50) return 'near';
  if (distanceMeters <= 100) return 'medium';
  return 'far';
}

/**
 * Formats distance in meters into friendly daylight-readable text.
 */
export function formatDistance(meters: number): string {
  const rounded = Math.round(meters);
  if (rounded < 1000) {
    return `${rounded} m`;
  }
  return `${(rounded / 1000).toFixed(1)} km`;
}

export interface ProximityBadge {
  distanceMeters: number;
  formattedDistance: string;
  tier: 'exact' | 'near' | 'moderate' | 'far';
  label: string;
  badgeClass: string;
  colorHex: string;
  isClose: boolean;
}

/**
 * Generates badge metadata and CSS classes for the GM Verification Queue side-by-side card.
 */
export function getProximityBadge(
  distanceMeters: number | undefined | null,
  thresholdMeters: number = 50
): ProximityBadge {
  if (distanceMeters === undefined || distanceMeters === null || Number.isNaN(distanceMeters)) {
    return {
      distanceMeters: -1,
      formattedDistance: 'GPS N/A',
      tier: 'far',
      label: 'No GPS Fix',
      badgeClass: 'bg-zinc-700/50 text-zinc-300 border border-zinc-600',
      colorHex: '#71717A',
      isClose: false,
    };
  }

  const rounded = Math.round(distanceMeters);
  const formatted = formatDistance(rounded);

  if (rounded <= 25) {
    return {
      distanceMeters: rounded,
      formattedDistance: formatted,
      tier: 'exact',
      label: `On Site (${formatted})`,
      badgeClass: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40',
      colorHex: '#10B981',
      isClose: true,
    };
  }

  if (rounded <= thresholdMeters) {
    return {
      distanceMeters: rounded,
      formattedDistance: formatted,
      tier: 'near',
      label: `Within Range (${formatted})`,
      badgeClass: 'bg-green-500/20 text-green-400 border border-green-500/40',
      colorHex: '#22C55E',
      isClose: true,
    };
  }

  if (rounded <= 150) {
    return {
      distanceMeters: rounded,
      formattedDistance: formatted,
      tier: 'moderate',
      label: `Nearby (${formatted})`,
      badgeClass: 'bg-amber-500/20 text-amber-400 border border-amber-500/40',
      colorHex: '#F59E0B',
      isClose: false,
    };
  }

  return {
    distanceMeters: rounded,
    formattedDistance: formatted,
    tier: 'far',
    label: `Far Away (${formatted})`,
    badgeClass: 'bg-red-500/20 text-red-400 border border-red-500/40',
    colorHex: '#EF4444',
    isClose: false,
  };
}
