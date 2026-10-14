import type {
  Game,
  Team,
  Clue,
  Submission,
  GameStatus,
  GeoCoordinate,
  Unsubscribe,
} from './contracts.ts';
import { INVARIANTS } from './contracts.ts';
import { MELAKA_ZONES } from './zones.ts';

export class MockGameAdapter {
  private games = new Map<string, Game>();
  private teams = new Map<string, Map<string, Team>>(); // gameId -> teamId -> Team
  private clues = new Map<string, Map<string, Clue>>(); // gameId -> clueId -> Clue
  private submissions = new Map<string, Map<string, Submission>>(); // gameId -> submissionId -> Submission

  private gameListeners = new Map<string, Set<(game: Game) => void>>();
  private teamsListeners = new Map<string, Set<(teams: Team[]) => void>>();
  private cluesListeners = new Map<string, Set<(clues: Clue[]) => void>>();
  private submissionsListeners = new Map<string, Set<(submissions: Submission[]) => void>>();

  // Event sinks for tracking approvals (e.g. celebratory confetti trigger)
  private confettiListeners = new Set<(event: { teamId: string; clueId: string; points: number }) => void>();

  // Team GPS throttle tracking (teamId -> lastUpdateTimeMs)
  private lastGpsBroadcast = new Map<string, number>();

  // Offline queue simulation
  public isOffline = false;
  private offlineSubmissionsQueue: Array<{
    gameId: string;
    submission: Omit<Submission, 'id' | 'status' | 'submittedAt'>;
    resolve: (sub: Submission) => void;
    reject: (err: Error) => void;
  }> = [];

  constructor() {
    this.reset();
  }

  public reset(): void {
    this.games.clear();
    this.teams.clear();
    this.clues.clear();
    this.submissions.clear();
    this.gameListeners.clear();
    this.teamsListeners.clear();
    this.cluesListeners.clear();
    this.submissionsListeners.clear();
    this.confettiListeners.clear();
    this.lastGpsBroadcast.clear();
    this.isOffline = false;
    this.offlineSubmissionsQueue = [];
  }

  // --- Game Management ---
  public createGame(id: string, name: string = 'Melaka Heritage Photo Hunt'): Game {
    const game: Game = {
      id,
      name,
      status: 'lobby',
      startTime: null,
      durationMinutes: 60,
      timeRemainingSeconds: 3600,
      passCode: INVARIANTS.DEFAULT_GM_PASSCODE,
      isLeaderboardFrozen: false,
      zones: MELAKA_ZONES,
      createdAt: Date.now(),
    };
    this.games.set(id, game);
    this.teams.set(id, new Map());
    this.clues.set(id, new Map());
    this.submissions.set(id, new Map());
    return game;
  }

  public getGame(gameId: string): Game | undefined {
    return this.games.get(gameId);
  }

  public subscribeToGame(gameId: string, callback: (game: Game) => void): Unsubscribe {
    if (!this.gameListeners.has(gameId)) {
      this.gameListeners.set(gameId, new Set());
    }
    const set = this.gameListeners.get(gameId)!;
    set.add(callback);

    const currentGame = this.games.get(gameId);
    if (currentGame) {
      callback({ ...currentGame });
    }

    return () => set.delete(callback);
  }

  private notifyGame(gameId: string): void {
    const game = this.games.get(gameId);
    if (!game) return;
    const listeners = this.gameListeners.get(gameId);
    if (listeners) {
      for (const cb of listeners) {
        cb({ ...game });
      }
    }
  }

  // --- Teams ---
  public subscribeToTeams(gameId: string, callback: (teams: Team[]) => void): Unsubscribe {
    if (!this.teamsListeners.has(gameId)) {
      this.teamsListeners.set(gameId, new Set());
    }
    const set = this.teamsListeners.get(gameId)!;
    set.add(callback);

    const teamMap = this.teams.get(gameId);
    const teams = teamMap ? Array.from(teamMap.values()) : [];
    callback([...teams]);

    return () => set.delete(callback);
  }

  private notifyTeams(gameId: string): void {
    const teamMap = this.teams.get(gameId);
    const teams = teamMap ? Array.from(teamMap.values()) : [];
    const listeners = this.teamsListeners.get(gameId);
    if (listeners) {
      for (const cb of listeners) {
        cb([...teams]);
      }
    }
  }

