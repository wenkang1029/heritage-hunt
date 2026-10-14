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
 * Generates an SVG Data URL teaser image for landmarks, ensuring zero 404 image errors.
 */
function createTeaserSvg(
  title: string,
  zoneColor: string,
  subtitle: string,
  iconChar: string
): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="280" viewBox="0 0 400 280">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1E293B" />
      <stop offset="100%" stop-color="#0F172A" />
    </linearGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="3" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>
  <rect width="400" height="280" fill="url(#bg)" rx="12" />
  <rect x="8" y="8" width="384" height="264" fill="none" stroke="${zoneColor}" stroke-width="2" stroke-opacity="0.5" rx="8" />
  <circle cx="200" cy="105" r="48" fill="${zoneColor}" fill-opacity="0.2" stroke="${zoneColor}" stroke-width="3" />
  <text x="200" y="118" font-family="system-ui, sans-serif" font-size="34" font-weight="bold" fill="#F8FAFC" text-anchor="middle">${iconChar}</text>
  <text x="200" y="185" font-family="system-ui, sans-serif" font-size="20" font-weight="bold" fill="#F8FAFC" text-anchor="middle">${title}</text>
  <text x="200" y="215" font-family="system-ui, sans-serif" font-size="13" fill="#94A3B8" text-anchor="middle">${subtitle}</text>
  <rect x="140" y="235" width="120" height="26" rx="13" fill="${zoneColor}" fill-opacity="0.3" stroke="${zoneColor}" stroke-width="1.5" />
  <text x="200" y="252" font-family="system-ui, sans-serif" font-size="12" font-weight="600" fill="#FFFFFF" text-anchor="middle">LANDMARK TEASER</text>
