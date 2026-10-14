/**
 * Melaka Heritage Hunt - Hybrid Mock Adapter Service
 * Path: src/services/mockAdapter.ts
 *
 * Provides in-memory reactive state + localStorage persistence + multi-tab BroadcastChannel sync.
 */

import type {
  Game,
  Team,
  Clue,
  Submission,
  GeoCoordinate,
  Unsubscribe,
  GameStatus,
} from '../types/index.ts';
import { calculateHaversineDistance } from '../utils/haversine.ts';
import {
  MELAKA_ZONES,
  INITIAL_CLUES,
  DEFAULT_TEAMS,
} from '../data/melakaZones.ts';

const STORAGE_KEY = 'melaka_hunt_mock_state_v1';
const BUS_CHANNEL_NAME = 'melaka_hunt_bus';

export interface MockState {
  game: Game;
  teams: Record<string, Team>;
  clues: Record<string, Clue>;
  submissions: Record<string, Submission>;
}

type Listener<T> = (data: T) => void;

function getStorage(): Storage | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
    if (typeof localStorage !== 'undefined') {
      return localStorage;
    }
  } catch {
    // Ignore storage availability errors
  }
  return null;
}

export class MockAdapterService {
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
      passCode: 'melaka2026',
      durationMinutes: 90,
      timeRemainingSeconds: 5400,
      startTime: Date.now(),
      endTime: null,
      isLeaderboardFrozen: false,
      isFrozen: false,
      zones: [...MELAKA_ZONES],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const initialClues: Record<string, Clue> = {};
    for (const clue of INITIAL_CLUES) {
      initialClues[clue.id] = { ...clue };
    }

    const initialTeams: Record<string, Team> = {};
    for (const team of DEFAULT_TEAMS) {
      initialTeams[team.id] = { ...team, members: [...team.members] };
    }

