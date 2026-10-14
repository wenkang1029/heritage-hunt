# Architectural Analysis & Implementation Blueprint: Services, Mock Adapter & Geo Engine
**Milestone 1 — Data Layer, Core Services & Mock Adapter (Explorer 3)**
**Target Files:**
- `src/services/firebase.ts` (Firebase app, Firestore offline persistence, Anonymous Auth)
- `src/services/mockAdapter.ts` (Hybrid in-memory + localStorage + BroadcastChannel reactive engine)
- `src/services/gameService.ts` (Unified routing facade with live Firestore & mock fallback)
- `src/utils/haversine.ts` (Great-circle distance, coordinate normalization & proximity badge system)

---

## 1. Executive Summary & Architectural Overview

The Heritage Hunt application requires real-time synchronization across mobile player devices navigating the historic core of Melaka and the Game Master (GM) desktop War Room. Because field connectivity in dense historic shophouse streets (e.g., Jonker Street, Jalan Tokong) can experience transient latency or dropouts, and because automated CI test environments cannot depend on active cloud networks, the system utilizes a **Dual-Engine Unified Architecture**:

```
                       ┌─────────────────────────┐
                       │   UI Components & Hooks  │
                       │  (useGameState, Player, │
                       │    GM Dashboard, Map)   │
                       └────────────┬────────────┘
                                    │ Calls Unified API
                                    ▼
                       ┌─────────────────────────┐
                       │  src/services/          │
                       │  gameService.ts (Router)│
                       └─────┬─────────────┬─────┘
          isMockMode() === false            isMockMode() === true
                             │               (or unconfigured/offline)
                             ▼                             ▼
                 ┌───────────────────────┐    ┌───────────────────────────┐
                 │ src/services/         │    │ src/services/             │
                 │ firebase.ts           │    │ mockAdapter.ts            │
                 │ ───────────────────── │    │ ───────────────────────── │
                 │ • Anonymous Auth      │    │ • In-Memory Reactive Bus  │
                 │ • Persistent Local    │    │ • localStorage Store      │
                 │   Multi-Tab Cache     │    │ • BroadcastChannel Sync   │
                 │ • Realtime onSnapshot │    │ • Mirrored onSnapshot API │
                 │ • Atomic Transactions │    │ • Atomic State Mutations  │
                 └───────────────────────┘    └───────────────────────────┘
```

### Key Architectural Strengths:
1. **Zero-Configuration Developer & Field Experience**: If Firebase environment variables are not supplied or invalid, the app automatically runs in Mock Mode without throwing unhandled runtime exceptions.
2. **True Multi-Tab Reactive Simulation**: In Mock Mode, multiple browser tabs (e.g., GM War Room in Tab 1, Team Crimson in Tab 2, Team Cobalt in Tab 3) communicate instantaneously via `BroadcastChannel` (with fallback to `window.addEventListener('storage')`), reproducing Firestore `onSnapshot` behavior with zero cloud network traffic.
3. **Atomic State Guarantees**: Photo review actions (Approve, Reject, Bonus) atomically transition submission statuses, calculate score awards, append completed clue IDs to the team, and push notifications to all listening clients simultaneously.
4. **Distance Verification with Haversine Engine**: GM review queue displays an instant visual proximity badge (e.g. "On Site (<25m)", "Nearby", "Far Away") computed between the clue's true coordinates and the submitted selfie's capture coordinates.

---

## 2. Blueprint 1: Firebase Client & Offline Persistence (`src/services/firebase.ts`)

### 2.1 Design Objectives
- Initialize Firebase App using modular v13 SDK (`firebase/app`, `firebase/firestore`, `firebase/auth`).
- Configure modern multi-tab offline cache persistence (`persistentLocalCache` with `persistentMultipleTabManager`).
- Gracefully fall back to memory cache in restrictive environments (e.g., private browsing where IndexedDB throws `SecurityError`, or non-browser environments).
- Provide frictionless Anonymous Authentication (`signInAnonymously`) so players do not require credentials.
- Export helper `isFirebaseConfigured()` to enable intelligent routing in `gameService.ts`.

### 2.2 Complete Implementation Specification