</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const INITIAL_CLUES: readonly Clue[] = [
  // --------------------------------------------------------------------------
  // Dutch Square & Stadhuys (3 clues)
  // --------------------------------------------------------------------------
  {
    id: 'clue-ds-1',
    gameId: 'melaka-hunt-2026',
    zoneId: 'dutch-square',
    title: 'The Red Clock Tower',
    landmarkName: 'Tan Beng Swee Clock Tower',
    description:
      'A 50-foot terra-cotta red clock tower erected in 1886 by wealthy Peranakan philanthropist Tan Jiak Kim in memory of his father Tan Beng Swee.',
    points: 100,
    targetPhotoBase64: createTeaserSvg('Tan Beng Swee Clock Tower', '#DC2626', 'Dutch Square (1886)', '⏰'),
    location: { latitude: 2.19430, longitude: 102.24915 },
    hint: 'Stand directly before the four-faced red clock tower overlooking the fountain. Spot the plaque honoring Tan Beng Swee.',
    radiusMeters: 35,
    difficulty: 'easy',
    order: 1,
    createdAt: 1713000000000,
  },
  {
    id: 'clue-ds-2',
    gameId: 'melaka-hunt-2026',
    zoneId: 'dutch-square',
    title: 'Christ Church Weathercock',
    landmarkName: 'Christ Church Melaka (1753)',
    description:
      'The oldest functioning Protestant church in Malaysia, built of red Dutch brick with an iconic cockerel weather vane high on the belfry.',
    points: 120,
    targetPhotoBase64: createTeaserSvg('Christ Church Weathercock', '#DC2626', 'Red Square Belfry', '⛪'),
    location: { latitude: 2.19460, longitude: 102.24930 },
    hint: 'Look high above the Dutch red brick church facade to spot the golden cockerel weather vane pointing into the wind.',
    radiusMeters: 40,
    difficulty: 'medium',
    order: 2,
    createdAt: 1713000000000,
  },
  {
    id: 'clue-ds-3',
    gameId: 'melaka-hunt-2026',
    zoneId: 'dutch-square',
    title: 'Queen Victoria Jubilee Fountain',
    landmarkName: 'Queen Victoria Diamond Jubilee Fountain',
    description:
      "An ornate marble and green iron fountain erected in 1901 by the British administration commemorating Queen Victoria's 60-year reign.",
    points: 80,
    targetPhotoBase64: createTeaserSvg('Queen Victoria Fountain', '#DC2626', 'British Memorial (1901)', '⛲'),
    location: { latitude: 2.19410, longitude: 102.24905 },
    hint: 'Find the lion heads spouting water at the center of the square. Read the inscription mentioning Victoria Regina 1837-1897.',
    radiusMeters: 30,
    difficulty: 'easy',
    order: 3,
    createdAt: 1713000000000,
  },

  // --------------------------------------------------------------------------
  // Jonker Street / Jalan Hang Jebat (3 clues)
  // --------------------------------------------------------------------------
  {
    id: 'clue-js-1',
    gameId: 'melaka-hunt-2026',
    zoneId: 'jonker-street',
    title: 'The Golden Bodybuilder Statue',
    landmarkName: 'Datuk Wira Dr. Gan Boon Leong Memorial',
    description:
      'Gilded bronze statue commemorating Mr. Universe and the "Father of Bodybuilding in Malaysia" in Jonker Walk recreational park.',
    points: 100,
    targetPhotoBase64: createTeaserSvg('Golden Bodybuilder', '#EA580C', 'Jonker Walk Park', '💪'),
    location: { latitude: 2.19690, longitude: 102.24675 },
    hint: 'Flex alongside the muscular gilded statue standing proudly at the midpoint of Jonker Walk park.',
    radiusMeters: 35,
    difficulty: 'easy',
    order: 4,
    createdAt: 1713000000000,
  },
  {
    id: 'clue-js-2',
    gameId: 'melaka-hunt-2026',
    zoneId: 'jonker-street',
    title: 'San Shu Gong Red Heritage House',
    landmarkName: 'San Shu Gong (三叔公) Confectionery',
    description:
      'Prominent 3-story vermillion shophouse greeting pedestrians as they cross the Tan Kim Hock river bridge into Jonker Walk.',
    points: 90,
    targetPhotoBase64: createTeaserSvg('San Shu Gong Shophouse', '#EA580C', 'Bridge Entrance Landmark', '🏮'),
    location: { latitude: 2.19510, longitude: 102.24810 },
    hint: 'Stand at the foot of Tan Kim Hock bridge where the vibrant red corner building serves local white coffee and durian treats.',
    radiusMeters: 35,
    difficulty: 'easy',
    order: 5,
    createdAt: 1713000000000,
  },
  {
    id: 'clue-js-3',
    gameId: 'melaka-hunt-2026',
    zoneId: 'jonker-street',
    title: 'Geographer Corner Wall Inscription',
    landmarkName: 'Geographer Café Heritage Shophouse',
    description:
      'A beautifully preserved 19th-century corner shophouse painted sun-yellow, displaying inspiring quotes and traditional timber shutters.',
    points: 110,
    targetPhotoBase64: createTeaserSvg('Geographer Corner', '#EA580C', 'Jalan Hang Kasturi Junction', '🌿'),
    location: { latitude: 2.19640, longitude: 102.24710 },
    hint: 'Locate the bright yellow corner cafe at the crossroads of Hang Jebat and Hang Kasturi. Look for the leafy wooden shutters.',
    radiusMeters: 35,
    difficulty: 'medium',
    order: 6,
    createdAt: 1713000000000,
  },

  // --------------------------------------------------------------------------
  // Jalan Tokong / Harmony Street (3 clues)
  // --------------------------------------------------------------------------
  {
    id: 'clue-jt-1',
    gameId: 'melaka-hunt-2026',
    zoneId: 'jalan-tokong',
    title: 'Cheng Hoon Teng Chien Nien Dragons',
    landmarkName: 'Cheng Hoon Teng Temple (青云亭, 1645)',
    description:
      "Malaysia's oldest functioning Taoist temple, showcasing elaborate cut-porcelain (chien nien) dragons and mythical beasts on its curved eaves.",
    points: 130,
    targetPhotoBase64: createTeaserSvg('Cheng Hoon Teng Eaves', '#0D9488', 'Oldest Temple (1645)', '🐉'),
    location: { latitude: 2.19830, longitude: 102.24570 },
    hint: 'Look up at the ornate roof ridge of the temple to photograph the ceramic dragons curling towards the sky.',
    radiusMeters: 40,
    difficulty: 'hard',
    order: 7,
    createdAt: 1713000000000,
  },
  {
    id: 'clue-jt-2',
    gameId: 'melaka-hunt-2026',
    zoneId: 'jalan-tokong',
    title: 'The Pagoda-Style Minaret',
    landmarkName: 'Kampung Kling Mosque (1748)',
    description:
      'Unique architectural fusion combining Sumatran, Hindu, Chinese, and Moorish motifs, featuring a three-tiered pagoda minaret.',
    points: 140,
    targetPhotoBase64: createTeaserSvg('Pagoda Mosque Minaret', '#0D9488', 'Kampung Kling (1748)', '🕌'),
    location: { latitude: 2.19750, longitude: 102.24630 },
    hint: 'Find the mosque minaret that looks remarkably like a multi-tiered Chinese pagoda constructed from glazed ceramic and brick.',
    radiusMeters: 40,
    difficulty: 'hard',
    order: 8,
    createdAt: 1713000000000,
  },
  {
    id: 'clue-jt-3',
    gameId: 'melaka-hunt-2026',
    zoneId: 'jalan-tokong',
    title: 'Sri Poyyatha Elephant Pediment',
    landmarkName: 'Sri Poyyatha Vinayagar Moorthi Temple (1781)',
    description:
      'The oldest functioning Hindu temple in Malaysia, dedicated to Lord Ganesha, built during the Dutch colonial administration.',
    points: 120,
    targetPhotoBase64: createTeaserSvg('Sri Poyyatha Ganesha', '#0D9488', 'Oldest Hindu Temple (1781)', '🐘'),
    location: { latitude: 2.19680, longitude: 102.24650 },
    hint: 'Spot the carved pediment honoring Lord Ganesha on the stepped facade along Harmony Street.',
    radiusMeters: 35,
    difficulty: 'medium',
    order: 9,
    createdAt: 1713000000000,
  },

  // --------------------------------------------------------------------------
  // A Famosa & Porta de Santiago (2 clues)
  // --------------------------------------------------------------------------
  {
    id: 'clue-af-1',
    gameId: 'melaka-hunt-2026',
    zoneId: 'a-famosa',
    title: 'VOC Dutch Coat of Arms 1670',
    landmarkName: 'Porta de Santiago Gatehouse',
    description:
      "The sole surviving gate of Albuquerque's 1511 Portuguese fortress, saved by Raffles, bearing the 1670 Dutch East India Company coat of arms.",
    points: 150,
    targetPhotoBase64: createTeaserSvg('Porta de Santiago VOC', '#B45309', 'Fortress Gate (1511/1670)', '🛡️'),
    location: { latitude: 2.19185, longitude: 102.25045 },
    hint: 'Carefully inspect the masonry directly above the Santiago arched portal for the carved VOC crest and soldier.',
    radiusMeters: 35,
    difficulty: 'hard',
    order: 10,
    createdAt: 1713000000000,
  },
  {
    id: 'clue-af-2',
    gameId: 'melaka-hunt-2026',
    zoneId: 'a-famosa',
    title: 'Historic Rampart Cannons',
    landmarkName: 'Coastal Defense Cannon Battery',
    description:
      'Heavy bronze artillery cannons resting on wooden carriages guarding the historical ramparts facing the sea.',
    points: 80,
    targetPhotoBase64: createTeaserSvg('Fortress Cannon Battery', '#B45309', 'Artillery Emplacement', '💣'),
    location: { latitude: 2.19165, longitude: 102.25030 },
    hint: 'Snap a team selfie next to the heavy bronze field cannon pointing out from the lawn before Porta de Santiago.',
    radiusMeters: 30,
    difficulty: 'easy',
    order: 11,
    createdAt: 1713000000000,
  },

  // --------------------------------------------------------------------------
  // St. Paul's Hill / Bukit St. Paul (3 clues)
  // --------------------------------------------------------------------------
  {
    id: 'clue-sp-1',
    gameId: 'melaka-hunt-2026',
    zoneId: 'st-pauls-hill',
    title: 'St. Francis Xavier Marble Statue',
    landmarkName: 'Statue of St. Francis Xavier (1952)',
    description:
      'Carrara marble statue perched atop Bukit St. Paul whose right wrist was severed by a falling casuarina branch in 1953, echoing the historical severing of his arm relic in Goa.',
    points: 120,
    targetPhotoBase64: createTeaserSvg('St. Francis Xavier Statue', '#4F46E5', 'Hill Summit Memorial', '✝️'),
    location: { latitude: 2.19280, longitude: 102.24930 },
    hint: 'Ascend the stone stairs to the summit. Find the white marble statue overlooking the town and Straits of Malacca.',
    radiusMeters: 35,
    difficulty: 'medium',
    order: 12,
    createdAt: 1713000000000,
  },
  {
    id: 'clue-sp-2',
    gameId: 'melaka-hunt-2026',
    zoneId: 'st-pauls-hill',
    title: 'Armorial Dutch Gravestones',
    landmarkName: "St. Paul's Church Nave Tombstones",
    description:
      "Gigantic carved granite tombstones from the 1600s lining the ruined interior walls of St. Paul's Church, etched with Latin coats of arms and winged skulls.",
    points: 130,
    targetPhotoBase64: createTeaserSvg('Dutch Armorial Tombstone', '#4F46E5', 'Church Ruins Nave', '🪦'),
    location: { latitude: 2.19265, longitude: 102.24955 },
    hint: 'Step inside the roofless church ruins. Find the tall upright stone slabs bearing Dutch family crests and skulls.',
    radiusMeters: 35,
    difficulty: 'medium',
    order: 13,
    createdAt: 1713000000000,
  },
  {
    id: 'clue-sp-3',
    gameId: 'melaka-hunt-2026',
    zoneId: 'st-pauls-hill',
    title: "St. Paul's Beacon Lookout",
    landmarkName: 'Summit Flagstaff & Historic Lighthouse',
    description:
      'The historic navigational beacon and viewpoint on the summit offering a strategic vista over the Straits of Malacca.',
    points: 90,
    targetPhotoBase64: createTeaserSvg('Summit Beacon Lookout', '#4F46E5', 'Straits Panorama', '🔭'),
    location: { latitude: 2.19310, longitude: 102.24920 },
    hint: 'Head to the white beacon tower at the crest of the hill overlooking the river mouth and sea.',
    radiusMeters: 35,
    difficulty: 'easy',
    order: 14,
    createdAt: 1713000000000,
  },
];

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