  public async createTeam(gameId: string, name: string, color: string, pin: string): Promise<Team> {
    const trimmedPin = pin.trim();
    if (!/^\d{4}$/.test(trimmedPin)) {
      throw new Error(`Invalid PIN '${pin}': PIN must be exactly 4 numeric digits.`);
    }

    let teamMap = this.teams.get(gameId);
    if (!teamMap) {
      teamMap = new Map();
      this.teams.set(gameId, teamMap);
    }

    // Check for duplicate PIN in same game
    for (const t of teamMap.values()) {
      if (t.pin === trimmedPin) {
        throw new Error(`PIN collision: Team '${t.name}' already uses PIN '${trimmedPin}'.`);
      }
    }

    const teamId = `team_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const team: Team = {
      id: teamId,
      gameId,
      name,
      pin: trimmedPin,
      color,
      score: 0,
      completedClueIds: [],
      lastActiveAt: Date.now(),
    };

    teamMap.set(teamId, team);
    this.notifyTeams(gameId);
    return team;
  }

  public async joinTeamByPin(
    gameId: string,
    pin: string,
    nickname: string
  ): Promise<{ team: Team; playerId: string }> {
    if (!nickname || nickname.trim().length === 0) {
      throw new Error('Nickname is required to join a team.');
    }

    const trimmedPin = pin.trim();
    const teamMap = this.teams.get(gameId);
    if (!teamMap) {
      throw new Error(`Game '${gameId}' not found.`);
    }

    let matchedTeam: Team | undefined;
    for (const t of teamMap.values()) {
      if (t.pin === trimmedPin) {
        matchedTeam = t;
        break;
      }
    }

    if (!matchedTeam) {
      throw new Error(`Invalid PIN: No team matches PIN '${trimmedPin}'.`);
    }

    // Assign anonymous player ID
    const playerId = `anon_player_${Math.random().toString(36).slice(2, 9)}`;
    matchedTeam.lastActiveAt = Date.now();
    this.notifyTeams(gameId);

    return {
      team: { ...matchedTeam },
      playerId,
    };
  }

  public async updateTeamGps(
    gameId: string,
    teamId: string,
    coords: GeoCoordinate,
    force: boolean = false
  ): Promise<boolean> {
    const now = Date.now();
    const lastUpdate = this.lastGpsBroadcast.get(teamId) || 0;

    if (!force && now - lastUpdate < INVARIANTS.GPS_BROADCAST_THROTTLE_MS) {
      // Throttled: skip broadcast to save battery & Firestore quota
      return false;
    }

    const teamMap = this.teams.get(gameId);
    const team = teamMap?.get(teamId);
    if (!team) {
      throw new Error(`Team '${teamId}' not found in game '${gameId}'.`);
    }

    team.currentCoords = {
      lat: coords.lat,
      lng: coords.lng,
      updatedAt: now,
    };
    team.lastActiveAt = now;
    this.lastGpsBroadcast.set(teamId, now);

    this.notifyTeams(gameId);
    return true;
  }

  // --- Clues ---
  public subscribeToClues(gameId: string, callback: (clues: Clue[]) => void): Unsubscribe {
    if (!this.cluesListeners.has(gameId)) {
      this.cluesListeners.set(gameId, new Set());
    }
    const set = this.cluesListeners.get(gameId)!;
    set.add(callback);

    const clueMap = this.clues.get(gameId);
    const clues = clueMap ? Array.from(clueMap.values()) : [];
    callback([...clues]);

    return () => set.delete(callback);
  }

  private notifyClues(gameId: string): void {
    const clueMap = this.clues.get(gameId);
    const clues = clueMap ? Array.from(clueMap.values()) : [];
    const listeners = this.cluesListeners.get(gameId);
    if (listeners) {
      for (const cb of listeners) {
        cb([...clues]);
      }
    }
  }

  public async addClue(gameId: string, clueData: Omit<Clue, 'id' | 'gameId' | 'createdAt'>): Promise<Clue> {
    let clueMap = this.clues.get(gameId);
    if (!clueMap) {
      clueMap = new Map();
      this.clues.set(gameId, clueMap);
    }

    const clueId = `clue_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const clue: Clue = {
      id: clueId,
      gameId,
      ...clueData,
      createdAt: Date.now(),
    };

    clueMap.set(clueId, clue);
    this.notifyClues(gameId);
    return clue;
  }

  public async updateClue(gameId: string, clueId: string, updates: Partial<Clue>): Promise<Clue> {
    const clueMap = this.clues.get(gameId);
    const clue = clueMap?.get(clueId);
    if (!clue) throw new Error(`Clue '${clueId}' not found.`);

    Object.assign(clue, updates);
    this.notifyClues(gameId);
    return clue;
  }

  public async deleteClue(gameId: string, clueId: string): Promise<void> {
    const clueMap = this.clues.get(gameId);
    if (clueMap) {
      clueMap.delete(clueId);
      this.notifyClues(gameId);
    }
  }

  // --- Submissions ---
  public subscribeToSubmissions(
    gameId: string,
    callback: (submissions: Submission[]) => void
  ): Unsubscribe {
    if (!this.submissionsListeners.has(gameId)) {
      this.submissionsListeners.set(gameId, new Set());
    }
    const set = this.submissionsListeners.get(gameId)!;
    set.add(callback);

    const subMap = this.submissions.get(gameId);
    const subs = subMap ? Array.from(subMap.values()) : [];
    callback([...subs]);

    return () => set.delete(callback);
  }

  private notifySubmissions(gameId: string): void {
    const subMap = this.submissions.get(gameId);
    const subs = subMap ? Array.from(subMap.values()) : [];
    const listeners = this.submissionsListeners.get(gameId);
    if (listeners) {
      for (const cb of listeners) {
        cb([...subs]);
      }
    }
  }

