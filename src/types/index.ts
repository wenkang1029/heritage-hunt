/**
 * Melaka Heritage Hunt - Core Data Models and Types
 * Strict TypeScript definition file compatible with erasableSyntaxOnly and verbatimModuleSyntax
 */

// ============================================================================
// 1. Geographic & Location Types
// ============================================================================

export interface GeoCoordinate {
  latitude: number;
  longitude: number;
  accuracy?: number; // Accuracy in meters (from navigator.geolocation)
  altitude?: number | null;
  heading?: number | null;
  speed?: number | null;
  timestamp?: number;
}

export type LatLngTuple = [latitude: number, longitude: number];

export interface LatLngLiteral {
  lat: number;
  lng: number;
}

export interface DistanceResult {
  distanceMeters: number;
  isWithinRadius: boolean;
  formattedDistance: string; // e.g., "18 m" or "1.2 km"
}

export type Unsubscribe = () => void;

// ============================================================================
// 2. Heritage Zones & Boundaries
// ============================================================================

export type ZoneId =
  | 'dutch-square'
  | 'jonker-street'
  | 'jalan-tokong'
  | 'a-famosa'
  | 'st-pauls-hill'
  | string;

export interface Zone {
  id: ZoneId;
  name: string;
  localName?: string;
  description: string;
  color: string; // Hex color for zone outline & badges
  borderColor: string;
  fillColor: string; // Semi-transparent rgba/hex for Leaflet polygon
  center: GeoCoordinate;
  polygon: GeoCoordinate[]; // Polygon vertices (at least 3 coordinates)
  clueCount?: number;
}

// ============================================================================
// 3. Team Colors & Team Models
// ============================================================================

export type TeamColorName = 'Crimson' | 'Cobalt' | 'Emerald' | 'Amber' | 'Violet';

export interface TeamColorConfig {
  name: TeamColorName;
  hex: string;
  lightHex: string;
  darkHex: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
  ringClass: string;
  glowColor: string; // For radar pulse CSS animation
  badgeClass: string;
}

export interface TeamMember {
  id: string; // Player UID (Firebase anonymous or UUID)
  nickname: string;
  joinedAt: number | string;
  isLeader?: boolean;
  lastSeenAt?: number;
  isOnline?: boolean;
}

export interface Team {
  id: string;
  gameId: string;
  name: string;
  pin: string; // 4-digit numeric string (e.g. "4821")
  color: string; // Hex code matching TeamColorConfig.hex
  colorName?: TeamColorName;
  score: number;
  completedClueIds: string[];
  currentCoords?: GeoCoordinate | null;
  lastActiveAt: number | string; // Unix timestamp ms or ISO string
  members: TeamMember[];
  rank?: number;
  bonusPointsAwarded?: number;
  createdAt?: number | string;
}

// ============================================================================
// 4. Clue Models
// ============================================================================

export type ClueDifficulty = 'easy' | 'medium' | 'hard';

export interface Clue {
  id: string;
  gameId: string;
  zoneId: ZoneId;
  title: string;
  landmarkName: string;
  description?: string;
  points: number;
  targetPhotoBase64: string; // Cropped landmark teaser photo (Base64 data URL)
  location: GeoCoordinate;
  hint: string;
  radiusMeters?: number; // Proximity threshold in meters (default 50)
  difficulty?: ClueDifficulty;
  order?: number;
  createdAt: number | string;
  updatedAt?: number | string;
}

// ============================================================================
// 5. Submission Models
// ============================================================================

export type SubmissionStatus = 'pending' | 'approved' | 'rejected';
export type SubmissionReviewAction = 'approve' | 'reject' | 'bonus';

export interface Submission {
  id: string;
  gameId: string;
  teamId: string;
  teamName: string;
  teamColor: string;
  clueId: string;
  clueTitle: string;
  selfieBase64: string; // Compressed selfie <= 150KB Base64 data URL
  submittedBy: string; // Nickname or player UID
  submissionCoords: GeoCoordinate; // Location where selfie was snapped
  captureCoords?: GeoCoordinate; // Interop alias for submissionCoords
  distanceFromClueMeters?: number | null; // Haversine distance from clue location
  distanceMeters?: number | null; // Interop alias for distanceFromClueMeters
  status: SubmissionStatus;
  awardedPoints: number; // 0 if pending/rejected, points + bonus if approved
  bonusPoints?: number;
  rejectionReason?: string;
  submittedAt: number | string; // Unix timestamp ms or ISO string
  reviewedAt?: number | string | null;
  reviewedBy?: string; // GM identifier
}

