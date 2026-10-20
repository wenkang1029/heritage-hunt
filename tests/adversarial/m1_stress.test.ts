/**
 * Melaka Heritage Hunt - Adversarial Stress & Chaos Test Suite
 * Path: tests/adversarial/m1_stress.test.ts
 *
 * Challenger 1: Adversarial verification of Milestone 1 invariants:
 * 1. Image compression ceiling under extreme noisy/massive inputs (<= 153,600 bytes)
 * 2. EXIF GPS extraction resilience against truncated, corrupt, and out-of-bounds metadata
 * 3. Mock Adapter event concurrency, multi-subscriber scaling, and storage persistence
 */

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  compressPhoto,
  extractExifGps,
  getBase64ByteLength,
  MAX_COMPRESSED_BASE64_BYTES,
} from '../../src/services/imageCompression.ts';
import { MockAdapterService } from '../../src/services/mockAdapter.ts';
import type { GeoCoordinate } from '../../src/types/index.ts';

// ============================================================================
// Synthetic EXIF GPS Helper for Adversarial Testing
// ============================================================================

interface SyntheticExifOptions {
  lat: number;
  lon: number;
  latRef?: 'N' | 'S';
  lonRef?: 'E' | 'W';
  corruptApp1Length?: number;
  corruptTiffOffset?: number;
  divByZero?: boolean;
}

function createSyntheticGpsJpegWithOptions(opts: SyntheticExifOptions): Uint8Array {
  const {
    lat,
    lon,
    latRef = 'N',
    lonRef = 'E',
    corruptApp1Length,
    corruptTiffOffset,
    divByZero = false,
  } = opts;

  const absLat = Math.abs(lat);
  const latDeg = Math.floor(absLat);
  const latMin = Math.floor((absLat - latDeg) * 60);
  const latSec = Math.round((absLat - latDeg - latMin / 60) * 3600 * 100);

  const absLon = Math.abs(lon);
  const lonDeg = Math.floor(absLon);
  const lonMin = Math.floor((absLon - lonDeg) * 60);
  const lonSec = Math.round((absLon - lonDeg - lonMin / 60) * 3600 * 100);

  const buf = Buffer.alloc(2048);
  let pos = 0;

  // JPEG SOI (Start of Image)
  buf.writeUInt16BE(0xffd8, pos);
  pos += 2;

  // APP1 Marker
  buf.writeUInt16BE(0xffe1, pos);
  pos += 2;
  const app1LenPos = pos;
  pos += 2;

  // 'Exif\0\0'
  buf.write('Exif\0\0', pos, 'latin1');
  pos += 6;

  const tiffStart = pos;
  // TIFF Header (Little Endian: II)
  buf.write('II', pos, 'latin1');
  pos += 2;
  buf.writeUInt16LE(0x002a, pos);
  pos += 2;

  // IFD0 offset
  const ifd0Offset = corruptTiffOffset !== undefined ? corruptTiffOffset : 8;
  buf.writeUInt32LE(ifd0Offset, pos);
  pos += 4;

  // IFD0
  buf.writeUInt16LE(1, pos);
  pos += 2;
  buf.writeUInt16LE(0x8825, pos); // GPSInfo tag
  pos += 2;
  buf.writeUInt16LE(4, pos); // Type: LONG
  pos += 2;
  buf.writeUInt32LE(1, pos); // Count: 1
  pos += 4;
  const gpsOffsetPos = pos;
  pos += 4;
  buf.writeUInt32LE(0, pos); // Next IFD = 0
  pos += 4;

  // GPS IFD
  const gpsIfdStart = pos;
  buf.writeUInt32LE(gpsIfdStart - tiffStart, gpsOffsetPos);

  buf.writeUInt16LE(4, pos);
  pos += 2; // 4 tags

  // Tag 1: GPSLatitudeRef (0x0001)
  buf.writeUInt16LE(0x0001, pos);
  pos += 2;
  buf.writeUInt16LE(2, pos); // ASCII
  pos += 2;
  buf.writeUInt32LE(2, pos);
  pos += 4;
  buf.write(latRef + '\0\0\0', pos, 'latin1');
  pos += 4;

  // Tag 2: GPSLatitude (0x0002)
  buf.writeUInt16LE(0x0002, pos);
  pos += 2;
  buf.writeUInt16LE(5, pos); // RATIONAL
  pos += 2;
  buf.writeUInt32LE(3, pos);
  pos += 4;
  const latValOffsetPos = pos;
  pos += 4;

  // Tag 3: GPSLongitudeRef (0x0003)
  buf.writeUInt16LE(0x0003, pos);
  pos += 2;
  buf.writeUInt16LE(2, pos); // ASCII
  pos += 2;
  buf.writeUInt32LE(2, pos);
  pos += 4;
  buf.write(lonRef + '\0\0\0', pos, 'latin1');
  pos += 4;

  // Tag 4: GPSLongitude (0x0004)
  buf.writeUInt16LE(0x0004, pos);
  pos += 2;
  buf.writeUInt16LE(5, pos); // RATIONAL
  pos += 2;
  buf.writeUInt32LE(3, pos);
  pos += 4;
  const lonValOffsetPos = pos;
  pos += 4;

  buf.writeUInt32LE(0, pos);
  pos += 4; // Next IFD = 0

  // Latitude Rationals
  const denom = divByZero ? 0 : 1;
  const secDenom = divByZero ? 0 : 100;

  buf.writeUInt32LE(pos - tiffStart, latValOffsetPos);
  buf.writeUInt32LE(latDeg, pos);
  pos += 4;
  buf.writeUInt32LE(denom, pos);
  pos += 4;
  buf.writeUInt32LE(latMin, pos);
  pos += 4;
  buf.writeUInt32LE(denom, pos);
  pos += 4;
  buf.writeUInt32LE(latSec, pos);
  pos += 4;
  buf.writeUInt32LE(secDenom, pos);
  pos += 4;

  // Longitude Rationals
  buf.writeUInt32LE(pos - tiffStart, lonValOffsetPos);
  buf.writeUInt32LE(lonDeg, pos);
  pos += 4;
  buf.writeUInt32LE(denom, pos);
  pos += 4;
  buf.writeUInt32LE(lonMin, pos);
  pos += 4;
  buf.writeUInt32LE(denom, pos);
  pos += 4;
  buf.writeUInt32LE(lonSec, pos);
  pos += 4;
  buf.writeUInt32LE(secDenom, pos);
  pos += 4;

  const app1End = pos;
  const finalApp1Len = corruptApp1Length !== undefined ? corruptApp1Length : app1End - app1LenPos;
  buf.writeUInt16BE(finalApp1Len, app1LenPos);

  // JPEG EOI (End of Image)
  buf.writeUInt16BE(0xffd9, pos);
  pos += 2;

  return new Uint8Array(buf.subarray(0, pos));
}

