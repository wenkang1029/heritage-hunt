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
} from '../types/index.ts';
import { calculateHaversineDistance } from '../utils/haversine.ts';

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
      return mockAdapter.subscribeToClues(gameId, callback);
    }

    const cluesCol = collection(firestore, 'games', gameId, 'clues');
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
    const teamData = teamDoc.data() as Team;
    const playerId = authUser?.uid || `player_${Date.now()}`;

    const member: TeamMember = {
      id: playerId,
      nickname: nickname.trim(),
      joinedAt: Date.now(),
      lastSeenAt: Date.now(),
      isOnline: true,
    };

    await updateDoc(teamDoc.ref, {
      lastActiveAt: serverTimestamp(),
      members: arrayUnion(member),
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
      const snap = await getDoc(teamRef);
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

      await updateDoc(teamRef, {
        members: updatedMembers,
        lastActiveAt: serverTimestamp(),
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
      const snap = await getDoc(teamRef);
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

      await updateDoc(teamRef, {
        members: updatedMembers,
        lastActiveAt: serverTimestamp(),
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
      const teamRef = doc(firestore, 'games', gameId, 'teams', subData.teamId);
      const teamSnap = await txn.get(teamRef);

      const clueRef = doc(firestore, 'games', gameId, 'clues', subData.clueId);
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
        const bonusAmount = 20;
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

      const defaultGame: Game = {
        id: 'melaka-hunt-2026',
        name: 'Melaka Heritage Photo Hunt 2026',
        status: 'active',
        passCode: 'melaka2026',
        durationMinutes: 120,
        timeRemainingSeconds: 7200,
        startTime: Date.now(),
        endTime: null,
        isLeaderboardFrozen: false,
        zones: [...MELAKA_ZONES],
        createdAt: Date.now(),
      };

      await setDoc(gameRef, defaultGame);

      for (const team of DEFAULT_TEAMS) {
        const teamRef = doc(firestore, 'games', defaultGame.id, 'teams', team.id);
        await setDoc(teamRef, team);
      }

      try {
        const srcCluesSnap = await getDocs(collection(firestore, 'games', 'hunt-nkvcz', 'clues'));
        if (!srcCluesSnap.empty) {
          for (const clueDoc of srcCluesSnap.docs) {
            const clueRef = doc(firestore, 'games', defaultGame.id, 'clues', clueDoc.id);
            await setDoc(clueRef, { ...clueDoc.data(), gameId: defaultGame.id });
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
    return this.verifySubmission(
      gameId,
      submissionId,
      action,
      options?.bonusPoints,
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
    durationMinutes: number = 120
  ): Promise<Game> {
    const firestore = this.getFirestoreDb();
    if (!firestore) {
      return mockAdapter.createGameWithTeams(name, numTeams, durationMinutes);
    }

    await ensureAnonymousAuth();
    const gameId = `hunt-${Math.random().toString(36).substring(2, 7)}`;
    const gameRef = doc(firestore, 'games', gameId);

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
      zones: [...MELAKA_ZONES],
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

    // Seed new game with the 121 real Melaka heritage clues
    try {
      const srcCluesSnap = await getDocs(collection(firestore, 'games', 'hunt-nkvcz', 'clues'));
      if (!srcCluesSnap.empty) {
        for (const clueDoc of srcCluesSnap.docs) {
          const clueRef = doc(firestore, 'games', gameId, 'clues', clueDoc.id);
          await setDoc(clueRef, { ...clueDoc.data(), gameId });
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
  }
}

export const gameService = new UnifiedGameService();