// ============================================================================
// 6. Game State Models
// ============================================================================

export type GameStatus =
  | 'lobby'
  | 'draft'
  | 'active'
  | 'paused'
  | 'frozen'
  | 'ended'
  | 'completed';

export type BroadcastType = 'info' | 'alert' | 'urgent';

export interface BroadcastMessage {
  id: string;
  gameId: string;
  message: string;
  type: BroadcastType;
  sender?: string;
  sentAt: number | string;
  expiresAt?: number | string | null;
}

export interface Game {
  id: string;
  name: string;
  status: GameStatus;
  passCode: string; // Master GM passcode (default: "melaka2026")
  durationMinutes: number;
  timeRemainingSeconds: number;
  startTime: number | string | null;
  endTime: number | string | null;
  isLeaderboardFrozen?: boolean;
  isFrozen?: boolean; // Interop alias for isLeaderboardFrozen
  zones: Zone[];
  activeBroadcast?: BroadcastMessage | null;
  createdAt: number | string;
  updatedAt?: number | string;
}

// ============================================================================
// 7. Leaderboard & Summary Types
// ============================================================================

export interface LeaderboardEntry {
  rank: number;
  teamId: string;
  teamName: string;
  color: string;
  colorName?: TeamColorName;
  score: number;
  completedCluesCount: number;
  totalCluesCount: number;
  lastScoreUpdateTime?: number | string;
}

// ============================================================================
// 8. Service Action Payloads (DTOs)
// ============================================================================

export interface CreateGamePayload {
  name: string;
  passCode: string;
  durationMinutes?: number;
  zones?: Zone[];
}

export interface CreateTeamPayload {
  gameId: string;
  name: string;
  color: string;
  colorName?: TeamColorName;
  pin?: string;
}

export interface JoinTeamPayload {
  gameId: string;
  pin: string;
  nickname: string;
  playerId?: string;
}

export interface UpdateTeamGpsPayload {
  gameId: string;
  teamId: string;
  coords: GeoCoordinate;
}

export interface SubmitCluePayload {
  gameId: string;
  teamId: string;
  teamName: string;
  teamColor: string;
  clueId: string;
  clueTitle: string;
  selfieBase64: string; // Must be <= 150KB
  submittedBy: string;
  submissionCoords: GeoCoordinate;
  captureCoords?: GeoCoordinate;
  distanceFromClueMeters?: number | null;
  distanceMeters?: number | null;
}

export interface VerifySubmissionPayload {
  gameId: string;
  submissionId: string;
  action: SubmissionReviewAction;
  points?: number;
  bonusPoints?: number;
  reason?: string;
  reviewedBy?: string;
}

export interface UpdateGameTimerPayload {
  gameId: string;
  timeRemainingSeconds: number;
  status?: GameStatus;
}

export interface ToggleFreezeLeaderboardPayload {
  gameId: string;
  isFrozen: boolean;
}

export interface SendBroadcastPayload {
  gameId: string;
  message: string;
  type?: BroadcastType;
  sender?: string;
  expiresInMinutes?: number;
}

export interface BulkClueUploadItem {
  title: string;
  zoneId: ZoneId;
  points: number;
  hint: string;
  file: File;
  extractedCoords?: GeoCoordinate | null;
  manualCoords?: GeoCoordinate | null;
  previewUrl: string;
}

export interface CompressedImageResult {
  base64: string;
  sizeBytes: number;
  mimeType: string;
  width?: number;
  height?: number;
}

// ============================================================================
// 9. Constants and Dictionaries (as const for erasableSyntaxOnly)
// ============================================================================

export const GAME_STATUS = {
  LOBBY: 'lobby',
  DRAFT: 'draft',
  ACTIVE: 'active',
  PAUSED: 'paused',
  FROZEN: 'frozen',
  ENDED: 'ended',
  COMPLETED: 'completed',
} as const;

export const SUBMISSION_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const;

export const REVIEW_ACTION = {
  APPROVE: 'approve',
  REJECT: 'reject',
  BONUS: 'bonus',
} as const;

export const MELAKA_HERITAGE_CENTER: GeoCoordinate = {
  latitude: 2.1944,
  longitude: 102.2491,
};

