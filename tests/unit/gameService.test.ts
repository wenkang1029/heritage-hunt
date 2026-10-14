/**
 * Melaka Heritage Hunt - Unit Tests: Game Service, Mock Adapter & Geo Engine
 * Path: tests/unit/gameService.test.ts
 */

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { gameService } from '../../src/services/gameService.ts';
import { mockAdapter } from '../../src/services/mockAdapter.ts';
import {
  calculateHaversineDistance,
  formatDistance,
  getProximityBadge,
} from '../../src/utils/haversine.ts';
import {
  MELAKA_ZONES,
  INITIAL_CLUES,
  getZoneById,
  getCluesForZone,
  getTeamColorByName,
} from '../../src/data/melakaZones.ts';
import type { Game, Team, Clue, Submission } from '../../src/types/index.ts';

const TEST_GAME_ID = 'melaka-hunt-2026';

describe('Melaka Heritage Zones & Seed Data', () => {
  test('DATA-01: Contains 5 UNESCO Melaka zones with valid polygon boundaries', () => {
    assert.strictEqual(MELAKA_ZONES.length, 5);
    for (const zone of MELAKA_ZONES) {
      assert.ok(zone.id);
      assert.ok(zone.name);
      assert.ok(zone.center.latitude > 2.18 && zone.center.latitude < 2.21);
      assert.ok(zone.center.longitude > 102.24 && zone.center.longitude < 102.26);
      assert.ok(zone.polygon.length >= 4, `Zone ${zone.id} should have >= 4 polygon vertices`);
    }
  });

  test('DATA-02: Contains 14 authentic clues with SVG teasers and valid GPS coordinates', () => {
    assert.strictEqual(INITIAL_CLUES.length, 14);
    for (const clue of INITIAL_CLUES) {
      assert.ok(clue.id);
      assert.ok(clue.title);
      assert.ok(clue.points >= 50 && clue.points <= 200);
      assert.ok(clue.targetPhotoBase64.startsWith('data:image/svg+xml;utf8,'));
      assert.ok(clue.location.latitude > 2.18 && clue.location.latitude < 2.21);
      assert.ok(clue.location.longitude > 102.24 && clue.location.longitude < 102.26);
      assert.ok(clue.hint.length > 10);
    }
  });

  test('DATA-03: Query helpers getZoneById, getCluesForZone, and getTeamColorByName work properly', () => {
    const ds = getZoneById('dutch-square');
    assert.ok(ds);
    assert.strictEqual(ds?.id, 'dutch-square');

    const dsClues = getCluesForZone('dutch-square');
    assert.strictEqual(dsClues.length, 3);

    const crimson = getTeamColorByName('Crimson');
    assert.ok(crimson);
    assert.strictEqual(crimson?.hex, '#DC2626');
  });
});

