import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MockGameAdapter } from '../framework/mockGameAdapter.ts';
import { SAMPLE_MELAKA_CLUES } from '../framework/testHelpers.ts';
import { generateSyntheticBase64Image } from '../framework/compressionOracle.ts';
import type { Submission, Team } from '../framework/contracts.ts';

describe('Tier 3 - Cross-Feature Pairwise: Bonus Points Flow', () => {
  it('Awards base points + GM custom bonus points with synchronized score and confetti', async () => {
    const adapter = new MockGameAdapter();
    const GAME_ID = 'pairwise-bonus-flow-game';
    adapter.createGame(GAME_ID);

    const clue = await adapter.addClue(GAME_ID, SAMPLE_MELAKA_CLUES[3]); // Porta de Santiago (180 pts)
    const team = await adapter.createTeam(GAME_ID, 'Emerald Dragons', '#10B981', '7890');

    let confettiPoints = 0;
    adapter.subscribeToConfetti((e) => {
      confettiPoints = e.points;
    });

    const sub = await adapter.submitCluePhoto(GAME_ID, {
      gameId: GAME_ID,
      teamId: team.id,
      teamName: team.name,
      teamColor: team.color,
      clueId: clue.id,
      clueTitle: clue.title,
      selfieBase64: generateSyntheticBase64Image(70 * 1024),
      awardedPoints: clue.points,
      coords: { lat: 2.1918, lng: 102.2505 },
    });

    // GM awards +35 bonus points for hilarious historical reenactment pose
    const BONUS_POINTS = 35;
    await adapter.verifySubmission(GAME_ID, sub.id, 'bonus', BONUS_POINTS);

    let reviewedSub: Submission | undefined;
    let reviewedTeam: Team | undefined;
    adapter.subscribeToSubmissions(GAME_ID, (subs) => {
      reviewedSub = subs.find(s => s.id === sub.id);
    });
    adapter.subscribeToTeams(GAME_ID, (teams) => {
      reviewedTeam = teams.find(t => t.id === team.id);
    });

    assert.equal(reviewedSub?.status, 'approved');
    assert.equal(reviewedSub?.bonusPoints, 35);
    assert.equal(reviewedSub?.awardedPoints, 180 + 35); // 215 points

    assert.equal(reviewedTeam?.score, 215);
    assert.deepEqual(reviewedTeam?.completedClueIds, [clue.id]);
    assert.equal(confettiPoints, 215, 'Confetti alert must display total 215 points');
  });
});
