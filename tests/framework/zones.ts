import type { GeoCoordinate, Zone } from './contracts.ts';

export const MELAKA_ZONES: Zone[] = [
  {
    id: 'jonker-street',
    name: 'Jonker Street (Jalan Hang Jebat)',
    color: '#F59E0B', // Amber
    center: [2.1960, 102.2475],
    polygon: [
      [2.1975, 102.2460],
      [2.1980, 102.2480],
      [2.1945, 102.2490],
      [2.1940, 102.2470],
    ],
    description: 'Heritage shophouse murals, antique facades, night market avenue',
  },
  {
    id: 'dutch-square',
    name: 'Dutch Square (Stadhuys)',
    color: '#DC2626', // Red
    center: [2.1944, 102.2491],
    polygon: [
      [2.1952, 102.2483],
      [2.1954, 102.2498],
      [2.1936, 102.2499],
      [2.1935, 102.2484],
    ],
    description: 'Red colonial shophouses, Christ Church, Victoria Queen Fountain, Tan Beng Swee Clock Tower',
  },
  {
    id: 'jalan-tokong',
    name: 'Jalan Tokong (Harmony Street)',
    color: '#10B981', // Emerald
    center: [2.1978, 102.2465],
    polygon: [
      [2.1990, 102.2455],
      [2.1995, 102.2472],
      [2.1965, 102.2478],
      [2.1960, 102.2460],
    ],
    description: 'Cheng Hoon Teng Temple, Kampung Kling Mosque, Sri Poyyatha Vinayagar Moorthi Temple',
  },
  {
    id: 'a-famosa',
    name: 'A Famosa (Porta de Santiago)',
    color: '#8B5CF6', // Violet
    center: [2.1918, 102.2505],
    polygon: [
      [2.1925, 102.2498],
      [2.1928, 102.2512],
      [2.1908, 102.2515],
      [2.1905, 102.2500],
    ],
    description: 'Portuguese fortress ruins, Porta de Santiago gate, historic cannons',
  },
  {
    id: 'st-pauls-hill',
    name: 'St. Paul’s Hill (Bukit St. Paul)',
    color: '#3B82F6', // Cobalt
    center: [2.1927, 102.2498],
    polygon: [
      [2.1938, 102.2490],
      [2.1940, 102.2508],
      [2.1918, 102.2508],
      [2.1916, 102.2490],
    ],
    description: 'St. Paul Church ruins, St. Francis Xavier statue, Dutch gravestones on hilltop',
  },
];

/**
 * Ray-casting algorithm to test if a GPS coordinate is inside a polygon.
 * Handles vertices defined as [lat, lng].
 */
export function isPointInPolygon(point: GeoCoordinate, polygon: [number, number][]): boolean {
  const x = point.lat;
  const y = point.lng;
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0];
    const yi = polygon[i][1];
    const xj = polygon[j][0];
    const yj = polygon[j][1];

    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }

  return inside;
}

/**
 * Finds which Melaka UNESCO zone contains the given coordinate, if any.
 */
export function findZoneForCoordinate(coord: GeoCoordinate): Zone | null {
  for (const zone of MELAKA_ZONES) {
    if (isPointInPolygon(coord, zone.polygon)) {
      return zone;
    }
  }
  return null;
}