// ============================================================================
// In-Memory Storage Mock for Headless Persistence Testing
// ============================================================================

class MockLocalStorage implements Storage {
  private store: Map<string, string> = new Map();
  public shouldThrowQuota: boolean = false;

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] || null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    if (this.shouldThrowQuota) {
      throw new Error('QuotaExceededError: DOMException 22');
    }
    this.store.set(key, String(value));
  }
}

// ============================================================================
// Test Suite 1: Image Compression Adversarial Stress
// ============================================================================

describe('Adversarial Test Suite 1: Image Compression Ceiling Invariants', () => {
  test('ADV-COMP-01: Zero-byte file throws descriptive error', async () => {
    const emptyFile = new File([], 'empty.jpg', { type: 'image/jpeg' });
    await assert.rejects(
      async () => {
        await compressPhoto(emptyFile);
      },
      {
        message: /Invalid photo: File is empty or not provided/,
      }
    );
  });

  test('ADV-COMP-02: Extreme small file (1 byte) compresses without crashing and remains <= 150 KB', async () => {
    const oneByteFile = new File([new Uint8Array([0x42])], '1byte.jpg', { type: 'image/jpeg' });
    const result = await compressPhoto(oneByteFile);

    assert.ok(result.base64.startsWith('data:image/jpeg;base64,'));
    assert.strictEqual(result.mimeType, 'image/jpeg');
    assert.strictEqual(result.sizeBytes, result.base64.length);
    assert.ok(
      result.sizeBytes <= MAX_COMPRESSED_BASE64_BYTES,
      `Output size ${result.sizeBytes} exceeds 153,600 bytes`
    );
  });

  test('ADV-COMP-03: Boundary file (exact 153,600 bytes) compresses safely <= 150 KB', async () => {
    const boundaryBuffer = new Uint8Array(150 * 1024);
    const boundaryFile = new File([boundaryBuffer], 'boundary.jpg', { type: 'image/jpeg' });
    const result = await compressPhoto(boundaryFile);

    assert.ok(result.base64.startsWith('data:image/jpeg;base64,'));
    assert.ok(
      result.sizeBytes <= MAX_COMPRESSED_BASE64_BYTES,
      `Output size ${result.sizeBytes} exceeds 153,600 bytes`
    );
  });

  test('ADV-COMP-04: Large 5MB buffer of uniform zeros compresses <= 150 KB', async () => {
    const fiveMbZeroes = new Uint8Array(5 * 1024 * 1024);
    const file = new File([fiveMbZeroes], 'zeroes_5mb.jpg', { type: 'image/jpeg' });
    const result = await compressPhoto(file);

    assert.ok(result.sizeBytes <= MAX_COMPRESSED_BASE64_BYTES);
    assert.strictEqual(result.sizeBytes, result.base64.length);
  });

  test('ADV-COMP-05: High-entropy pseudo-random noise buffer (10MB) compresses strictly <= 150 KB', async () => {
    const noiseBuffer = crypto.randomBytes(10 * 1024 * 1024);
    const file = new File([noiseBuffer], 'noise_10mb.jpg', { type: 'image/jpeg' });
    const result = await compressPhoto(file);

    assert.ok(result.base64.startsWith('data:image/jpeg;base64,'));
    assert.ok(
      result.sizeBytes <= MAX_COMPRESSED_BASE64_BYTES,
      `High-entropy output ${result.sizeBytes} exceeded ceiling ${MAX_COMPRESSED_BASE64_BYTES}`
    );
    // Decoded binary byte length must also be well within 150 KB binary
    const decodedBytes = getBase64ByteLength(result.base64);
    assert.ok(decodedBytes <= 150 * 1024);
  });

  test('ADV-COMP-06: Heavy 25MB camera capture compresses strictly <= 150 KB', async () => {
    const heavyBuffer = new Uint8Array(25 * 1024 * 1024);
    heavyBuffer.fill(0xee);
    const file = new File([heavyBuffer], 'raw_25mb.jpg', { type: 'image/jpeg' });
    const result = await compressPhoto(file);

    assert.ok(result.sizeBytes <= MAX_COMPRESSED_BASE64_BYTES);
  });

  test('ADV-COMP-07: Massive 50MB extreme buffer compresses strictly <= 150 KB', async () => {
    const massiveBuffer = new Uint8Array(50 * 1024 * 1024);
    const file = new File([massiveBuffer], 'massive_50mb.jpg', { type: 'image/jpeg' });
    const result = await compressPhoto(file);

    assert.ok(
      result.sizeBytes <= MAX_COMPRESSED_BASE64_BYTES,
      `50MB buffer output ${result.sizeBytes} exceeded 153,600`
    );
  });

  test('ADV-COMP-08: Rapid succession of 25 compressions does not leak memory or exceed ceiling', async () => {
    const sizes = [1024, 50000, 150000, 500000, 2000000];
    for (let i = 0; i < 25; i++) {
      const size = sizes[i % sizes.length];
      const buf = new Uint8Array(size);
      const file = new File([buf], `iter_${i}.jpg`, { type: 'image/jpeg' });
      const result = await compressPhoto(file);
      assert.ok(result.sizeBytes <= MAX_COMPRESSED_BASE64_BYTES);
    }
  });

  test('ADV-COMP-09: Base64 output format invariant: valid data URI and exact byte accounting', async () => {
    const file = new File([new Uint8Array(1024 * 1024)], 'test.jpg', { type: 'image/jpeg' });
    const result = await compressPhoto(file);

    assert.ok(result.base64.startsWith('data:image/jpeg;base64,'));
    const pureB64 = result.base64.split(',')[1];
    assert.ok(/^[A-Za-z0-9+/=]+$/.test(pureB64), 'Pure Base64 payload contains invalid characters');
    assert.strictEqual(pureB64.length % 4, 0, 'Base64 length must be multiple of 4');
  });
});

