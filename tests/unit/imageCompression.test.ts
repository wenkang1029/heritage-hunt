/**
 * Melaka Heritage Hunt - Unit Tests: Image Compression & EXIF Extraction
 * Path: tests/unit/imageCompression.test.ts
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  compressPhoto,
  extractExifGps,
  getBase64ByteLength,
  formatBytes,
  MAX_COMPRESSED_BASE64_BYTES,
} from '../../src/services/imageCompression.ts';

/**
 * In-memory synthetic JPEG generator with valid EXIF GPS metadata.
 */
function createSyntheticGpsJpeg(
  lat: number,
  lon: number,
  latRef: 'N' | 'S' = 'N',
  lonRef: 'E' | 'W' = 'E'
): Uint8Array {
  const absLat = Math.abs(lat);
  const latDeg = Math.floor(absLat);
  const latMin = Math.floor((absLat - latDeg) * 60);
  const latSec = Math.round((absLat - latDeg - latMin / 60) * 3600 * 100);

  const absLon = Math.abs(lon);
  const lonDeg = Math.floor(absLon);
  const lonMin = Math.floor((absLon - lonDeg) * 60);
  const lonSec = Math.round((absLon - lonDeg - lonMin / 60) * 3600 * 100);

  const buf = Buffer.alloc(1024);
  let pos = 0;

  // JPEG SOI
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
  buf.writeUInt32LE(8, pos);
  pos += 4; // Offset to IFD0 (8 bytes)

  // IFD0
  buf.writeUInt16LE(1, pos);
  pos += 2;
  buf.writeUInt16LE(0x8825, pos);
  pos += 2; // GPSInfo tag
  buf.writeUInt16LE(4, pos);
  pos += 2; // Type: LONG
  buf.writeUInt32LE(1, pos);
  pos += 4; // Count: 1
  const gpsOffsetPos = pos;
  pos += 4;
  buf.writeUInt32LE(0, pos);
  pos += 4; // Next IFD = 0

  // GPS IFD
  const gpsIfdStart = pos;
  buf.writeUInt32LE(gpsIfdStart - tiffStart, gpsOffsetPos);

  buf.writeUInt16LE(4, pos);
  pos += 2; // 4 tags

  // Tag 1: GPSLatitudeRef (0x0001)
  buf.writeUInt16LE(0x0001, pos);
  pos += 2;
  buf.writeUInt16LE(2, pos);
  pos += 2; // ASCII
  buf.writeUInt32LE(2, pos);
  pos += 4;
  buf.write(latRef + '\0\0\0', pos, 'latin1');
  pos += 4;

  // Tag 2: GPSLatitude (0x0002)
  buf.writeUInt16LE(0x0002, pos);
  pos += 2;
  buf.writeUInt16LE(5, pos);
  pos += 2; // RATIONAL
  buf.writeUInt32LE(3, pos);
  pos += 4;
  const latValOffsetPos = pos;
  pos += 4;

  // Tag 3: GPSLongitudeRef (0x0003)
  buf.writeUInt16LE(0x0003, pos);
  pos += 2;
  buf.writeUInt16LE(2, pos);
  pos += 2; // ASCII
  buf.writeUInt32LE(2, pos);
  pos += 4;
  buf.write(lonRef + '\0\0\0', pos, 'latin1');
  pos += 4;

  // Tag 4: GPSLongitude (0x0004)
  buf.writeUInt16LE(0x0004, pos);
  pos += 2;
  buf.writeUInt16LE(5, pos);
  pos += 2; // RATIONAL
  buf.writeUInt32LE(3, pos);
  pos += 4;
  const lonValOffsetPos = pos;
  pos += 4;

  buf.writeUInt32LE(0, pos);
  pos += 4; // Next IFD = 0

  // Values area
  // Latitude rationals
  buf.writeUInt32LE(pos - tiffStart, latValOffsetPos);
  buf.writeUInt32LE(latDeg, pos);
  pos += 4;
  buf.writeUInt32LE(1, pos);
  pos += 4;
  buf.writeUInt32LE(latMin, pos);
  pos += 4;
  buf.writeUInt32LE(1, pos);
  pos += 4;
  buf.writeUInt32LE(latSec, pos);
  pos += 4;
  buf.writeUInt32LE(100, pos);
  pos += 4;

  // Longitude rationals
  buf.writeUInt32LE(pos - tiffStart, lonValOffsetPos);
  buf.writeUInt32LE(lonDeg, pos);
  pos += 4;
  buf.writeUInt32LE(1, pos);
  pos += 4;
  buf.writeUInt32LE(lonMin, pos);
  pos += 4;
  buf.writeUInt32LE(1, pos);
  pos += 4;
  buf.writeUInt32LE(lonSec, pos);
  pos += 4;
  buf.writeUInt32LE(100, pos);
  pos += 4;

  const app1End = pos;
  buf.writeUInt16BE(app1End - app1LenPos, app1LenPos);
  buf.writeUInt16BE(0xffd9, pos);
  pos += 2;

  return new Uint8Array(buf.subarray(0, pos));
}

