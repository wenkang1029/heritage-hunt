/**
 * Core interface contracts and constants for Melaka Heritage Photo Hunt.
 * Derived from PROJECT.md, PRD.md, and ARCHITECTURE.md.
 */

export type GameStatus = 'draft' | 'lobby' | 'active' | 'paused' | 'frozen' | 'ended' | 'completed';

export interface GeoCoordinate {
  lat: number;
  lng: number;
}

export interface Zone {
  id: string;
  name: string;
  color: string;
  polygon: [number, number][];
  center: [number, number];
  description?: string;
}

export interface Team {
  id: string;
  gameId: string;
  name: string;
  pin: string;
  color: string;
  score: number;
  completedClueIds: string[];
  currentCoords?: GeoCoordinate & { updatedAt: number | Date };
  lastActiveAt: number | Date;
}

export interface Clue {
  id: string;
  gameId: string;
  title: string;
  zoneId: string;
  points: number;
  targetPhotoBase64: string;
  location: GeoCoordinate;
  hint: string;
  createdAt: number | Date;
}

export type SubmissionStatus = 'pending' | 'approved' | 'rejected';

export interface Submission {
  id: string;
  gameId: string;
  teamId: string;
  teamName: string;
  teamColor: string;
  clueId: string;
  clueTitle: string;
  selfieBase64: string;
  status: SubmissionStatus;
  rejectionReason?: string;
  awardedPoints: number;
  bonusPoints?: number;
  submittedAt: number | Date;
  reviewedAt?: number | Date | null;
  coords?: GeoCoordinate;
}

export interface Game {
  id: string;
  name: string;
  status: GameStatus;
  startTime: number | Date | null;
  durationMinutes: number;
  timeRemainingSeconds: number;
  passCode: string;
  isLeaderboardFrozen: boolean;
  zones: Zone[];
  createdAt: number | Date;
}

export type Unsubscribe = () => void;

/** Architectural Invariants & Constraints */
export const INVARIANTS = {
  MAX_IMAGE_BASE64_BYTES: 150 * 1024, // 153,600 bytes ceiling (<= 150 KB)
  MAX_IMAGE_DIMENSION_PX: 1024,
  IMAGE_QUALITY_PERCENT: 65,
  MAX_FIRESTORE_DOC_BYTES: 1048576, // 1 MB Firestore document limit
  GPS_BROADCAST_THROTTLE_MS: 15000, // 15-second throttle
  DEFAULT_GM_PASSCODE: 'melaka2026',
  MELAKA_MAP_CENTER: { lat: 2.1944, lng: 102.2491 } as GeoCoordinate,
  MELAKA_BOUNDS: {
    minLat: 2.1800,
    maxLat: 2.2150,
    minLng: 102.2350,
    maxLng: 102.2650,
  },
  MIN_TOUCH_TARGET_PX: 48,
  PIN_LENGTH: 4,
  PROXIMITY_ALERT_METERS: 30, // Distance within which clue is considered in proximity
};