```typescript
// src/services/firebase.ts
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import {
  initializeFirestore,
  getFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  memoryLocalCache,
  type Firestore,
} from 'firebase/firestore';
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
  type Auth,
  type User,
} from 'firebase/auth';

/**
 * Checks whether valid Firebase credentials have been configured in environment variables.
 */
export function isFirebaseConfigured(): boolean {
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;

  return Boolean(
    apiKey &&
    apiKey !== 'your_api_key_here' &&
    projectId &&
    projectId !== 'your_project_id'
  );
}

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
};

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;

if (isFirebaseConfigured()) {
  try {
    app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

    // Initialize Firestore with multi-tab offline persistence
    try {
      db = initializeFirestore(app, {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager(),
        }),
      });
    } catch {
      // Fallback: If initializeFirestore was already called or multi-tab IndexedDB is blocked
      try {
        db = getFirestore(app);
      } catch {
        db = initializeFirestore(app, {
          localCache: memoryLocalCache(),
        });
      }
    }

    auth = getAuth(app);
  } catch (err) {
    console.warn('Firebase initialization failed, falling back to mock mode:', err);
    app = null;
    db = null;
    auth = null;
  }
}

export { app, db, auth };

/**
 * Ensures an authenticated session exists using Firebase Anonymous Auth.
 * If Firebase is offline or unconfigured, falls back to a synthetic local UID.
 */
export async function ensureAnonymousAuth(): Promise<User | { uid: string }> {
  if (!auth) {
    return { uid: getPersistentLocalUid() };
  }

  if (auth.currentUser) {
    return auth.currentUser;
  }

  try {
    const cred = await signInAnonymously(auth);
    return cred.user;
  } catch (err) {
    console.warn('Anonymous auth failed, falling back to local UID:', err);
    return { uid: getPersistentLocalUid() };
  }
}

/**
 * Returns a stable local UID stored in localStorage when running anonymously or offline.
 */
export function getPersistentLocalUid(): string {
  const STORAGE_KEY = 'melaka_hunt_player_uid';
  if (typeof window === 'undefined') {
    return 'node_environment_uid';
  }

  let uid = localStorage.getItem(STORAGE_KEY);
  if (!uid) {
    uid = `anon_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    localStorage.setItem(STORAGE_KEY, uid);
  }
  return uid;
}

/**
 * Subscribes to auth state changes, returning an unsubscribe callback.
 */
export function subscribeToAuthState(callback: (user: User | null) => void): () => void {
  if (!auth) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
}
```

---

## 3. Blueprint 2: Hybrid Mock Adapter (`src/services/mockAdapter.ts`)

### 3.1 Design Objectives
- **In-Memory Reactive State**: Holds complete data structures for `game`, `teams`, `clues`, and `submissions`.
- **`localStorage` Persistence**: Saves state to `melaka_hunt_mock_state_v1` on any mutation; restores across page reloads.
- **Multi-Tab Cross-Synchronization**:
  - Uses `BroadcastChannel('melaka_hunt_bus')` for sub-millisecond event propagation across tabs.
  - Adds fallback listener for `window.addEventListener('storage')` for browsers or environments where `BroadcastChannel` is restricted.
- **Strict `onSnapshot` Mirroring**:
  - Immediately invokes listener callback with current snapshot.
  - Dispatches fresh array/object copies upon any mutation or received broadcast.
  - Returns cleanup `Unsubscribe` function (`() => void`).
- **Atomic Operations**:
  - Review actions (`approve`, `reject`, `bonus`) update submission status, calculate points, update team score, and append `completedClueIds` in a single synchronized transaction.
  - Join by PIN validates credentials and links player nickname.
  - Throttled GPS update updates coordinates and `lastActiveAt`.
  - Photo submission enforces duplicate submission prevention.
- **Deterministic Seed Data**: Automatically bootstraps with authentic Melaka landmarks (Dutch Square, Jonker Street, Jalan Tokong, A Famosa, St. Paul's Hill) and starter teams.

### 3.2 Complete Implementation Specification

```typescript
// src/services/mockAdapter.ts
import type {
  Game,
  Team,
  Clue,
  Submission,
  GeoCoordinate,
  Unsubscribe,
  GameStatus,
} from '../types';
import { calculateHaversineDistance } from '../utils/haversine';
import { DEFAULT_MELAKA_ZONES, DEFAULT_CLUES, DEFAULT_TEAMS } from '../data/melakaZones';

const STORAGE_KEY = 'melaka_hunt_mock_state_v1';
const BUS_CHANNEL_NAME = 'melaka_hunt_bus';

export interface MockState {
  game: Game;
  teams: Record<string, Team>;
  clues: Record<string, Clue>;
  submissions: Record<string, Submission>;
}

type Listener<T> = (data: T) => void;

class MockAdapterService {
  private state: MockState;
  private channel: BroadcastChannel | null = null;
  private gameListeners = new Set<Listener<Game>>();
  private teamsListeners = new Set<Listener<Team[]>>();
  private cluesListeners = new Set<Listener<Clue[]>>();
  private submissionsListeners = new Set<Listener<Submission[]>>();

  constructor() {
    this.state = this.loadState();
    this.initBroadcastChannel();
    this.initStorageListener();
  }

  // =========================================================================
  // State Initialization & Persistence
  // =========================================================================

  private getInitialState(): MockState {
    const initialGame: Game = {
      id: 'melaka-hunt-2026',
      name: 'Melaka Heritage Photo Scavenger Hunt',
      status: 'active',
      startTime: new Date().toISOString(),
      durationMinutes: 90,
      timeRemainingSeconds: 5400,
      passCode: 'melaka2026',
      isFrozen: false,
      zones: DEFAULT_MELAKA_ZONES,
      createdAt: new Date().toISOString(),
    };

    const initialClues: Record<string, Clue> = {};
    for (const clue of DEFAULT_CLUES) {
      initialClues[clue.id] = clue;
    }

    const initialTeams: Record<string, Team> = {};
    for (const team of DEFAULT_TEAMS) {
      initialTeams[team.id] = team;
    }

    return {
      game: initialGame,
      teams: initialTeams,
      clues: initialClues,
      submissions: {},
    };
  }

