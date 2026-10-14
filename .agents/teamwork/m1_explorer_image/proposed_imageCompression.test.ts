/**
 * Melaka Heritage Photo Hunt - Image Compression & EXIF Unit Tests
 * Path: .agents/teamwork/m1_explorer_image/proposed_imageCompression.test.ts
 *
 * Runnable via:
 * node --test .agents/teamwork/m1_explorer_image/proposed_imageCompression.test.ts
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  compressPhoto,
  extractExifGps,
  MAX_COMPRESSED_BASE64_BYTES,
  getBase64ByteLength,
  formatBytes,
} from './proposed_imageCompression.ts';

/**
 * In-memory generator for synthetic JPEG buffer with valid EXIF GPS tags.
 */
function createSyntheticExifJpeg(lat: number, lng: number): Buffer {
  const buf = Buffer.alloc(512);
  let p = 0;
  // JPEG SOI
  buf.writeUInt16BE(0xFFD8, p); p += 2;
  // APP1 Marker
  buf.writeUInt16BE(0xFFE1, p); p += 2;
  const app1LenPos = p; p += 2;
  // Exif\0\0
  buf.write('Exif\0\0', p, 'latin1'); p += 6;

  const tiffStart = p;
  // TIFF Header: 'II' (0x4949 little-endian), 42, offset to IFD0 (8)
  buf.writeUInt16LE(0x4949, p); p += 2;
  buf.writeUInt16LE(42, p); p += 2;
  buf.writeUInt32LE(8, p); p += 4;

  // IFD0: 1 tag (GPSInfo 0x8825)
  buf.writeUInt16LE(1, p); p += 2;
  buf.writeUInt16LE(0x8825, p); p += 2;
  buf.writeUInt16LE(4, p); p += 2;
  buf.writeUInt32LE(1, p); p += 4;
  const gpsIfdOffsetPos = p; p += 4;
  buf.writeUInt32LE(0, p); p += 4;

  // GPS IFD
  const gpsIfdOffset = p - tiffStart;
  buf.writeUInt32LE(gpsIfdOffset, gpsIfdOffsetPos);
  buf.writeUInt16LE(4, p); p += 2;

  const latRef = lat >= 0 ? 'N' : 'S';
  const lngRef = lng >= 0 ? 'E' : 'W';
  const absLat = Math.abs(lat);
  const absLng = Math.abs(lng);

  // 1. GPSLatitudeRef
  buf.writeUInt16LE(0x0001, p); p += 2; buf.writeUInt16LE(2, p); p += 2; buf.writeUInt32LE(2, p); p += 4;
  buf.write(latRef + '\0\0\0', p, 'latin1'); p += 4;

  // 2. GPSLatitude
  buf.writeUInt16LE(0x0002, p); p += 2; buf.writeUInt16LE(5, p); p += 2; buf.writeUInt32LE(3, p); p += 4;
  const latValOffsetPos = p; p += 4;

  // 3. GPSLongitudeRef
  buf.writeUInt16LE(0x0003, p); p += 2; buf.writeUInt16LE(2, p); p += 2; buf.writeUInt32LE(2, p); p += 4;
  buf.write(lngRef + '\0\0\0', p, 'latin1'); p += 4;

  // 4. GPSLongitude
  buf.writeUInt16LE(0x0004, p); p += 2; buf.writeUInt16LE(5, p); p += 2; buf.writeUInt32LE(3, p); p += 4;
  const lngValOffsetPos = p; p += 4;

  buf.writeUInt32LE(0, p); p += 4;

  // Latitude Rationals: Deg, Min, Sec
  const latValOffset = p - tiffStart;
  buf.writeUInt32LE(latValOffset, latValOffsetPos);
  const latDeg = Math.floor(absLat);
  const latMin = Math.floor((absLat - latDeg) * 60);
  const latSec = Math.round(((absLat - latDeg) * 60 - latMin) * 60 * 100);
  buf.writeUInt32LE(latDeg, p); buf.writeUInt32LE(1, p + 4); p += 8;
  buf.writeUInt32LE(latMin, p); buf.writeUInt32LE(1, p + 4); p += 8;
  buf.writeUInt32LE(latSec, p); buf.writeUInt32LE(100, p + 4); p += 8;

  // Longitude Rationals: Deg, Min, Sec
  const lngValOffset = p - tiffStart;
  buf.writeUInt32LE(lngValOffset, lngValOffsetPos);
  const lngDeg = Math.floor(absLng);
  const lngMin = Math.floor((absLng - lngDeg) * 60);
  const lngSec = Math.round(((absLng - lngDeg) * 60 - lngMin) * 60 * 100);
  buf.writeUInt32LE(lngDeg, p); buf.writeUInt32LE(1, p + 4); p += 8;
  buf.writeUInt32LE(lngMin, p); buf.writeUInt32LE(1, p + 4); p += 8;
  buf.writeUInt32LE(lngSec, p); buf.writeUInt32LE(100, p + 4); p += 8;

  // Fix APP1 Length
  buf.writeUInt16BE(p - app1LenPos, app1LenPos);
  // JPEG EOI
  buf.writeUInt16BE(0xFFD9, p); p += 2;

  return buf.subarray(0, p);
}

