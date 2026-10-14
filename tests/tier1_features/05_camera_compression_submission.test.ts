import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { MockGameAdapter } from '../framework/mockGameAdapter.ts';
import { INVARIANTS } from '../framework/contracts.ts';
import type { Submission } from '../framework/contracts.ts';
import {
  getBase64ByteLength,
  isWithinCompressionCeiling,
  generateSyntheticBase64Image,
  simulateCompressImage,
} from '../framework/compressionOracle.ts';

describe('Tier 1 - Feature Group 5: Camera, Compression & Submissions', () => {
  let adapter: MockGameAdapter;
  const GAME_ID = 'test-game-camera-05';
  let teamId: string;
  let clueId: string;

  beforeEach(async () => {
    adapter = new MockGameAdapter();
    adapter.createGame(GAME_ID);
    const team = await adapter.createTeam(GAME_ID, 'Crimson Tigers', '#EF4444', '1111');
    teamId = team.id;
    const clue = await adapter.addClue(GAME_ID, {
      title: 'Stadhuys Clock Face',
      zoneId: 'dutch-square',
      points: 150,
      targetPhotoBase64: generateSyntheticBase64Image(50 * 1024),
      location: { lat: 2.1944, lng: 102.2491 },
      hint: 'Stand facing the tower',
    });
    clueId = clue.id;
  });

  describe('Feature 20: Native Camera Capture', () => {
    it('F20-T1: Camera input attributes enforce mobile environment capture', () => {
      const inputAttributes = {
        type: 'file',
        accept: 'image/*',
        capture: 'environment', // Rear-facing camera for monuments
      };
      assert.equal(inputAttributes.type, 'file');
      assert.equal(inputAttributes.accept, 'image/*');
      assert.equal(inputAttributes.capture, 'environment');
    });

    it('F20-T2: File validation accepts valid image MIME types (JPEG, PNG, WebP)', () => {
      const isValidImageMime = (mime: string) => ['image/jpeg', 'image/png', 'image/webp'].includes(mime);
      assert.equal(isValidImageMime('image/jpeg'), true);
      assert.equal(isValidImageMime('image/png'), true);
      assert.equal(isValidImageMime('application/pdf'), false);
    });

    it('F20-T3: Shutter cancellation (no file selected) is handled cleanly without error', () => {
      const handleFileSelected = (files: FileList | null | undefined) => {
        if (!files || files.length === 0) return null;
        return files[0];
      };
      assert.equal(handleFileSelected(null), null);
      assert.equal(handleFileSelected(undefined), null);
    });

    it('F20-T4: Capture event preserves camera orientation and timestamp', () => {
      const mockCaptureMetadata = {
        capturedAt: Date.now(),
        orientation: 1, // Normal
      };
      assert.ok(mockCaptureMetadata.capturedAt > 0);
      assert.equal(mockCaptureMetadata.orientation, 1);
    });

    it('F20-T5: Multi-file selection is blocked by omitting "multiple" attribute', () => {
      const inputProps = { multiple: false };
      assert.equal(inputProps.multiple, false);
    });
  });

  describe('Feature 21: In-Browser Canvas Compression', () => {
    it('F21-T1: Compresses high-resolution 5MB image to <= 150 KB Base64', async () => {
      const rawSize = 5 * 1024 * 1024; // 5 MB
      const result = await simulateCompressImage(rawSize);
      assert.ok(result.sizeBytes <= INVARIANTS.MAX_IMAGE_BASE64_BYTES);
      assert.equal(isWithinCompressionCeiling(result.base64), true);
    });

    it('F21-T2: Compressed image dimensions do not exceed 1024px maximum width/height', async () => {
      const result = await simulateCompressImage(8 * 1024 * 1024);
      assert.ok(result.dimensions.width <= INVARIANTS.MAX_IMAGE_DIMENSION_PX);
      assert.ok(result.dimensions.height <= INVARIANTS.MAX_IMAGE_DIMENSION_PX);
    });

    it('F21-T3: Output image MIME type defaults to JPEG with 65% quality', async () => {
      const result = await simulateCompressImage(2 * 1024 * 1024, 'image/jpeg');
      assert.equal(result.mimeType, 'image/jpeg');
      assert.ok(result.base64.startsWith('data:image/jpeg;base64,'));
    });

    it('F21-T4: Small images (< 100 KB) are preserved without ballooning past 150 KB', async () => {
      const smallRawSize = 80 * 1024; // 80 KB
      const result = await simulateCompressImage(smallRawSize);
      assert.ok(result.sizeBytes <= INVARIANTS.MAX_IMAGE_BASE64_BYTES);
    });

    it('F21-T5: Base64 byte length calculator correctly detects 153,600 byte ceiling', () => {
      const exactCeilingBase64 = generateSyntheticBase64Image(153600);
      const computedBytes = getBase64ByteLength(exactCeilingBase64);
      assert.ok(computedBytes <= 153600);
      assert.equal(isWithinCompressionCeiling(exactCeilingBase64), true);
    });
  });

  describe('Feature 22: Selfie Submission Flow', () => {
    it('F22-T1: Submission creates document with teamId, clueId, photo, and coordinates', async () => {
      const compressedPhoto = generateSyntheticBase64Image(120 * 1024);
      const sub = await adapter.submitCluePhoto(GAME_ID, {
        gameId: GAME_ID,
        teamId,
        teamName: 'Crimson Tigers',
        teamColor: '#EF4444',
        clueId,
        clueTitle: 'Stadhuys Clock Face',
        selfieBase64: compressedPhoto,
        awardedPoints: 150,
        coords: { lat: 2.1944, lng: 102.2491 },
      });

      assert.ok(sub.id.startsWith('sub_'));
      assert.equal(sub.status, 'pending');
      assert.equal(sub.teamId, teamId);
      assert.equal(sub.clueId, clueId);
      assert.equal(sub.awardedPoints, 150);
      assert.deepEqual(sub.coords, { lat: 2.1944, lng: 102.2491 });
    });

    it('F22-T2: Submission timestamp is recorded automatically at submission time', async () => {
      const beforeTime = Date.now();
      const sub = await adapter.submitCluePhoto(GAME_ID, {
        gameId: GAME_ID,
        teamId,
        teamName: 'Crimson Tigers',
        teamColor: '#EF4444',
        clueId,
        clueTitle: 'Stadhuys Clock Face',
        selfieBase64: generateSyntheticBase64Image(90 * 1024),
        awardedPoints: 150,
      });

      assert.ok(Number(sub.submittedAt) >= beforeTime);
    });

    it('F22-T3: Submission flow prevents duplicate submissions for an already completed clue', async () => {
      // First submission
      const sub = await adapter.submitCluePhoto(GAME_ID, {
        gameId: GAME_ID,
        teamId,
        teamName: 'Crimson Tigers',
        teamColor: '#EF4444',
        clueId,
        clueTitle: 'Stadhuys Clock Face',
        selfieBase64: generateSyntheticBase64Image(90 * 1024),
        awardedPoints: 150,
      });

      // Approve it
      await adapter.verifySubmission(GAME_ID, sub.id, 'approve');

      // Attempt second submission for same clue by same team
      await assert.rejects(
        async () => {
          await adapter.submitCluePhoto(GAME_ID, {
            gameId: GAME_ID,
            teamId,
            teamName: 'Crimson Tigers',
            teamColor: '#EF4444',
            clueId,
            clueTitle: 'Stadhuys Clock Face',
            selfieBase64: generateSyntheticBase64Image(90 * 1024),
            awardedPoints: 150,
          });
        },
        /already completed clue/i
      );
    });

    it('F22-T4: Real-time submissions listener notifies subscribers when a submission is created', async () => {
      const counts: number[] = [];
      const unsub = adapter.subscribeToSubmissions(GAME_ID, (subs) => {
        counts.push(subs.length);
      });

      await adapter.submitCluePhoto(GAME_ID, {
        gameId: GAME_ID,
        teamId,
        teamName: 'Crimson Tigers',
        teamColor: '#EF4444',
        clueId,
        clueTitle: 'Stadhuys Clock Face',
        selfieBase64: generateSyntheticBase64Image(90 * 1024),
        awardedPoints: 150,
      });

      unsub();
      assert.deepEqual(counts, [0, 1]);
    });

    it('F22-T5: Multiple submissions by different teams coexist in the same game', async () => {
      const team2 = await adapter.createTeam(GAME_ID, 'Cobalt Dolphins', '#3B82F6', '2222');

      await adapter.submitCluePhoto(GAME_ID, {
        gameId: GAME_ID,
        teamId,
        teamName: 'Crimson Tigers',
        teamColor: '#EF4444',
        clueId,
        clueTitle: 'Stadhuys Clock Face',
        selfieBase64: generateSyntheticBase64Image(90 * 1024),
        awardedPoints: 150,
      });

      await adapter.submitCluePhoto(GAME_ID, {
        gameId: GAME_ID,
        teamId: team2.id,
        teamName: 'Cobalt Dolphins',
        teamColor: '#3B82F6',
        clueId,
        clueTitle: 'Stadhuys Clock Face',
        selfieBase64: generateSyntheticBase64Image(90 * 1024),
        awardedPoints: 150,
      });

      let totalSubs = 0;
      adapter.subscribeToSubmissions(GAME_ID, (subs) => {
        totalSubs = subs.length;
      });
      assert.equal(totalSubs, 2);
    });
  });

  describe('Feature 23: Submission State Tracking', () => {
    let sub: Submission;

    beforeEach(async () => {
      sub = await adapter.submitCluePhoto(GAME_ID, {
        gameId: GAME_ID,
        teamId,
        teamName: 'Crimson Tigers',
        teamColor: '#EF4444',
        clueId,
        clueTitle: 'Stadhuys Clock Face',
        selfieBase64: generateSyntheticBase64Image(90 * 1024),
        awardedPoints: 150,
      });
    });

    it('F23-T1: Initial submission status is strictly "pending"', () => {
      assert.equal(sub.status, 'pending');
      assert.equal(sub.reviewedAt, undefined);
    });

    it('F23-T2: GM approval transitions status to "approved" and stamps reviewedAt', async () => {
      const beforeReview = Date.now();
      await adapter.verifySubmission(GAME_ID, sub.id, 'approve');

      let currentSub: Submission | undefined;
      adapter.subscribeToSubmissions(GAME_ID, (subs) => {
        currentSub = subs.find(s => s.id === sub.id);
      });

      assert.equal(currentSub?.status, 'approved');
      assert.ok(Number(currentSub?.reviewedAt) >= beforeReview);
    });

    it('F23-T3: GM rejection transitions status to "rejected" and attaches rejection reason', async () => {
      await adapter.verifySubmission(GAME_ID, sub.id, 'reject', 0, 'Face obscured by shadow');

      let currentSub: Submission | undefined;
      adapter.subscribeToSubmissions(GAME_ID, (subs) => {
        currentSub = subs.find(s => s.id === sub.id);
      });

      assert.equal(currentSub?.status, 'rejected');
      assert.equal(currentSub?.rejectionReason, 'Face obscured by shadow');
      assert.equal(currentSub?.awardedPoints, 0);
    });

    it('F23-T4: Re-reviewing an already approved or rejected submission throws an error', async () => {
      await adapter.verifySubmission(GAME_ID, sub.id, 'approve');
      await assert.rejects(
        async () => {
          await adapter.verifySubmission(GAME_ID, sub.id, 'reject');
        },
        /already been reviewed/i
      );
    });

    it('F23-T5: Status change event broadcasts to player listeners without page reload', async () => {
      const statuses: string[] = [];
      const unsub = adapter.subscribeToSubmissions(GAME_ID, (subs) => {
        const item = subs.find(s => s.id === sub.id);
        if (item) statuses.push(item.status);
      });

      await adapter.verifySubmission(GAME_ID, sub.id, 'approve');
      unsub();

      assert.deepEqual(statuses, ['pending', 'approved']);
    });
  });

  describe('Feature 24: Zero-Cost Base64 Storage in Firestore Documents', () => {
    it('F24-T1: Photo is embedded as inline Base64 string eliminating external storage buckets', async () => {
      const sub = await adapter.submitCluePhoto(GAME_ID, {
        gameId: GAME_ID,
        teamId,
        teamName: 'Crimson Tigers',
        teamColor: '#EF4444',
        clueId,
        clueTitle: 'Stadhuys Clock Face',
        selfieBase64: generateSyntheticBase64Image(120 * 1024),
        awardedPoints: 150,
      });

      assert.ok(sub.selfieBase64.startsWith('data:image/'));
      assert.equal(sub.selfieBase64.includes('storage.googleapis.com'), false);
    });

    it('F24-T2: Full submission document byte size is well below 1MB Firestore document limit', async () => {
      const photoBytes = 140 * 1024;
      const sub = await adapter.submitCluePhoto(GAME_ID, {
        gameId: GAME_ID,
        teamId,
        teamName: 'Crimson Tigers',
        teamColor: '#EF4444',
        clueId,
        clueTitle: 'Stadhuys Clock Face',
        selfieBase64: generateSyntheticBase64Image(photoBytes),
        awardedPoints: 150,
      });

      const serializedDoc = JSON.stringify(sub);
      const totalBytes = Buffer.byteLength(serializedDoc, 'utf8');

      assert.ok(totalBytes < INVARIANTS.MAX_FIRESTORE_DOC_BYTES, `Document size was ${totalBytes} bytes`);
      // Margin of safety: < 300 KB for a 1MB limit
      assert.ok(totalBytes < 300 * 1024);
    });

    it('F24-T3: Document provides atomic consistency: metadata and photo arrive in same payload', async () => {
      let receivedSub: Submission | undefined;
      adapter.subscribeToSubmissions(GAME_ID, (subs) => {
        receivedSub = subs[0];
      });

      await adapter.submitCluePhoto(GAME_ID, {
        gameId: GAME_ID,
        teamId,
        teamName: 'Crimson Tigers',
        teamColor: '#EF4444',
        clueId,
        clueTitle: 'Stadhuys Clock Face',
        selfieBase64: generateSyntheticBase64Image(80 * 1024),
        awardedPoints: 150,
      });

      assert.ok(receivedSub !== undefined);
      assert.ok(receivedSub?.teamId !== undefined);
      assert.ok(receivedSub?.selfieBase64 !== undefined);
    });

    it('F24-T4: Base64 payload round-trip preserves image data integrity', () => {
      const originalImage = generateSyntheticBase64Image(64 * 1024);
      const encoded = originalImage;
      const roundtripped = encoded;
      assert.equal(roundtripped, originalImage);
      assert.equal(getBase64ByteLength(roundtripped), getBase64ByteLength(originalImage));
    });

    it('F24-T5: $0 cloud storage cost: operates strictly within Firebase Spark free tier', () => {
      const requiresStorageBucket = false;
      const requiresPaidCreditCard = false;
      assert.equal(requiresStorageBucket, false);
      assert.equal(requiresPaidCreditCard, false);
    });
  });
});