export const MAX_SELFIE_SIZE_BYTES = 150 * 1024; // 153,600 bytes (150 KB)
export const GPS_BROADCAST_THROTTLE_MS = 15000; // 15 seconds
export const DEFAULT_PROXIMITY_RADIUS_METERS = 50;
export const DEFAULT_GAME_DURATION_MINUTES = 60;
export const DEFAULT_GM_PASSCODE = 'melaka2026';
export const DEFAULT_GAME_ID = 'melaka-hunt-2026';

// ============================================================================
// 10. Type Guards and Coordinate Helpers
// ============================================================================

export function isGeoCoordinate(val: unknown): val is GeoCoordinate {
  if (typeof val !== 'object' || val === null) return false;
  const c = val as Partial<GeoCoordinate>;
  return (
    typeof c.latitude === 'number' &&
    !Number.isNaN(c.latitude) &&
    typeof c.longitude === 'number' &&
    !Number.isNaN(c.longitude)
  );
}

export function isGameStatus(val: unknown): val is GameStatus {
  return (
    typeof val === 'string' &&
    ['lobby', 'draft', 'active', 'paused', 'frozen', 'ended', 'completed'].includes(val)
  );
}

export function isSubmissionStatus(val: unknown): val is SubmissionStatus {
  return (
    typeof val === 'string' &&
    ['pending', 'approved', 'rejected'].includes(val)
  );
}

export function isGame(val: unknown): val is Game {
  if (typeof val !== 'object' || val === null) return false;
  const g = val as Partial<Game>;
  return (
    typeof g.id === 'string' &&
    typeof g.name === 'string' &&
    isGameStatus(g.status) &&
    typeof g.passCode === 'string' &&
    Array.isArray(g.zones)
  );
}

export function isTeam(val: unknown): val is Team {
  if (typeof val !== 'object' || val === null) return false;
  const t = val as Partial<Team>;
  return (
    typeof t.id === 'string' &&
    typeof t.gameId === 'string' &&
    typeof t.name === 'string' &&
    typeof t.pin === 'string' &&
    typeof t.score === 'number' &&
    Array.isArray(t.completedClueIds)
  );
}

export function isClue(val: unknown): val is Clue {
  if (typeof val !== 'object' || val === null) return false;
  const c = val as Partial<Clue>;
  return (
    typeof c.id === 'string' &&
    typeof c.gameId === 'string' &&
    typeof c.zoneId === 'string' &&
    typeof c.title === 'string' &&
    typeof c.points === 'number' &&
    isGeoCoordinate(c.location)
  );
}

export function isSubmission(val: unknown): val is Submission {
  if (typeof val !== 'object' || val === null) return false;
  const s = val as Partial<Submission>;
  const coords = s.submissionCoords || s.captureCoords;
  return (
    typeof s.id === 'string' &&
    typeof s.gameId === 'string' &&
    typeof s.teamId === 'string' &&
    typeof s.clueId === 'string' &&
    typeof s.selfieBase64 === 'string' &&
    isSubmissionStatus(s.status) &&
    isGeoCoordinate(coords)
  );
}

export function isZone(val: unknown): val is Zone {
  if (typeof val !== 'object' || val === null) return false;
  const z = val as Partial<Zone>;
  return (
    typeof z.id === 'string' &&
    typeof z.name === 'string' &&
    isGeoCoordinate(z.center) &&
    Array.isArray(z.polygon) &&
    z.polygon.length >= 3
  );
}

// Bidirectional conversion utilities
export function toLatLngTuple(coord: GeoCoordinate | LatLngLiteral | LatLngTuple): LatLngTuple {
  if (Array.isArray(coord)) return [coord[0], coord[1]];
  if ('latitude' in coord) return [coord.latitude, coord.longitude];
  return [coord.lat, coord.lng];
}

export function toGeoCoordinate(coord: LatLngLiteral | LatLngTuple | GeoCoordinate): GeoCoordinate {
  if (Array.isArray(coord)) return { latitude: coord[0], longitude: coord[1] };
  if ('latitude' in coord) return { latitude: coord.latitude, longitude: coord.longitude };
  return { latitude: coord.lat, longitude: coord.lng };
}

export function toLatLngLiteral(coord: GeoCoordinate | LatLngLiteral | LatLngTuple): LatLngLiteral {
  if (Array.isArray(coord)) return { lat: coord[0], lng: coord[1] };
  if ('latitude' in coord) return { lat: coord.latitude, lng: coord.longitude };
  return { lat: coord.lat, lng: coord.lng };
}
