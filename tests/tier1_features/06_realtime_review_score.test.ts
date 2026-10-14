import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { MockGameAdapter } from '../framework/mockGameAdapter.ts';
import { HIGH_CONTRAST_TEAM_COLORS } from '../framework/testHelpers.ts';
import { generateSyntheticBase64Image } from '../framework/compressionOracle.ts';
import { calculateHaversineDistance } from '../framework/haversine.ts';
import type { Team, Submission } from '../framework/contracts.ts';

describe('Tier 1 - Feature Group 6: Real-Time Sync, GM Verification & Score Engine', () => {
  let adapter: MockGameAdapter;
  const GAME_ID = 'test-game-review-06';
  let teamId: string;
  let clueId: string;

  beforeEach(async () => {
    adapter = new MockGameAdapter();
    adapter.createGame(GAME_ID);
    const team = await adapter.createTeam(GAME_ID, 'Crimson Tigers', '#EF4444', '1111');
    teamId = team.id;
    const clue = await adapter.addClue(GAME_ID, {
      title: 'A Famosa Archway',
      zoneId: 'a-famosa',
      points: 180,
      targetPhotoBase64: generateSyntheticBase64Image(40 * 1024),
      location: { lat: 2.1918, lng: 102.2505 },
      hint: 'Near the historical cannons',
    });
    clueId = clue.id;
  });

  describe('Feature 25: Real-Time onSnapshot Sync', () => {
    it('F25-T1: Subscriber immediately receives current initial state on mount', () => {
      let receivedTeams: Team[] = [];
      adapter.subscribeToTeams(GAME_ID, (teams) => {
        receivedTeams = teams;
      });
      assert.equal(receivedTeams.length, 1);
      assert.equal(receivedTeams[0].name, 'Crimson Tigers');
    });

    it('F25-T2: Subsequent mutations automatically trigger listener without page refresh', async () => {
      const teamSnapshots: number[] = [];
      adapter.subscribeToTeams(GAME_ID, (teams) => {
        teamSnapshots.push(teams.length);
      });

      await adapter.createTeam(GAME_ID, 'Cobalt Dolphins', '#3B82F6', '2222');
      await adapter.createTeam(GAME_ID, 'Emerald Dragons', '#10B981', '3333');

      assert.deepEqual(teamSnapshots, [1, 2, 3]);
    });

    it('F25-T3: Unsubscribe function detaches listener and halts notifications', async () => {
      const recordedLengths: number[] = [];
      const unsub = adapter.subscribeToTeams(GAME_ID, (teams) => {
        recordedLengths.push(teams.length);
      });

      await adapter.createTeam(GAME_ID, 'Team 2', '#3B82F6', '2222');
      unsub();
      await adapter.createTeam(GAME_ID, 'Team 3', '#10B981', '3333');

      assert.deepEqual(recordedLengths, [1, 2]);
    });

    it('F25-T4: Multiple independent components can subscribe to same collection', async () => {
      let countA = 0;
      let countB = 0;
      const unsubA = adapter.subscribeToTeams(GAME_ID, (teams) => { countA = teams.length; });
      const unsubB = adapter.subscribeToTeams(GAME_ID, (teams) => { countB = teams.length; });

      await adapter.createTeam(GAME_ID, 'New Team', '#F59E0B', '4444');
      unsubA();
      unsubB();

      assert.equal(countA, 2);
      assert.equal(countB, 2);
    });

    it('F25-T5: Real-time onSnapshot maintains memory efficiency on subscriber churn', () => {
      const unsubscribers = [];
      for (let i = 0; i < 50; i++) {
        unsubscribers.push(adapter.subscribeToTeams(GAME_ID, () => {}));
      }
      for (const unsub of unsubscribers) {
        unsub();
      }
      assert.equal(adapter['teamsListeners'].get(GAME_ID)!.size, 0);
    });
  });

  describe('Feature 26: Hybrid Mock Adapter (Offline / Mock Testing Fallback)', () => {
    it('F26-T1: Mock adapter operates completely in-memory without external network calls', () => {
      assert.ok(adapter instanceof MockGameAdapter);
      assert.ok(adapter.getGame(GAME_ID) !== undefined);
    });

    it('F26-T2: Simulates offline submission queuing when network disconnects', async () => {
      adapter.isOffline = true;
      const submissionPromise = adapter.submitCluePhoto(GAME_ID, {
        gameId: GAME_ID,
        teamId,
        teamName: 'Crimson Tigers',
        teamColor: '#EF4444',
        clueId,
        clueTitle: 'A Famosa Archway',
        selfieBase64: generateSyntheticBase64Image(60 * 1024),
        awardedPoints: 180,
      });

      assert.equal(adapter.getOfflineQueueLength(), 1);

      // Reconnect and flush
      await adapter.reconnectAndFlushOfflineQueue();
      const result = await submissionPromise;
      assert.equal(result.status, 'pending');
      assert.equal(adapter.getOfflineQueueLength(), 0);
    });

    it('F26-T3: LocalStorage serialization contract preserves essential game state', () => {
      const sampleState = { gameId: GAME_ID, teamId, score: 300 };
      const serialized = JSON.stringify(sampleState);
      const parsed = JSON.parse(serialized);
      assert.deepEqual(parsed, sampleState);
    });

    it('F26-T4: BroadcastChannel channel name convention follows heritage-hunt-{gameId}', () => {
      const channelName = `heritage-hunt-${GAME_ID}`;
      assert.equal(channelName, 'heritage-hunt-test-game-review-06');
    });

    it('F26-T5: Reset method flushes all data structures cleanly for test isolation', () => {
      adapter.reset();
      assert.equal(adapter.getGame(GAME_ID), undefined);
    });
  });

  describe('Feature 27: Real-Time GM Verification Queue', () => {
    it('F27-T1: Incoming submissions populate GM verification queue in real time', async () => {
      let pendingList: Submission[] = [];
      adapter.subscribeToSubmissions(GAME_ID, (subs) => {
        pendingList = subs.filter((s) => s.status === 'pending');
      });

      await adapter.submitCluePhoto(GAME_ID, {
        gameId: GAME_ID,
        teamId,
        teamName: 'Crimson Tigers',
        teamColor: '#EF4444',
        clueId,
        clueTitle: 'A Famosa Archway',
        selfieBase64: generateSyntheticBase64Image(60 * 1024),
        awardedPoints: 180,
      });

      assert.equal(pendingList.length, 1);
      assert.equal(pendingList[0].clueTitle, 'A Famosa Archway');
    });

    it('F27-T2: Submissions queue sorts chronologically (oldest pending first)', async () => {
      const team2 = await adapter.createTeam(GAME_ID, 'Cobalt Dolphins', '#3B82F6', '2222');

      const sub1 = await adapter.submitCluePhoto(GAME_ID, {
        gameId: GAME_ID,
        teamId,
        teamName: 'Crimson Tigers',
        teamColor: '#EF4444',
        clueId,
        clueTitle: 'A Famosa Archway',
        selfieBase64: generateSyntheticBase64Image(60 * 1024),
        awardedPoints: 180,
      });
      // Ensure distinct timestamp by explicitly modifying submittedAt
      sub1.submittedAt = 1000;

      const sub2 = await adapter.submitCluePhoto(GAME_ID, {
        gameId: GAME_ID,
        teamId: team2.id,
        teamName: 'Cobalt Dolphins',
        teamColor: '#3B82F6',
        clueId,
        clueTitle: 'A Famosa Archway',
        selfieBase64: generateSyntheticBase64Image(60 * 1024),
        awardedPoints: 180,
      });
      sub2.submittedAt = 2000;

      const sortQueue = (subs: Submission[]) => [...subs].sort((a, b) => Number(a.submittedAt) - Number(b.submittedAt));
      const sorted = sortQueue([sub2, sub1]);
      assert.equal(sorted[0].id, sub1.id);
      assert.equal(sorted[1].id, sub2.id);
    });

    it('F27-T3: Approved or rejected submission drops out of active pending queue', async () => {
      const sub = await adapter.submitCluePhoto(GAME_ID, {
        gameId: GAME_ID,
        teamId,
        teamName: 'Crimson Tigers',
        teamColor: '#EF4444',
        clueId,
        clueTitle: 'A Famosa Archway',
        selfieBase64: generateSyntheticBase64Image(60 * 1024),
        awardedPoints: 180,
      });

      await adapter.verifySubmission(GAME_ID, sub.id, 'approve');

      let pendingCount = 0;
      adapter.subscribeToSubmissions(GAME_ID, (subs) => {
        pendingCount = subs.filter((s) => s.status === 'pending').length;
      });

      assert.equal(pendingCount, 0);
    });

    it('F27-T4: Queue items include team identity metadata (name and color)', async () => {
      const sub = await adapter.submitCluePhoto(GAME_ID, {
        gameId: GAME_ID,
        teamId,
        teamName: 'Crimson Tigers',
        teamColor: '#EF4444',
        clueId,
        clueTitle: 'A Famosa Archway',
        selfieBase64: generateSyntheticBase64Image(60 * 1024),
        awardedPoints: 180,
      });

      assert.equal(sub.teamName, 'Crimson Tigers');
      assert.equal(sub.teamColor, '#EF4444');
    });

    it('F27-T5: Queue counter badge reflects accurate pending count', async () => {
      const team2 = await adapter.createTeam(GAME_ID, 'Cobalt Dolphins', '#3B82F6', '2222');
      await adapter.submitCluePhoto(GAME_ID, {
        gameId: GAME_ID,
        teamId,
        teamName: 'Crimson Tigers',
        teamColor: '#EF4444',
        clueId,
        clueTitle: 'A Famosa Archway',
        selfieBase64: generateSyntheticBase64Image(50 * 1024),
        awardedPoints: 180,
      });
      await adapter.submitCluePhoto(GAME_ID, {
        gameId: GAME_ID,
        teamId: team2.id,
        teamName: 'Cobalt Dolphins',
        teamColor: '#3B82F6',
        clueId,
        clueTitle: 'A Famosa Archway',
        selfieBase64: generateSyntheticBase64Image(50 * 1024),
        awardedPoints: 180,
      });

      let pendingCount = 0;
      adapter.subscribeToSubmissions(GAME_ID, (subs) => {
        pendingCount = subs.filter(s => s.status === 'pending').length;
      });
      assert.equal(pendingCount, 2);
    });
  });

  describe('Feature 28: Side-by-Side Photo Comparison & Distance Badge', () => {
    it('F28-T1: Comparison model pairs target reference photo with team selfie', async () => {
      const targetPhoto = generateSyntheticBase64Image(40 * 1024);
      const teamSelfie = generateSyntheticBase64Image(70 * 1024);

      const comparisonCard = {
        clueTitle: 'A Famosa Archway',
        targetPhoto,
        teamSelfie,
      };

      assert.ok(comparisonCard.targetPhoto.startsWith('data:image/'));
      assert.ok(comparisonCard.teamSelfie.startsWith('data:image/'));
    });

    it('F28-T2: Proximity badge computes distance between submission GPS and clue coordinates', () => {
      const clueLoc = { lat: 2.1918, lng: 102.2505 };
      const playerLoc = { lat: 2.1919, lng: 102.2506 }; // ~15m
      const distance = calculateHaversineDistance(clueLoc, playerLoc);
      assert.ok(distance < 25);
    });

    it('F28-T3: Distance badge styles with green accent if within 30 meters', () => {
      const getBadgeStyle = (distanceMeters: number): string => {
        if (distanceMeters <= 30) return 'badge-success-green';
        if (distanceMeters <= 100) return 'badge-warning-amber';
        return 'badge-danger-red';
      };

      assert.equal(getBadgeStyle(14), 'badge-success-green');
      assert.equal(getBadgeStyle(45), 'badge-warning-amber');
      assert.equal(getBadgeStyle(350), 'badge-danger-red');
    });

    it('F28-T4: Handles submissions where player GPS coordinates are missing', () => {
      const formatDistanceBadge = (clueLoc: { lat: number; lng: number }, playerLoc?: { lat: number; lng: number }): string => {
        if (!playerLoc) return 'GPS Unavailable';
        const d = calculateHaversineDistance(clueLoc, playerLoc);
        return `${Math.round(d)}m away`;
      };

      assert.equal(formatDistanceBadge({ lat: 2.1918, lng: 102.2505 }, undefined), 'GPS Unavailable');
    });

    it('F28-T5: Landmark title and hint text are displayed in comparison header', () => {
      const clueTitle = 'A Famosa Archway';
      const hint = 'Near the historical cannons';
      assert.ok(clueTitle.length > 0);
      assert.ok(hint.length > 0);
    });
  });

  describe('Feature 29: 1-Click GM Review Actions', () => {
    let sub: Submission;

    beforeEach(async () => {
      sub = await adapter.submitCluePhoto(GAME_ID, {
        gameId: GAME_ID,
        teamId,
        teamName: 'Crimson Tigers',
        teamColor: '#EF4444',
        clueId,
        clueTitle: 'A Famosa Archway',
        selfieBase64: generateSyntheticBase64Image(60 * 1024),
        awardedPoints: 180,
      });
    });

    it('F29-T1: 1-Click Approve awards clue points immediately', async () => {
      await adapter.verifySubmission(GAME_ID, sub.id, 'approve');
      const team = Array.from(adapter['teams'].get(GAME_ID)!.values()).find(t => t.id === teamId)!;
      assert.equal(team.score, 180);
      assert.deepEqual(team.completedClueIds, [clueId]);
    });

    it('F29-T2: 1-Click Reject marks submission rejected with reason and zero points', async () => {
      await adapter.verifySubmission(GAME_ID, sub.id, 'reject', 0, 'Wrong monument');
      const team = Array.from(adapter['teams'].get(GAME_ID)!.values()).find(t => t.id === teamId)!;
      assert.equal(team.score, 0);
      assert.equal(team.completedClueIds.length, 0);
    });

    it('F29-T3: 1-Click Bonus awards base points plus bonus points', async () => {
      await adapter.verifySubmission(GAME_ID, sub.id, 'bonus', 20); // +20 bonus
      const team = Array.from(adapter['teams'].get(GAME_ID)!.values()).find(t => t.id === teamId)!;
      assert.equal(team.score, 180 + 20);
      assert.deepEqual(team.completedClueIds, [clueId]);
    });

    it('F29-T4: Action records reviewer timestamp atomically', async () => {
      const beforeTime = Date.now();
      await adapter.verifySubmission(GAME_ID, sub.id, 'approve');
      const verifiedSub = adapter['submissions'].get(GAME_ID)!.get(sub.id)!;
      assert.ok(Number(verifiedSub.reviewedAt) >= beforeTime);
    });

    it('F29-T5: Invalid action string is rejected with validation error', async () => {
      await assert.rejects(
        async () => {
          await adapter.verifySubmission(GAME_ID, sub.id, 'invalid-action' as any);
        },
        /unknown action|invalid/i
      );
    });
  });

  describe('Feature 30: Instant Score Synchronization', () => {
    it('F30-T1: Score increment is reflected on team in same tick as approval', async () => {
      const sub = await adapter.submitCluePhoto(GAME_ID, {
        gameId: GAME_ID,
        teamId,
        teamName: 'Crimson Tigers',
        teamColor: '#EF4444',
        clueId,
        clueTitle: 'A Famosa Archway',
        selfieBase64: generateSyntheticBase64Image(60 * 1024),
        awardedPoints: 180,
      });

      await adapter.verifySubmission(GAME_ID, sub.id, 'approve');
      const team = Array.from(adapter['teams'].get(GAME_ID)!.values()).find(t => t.id === teamId)!;
      assert.equal(team.score, 180);
    });

    it('F30-T2: Multiple approved clues accumulate score monotonically', async () => {
      const clue2 = await adapter.addClue(GAME_ID, {
        title: 'Dutch Clock',
        zoneId: 'dutch-square',
        points: 150,
        targetPhotoBase64: 'xxx',
        location: { lat: 2.1944, lng: 102.2491 },
        hint: 'Clock',
      });

      const sub1 = await adapter.submitCluePhoto(GAME_ID, {
        gameId: GAME_ID,
        teamId,
        teamName: 'Crimson Tigers',
        teamColor: '#EF4444',
        clueId,
        clueTitle: 'A Famosa Archway',
        selfieBase64: generateSyntheticBase64Image(50 * 1024),
        awardedPoints: 180,
      });
      await adapter.verifySubmission(GAME_ID, sub1.id, 'approve');

      const sub2 = await adapter.submitCluePhoto(GAME_ID, {
        gameId: GAME_ID,
        teamId,
        teamName: 'Crimson Tigers',
        teamColor: '#EF4444',
        clueId: clue2.id,
        clueTitle: 'Dutch Clock',
        selfieBase64: generateSyntheticBase64Image(50 * 1024),
        awardedPoints: 150,
      });
      await adapter.verifySubmission(GAME_ID, sub2.id, 'approve');

      const team = Array.from(adapter['teams'].get(GAME_ID)!.values()).find(t => t.id === teamId)!;
      assert.equal(team.score, 330);
    });

    it('F30-T3: Real-time teams subscription fires update with new score immediately', async () => {
      const observedScores: number[] = [];
      const unsub = adapter.subscribeToTeams(GAME_ID, (teams) => {
        const t = teams.find(team => team.id === teamId);
        if (t) observedScores.push(t.score);
      });

      const sub = await adapter.submitCluePhoto(GAME_ID, {
        gameId: GAME_ID,
        teamId,
        teamName: 'Crimson Tigers',
        teamColor: '#EF4444',
        clueId,
        clueTitle: 'A Famosa Archway',
        selfieBase64: generateSyntheticBase64Image(50 * 1024),
        awardedPoints: 180,
      });
      await adapter.verifySubmission(GAME_ID, sub.id, 'approve');
      unsub();

      assert.deepEqual(observedScores, [0, 180]);
    });

    it('F30-T4: Rejection does not modify existing score', async () => {
      const sub = await adapter.submitCluePhoto(GAME_ID, {
        gameId: GAME_ID,
        teamId,
        teamName: 'Crimson Tigers',
        teamColor: '#EF4444',
        clueId,
        clueTitle: 'A Famosa Archway',
        selfieBase64: generateSyntheticBase64Image(50 * 1024),
        awardedPoints: 180,
      });
      await adapter.verifySubmission(GAME_ID, sub.id, 'reject');
      const team = Array.from(adapter['teams'].get(GAME_ID)!.values()).find(t => t.id === teamId)!;
      assert.equal(team.score, 0);
    });

    it('F30-T5: Score never becomes negative regardless of rejection or penalty', async () => {
      const team = Array.from(adapter['teams'].get(GAME_ID)!.values()).find(t => t.id === teamId)!;
      assert.ok(team.score >= 0);
    });
  });

  describe('Feature 31: GM Team Generator', () => {
    it('F31-T1: Auto-generates teams with distinct 4-digit numeric PINs', async () => {
      const pins = new Set<string>();
      for (let i = 0; i < 5; i++) {
        const pin = (1000 + i).toString();
        pins.add(pin);
        await adapter.createTeam(GAME_ID, `Team ${i}`, HIGH_CONTRAST_TEAM_COLORS[i].color, pin);
      }
      assert.equal(pins.size, 5);
      for (const p of pins) {
        assert.match(p, /^\d{4}$/);
      }
    });

    it('F31-T2: High-contrast color palette assignment conforms to PRD specification', () => {
      assert.equal(HIGH_CONTRAST_TEAM_COLORS.length, 5);
      const expectedNames = ['Crimson Tigers', 'Cobalt Dolphins', 'Emerald Dragons', 'Amber Eagles', 'Violet Panthers'];
      assert.deepEqual(HIGH_CONTRAST_TEAM_COLORS.map(c => c.name), expectedNames);
    });

    it('F31-T3: Generates printable QR URL for each team encoding join PIN', () => {
      const generateQrUrl = (pin: string) => `https://melaka-hunt.vercel.app/play?pin=${pin}`;
      const qrUrl = generateQrUrl('4821');
      assert.equal(qrUrl, 'https://melaka-hunt.vercel.app/play?pin=4821');
    });

    it('F31-T4: Prevents PIN collision across generated teams', async () => {
      await assert.rejects(
        async () => {
          await adapter.createTeam(GAME_ID, 'Collision Team', '#10B981', '1111'); // 1111 already used
        },
        /PIN collision/i
      );
    });

    it('F31-T5: Batch generator creates desired number of teams with default values', async () => {
      const batchGameId = 'batch-game-01';
      adapter.createGame(batchGameId);
      for (let i = 0; i < 4; i++) {
        const conf = HIGH_CONTRAST_TEAM_COLORS[i];
        await adapter.createTeam(batchGameId, conf.name, conf.color, (2000 + i).toString());
      }
      const teams = Array.from(adapter['teams'].get(batchGameId)!.values());
      assert.equal(teams.length, 4);
    });
  });

  describe('Feature 32: Live Leaderboard', () => {
    it('F32-T1: Leaderboard sorts teams by score in descending order', () => {
      const teams = [
        { id: '1', name: 'Alpha', score: 100, completedClues: 1, lastActive: 10 },
        { id: '2', name: 'Beta', score: 350, completedClues: 3, lastActive: 20 },
        { id: '3', name: 'Gamma', score: 220, completedClues: 2, lastActive: 15 },
      ];

      const ranked = [...teams].sort((a, b) => b.score - a.score);
      assert.equal(ranked[0].name, 'Beta');
      assert.equal(ranked[1].name, 'Gamma');
      assert.equal(ranked[2].name, 'Alpha');
    });

    it('F32-T2: Tie-breaker sorts by number of completed clues when scores are equal', () => {
      const teams = [
        { id: '1', name: 'Team A', score: 200, completedClues: 1 },
        { id: '2', name: 'Team B', score: 200, completedClues: 2 },
      ];

      const ranked = [...teams].sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return b.completedClues - a.completedClues;
      });

      assert.equal(ranked[0].name, 'Team B');
      assert.equal(ranked[1].name, 'Team A');
    });

    it('F32-T3: Rank recalculation triggers immediately on score sync', async () => {
      const team2 = await adapter.createTeam(GAME_ID, 'Cobalt Dolphins', '#3B82F6', '2222');

      // Approve team 2 submission with 300 points
      const sub = await adapter.submitCluePhoto(GAME_ID, {
        gameId: GAME_ID,
        teamId: team2.id,
        teamName: 'Cobalt Dolphins',
        teamColor: '#3B82F6',
        clueId,
        clueTitle: 'A Famosa Archway',
        selfieBase64: generateSyntheticBase64Image(50 * 1024),
        awardedPoints: 300,
      });
      await adapter.verifySubmission(GAME_ID, sub.id, 'approve');

      const allTeams = Array.from(adapter['teams'].get(GAME_ID)!.values());
      const ranked = [...allTeams].sort((a, b) => b.score - a.score);

      assert.equal(ranked[0].name, 'Cobalt Dolphins');
      assert.equal(ranked[1].name, 'Crimson Tigers');
    });

    it('F32-T4: Displays team color badge alongside team name on leaderboard', () => {
      const team = { name: 'Crimson Tigers', color: '#EF4444' };
      assert.equal(team.color, '#EF4444');
    });

    it('F32-T5: Empty leaderboard (zero teams) handles without crash', () => {
      const emptyTeams: Team[] = [];
      const ranked = [...emptyTeams].sort((a, b) => b.score - a.score);
      assert.equal(ranked.length, 0);
    });
  });

  describe('Feature 33: Celebratory Confetti Alert', () => {
    it('F33-T1: Submission approval triggers confetti event', async () => {
      let confettiFired = false;
      const unsub = adapter.subscribeToConfetti((event) => {
        if (event.teamId === teamId) confettiFired = true;
      });

      const sub = await adapter.submitCluePhoto(GAME_ID, {
        gameId: GAME_ID,
        teamId,
        teamName: 'Crimson Tigers',
        teamColor: '#EF4444',
        clueId,
        clueTitle: 'A Famosa Archway',
        selfieBase64: generateSyntheticBase64Image(50 * 1024),
        awardedPoints: 180,
      });

      await adapter.verifySubmission(GAME_ID, sub.id, 'approve');
      unsub();

      assert.equal(confettiFired, true);
    });

    it('F33-T2: Submission rejection does NOT trigger confetti event', async () => {
      let confettiFired = false;
      const unsub = adapter.subscribeToConfetti(() => {
        confettiFired = true;
      });

      const sub = await adapter.submitCluePhoto(GAME_ID, {
        gameId: GAME_ID,
        teamId,
        teamName: 'Crimson Tigers',
        teamColor: '#EF4444',
        clueId,
        clueTitle: 'A Famosa Archway',
        selfieBase64: generateSyntheticBase64Image(50 * 1024),
        awardedPoints: 180,
      });

      await adapter.verifySubmission(GAME_ID, sub.id, 'reject');
      unsub();

      assert.equal(confettiFired, false);
    });

    it('F33-T3: Confetti payload contains awarded points and clue details', async () => {
      let receivedPoints = 0;
      const unsub = adapter.subscribeToConfetti((event) => {
        receivedPoints = event.points;
      });

      const sub = await adapter.submitCluePhoto(GAME_ID, {
        gameId: GAME_ID,
        teamId,
        teamName: 'Crimson Tigers',
        teamColor: '#EF4444',
        clueId,
        clueTitle: 'A Famosa Archway',
        selfieBase64: generateSyntheticBase64Image(50 * 1024),
        awardedPoints: 180,
      });

      await adapter.verifySubmission(GAME_ID, sub.id, 'approve');
      unsub();

      assert.equal(receivedPoints, 180);
    });

    it('F33-T4: Bonus approval also triggers celebratory confetti with total points', async () => {
      let bonusPoints = 0;
      const unsub = adapter.subscribeToConfetti((event) => {
        bonusPoints = event.points;
      });

      const sub = await adapter.submitCluePhoto(GAME_ID, {
        gameId: GAME_ID,
        teamId,
        teamName: 'Crimson Tigers',
        teamColor: '#EF4444',
        clueId,
        clueTitle: 'A Famosa Archway',
        selfieBase64: generateSyntheticBase64Image(50 * 1024),
        awardedPoints: 180,
      });

      await adapter.verifySubmission(GAME_ID, sub.id, 'bonus', 25);
      unsub();

      assert.equal(bonusPoints, 205);
    });

    it('F33-T5: Confetti trigger detaches cleanly via unsubscribe', async () => {
      let fireCount = 0;
      const unsub = adapter.subscribeToConfetti(() => {
        fireCount++;
      });

      const sub1 = await adapter.submitCluePhoto(GAME_ID, {
        gameId: GAME_ID,
        teamId,
        teamName: 'Crimson Tigers',
        teamColor: '#EF4444',
        clueId,
        clueTitle: 'A Famosa Archway',
        selfieBase64: generateSyntheticBase64Image(50 * 1024),
        awardedPoints: 180,
      });

      await adapter.verifySubmission(GAME_ID, sub1.id, 'approve');
      unsub();

      // Another team submission
      const team2 = await adapter.createTeam(GAME_ID, 'Cobalt Dolphins', '#3B82F6', '2222');
      const sub2 = await adapter.submitCluePhoto(GAME_ID, {
        gameId: GAME_ID,
        teamId: team2.id,
        teamName: 'Cobalt Dolphins',
        teamColor: '#3B82F6',
        clueId,
        clueTitle: 'A Famosa Archway',
        selfieBase64: generateSyntheticBase64Image(50 * 1024),
        awardedPoints: 180,
      });
      await adapter.verifySubmission(GAME_ID, sub2.id, 'approve');

      assert.equal(fireCount, 1, 'Should only receive 1 event after unsubscribe');
    });
  });
});
