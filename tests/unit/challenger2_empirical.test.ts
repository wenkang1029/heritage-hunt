/**
 * Melaka Heritage Hunt - Adversarial Verification Suite (Challenger 2)
 * Path: tests/unit/challenger2_empirical.test.ts
 *
 * Direct empirical challenge of:
 * 1. Haversine calculations (identical points, antipodal extremes, all 5 UNESCO zone boundaries).
 * 2. Clue points and zones mapping consistency in src/data/melakaZones.ts.
 * 3. GameService state transitions (submit -> queue -> approve -> atomic score -> completedClues).
 */

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateHaversineDistance,
  formatDistance,
  getProximityBadge,
} from '../../src/utils/haversine.ts';
import {
  MELAKA_ZONES,
  INITIAL_CLUES,
  DEFAULT_TEAMS,
  MELAKA_HERITAGE_BOUNDS,
  MELAKA_MAP_CENTER,
  getZoneById,
  getCluesForZone,
  getTeamColorByName,
} from '../../src/data/melakaZones.ts';
import { gameService } from '../../src/services/gameService.ts';
import { mockAdapter } from '../../src/services/mockAdapter.ts';
import type { Team, Submission } from '../../src/types/index.ts';

const TEST_GAME_ID = 'melaka-hunt-2026';
const EARTH_RADIUS = 6371000;
const HALF_CIRCUMFERENCE = Math.round(Math.PI * EARTH_RADIUS); // ~20,015,087 m

