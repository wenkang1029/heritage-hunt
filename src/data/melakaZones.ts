/**
 * Melaka Heritage Hunt - Melaka UNESCO Heritage Zones & Clues Dataset
 * Path: src/data/melakaZones.ts
 */

import type {
  Zone,
  TeamColorConfig,
  TeamColorName,
  Clue,
  Team,
  GeoCoordinate,
} from '../types/index.ts';

// Bounding box for Melaka World Heritage Site view constraints
export const MELAKA_HERITAGE_BOUNDS = {
  north: 2.2020,
  south: 2.1880,
  west: 102.2420,
  east: 102.2560,
};

export const MELAKA_MAP_CENTER: GeoCoordinate = {
  latitude: 2.1944,
  longitude: 102.2491,
};

export const MELAKA_ZONES: readonly Zone[] = [
  {
    id: 'dutch-square',
    name: 'Dutch Square & Stadhuys',
    localName: 'Red Square / Stadhuys',
    description:
      'Iconic terra-cotta red administrative center built by the Dutch in the 17th-18th century, featuring Christ Church and Tan Beng Swee Clock Tower.',
    color: '#DC2626', // Red 600
    borderColor: '#B91C1C',
    fillColor: 'rgba(220, 38, 38, 0.25)',
    center: { latitude: 2.195058, longitude: 102.249133 },
    polygon: [
      { latitude: 2.196457, longitude: 102.25004 },
      { latitude: 2.195182, longitude: 102.24834 },
      { latitude: 2.193901, longitude: 102.24809 },
      { latitude: 2.193638, longitude: 102.248366 },
      { latitude: 2.196114, longitude: 102.250829 },
    ],
    clueCount: 3,
  },
  {
    id: 'jonker-street',
    name: 'Jonker Street',
    localName: 'Jalan Hang Jebat',
    description:
      'Vibrant historical commercial spine lined with 19th-century Peranakan shophouses, antique gallerias, and vibrant street murals.',
    color: '#EA580C', // Orange 600
    borderColor: '#C2410C',
    fillColor: 'rgba(234, 88, 12, 0.22)',
    center: { latitude: 2.196845, longitude: 102.246285 },
    polygon: [
      { latitude: 2.198141, longitude: 102.24455 },
      { latitude: 2.198195, longitude: 102.244558 },
      { latitude: 2.197892, longitude: 102.245218 },
      { latitude: 2.197608, longitude: 102.245652 },
      { latitude: 2.197319, longitude: 102.245928 },
      { latitude: 2.1966, longitude: 102.246669 },
      { latitude: 2.19607, longitude: 102.247227 },
      { latitude: 2.194944, longitude: 102.248404 },
      { latitude: 2.194839, longitude: 102.248358 },
    ],
    clueCount: 3,
  },
  {
    id: 'jalan-tokong',
    name: 'Harmony Street',
    localName: 'Jalan Tokong',
    description:
      "Renowned Street of Harmony where Malaysia's oldest Taoist temple, oldest Hindu temple, and pagoda-minaret mosque coexist within 150m.",
    color: '#0D9488', // Teal 600
    borderColor: '#0F766E',
    fillColor: 'rgba(13, 148, 136, 0.22)',
    center: { latitude: 2.197347, longitude: 102.246815 },
    polygon: [
      { latitude: 2.19793, longitude: 102.245236 },
      { latitude: 2.197951, longitude: 102.245365 },
      { latitude: 2.197761, longitude: 102.24687 },
      { latitude: 2.19771, longitude: 102.246856 },
      { latitude: 2.197394, longitude: 102.247221 },
      { latitude: 2.196359, longitude: 102.248101 },
      { latitude: 2.196324, longitude: 102.248058 },
    ],
    clueCount: 3,
  },
  {
    id: 'a-famosa',
    name: 'A Famosa & Porta de Santiago',
    localName: 'Porta de Santiago',
    description:
      'Remains of the 1511 Portuguese coastal fortress gatehouse bearing the 1670 Dutch VOC relief and historic artillery cannons.',
    color: '#B45309', // Amber 700 / Ochre
    borderColor: '#92400E',
    fillColor: 'rgba(180, 83, 9, 0.25)',
    center: { latitude: 2.191976, longitude: 102.249517 },
    polygon: [
      { latitude: 2.192153, longitude: 102.250121 },
      { latitude: 2.191922, longitude: 102.251194 },
      { latitude: 2.191172, longitude: 102.249552 },
      { latitude: 2.192008, longitude: 102.248361 },
      { latitude: 2.192625, longitude: 102.248356 },
    ],
    clueCount: 2,
  },
  {
    id: 'st-pauls-hill',
    name: "St. Paul's Hill",
    localName: 'Bukit St. Paul / Bukit Melaka',
    description:
      'Summit church ruins established in 1521 by the Portuguese, containing monumental 17th-century Dutch tombstones and the statue of St. Francis Xavier.',
    color: '#4F46E5', // Indigo 600
    borderColor: '#3730A3',
    fillColor: 'rgba(79, 70, 229, 0.22)',
    center: { latitude: 2.193144, longitude: 102.249012 },
    polygon: [
      { latitude: 2.193858, longitude: 102.248825 },
      { latitude: 2.193357, longitude: 102.248262 },
      { latitude: 2.192671, longitude: 102.248358 },
      { latitude: 2.192288, longitude: 102.250172 },
      { latitude: 2.193545, longitude: 102.249445 },
    ],
    clueCount: 3,
  },
  {
    id: 'zone_1792056558186_fdbf',
    name: 'Jalan Hang Kasturi',
    localName: 'Jalan Hang Kasturi',
    description: 'Jalan Hang Kasturi',
    color: '#3B82F6',
    borderColor: '#3B82F6',
    fillColor: '#3B82F6',
    center: { latitude: 2.196239, longitude: 102.248177 },
    polygon: [
      { latitude: 2.19711, longitude: 102.248691 },
      { latitude: 2.196464, longitude: 102.248694 },
      { latitude: 2.195625, longitude: 102.247728 },
      { latitude: 2.195756, longitude: 102.247597 },
    ],
    clueCount: 0,
  },
];

