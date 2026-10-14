import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MockGameAdapter } from '../framework/mockGameAdapter.ts';
import { SAMPLE_MELAKA_CLUES } from '../framework/testHelpers.ts';
import { generateSyntheticBase64Image } from '../framework/compressionOracle.ts';
import type { Submission, Team } from '../framework/contracts.ts';

describe('Tier 3 - Cross-Feature Pairwise: Rejection and Retry Flow', () => {
  it('Handles photo rejection with reason, leaves score unchanged, and allows successful retry', async () => {
    const adapter = new MockGameAdapter();
    const GAME_ID = 'pairwise-reject-retry-game';
    adapter.createGame(GAME_ID);

    const clue = await adapter.addClue(GAME_ID, SAMPLE_MELAKA_CLUES[2]); // Cheng Hoon Teng (120 pts)
    const team = await adapter.createTeam(GAME_ID, 'Cobalt Dolphins', '#3B82F6', '5566');

    // Track confetti: rejection must NOT trigger confetti
    let confettiFired = false;
    adapter.subscribeToConfetti(() => { confettiFired = true; });

    // --- First Attempt (Fails Verification) ---
    const blurryPhoto = generateSyntheticBase64Image(60 * 1024);
    const sub1 = await adapter.submitCluePhoto(GAME_ID, {
      gameId: GAME_ID,
      teamId: team.id,
      teamName: team.name,
      teamColor: team.color,
      clueId: clue.id,
      clueTitle: clue.title,
      selfieBase64: blurryPhoto,
      awardedPoints: clue.points,
      coords: { lat: 2.1978, lng: 102.2465 },
    });

    // GM Rejects with specific feedback
    await adapter.verifySubmission(
      GAME_ID,
      sub1.id,
      'reject',
      0,
      'Photo is too blurry to verify the carved dragon roof eaves.'
    );

    // Verify rejection state
    let inspectedSub1: Submission | undefined;
    let inspectedTeam: Team | undefined;
    adapter.subscribeToSubmissions(GAME_ID, (subs) => {
      inspectedSub1 = subs.find(s => s.id === sub1.id);
    });
    adapter.subscribeToTeams(GAME_ID, (teams) => {
      inspectedTeam = teams.find(t => t.id === team.id);
    });

    assert.equal(inspectedSub1?.status, 'rejected');
    assert.equal(inspectedSub1?.rejectionReason, 'Photo is too blurry to verify the carved dragon roof eaves.');
    assert.equal(inspectedTeam?.score, 0, 'Score must remain 0 after rejection');
    assert.equal(inspectedTeam?.completedClueIds.length, 0, 'Clue must NOT be marked completed');
    assert.equal(confettiFired, false, 'Confetti must NOT fire on rejection');

    // --- Second Attempt (Retry Succeeds) ---
    const clearPhoto = generateSyntheticBase64Image(80 * 1024);
    const sub2 = await adapter.submitCluePhoto(GAME_ID, {
      gameId: GAME_ID,
      teamId: team.id,
      teamName: team.name,
      teamColor: team.color,
      clueId: clue.id,
      clueTitle: clue.title,
      selfieBase64: clearPhoto,
      awardedPoints: clue.points,
      coords: { lat: 2.1978, lng: 102.2465 },
    });

    assert.equal(sub2.status, 'pending');

    // GM Approves second attempt
    await adapter.verifySubmission(GAME_ID, sub2.id, 'approve');

    assert.equal(inspectedTeam?.score, 120, 'Score increments by 120 upon successful retry approval');
    assert.deepEqual(inspectedTeam?.completedClueIds, [clue.id]);
    assert.equal(confettiFired, true, 'Confetti fires upon retry approval');
  });
});