describe('Adversarial Challenge: Haversine Distance & Proximity Engine', () => {
  // -------------------------------------------------------------------------
  // 1. Identical Coordinates (Distance = 0)
  // -------------------------------------------------------------------------
  test('CHAL-GEO-01: Identical coordinates must yield exactly 0 meters across all representations', () => {
    const coordsToTest = [
      { lat: 2.1944, lng: 102.2491 }, // Melaka Center
      { lat: 0, lng: 0 }, // Equator & Prime Meridian
      { lat: 90, lng: 0 }, // North Pole
      { lat: -90, lng: 0 }, // South Pole
      { lat: 0, lng: 180 }, // Date Line
      { lat: 0, lng: -180 }, // Date Line Neg
      { lat: -33.8688, lng: 151.2093 }, // Southern Hemisphere (Sydney)
      { lat: 51.5074, lng: -0.1278 }, // Western Hemisphere (London)
    ];

    for (const c of coordsToTest) {
      // { lat, lng } vs { lat, lng }
      const d1 = calculateHaversineDistance(c, c);
      assert.strictEqual(d1, 0, `Identical coords ${JSON.stringify(c)} must return 0m, got ${d1}`);

      // [lat, lng] vs [lat, lng]
      const tuple: [number, number] = [c.lat, c.lng];
      const d2 = calculateHaversineDistance(tuple, tuple);
      assert.strictEqual(d2, 0, `Identical tuple ${JSON.stringify(tuple)} must return 0m, got ${d2}`);

      // { latitude, longitude } vs [lat, lng]
      const obj = { latitude: c.lat, longitude: c.lng };
      const d3 = calculateHaversineDistance(obj, tuple);
      assert.strictEqual(d3, 0, `Cross-type identical coords must return 0m, got ${d3}`);
    }

    // High precision micro-coordinates (15 decimal places)
    const micro1 = { lat: 2.194400000000001, lng: 102.24910000000001 };
    const micro2 = { lat: 2.194400000000001, lng: 102.24910000000001 };
    assert.strictEqual(calculateHaversineDistance(micro1, micro2), 0);

    // formatDistance and getProximityBadge for 0 distance
    assert.strictEqual(formatDistance(0), '0 m');
    const badge0 = getProximityBadge(0);
    assert.strictEqual(badge0.tier, 'exact');
    assert.strictEqual(badge0.isClose, true);
    assert.strictEqual(badge0.distanceMeters, 0);
    assert.strictEqual(badge0.formattedDistance, '0 m');
    assert.ok(badge0.label.includes('On Site (0 m)'));
  });

  // -------------------------------------------------------------------------
  // 2. Antipodal Coordinates (Maximum Theoretical Great-Circle Distance)
  // -------------------------------------------------------------------------
  test('CHAL-GEO-02: Antipodal coordinates must return ~20,015,087m without producing NaN', () => {
    // Equator antipodes: (0, 0) and (0, 180)
    const antipodalPairs: Array<{ p1: [number, number]; p2: [number, number]; label: string }> = [
      { p1: [0, 0], p2: [0, 180], label: 'Equator Prime Meridian vs Date Line' },
      { p1: [0, 0], p2: [0, -180], label: 'Equator Prime Meridian vs Date Line Neg' },
      { p1: [90, 0], p2: [-90, 0], label: 'North Pole vs South Pole' },
      { p1: [45, 10], p2: [-45, -170], label: 'Mid-Latitude Antipode (45N, 10E vs 45S, 170W)' },
      { p1: [-30, 60], p2: [30, -120], label: 'Southern Antipode (-30, 60 vs 30, -120)' },
      {
        p1: [MELAKA_MAP_CENTER.latitude, MELAKA_MAP_CENTER.longitude],
        p2: [-MELAKA_MAP_CENTER.latitude, MELAKA_MAP_CENTER.longitude - 180],
        label: 'Melaka Center Antipode',
      },
    ];

    for (const { p1, p2, label } of antipodalPairs) {
      const dist = calculateHaversineDistance(p1, p2);
      assert.ok(!Number.isNaN(dist), `Antipodal calculation produced NaN for ${label}`);
      assert.ok(Number.isFinite(dist), `Antipodal calculation produced infinite for ${label}`);
      const diff = Math.abs(dist - HALF_CIRCUMFERENCE);
      assert.ok(
        diff <= 200,
        `Antipodal distance for ${label} was ${dist}m, expected ~${HALF_CIRCUMFERENCE}m (diff: ${diff}m)`
      );
    }

    // Deterministic antipodal pair triggering IEEE 754 floating-point overshoot (a = 1 + 2.22e-16)
    // In src/utils/haversine.ts, lacking `Math.min(1, Math.max(0, a))` causes `1 - a < 0` => `Math.sqrt(1 - a) === NaN`
    const pOvershoot1: [number, number] = [-84.81442189440335, -34.64636930956769];
    const pOvershoot2: [number, number] = [84.81442189440335, 145.3536306904323];
    const distOvershoot = calculateHaversineDistance(pOvershoot1, pOvershoot2);
    assert.ok(
      !Number.isNaN(distOvershoot),
      `calculateHaversineDistance failed on antipodal coordinates [${pOvershoot1}] and [${pOvershoot2}]: produced NaN instead of ~${HALF_CIRCUMFERENCE}m due to missing clamp on 'a'`
    );
  });

  // -------------------------------------------------------------------------
  // 3. Boundaries Across All 5 Melaka UNESCO Zones
  // -------------------------------------------------------------------------
  test('CHAL-GEO-03: Distance and boundary checks across all 5 Melaka UNESCO zones', () => {
    assert.strictEqual(MELAKA_ZONES.length, 5);

    // Verify each zone has valid coordinates and bounded polygon perimeter
    for (const zone of MELAKA_ZONES) {
      assert.ok(zone.polygon.length >= 4, `Zone ${zone.id} polygon has ${zone.polygon.length} vertices (min 4)`);

      // Center to each vertex must be reasonable walking radius (< 250m)
      for (let i = 0; i < zone.polygon.length; i++) {
        const vertex = zone.polygon[i];
        const distToCenter = calculateHaversineDistance(zone.center, vertex);
        assert.ok(
          distToCenter > 0 && distToCenter < 250,
          `Zone ${zone.id} vertex ${i} distance to center is ${distToCenter}m (expected 0 < d < 250m)`
        );

        // Successive polygon vertex segment lengths
        const nextVertex = zone.polygon[(i + 1) % zone.polygon.length];
        const edgeLength = calculateHaversineDistance(vertex, nextVertex);
        assert.ok(
          edgeLength > 5 && edgeLength < 350,
          `Zone ${zone.id} edge ${i}->${i + 1} length is ${edgeLength}m (expected 5 < d < 350m)`
        );
      }
    }

    // Inter-zone center distances (Melaka historical cluster is compact, all within ~800m)
    const dutchSq = getZoneById('dutch-square')!;
    const jonker = getZoneById('jonker-street')!;
    const tokong = getZoneById('jalan-tokong')!;
    const aFamosa = getZoneById('a-famosa')!;
    const stPauls = getZoneById('st-pauls-hill')!;

    // Dutch Square to Jonker Street: across the river bridge (~320m)
    const dsToJonker = calculateHaversineDistance(dutchSq.center, jonker.center);
    assert.ok(dsToJonker >= 200 && dsToJonker <= 400, `Dutch Sq to Jonker: ${dsToJonker}m`);

    // Jonker Street to Harmony Street (Jalan Tokong): adjacent parallel street (~190m)
    const jonkerToTokong = calculateHaversineDistance(jonker.center, tokong.center);
    assert.ok(jonkerToTokong >= 100 && jonkerToTokong <= 300, `Jonker to Harmony St: ${jonkerToTokong}m`);

    // Dutch Square to St. Paul's Hill: walking up hill slope (~156m)
    const dsToStPauls = calculateHaversineDistance(dutchSq.center, stPauls.center);
    assert.ok(dsToStPauls >= 100 && dsToStPauls <= 250, `Dutch Sq to St Paul's Hill: ${dsToStPauls}m`);

    // St. Paul's Hill to A Famosa: descending to Porta de Santiago (~165m)
    const stPaulsToAFamosa = calculateHaversineDistance(stPauls.center, aFamosa.center);
    assert.ok(stPaulsToAFamosa >= 80 && stPaulsToAFamosa <= 250, `St Paul's to A Famosa: ${stPaulsToAFamosa}m`);

    // Dutch Square to A Famosa: along Jalan Kota (~298m)
    const dsToAFamosa = calculateHaversineDistance(dutchSq.center, aFamosa.center);
    assert.ok(dsToAFamosa >= 200 && dsToAFamosa <= 400, `Dutch Sq to A Famosa: ${dsToAFamosa}m`);
  });
});