  public subscribeToConfetti(
    callback: (event: { teamId: string; clueId: string; points: number }) => void
  ): Unsubscribe {
    this.confettiListeners.add(callback);
    return () => this.confettiListeners.delete(callback);
  }

  public async submitCluePhoto(
    gameId: string,
    submission: Omit<Submission, 'id' | 'status' | 'submittedAt'>
  ): Promise<Submission> {
    // Check duplicate submission prevention (FR-4.4)
    const teamMap = this.teams.get(gameId);
    const team = teamMap?.get(submission.teamId);
    if (team && team.completedClueIds.includes(submission.clueId)) {
      throw new Error(`Team '${team.name}' has already completed clue '${submission.clueId}'. Duplicate submissions are prevented.`);
    }

    if (this.isOffline) {
      return new Promise((resolve, reject) => {
        this.offlineSubmissionsQueue.push({
          gameId,
          submission,
          resolve,
          reject,
        });
      });
    }

    let subMap = this.submissions.get(gameId);
    if (!subMap) {
      subMap = new Map();
      this.submissions.set(gameId, subMap);
    }

    const submissionId = `sub_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const newSubmission: Submission = {
      id: submissionId,
      gameId,
      status: 'pending',
      submittedAt: Date.now(),
      ...submission,
    };

    subMap.set(submissionId, newSubmission);
    this.notifySubmissions(gameId);
    return newSubmission;
  }

  public async reconnectAndFlushOfflineQueue(): Promise<number> {
    this.isOffline = false;
    const queuedCount = this.offlineSubmissionsQueue.length;
    const queue = [...this.offlineSubmissionsQueue];
    this.offlineSubmissionsQueue = [];

    for (const item of queue) {
      try {
        const result = await this.submitCluePhoto(item.gameId, item.submission);
        item.resolve(result);
      } catch (err: any) {
        item.reject(err);
      }
    }
    return queuedCount;
  }

  public getOfflineQueueLength(): number {
    return this.offlineSubmissionsQueue.length;
  }

  public async verifySubmission(
    gameId: string,
    submissionId: string,
    action: 'approve' | 'reject' | 'bonus',
    points?: number,
    reason?: string
  ): Promise<void> {
    const subMap = this.submissions.get(gameId);
    const submission = subMap?.get(submissionId);
    if (!submission) {
      throw new Error(`Submission '${submissionId}' not found.`);
    }

    if (submission.status !== 'pending') {
      throw new Error(`Submission '${submissionId}' has already been reviewed (${submission.status}).`);
    }

    const teamMap = this.teams.get(gameId);
    const team = teamMap?.get(submission.teamId);

    submission.reviewedAt = Date.now();

    if (action === 'approve') {
      submission.status = 'approved';
      const award = points !== undefined ? points : (submission.awardedPoints || 100);
      submission.awardedPoints = award;

      if (team) {
        team.score += award;
        if (!team.completedClueIds.includes(submission.clueId)) {
          team.completedClueIds.push(submission.clueId);
        }
        this.notifyTeams(gameId);
      }

      // Fire celebratory confetti event
      for (const cb of this.confettiListeners) {
        cb({ teamId: submission.teamId, clueId: submission.clueId, points: award });
      }
    } else if (action === 'bonus') {
      submission.status = 'approved';
      const bonus = points !== undefined ? points : 20;
      const basePoints = submission.awardedPoints || 100;
      submission.bonusPoints = bonus;
      submission.awardedPoints = basePoints + bonus;

      if (team) {
        team.score += submission.awardedPoints;
        if (!team.completedClueIds.includes(submission.clueId)) {
          team.completedClueIds.push(submission.clueId);
        }
        this.notifyTeams(gameId);
      }

      for (const cb of this.confettiListeners) {
        cb({ teamId: submission.teamId, clueId: submission.clueId, points: submission.awardedPoints });
      }
    } else if (action === 'reject') {
      submission.status = 'rejected';
      submission.rejectionReason = reason || 'Photo does not match the heritage clue landmark.';
      submission.awardedPoints = 0;
      // Team completedClueIds and score remain unchanged
    } else {
      throw new Error(`Invalid review action '${action}'. Must be 'approve', 'reject', or 'bonus'.`);
    }

    this.notifySubmissions(gameId);
  }

  // --- Leaderboard & Controls ---
  public async toggleFreezeLeaderboard(gameId: string, isFrozen: boolean): Promise<void> {
    const game = this.games.get(gameId);
    if (!game) throw new Error(`Game '${gameId}' not found.`);

    game.isLeaderboardFrozen = isFrozen;
    this.notifyGame(gameId);
  }

  public async updateGameTimer(
    gameId: string,
    timeRemainingSeconds: number,
    status?: GameStatus
  ): Promise<void> {
    const game = this.games.get(gameId);
    if (!game) throw new Error(`Game '${gameId}' not found.`);

    game.timeRemainingSeconds = Math.max(0, timeRemainingSeconds);
    if (status) {
      game.status = status;
    }
    this.notifyGame(gameId);
  }
}
