import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MockGameAdapter } from '../framework/mockGameAdapter.ts';
import { SAMPLE_MELAKA_CLUES } from '../framework/testHelpers.ts';
import { simulateCompressImage, isWithinCompressionCeiling } from '../framework/compressionOracle.ts';
import { calculateHaversineDistance } from '../framework/haversine.ts';
import type { Submission, Team } from '../framework/contracts.ts';

describe('Tier 3 - Cross-Feature Pairwise: Happy Path End-to-End Flow', () => {
  it('Executes complete happy path: Join -> GPS -> Capture -> Compress -> Submit -> GM Queue -> Approve -> Score -> Confetti', async () => {
    const adapter = new MockGameAdapter();
    const GAME_ID = 'pairwise-happy-path-game';
    adapter.createGame(GAME_ID);

    // 1. Setup Clue (Tan Beng Swee Clock Tower in Dutch Square)
    const clue = await adapter.addClue(GAME_ID, SAMPLE_MELAKA_CLUES[1]);
    assert.equal(clue.points, 150);

    // 2. Setup Team
    const createdTeam = await adapter.createTeam(GAME_ID, 'Crimson Tigers', '#EF4444', '4821');
    assert.equal(createdTeam.pin, '4821');

    // 3. Step 1: Player Frictionless Join with PIN & Nickname
    const joinResult = await adapter.joinTeamByPin(GAME_ID, '4821', 'Rizal');
    assert.equal(joinResult.team.name, 'Crimson Tigers');
    assert.ok(joinResult.playerId.startsWith('anon_player_'));

    // 4. Step 2: Live GPS tracking updates location (throttled)
    const playerLocation = { lat: 2.19442, lng: 102.24912 }; // ~3m from clock tower
    const gpsBroadcasted = await adapter.updateTeamGps(GAME_ID, joinResult.team.id, playerLocation);
    assert.equal(gpsBroadcasted, true);

    // Verify distance to target landmark
    const distanceMeters = calculateHaversineDistance(playerLocation, clue.location);
    assert.ok(distanceMeters < 10, `Player was ${distanceMeters}m from landmark`);

    // 5. Step 3: Native Camera Capture & Client-Side Canvas Compression
    const rawPhotoBytes = 6 * 1024 * 1024; // 6MB camera file
    const compressionResult = await simulateCompressImage(rawPhotoBytes);
    assert.equal(isWithinCompressionCeiling(compressionResult.base64), true);
    assert.ok(compressionResult.sizeBytes <= 150 * 1024);

    // 6. Step 4: Real-time GM Queue subscription active
    let gmQueueReceivedSub: Submission | undefined;
    const unsubSubs = adapter.subscribeToSubmissions(GAME_ID, (subs) => {
      const pending = subs.find(s => s.status === 'pending');
      if (pending) gmQueueReceivedSub = pending;
    });

    // 7. Step 5: Confetti alert subscription active on player client
    let confettiPayload: { teamId: string; clueId: string; points: number } | undefined;
    const unsubConfetti = adapter.subscribeToConfetti((event) => {
      confettiPayload = event;
    });

    // 8. Step 6: Submit Photo
    const submittedItem = await adapter.submitCluePhoto(GAME_ID, {
      gameId: GAME_ID,
      teamId: joinResult.team.id,
      teamName: joinResult.team.name,
      teamColor: joinResult.team.color,
      clueId: clue.id,
      clueTitle: clue.title,
      selfieBase64: compressionResult.base64,
      awardedPoints: clue.points,
      coords: playerLocation,
    });

    assert.equal(submittedItem.status, 'pending');
    assert.ok(gmQueueReceivedSub !== undefined, 'GM Queue must receive submission via onSnapshot');
    assert.equal(gmQueueReceivedSub?.id, submittedItem.id);

    // 9. Step 7: GM 1-Click Approve in War Room
    await adapter.verifySubmission(GAME_ID, submittedItem.id, 'approve');

    // 10. Step 8: Assert Score incremented immediately
    let updatedTeam: Team | undefined;
    adapter.subscribeToTeams(GAME_ID, (teams) => {
      updatedTeam = teams.find(t => t.id === joinResult.team.id);
    });

    assert.equal(updatedTeam?.score, 150, 'Team score must increment by 150 points');
    assert.deepEqual(updatedTeam?.completedClueIds, [clue.id]);

    // 11. Step 9: Assert Celebratory Confetti fired
    assert.ok(confettiPayload !== undefined, 'Confetti alert must fire upon approval');
    assert.equal(confettiPayload?.teamId, joinResult.team.id);
    assert.equal(confettiPayload?.points, 150);

    // Clean up
    unsubSubs();
    unsubConfetti();
  });
});