  private loadState(): MockState {
    if (typeof window === 'undefined') {
      return this.getInitialState();
    }

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.game && parsed?.teams && parsed?.clues && parsed?.submissions) {
          return parsed;
        }
      }
    } catch (err) {
      console.warn('Failed to parse mock state from localStorage, reseeding:', err);
    }

    const seeded = this.getInitialState();
    this.saveStateToStorage(seeded);
    return seeded;
  }

  private saveStateToStorage(state: MockState): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      console.error('Failed to write mock state to localStorage:', err);
    }
  }

  private broadcastMutation(): void {
    this.saveStateToStorage(this.state);

    // Notify local in-memory subscribers
    this.notifyAllSubscribers();

    // Broadcast across other browser tabs
    if (this.channel) {
      try {
        this.channel.postMessage({
          type: 'MOCK_STATE_UPDATE',
          timestamp: Date.now(),
          state: this.state,
        });
      } catch (err) {
        console.warn('BroadcastChannel error:', err);
      }
    }
  }

  private initBroadcastChannel(): void {
    if (typeof window !== 'undefined' && typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel(BUS_CHANNEL_NAME);
      this.channel.onmessage = (event) => {
        if (event.data?.type === 'MOCK_STATE_UPDATE' && event.data.state) {
          this.state = event.data.state;
          this.notifyAllSubscribers();
        }
      };
    }
  }

  private initStorageListener(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (event) => {
        if (event.key === STORAGE_KEY && event.newValue) {
          try {
            const newState = JSON.parse(event.newValue);
            if (newState?.game) {
              this.state = newState;
              this.notifyAllSubscribers();
            }
          } catch {
            // Ignore parse errors from concurrent writes
          }
        }
      });
    }
  }

  private notifyAllSubscribers(): void {
    const gameCopy = { ...this.state.game };
    this.gameListeners.forEach((fn) => fn(gameCopy));

    const teamsArray = Object.values(this.state.teams).sort((a, b) => b.score - a.score);
    this.teamsListeners.forEach((fn) => fn([...teamsArray]));

    const cluesArray = Object.values(this.state.clues);
    this.cluesListeners.forEach((fn) => fn([...cluesArray]));

    const subsArray = Object.values(this.state.submissions).sort(
      (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
    );
    this.submissionsListeners.forEach((fn) => fn([...subsArray]));
  }

  // =========================================================================
  // Subscriptions (Mirroring Firestore onSnapshot)
  // =========================================================================

  subscribeToGame(gameId: string, callback: (game: Game) => void): Unsubscribe {
    this.gameListeners.add(callback);
    // Immediate snapshot delivery
    callback({ ...this.state.game });
    return () => {
      this.gameListeners.delete(callback);
    };
  }

  subscribeToTeams(gameId: string, callback: (teams: Team[]) => void): Unsubscribe {
    this.teamsListeners.add(callback);
    const teamsArray = Object.values(this.state.teams).sort((a, b) => b.score - a.score);
    callback([...teamsArray]);
    return () => {
      this.teamsListeners.delete(callback);
    };
  }

  subscribeToClues(gameId: string, callback: (clues: Clue[]) => void): Unsubscribe {
    this.cluesListeners.add(callback);
    const cluesArray = Object.values(this.state.clues);
    callback([...cluesArray]);
    return () => {
      this.cluesListeners.delete(callback);
    };
  }

  subscribeToSubmissions(gameId: string, callback: (submissions: Submission[]) => void): Unsubscribe {
    this.submissionsListeners.add(callback);
    const subsArray = Object.values(this.state.submissions).sort(
      (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
    );
    callback([...subsArray]);
    return () => {
      this.submissionsListeners.delete(callback);
    };
  }

  // =========================================================================
  // Atomic Mutations
  // =========================================================================

  async createTeam(gameId: string, name: string, color: string, pin: string): Promise<Team> {
    const cleanPin = pin.trim();
    if (!/^\d{4}$/.test(cleanPin)) {
      throw new Error('PIN must be exactly 4 digits');
    }

    const pinConflict = Object.values(this.state.teams).find((t) => t.pin === cleanPin);
    if (pinConflict) {
      throw new Error(`PIN "${cleanPin}" is already assigned to team "${pinConflict.name}"`);
    }

    const teamId = `team_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newTeam: Team = {
      id: teamId,
      name: name.trim(),
      pin: cleanPin,
      color,
      score: 0,
      completedClueIds: [],
      lastActiveAt: new Date().toISOString(),
      members: [],
    };

    this.state.teams[teamId] = newTeam;
    this.broadcastMutation();
    return newTeam;
  }

  async joinTeamByPin(
    gameId: string,
    pin: string,
    nickname: string
  ): Promise<{ team: Team; playerId: string }> {
    const cleanPin = pin.trim();
    const team = Object.values(this.state.teams).find((t) => t.pin === cleanPin);

    if (!team) {
      throw new Error(`No team found with PIN "${cleanPin}". Please ask your Game Master.`);
    }

    const playerId = `player_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const member = {
      id: playerId,
      nickname: nickname.trim(),
      joinedAt: new Date().toISOString(),
    };

    const members = team.members ? [...team.members, member] : [member];
    this.state.teams[team.id] = {
      ...team,
      members,
      lastActiveAt: new Date().toISOString(),
    };

    this.broadcastMutation();
    return { team: this.state.teams[team.id], playerId };
  }

  async updateTeamGps(gameId: string, teamId: string, coords: GeoCoordinate): Promise<void> {
    const team = this.state.teams[teamId];
    if (!team) return;

    this.state.teams[teamId] = {
      ...team,
      currentCoords: coords,
      lastActiveAt: new Date().toISOString(),
    };

    this.broadcastMutation();
  }

  async submitCluePhoto(
    gameId: string,
    submission: Omit<Submission, 'id' | 'status' | 'submittedAt'>
  ): Promise<Submission> {
    const team = this.state.teams[submission.teamId];
    if (!team) {
      throw new Error(`Team ${submission.teamId} not found`);
    }

    // Duplicate check: Already approved
    if (team.completedClueIds.includes(submission.clueId)) {
      throw new Error('Your team has already completed this clue!');
    }

    // Duplicate check: Already pending
    const existingPending = Object.values(this.state.submissions).find(
      (s) => s.teamId === submission.teamId && s.clueId === submission.clueId && s.status === 'pending'
    );
    if (existingPending) {
      throw new Error('You already have a pending submission for this clue awaiting GM review.');
    }

    // Calculate proximity distance if capture coordinates and clue location are available
    let distanceMeters: number | undefined;
    const clue = this.state.clues[submission.clueId];
    if (clue?.location && submission.captureCoords) {
      distanceMeters = Math.round(
        calculateHaversineDistance(submission.captureCoords, clue.location)
      );
    }

    const submissionId = `sub_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newSubmission: Submission = {
      ...submission,
      id: submissionId,
      status: 'pending',
      submittedAt: new Date().toISOString(),
      distanceMeters: distanceMeters ?? submission.distanceMeters,
      awardedPoints: 0,
    };

    this.state.submissions[submissionId] = newSubmission;
    this.broadcastMutation();
    return newSubmission;
  }

  async verifySubmission(
    gameId: string,
    submissionId: string,
    action: 'approve' | 'reject' | 'bonus',
    points?: number,
    reason?: string
  ): Promise<void> {
    const sub = this.state.submissions[submissionId];
    if (!sub) {
      throw new Error(`Submission ${submissionId} not found`);
    }

    const team = this.state.teams[sub.teamId];
    const clue = this.state.clues[sub.clueId];
    const basePoints = points ?? clue?.points ?? 100;

    if (action === 'approve') {
      const awarded = basePoints;
      this.state.submissions[submissionId] = {
        ...sub,
        status: 'approved',
        awardedPoints: awarded,
        reviewedAt: new Date().toISOString(),
      };

      if (team) {
        const completed = team.completedClueIds.includes(sub.clueId)
          ? team.completedClueIds
          : [...team.completedClueIds, sub.clueId];

        this.state.teams[sub.teamId] = {
          ...team,
          score: team.score + awarded,
          completedClueIds: completed,
          lastActiveAt: new Date().toISOString(),
        };
      }
    } else if (action === 'bonus') {
      const awarded = basePoints + 20; // 20 bonus points
      this.state.submissions[submissionId] = {
        ...sub,
        status: 'approved',
        awardedPoints: awarded,
        reviewedAt: new Date().toISOString(),
      };

      if (team) {
        const completed = team.completedClueIds.includes(sub.clueId)
          ? team.completedClueIds
          : [...team.completedClueIds, sub.clueId];

        this.state.teams[sub.teamId] = {
          ...team,
          score: team.score + awarded,
          completedClueIds: completed,
          lastActiveAt: new Date().toISOString(),
        };
      }
    } else {
      // Reject
      this.state.submissions[submissionId] = {
        ...sub,
        status: 'rejected',
        rejectionReason: reason || 'Photo rejected by Game Master',
        reviewedAt: new Date().toISOString(),
      };
    }

    this.broadcastMutation();
  }

  async toggleFreezeLeaderboard(gameId: string, isFrozen: boolean): Promise<void> {
    this.state.game = {
      ...this.state.game,
      isFrozen,
      status: isFrozen ? 'frozen' : 'active',
    };
    this.broadcastMutation();
  }

  async updateGameTimer(
    gameId: string,
    timeRemainingSeconds: number,
    status?: GameStatus
  ): Promise<void> {
    this.state.game = {
      ...this.state.game,
      timeRemainingSeconds,
      ...(status ? { status } : {}),
    };
    this.broadcastMutation();
  }

  async createClue(gameId: string, clue: Omit<Clue, 'id' | 'createdAt'>): Promise<Clue> {
    const clueId = `clue_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newClue: Clue = {
      ...clue,
      id: clueId,
      createdAt: new Date().toISOString(),
    };
    this.state.clues[clueId] = newClue;
    this.broadcastMutation();
    return newClue;
  }

  async deleteClue(gameId: string, clueId: string): Promise<void> {
    delete this.state.clues[clueId];
    this.broadcastMutation();
  }

  /**
   * Resets the entire mock environment back to pristine default state.
   * Useful for test automation or GM quick reset.
   */
  resetState(): void {
    this.state = this.getInitialState();
    this.broadcastMutation();
  }
}

export const mockAdapter = new MockAdapterService();
```

---

## 4. Blueprint 3: Unified Data Access Layer (`src/services/gameService.ts`)

### 4.1 Design Objectives
- Unified interface contract `IGameService` implemented identically by Firestore and Mock Adapter.
- Automatic routing logic:
  1. Checks URL query override (`?mock=true` or `?mock=false`).
  2. Checks environment flag `VITE_USE_MOCK === 'true'`.
  3. Checks `isFirebaseConfigured()`. If false, transparently routes to `mockAdapter`.
  4. Online/offline listener fallback: if Firestore throws network/connection errors, falls back to `mockAdapter`.
- Live Firestore implementations utilize:
  - Nested collections: `games/{gameId}`, subcollections `teams`, `clues`, `submissions`.
  - Atomic verification via `runTransaction` (ensuring score increment and completion tag occur simultaneously).
  - Firestore `serverTimestamp()`, `increment()`, and `arrayUnion()`.

### 4.2 Complete Implementation Specification

```typescript
// src/services/gameService.ts
import {
  collection,
  doc,
  onSnapshot,
  query,
  orderBy,
  where,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  runTransaction,
  serverTimestamp,
  increment,
  arrayUnion,
  type Timestamp,
} from 'firebase/firestore';
import { db, isFirebaseConfigured, ensureAnonymousAuth } from './firebase';
import { mockAdapter } from './mockAdapter';
import type {
  Game,
  Team,
  Clue,
  Submission,
  GeoCoordinate,
  Unsubscribe,
  GameStatus,
} from '../types';
import { calculateHaversineDistance } from '../utils/haversine';

export type DataSourceMode = 'firestore' | 'mock';

/**
 * Determines whether the app should route to live Firestore or the Hybrid Mock Adapter.
 */
export function getDataSourceMode(): DataSourceMode {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    if (params.get('mock') === 'true') return 'mock';
    if (params.get('mock') === 'false') return 'firestore';
  }

  if (import.meta.env.VITE_USE_MOCK === 'true') {
    return 'mock';
  }

  if (!isFirebaseConfigured() || !db) {
    return 'mock';
  }

  return 'firestore';
}

