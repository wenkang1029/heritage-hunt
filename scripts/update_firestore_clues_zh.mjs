/**
 * Melaka Heritage Hunt - Live Firestore Clues Chinese Translation Updater
 * Path: scripts/update_firestore_clues_zh.mjs
 *
 * Updates all clue titles, landmarkNames, descriptions, and hints in Firestore to Chinese.
 */

import fs from 'fs';
import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  writeBatch
} from 'firebase/firestore';

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

const cluesZhList = JSON.parse(fs.readFileSync('src/data/cluesZh.json', 'utf8'));
const cluesZhMap = {};
for (const c of cluesZhList) {
  cluesZhMap[c.id] = c;
}

async function updateGameClues(gameId) {
  console.log(`\n--- Updating clues for game: ${gameId} ---`);
  const cluesCol = collection(db, `games/${gameId}/clues`);
  const snap = await getDocs(cluesCol);
  console.log(`Found ${snap.docs.length} clues in game ${gameId}`);

  if (snap.docs.length === 0) return;

  const chunkSize = 20;
  for (let i = 0; i < snap.docs.length; i += chunkSize) {
    const batch = writeBatch(db);
    const chunk = snap.docs.slice(i, i + chunkSize);
    let updateCount = 0;

    for (const d of chunk) {
      const clueId = d.id;
      const zh = cluesZhMap[clueId];
      if (zh) {
        const ref = doc(db, `games/${gameId}/clues/${clueId}`);
        batch.update(ref, {
          title: zh.title,
          landmarkName: zh.landmarkName,
          description: zh.description,
          hint: zh.hint
        });
        updateCount++;
      }
    }

    if (updateCount > 0) {
      await batch.commit();
      console.log(`Updated batch ${Math.floor(i / chunkSize) + 1}/${Math.ceil(snap.docs.length / chunkSize)} (${updateCount} clues)`);
    }
  }

  console.log(`Finished updating clues for ${gameId}`);
}

async function main() {
  const gamesSnap = await getDocs(collection(db, 'games'));
  const gameIds = gamesSnap.docs.map(d => d.id);
  console.log('Found games in Firestore:', gameIds);

  for (const gameId of gameIds) {
    await updateGameClues(gameId);
  }

  console.log('\nAll Firestore games successfully updated with Chinese clue names and descriptions!');
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error during Firestore clues update:', err);
  process.exit(1);
});
