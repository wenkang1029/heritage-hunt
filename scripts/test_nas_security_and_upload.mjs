/**
 * Melaka Heritage Hunt - NAS Security & Photo Upload Verification Test
 * Path: scripts/test_nas_security_and_upload.mjs
 *
 * Runs comprehensive verification:
 * 1. Security Test: Magic byte validation (passes valid image, rejects disguised text/executables)
 * 2. Security Test: Stored XSS defense (rejects SVG / HTML payloads)
 * 3. Security Test: Filename sanitization & path traversal immunity
 * 4. Security Test: SSRF prevention for download proxy
 * 5. Live NAS Upload Test: Uploads 1 photo from raw_photos/ and verifies online accessibility
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Load environment variables from .env.local
try {
  const envPath = path.resolve(projectRoot, '.env.local');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim();
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
} catch (err) {
  console.warn('Could not read .env.local:', err.message);
}

// Import server security modules
const {
  validateMagicBytes,
  generateSafeFileName,
  validateDownloadTarget,
  MAX_FILE_SIZE_BYTES,
} = await import('../server/security.ts');
const { XinyaClient } = await import('../server/xinyaClient.ts');

console.log('='.repeat(70));
console.log('🛡️ MELAKA HERITAGE HUNT - NAS SECURITY & UPLOAD TEST SUITE');
console.log('='.repeat(70));

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
  }
}

// ============================================================================
// PART 1: SECURITY GUARDRAILS VERIFICATION
// ============================================================================
console.log('\n[Suite 1: Security Defenses & Input Sanitization]');

// 1.1 Valid JPEG
const rawPhotoPath = path.resolve(projectRoot, 'raw_photos', 'IMG_9264.jpeg');
let rawJpegBuffer;
if (fs.existsSync(rawPhotoPath)) {
  rawJpegBuffer = fs.readFileSync(rawPhotoPath);
  const jpegCheck = validateMagicBytes(rawJpegBuffer);
  assert(jpegCheck.valid && jpegCheck.extension === 'jpg', 'Valid raw JPEG recognized via magic bytes (FF D8 FF)');
} else {
  console.log('  ⚠️ Warning: raw_photos/IMG_9264.jpeg not found, creating dummy JPEG buffer.');
  rawJpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
  const jpegCheck = validateMagicBytes(rawJpegBuffer);
  assert(jpegCheck.valid && jpegCheck.extension === 'jpg', 'Valid JPEG magic bytes recognized');
}

// 1.2 Spoofed / fake image (plain text named as image)
const fakeImage = Buffer.from('This is a text file claiming to be an image. Execute malicious code.');
const fakeCheck = validateMagicBytes(fakeImage);
assert(!fakeCheck.valid, 'Disguised fake image rejected by magic bytes');

// 1.3 Stored XSS defense (SVG with embedded JavaScript)
const xssSvg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(document.cookie)</script></svg>');
const xssCheck = validateMagicBytes(xssSvg);
assert(!xssCheck.valid && xssCheck.error?.includes('XSS'), 'SVG script payload blocked to prevent Stored XSS');

// 1.4 Path Traversal & Collision Defense
const safeName = generateSafeFileName({
  gameId: '../../system32/cmd',
  teamId: 'red/../../../etc',
  clueId: 'clue#999?*!',
  extension: 'jpg',
});
assert(
  !safeName.includes('..') && !safeName.includes('/') && !safeName.includes('\\') && safeName.endsWith('.jpg'),
  `Path traversal filtered: generated safe filename "${safeName}"`
);

// 1.5 SSRF Prevention for Download Proxy
const ssrfAttack1 = validateDownloadTarget('http://169.254.169.254/latest/meta-data/');
assert(!ssrfAttack1.valid, 'SSRF cloud metadata endpoint blocked');

const ssrfAttack2 = validateDownloadTarget('http://localhost:5006/media/upload_media');
assert(!ssrfAttack2.valid, 'SSRF internal localhost endpoint blocked');

const ssrfAttack3 = validateDownloadTarget('https://evil-hacker.com/UTBA/media_file/NAS/UTBA/event_photo/1/a.jpg');
assert(!ssrfAttack3.valid, 'SSRF untrusted third-party domain blocked');

const validDownload = validateDownloadTarget('https://utba.my/UTBA/media_file/NAS/UTBA/event_photo/HERITAGE2026/team1_test.jpg');
assert(validDownload.valid, 'Authorized utba.my media file path accepted by SSRF filter');

// ============================================================================
// PART 2: LIVE NAS INTEGRATION TEST
// ============================================================================
console.log('\n[Suite 2: Live Xinya NAS API Integration]');

const client = new XinyaClient();
const isConfigured = client.isConfigured();

console.log(`  Config Status: ${isConfigured ? '🟢 Credentials Configured' : '🟡 Credentials Not Provided'}`);
console.log(`  Target Base URL: https://utba.my/UTBA`);
console.log(`  Default Event ID: ${client.defaultEventId || '(none)'}`);
console.log(`  Default Event Code: ${client.defaultEventCode}`);

if (!isConfigured) {
  console.log('\n  ℹ️ Live upload skipped: XINYA_USERNAME, XINYA_PASSWORD, or XINYA_EVENT_ID not set.');
  console.log('     To run live upload testing, add the following to your .env.local:');
  console.log('       XINYA_USERNAME=your_account');
  console.log('       XINYA_PASSWORD=your_password');
  console.log('       XINYA_EVENT_ID=123');
  console.log('       XINYA_EVENT_CODE=HERITAGE2026\n');
} else {
  try {
    console.log('\n  🔄 Authenticating with Xinya API...');
    const token = await client.getValidAccessToken();
    assert(typeof token === 'string' && token.length > 20, 'Successfully obtained authenticated Bearer session token');

    console.log(`\n  📸 Preparing sample photo from raw_photos (${(rawJpegBuffer.length / (1024 * 1024)).toFixed(2)} MB)...`);
    const testFileName = generateSafeFileName({
      gameId: 'test_game',
      teamId: 'test_team',
      clueId: 'test_clue',
      extension: 'jpg',
    });

    console.log(`  📤 Uploading test photo: ${testFileName} to event_id: ${client.defaultEventId}...`);
    const uploadResult = await client.uploadPhoto({
      fileBuffer: rawJpegBuffer,
      fileName: testFileName,
      mimeType: 'image/jpeg',
    });

    assert(uploadResult.status === 'success', `Photo uploaded successfully! ID: ${uploadResult.fileId}`);
    assert(Boolean(uploadResult.photoUrl), `Public photo URL generated: ${uploadResult.photoUrl}`);

    // Verify online accessibility of uploaded photo
    console.log(`  🌐 Verifying online accessibility of uploaded photo...`);
    const checkRes = await fetch(uploadResult.photoUrl);
    assert(checkRes.status === 200, `Uploaded photo is live and accessible via GET (HTTP ${checkRes.status})`);

    // Verify proxy download
    console.log(`  📥 Verifying proxy download logic...`);
    const downloadCheck = validateDownloadTarget(uploadResult.photoUrl);
    assert(downloadCheck.valid, 'Uploaded photo URL passes SSRF proxy validation');

    console.log('\n  📝 Upload Summary:');
    console.log(`     - File ID: ${uploadResult.fileId}`);
    console.log(`     - Filename: ${uploadResult.fileName}`);
    console.log(`     - Photo URL: ${uploadResult.photoUrl}`);
    console.log(`     - Size: ${(rawJpegBuffer.length / 1024).toFixed(1)} KB (Full uncompressed quality preserved)`);
  } catch (liveErr) {
    console.error('  ❌ Live upload error:', liveErr.message);
    totalTests++;
  }
}

console.log('\n' + '='.repeat(70));
console.log(`📊 TEST RESULTS: ${passedTests}/${totalTests} tests passed (${Math.round((passedTests / totalTests) * 100)}%)`);
console.log('='.repeat(70));

process.exit(passedTests === totalTests ? 0 : 1);