describe('Image Compression Service & Invariants', () => {
  test('IMG-01: Empty or zero-byte file rejects with descriptive error', async () => {
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

  test('IMG-02: 5 MB simulated camera photo compresses strictly <= 150 KB Base64', async () => {
    const fiveMbBuffer = new Uint8Array(5 * 1024 * 1024);
    const photoFile = new File([fiveMbBuffer], 'selfie_5mb.jpg', { type: 'image/jpeg' });

    const result = await compressPhoto(photoFile);

    assert.ok(result.base64.startsWith('data:image/jpeg;base64,'));
    assert.strictEqual(result.mimeType, 'image/jpeg');
    assert.strictEqual(result.sizeBytes, result.base64.length);
    assert.ok(
      result.sizeBytes <= MAX_COMPRESSED_BASE64_BYTES,
      `Compressed size ${result.sizeBytes} exceeds 150 KB ceiling (${MAX_COMPRESSED_BASE64_BYTES})`
    );
  });

  test('IMG-03: 10 MB high-resolution capture compresses strictly <= 150 KB Base64', async () => {
    const tenMbBuffer = new Uint8Array(10 * 1024 * 1024);
    const photoFile = new File([tenMbBuffer], 'selfie_10mb.jpg', { type: 'image/jpeg' });

    const result = await compressPhoto(photoFile);

    assert.ok(result.base64.startsWith('data:image/jpeg;base64,'));
    assert.strictEqual(result.mimeType, 'image/jpeg');
    assert.ok(
      result.sizeBytes <= MAX_COMPRESSED_BASE64_BYTES,
      `Compressed size ${result.sizeBytes} exceeds 150 KB ceiling (${MAX_COMPRESSED_BASE64_BYTES})`
    );
  });

  test('IMG-04: Small 30 KB image preserves valid JPEG Base64 output <= 150 KB', async () => {
    const smallBuffer = new Uint8Array(30 * 1024);
    const photoFile = new File([smallBuffer], 'small_thumb.jpg', { type: 'image/jpeg' });

    const result = await compressPhoto(photoFile);

    assert.ok(result.base64.startsWith('data:image/jpeg;base64,'));
    assert.ok(result.sizeBytes <= MAX_COMPRESSED_BASE64_BYTES);
    assert.strictEqual(result.mimeType, 'image/jpeg');
  });

  test('IMG-05: getBase64ByteLength calculates correct binary bytes', () => {
    assert.strictEqual(getBase64ByteLength(''), 0);
    // "AQID" is 4 chars -> 3 bytes
    assert.strictEqual(getBase64ByteLength('AQID'), 3);
    // "AQI=" has 1 pad -> 2 bytes
    assert.strictEqual(getBase64ByteLength('AQI='), 2);
    // "AQ==" has 2 pads -> 1 byte
    assert.strictEqual(getBase64ByteLength('AQ=='), 1);
    // With data URL header prefix
    assert.strictEqual(getBase64ByteLength('data:image/jpeg;base64,AQID'), 3);
  });

  test('IMG-06: formatBytes produces daylight-readable size strings', () => {
    assert.strictEqual(formatBytes(0), '0 Bytes');
    assert.strictEqual(formatBytes(1024), '1 KB');
    assert.strictEqual(formatBytes(153600), '150 KB');
    assert.strictEqual(formatBytes(1048576), '1 MB');
  });
});

describe('EXIF GPS Extraction & Fallbacks', () => {
  test('EXIF-01: Gracefully returns null for empty or zero-byte file', async () => {
    const emptyFile = new File([], 'empty.jpg', { type: 'image/jpeg' });
    const coords = await extractExifGps(emptyFile);
    assert.strictEqual(coords, null);
  });

  test('EXIF-02: Gracefully returns null for corrupted/non-image binary', async () => {
    const corruptFile = new File([new Uint8Array([0x00, 0x11, 0x22, 0x33])], 'corrupt.jpg', {
      type: 'image/jpeg',
    });
    const coords = await extractExifGps(corruptFile);
    assert.strictEqual(coords, null);
  });

  test('EXIF-03: Gracefully returns null for stripped JPEG without GPS metadata', async () => {
    // Pure JPEG with SOI and EOI only
    const strippedJpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
    const file = new File([strippedJpeg], 'no_gps.jpg', { type: 'image/jpeg' });
    const coords = await extractExifGps(file);
    assert.strictEqual(coords, null);
  });

  test('EXIF-04: Successfully extracts authentic Melaka UNESCO GPS coordinates', async () => {
    // Dutch Square coordinates: 2.1944 N, 102.2491 E
    const melakaJpeg = createSyntheticGpsJpeg(2.1944, 102.2491, 'N', 'E');
    const file = new File([melakaJpeg], 'melaka_landmark.jpg', { type: 'image/jpeg' });

    const coords = await extractExifGps(file);

    assert.notStrictEqual(coords, null);
    assert.ok(Math.abs(coords!.latitude - 2.1944) < 0.0001);
    assert.ok(Math.abs(coords!.longitude - 102.2491) < 0.0001);
  });

  test('EXIF-05: Successfully extracts Southern & Western hemisphere coordinates', async () => {
    const swJpeg = createSyntheticGpsJpeg(-2.1944, -102.2491, 'S', 'W');
    const file = new File([swJpeg], 'sw_landmark.jpg', { type: 'image/jpeg' });

    const coords = await extractExifGps(file);

    assert.notStrictEqual(coords, null);
    assert.ok(Math.abs(coords!.latitude - -2.1944) < 0.0001);
    assert.ok(Math.abs(coords!.longitude - -102.2491) < 0.0001);
  });
});
