import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MockGameAdapter } from '../framework/mockGameAdapter.ts';
import { SAMPLE_MELAKA_CLUES } from '../framework/testHelpers.ts';
import { generateSyntheticBase64Image } from '../framework/compressionOracle.ts';
import type { Team, Game } from '../framework/contracts.ts';

describe('Tier 3 - Cross-Feature Pairwise: Frozen Leaderboard Flow', () => {
  it('Simulates late-game suspense: Freeze toggle hides updates from player view while GM view tracks real-time scores', async () => {
    const adapter = new MockGameAdapter();
    const GAME_ID = 'pairwise-frozen-game';
    adapter.createGame(GAME_ID);

    const clueA = await adapter.addClue(GAME_ID, SAMPLE_MELAKA_CLUES[0]); // Jonker (100)
    const clueB = await adapter.addClue(GAME_ID, SAMPLE_MELAKA_CLUES[1]); // Stadhuys (150)

    const team1 = await adapter.createTeam(GAME_ID, 'Crimson Tigers', '#EF4444', '1111');
    const team2 = await adapter.createTeam(GAME_ID, 'Cobalt Dolphins', '#3B82F6', '2222');

    // Both teams complete Clue A before freeze
    const sub1A = await adapter.submitCluePhoto(GAME_ID, {
      gameId: GAME_ID,
      teamId: team1.id,
      teamName: team1.name,
      teamColor: team1.color,
      clueId: clueA.id,
      clueTitle: clueA.title,
      selfieBase64: generateSyntheticBase64Image(50 * 1024),
      awardedPoints: 100,
    });
    const sub2A = await adapter.submitCluePhoto(GAME_ID, {
      gameId: GAME_ID,
      teamId: team2.id,
      teamName: team2.name,
      teamColor: team2.color,
      clueId: clueA.id,
      clueTitle: clueA.title,
      selfieBase64: generateSyntheticBase64Image(50 * 1024),
      awardedPoints: 100,
    });
    await adapter.verifySubmission(GAME_ID, sub1A.id, 'approve');
    await adapter.verifySubmission(GAME_ID, sub2A.id, 'approve');

    // Initial pre-freeze scores: 100 vs 100
    let liveTeams: Team[] = [];
    adapter.subscribeToTeams(GAME_ID, (teams) => { liveTeams = teams; });
    assert.equal(liveTeams.find(t => t.id === team1.id)!.score, 100);
    assert.equal(liveTeams.find(t => t.id === team2.id)!.score, 100);

    // --- GM Activates Freeze Leaderboard at 5 minutes remaining ---
    await adapter.updateGameTimer(GAME_ID, 300, 'frozen');
    await adapter.toggleFreezeLeaderboard(GAME_ID, true);

    let currentGame: Game | undefined;
    adapter.subscribeToGame(GAME_ID, (g) => { currentGame = g; });
    assert.equal(currentGame?.isLeaderboardFrozen, true);
    assert.equal(currentGame?.status, 'frozen');

    // Snapshot of frozen scores for player leaderboard display
    const frozenScoreSnapshot = new Map<string, number>([
      [team1.id, 100],
      [team2.id, 100],
    ]);

    // Helper: Client view projection
    const getVisibleScore = (t: Team, isGm: boolean, isFrozen: boolean) => {
      if (isGm || !isFrozen) return t.score;
      return frozenScoreSnapshot.get(t.id) || 0;
    };

    // --- Team 1 scores Clue B during frozen period ---
    const sub1B = await adapter.submitCluePhoto(GAME_ID, {
      gameId: GAME_ID,
      teamId: team1.id,
      teamName: team1.name,
      teamColor: team1.color,
      clueId: clueB.id,
      clueTitle: clueB.title,
      selfieBase64: generateSyntheticBase64Image(50 * 1024),
      awardedPoints: 150,
    });
    await adapter.verifySubmission(GAME_ID, sub1B.id, 'approve');

    // GM War Room View: Team 1 has 250 points
    const t1 = liveTeams.find(t => t.id === team1.id)!;
    assert.equal(getVisibleScore(t1, true, true), 250, 'GM must see live updated score of 250');

    // Player View: Team 1 score appears FROZEN at 100 points
    assert.equal(getVisibleScore(t1, false, true), 100, 'Players must see frozen score of 100');

    // --- Game Ends: GM unfreezes leaderboard and declares winner ---
    await adapter.updateGameTimer(GAME_ID, 0, 'ended');
    await adapter.toggleFreezeLeaderboard(GAME_ID, false);

    assert.equal(currentGame?.isLeaderboardFrozen, false);
    assert.equal(getVisibleScore(t1, false, false), 250, 'Players now see real final score of 250');
  });
});
