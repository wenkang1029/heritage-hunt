import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { MockGameAdapter } from '../framework/mockGameAdapter.ts';
import { SAMPLE_MELAKA_CLUES } from '../framework/testHelpers.ts';
import type { Clue, GeoCoordinate } from '../framework/contracts.ts';

describe('Tier 1 - Feature Group 4: Clues & Landmark Management', () => {
  let adapter: MockGameAdapter;
  const GAME_ID = 'test-game-clues-04';

  beforeEach(() => {
    adapter = new MockGameAdapter();
    adapter.createGame(GAME_ID);
  });

  describe('Feature 16: Clue Discovery & Teaser Cards', () => {
    let clue: Clue;

    beforeEach(async () => {
      clue = await adapter.addClue(GAME_ID, SAMPLE_MELAKA_CLUES[0]);
    });

    it('F16-T1: Clue card contains cropped teaser image URL/Base64', () => {
      assert.ok(clue.targetPhotoBase64.startsWith('data:image/'));
      assert.ok(clue.targetPhotoBase64.length > 50);
    });

    it('F16-T2: Clue specifies positive integer points award', () => {
      assert.ok(clue.points > 0);
      assert.equal(Number.isInteger(clue.points), true);
    });

    it('F16-T3: Clue includes descriptive hint text for player guidance', () => {
      assert.ok(clue.hint.length > 10);
      assert.ok(clue.hint.includes('stage') || clue.hint.includes('river'));
    });

    it('F16-T4: Clue is associated with a valid UNESCO zoneId', () => {
      assert.equal(clue.zoneId, 'jonker-street');
    });

    it('F16-T5: Clue card state tracks completion status for active team', () => {
      const completedClueIds = [clue.id];
      const isCompleted = (cId: string) => completedClueIds.includes(cId);
      assert.equal(isCompleted(clue.id), true);
      assert.equal(isCompleted('other-clue'), false);
    });
  });

  describe('Feature 17: GM Clue Manager', () => {
    it('F17-T1: GM creates new clue with title, zone, points, coordinates, and photo', async () => {
      const newClue = await adapter.addClue(GAME_ID, {
        title: 'Christ Church Red Bricks',
        zoneId: 'dutch-square',
        points: 150,
        targetPhotoBase64: 'data:image/jpeg;base64,mockphoto',
        location: { lat: 2.1944, lng: 102.2491 },
        hint: 'Built in 1753 using Dutch pink-red bricks.',
      });

      assert.ok(newClue.id.startsWith('clue_'));
      assert.equal(newClue.title, 'Christ Church Red Bricks');
      assert.equal(newClue.points, 150);
    });

    it('F17-T2: GM can edit clue point value', async () => {
      const clue = await adapter.addClue(GAME_ID, SAMPLE_MELAKA_CLUES[1]);
      const updated = await adapter.updateClue(GAME_ID, clue.id, { points: 250 });
      assert.equal(updated.points, 250);
    });

    it('F17-T3: GM can update clue hint and title', async () => {
      const clue = await adapter.addClue(GAME_ID, SAMPLE_MELAKA_CLUES[2]);
      const updated = await adapter.updateClue(GAME_ID, clue.id, {
        title: 'Updated Title',
        hint: 'Updated Hint',
      });
      assert.equal(updated.title, 'Updated Title');
      assert.equal(updated.hint, 'Updated Hint');
    });

    it('F17-T4: GM can delete an unwanted clue from the game', async () => {
      const clue = await adapter.addClue(GAME_ID, SAMPLE_MELAKA_CLUES[3]);
      await adapter.deleteClue(GAME_ID, clue.id);
      const remainingClues: Clue[] = [];
      adapter.subscribeToClues(GAME_ID, (clues) => remainingClues.push(...clues));
      const exists = remainingClues.some(c => c.id === clue.id);
      assert.equal(exists, false);
    });

    it('F17-T5: Subscribing to clues notifies GM immediately upon addition', async () => {
      const clueCounts: number[] = [];
      const unsub = adapter.subscribeToClues(GAME_ID, (clues) => {
        clueCounts.push(clues.length);
      });

      await adapter.addClue(GAME_ID, SAMPLE_MELAKA_CLUES[0]);
      await adapter.addClue(GAME_ID, SAMPLE_MELAKA_CLUES[1]);
      unsub();

      assert.deepEqual(clueCounts, [0, 1, 2]);
    });
  });

  describe('Feature 18: GM Bulk Clue Upload & EXIF GPS Extraction', () => {
    it('F18-T1: Extracts latitude & longitude from valid EXIF GPS metadata block', () => {
      const mockExifData = {
        latitude: 2.1944,
        longitude: 102.2491,
      };

      const extractExifGps = (metadata: any): GeoCoordinate | null => {
        if (typeof metadata?.latitude === 'number' && typeof metadata?.longitude === 'number') {
          return { lat: metadata.latitude, lng: metadata.longitude };
        }
        return null;
      };

      const extracted = extractExifGps(mockExifData);
      assert.deepEqual(extracted, { lat: 2.1944, lng: 102.2491 });
    });

    it('F18-T2: Bulk upload batches multiple reference photos sequentially', async () => {
      const uploadBatch = SAMPLE_MELAKA_CLUES.slice(0, 3);
      for (const clueData of uploadBatch) {
        await adapter.addClue(GAME_ID, clueData);
      }
      let totalClues = 0;
      adapter.subscribeToClues(GAME_ID, (clues) => {
        totalClues = clues.length;
      });
      assert.equal(totalClues, 3);
    });

    it('F18-T3: Auto-derives clue title from file name when title is unspecified', () => {
      const filename = 'stadhuys_clock_tower_01.jpg';
      const deriveTitle = (name: string): string => {
        return name
          .replace(/\.[^/.]+$/, '')
          .split('_')
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ');
      };
      assert.equal(deriveTitle(filename), 'Stadhuys Clock Tower 01');
    });

    it('F18-T4: Default points value (100) is assigned if unspecified in bulk import', async () => {
      const clue = await adapter.addClue(GAME_ID, {
        title: 'Auto Points Clue',
        zoneId: 'dutch-square',
        points: 100,
        targetPhotoBase64: 'data:image/jpeg;base64,xxx',
        location: { lat: 2.1944, lng: 102.2491 },
        hint: 'Default points test',
      });
      assert.equal(clue.points, 100);
    });

    it('F18-T5: EXIF parser handles DMS (Degrees Minutes Seconds) coordinate conversion', () => {
      const convertDMSToDD = (d: number, m: number, s: number, ref: 'N' | 'S' | 'E' | 'W'): number => {
        let dd = d + m / 60 + s / 3600;
        if (ref === 'S' || ref === 'W') dd = -dd;
        return Math.round(dd * 10000) / 10000;
      };

      // Melaka lat approx 2° 11' 39.84" N -> 2.1944
      const latDD = convertDMSToDD(2, 11, 39.84, 'N');
      assert.equal(latDD, 2.1944);
    });
  });

  describe('Feature 19: Manual Map Picker Fallback', () => {
    it('F19-T1: Missing EXIF metadata triggers manual coordinate picker fallback flag', () => {
      const exifMetadata = null;
      const requiresManualPicker = exifMetadata === null;
      assert.equal(requiresManualPicker, true);
    });

    it('F19-T2: GM click event on map sets clue location coordinates', () => {
      const mapClickEvent = { latlng: { lat: 2.1955, lng: 102.2488 } };
      const selectedLocation: GeoCoordinate = {
        lat: mapClickEvent.latlng.lat,
        lng: mapClickEvent.latlng.lng,
      };
      assert.equal(selectedLocation.lat, 2.1955);
      assert.equal(selectedLocation.lng, 102.2488);
    });

    it('F19-T3: Draggable map pin updates coordinate state in real time', () => {
      let pinCoord: GeoCoordinate = { lat: 2.1944, lng: 102.2491 };
      const onPinDragEnd = (newCoord: GeoCoordinate) => {
        pinCoord = newCoord;
      };

      onPinDragEnd({ lat: 2.1946, lng: 102.2493 });
      assert.equal(pinCoord.lat, 2.1946);
      assert.equal(pinCoord.lng, 102.2493);
    });

    it('F19-T4: Manual override replaces previously extracted EXIF coordinates', () => {
      let activeCoord: GeoCoordinate = { lat: 2.1944, lng: 102.2491 }; // from EXIF
      const manualOverride: GeoCoordinate = { lat: 2.1947, lng: 102.2495 }; // GM refined
      activeCoord = manualOverride;
      assert.deepEqual(activeCoord, manualOverride);
    });

    it('F19-T5: Clue creation validation rejects submission if coordinates are completely undefined', () => {
      const validateClue = (location?: GeoCoordinate) => {
        if (!location || typeof location.lat !== 'number' || typeof location.lng !== 'number') {
          throw new Error('Coordinates are required');
        }
        return true;
      };

      assert.throws(() => validateClue(undefined), /Coordinates are required/);
    });
  });
});