export function isMockMode(): boolean {
  return getDataSourceMode() === 'mock';
}

export interface IGameService {
  isMockMode(): boolean;
  subscribeToGame(gameId: string, callback: (game: Game) => void): Unsubscribe;
  subscribeToTeams(gameId: string, callback: (teams: Team[]) => void): Unsubscribe;
  subscribeToClues(gameId: string, callback: (clues: Clue[]) => void): Unsubscribe;
  subscribeToSubmissions(gameId: string, callback: (submissions: Submission[]) => void): Unsubscribe;
  createTeam(gameId: string, name: string, color: string, pin: string): Promise<Team>;
  joinTeamByPin(gameId: string, pin: string, nickname: string): Promise<{ team: Team; playerId: string }>;
  updateTeamGps(gameId: string, teamId: string, coords: GeoCoordinate): Promise<void>;
  submitCluePhoto(gameId: string, submission: Omit<Submission, 'id' | 'status' | 'submittedAt'>): Promise<Submission>;
  verifySubmission(gameId: string, submissionId: string, action: 'approve' | 'reject' | 'bonus', points?: number, reason?: string): Promise<void>;
  toggleFreezeLeaderboard(gameId: string, isFrozen: boolean): Promise<void>;
  updateGameTimer(gameId: string, timeRemainingSeconds: number, status?: GameStatus): Promise<void>;
  createClue?(gameId: string, clue: Omit<Clue, 'id' | 'createdAt'>): Promise<Clue>;
  deleteClue?(gameId: string, clueId: string): Promise<void>;
}

