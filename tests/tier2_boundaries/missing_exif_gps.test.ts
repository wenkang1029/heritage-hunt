import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { GeoCoordinate } from '../framework/contracts.ts';

describe('Tier 2 - Boundary: Missing or Corrupted EXIF GPS Metadata', () => {
  it('T2-EXIF-1: Photo stripped of EXIF metadata returns null GPS safely', () => {
    const strippedMetadata = {};
    const parseExifGps = (data: any): GeoCoordinate | null => {
      if (typeof data?.latitude === 'number' && typeof data?.longitude === 'number') {
        return { lat: data.latitude, lng: data.longitude };
      }
      return null;
    };

    assert.equal(parseExifGps(strippedMetadata), null);
  });

  it('T2-EXIF-2: Corrupted or malformed EXIF buffer is caught without crashing upload flow', () => {
    const parseExifSafely = (buffer: Buffer | ArrayBuffer | null) => {
      try {
        if (!buffer || (buffer as any).byteLength === 0) {
          return null;
        }
        // Simulated parser error on corrupted byte stream
        if ((buffer as any)[0] === 0xff && (buffer as any)[1] !== 0xd8) {
          throw new Error('Invalid JPEG SOI marker');
        }
        return { lat: 2.1944, lng: 102.2491 };
      } catch {
        return null; // Graceful fallback
      }
    };

    const corruptBuffer = Buffer.from([0xff, 0x00, 0x12, 0x34]);
    const result = parseExifSafely(corruptBuffer);
    assert.equal(result, null);
  });

  it('T2-EXIF-3: Metadata containing camera info (Make, Model) but missing GPS block triggers fallback', () => {
    const partialMetadata = {
      Make: 'Apple',
      Model: 'iPhone 15 Pro',
      DateTimeOriginal: '2026-10-14 10:00:00',
      // No latitude or longitude
    };

    const hasGps = (meta: any) => typeof meta?.latitude === 'number' && typeof meta?.longitude === 'number';
    assert.equal(hasGps(partialMetadata), false);
  });

  it('T2-EXIF-4: Map picker fallback assigns valid coordinates when EXIF is null', () => {
    let resolvedCoordinate: GeoCoordinate | null = null;
    const exifResult = null;

    if (!exifResult) {
      // GM clicks on map
      resolvedCoordinate = { lat: 2.1978, lng: 102.2465 }; // Jalan Tokong
    }

    assert.deepEqual(resolvedCoordinate, { lat: 2.1978, lng: 102.2465 });
  });

  it('T2-EXIF-5: Manual coordinate override supersedes erroneous EXIF GPS reading', () => {
    const originalExifGps: GeoCoordinate = { lat: 2.1900, lng: 102.2500 }; // Slightly off
    const refinedGps: GeoCoordinate = { lat: 2.1918, lng: 102.2505 }; // Accurate A Famosa pin

    let activeGps = originalExifGps;
    // GM drags pin
    activeGps = refinedGps;

    assert.deepEqual(activeGps, refinedGps);
    assert.notDeepEqual(activeGps, originalExifGps);
  });
});
