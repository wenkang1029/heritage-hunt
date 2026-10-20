/**
 * Melaka Heritage Hunt - Unified Game Service
 * Path: src/services/gameService.ts
 *
 * Routes data operations to live Cloud Firestore or the Hybrid Mock Adapter.
 */

import {
  collection,
  doc,
  onSnapshot,
  query,
  orderBy,
  where,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  runTransaction,
  serverTimestamp,
  increment,
  arrayUnion,
  type Firestore,
} from 'firebase/firestore';
import { db, isFirebaseConfigured, ensureAnonymousAuth } from './firebase.ts';
import { mockAdapter } from './mockAdapter.ts';
import { MELAKA_ZONES, DEFAULT_TEAMS } from '../data/melakaZones.ts';
import type {
  Game,
  Team,
  TeamMember,
  Clue,
  Submission,
  GeoCoordinate,
  Unsubscribe,
  GameStatus,
  Zone,
  BroadcastMessage,
  SendBroadcastPayload,
} from '../types/index.ts';
import { calculateHaversineDistance } from '../utils/haversine.ts';
import { normalizeClueZh } from '../data/cluesZh.ts';

export type DataSourceMode = 'firestore' | 'mock';

/**
 * Safely reads environment variables across Vite browser and Node.js environments.
 */
function getEnvVar(key: string): string | undefined {
  try {
    if (typeof import.meta !== 'undefined' && (import.meta as any)?.env) {
      const val = (import.meta as any).env[key];
      if (typeof val === 'string') return val;
    }
  } catch {
    // Ignore error
  }
  try {
    if (typeof process !== 'undefined' && process.env) {
      const val = process.env[key];
      if (typeof val === 'string') return val;
    }
  } catch {
    // Ignore error
  }
  return undefined;
}

/**
 * Determines whether the app should route to live Firestore or the Hybrid Mock Adapter.
 */
export function getDataSourceMode(): DataSourceMode {
  if (typeof window !== 'undefined' && window.location) {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('mock') === 'true') return 'mock';
      if (params.get('mock') === 'false') return 'firestore';
    } catch {
      // Ignore URL parsing errors
    }
  }

  if (getEnvVar('VITE_USE_MOCK') === 'true') {
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
  subscribeToBroadcasts(gameId: string, callback: (broadcasts: BroadcastMessage[]) => void): Unsubscribe;
  sendBroadcast(payload: SendBroadcastPayload): Promise<BroadcastMessage>;
  clearActiveBroadcast(gameId: string): Promise<void>;
  createTeam(gameId: string, name: string, color: string, pin: string): Promise<Team>;
  joinTeamByPin(gameId: string, pin: string, nickname: string): Promise<{ team: Team; playerId: string }>;
  updateTeamGps(gameId: string, teamId: string, coords: GeoCoordinate): Promise<void>;
  submitCluePhoto(gameId: string, submission: Omit<Submission, 'id' | 'status' | 'submittedAt'>): Promise<Submission>;
  verifySubmission(
    gameId: string,
    submissionId: string,
    action: 'approve' | 'reject' | 'bonus',
    points?: number,
    reason?: string
  ): Promise<void>;
  toggleFreezeLeaderboard(gameId: string, isFrozen: boolean): Promise<void>;
  updateGameTimer(gameId: string, timeRemainingSeconds: number, status?: GameStatus): Promise<void>;
  createClue?(gameId: string, clue: Omit<Clue, 'id' | 'createdAt'>): Promise<Clue>;
  deleteClue?(gameId: string, clueId: string): Promise<void>;
}

class UnifiedGameService implements IGameService {
  isMockMode(): boolean {
    return isMockMode();
  }

  private getFirestoreDb(): Firestore | null {
    if (this.isMockMode() || !db) return null;
    return db;
  }

  // =========================================================================
  // Subscriptions
  // =========================================================================