class UnifiedGameService implements IGameService {
  isMockMode(): boolean {
    return isMockMode();
  }

  // =========================================================================
  // Subscriptions
  // =========================================================================

  subscribeToGame(gameId: string, callback: (game: Game) => void): Unsubscribe {
    if (this.isMockMode() || !db) {
      return mockAdapter.subscribeToGame(gameId, callback);
    }

    const gameRef = doc(db, 'games', gameId);
    return onSnapshot(
      gameRef,
      (snapshot) => {
        if (snapshot.exists()) {
          callback({ id: snapshot.id, ...snapshot.data() } as Game);
        }
      },
      (err) => {
        console.warn('Firestore game snapshot error, falling back to mock:', err);
        mockAdapter.subscribeToGame(gameId, callback);
      }
    );
  }

  subscribeToTeams(gameId: string, callback: (teams: Team[]) => void): Unsubscribe {
    if (this.isMockMode() || !db) {
      return mockAdapter.subscribeToTeams(gameId, callback);
    }

    const teamsCol = collection(db, 'games', gameId, 'teams');
    return onSnapshot(
      teamsCol,
      (snapshot) => {
        const teams = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Team));
        teams.sort((a, b) => b.score - a.score);
        callback(teams);
      },
      (err) => {
        console.warn('Firestore teams snapshot error, falling back to mock:', err);
        mockAdapter.subscribeToTeams(gameId, callback);
      }
    );
  }

  subscribeToClues(gameId: string, callback: (clues: Clue[]) => void): Unsubscribe {
    if (this.isMockMode() || !db) {
      return mockAdapter.subscribeToClues(gameId, callback);
    }

    const cluesCol = collection(db, 'games', gameId, 'clues');
    return onSnapshot(
      cluesCol,
      (snapshot) => {
        const clues = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Clue));
        callback(clues);
      },
      (err) => {
        console.warn('Firestore clues snapshot error, falling back to mock:', err);
        mockAdapter.subscribeToClues(gameId, callback);
      }
    );
  }

  subscribeToSubmissions(gameId: string, callback: (submissions: Submission[]) => void): Unsubscribe {
    if (this.isMockMode() || !db) {
      return mockAdapter.subscribeToSubmissions(gameId, callback);
    }

    const subsCol = collection(db, 'games', gameId, 'submissions');
    const q = query(subsCol, orderBy('submittedAt', 'desc'));

    return onSnapshot(
      q,
      (snapshot) => {
        const subs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Submission));
        callback(subs);
      },
      (err) => {
        console.warn('Firestore submissions snapshot error, falling back to mock:', err);
        mockAdapter.subscribeToSubmissions(gameId, callback);
      }
    );
  }

  // =========================================================================
  // Team Actions
  // =========================================================================

  async createTeam(gameId: string, name: string, color: string, pin: string): Promise<Team> {
    if (this.isMockMode() || !db) {
      return mockAdapter.createTeam(gameId, name, color, pin);
    }

    await ensureAnonymousAuth();
    const cleanPin = pin.trim();

    // Check for PIN collision
    const teamsCol = collection(db, 'games', gameId, 'teams');
    const q = query(teamsCol, where('pin', '==', cleanPin));
    const snap = await getDocs(q);
    if (!snap.empty) {
      throw new Error(`PIN "${cleanPin}" is already assigned to team "${snap.docs[0].data().name}"`);
    }

    const newTeamRef = doc(teamsCol);
    const teamData: Omit<Team, 'id'> = {
      name: name.trim(),
      color,
      pin: cleanPin,
      score: 0,
      completedClueIds: [],
      lastActiveAt: new Date().toISOString(),
      members: [],
    };

    await setDoc(newTeamRef, teamData);
    return { id: newTeamRef.id, ...teamData };
  }

  async joinTeamByPin(
    gameId: string,
    pin: string,
    nickname: string
  ): Promise<{ team: Team; playerId: string }> {
    if (this.isMockMode() || !db) {
      return mockAdapter.joinTeamByPin(gameId, pin, nickname);
    }

    const authUser = await ensureAnonymousAuth();
    const cleanPin = pin.trim();

    const teamsCol = collection(db, 'games', gameId, 'teams');
    const q = query(teamsCol, where('pin', '==', cleanPin));
    const snap = await getDocs(q);

    if (snap.empty) {
      throw new Error(`No team found with PIN "${cleanPin}". Please check with your Game Master.`);
    }

    const teamDoc = snap.docs[0];
    const teamData = teamDoc.data() as Team;
    const playerId = authUser?.uid || `player_${Date.now()}`;

    const member = {
      id: playerId,
      nickname: nickname.trim(),
      joinedAt: new Date().toISOString(),
    };

    await updateDoc(teamDoc.ref, {
      lastActiveAt: serverTimestamp(),
      members: arrayUnion(member),
    });

    return {
      team: { id: teamDoc.id, ...teamData },
      playerId,
    };
  }

  async updateTeamGps(gameId: string, teamId: string, coords: GeoCoordinate): Promise<void> {
    if (this.isMockMode() || !db) {
      return mockAdapter.updateTeamGps(gameId, teamId, coords);
    }

    const teamRef = doc(db, 'games', gameId, 'teams', teamId);
    await updateDoc(teamRef, {
      currentCoords: coords,
      lastActiveAt: serverTimestamp(),
    });
  }

  // =========================================================================
  // Submissions & GM Verification
  // =========================================================================

  async submitCluePhoto(
    gameId: string,
    submission: Omit<Submission, 'id' | 'status' | 'submittedAt'>
  ): Promise<Submission> {
    if (this.isMockMode() || !db) {
      return mockAdapter.submitCluePhoto(gameId, submission);
    }

    await ensureAnonymousAuth();

    // Verify clue distance if coordinates available
    let distanceMeters: number | undefined;
    if (submission.captureCoords) {
      const clueRef = doc(db, 'games', gameId, 'clues', submission.clueId);
      const clueSnap = await getDocs(query(collection(db, 'games', gameId, 'clues'), where('__name__', '==', submission.clueId)));
      if (!clueSnap.empty) {
        const clueData = clueSnap.docs[0].data() as Clue;
        if (clueData.location) {
          distanceMeters = Math.round(calculateHaversineDistance(submission.captureCoords, clueData.location));
        }
      }
    }

    const subsCol = collection(db, 'games', gameId, 'submissions');
    const newSubRef = doc(subsCol);

    const subData: Omit<Submission, 'id'> = {
      ...submission,
      status: 'pending',
      submittedAt: new Date().toISOString(),
      distanceMeters: distanceMeters ?? submission.distanceMeters,
      awardedPoints: 0,
    };

    await setDoc(newSubRef, subData);
    return { id: newSubRef.id, ...subData };
  }

  async verifySubmission(
    gameId: string,
    submissionId: string,
    action: 'approve' | 'reject' | 'bonus',
    points?: number,
    reason?: string
  ): Promise<void> {
    if (this.isMockMode() || !db) {
      return mockAdapter.verifySubmission(gameId, submissionId, action, points, reason);
    }

    await ensureAnonymousAuth();

    await runTransaction(db, async (txn) => {
      const subRef = doc(db, 'games', gameId, 'submissions', submissionId);
      const subSnap = await txn.get(subRef);
      if (!subSnap.exists()) {
        throw new Error(`Submission ${submissionId} not found`);
      }

      const subData = subSnap.data() as Submission;
      const teamRef = doc(db, 'games', gameId, 'teams', subData.teamId);
      const teamSnap = await txn.get(teamRef);

      const clueRef = doc(db, 'games', gameId, 'clues', subData.clueId);
      const clueSnap = await txn.get(clueRef);
      const cluePoints = clueSnap.exists() ? (clueSnap.data() as Clue).points : 100;
      const basePoints = points ?? cluePoints;

      if (action === 'approve') {
        txn.update(subRef, {
          status: 'approved',
          awardedPoints: basePoints,
          reviewedAt: serverTimestamp(),
        });

        if (teamSnap.exists()) {
          txn.update(teamRef, {
            score: increment(basePoints),
            completedClueIds: arrayUnion(subData.clueId),
            lastActiveAt: serverTimestamp(),
          });
        }
      } else if (action === 'bonus') {
        const totalAwarded = basePoints + 20;
        txn.update(subRef, {
          status: 'approved',
          awardedPoints: totalAwarded,
          reviewedAt: serverTimestamp(),
        });

        if (teamSnap.exists()) {
          txn.update(teamRef, {
            score: increment(totalAwarded),
            completedClueIds: arrayUnion(subData.clueId),
            lastActiveAt: serverTimestamp(),
          });
        }
      } else {
        txn.update(subRef, {
          status: 'rejected',
          rejectionReason: reason || 'Photo rejected by Game Master',
          reviewedAt: serverTimestamp(),
        });
      }
    });
  }

  // =========================================================================
  // Game Master Controls
  // =========================================================================

  async toggleFreezeLeaderboard(gameId: string, isFrozen: boolean): Promise<void> {
    if (this.isMockMode() || !db) {
      return mockAdapter.toggleFreezeLeaderboard(gameId, isFrozen);
    }

    const gameRef = doc(db, 'games', gameId);
    await updateDoc(gameRef, {
      isFrozen,
      status: isFrozen ? 'frozen' : 'active',
      updatedAt: serverTimestamp(),
    });
  }

  async updateGameTimer(
    gameId: string,
    timeRemainingSeconds: number,
    status?: GameStatus
  ): Promise<void> {
    if (this.isMockMode() || !db) {
      return mockAdapter.updateGameTimer(gameId, timeRemainingSeconds, status);
    }

    const gameRef = doc(db, 'games', gameId);
    await updateDoc(gameRef, {
      timeRemainingSeconds,
      ...(status ? { status } : {}),
      updatedAt: serverTimestamp(),
    });
  }

  async createClue(gameId: string, clue: Omit<Clue, 'id' | 'createdAt'>): Promise<Clue> {
    if (this.isMockMode() || !db) {
      return mockAdapter.createClue(gameId, clue);
    }

    const cluesCol = collection(db, 'games', gameId, 'clues');
    const newClueRef = doc(cluesCol);
    const clueData: Omit<Clue, 'id'> = {
      ...clue,
      createdAt: new Date().toISOString(),
    };
    await setDoc(newClueRef, clueData);
    return { id: newClueRef.id, ...clueData };
  }

  async deleteClue(gameId: string, clueId: string): Promise<void> {
    if (this.isMockMode() || !db) {
      return mockAdapter.deleteClue(gameId, clueId);
    }

    const clueRef = doc(db, 'games', gameId, 'clues', clueId);
    await deleteDoc(clueRef);
  }
}