export const TEAM_COLOR_PALETTES: Record<TeamColorName, TeamColorConfig> = {
  Crimson: {
    name: 'Crimson',
    hex: '#DC2626',
    lightHex: '#FCA5A5',
    darkHex: '#991B1B',
    bgClass: 'bg-red-600',
    textClass: 'text-red-600',
    borderClass: 'border-red-600',
    ringClass: 'ring-red-600',
    glowColor: 'rgba(220, 38, 38, 0.7)',
    badgeClass: 'bg-red-100 text-red-800 border-red-300',
  },
  Cobalt: {
    name: 'Cobalt',
    hex: '#2563EB',
    lightHex: '#93C5FD',
    darkHex: '#1E40AF',
    bgClass: 'bg-blue-600',
    textClass: 'text-blue-600',
    borderClass: 'border-blue-600',
    ringClass: 'ring-blue-600',
    glowColor: 'rgba(37, 99, 235, 0.7)',
    badgeClass: 'bg-blue-100 text-blue-800 border-blue-300',
  },
  Emerald: {
    name: 'Emerald',
    hex: '#059669',
    lightHex: '#6EE7B7',
    darkHex: '#065F46',
    bgClass: 'bg-emerald-600',
    textClass: 'text-emerald-600',
    borderClass: 'border-emerald-600',
    ringClass: 'ring-emerald-600',
    glowColor: 'rgba(5, 150, 105, 0.7)',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  },
  Amber: {
    name: 'Amber',
    hex: '#D97706',
    lightHex: '#FCD34D',
    darkHex: '#92400E',
    bgClass: 'bg-amber-600',
    textClass: 'text-amber-600',
    borderClass: 'border-amber-600',
    ringClass: 'ring-amber-600',
    glowColor: 'rgba(217, 119, 6, 0.7)',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
  },
  Violet: {
    name: 'Violet',
    hex: '#7C3AED',
    lightHex: '#C4B5FD',
    darkHex: '#5B21B6',
    bgClass: 'bg-violet-600',
    textClass: 'text-violet-600',
    borderClass: 'border-violet-600',
    ringClass: 'ring-violet-600',
    glowColor: 'rgba(124, 58, 237, 0.7)',
    badgeClass: 'bg-violet-100 text-violet-800 border-violet-300',
  },
};

export const TEAM_COLOR_LIST: readonly TeamColorConfig[] = Object.values(TEAM_COLOR_PALETTES);

/**
 * Initial clues collection is empty by default so that GM can upload real clues/photos.
 */
export const INITIAL_CLUES: readonly Clue[] = [];


export const DEFAULT_TEAMS: readonly Team[] = [
  {
    id: 'team-crimson',
    gameId: 'melaka-hunt-2026',
    name: 'Red Warriors',
    pin: '1111',
    color: '#DC2626',
    colorName: 'Crimson',
    score: 0,
    completedClueIds: [],
    currentCoords: { latitude: 2.1944, longitude: 102.2491 },
    lastActiveAt: 1713000000000,
    members: [],
    createdAt: 1713000000000,
  },
  {
    id: 'team-cobalt',
    gameId: 'melaka-hunt-2026',
    name: 'Blue Voyagers',
    pin: '2222',
    color: '#2563EB',
    colorName: 'Cobalt',
    score: 0,
    completedClueIds: [],
    currentCoords: { latitude: 2.1950, longitude: 102.2480 },
    lastActiveAt: 1713000000000,
    members: [],
    createdAt: 1713000000000,
  },
  {
    id: 'team-emerald',
    gameId: 'melaka-hunt-2026',
    name: 'Green Rangers',
    pin: '3333',
    color: '#059669',
    colorName: 'Emerald',
    score: 0,
    completedClueIds: [],
    currentCoords: { latitude: 2.1970, longitude: 102.2465 },
    lastActiveAt: 1713000000000,
    members: [],
    createdAt: 1713000000000,
  },
  {
    id: 'team-amber',
    gameId: 'melaka-hunt-2026',
    name: 'Golden Explorers',
    pin: '4444',
    color: '#D97706',
    colorName: 'Amber',
    score: 0,
    completedClueIds: [],
    currentCoords: { latitude: 2.1920, longitude: 102.2500 },
    lastActiveAt: 1713000000000,
    members: [],
    createdAt: 1713000000000,
  },
  {
    id: 'team-violet',
    gameId: 'melaka-hunt-2026',
    name: 'Purple Navigators',
    pin: '5555',
    color: '#7C3AED',
    colorName: 'Violet',
    score: 0,
    completedClueIds: [],
    currentCoords: { latitude: 2.1930, longitude: 102.2490 },
    lastActiveAt: 1713000000000,
    members: [],
    createdAt: 1713000000000,
  },
];

// Compatibility aliases
export const DEFAULT_MELAKA_ZONES = MELAKA_ZONES;
export const DEFAULT_CLUES = INITIAL_CLUES;

// Helper query functions
export function getZoneById(zoneId: string): Zone | undefined {
  return MELAKA_ZONES.find((z) => z.id === zoneId);
}

export function getCluesForZone(zoneId: string): Clue[] {
  return INITIAL_CLUES.filter((c) => c.zoneId === zoneId);
}

export function getTeamColorByName(name: TeamColorName): TeamColorConfig | undefined {
  return TEAM_COLOR_PALETTES[name];
}