describe('Haversine Distance & Proximity Engine', () => {
  test('GEO-01: Stadhuys to Christ Church Melaka matches ~31 meters', () => {
    const stadhuys = { latitude: 2.1944, longitude: 102.2491 };
    const christChurch = { latitude: 2.1942, longitude: 102.2489 };
    const dist = calculateHaversineDistance(stadhuys, christChurch);
    assert.ok(Math.abs(dist - 31) <= 3, `Expected ~31m, got ${dist}m`);
  });

  test('GEO-02: Dutch Square to Porta de Santiago (A Famosa) matches ~323 meters', () => {
    const dutchSquare = { latitude: 2.1944, longitude: 102.2491 };
    const aFamosa = { latitude: 2.1918, longitude: 102.2504 };
    const dist = calculateHaversineDistance(dutchSquare, aFamosa);
    assert.ok(Math.abs(dist - 323) <= 5, `Expected ~323m, got ${dist}m`);
  });

  test('GEO-03: formatDistance formats meters and kilometers cleanly', () => {
    assert.strictEqual(formatDistance(18), '18 m');
    assert.strictEqual(formatDistance(320), '320 m');
    assert.strictEqual(formatDistance(1400), '1.4 km');
  });

  test('GEO-04: getProximityBadge computes proper tiers and labels', () => {
    // Missing GPS
    const na = getProximityBadge(null);
    assert.strictEqual(na.tier, 'far');
    assert.strictEqual(na.label, 'No GPS Fix');
    assert.strictEqual(na.isClose, false);

    // On Site (<= 25m)
    const onSite = getProximityBadge(15);
    assert.strictEqual(onSite.tier, 'exact');
    assert.strictEqual(onSite.isClose, true);
    assert.ok(onSite.label.includes('On Site'));

    // Within Range (<= 50m)
    const inRange = getProximityBadge(40);
    assert.strictEqual(inRange.tier, 'near');
    assert.strictEqual(inRange.isClose, true);
    assert.ok(inRange.label.includes('Within Range'));

    // Nearby (<= 150m)
    const nearby = getProximityBadge(100);
    assert.strictEqual(nearby.tier, 'moderate');
    assert.strictEqual(nearby.isClose, false);
    assert.ok(nearby.label.includes('Nearby'));

    // Far Away (> 150m)
    const far = getProximityBadge(450);
    assert.strictEqual(far.tier, 'far');
    assert.strictEqual(far.isClose, false);
    assert.ok(far.label.includes('Far Away'));
  });
});