// ============================================================================
// Test Suite 2: Adversarial EXIF GPS Extraction & Fuzzing
// ============================================================================

describe('Adversarial Test Suite 2: EXIF GPS Extraction & Fuzzing Resilience', () => {
  test('ADV-EXIF-01: Handles null, undefined, and non-File gracefully without throwing', async () => {
    assert.strictEqual(await extractExifGps(null as any), null);
    assert.strictEqual(await extractExifGps(undefined as any), null);
    assert.strictEqual(await extractExifGps({} as any), null);
  });

  test('ADV-EXIF-02: Handles truncated buffers (1 to 20 bytes) without throwing', async () => {
    for (let len = 1; len <= 20; len++) {
      const truncatedBuf = new Uint8Array(len);
      truncatedBuf[0] = 0xff;
      if (len > 1) truncatedBuf[1] = 0xd8; // JPEG SOI
      const file = new File([truncatedBuf], `trunc_${len}.jpg`, { type: 'image/jpeg' });
      const coords = await extractExifGps(file);
      assert.strictEqual(coords, null);
    }
  });

  test('ADV-EXIF-03: Handles APP1 marker buffer overflow exploit (declared length > buffer size)', async () => {
    // APP1 length declared as 65535, but buffer is only 300 bytes
    const malformedJpeg = createSyntheticGpsJpegWithOptions({
      lat: 2.1944,
      lon: 102.2491,
      corruptApp1Length: 65535,
    });
    const file = new File([malformedJpeg], 'overflow.jpg', { type: 'image/jpeg' });
    const coords = await extractExifGps(file);
    // Should catch out-of-bounds error and return null
    assert.strictEqual(coords, null);
  });

  test('ADV-EXIF-04: Handles TIFF header pointer out-of-bounds (0xFFFFFFFF offset)', async () => {
    const malformedJpeg = createSyntheticGpsJpegWithOptions({
      lat: 2.1944,
      lon: 102.2491,
      corruptTiffOffset: 0xffffffff,
    });
    const file = new File([malformedJpeg], 'bad_offset.jpg', { type: 'image/jpeg' });
    const coords = await extractExifGps(file);
    assert.strictEqual(coords, null);
  });

  test('ADV-EXIF-05: Handles non-image binary formats (ASCII, PDF header, ELF/PE)', async () => {
    const asciiFile = new File([Buffer.from('Hello world this is not a JPEG!')], 'text.jpg', {
      type: 'image/jpeg',
    });
    assert.strictEqual(await extractExifGps(asciiFile), null);

    const pdfFile = new File([Buffer.from('%PDF-1.4\n%...')], 'doc.jpg', {
      type: 'image/jpeg',
    });
    assert.strictEqual(await extractExifGps(pdfFile), null);

    const elfFile = new File([new Uint8Array([0x7f, 0x45, 0x4c, 0x46])], 'elf.jpg', {
      type: 'image/jpeg',
    });
    assert.strictEqual(await extractExifGps(elfFile), null);
  });

  test('ADV-EXIF-06: Division by zero in GPS rational tags returns null cleanly (no NaN or Infinity)', async () => {
    const divZeroJpeg = createSyntheticGpsJpegWithOptions({
      lat: 2.1944,
      lon: 102.2491,
      divByZero: true,
    });
    const file = new File([divZeroJpeg], 'div_zero.jpg', { type: 'image/jpeg' });
    const coords = await extractExifGps(file);
    assert.strictEqual(coords, null);
  });

  test('ADV-EXIF-07: Exact boundary coordinates (90, -90, 180, -180, 0, 0) accepted properly', async () => {
    // North pole & East edge
    const northPole = createSyntheticGpsJpegWithOptions({ lat: 90.0, lon: 180.0, latRef: 'N', lonRef: 'E' });
    const c1 = await extractExifGps(new File([northPole], 'np.jpg', { type: 'image/jpeg' }));
    assert.notStrictEqual(c1, null);
    assert.strictEqual(c1!.latitude, 90);
    assert.strictEqual(c1!.longitude, 180);

    // South pole & West edge
    const southPole = createSyntheticGpsJpegWithOptions({ lat: -90.0, lon: -180.0, latRef: 'S', lonRef: 'W' });
    const c2 = await extractExifGps(new File([southPole], 'sp.jpg', { type: 'image/jpeg' }));
    assert.notStrictEqual(c2, null);
    assert.strictEqual(c2!.latitude, -90);
    assert.strictEqual(c2!.longitude, -180);

    // Null Island (0, 0)
    const nullIsland = createSyntheticGpsJpegWithOptions({ lat: 0.0, lon: 0.0, latRef: 'N', lonRef: 'E' });
    const c3 = await extractExifGps(new File([nullIsland], 'ni.jpg', { type: 'image/jpeg' }));
    assert.notStrictEqual(c3, null);
    assert.strictEqual(c3!.latitude, 0);
    assert.strictEqual(c3!.longitude, 0);
  });

  test('ADV-EXIF-08: Out-of-bounds coordinates (>90, <-90, >180, <-180) cleanly return null', async () => {
    // Lat 91.0
    const outLat1 = createSyntheticGpsJpegWithOptions({ lat: 91.0, lon: 102.0, latRef: 'N', lonRef: 'E' });
    assert.strictEqual(await extractExifGps(new File([outLat1], 'out1.jpg')), null);

    // Lat -90.0001
    const outLat2 = createSyntheticGpsJpegWithOptions({ lat: -90.0001, lon: 102.0, latRef: 'S', lonRef: 'E' });
    assert.strictEqual(await extractExifGps(new File([outLat2], 'out2.jpg')), null);

    // Lon 180.0001
    const outLon1 = createSyntheticGpsJpegWithOptions({ lat: 2.0, lon: 180.0001, latRef: 'N', lonRef: 'E' });
    assert.strictEqual(await extractExifGps(new File([outLon1], 'out3.jpg')), null);

    // Lon -181.0
    const outLon2 = createSyntheticGpsJpegWithOptions({ lat: 2.0, lon: -181.0, latRef: 'N', lonRef: 'W' });
    assert.strictEqual(await extractExifGps(new File([outLon2], 'out4.jpg')), null);
  });

  test('ADV-EXIF-09: Fuzz testing: 50 randomly mutated GPS JPEGs never throw uncaught exceptions', async () => {
    const validBaseJpeg = createSyntheticGpsJpegWithOptions({
      lat: 2.1944,
      lon: 102.2491,
    });

    for (let i = 0; i < 50; i++) {
      const fuzzed = new Uint8Array(validBaseJpeg);
      const mutationRate = (i + 1) / 50; // 2% to 100% mutation
      const mutations = Math.floor(fuzzed.length * mutationRate);

      for (let m = 0; m < mutations; m++) {
        const targetByte = Math.floor(Math.random() * fuzzed.length);
        fuzzed[targetByte] = Math.floor(Math.random() * 256);
      }

      const file = new File([fuzzed], `fuzzed_${i}.jpg`, { type: 'image/jpeg' });
      // Must not throw an unhandled exception
      const result = await extractExifGps(file);
      if (result !== null) {
        assert.ok(typeof result.latitude === 'number');
        assert.ok(typeof result.longitude === 'number');
        assert.ok(result.latitude >= -90 && result.latitude <= 90);
        assert.ok(result.longitude >= -180 && result.longitude <= 180);
      }
    }
  });
});

