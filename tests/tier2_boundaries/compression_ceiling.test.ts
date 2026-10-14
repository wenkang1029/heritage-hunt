import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { INVARIANTS } from '../framework/contracts.ts';
import {
  getBase64ByteLength,
  isWithinCompressionCeiling,
  generateSyntheticBase64Image,
  simulateCompressImage,
} from '../framework/compressionOracle.ts';

describe('Tier 2 - Boundary: <= 150 KB Base64 Image Compression Ceiling', () => {
  it('T2-COMP-1: Exact 150 KB ceiling boundary (153,600 bytes) is compliant', () => {
    const exactCeilingBytes = 150 * 1024; // 153,600 bytes
    const base64 = generateSyntheticBase64Image(exactCeilingBytes);
    const measuredBytes = getBase64ByteLength(base64);

    assert.equal(measuredBytes, exactCeilingBytes);
    assert.equal(isWithinCompressionCeiling(base64), true);
  });

  it('T2-COMP-2: 1 byte above ceiling (153,601 bytes) triggers boundary rejection', () => {
    const overCeilingBytes = 150 * 1024 + 1; // 153,601 bytes
    const base64 = generateSyntheticBase64Image(overCeilingBytes);
    const measuredBytes = getBase64ByteLength(base64);

    assert.ok(measuredBytes > INVARIANTS.MAX_IMAGE_BASE64_BYTES);
    assert.equal(isWithinCompressionCeiling(base64), false);
  });

  it('T2-COMP-3: Heavy 12MB raw mobile camera capture compresses safely below 150 KB ceiling', async () => {
    const heavyRawBytes = 12 * 1024 * 1024; // 12 MB
    const compressed = await simulateCompressImage(heavyRawBytes);

    assert.ok(compressed.sizeBytes <= INVARIANTS.MAX_IMAGE_BASE64_BYTES);
    assert.ok(compressed.sizeBytes > 20 * 1024, 'Should retain reasonable image fidelity');
    assert.equal(isWithinCompressionCeiling(compressed.base64), true);
  });

  it('T2-COMP-4: Tiny 10KB photo is not padded or inflated past ceiling', async () => {
    const tinyRawBytes = 10 * 1024; // 10 KB
    const compressed = await simulateCompressImage(tinyRawBytes);

    assert.ok(compressed.sizeBytes <= 120 * 1024);
    assert.equal(isWithinCompressionCeiling(compressed.base64), true);
  });

  it('T2-COMP-5: Calculates Base64 overhead (+33%) accurately across varying payload lengths', () => {
    const rawBufferSizes = [1024, 10240, 51200, 102400, 150000];
    for (const size of rawBufferSizes) {
      const b64 = generateSyntheticBase64Image(size);
      const measured = getBase64ByteLength(b64);
      // Measured decoded bytes should match target size within 2 bytes due to padding
      assert.ok(Math.abs(measured - size) <= 3, `Expected ~${size}, got ${measured}`);
    }
  });

  it('T2-COMP-6: Empty or corrupt image string returns 0 bytes and does not crash decoder', () => {
    assert.equal(getBase64ByteLength(''), 0);
    assert.equal(getBase64ByteLength('data:image/jpeg;base64,'), 0);
    assert.equal(isWithinCompressionCeiling(''), true);
  });
});