describe('Game Service & Mock Adapter Data Layer', () => {
  beforeEach(() => {
    mockAdapter.resetState();
  });

  test('SRV-01: Subscriptions immediately deliver initial state and unsubscribe cleanly', () => {
    let receivedGame: Game | null = null;
    let receivedTeams: Team[] = [];
    let receivedClues: Clue[] = [];
    let receivedSubs: Submission[] = [];

    const unsubGame = gameService.subscribeToGame(TEST_GAME_ID, (g) => {
      receivedGame = g;
    });
    const unsubTeams = gameService.subscribeToTeams(TEST_GAME_ID, (t) => {
      receivedTeams = t;
    });
    const unsubClues = gameService.subscribeToClues(TEST_GAME_ID, (c) => {
      receivedClues = c;
    });
    const unsubSubs = gameService.subscribeToSubmissions(TEST_GAME_ID, (s) => {
      receivedSubs = s;
    });

    assert.ok(receivedGame);
    assert.strictEqual((receivedGame as Game).name, 'Melaka Heritage Photo Scavenger Hunt');
    assert.ok(receivedTeams.length >= 5);
    assert.strictEqual(receivedClues.length, 14);
    assert.strictEqual(receivedSubs.length, 0);

    // Clean unsubscription
    unsubGame();
    unsubTeams();
    unsubClues();
    unsubSubs();
  });

  test('SRV-02: Team creation enforces 4-digit numeric PIN and uniqueness', async () => {
    // Valid team creation
    const team = await gameService.createTeam(TEST_GAME_ID, 'Heritage Explorers', '#DC2626', '7890');
    assert.strictEqual(team.name, 'Heritage Explorers');
    assert.strictEqual(team.pin, '7890');
    assert.strictEqual(team.score, 0);

    // Invalid PIN format
    await assert.rejects(
      async () => {
        await gameService.createTeam(TEST_GAME_ID, 'Bad Team', '#2563EB', '123'); // 3 digits
      },
      { message: /PIN must be exactly 4 digits/ }
    );

    // Duplicate PIN
    await assert.rejects(
      async () => {
        await gameService.createTeam(TEST_GAME_ID, 'Duplicate Team', '#059669', '7890'); // already used
      },
      { message: /already assigned/ }
    );
  });

  test('SRV-03: Player joins team by 4-digit PIN', async () => {
    const joinResult = await gameService.joinTeamByPin(TEST_GAME_ID, '1111', 'Captain Melaka');
    assert.ok(joinResult.team);
    assert.strictEqual(joinResult.team.name, 'Red Warriors');
    assert.ok(joinResult.playerId);
    assert.ok(joinResult.team.members.some((m) => m.nickname === 'Captain Melaka'));

    // Non-existent PIN
    await assert.rejects(
      async () => {
        await gameService.joinTeamByPin(TEST_GAME_ID, '9999', 'Lost Player');
      },
      { message: /No team found with PIN/ }
    );
  });

  test('SRV-04: Team GPS coordinates update successfully', async () => {
    const newCoords = { latitude: 2.1945, longitude: 102.2492 };
    await gameService.updateTeamGps(TEST_GAME_ID, 'team-crimson', newCoords);

    let updatedTeam: Team | undefined;
    gameService.subscribeToTeams(TEST_GAME_ID, (teams) => {
      updatedTeam = teams.find((t) => t.id === 'team-crimson');
    })();

    assert.ok(updatedTeam);
    assert.deepStrictEqual(updatedTeam?.currentCoords, newCoords);
  });

  test('SRV-05: Submitting selfie photo creates pending submission and calculates distance', async () => {
    const sub = await gameService.submitCluePhoto(TEST_GAME_ID, {
      gameId: TEST_GAME_ID,
      teamId: 'team-crimson',
      teamName: 'Red Warriors',
      teamColor: '#DC2626',
      clueId: 'clue-ds-1',
      clueTitle: 'The Red Clock Tower',
      selfieBase64: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
      submittedBy: 'Captain Melaka',
      submissionCoords: { latitude: 2.19435, longitude: 102.24918 }, // Very close to clock tower (2.19430, 102.24915)
    });

    assert.strictEqual(sub.status, 'pending');
    assert.strictEqual(sub.clueId, 'clue-ds-1');
    assert.ok(sub.distanceFromClueMeters !== null);
    assert.ok(sub.distanceFromClueMeters! <= 15, `Expected close distance <= 15m, got ${sub.distanceFromClueMeters}m`);

    // Duplicate pending submission rejection
    await assert.rejects(
      async () => {
        await gameService.submitCluePhoto(TEST_GAME_ID, {
          gameId: TEST_GAME_ID,
          teamId: 'team-crimson',
          teamName: 'Red Warriors',
          teamColor: '#DC2626',
          clueId: 'clue-ds-1',
          clueTitle: 'The Red Clock Tower',
          selfieBase64: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
          submittedBy: 'Captain Melaka',
          submissionCoords: { latitude: 2.19435, longitude: 102.24918 },
        });
      },
      { message: /already have a pending submission/ }
    );
  });

  test('SRV-06: GM Verification actions (approve, bonus, reject) update scores and status atomically', async () => {
    // 1. Submit a photo for team-cobalt
    const sub = await gameService.submitCluePhoto(TEST_GAME_ID, {
      gameId: TEST_GAME_ID,
      teamId: 'team-cobalt',
      teamName: 'Blue Voyagers',
      teamColor: '#2563EB',
      clueId: 'clue-ds-2', // Christ Church Weathercock = 120 points
      clueTitle: 'Christ Church Weathercock',
      selfieBase64: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
      submittedBy: 'Sailor Blue',
      submissionCoords: { latitude: 2.19460, longitude: 102.24930 },
    });

    // 2. Approve submission
    await gameService.verifySubmission(TEST_GAME_ID, sub.id, 'approve');

    let cobaltTeam: Team | undefined;
    gameService.subscribeToTeams(TEST_GAME_ID, (teams) => {
      cobaltTeam = teams.find((t) => t.id === 'team-cobalt');
    })();

    assert.ok(cobaltTeam);
    assert.strictEqual(cobaltTeam?.score, 120);
    assert.ok(cobaltTeam?.completedClueIds.includes('clue-ds-2'));

    // 3. Attempting to submit already completed clue rejects
    await assert.rejects(
      async () => {
        await gameService.submitCluePhoto(TEST_GAME_ID, {
          gameId: TEST_GAME_ID,
          teamId: 'team-cobalt',
          teamName: 'Blue Voyagers',
          teamColor: '#2563EB',
          clueId: 'clue-ds-2',
          clueTitle: 'Christ Church Weathercock',
          selfieBase64: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
          submittedBy: 'Sailor Blue',
          submissionCoords: { latitude: 2.19460, longitude: 102.24930 },
        });
      },
      { message: /already completed this clue/ }
    );

    // 4. Submit and award bonus points (+20) for team-emerald
    const subBonus = await gameService.submitCluePhoto(TEST_GAME_ID, {
      gameId: TEST_GAME_ID,
      teamId: 'team-emerald',
      teamName: 'Green Rangers',
      teamColor: '#059669',
      clueId: 'clue-js-1', // Golden Bodybuilder = 100 points
      clueTitle: 'The Golden Bodybuilder Statue',
      selfieBase64: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
      submittedBy: 'Ranger Green',
      submissionCoords: { latitude: 2.19690, longitude: 102.24675 },
    });

    await gameService.verifySubmission(TEST_GAME_ID, subBonus.id, 'bonus');

    let emeraldTeam: Team | undefined;
    gameService.subscribeToTeams(TEST_GAME_ID, (teams) => {
      emeraldTeam = teams.find((t) => t.id === 'team-emerald');
    })();

    assert.ok(emeraldTeam);
    assert.strictEqual(emeraldTeam?.score, 120); // 100 + 20 bonus
    assert.ok(emeraldTeam?.completedClueIds.includes('clue-js-1'));

    // 5. Submit and reject for team-amber
    const subReject = await gameService.submitCluePhoto(TEST_GAME_ID, {
      gameId: TEST_GAME_ID,
      teamId: 'team-amber',
      teamName: 'Golden Explorers',
      teamColor: '#D97706',
      clueId: 'clue-af-1',
      clueTitle: 'VOC Dutch Coat of Arms 1670',
      selfieBase64: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
      submittedBy: 'Explorer Gold',
      submissionCoords: { latitude: 2.19185, longitude: 102.25045 },
    });

    await gameService.verifySubmission(TEST_GAME_ID, subReject.id, 'reject', undefined, 'Too blurry, cannot see VOC crest');

    let amberTeam: Team | undefined;
    gameService.subscribeToTeams(TEST_GAME_ID, (teams) => {
      amberTeam = teams.find((t) => t.id === 'team-amber');
    })();

    assert.strictEqual(amberTeam?.score, 0); // No score awarded
    assert.ok(!amberTeam?.completedClueIds.includes('clue-af-1')); // Not completed

    let rejectedSub: Submission | undefined;
    gameService.subscribeToSubmissions(TEST_GAME_ID, (subs) => {
      rejectedSub = subs.find((s) => s.id === subReject.id);
    })();

    assert.strictEqual(rejectedSub?.status, 'rejected');
    assert.strictEqual(rejectedSub?.rejectionReason, 'Too blurry, cannot see VOC crest');
  });

  test('SRV-07: Game Master controls toggle freeze and update timer', async () => {
    // Toggle freeze leaderboard
    await gameService.toggleFreezeLeaderboard(TEST_GAME_ID, true);

    let frozenGame: Game | undefined;
    gameService.subscribeToGame(TEST_GAME_ID, (g) => {
      frozenGame = g;
    })();

    assert.strictEqual(frozenGame?.isLeaderboardFrozen, true);
    assert.strictEqual(frozenGame?.status, 'frozen');

    // Update timer
    await gameService.updateGameTimer(TEST_GAME_ID, 3600, 'active');

    let updatedTimerGame: Game | undefined;
    gameService.subscribeToGame(TEST_GAME_ID, (g) => {
      updatedTimerGame = g;
    })();

    assert.strictEqual(updatedTimerGame?.timeRemainingSeconds, 3600);
    assert.strictEqual(updatedTimerGame?.status, 'active');
  });
});