describe('EXIF GPS Metadata Extraction Service', () => {
  it('EXIF-01: accurately extracts Melaka landmark GPS coordinates', async () => {
    // Jonker Street coordinates: 2.1944 N, 102.2491 E
    const jpegBuf = createSyntheticExifJpeg(2.1944, 102.2491);
    const file = new File([jpegBuf], 'jonker_street.jpg', { type: 'image/jpeg' });

    const coords = await extractExifGps(file);
    assert.ok(coords !== null, 'Expected coordinates to be extracted');
    assert.equal(Math.round(coords.latitude * 10000) / 10000, 2.1944);
    assert.equal(Math.round(coords.longitude * 10000) / 10000, 102.2491);
  });

  it('EXIF-02: accurately handles negative coordinates (Southern / Western hemispheres)', async () => {
    const jpegBuf = createSyntheticExifJpeg(-2.1944, -102.2491);
    const file = new File([jpegBuf], 'south_west.jpg', { type: 'image/jpeg' });

    const coords = await extractExifGps(file);
    assert.ok(coords !== null, 'Expected coordinates to be extracted');
    assert.equal(Math.round(coords.latitude * 10000) / 10000, -2.1944);
    assert.equal(Math.round(coords.longitude * 10000) / 10000, -102.2491);
  });

  it('EXIF-03: gracefully returns null on JPEG with stripped EXIF', async () => {
    // Minimal standard JPEG without APP1 EXIF segment
    const noExifBuf = Buffer.from([
      0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46,
      0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00,
      0xFF, 0xD9
    ]);
    const file = new File([noExifBuf], 'no_exif.jpg', { type: 'image/jpeg' });

    const coords = await extractExifGps(file);
    assert.equal(coords, null, 'Expected null when EXIF is stripped');
  });

  it('EXIF-04: gracefully returns null on non-JPEG image (PNG/WebP without EXIF)', async () => {
    const pngBuf = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    const file = new File([pngBuf], 'sample.png', { type: 'image/png' });

    const coords = await extractExifGps(file);
    assert.equal(coords, null);
  });

  it('EXIF-05: gracefully returns null on corrupted / truncated file', async () => {
    const corruptBuf = Buffer.from('corrupted garbage header and data');
    const file = new File([corruptBuf], 'corrupt.jpg', { type: 'image/jpeg' });

    const coords = await extractExifGps(file);
    assert.equal(coords, null);
  });

  it('EXIF-06: gracefully returns null on empty (0-byte) file', async () => {
    const emptyFile = new File([], 'empty.jpg', { type: 'image/jpeg' });
    const coords = await extractExifGps(emptyFile);
    assert.equal(coords, null);
  });
});

describe('Client-Side Image Compression Service', () => {
  it('IMG-01: compresses 5MB large simulated camera photo to <= 150 KB Base64', async () => {
    // 5MB simulated raw camera photo
    const size5MB = 5 * 1024 * 1024;
    const rawBuf = Buffer.alloc(size5MB, 0xBB);
    rawBuf[0] = 0xFF; rawBuf[1] = 0xD8;
    rawBuf[rawBuf.length - 2] = 0xFF; rawBuf[rawBuf.length - 1] = 0xD9;

    const file5MB = new File([rawBuf], 'raw_selfie_5mb.jpg', { type: 'image/jpeg' });
    assert.equal(file5MB.size, size5MB);

    const result = await compressPhoto(file5MB);

    // Invariant assertions
    assert.ok(result.base64.startsWith('data:image/jpeg;base64,'), 'Must be a JPEG Data URL');
    assert.equal(result.mimeType, 'image/jpeg');
    assert.equal(result.sizeBytes, result.base64.length, 'sizeBytes must equal base64 string length');
    assert.ok(
      result.sizeBytes <= MAX_COMPRESSED_BASE64_BYTES,
      `Output size ${result.sizeBytes} exceeds 150 KB (${MAX_COMPRESSED_BASE64_BYTES})`
    );

    const decodedBytes = getBase64ByteLength(result.base64);
    assert.ok(
      decodedBytes <= 150 * 1024,
      `Decoded binary bytes ${decodedBytes} exceeds 150 KB`
    );
  });

  it('IMG-02: compresses 10MB ultra-high resolution photo to <= 150 KB Base64', async () => {
    // 10MB simulated raw camera photo
    const size10MB = 10 * 1024 * 1024;
    const rawBuf = Buffer.alloc(size10MB, 0xCC);
    rawBuf[0] = 0xFF; rawBuf[1] = 0xD8;
    rawBuf[rawBuf.length - 2] = 0xFF; rawBuf[rawBuf.length - 1] = 0xD9;

    const file10MB = new File([rawBuf], 'raw_selfie_10mb.jpg', { type: 'image/jpeg' });
    assert.equal(file10MB.size, size10MB);

    const result = await compressPhoto(file10MB);

    assert.ok(result.base64.startsWith('data:image/jpeg;base64,'));
    assert.ok(
      result.sizeBytes <= MAX_COMPRESSED_BASE64_BYTES,
      `10MB output size ${result.sizeBytes} must be <= 150 KB`
    );
  });

  it('IMG-03: handles small already-compressed image', async () => {
    const size30KB = 30 * 1024;
    const buf = Buffer.alloc(size30KB, 0xDD);
    buf[0] = 0xFF; buf[1] = 0xD8;
    buf[buf.length - 2] = 0xFF; buf[buf.length - 1] = 0xD9;

    const file = new File([buf], 'small.jpg', { type: 'image/jpeg' });
    const result = await compressPhoto(file);

    assert.ok(result.sizeBytes <= MAX_COMPRESSED_BASE64_BYTES);
    assert.equal(result.mimeType, 'image/jpeg');
  });

  it('IMG-04: rejects empty (0-byte) file with descriptive error', async () => {
    const emptyFile = new File([], 'empty.jpg', { type: 'image/jpeg' });
    await assert.rejects(
      async () => {
        await compressPhoto(emptyFile);
      },
      /Invalid photo/
    );
  });

  it('UTIL-01: formatBytes formats byte counts cleanly', () => {
    assert.equal(formatBytes(0), '0 Bytes');
    assert.equal(formatBytes(1024), '1 KB');
    assert.equal(formatBytes(153600), '150 KB');
  });
});