describe('Adversarial Challenge: Melaka Clues & Zones Consistency', () => {
  test('CHAL-DATA-01: Zone clueCount strictly matches INITIAL_CLUES distribution', () => {
    let totalExpectedClues = 0;
    for (const zone of MELAKA_ZONES) {
      const zoneClues = getCluesForZone(zone.id);
      assert.strictEqual(
        zoneClues.length,
        zone.clueCount,
        `Zone "${zone.name}" (${zone.id}) has clueCount=${zone.clueCount} but contains ${zoneClues.length} clues in INITIAL_CLUES`
      );
      totalExpectedClues += zone.clueCount;
    }

    assert.strictEqual(INITIAL_CLUES.length, totalExpectedClues, 'Total clues must equal sum of zone clueCounts');
    assert.strictEqual(INITIAL_CLUES.length, 14, 'Total clues must equal 14');
  });

  test('CHAL-DATA-02: Every clue adheres to strict schema, point bounds (80-150), and Melaka geo bounds', () => {
    const clueIds = new Set<string>();
    const clueOrders = new Set<number>();

    for (const clue of INITIAL_CLUES) {
      // Unique ID and order
      assert.ok(!clueIds.has(clue.id), `Duplicate clue ID: ${clue.id}`);
      clueIds.add(clue.id);

      assert.ok(!clueOrders.has(clue.order), `Duplicate clue order: ${clue.order}`);
      clueOrders.add(clue.order);

      // Points bounds: 80 to 150 points
      assert.ok(
        Number.isInteger(clue.points),
        `Clue ${clue.id} points must be an integer, got ${clue.points}`
      );
      assert.ok(
        clue.points >= 80 && clue.points <= 150,
        `Clue ${clue.id} points (${clue.points}) outside authentic 80-150 range`
      );

      // Valid zone reference
      const zone = getZoneById(clue.zoneId);
      assert.ok(zone, `Clue ${clue.id} references non-existent zone ${clue.zoneId}`);

      // Coordinates within Melaka World Heritage Site bounds
      assert.ok(
        clue.location.latitude >= MELAKA_HERITAGE_BOUNDS.south &&
        clue.location.latitude <= MELAKA_HERITAGE_BOUNDS.north,
        `Clue ${clue.id} latitude ${clue.location.latitude} outside Melaka bounds`
      );
      assert.ok(
        clue.location.longitude >= MELAKA_HERITAGE_BOUNDS.west &&
        clue.location.longitude <= MELAKA_HERITAGE_BOUNDS.east,
        `Clue ${clue.id} longitude ${clue.location.longitude} outside Melaka bounds`
      );

      // Clue distance from its own zone center must be within reasonable proximity (< 200m)
      const distToZoneCenter = calculateHaversineDistance(clue.location, zone!.center);
      assert.ok(
        distToZoneCenter <= 200,
        `Clue ${clue.id} (${clue.title}) is ${distToZoneCenter}m from zone center (${zone!.name}), expected <= 200m`
      );

      // Target photo is valid SVG Data URL
      assert.ok(
        clue.targetPhotoBase64.startsWith('data:image/svg+xml;utf8,'),
        `Clue ${clue.id} teaser must be valid SVG Data URL`
      );
      assert.ok(clue.targetPhotoBase64.length > 200, `Clue ${clue.id} teaser SVG string too short`);

      // Radius in meters
      assert.ok(clue.radiusMeters >= 25 && clue.radiusMeters <= 50, `Clue ${clue.id} radius out of range`);
    }

    assert.strictEqual(clueOrders.size, 14);
    for (let i = 1; i <= 14; i++) {
      assert.ok(clueOrders.has(i), `Clue order missing sequence number ${i}`);
    }
  });

  test('CHAL-DATA-03: Team palettes and starter teams consistency', () => {
    assert.strictEqual(DEFAULT_TEAMS.length, 5);
    const pins = new Set<string>();

    for (const team of DEFAULT_TEAMS) {
      assert.ok(/^\d{4}$/.test(team.pin), `Team ${team.name} PIN ${team.pin} is not 4 digits`);
      assert.ok(!pins.has(team.pin), `Duplicate starter team PIN: ${team.pin}`);
      pins.add(team.pin);

      const colorConfig = getTeamColorByName(team.colorName);
      assert.ok(colorConfig, `Color config for ${team.colorName} not found`);
      assert.strictEqual(team.color, colorConfig?.hex);
      assert.strictEqual(team.score, 0);
      assert.strictEqual(team.completedClueIds.length, 0);
    }
  });
});

