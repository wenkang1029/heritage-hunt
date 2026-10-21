import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import exifr from 'exifr';
import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  writeBatch
} from 'firebase/firestore';

const RAW_PHOTOS_DIR = 'C:\\Users\\User\\Projects\\heritage-hunt\\raw_photos';
const GAME_ID = 'hunt-nkvcz';

function loadEnv() {
  const envPath = fs.existsSync('.env.local') ? '.env.local' : '.env';
  if (!fs.existsSync(envPath)) return process.env;
  const content = fs.readFileSync(envPath, 'utf8');
  const env = { ...process.env };
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq > 0) {
      env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
    }
  }
  return env;
}

const env = loadEnv();
const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Complete Catalog of all 121 Clues (Chinese) loaded directly from src/data/cluesZh.json
const cluesZhPath = path.resolve('src/data/cluesZh.json');
const CLUES_CATALOG = JSON.parse(fs.readFileSync(cluesZhPath, 'utf8'));

async function compressImage(filePath) {
  let buffer = await sharp(filePath)
    .rotate()
    .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 65, mozjpeg: true })
    .toBuffer();

  let base64 = `data:image/jpeg;base64,${buffer.toString('base64')}`;

  if (base64.length > 115000) {
    buffer = await sharp(filePath)
      .rotate()
      .resize(700, 700, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 50, mozjpeg: true })
      .toBuffer();
    base64 = `data:image/jpeg;base64,${buffer.toString('base64')}`;
  }

  return base64;
}

async function main() {
  console.log(`Starting processing for ${CLUES_CATALOG.length} clues...`);

  // Step 1: Connect to Firestore and inspect current clues
  const cluesCollection = collection(db, `games/${GAME_ID}/clues`);
  const snapshot = await getDocs(cluesCollection);
  console.log(`Found ${snapshot.docs.length} existing documents in games/${GAME_ID}/clues.`);

  // Step 2: Delete existing mock / placeholder clues
  if (snapshot.docs.length > 0) {
    console.log(`Deleting ${snapshot.docs.length} old documents...`);
    const deleteBatchSize = 100;
    for (let i = 0; i < snapshot.docs.length; i += deleteBatchSize) {
      const batch = writeBatch(db);
      const chunk = snapshot.docs.slice(i, i + deleteBatchSize);
      for (const d of chunk) {
        batch.delete(d.ref);
      }
      await batch.commit();
      console.log(`Deleted batch of ${chunk.length} documents.`);
    }
    console.log(`Completed deleting old documents.`);
  }

  // Step 3: Process all 121 photos, extract GPS, compress, and prepare docs
  const cluesToUpload = [];

  for (let i = 0; i < CLUES_CATALOG.length; i++) {
    const clueMeta = CLUES_CATALOG[i];
    const filePath = path.join(RAW_PHOTOS_DIR, clueMeta.file);

    if (!fs.existsSync(filePath)) {
      console.error(`Error: File not found: ${filePath}`);
      continue;
    }

    // Extract EXIF GPS
    const gps = await exifr.gps(filePath);
    if (!gps || !gps.latitude || !gps.longitude) {
      console.error(`Missing GPS for: ${clueMeta.file}`);
      continue;
    }

    // Compress to <120KB Base64 data URL
    const targetPhotoBase64 = await compressImage(filePath);
    const sizeKB = Math.round(targetPhotoBase64.length / 1024);

    const docId = `clue-${String(i + 1).padStart(3, '0')}`;

    const clueDoc = {
      id: docId,
      gameId: GAME_ID,
      zoneId: clueMeta.zoneId,
      title: clueMeta.title,
      landmarkName: clueMeta.landmarkName,
      description: clueMeta.description,
      hint: clueMeta.hint,
      points: clueMeta.points,
      targetPhotoBase64,
      location: {
        latitude: gps.latitude,
        longitude: gps.longitude
      },
      radiusMeters: clueMeta.radiusMeters,
      difficulty: clueMeta.difficulty,
      order: i + 1,
      createdAt: Date.now()
    };

    cluesToUpload.push(clueDoc);
    if ((i + 1) % 20 === 0 || i === CLUES_CATALOG.length - 1) {
      console.log(`Prepared ${i + 1}/${CLUES_CATALOG.length} clues. Clue ${docId}: "${clueMeta.title}" (${sizeKB} KB)`);
    }
  }

  console.log(`\nSuccessfully prepared ${cluesToUpload.length} clues.`);

  // Step 4: Batch write to Firestore in chunks of 20
  console.log(`\nBatch-writing ${cluesToUpload.length} clues to games/${GAME_ID}/clues...`);
  const chunkSize = 20;
  for (let i = 0; i < cluesToUpload.length; i += chunkSize) {
    const batch = writeBatch(db);
    const chunk = cluesToUpload.slice(i, i + chunkSize);
    for (const c of chunk) {
      const docRef = doc(db, `games/${GAME_ID}/clues/${c.id}`);
      batch.set(docRef, c);
    }
    await batch.commit();
    console.log(`Uploaded batch ${Math.floor(i / chunkSize) + 1}/${Math.ceil(cluesToUpload.length / chunkSize)} (${chunk.length} clues)`);
  }

  // Step 5: Verification query
  console.log(`\nVerifying uploaded clues in Firestore...`);
  const verifySnap = await getDocs(cluesCollection);
  console.log(`Verified Total Documents in games/${GAME_ID}/clues: ${verifySnap.docs.length}`);

  const zoneCounts = {};
  let totalBase64Bytes = 0;
  let maxBase64Bytes = 0;
  let minBase64Bytes = Infinity;

  verifySnap.docs.forEach((d) => {
    const data = d.data();
    zoneCounts[data.zoneId] = (zoneCounts[data.zoneId] || 0) + 1;
    const len = data.targetPhotoBase64?.length || 0;
    totalBase64Bytes += len;
    if (len > maxBase64Bytes) maxBase64Bytes = len;
    if (len < minBase64Bytes) minBase64Bytes = len;
  });

  const avgKB = Math.round((totalBase64Bytes / verifySnap.docs.length) / 1024);
  const maxKB = Math.round(maxBase64Bytes / 1024);
  const minKB = Math.round(minBase64Bytes / 1024);

  console.log('Zone breakdown:');
  console.log(JSON.stringify(zoneCounts, null, 2));
  console.log(`Base64 sizes: Min = ${minKB} KB, Avg = ${avgKB} KB, Max = ${maxKB} KB (Limit: 120 KB)`);

  const summary = {
    totalUploaded: verifySnap.docs.length,
    gameId: GAME_ID,
    zoneCounts,
    avgPhotoKB: avgKB,
    maxPhotoKB: maxKB,
    minPhotoKB: minKB,
    allUnder120KB: maxKB < 120,
    timestamp: new Date().toISOString()
  };

  fs.writeFileSync(
    path.join(process.cwd(), 'scripts', 'upload_summary.json'),
    JSON.stringify(summary, null, 2)
  );
  console.log('Summary saved to scripts/upload_summary.json');
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error during execution:', err);
  process.exit(1);
});
