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
    center: { latitude: 2.1942, longitude: 102.2493 },
    polygon: [
      { latitude: 2.19495, longitude: 102.24860 },
      { latitude: 2.19485, longitude: 102.24970 },
      { latitude: 2.19370, longitude: 102.24990 },
      { latitude: 2.19360, longitude: 102.24890 },
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
    center: { latitude: 2.1963, longitude: 102.2472 },
    polygon: [
      { latitude: 2.19480, longitude: 102.24840 },
      { latitude: 2.19525, longitude: 102.24775 },
      { latitude: 2.19745, longitude: 102.24640 },
      { latitude: 2.19775, longitude: 102.24685 },
      { latitude: 2.19520, longitude: 102.24865 },
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
    center: { latitude: 2.1977, longitude: 102.2462 },
    polygon: [
      { latitude: 2.19655, longitude: 102.24610 },
      { latitude: 2.19865, longitude: 102.24540 },
      { latitude: 2.19905, longitude: 102.24610 },
      { latitude: 2.19705, longitude: 102.24675 },
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
    center: { latitude: 2.1918, longitude: 102.2505 },
    polygon: [
      { latitude: 2.19245, longitude: 102.24990 },
      { latitude: 2.19235, longitude: 102.25125 },
      { latitude: 2.19115, longitude: 102.25110 },
      { latitude: 2.19125, longitude: 102.24980 },
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
    center: { latitude: 2.1928, longitude: 102.2494 },
    polygon: [
      { latitude: 2.19360, longitude: 102.24885 },
      { latitude: 2.19355, longitude: 102.25015 },
      { latitude: 2.19225, longitude: 102.25025 },
      { latitude: 2.19215, longitude: 102.24875 },
    ],
    clueCount: 3,
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