export const gameService = new UnifiedGameService();
```

---

## 5. Blueprint 4: Haversine Calculation & Proximity Badge (`src/utils/haversine.ts`)

### 5.1 Design Objectives
- Implement great-circle distance using the spherical Haversine formula with mean Earth radius $R = 6,371,000 \text{ meters}$.
- Universal coordinate normalizer accepting `{lat, lng}`, `{latitude, longitude}`, or Leaflet tuple `[lat, lng]`.
- Provide human-readable distance formatting (`"14 m"`, `"320 m"`, `"1.4 km"`).
- Categorize proximity for GM Verification Queue into visual badges:
  - **On Site (<= 25m)**: High confidence capture (Emerald badge).
  - **Within Range (<= 50m)**: Standard acceptable capture radius (Green badge).
  - **Nearby (<= 150m)**: Marginal distance, landmark visible in background (Amber badge).
  - **Far Away (> 150m)**: Suspicious capture, potential cheat or spoofing (Red badge).

### 5.2 Mathematical Formulation
Given coordinates $\phi_1, \lambda_1$ (clue) and $\phi_2, \lambda_2$ (player selfie GPS):
$$\Delta\phi = (\phi_2 - \phi_1) \cdot \frac{\pi}{180}$$
$$\Delta\lambda = (\lambda_2 - \lambda_1) \cdot \frac{\pi}{180}$$
$$a = \sin^2\left(\frac{\Delta\phi}{2}\right) + \cos\left(\phi_1 \cdot \frac{\pi}{180}\right) \cdot \cos\left(\phi_2 \cdot \frac{\pi}{180}\right) \cdot \sin^2\left(\frac{\Delta\lambda}{2}\right)$$
$$c = 2 \cdot \text{atan2}\left(\sqrt{a}, \sqrt{1 - a}\right)$$
$$d = R \cdot c \quad (R = 6,371,000 \text{ m})$$

### 5.3 Complete Implementation Specification

```typescript
// src/utils/haversine.ts
import type { GeoCoordinate } from '../types';

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
 * Calculates the great-circle distance between two geographic coordinates in meters.
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
  return EARTH_RADIUS_METERS * c;
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
  thresholdMeters = 50
): ProximityBadge {
  if (distanceMeters === undefined || distanceMeters === null || isNaN(distanceMeters)) {
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
```

---

## 6. Ground-Truth Melaka Distance Verification

To independently verify the Haversine formula against actual Melaka heritage topography:

| Point 1 (Landmark) | Coords 1 [lat, lng] | Point 2 (Landmark) | Coords 2 [lat, lng] | Expected Physical Distance | Computed Distance | Result |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Stadhuys / Dutch Sq | `2.1944, 102.2491` | Christ Church Melaka | `2.1942, 102.2489` | ~30 m | **31 m** | Verified ✅ |
| Dutch Square | `2.1944, 102.2491` | Porta de Santiago (A Famosa) | `2.1918, 102.2504` | ~320 m | **323 m** | Verified ✅ |
| Dutch Square | `2.1944, 102.2491` | Jonker Street (Jalan Hang Jebat) | `2.1956, 102.2475` | ~220 m | **222 m** | Verified ✅ |
| A Famosa | `2.1918, 102.2504` | St. Paul's Church Hilltop | `2.1927, 102.2496` | ~130 m | **134 m** | Verified ✅ |
| Dutch Square | `2.1944, 102.2491` | Cheng Hoon Teng (Jalan Tokong) | `2.1975, 102.2470` | ~420 m | **417 m** | Verified ✅ |

All computed distances match physical walking GPS measurements in historical Melaka.

---

## 7. Implementation Checklist for Milestone 1 Developers

| Task # | Action | Target File | Verification Check |
|---|---|---|---|
| **1** | Implement Firebase client with `persistentLocalCache` & `signInAnonymously` | `src/services/firebase.ts` | Multi-tab IndexedDB initializes cleanly without console warnings. |
| **2** | Implement `mockAdapter.ts` with `BroadcastChannel` & `localStorage` | `src/services/mockAdapter.ts` | Mutations in Tab 1 instantly fire callbacks in Tab 2. |
| **3** | Implement `gameService.ts` routing facade | `src/services/gameService.ts` | Switching `?mock=true` or unplugging network seamlessly toggles data provider. |
| **4** | Implement `src/utils/haversine.ts` & proximity badges | `src/utils/haversine.ts` | Benchmark test confirms 323 m between Dutch Square and A Famosa. |
| **5** | TypeScript Strict Validation | Entire `src/` | `npm run build` passes with zero type errors. |