    return {
      game: initialGame,
      teams: initialTeams,
      clues: initialClues,
      submissions: {},
    };
  }

  private loadState(): MockState {
    const storage = getStorage();
    if (storage) {
      try {
        const raw = storage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.game && parsed?.teams && parsed?.clues && parsed?.submissions) {
            return parsed;
          }
        }
      } catch (err) {
        console.warn('Failed to parse mock state from storage, reseeding:', err);
      }
    }

    const seeded = this.getInitialState();
    this.saveStateToStorage(seeded);
    return seeded;
  }

  private saveStateToStorage(state: MockState): void {
    const storage = getStorage();
    if (!storage) return;
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      console.warn('Failed to write mock state to storage:', err);
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
      try {
        this.channel = new BroadcastChannel(BUS_CHANNEL_NAME);
        this.channel.onmessage = (event) => {
          if (event.data?.type === 'MOCK_STATE_UPDATE' && event.data.state) {
            this.state = event.data.state;
            this.notifyAllSubscribers();
          }
        };
      } catch {
        this.channel = null;
      }
    }
  }

  private initStorageListener(): void {
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
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

  getGame(): Game {
    return { ...this.state.game };
  }

  // =========================================================================
  // Subscriptions (Mirroring Firestore onSnapshot)
  // =========================================================================

  subscribeToGame(_gameId: string, callback: (game: Game) => void): Unsubscribe {
    this.gameListeners.add(callback);
    callback({ ...this.state.game });
    return () => {
      this.gameListeners.delete(callback);
    };
  }

  subscribeToTeams(_gameId: string, callback: (teams: Team[]) => void): Unsubscribe {
    this.teamsListeners.add(callback);
    const teamsArray = Object.values(this.state.teams).sort((a, b) => b.score - a.score);
    callback([...teamsArray]);
    return () => {
      this.teamsListeners.delete(callback);
    };
  }

  subscribeToClues(_gameId: string, callback: (clues: Clue[]) => void): Unsubscribe {
    this.cluesListeners.add(callback);
    const cluesArray = Object.values(this.state.clues);
    callback([...cluesArray]);
    return () => {
      this.cluesListeners.delete(callback);
    };
  }

  subscribeToSubmissions(_gameId: string, callback: (submissions: Submission[]) => void): Unsubscribe {
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
      gameId,
      name: name.trim(),
      pin: cleanPin,
      color,
      score: 0,
      completedClueIds: [],
      currentCoords: null,
      lastActiveAt: Date.now(),
      members: [],
      createdAt: Date.now(),
    };

    this.state.teams[teamId] = newTeam;
    this.broadcastMutation();
    return newTeam;
  }

  async joinTeamByPin(
    _gameId: string,
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
      joinedAt: Date.now(),
    };

    const members = team.members ? [...team.members, member] : [member];
    this.state.teams[team.id] = {
      ...team,
      members,
      lastActiveAt: Date.now(),
    };

    this.broadcastMutation();
    return { team: this.state.teams[team.id], playerId };
  }

  async updateTeamGps(_gameId: string, teamId: string, coords: GeoCoordinate): Promise<void> {
    const team = this.state.teams[teamId];
    if (!team) return;

    this.state.teams[teamId] = {
      ...team,
      currentCoords: coords,
      lastActiveAt: Date.now(),
    };

    this.broadcastMutation();
  }

  async submitCluePhoto(
    _gameId: string,
    submission: Omit<Submission, 'id' | 'status' | 'submittedAt'>
  ): Promise<Submission> {
    const team = this.state.teams[submission.teamId];
    if (!team) {
      throw new Error(`Team ${submission.teamId} not found`);
    }

    // Duplicate check: Already approved / completed
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
    let distanceMeters: number | null = null;
    const clue = this.state.clues[submission.clueId];
    const coords = submission.submissionCoords || submission.captureCoords;
    if (clue?.location && coords) {
      distanceMeters = calculateHaversineDistance(coords, clue.location);
    }

    const submissionId = `sub_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newSubmission: Submission = {
      ...submission,
      id: submissionId,
      status: 'pending',
      submittedAt: Date.now(),
      submissionCoords: coords,
      captureCoords: coords,
      distanceFromClueMeters: distanceMeters ?? submission.distanceFromClueMeters ?? submission.distanceMeters ?? null,
      distanceMeters: distanceMeters ?? submission.distanceMeters ?? submission.distanceFromClueMeters ?? null,
      awardedPoints: 0,
    };

    this.state.submissions[submissionId] = newSubmission;
    this.broadcastMutation();
    return newSubmission;
  }

  async verifySubmission(
    _gameId: string,
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
        reviewedAt: Date.now(),
      };

      if (team) {
        const completed = team.completedClueIds.includes(sub.clueId)
          ? team.completedClueIds
          : [...team.completedClueIds, sub.clueId];

        this.state.teams[sub.teamId] = {
          ...team,
          score: team.score + awarded,
          completedClueIds: completed,
          lastActiveAt: Date.now(),
        };
      }
    } else if (action === 'bonus') {
      const bonusAmount = 20;
      const awarded = basePoints + bonusAmount;
      this.state.submissions[submissionId] = {
        ...sub,
        status: 'approved',
        awardedPoints: awarded,
        bonusPoints: bonusAmount,
        reviewedAt: Date.now(),
      };

      if (team) {
        const completed = team.completedClueIds.includes(sub.clueId)
          ? team.completedClueIds
          : [...team.completedClueIds, sub.clueId];

        this.state.teams[sub.teamId] = {
          ...team,
          score: team.score + awarded,
          completedClueIds: completed,
          lastActiveAt: Date.now(),
        };
      }
    } else {
      // Reject
      this.state.submissions[submissionId] = {
        ...sub,
        status: 'rejected',
        rejectionReason: reason || 'Photo rejected by Game Master',
        reviewedAt: Date.now(),
      };
    }

    this.broadcastMutation();
  }

  async toggleFreezeLeaderboard(_gameId: string, isFrozen: boolean): Promise<void> {
    this.state.game = {
      ...this.state.game,
      isLeaderboardFrozen: isFrozen,
      isFrozen,
      status: isFrozen ? 'frozen' : 'active',
      updatedAt: Date.now(),
    };
    this.broadcastMutation();
  }

  async updateGameTimer(
    _gameId: string,
    timeRemainingSeconds: number,
    status?: GameStatus
  ): Promise<void> {
    this.state.game = {
      ...this.state.game,
      timeRemainingSeconds,
      ...(status ? { status } : {}),
      updatedAt: Date.now(),
    };
    this.broadcastMutation();
  }

  async createClue(_gameId: string, clue: Omit<Clue, 'id' | 'createdAt'>): Promise<Clue> {
    const clueId = `clue_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newClue: Clue = {
      ...clue,
      id: clueId,
      createdAt: Date.now(),
    };
    this.state.clues[clueId] = newClue;
    this.broadcastMutation();
    return newClue;
  }

  async deleteClue(_gameId: string, clueId: string): Promise<void> {
    delete this.state.clues[clueId];
    this.broadcastMutation();
  }

  /**
   * Resets the entire mock environment back to pristine default state.
   */
  resetState(): void {
    this.state = this.getInitialState();
    this.broadcastMutation();
  }
}

export const mockAdapter = new MockAdapterService();
