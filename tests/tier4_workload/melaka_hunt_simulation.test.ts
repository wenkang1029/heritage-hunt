import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MockGameAdapter } from '../framework/mockGameAdapter.ts';
import { SAMPLE_MELAKA_CLUES } from '../framework/testHelpers.ts';
import { simulateCompressImage } from '../framework/compressionOracle.ts';
import { isWithinProximity } from '../framework/haversine.ts';
import type { Team, Clue } from '../framework/contracts.ts';

describe('Tier 4 - Real-World Scenario: Complete Melaka Heritage Photo Hunt Match Simulation', () => {
  it('Simulates complete 5-checkpoint match across Jonker, Dutch Sq, Jalan Tokong, A Famosa, and St. Paul’s Hill with 3 teams', async () => {
    const adapter = new MockGameAdapter();
    const GAME_ID = 'melaka-hunt-championship-2026';

    // =========================================================================
    // STAGE 1: Setup & Pre-Game Lobby
    // =========================================================================
    const game = adapter.createGame(GAME_ID, 'Melaka UNESCO Heritage Grand Prix');
    assert.equal(game.status, 'lobby');
    assert.equal(game.timeRemainingSeconds, 3600);

    // Populate all 5 UNESCO Heritage Clues
    const clues: Clue[] = [];
    for (const clueData of SAMPLE_MELAKA_CLUES) {
      clues.push(await adapter.addClue(GAME_ID, clueData));
    }
    assert.equal(clues.length, 5);

    // Generate 3 Competing Teams
    const t1 = await adapter.createTeam(GAME_ID, 'Crimson Tigers', '#EF4444', '1111');
    const t2 = await adapter.createTeam(GAME_ID, 'Cobalt Dolphins', '#3B82F6', '2222');
    const t3 = await adapter.createTeam(GAME_ID, 'Emerald Dragons', '#10B981', '3333');

    // Frictionless Join by Team Captains
    const captain1 = await adapter.joinTeamByPin(GAME_ID, '1111', 'Captain Crimson');
    const captain2 = await adapter.joinTeamByPin(GAME_ID, '2222', 'Captain Cobalt');
    const captain3 = await adapter.joinTeamByPin(GAME_ID, '3333', 'Captain Emerald');
    assert.equal(captain1.team.name, 'Crimson Tigers');
    assert.equal(captain2.team.name, 'Cobalt Dolphins');
    assert.equal(captain3.team.name, 'Emerald Dragons');

    // =========================================================================
    // STAGE 2: Game Master Starts Match
    // =========================================================================
    await adapter.updateGameTimer(GAME_ID, 3600, 'active');
    assert.equal(adapter.getGame(GAME_ID)!.status, 'active');

    // Track active team states and leaderboard snapshots
    let liveTeams: Team[] = [];
    adapter.subscribeToTeams(GAME_ID, (teams) => { liveTeams = teams; });

    let confettiCount = 0;
    adapter.subscribeToConfetti(() => { confettiCount++; });

    // =========================================================================
    // STAGE 3: Checkpoint 1 - Jonker Street Cultural Stage (100 pts)
    // =========================================================================
    const clueJonker = clues.find(c => c.zoneId === 'jonker-street')!;
    
    // Teams move to Jonker Street & broadcast throttled GPS
    await adapter.updateTeamGps(GAME_ID, t1.id, { lat: 2.1960, lng: 102.2475 }, true);
    await adapter.updateTeamGps(GAME_ID, t2.id, { lat: 2.1961, lng: 102.2476 }, true);
    await adapter.updateTeamGps(GAME_ID, t3.id, { lat: 2.1959, lng: 102.2474 }, true);

    // Verify all teams are in proximity (< 20m)
    assert.ok(isWithinProximity({ lat: 2.1960, lng: 102.2475 }, clueJonker.location, 20));

    // Team 1 takes photo, compresses <= 150KB, submits
    const img1 = await simulateCompressImage(4 * 1024 * 1024);
    const sub1_1 = await adapter.submitCluePhoto(GAME_ID, {
      gameId: GAME_ID,
      teamId: t1.id,
      teamName: t1.name,
      teamColor: t1.color,
      clueId: clueJonker.id,
      clueTitle: clueJonker.title,
      selfieBase64: img1.base64,
      awardedPoints: 100,
      coords: { lat: 2.1960, lng: 102.2475 },
    });
    // GM Approves Team 1
    await adapter.verifySubmission(GAME_ID, sub1_1.id, 'approve');

    // Team 2 submits & approved
    const img2 = await simulateCompressImage(3 * 1024 * 1024);
    const sub2_1 = await adapter.submitCluePhoto(GAME_ID, {
      gameId: GAME_ID,
      teamId: t2.id,
      teamName: t2.name,
      teamColor: t2.color,
      clueId: clueJonker.id,
      clueTitle: clueJonker.title,
      selfieBase64: img2.base64,
      awardedPoints: 100,
      coords: { lat: 2.1961, lng: 102.2476 },
    });
    await adapter.verifySubmission(GAME_ID, sub2_1.id, 'approve');

    // Team 3 submits & approved
    const sub3_1 = await adapter.submitCluePhoto(GAME_ID, {
      gameId: GAME_ID,
      teamId: t3.id,
      teamName: t3.name,
      teamColor: t3.color,
      clueId: clueJonker.id,
      clueTitle: clueJonker.title,
      selfieBase64: img2.base64,
      awardedPoints: 100,
      coords: { lat: 2.1959, lng: 102.2474 },
    });
    await adapter.verifySubmission(GAME_ID, sub3_1.id, 'approve');

    // Leaderboard checkpoint 1: All 3 teams tied at 100 points
    assert.equal(liveTeams.find(t => t.id === t1.id)!.score, 100);
    assert.equal(liveTeams.find(t => t.id === t2.id)!.score, 100);
    assert.equal(liveTeams.find(t => t.id === t3.id)!.score, 100);

    // =========================================================================
    // STAGE 4: Checkpoint 2 - Dutch Square Tan Beng Swee Clock Tower (150 pts)
    // =========================================================================
    const clueDutch = clues.find(c => c.zoneId === 'dutch-square')!;
    await adapter.updateTeamGps(GAME_ID, t1.id, { lat: 2.1944, lng: 102.2491 }, true);
    await adapter.updateTeamGps(GAME_ID, t2.id, { lat: 2.1945, lng: 102.2492 }, true);

    // Team 2 submits first but photo is blurry -> GM Rejects
    const sub2_2_fail = await adapter.submitCluePhoto(GAME_ID, {
      gameId: GAME_ID,
      teamId: t2.id,
      teamName: t2.name,
      teamColor: t2.color,
      clueId: clueDutch.id,
      clueTitle: clueDutch.title,
      selfieBase64: img2.base64,
      awardedPoints: 150,
      coords: { lat: 2.1945, lng: 102.2492 },
    });
    await adapter.verifySubmission(GAME_ID, sub2_2_fail.id, 'reject', 0, 'Clock face obscured by tourist umbrella');

    // Team 1 submits spectacular team photo -> GM awards +25 BONUS points (175 total)
    const sub1_2 = await adapter.submitCluePhoto(GAME_ID, {
      gameId: GAME_ID,
      teamId: t1.id,
      teamName: t1.name,
      teamColor: t1.color,
      clueId: clueDutch.id,
      clueTitle: clueDutch.title,
      selfieBase64: img1.base64,
      awardedPoints: 150,
      coords: { lat: 2.1944, lng: 102.2491 },
    });
    await adapter.verifySubmission(GAME_ID, sub1_2.id, 'bonus', 25);

    // Team 2 retakes clear photo -> GM Approves (+150 pts)
    const sub2_2_retry = await adapter.submitCluePhoto(GAME_ID, {
      gameId: GAME_ID,
      teamId: t2.id,
      teamName: t2.name,
      teamColor: t2.color,
      clueId: clueDutch.id,
      clueTitle: clueDutch.title,
      selfieBase64: img2.base64,
      awardedPoints: 150,
      coords: { lat: 2.1944, lng: 102.2491 },
    });
    await adapter.verifySubmission(GAME_ID, sub2_2_retry.id, 'approve');

    // Leaderboard Checkpoint 2: Crimson Tigers take lead with 275 pts vs Cobalt 250 pts vs Emerald 100 pts
    assert.equal(liveTeams.find(t => t.id === t1.id)!.score, 275);
    assert.equal(liveTeams.find(t => t.id === t2.id)!.score, 250);
    assert.equal(liveTeams.find(t => t.id === t3.id)!.score, 100);

    // =========================================================================
    // STAGE 5: Checkpoint 3 - Jalan Tokong Cheng Hoon Teng (120 pts)
    // =========================================================================
    const clueTokong = clues.find(c => c.zoneId === 'jalan-tokong')!;
    await adapter.updateTeamGps(GAME_ID, t3.id, { lat: 2.1978, lng: 102.2465 }, true);

    // Emerald Dragons arrive and submit
    const sub3_3 = await adapter.submitCluePhoto(GAME_ID, {
      gameId: GAME_ID,
      teamId: t3.id,
      teamName: t3.name,
      teamColor: t3.color,
      clueId: clueTokong.id,
      clueTitle: clueTokong.title,
      selfieBase64: img1.base64,
      awardedPoints: 120,
      coords: { lat: 2.1978, lng: 102.2465 },
    });
    await adapter.verifySubmission(GAME_ID, sub3_3.id, 'approve');

    // Emerald score becomes 220
    assert.equal(liveTeams.find(t => t.id === t3.id)!.score, 220);

    // =========================================================================
    // STAGE 6: Checkpoint 4 (A Famosa 180 pts) & Late-Game Freeze
    // =========================================================================
    const clueFamosa = clues.find(c => c.zoneId === 'a-famosa')!;

    // Timer reaches final 10 minutes (600s) -> GM activates Freeze Leaderboard
    await adapter.updateGameTimer(GAME_ID, 600, 'frozen');
    await adapter.toggleFreezeLeaderboard(GAME_ID, true);

    // Snapshot of frozen scores as seen by players:
    // Crimson: 275, Cobalt: 250, Emerald: 220
    const frozenScores = new Map(liveTeams.map(t => [t.id, t.score]));

    // Cobalt Dolphins arrive at A Famosa and submit
    await adapter.updateTeamGps(GAME_ID, t2.id, { lat: 2.1918, lng: 102.2505 }, true);
    const sub2_4 = await adapter.submitCluePhoto(GAME_ID, {
      gameId: GAME_ID,
      teamId: t2.id,
      teamName: t2.name,
      teamColor: t2.color,
      clueId: clueFamosa.id,
      clueTitle: clueFamosa.title,
      selfieBase64: img2.base64,
      awardedPoints: 180,
      coords: { lat: 2.1918, lng: 102.2505 },
    });
    await adapter.verifySubmission(GAME_ID, sub2_4.id, 'approve');

    // GM War Room sees live update: Cobalt is now 430 (250 + 180)
    assert.equal(liveTeams.find(t => t.id === t2.id)!.score, 430);
    // Player view remains frozen at 250
    assert.equal(frozenScores.get(t2.id), 250);

    // =========================================================================
    // STAGE 7: Checkpoint 5 (St. Paul’s Hill 200 pts) - Hilltop Sprint
    // =========================================================================
    const clueStPauls = clues.find(c => c.zoneId === 'st-pauls-hill')!;

    // Crimson Tigers race up Bukit St. Paul and submit
    await adapter.updateTeamGps(GAME_ID, t1.id, { lat: 2.1927, lng: 102.2498 }, true);
    const sub1_5 = await adapter.submitCluePhoto(GAME_ID, {
      gameId: GAME_ID,
      teamId: t1.id,
      teamName: t1.name,
      teamColor: t1.color,
      clueId: clueStPauls.id,
      clueTitle: clueStPauls.title,
      selfieBase64: img1.base64,
      awardedPoints: 200,
      coords: { lat: 2.1927, lng: 102.2498 },
    });
    await adapter.verifySubmission(GAME_ID, sub1_5.id, 'approve');

    // Crimson Tigers reach 475 points (275 + 200) in GM War Room
    assert.equal(liveTeams.find(t => t.id === t1.id)!.score, 475);

    // =========================================================================
    // STAGE 8: Match End, Unfreeze & Final Winner Declaration
    // =========================================================================
    // Timer hits 0
    await adapter.updateGameTimer(GAME_ID, 0, 'ended');
    await adapter.toggleFreezeLeaderboard(GAME_ID, false);

    assert.equal(adapter.getGame(GAME_ID)!.status, 'ended');
    assert.equal(adapter.getGame(GAME_ID)!.isLeaderboardFrozen, false);

    // Final Ranked Podium
    const finalLeaderboard = [...liveTeams].sort((a, b) => b.score - a.score);

    assert.equal(finalLeaderboard[0].name, 'Crimson Tigers');
    assert.equal(finalLeaderboard[0].score, 475);
    assert.equal(finalLeaderboard[0].completedClueIds.length, 3);

    assert.equal(finalLeaderboard[1].name, 'Cobalt Dolphins');
    assert.equal(finalLeaderboard[1].score, 430);
    assert.equal(finalLeaderboard[1].completedClueIds.length, 3);

    assert.equal(finalLeaderboard[2].name, 'Emerald Dragons');
    assert.equal(finalLeaderboard[2].score, 220);
    assert.equal(finalLeaderboard[2].completedClueIds.length, 2);

    // Ensure all successful approvals generated confetti celebrations
    assert.ok(confettiCount >= 7);
  });
});
