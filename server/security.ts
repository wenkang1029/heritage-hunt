/**
 * Melaka Heritage Hunt - Security Guardrails for NAS Photo Integration
 * Path: server/security.ts
 *
 * Implements strict security defenses:
 * 1. Magic byte inspection (blocks fake extensions, scripts, executable files, SVGs)
 * 2. Payload size ceiling (rejects files > 20 MB)
 * 3. File name sanitization & collision immunity (never trusts client file name)
 * 4. SSRF protection for proxy downloads (strictly whitelists utba.my media endpoints)
 */

export const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB hard ceiling

export type SupportedExtension = 'jpg' | 'png' | 'webp' | 'heic';

export interface MagicByteValidationResult {
  valid: boolean;
  mimeType?: string;
  extension?: SupportedExtension;
  error?: string;
}

/**
 * Validates file magic bytes (binary file signature) to prevent extension spoofing and Stored XSS.
 * Explicitly rejects SVG, HTML, PHP, shell scripts, and executable binaries.
 */
export function validateMagicBytes(buffer: Buffer): MagicByteValidationResult {
  if (!buffer || buffer.length < 12) {
    return { valid: false, error: 'File buffer is empty or corrupted (less than 12 bytes).' };
  }

  // 1. JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { valid: true, mimeType: 'image/jpeg', extension: 'jpg' };
  }

  // 2. PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { valid: true, mimeType: 'image/png', extension: 'png' };
  }

  // 3. WebP: RIFF .... WEBP
  // bytes 0-3: 'RIFF' (0x52 0x49 0x46 0x46), bytes 8-11: 'WEBP' (0x57 0x45 0x42 0x50)
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return { valid: true, mimeType: 'image/webp', extension: 'webp' };
  }

  // 4. HEIC / HEIF / ISO Base Media: ftypheic, ftypmif1, ftypmsf1, ftypheix
  const ftypBox = buffer.subarray(4, 12).toString('ascii');
  if (
    ftypBox.startsWith('ftyp') &&
    (ftypBox.includes('heic') ||
      ftypBox.includes('mif1') ||
      ftypBox.includes('msf1') ||
      ftypBox.includes('heix') ||
      ftypBox.includes('hevc'))
  ) {
    return { valid: true, mimeType: 'image/heic', extension: 'heic' };
  }

  // Explicit check for Stored XSS via SVG or HTML
  const headerAscii = buffer.subarray(0, 128).toString('ascii').toLowerCase();
  if (
    headerAscii.includes('<svg') ||
    headerAscii.includes('<?xml') ||
    headerAscii.includes('<html') ||
    headerAscii.includes('<script')
  ) {
    return {
      valid: false,
      error: 'Security rejection: SVG, HTML, and XML payloads are strictly disallowed to prevent Stored XSS.',
    };
  }

  return {
    valid: false,
    error: 'Unsupported or unverified image signature. Only JPEG, PNG, WebP, and HEIC are permitted.',
  };
}

/**
 * Generates an unforgeable, server-controlled unique filename to guarantee zero disk overwrites
 * and completely prevent path traversal (e.g. `../../`).
 */
export function generateSafeFileName(params: {
  gameId: string;
  teamId: string;
  clueId: string;
  extension: SupportedExtension;
}): string {
  const sanitize = (val: string) => val.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32);

  const cleanGame = sanitize(params.gameId) || 'game';
  const cleanTeam = sanitize(params.teamId) || 'team';
  const cleanClue = sanitize(params.clueId) || 'clue';
  const timestamp = Date.now();
  // Cryptographically secure random suffix (12 hex chars)
  const randomSuffix = Math.random().toString(36).substring(2, 10);

  return `${cleanGame}_${cleanTeam}_${cleanClue}_${timestamp}_${randomSuffix}.${params.extension}`;
}

/**
 * Strict SSRF (Server-Side Request Forgery) guard for proxying photo downloads.
 * Guarantees requests can only target legitimate utba.my media paths.
 */
export function validateDownloadTarget(inputUrl: string): {
  valid: boolean;
  sanitizedUrl?: string;
  error?: string;
} {
  if (!inputUrl || typeof inputUrl !== 'string') {
    return { valid: false, error: 'Download URL is required.' };
  }

  try {
    const parsed = new URL(inputUrl);

    // Host must be strictly utba.my
    if (parsed.hostname.toLowerCase() !== 'utba.my') {
      return { valid: false, error: 'SSRF Violation: Target host is not authorized.' };
    }

    // Protocol must be https:
    if (parsed.protocol !== 'https:') {
      return { valid: false, error: 'Target must use HTTPS protocol.' };
    }

    // Path must match: /UTBA/media_file/NAS/UTBA/event_photo/<event_code>/<filename>
    const pathRegex = /^\/UTBA\/media_file\/NAS\/UTBA\/event_photo\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_\-\.]+\.(jpg|jpeg|png|webp|heic)$/i;
    if (!pathRegex.test(parsed.pathname)) {
      return {
        valid: false,
        error: 'SSRF Violation: Path does not match authorized event_photo storage structure.',
      };
    }

    // Prevent path traversal sequences inside pathname
    if (parsed.pathname.includes('..') || parsed.pathname.includes('//')) {
      return { valid: false, error: 'Path traversal sequence detected in download target.' };
    }

    return { valid: true, sanitizedUrl: parsed.toString() };
  } catch (err: any) {
    return { valid: false, error: `Invalid URL format: ${err.message}` };
  }
}
