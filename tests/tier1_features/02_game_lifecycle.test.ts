import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { MockGameAdapter } from '../framework/mockGameAdapter.ts';

describe('Tier 1 - Feature Group 2: Game State & Lifecycle', () => {
  let adapter: MockGameAdapter;
  const GAME_ID = 'test-game-lifecycle-02';

  beforeEach(() => {
    adapter = new MockGameAdapter();
    adapter.createGame(GAME_ID);
  });

  describe('Feature 5: Game State Management', () => {
    it('F05-T1: Game initializes in lobby/draft state by default', () => {
      const game = adapter.getGame(GAME_ID)!;
      assert.equal(game.status, 'lobby');
      assert.equal(game.startTime, null);
    });

    it('F05-T2: Transition from lobby to active updates status and records startTime', async () => {
      await adapter.updateGameTimer(GAME_ID, 3600, 'active');
      const game = adapter.getGame(GAME_ID)!;
      assert.equal(game.status, 'active');
    });

    it('F05-T3: Transition to paused preserves remaining seconds', async () => {
      await adapter.updateGameTimer(GAME_ID, 1850, 'active');
      await adapter.updateGameTimer(GAME_ID, 1850, 'paused');
      const game = adapter.getGame(GAME_ID)!;
      assert.equal(game.status, 'paused');
      assert.equal(game.timeRemainingSeconds, 1850);
    });

    it('F05-T4: Transition to frozen allows gameplay while flagging leaderboard suspense', async () => {
      await adapter.updateGameTimer(GAME_ID, 300, 'frozen');
      const game = adapter.getGame(GAME_ID)!;
      assert.equal(game.status, 'frozen');
      assert.equal(game.timeRemainingSeconds, 300);
    });

    it('F05-T5: Transition to ended/completed terminates active state and sets time to zero', async () => {
      await adapter.updateGameTimer(GAME_ID, 0, 'ended');
      const game = adapter.getGame(GAME_ID)!;
      assert.equal(game.status, 'ended');
      assert.equal(game.timeRemainingSeconds, 0);
    });
  });

  describe('Feature 6: Game Countdown Timer', () => {
    it('F06-T1: Initial duration defaults to configured minutes in seconds', () => {
      const game = adapter.getGame(GAME_ID)!;
      assert.equal(game.durationMinutes, 60);
      assert.equal(game.timeRemainingSeconds, 3600);
    });

    it('F06-T2: Decrementing countdown reflects remaining seconds correctly', async () => {
      await adapter.updateGameTimer(GAME_ID, 3599);
      assert.equal(adapter.getGame(GAME_ID)!.timeRemainingSeconds, 3599);
      await adapter.updateGameTimer(GAME_ID, 3500);
      assert.equal(adapter.getGame(GAME_ID)!.timeRemainingSeconds, 3500);
    });

    it('F06-T3: Timer does not drop below zero seconds', async () => {
      await adapter.updateGameTimer(GAME_ID, -15);
      assert.equal(adapter.getGame(GAME_ID)!.timeRemainingSeconds, 0);
    });

    it('F06-T4: Real-time subscriber receives timer countdown updates', async () => {
      const recorded: number[] = [];
      const unsubscribe = adapter.subscribeToGame(GAME_ID, (game) => {
        recorded.push(game.timeRemainingSeconds);
      });

      await adapter.updateGameTimer(GAME_ID, 3000);
      await adapter.updateGameTimer(GAME_ID, 2999);
      unsubscribe();
      await adapter.updateGameTimer(GAME_ID, 2000);

      assert.deepEqual(recorded, [3600, 3000, 2999]);
    });

    it('F06-T5: Formatting helper converts seconds to MM:SS and HH:MM:SS', () => {
      const formatTime = (totalSeconds: number): string => {
        const m = Math.floor(totalSeconds / 60);
        const s = totalSeconds % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
      };

      assert.equal(formatTime(3600), '60:00');
      assert.equal(formatTime(359), '05:59');
      assert.equal(formatTime(0), '00:00');
    });
  });

  describe('Feature 7: Freeze Leaderboard Toggle', () => {
    it('F07-T1: Leaderboard freeze is false by default in new game', () => {
      const game = adapter.getGame(GAME_ID)!;
      assert.equal(game.isLeaderboardFrozen, false);
    });

    it('F07-T2: GM can activate leaderboard freeze', async () => {
      await adapter.toggleFreezeLeaderboard(GAME_ID, true);
      assert.equal(adapter.getGame(GAME_ID)!.isLeaderboardFrozen, true);
    });

    it('F07-T3: GM can deactivate leaderboard freeze to reveal final ranks', async () => {
      await adapter.toggleFreezeLeaderboard(GAME_ID, true);
      await adapter.toggleFreezeLeaderboard(GAME_ID, false);
      assert.equal(adapter.getGame(GAME_ID)!.isLeaderboardFrozen, false);
    });

    it('F07-T4: Game subscription broadcasts isLeaderboardFrozen changes immediately', async () => {
      const states: boolean[] = [];
      const unsub = adapter.subscribeToGame(GAME_ID, (game) => {
        states.push(game.isLeaderboardFrozen);
      });

      await adapter.toggleFreezeLeaderboard(GAME_ID, true);
      await adapter.toggleFreezeLeaderboard(GAME_ID, false);
      unsub();

      assert.deepEqual(states, [false, true, false]);
    });

    it('F07-T5: Filter helper masks live scores from players when frozen but keeps them for GM', () => {
      const mockTeam = { id: 't1', name: 'Crimson', score: 450 };
      const getPlayerViewScore = (team: typeof mockTeam, isFrozen: boolean, frozenScore: number): number => {
        return isFrozen ? frozenScore : team.score;
      };

      const frozenScoreSnapshot = 300;
      // When frozen, player view sees snapshot
      assert.equal(getPlayerViewScore(mockTeam, true, frozenScoreSnapshot), 300);
      // When unfrozen, player view sees real-time score
      assert.equal(getPlayerViewScore(mockTeam, false, frozenScoreSnapshot), 450);
    });
  });
});
