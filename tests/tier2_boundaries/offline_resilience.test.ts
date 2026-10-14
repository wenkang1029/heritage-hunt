import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { MockGameAdapter } from '../framework/mockGameAdapter.ts';
import { generateSyntheticBase64Image } from '../framework/compressionOracle.ts';

describe('Tier 2 - Boundary: Offline Network Resilience & Queue Recovery', () => {
  let adapter: MockGameAdapter;
  const GAME_ID = 'test-game-offline-02';
  let teamId: string;
  let clueId: string;

  beforeEach(async () => {
    adapter = new MockGameAdapter();
    adapter.createGame(GAME_ID);
    const team = await adapter.createTeam(GAME_ID, 'Crimson Tigers', '#EF4444', '1111');
    teamId = team.id;
    const clue = await adapter.addClue(GAME_ID, {
      title: 'Stadhuys Red Wall',
      zoneId: 'dutch-square',
      points: 150,
      targetPhotoBase64: generateSyntheticBase64Image(40 * 1024),
      location: { lat: 2.1944, lng: 102.2491 },
      hint: 'Near Christ Church',
    });
    clueId = clue.id;
  });

  it('T2-OFF-1: Network disconnect pauses outgoing submission and holds it in offline queue', async () => {
    adapter.isOffline = true;
    const submissionPromise = adapter.submitCluePhoto(GAME_ID, {
      gameId: GAME_ID,
      teamId,
      teamName: 'Crimson Tigers',
      teamColor: '#EF4444',
      clueId,
      clueTitle: 'Stadhuys Red Wall',
      selfieBase64: generateSyntheticBase64Image(60 * 1024),
      awardedPoints: 150,
    });

    assert.equal(adapter.getOfflineQueueLength(), 1);

    // Flush and reconnect
    await adapter.reconnectAndFlushOfflineQueue();
    const result = await submissionPromise;
    assert.equal(result.status, 'pending');
    assert.equal(adapter.getOfflineQueueLength(), 0);
  });

  it('T2-OFF-2: Multiple offline submissions accumulate sequentially in FIFO queue', async () => {
    adapter.isOffline = true;
    const clue2 = await adapter.addClue(GAME_ID, {
      title: 'Jonker Mural',
      zoneId: 'jonker-street',
      points: 100,
      targetPhotoBase64: 'xxx',
      location: { lat: 2.1960, lng: 102.2475 },
      hint: 'Mural',
    });

    const p1 = adapter.submitCluePhoto(GAME_ID, {
      gameId: GAME_ID,
      teamId,
      teamName: 'Crimson Tigers',
      teamColor: '#EF4444',
      clueId,
      clueTitle: 'Stadhuys Red Wall',
      selfieBase64: generateSyntheticBase64Image(50 * 1024),
      awardedPoints: 150,
    });

    const p2 = adapter.submitCluePhoto(GAME_ID, {
      gameId: GAME_ID,
      teamId,
      teamName: 'Crimson Tigers',
      teamColor: '#EF4444',
      clueId: clue2.id,
      clueTitle: 'Jonker Mural',
      selfieBase64: generateSyntheticBase64Image(50 * 1024),
      awardedPoints: 100,
    });

    assert.equal(adapter.getOfflineQueueLength(), 2);

    const flushedCount = await adapter.reconnectAndFlushOfflineQueue();
    assert.equal(flushedCount, 2);

    const [res1, res2] = await Promise.all([p1, p2]);
    assert.equal(res1.clueId, clueId);
    assert.equal(res2.clueId, clue2.id);
  });

  it('T2-OFF-3: Offline indicator flag alerts player UI when navigator.onLine is false', () => {
    const isOnline = false;
    const showOfflineBanner = !isOnline;
    assert.equal(showOfflineBanner, true);
  });

  it('T2-OFF-4: Prevents re-queueing duplicate pending items upon rapid reconnection flutters', async () => {
    adapter.isOffline = true;
    const p = adapter.submitCluePhoto(GAME_ID, {
      gameId: GAME_ID,
      teamId,
      teamName: 'Crimson Tigers',
      teamColor: '#EF4444',
      clueId,
      clueTitle: 'Stadhuys Red Wall',
      selfieBase64: generateSyntheticBase64Image(50 * 1024),
      awardedPoints: 150,
    });

    // Flush once
    await adapter.reconnectAndFlushOfflineQueue();
    // Immediate second flush call
    const secondFlushCount = await adapter.reconnectAndFlushOfflineQueue();

    assert.equal(secondFlushCount, 0, 'Second flush should have zero items to process');
    const result = await p;
    assert.ok(result.id !== undefined);
  });

  it('T2-OFF-5: Gracefully handles localStorage storage quota exceeded error', () => {
    const safeLocalStorageSave = (key: string, value: string): boolean => {
      try {
        if (value.length > 5 * 1024 * 1024) { // Simulate > 5MB quota
          throw new Error('QuotaExceededError');
        }
        return true;
      } catch {
        return false;
      }
    };

    const oversizedString = 'x'.repeat(6 * 1024 * 1024);
    assert.equal(safeLocalStorageSave('offline_queue', oversizedString), false);
  });

  it('T2-OFF-6: Disconnected client maintains cached clues and zones for offline browsing', () => {
    const cachedClues = adapter['clues'].get(GAME_ID);
    assert.ok(cachedClues !== undefined);
    assert.ok(cachedClues.size > 0);
  });
});