  subscribeToGame(gameId: string, callback: (game: Game) => void): Unsubscribe {
    const firestore = this.getFirestoreDb();
    if (!firestore) {
      return mockAdapter.subscribeToGame(gameId, callback);
    }

    const gameRef = doc(firestore, 'games', gameId);
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
    const firestore = this.getFirestoreDb();
    if (!firestore) {
      return mockAdapter.subscribeToTeams(gameId, callback);
    }

    const teamsCol = collection(firestore, 'games', gameId, 'teams');
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
    const firestore = this.getFirestoreDb();
    if (!firestore) {
      return mockAdapter.subscribeToClues(gameId, (clues) => callback(clues.map(normalizeClueZh)));
    }

    const cluesCol = collection(firestore, 'games', gameId, 'clues');
    return onSnapshot(
      cluesCol,
      (snapshot) => {
        const clues = snapshot.docs.map((d) => normalizeClueZh({ id: d.id, ...d.data() } as Clue));
        callback(clues);
      },
      (err) => {
        console.warn('Firestore clues snapshot error, falling back to mock:', err);
        mockAdapter.subscribeToClues(gameId, (clues) => callback(clues.map(normalizeClueZh)));
      }
    );
  }

  subscribeToSubmissions(gameId: string, callback: (submissions: Submission[]) => void): Unsubscribe {
    const firestore = this.getFirestoreDb();
    if (!firestore) {
      return mockAdapter.subscribeToSubmissions(gameId, callback);
    }

    const subsCol = collection(firestore, 'games', gameId, 'submissions');
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

  subscribeToBroadcasts(gameId: string, callback: (broadcasts: BroadcastMessage[]) => void): Unsubscribe {
    const firestore = this.getFirestoreDb();
    if (!firestore) {
      return mockAdapter.subscribeToBroadcasts(gameId, callback);
    }

    const broadcastsCol = collection(firestore, 'games', gameId, 'broadcasts');
    const q = query(broadcastsCol, orderBy('sentAt', 'desc'));

    return onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as BroadcastMessage));
        callback(list);
      },
      (err) => {
        console.warn('Firestore broadcasts snapshot error, falling back to mock:', err);
        mockAdapter.subscribeToBroadcasts(gameId, callback);
      }
    );
  }

  // =========================================================================
  // Team Actions
  // =========================================================================

  async createTeam(gameId: string, name: string, color: string, pin: string): Promise<Team> {
    const firestore = this.getFirestoreDb();
    if (!firestore) {
      return mockAdapter.createTeam(gameId, name, color, pin);
    }

    await ensureAnonymousAuth();
    const cleanPin = pin.trim();

    const teamsCol = collection(firestore, 'games', gameId, 'teams');
    const q = query(teamsCol, where('pin', '==', cleanPin));
    const snap = await getDocs(q);
    if (!snap.empty) {
      throw new Error(`PIN "${cleanPin}" is already assigned to team "${snap.docs[0].data().name}"`);
    }

    const newTeamRef = doc(teamsCol);
    const teamData = {
      gameId,
      name: name.trim(),
      color,
      pin: cleanPin,
      score: 0,
      completedClueIds: [],
      lastActiveAt: Date.now(),
      members: [],
      createdAt: Date.now(),
    };

    await setDoc(newTeamRef, teamData);
    return { ...teamData, id: newTeamRef.id };
  }

  async joinTeamByPin(
    gameId: string,
    pin: string,
    nickname: string
  ): Promise<{ team: Team; playerId: string }> {
    const firestore = this.getFirestoreDb();
    if (!firestore) {
      return mockAdapter.joinTeamByPin(gameId, pin, nickname);
    }

    const authUser = await ensureAnonymousAuth();
    const cleanPin = pin.trim();

    const teamsCol = collection(firestore, 'games', gameId, 'teams');
    const q = query(teamsCol, where('pin', '==', cleanPin));
    const snap = await getDocs(q);

    if (snap.empty) {
      throw new Error(`No team found with PIN "${cleanPin}". Please check with your Game Master.`);
    }

    const teamDoc = snap.docs[0];
    const playerId = authUser?.uid || `player_${Date.now()}`;

    // Upsert by player id inside a transaction: re-joining (refresh / re-scan) must not
    // add a second copy of the same player, and concurrent joins must not drop each other.
    const teamData = await runTransaction(firestore, async (txn) => {
      const teamSnap = await txn.get(teamDoc.ref);
      if (!teamSnap.exists()) {
        throw new Error(`No team found with PIN "${cleanPin}". Please check with your Game Master.`);
      }
      const data = teamSnap.data() as Team;
      const members = data.members || [];
      const existing = members.find((m) => m.id === playerId);

      const member: TeamMember = {
        id: playerId,
        nickname: nickname.trim(),
        joinedAt: existing?.joinedAt ?? Date.now(),
        lastSeenAt: Date.now(),
        isOnline: true,
      };
      const updatedMembers = [...members.filter((m) => m.id !== playerId), member];

      txn.update(teamDoc.ref, {
        lastActiveAt: serverTimestamp(),
        members: updatedMembers,
      });
      return { ...data, members: updatedMembers };
    });

    return {
      team: { ...teamData, id: teamDoc.id },
      playerId,
    };
  }

  async updatePlayerHeartbeat(
    gameId: string,
    teamId: string,
    playerId: string,
    nickname?: string
  ): Promise<void> {
    const firestore = this.getFirestoreDb();
    if (!firestore) {
      return mockAdapter.updatePlayerHeartbeat(gameId, teamId, playerId, nickname);
    }

    try {
      const teamRef = doc(firestore, 'games', gameId, 'teams', teamId);
      // Transaction so teammates' heartbeats don't overwrite each other's members entries
      await runTransaction(firestore, async (txn) => {
        const snap = await txn.get(teamRef);
        if (!snap.exists()) return;

        const data = snap.data() as Team;
        const members = data.members || [];
        let updated = false;

        const updatedMembers = members.map((m) => {
          if (m.id === playerId || (nickname && m.nickname === nickname)) {
            updated = true;
            return {
              ...m,
              id: playerId,
              lastSeenAt: Date.now(),
              isOnline: true,
            };
          }
          return m;
        });

        if (!updated && nickname) {
          updatedMembers.push({
            id: playerId,
            nickname: nickname.trim(),
            joinedAt: Date.now(),
            lastSeenAt: Date.now(),
            isOnline: true,
          });
        }

        txn.update(teamRef, {
          members: updatedMembers,
          lastActiveAt: serverTimestamp(),
        });
      });
    } catch (err) {
      console.warn('Failed to update player heartbeat:', err);
    }
  }

  async markPlayerOffline(
    gameId: string,
    teamId: string,
    playerId: string,
    nickname?: string
  ): Promise<void> {
    const firestore = this.getFirestoreDb();
    if (!firestore) {
      return mockAdapter.markPlayerOffline(gameId, teamId, playerId, nickname);
    }

    try {
      const teamRef = doc(firestore, 'games', gameId, 'teams', teamId);
      await runTransaction(firestore, async (txn) => {
        const snap = await txn.get(teamRef);
        if (!snap.exists()) return;

        const data = snap.data() as Team;
        const members = data.members || [];

        const updatedMembers = members.map((m) => {
          if (m.id === playerId || (nickname && m.nickname === nickname)) {
            return {
              ...m,
              lastSeenAt: Date.now(),
              isOnline: false,
            };
          }
          return m;
        });

        txn.update(teamRef, {
          members: updatedMembers,
          lastActiveAt: serverTimestamp(),
        });
      });
    } catch (err) {
      console.warn('Failed to mark player offline:', err);
    }
  }

  async updateTeamGps(gameId: string, teamId: string, coords: GeoCoordinate): Promise<void> {
    const firestore = this.getFirestoreDb();
    if (!firestore) {
      return mockAdapter.updateTeamGps(gameId, teamId, coords);
    }

    const teamRef = doc(firestore, 'games', gameId, 'teams', teamId);
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
    const firestore = this.getFirestoreDb();
    if (!firestore) {
      return mockAdapter.submitCluePhoto(gameId, submission);
    }

    await ensureAnonymousAuth();

    // Duplicate checks (same rules as the mock adapter)
    const teamSnap = await getDoc(doc(firestore, 'games', gameId, 'teams', submission.teamId));
    if (!teamSnap.exists()) {
      throw new Error(`Team ${submission.teamId} not found`);
    }
    if (((teamSnap.data() as Team).completedClueIds || []).includes(submission.clueId)) {
      throw new Error('Your team has already completed this clue!');
    }
    const pendingSnap = await getDocs(
      query(
        collection(firestore, 'games', gameId, 'submissions'),
        where('teamId', '==', submission.teamId),
        where('clueId', '==', submission.clueId),
        where('status', '==', 'pending')
      )
    );
    if (!pendingSnap.empty) {
      throw new Error('You already have a pending submission for this clue awaiting GM review.');
    }

    // Verify clue distance if coordinates available
    let distanceMeters: number | null = null;
    const coords = submission.submissionCoords || submission.captureCoords;
    if (coords) {
      const clueSnap = await getDocs(
        query(collection(firestore, 'games', gameId, 'clues'), where('__name__', '==', submission.clueId))
      );
      if (!clueSnap.empty) {
        const clueData = clueSnap.docs[0].data() as Clue;
        if (clueData.location) {
          distanceMeters = calculateHaversineDistance(coords, clueData.location);
        }
      }
    }

    const subsCol = collection(firestore, 'games', gameId, 'submissions');
    const newSubRef = doc(subsCol);

    const subData = {
      ...submission,
      submissionCoords: coords,
      captureCoords: coords,
      status: 'pending' as const,
      submittedAt: Date.now(),
      distanceFromClueMeters: distanceMeters ?? submission.distanceFromClueMeters ?? submission.distanceMeters ?? null,
      distanceMeters: distanceMeters ?? submission.distanceMeters ?? submission.distanceFromClueMeters ?? null,
      awardedPoints: 0,
    };

    await setDoc(newSubRef, subData);
    return { ...subData, id: newSubRef.id };
  }

  async verifySubmission(
    gameId: string,
    submissionId: string,
    action: 'approve' | 'reject' | 'bonus',
    points?: number,
    reason?: string
  ): Promise<void> {
    const firestore = this.getFirestoreDb();
    if (!firestore) {
      return mockAdapter.verifySubmission(gameId, submissionId, action, points, reason);
    }

    await ensureAnonymousAuth();

    await runTransaction(firestore, async (txn) => {
      const subRef = doc(firestore, 'games', gameId, 'submissions', submissionId);
      const subSnap = await txn.get(subRef);
      if (!subSnap.exists()) {
        throw new Error(`Submission ${submissionId} not found`);
      }

      const subData = subSnap.data() as Submission;
      // Only pending submissions can be reviewed, so a double click or two GMs
      // reviewing at once never awards points twice (the txn re-reads on retry).
      if (subData.status !== 'pending') {
        throw new Error(`Submission ${submissionId} has already been reviewed (${subData.status})`);
      }

      const teamRef = doc(firestore, 'games', gameId, 'teams', subData.teamId);
      const teamSnap = await txn.get(teamRef);

      const clueRef = doc(firestore, 'games', gameId, 'clues', subData.clueId);
      const clueSnap = await txn.get(clueRef);
      const cluePoints = clueSnap.exists() ? (clueSnap.data() as Clue).points : 100;
      // approve: `points` overrides the clue's points; bonus: `points` is the bonus on top.
      const basePoints = action === 'approve' ? (points ?? cluePoints) : cluePoints;

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
        const bonusAmount = points ?? 20;
        const totalAwarded = basePoints + bonusAmount;
        txn.update(subRef, {
          status: 'approved',
          awardedPoints: totalAwarded,
          bonusPoints: bonusAmount,
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
    const firestore = this.getFirestoreDb();
    if (!firestore) {
      return mockAdapter.toggleFreezeLeaderboard(gameId, isFrozen);
    }

    const gameRef = doc(firestore, 'games', gameId);
    await updateDoc(gameRef, {
      isFrozen,
      isLeaderboardFrozen: isFrozen,
      status: isFrozen ? 'frozen' : 'active',
      updatedAt: serverTimestamp(),
    });
  }

  async updateGameTimer(
    gameId: string,
    timeRemainingSeconds: number,
    status?: GameStatus
  ): Promise<void> {
    const firestore = this.getFirestoreDb();
    if (!firestore) {
      return mockAdapter.updateGameTimer(gameId, timeRemainingSeconds, status);
    }

    const gameRef = doc(firestore, 'games', gameId);
    await updateDoc(gameRef, {
      timeRemainingSeconds,
      ...(status ? { status } : {}),
      updatedAt: serverTimestamp(),
    });
  }

  async createClue(gameId: string, clue: Omit<Clue, 'id' | 'createdAt'>): Promise<Clue> {
    const firestore = this.getFirestoreDb();
    if (!firestore) {
      return mockAdapter.createClue(gameId, clue);
    }

    const cluesCol = collection(firestore, 'games', gameId, 'clues');
    const newClueRef = doc(cluesCol);
    const clueData = {
      ...clue,
      createdAt: Date.now(),
    };
    await setDoc(newClueRef, clueData);
    return { ...clueData, id: newClueRef.id };
  }

  async deleteClue(gameId: string, clueId: string): Promise<void> {
    const firestore = this.getFirestoreDb();
    if (!firestore) {
      return mockAdapter.deleteClue(gameId, clueId);
    }

    const clueRef = doc(firestore, 'games', gameId, 'clues', clueId);
    await deleteDoc(clueRef);
  }

  async initializeDefaultGame(targetGameId: string = 'melaka-hunt-2026'): Promise<Game> {
    const firestore = this.getFirestoreDb();
    if (!firestore) {
      return mockAdapter.getGame();
    }

    try {
      await ensureAnonymousAuth();
      const gameRef = doc(firestore, 'games', targetGameId);
      const gameSnap = await getDoc(gameRef);

      if (gameSnap.exists()) {
        return { id: gameSnap.id, ...gameSnap.data() } as Game;
      }

      // Check if global settings/zones exists
      let initialZones: Zone[] = [...MELAKA_ZONES];
      try {
        const settingsSnap = await getDoc(doc(firestore, 'settings', 'zones'));
        if (settingsSnap.exists() && Array.isArray(settingsSnap.data()?.zones) && settingsSnap.data().zones.length > 0) {
          initialZones = settingsSnap.data().zones;
        }
      } catch (e) {
        console.warn('Could not read settings/zones:', e);
      }

      const defaultGame: Game = {
        id: targetGameId,
        name: 'Melaka Heritage Photo Hunt 2026',
        status: 'active',
        passCode: 'melaka2026',
        durationMinutes: 120,
        timeRemainingSeconds: 7200,
        startTime: Date.now(),
        endTime: null,
        isLeaderboardFrozen: false,
        zones: initialZones,
        createdAt: Date.now(),
      };

      // Several clients can open the app before the game exists: only the client whose
      // transaction actually creates the game doc seeds it. Teams are written in the same
      // transaction, so nobody sees the game without its teams, and a late client never
      // re-writes a team (wiping members who already joined).
      const existingGame = await runTransaction(firestore, async (txn) => {
        const snap = await txn.get(gameRef);
        if (snap.exists()) return { id: snap.id, ...snap.data() } as Game;
        txn.set(gameRef, defaultGame);
        for (const team of DEFAULT_TEAMS) {
          txn.set(doc(firestore, 'games', defaultGame.id, 'teams', team.id), team);
        }
        return null;
      });
      if (existingGame) {
        return existingGame;
      }

      try {
        const srcCluesSnap = await getDocs(collection(firestore, 'games', 'hunt-nkvcz', 'clues'));
        if (!srcCluesSnap.empty) {
          for (const clueDoc of srcCluesSnap.docs) {
            const clueRef = doc(firestore, 'games', defaultGame.id, 'clues', clueDoc.id);
            const normalizedData = normalizeClueZh({ id: clueDoc.id, ...clueDoc.data() } as Clue);
            await setDoc(clueRef, { ...normalizedData, gameId: defaultGame.id });
          }
        }
      } catch (e) {
        console.warn('Could not copy clues during bootstrap:', e);
      }

      return defaultGame;
    } catch (err) {
      console.warn('Firestore bootstrap fallback to mock:', err);
      return mockAdapter.getGame();
    }
  }

  async reviewSubmission(
    gameId: string,
    submissionId: string,
    action: 'approve' | 'reject' | 'bonus',
    options?: { bonusPoints?: number; rejectionReason?: string }
  ) {
    // bonusPoints only applies to 'bonus'; passing it for 'approve' would override the clue's points.
    return this.verifySubmission(
      gameId,
      submissionId,
      action,
      action === 'bonus' ? options?.bonusPoints : undefined,
      options?.rejectionReason
    );
  }

  async updateGameStatus(gameId: string, status: GameStatus) {
    if (status === 'frozen') {
      return this.toggleFreezeLeaderboard(gameId, true);
    } else {
      await this.toggleFreezeLeaderboard(gameId, false);
      return this.updateGameTimer(gameId, 7200, status);
    }
  }

  async addClue(gameId: string, clue: Omit<Clue, 'id' | 'createdAt'>) {
    return this.createClue(gameId, clue);
  }

  async createGameWithTeams(
    name: string,
    numTeams: number,
    durationMinutes: number = 120,
    inheritedZones?: Zone[],
    sourceGameId?: string
  ): Promise<Game> {
    const firestore = this.getFirestoreDb();
    if (!firestore) {
      return mockAdapter.createGameWithTeams(name, numTeams, durationMinutes, inheritedZones);
    }

    await ensureAnonymousAuth();
    const gameId = `hunt-${Math.random().toString(36).substring(2, 7)}`;
    const gameRef = doc(firestore, 'games', gameId);

    // Determine zones to use:
    // 1. inheritedZones if provided
    // 2. Global settings/zones doc in Firestore
    // 3. localStorage 'HERITAGE_SAVED_ZONES'
    // 4. Fallback to MELAKA_ZONES (which has all 6 restored zones)
    let zonesToUse: Zone[] = inheritedZones && inheritedZones.length > 0 ? [...inheritedZones] : [];
    if (zonesToUse.length === 0) {
      try {
        const settingsSnap = await getDoc(doc(firestore, 'settings', 'zones'));
        if (settingsSnap.exists() && Array.isArray(settingsSnap.data()?.zones) && settingsSnap.data().zones.length > 0) {
          zonesToUse = settingsSnap.data().zones;
        }
      } catch (e) {
        console.warn('Could not fetch global settings/zones:', e);
      }
    }
    if (zonesToUse.length === 0 && typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('HERITAGE_SAVED_ZONES');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            zonesToUse = parsed;
          }
        }
      } catch (e) {
        // ignore
      }
    }
    if (zonesToUse.length === 0) {
      zonesToUse = [...MELAKA_ZONES];
    }

    const newGame: Game = {
      id: gameId,
      name: name.trim(),
      status: 'active',
      passCode: 'melaka2026',
      durationMinutes,
      timeRemainingSeconds: durationMinutes * 60,
      startTime: Date.now(),
      endTime: null,
      isLeaderboardFrozen: false,
      zones: zonesToUse,
      createdAt: Date.now(),
    };

    await setDoc(gameRef, newGame);

    const DEFAULT_PALETTES = [
      { name: 'Team Crimson', color: '#DC2626', pin: '1001' },
      { name: 'Team Cobalt', color: '#2563EB', pin: '2002' },
      { name: 'Team Emerald', color: '#059669', pin: '3003' },
      { name: 'Team Amber', color: '#D97706', pin: '4004' },
      { name: 'Team Violet', color: '#7C3AED', pin: '5005' },
      { name: 'Team Rose', color: '#E11D48', pin: '6006' },
      { name: 'Team Cyan', color: '#0891B2', pin: '7007' },
      { name: 'Team Lime', color: '#65A30D', pin: '8008' },
      { name: 'Team Fuchsia', color: '#C026D3', pin: '9009' },
      { name: 'Team Orange', color: '#EA580C', pin: '1234' },
    ];

    const clampedTeams = Math.max(2, Math.min(numTeams, 10));
    for (let i = 0; i < clampedTeams; i++) {
      const palette = DEFAULT_PALETTES[i];
      const teamId = `team_${i + 1}`;
      const teamRef = doc(firestore, 'games', gameId, 'teams', teamId);
      await setDoc(teamRef, {
        id: teamId,
        gameId,
        name: palette.name,
        color: palette.color,
        pin: palette.pin,
        score: 0,
        completedClueIds: [],
        lastActiveAt: Date.now(),
        members: [],
        createdAt: Date.now(),
      });
    }

    // Seed new game with the 121 real Melaka heritage clues from sourceGameId or hunt-nkvcz
    try {
      const clueSourceId = sourceGameId || 'hunt-nkvcz';
      let srcCluesSnap = await getDocs(collection(firestore, 'games', clueSourceId, 'clues'));
      if (srcCluesSnap.empty && clueSourceId !== 'hunt-nkvcz') {
        srcCluesSnap = await getDocs(collection(firestore, 'games', 'hunt-nkvcz', 'clues'));
      }
      if (!srcCluesSnap.empty) {
        for (const clueDoc of srcCluesSnap.docs) {
          const clueRef = doc(firestore, 'games', gameId, 'clues', clueDoc.id);
          const normalizedData = normalizeClueZh({ id: clueDoc.id, ...clueDoc.data() } as Clue);
          await setDoc(clueRef, { ...normalizedData, gameId });
        }
      }
    } catch (e) {
      console.warn('Could not copy clue bank to new game:', e);
    }

    return newGame;
  }

  async updateTeam(
    gameId: string,
    teamId: string,
    updates: { name?: string; pin?: string; color?: string }
  ): Promise<void> {
    const firestore = this.getFirestoreDb();
    if (!firestore) {
      return mockAdapter.updateTeam(gameId, teamId, updates);
    }

    await ensureAnonymousAuth();
    if (updates.pin) {
      const cleanPin = updates.pin.trim();
      const teamsCol = collection(firestore, 'games', gameId, 'teams');
      const q = query(teamsCol, where('pin', '==', cleanPin));
      const snap = await getDocs(q);
      const conflict = snap.docs.find((d) => d.id !== teamId);
      if (conflict) {
        throw new Error(`PIN "${cleanPin}" is already assigned to "${conflict.data().name}"`);
      }
    }

    const teamRef = doc(firestore, 'games', gameId, 'teams', teamId);
    await updateDoc(teamRef, {
      ...(updates.name ? { name: updates.name.trim() } : {}),
      ...(updates.pin ? { pin: updates.pin.trim() } : {}),
      ...(updates.color ? { color: updates.color } : {}),
      lastActiveAt: serverTimestamp(),
    });
  }

  async deleteTeam(gameId: string, teamId: string): Promise<void> {
    const firestore = this.getFirestoreDb();
    if (!firestore) {
      return mockAdapter.deleteTeam(gameId, teamId);
    }

    await ensureAnonymousAuth();
    const teamRef = doc(firestore, 'games', gameId, 'teams', teamId);
    const snap = await getDoc(teamRef);
    if (!snap.exists()) return;

    const data = snap.data() as Team;
    if (data.members && data.members.length > 0) {
      throw new Error(`Cannot delete "${data.name}" because it already has ${data.members.length} player(s) joined.`);
    }

    await deleteDoc(teamRef);
  }

  async updateZones(gameId: string, zones: any[]): Promise<void> {
    const firestore = this.getFirestoreDb();
    if (!firestore) {
      return mockAdapter.updateZones(gameId, zones);
    }

    await ensureAnonymousAuth();
    const gameRef = doc(firestore, 'games', gameId);
    await updateDoc(gameRef, {
      zones,
      updatedAt: serverTimestamp(),
    });

    // Also persist zones to global settings/zones and localStorage
    // so any future game created will inherit these zones
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('HERITAGE_SAVED_ZONES', JSON.stringify(zones));
      }
      await setDoc(
        doc(firestore, 'settings', 'zones'),
        {
          zones,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (e) {
      console.warn('Could not persist global settings/zones:', e);
    }
  }

  async sendBroadcast(payload: SendBroadcastPayload): Promise<BroadcastMessage> {
    const firestore = this.getFirestoreDb();
    if (!firestore) {
      return mockAdapter.sendBroadcast(payload);
    }

    await ensureAnonymousAuth();
    const now = Date.now();
    const bCol = collection(firestore, 'games', payload.gameId, 'broadcasts');
    const newRef = doc(bCol);
    const broadcastMsg: BroadcastMessage = {
      id: newRef.id,
      gameId: payload.gameId,
      message: payload.message.trim(),
      type: payload.type || 'info',
      sender: payload.sender || 'Game Master',
      sentAt: now,
      expiresAt: payload.expiresInMinutes ? now + payload.expiresInMinutes * 60 * 1000 : null,
    };

    await setDoc(newRef, broadcastMsg);

    const gameRef = doc(firestore, 'games', payload.gameId);
    await updateDoc(gameRef, {
      activeBroadcast: broadcastMsg,
      updatedAt: serverTimestamp(),
    });

    return broadcastMsg;
  }

  async clearActiveBroadcast(gameId: string): Promise<void> {
    const firestore = this.getFirestoreDb();
    if (!firestore) {
      return mockAdapter.clearActiveBroadcast(gameId);
    }

    await ensureAnonymousAuth();
    const gameRef = doc(firestore, 'games', gameId);
    await updateDoc(gameRef, {
      activeBroadcast: null,
      updatedAt: serverTimestamp(),
    });
  }
}

export const gameService = new UnifiedGameService();