// ============================================================================
// Test Suite 3: Mock Adapter Concurrency, Scaling & Subscriber Stress
// ============================================================================

describe('Adversarial Test Suite 3: Mock Adapter Concurrency & Scaling Stress', () => {
  let adapter: MockAdapterService;

  beforeEach(() => {
    adapter = new MockAdapterService();
    adapter.resetState();
  });

  test('ADV-MOCK-01: Rapid burst of 100 concurrent GPS updates across 5 teams maintains consistency', async () => {
    const teamIds = ['team-crimson', 'team-cobalt', 'team-emerald', 'team-amber', 'team-violet'];
    const updatePromises: Promise<void>[] = [];

    for (let i = 0; i < 100; i++) {
      const teamId = teamIds[i % teamIds.length];
      const coords: GeoCoordinate = {
        latitude: 2.1900 + (i * 0.0001),
        longitude: 102.2400 + (i * 0.0001),
      };
      updatePromises.push(adapter.updateTeamGps('melaka-hunt-2026', teamId, coords));
    }

    await Promise.all(updatePromises);

    // Verify all 5 teams have valid GPS coords updated
    let capturedTeams: any[] = [];
    adapter.subscribeToTeams('melaka-hunt-2026', (teams) => {
      capturedTeams = teams;
    });

    assert.strictEqual(capturedTeams.length, 5);
    for (const team of capturedTeams) {
      assert.notStrictEqual(team.currentCoords, null);
      assert.ok(team.currentCoords.latitude >= 2.19);
      assert.ok(team.currentCoords.longitude >= 102.24);
    }
  });

  test('ADV-MOCK-02: Simultaneous registration of 100 subscribers all receive state updates', async () => {
    const unsubs: (() => void)[] = [];
    let gameNotifications = 0;
    let teamNotifications = 0;
    let clueNotifications = 0;
    let subNotifications = 0;

    // Attach 25 subscribers per category (100 total)
    for (let i = 0; i < 25; i++) {
      unsubs.push(
        adapter.subscribeToGame('melaka-hunt-2026', () => {
          gameNotifications++;
        })
      );
      unsubs.push(
        adapter.subscribeToTeams('melaka-hunt-2026', () => {
          teamNotifications++;
        })
      );
      unsubs.push(
        adapter.subscribeToClues('melaka-hunt-2026', () => {
          clueNotifications++;
        })
      );
      unsubs.push(
        adapter.subscribeToSubmissions('melaka-hunt-2026', () => {
          subNotifications++;
        })
      );
    }

    // Initial subscription calls: 25 * 4 = 100 notifications
    assert.strictEqual(gameNotifications, 25);
    assert.strictEqual(teamNotifications, 25);
    assert.strictEqual(clueNotifications, 25);
    assert.strictEqual(subNotifications, 25);

    // Trigger one mutation: freeze leaderboard
    await adapter.toggleFreezeLeaderboard('melaka-hunt-2026', true);

    // Each game subscriber should have been called again (+25)
    assert.strictEqual(gameNotifications, 50);

    // Clean up
    unsubs.forEach((fn) => fn());
  });

  test('ADV-MOCK-03: Unsubscribing 50% of subscribers during mutation burst leaves active subscribers intact', async () => {
    const activeUnsubs: (() => void)[] = [];
    const cancelledUnsubs: (() => void)[] = [];
    let activeCallCount = 0;
    let cancelledCallCount = 0;

    for (let i = 0; i < 20; i++) {
      const unsub = adapter.subscribeToGame('melaka-hunt-2026', () => {
        activeCallCount++;
      });
      activeUnsubs.push(unsub);
    }

    for (let i = 0; i < 20; i++) {
      const unsub = adapter.subscribeToGame('melaka-hunt-2026', () => {
        cancelledCallCount++;
      });
      cancelledUnsubs.push(unsub);
    }

    // Both groups called once on attach (20 each)
    assert.strictEqual(activeCallCount, 20);
    assert.strictEqual(cancelledCallCount, 20);

    // Cancel 50%
    cancelledUnsubs.forEach((fn) => fn());

    // Trigger mutation
    await adapter.updateGameTimer('melaka-hunt-2026', 4200);

    // Active count increased by 20; cancelled count remained at 20
    assert.strictEqual(activeCallCount, 40);
    assert.strictEqual(cancelledCallCount, 20);

    activeUnsubs.forEach((fn) => fn());
  });

  test('ADV-MOCK-09: Faulty subscriber blast radius probe (subscriber throwing uncaught exception)', async () => {
    let secondSubscriberCalled = false;
    let healthySubscriberCalled = false;

    // First subscriber throws an error
    const unsub1 = adapter.subscribeToGame('melaka-hunt-2026', (game) => {
      if (game.timeRemainingSeconds === 1234) {
        throw new Error('Uncaught subscriber render error!');
      }
    });

    // Second game subscriber
    const unsub2 = adapter.subscribeToGame('melaka-hunt-2026', (game) => {
      if (game.timeRemainingSeconds === 1234) {
        secondSubscriberCalled = true;
      }
    });

    // Teams subscriber
    const unsub3 = adapter.subscribeToTeams('melaka-hunt-2026', () => {
      healthySubscriberCalled = true;
    });
    healthySubscriberCalled = false; // reset after initial call

    // Trigger mutation that causes subscriber 1 to throw
    try {
      await adapter.updateGameTimer('melaka-hunt-2026', 1234);
    } catch {
      // Expected if throwing subscriber bubbles up
    }

    // Document whether error in one subscriber cascades to block others:
    // If secondSubscriberCalled is false, throwing subscriber blocked peer subscribers.
    assert.strictEqual(secondSubscriberCalled, false, 'Throwing subscriber aborted remaining peer listeners in loop');
    assert.strictEqual(healthySubscriberCalled, false, 'Throwing subscriber aborted remaining listener types');

    // Clean up
    unsub1();
    unsub2();
    unsub3();
  });

  test('ADV-MOCK-04: Self-unsubscribing inside callback executes cleanly without Set iteration error', async () => {
    let callCount = 0;
    let unsub: () => void = () => {};

    unsub = adapter.subscribeToGame('melaka-hunt-2026', () => {
      callCount++;
      if (callCount === 2) {
        unsub();
      }
    });

    assert.strictEqual(callCount, 1);

    // Trigger mutation 1 -> callback invoked (callCount becomes 2), unsub() executes
    await adapter.toggleFreezeLeaderboard('melaka-hunt-2026', true);
    assert.strictEqual(callCount, 2);

    // Trigger mutation 2 -> callback should NOT be invoked (callCount remains 2)
    await adapter.toggleFreezeLeaderboard('melaka-hunt-2026', false);
    assert.strictEqual(callCount, 2);
  });

  test('ADV-MOCK-05: Concurrent submission collision: 2 submissions for same team & clue in parallel', async () => {
    const submissionPayload = {
      gameId: 'melaka-hunt-2026',
      teamId: 'team-crimson',
      clueId: 'clue-ds-1',
      photoBase64: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
      submissionCoords: { latitude: 2.1944, longitude: 102.2491 },
      capturedAt: Date.now(),
      distanceMeters: 5,
    };

    const results = await Promise.allSettled([
      adapter.submitCluePhoto('melaka-hunt-2026', submissionPayload),
      adapter.submitCluePhoto('melaka-hunt-2026', submissionPayload),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    // Exactly one must succeed, and one must be rejected for pending duplicate
    assert.strictEqual(fulfilled.length, 1);
    assert.strictEqual(rejected.length, 1);
    assert.match(
      (rejected[0] as PromiseRejectedResult).reason.message,
      /already have a pending submission/i
    );
  });

  test('ADV-MOCK-08: Double-verification idempotency probe on already approved submission', async () => {
    const sub = await adapter.submitCluePhoto('melaka-hunt-2026', {
      gameId: 'melaka-hunt-2026',
      teamId: 'team-cobalt',
      clueId: 'clue-ds-1',
      photoBase64: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
      capturedAt: Date.now(),
      distanceMeters: 10,
    });

    let teamCobalt: any;
    adapter.subscribeToTeams('melaka-hunt-2026', (teams) => {
      teamCobalt = teams.find((t) => t.id === 'team-cobalt');
    });

    const initialScore = teamCobalt.score;
    // First verification: Approve (+100)
    await adapter.verifySubmission('melaka-hunt-2026', sub.id, 'approve', 100);
    assert.strictEqual(teamCobalt.score, initialScore + 100);

    // Second verification attempt on the same submission is rejected and awards nothing.
    await assert.rejects(
      () => adapter.verifySubmission('melaka-hunt-2026', sub.id, 'approve', 100),
      /already been reviewed/
    );
    assert.strictEqual(
      teamCobalt.score,
      initialScore + 100,
      'Duplicate verification must not increment score twice'
    );
  });

  test('ADV-MOCK-06: Concurrent team creation collision: 2 teams created with identical PIN in parallel', async () => {
    const results = await Promise.allSettled([
      adapter.createTeam('melaka-hunt-2026', 'Team Alpha', '#FF0000', '9876'),
      adapter.createTeam('melaka-hunt-2026', 'Team Beta', '#00FF00', '9876'),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    // Exactly one must succeed, one must reject due to duplicate PIN
    assert.strictEqual(fulfilled.length, 1);
    assert.strictEqual(rejected.length, 1);
    assert.match(
      (rejected[0] as PromiseRejectedResult).reason.message,
      /already assigned to team/i
    );
  });

  test('ADV-MOCK-07: Rapid game timer countdown ticks and freeze toggling in parallel', async () => {
    const ticks: Promise<void>[] = [];
    for (let t = 100; t >= 50; t--) {
      ticks.push(adapter.updateGameTimer('melaka-hunt-2026', t));
      if (t % 10 === 0) {
        ticks.push(adapter.toggleFreezeLeaderboard('melaka-hunt-2026', t % 20 === 0));
      }
    }

    await Promise.all(ticks);

    let finalGame: any = null;
    adapter.subscribeToGame('melaka-hunt-2026', (game) => {
      finalGame = game;
    });

    assert.notStrictEqual(finalGame, null);
    assert.ok(finalGame.timeRemainingSeconds <= 100);
  });
});

// ============================================================================
// Test Suite 4: Storage Persistence & Resilience
// ============================================================================

describe('Adversarial Test Suite 4: Storage Persistence & Resilience', () => {
  let mockStorage: MockLocalStorage;

  beforeEach(() => {
    mockStorage = new MockLocalStorage();
    (globalThis as any).localStorage = mockStorage;
  });

  test('ADV-STOR-01: State successfully saves and restores across adapter instances', async () => {
    const adapter1 = new MockAdapterService();
    const newTeam = await adapter1.createTeam('melaka-hunt-2026', 'Persistence Team', '#123456', '8888');

    // Create a new adapter instance reading from the same storage
    const adapter2 = new MockAdapterService();
    let teamsSnapshot: any[] = [];
    adapter2.subscribeToTeams('melaka-hunt-2026', (teams) => {
      teamsSnapshot = teams;
    });

    const persisted = teamsSnapshot.find((t) => t.pin === '8888');
    assert.notStrictEqual(persisted, undefined);
    assert.strictEqual(persisted.name, 'Persistence Team');
    assert.strictEqual(persisted.id, newTeam.id);
  });

  test('ADV-STOR-02: Corrupted JSON in localStorage falls back to clean initial seed without crashing', () => {
    mockStorage.setItem('melaka_hunt_mock_state_v1', '{ corrupt json syntax error !!!');

    // Should not throw, should reseed clean initial state
    const adapter = new MockAdapterService();
    let game: any = null;
    adapter.subscribeToGame('melaka-hunt-2026', (g) => {
      game = g;
    });

    assert.notStrictEqual(game, null);
    assert.strictEqual(game.id, 'melaka-hunt-2026');
    assert.strictEqual(game.status, 'active');
  });

  test('ADV-STOR-03: Storage QuotaExceededError does not crash mutations', async () => {
    const adapter = new MockAdapterService();
    // Simulate full device storage quota
    mockStorage.shouldThrowQuota = true;

    // Mutation should still succeed in-memory without throwing unhandled rejection
    await adapter.updateTeamGps('melaka-hunt-2026', 'team-crimson', {
      latitude: 2.195,
      longitude: 102.248,
    });

    let teams: any[] = [];
    adapter.subscribeToTeams('melaka-hunt-2026', (t) => {
      teams = t;
    });

    const crimson = teams.find((t) => t.id === 'team-crimson');
    assert.notStrictEqual(crimson, undefined);
    assert.strictEqual(crimson.currentCoords.latitude, 2.195);
  });

  test('ADV-STOR-04: resetState purges all mutations and restores pristine initial state', async () => {
    const adapter = new MockAdapterService();
    await adapter.createTeam('melaka-hunt-2026', 'Temporary Team', '#999999', '7777');
    await adapter.toggleFreezeLeaderboard('melaka-hunt-2026', true);

    adapter.resetState();

    let game: any = null;
    let teams: any[] = [];
    adapter.subscribeToGame('melaka-hunt-2026', (g) => {
      game = g;
    });
    adapter.subscribeToTeams('melaka-hunt-2026', (t) => {
      teams = t;
    });

    assert.strictEqual(game.isLeaderboardFrozen, false);
    assert.strictEqual(game.status, 'active');
    assert.strictEqual(teams.length, 5); // pristine 5 starter teams
    assert.strictEqual(teams.find((t) => t.pin === '7777'), undefined);
  });
});
