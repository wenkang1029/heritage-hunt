import { INVARIANTS } from './contracts.ts';

/**
 * Calculates the decoded byte size of a Base64 string (including data URI prefix stripping).
 */
export function getBase64ByteLength(base64String: string): number {
  if (!base64String) return 0;

  // Strip data URL prefix if present
  const pureBase64 = base64String.includes(',')
    ? base64String.split(',')[1]
    : base64String;

  if (!pureBase64) return 0;

  // Base64 decoding byte calculation: 4 chars -> 3 bytes
  const len = pureBase64.length;
  let padding = 0;
  if (pureBase64.endsWith('==')) {
    padding = 2;
  } else if (pureBase64.endsWith('=')) {
    padding = 1;
  }

  return Math.floor((len * 3) / 4) - padding;
}

/**
 * Validates if the Base64 image is within the 150 KB ceiling.
 */
export function isWithinCompressionCeiling(base64String: string): boolean {
  const bytes = getBase64ByteLength(base64String);
  return bytes <= INVARIANTS.MAX_IMAGE_BASE64_BYTES;
}

/**
 * Generates a synthetic Base64 data URL string representing an image of approx targetSizeBytes.
 */
export function generateSyntheticBase64Image(
  targetSizeBytes: number,
  mimeType: string = 'image/jpeg'
): string {
  // A standard JPEG header in Base64: /9j/4AAQSkZJRgABAQEASABIAAD...
  const header = `data:${mimeType};base64,`;

  // Calculate required payload characters (4 chars for each 3 bytes)
  const payloadCharsNeeded = Math.ceil((targetSizeBytes * 4) / 3);
  const base64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

  let payload = '/9j/4AAQSkZJRg'; // simulated JPEG SOI + JFIF
  while (payload.length < payloadCharsNeeded) {
    payload += base64Chars.slice(0, Math.min(64, payloadCharsNeeded - payload.length));
  }

  // Pad to multiple of 4
  while (payload.length % 4 !== 0) {
    payload += '=';
  }

  return header + payload;
}

/**
 * Simulated client-side canvas compression function following ARCHITECTURE §2 / §4:
 * Compresses an input file / synthetic image down to <= 150 KB.
 */
export async function simulateCompressImage(
  rawSizeBytes: number,
  mimeType: string = 'image/jpeg'
): Promise<{
  base64: string;
  sizeBytes: number;
  mimeType: string;
  dimensions: { width: number; height: number };
}> {
  // If already <= 150KB, compress slightly with quality 65%
  // If large (e.g. 5MB raw), scale to max 1024px width and 65% quality, producing ~90KB-140KB
  let targetBytes: number;
  if (rawSizeBytes <= INVARIANTS.MAX_IMAGE_BASE64_BYTES) {
    targetBytes = Math.min(rawSizeBytes, 120 * 1024);
  } else {
    // Compress multi-megabyte image to ~110 KB - 140 KB
    targetBytes = Math.floor(100 * 1024 + (rawSizeBytes % 40) * 1024);
  }

  const base64 = generateSyntheticBase64Image(targetBytes, mimeType);
  const sizeBytes = getBase64ByteLength(base64);

  return {
    base64,
    sizeBytes,
    mimeType,
    dimensions: {
      width: Math.min(1024, 1920),
      height: Math.min(768, 1080),
    },
  };
}
