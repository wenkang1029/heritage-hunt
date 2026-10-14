import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MockGameAdapter } from '../framework/mockGameAdapter.ts';
import { SAMPLE_MELAKA_CLUES } from '../framework/testHelpers.ts';
import { generateSyntheticBase64Image } from '../framework/compressionOracle.ts';
import type { Team } from '../framework/contracts.ts';

describe('Tier 3 - Cross-Feature Pairwise: Multi-Team Concurrent Submissions & Race Conditions', () => {
  it('Handles concurrent submissions from 3 teams for the same clue without state corruption', async () => {
    const adapter = new MockGameAdapter();
    const GAME_ID = 'pairwise-race-game';
    adapter.createGame(GAME_ID);

    const clue = await adapter.addClue(GAME_ID, SAMPLE_MELAKA_CLUES[4]); // St. Paul's Hill (200 pts)

    const team1 = await adapter.createTeam(GAME_ID, 'Crimson Tigers', '#EF4444', '1111');
    const team2 = await adapter.createTeam(GAME_ID, 'Cobalt Dolphins', '#3B82F6', '2222');
    const team3 = await adapter.createTeam(GAME_ID, 'Emerald Dragons', '#10B981', '3333');

    // Concurrent submissions
    const [sub1, sub2, sub3] = await Promise.all([
      adapter.submitCluePhoto(GAME_ID, {
        gameId: GAME_ID,
        teamId: team1.id,
        teamName: team1.name,
        teamColor: team1.color,
        clueId: clue.id,
        clueTitle: clue.title,
        selfieBase64: generateSyntheticBase64Image(50 * 1024),
        awardedPoints: 200,
      }),
      adapter.submitCluePhoto(GAME_ID, {
        gameId: GAME_ID,
        teamId: team2.id,
        teamName: team2.name,
        teamColor: team2.color,
        clueId: clue.id,
        clueTitle: clue.title,
        selfieBase64: generateSyntheticBase64Image(50 * 1024),
        awardedPoints: 200,
      }),
      adapter.submitCluePhoto(GAME_ID, {
        gameId: GAME_ID,
        teamId: team3.id,
        teamName: team3.name,
        teamColor: team3.color,
        clueId: clue.id,
        clueTitle: clue.title,
        selfieBase64: generateSyntheticBase64Image(50 * 1024),
        awardedPoints: 200,
      }),
    ]);

    // All 3 submissions exist with status pending
    assert.equal(sub1.status, 'pending');
    assert.equal(sub2.status, 'pending');
    assert.equal(sub3.status, 'pending');

    // GM Reviews in arbitrary order: Team 2 Approved, Team 3 Rejected, Team 1 Bonus (+10)
    await adapter.verifySubmission(GAME_ID, sub2.id, 'approve');
    await adapter.verifySubmission(GAME_ID, sub3.id, 'reject', 0, 'Statue not in frame');
    await adapter.verifySubmission(GAME_ID, sub1.id, 'bonus', 10);

    let allTeams: Team[] = [];
    adapter.subscribeToTeams(GAME_ID, (teams) => { allTeams = teams; });

    const finalT1 = allTeams.find(t => t.id === team1.id)!;
    const finalT2 = allTeams.find(t => t.id === team2.id)!;
    const finalT3 = allTeams.find(t => t.id === team3.id)!;

    assert.equal(finalT1.score, 210);
    assert.equal(finalT2.score, 200);
    assert.equal(finalT3.score, 0);

    assert.deepEqual(finalT1.completedClueIds, [clue.id]);
    assert.deepEqual(finalT2.completedClueIds, [clue.id]);
    assert.deepEqual(finalT3.completedClueIds, []);

    // Verify duplicate prevention for Team 1 who already completed this clue
    await assert.rejects(
      async () => {
        await adapter.submitCluePhoto(GAME_ID, {
          gameId: GAME_ID,
          teamId: team1.id,
          teamName: team1.name,
          teamColor: team1.color,
          clueId: clue.id,
          clueTitle: clue.title,
          selfieBase64: generateSyntheticBase64Image(50 * 1024),
          awardedPoints: 200,
        });
      },
      /already completed clue/i
    );
  });
});