describe('Adversarial Challenge: GameService State Transitions', () => {
  beforeEach(() => {
    mockAdapter.resetState();
  });

  test('CHAL-SRV-01: Full lifecycle submit -> queue -> duplicate-block -> approve -> atomic score -> completedClues', async () => {
    let latestSubmissions: Submission[] = [];
    let latestTeams: Team[] = [];

    const unsubSubs = gameService.subscribeToSubmissions(TEST_GAME_ID, (subs) => {
      latestSubmissions = subs;
    });
    const unsubTeams = gameService.subscribeToTeams(TEST_GAME_ID, (teams) => {
      latestTeams = teams;
    });

    const getTeam = (teamId: string) => latestTeams.find((t) => t.id === teamId);

    // Initial state check
    const crimsonBefore = getTeam('team-crimson');
    assert.ok(crimsonBefore);
    assert.strictEqual(crimsonBefore!.score, 0);
    assert.strictEqual(crimsonBefore!.completedClueIds.length, 0);
    assert.strictEqual(latestSubmissions.length, 0);

    // -----------------------------------------------------------------------
    // Stage 1: Submit photo -> verify queue reflects submission
    // -----------------------------------------------------------------------
    const clue1 = INITIAL_CLUES[0]; // clue-ds-1, 100 pts
    const subCoords = { latitude: 2.19432, longitude: 102.24916 };

    const submission1 = await gameService.submitCluePhoto(TEST_GAME_ID, {
      gameId: TEST_GAME_ID,
      teamId: 'team-crimson',
      teamName: 'Red Warriors',
      teamColor: '#DC2626',
      clueId: clue1.id,
      clueTitle: clue1.title,
      selfieBase64: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
      submittedBy: 'Agent Challenger',
      submissionCoords: subCoords,
    });

    assert.ok(submission1.id);
    assert.strictEqual(submission1.status, 'pending');
    assert.strictEqual(submission1.awardedPoints, 0);
    assert.ok(submission1.distanceFromClueMeters !== null);
    assert.ok(submission1.distanceFromClueMeters! <= 10);

    // Verify submission queue immediately reflects submission
    assert.strictEqual(latestSubmissions.length, 1);
    assert.strictEqual(latestSubmissions[0].id, submission1.id);
    assert.strictEqual(latestSubmissions[0].status, 'pending');

    // CRITICAL: Verify team score is STILL 0 before GM review!
    const crimsonPending = getTeam('team-crimson');
    assert.strictEqual(crimsonPending!.score, 0, 'Score must not increment while pending review');
    assert.strictEqual(crimsonPending!.completedClueIds.length, 0, 'Completed clues must not include pending clue');

    // -----------------------------------------------------------------------
    // Stage 2: Prevent duplicate submission while pending
    // -----------------------------------------------------------------------
    await assert.rejects(
      async () => {
        await gameService.submitCluePhoto(TEST_GAME_ID, {
          gameId: TEST_GAME_ID,
          teamId: 'team-crimson',
          teamName: 'Red Warriors',
          teamColor: '#DC2626',
          clueId: clue1.id,
          clueTitle: clue1.title,
          selfieBase64: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
          submittedBy: 'Agent Challenger',
        });
      },
      { message: /already have a pending submission/ }
    );

    // -----------------------------------------------------------------------
    // Stage 3: GM Approve -> team score increments atomically -> clue in completedClues
    // -----------------------------------------------------------------------
    await gameService.verifySubmission(TEST_GAME_ID, submission1.id, 'approve');

    // Verify submission in queue updated
    assert.strictEqual(latestSubmissions[0].status, 'approved');
    assert.strictEqual(latestSubmissions[0].awardedPoints, clue1.points); // 100

    // Verify team score incremented atomically
    const crimsonApproved = getTeam('team-crimson');
    assert.strictEqual(crimsonApproved!.score, clue1.points, 'Team score must increment by exactly clue points');
    assert.deepStrictEqual(crimsonApproved!.completedClueIds, [clue1.id], 'Clue must be in completedClueIds');

    // -----------------------------------------------------------------------
    // Stage 4: Prevent duplicate submission after completion
    // -----------------------------------------------------------------------
    await assert.rejects(
      async () => {
        await gameService.submitCluePhoto(TEST_GAME_ID, {
          gameId: TEST_GAME_ID,
          teamId: 'team-crimson',
          teamName: 'Red Warriors',
          teamColor: '#DC2626',
          clueId: clue1.id,
          clueTitle: clue1.title,
          selfieBase64: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
          submittedBy: 'Agent Challenger',
        });
      },
      { message: /already completed this clue/ }
    );

    // -----------------------------------------------------------------------
    // Stage 5: Bonus verification flow (base + 20)
    // -----------------------------------------------------------------------
    const clue2 = INITIAL_CLUES[1]; // clue-ds-2, 120 pts
    const submission2 = await gameService.submitCluePhoto(TEST_GAME_ID, {
      gameId: TEST_GAME_ID,
      teamId: 'team-crimson',
      teamName: 'Red Warriors',
      teamColor: '#DC2626',
      clueId: clue2.id,
      clueTitle: clue2.title,
      selfieBase64: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
      submittedBy: 'Agent Challenger',
      submissionCoords: clue2.location,
    });

    assert.strictEqual(latestSubmissions.length, 2);
    assert.strictEqual(latestSubmissions[0].id, submission2.id); // Most recent first
    assert.strictEqual(latestSubmissions[0].status, 'pending');

    // Approve with bonus (+20)
    await gameService.verifySubmission(TEST_GAME_ID, submission2.id, 'bonus');

    const updatedSub2 = latestSubmissions.find((s) => s.id === submission2.id);
    assert.strictEqual(updatedSub2?.status, 'approved');
    assert.strictEqual(updatedSub2?.awardedPoints, clue2.points + 20); // 120 + 20 = 140
    assert.strictEqual(updatedSub2?.bonusPoints, 20);

    const crimsonBonus = getTeam('team-crimson');
    const expectedScore = clue1.points + clue2.points + 20; // 100 + 140 = 240
    assert.strictEqual(crimsonBonus!.score, expectedScore);
    assert.ok(crimsonBonus!.completedClueIds.includes(clue1.id));
    assert.ok(crimsonBonus!.completedClueIds.includes(clue2.id));
    assert.strictEqual(crimsonBonus!.completedClueIds.length, 2);

    // -----------------------------------------------------------------------
    // Stage 6: Rejection and Retry Flow
    // -----------------------------------------------------------------------
    const clue3 = INITIAL_CLUES[2]; // clue-ds-3, 80 pts
    const submission3 = await gameService.submitCluePhoto(TEST_GAME_ID, {
      gameId: TEST_GAME_ID,
      teamId: 'team-crimson',
      teamName: 'Red Warriors',
      teamColor: '#DC2626',
      clueId: clue3.id,
      clueTitle: clue3.title,
      selfieBase64: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
      submittedBy: 'Agent Challenger',
      submissionCoords: clue3.location,
    });

    // Reject with custom reason
    await gameService.verifySubmission(
      TEST_GAME_ID,
      submission3.id,
      'reject',
      undefined,
      'Fountain lion heads are out of frame'
    );

    const rejectedSub = latestSubmissions.find((s) => s.id === submission3.id);
    assert.strictEqual(rejectedSub?.status, 'rejected');
    assert.strictEqual(rejectedSub?.rejectionReason, 'Fountain lion heads are out of frame');

    // Team score remains unchanged after rejection
    const crimsonAfterReject = getTeam('team-crimson');
    assert.strictEqual(crimsonAfterReject!.score, expectedScore);
    assert.ok(!crimsonAfterReject!.completedClueIds.includes(clue3.id));

    // Resubmission after rejection is permitted and succeeds
    const submission3Retry = await gameService.submitCluePhoto(TEST_GAME_ID, {
      gameId: TEST_GAME_ID,
      teamId: 'team-crimson',
      teamName: 'Red Warriors',
      teamColor: '#DC2626',
      clueId: clue3.id,
      clueTitle: clue3.title,
      selfieBase64: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
      submittedBy: 'Agent Challenger',
      submissionCoords: clue3.location,
    });

    assert.strictEqual(submission3Retry.status, 'pending');

    // Approve the retry
    await gameService.verifySubmission(TEST_GAME_ID, submission3Retry.id, 'approve');

    const crimsonFinal = getTeam('team-crimson');
    assert.strictEqual(crimsonFinal!.score, expectedScore + clue3.points); // 240 + 80 = 320
    assert.ok(crimsonFinal!.completedClueIds.includes(clue3.id));
    assert.strictEqual(crimsonFinal!.completedClueIds.length, 3);

    unsubSubs();
    unsubTeams();
  });
});
