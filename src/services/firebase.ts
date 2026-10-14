/**
 * Melaka Heritage Hunt - Firebase Client & Authentication Service
 * Path: src/services/firebase.ts
 */

import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import {
  initializeFirestore,
  getFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  memoryLocalCache,
  type Firestore,
} from 'firebase/firestore';
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
  type Auth,
  type User,
} from 'firebase/auth';

/**
 * Safely reads environment variables across both Vite browser and Node.js environments.
 */
function getEnvVar(key: string): string | undefined {
  try {
    if (typeof import.meta !== 'undefined' && (import.meta as any)?.env) {
      const val = (import.meta as any).env[key];
      if (typeof val === 'string') return val;
    }
  } catch {
    // Ignore error
  }
  try {
    if (typeof process !== 'undefined' && process.env) {
      const val = process.env[key];
      if (typeof val === 'string') return val;
    }
  } catch {
    // Ignore error
  }
  return undefined;
}

/**
 * Checks whether valid Firebase credentials have been configured in environment variables.
 */
export function isFirebaseConfigured(): boolean {
  const apiKey = getEnvVar('VITE_FIREBASE_API_KEY');
  const projectId = getEnvVar('VITE_FIREBASE_PROJECT_ID');

  return Boolean(
    apiKey &&
    apiKey !== 'your_api_key_here' &&
    apiKey !== '' &&
    projectId &&
    projectId !== 'your_project_id' &&
    projectId !== ''
  );
}

const firebaseConfig = {
  apiKey: getEnvVar('VITE_FIREBASE_API_KEY') || '',
  authDomain: getEnvVar('VITE_FIREBASE_AUTH_DOMAIN') || '',
  projectId: getEnvVar('VITE_FIREBASE_PROJECT_ID') || '',
  storageBucket: getEnvVar('VITE_FIREBASE_STORAGE_BUCKET') || '',
  messagingSenderId: getEnvVar('VITE_FIREBASE_MESSAGING_SENDER_ID') || '',
  appId: getEnvVar('VITE_FIREBASE_APP_ID') || '',
};

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;

if (isFirebaseConfigured()) {
  try {
    app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

    // Initialize Firestore with multi-tab offline persistence
    try {
      db = initializeFirestore(app, {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager(),
        }),
      });
    } catch {
      // Fallback: If initializeFirestore was already called or multi-tab IndexedDB is blocked
      try {
        db = getFirestore(app);
      } catch {
        db = initializeFirestore(app, {
          localCache: memoryLocalCache(),
        });
      }
    }

    auth = getAuth(app);
  } catch (err) {
    console.warn('Firebase initialization failed, falling back to mock mode:', err);
    app = null;
    db = null;
    auth = null;
  }
}

export { app, db, auth };

/**
 * Returns a stable local UID stored in localStorage when running anonymously or offline.
 */
export function getPersistentLocalUid(): string {
  const STORAGE_KEY = 'melaka_hunt_player_uid';
  try {
    let storage: Storage | null = null;
    if (typeof window !== 'undefined' && window.localStorage) {
      storage = window.localStorage;
    } else if (typeof localStorage !== 'undefined') {
      storage = localStorage;
    }

    if (storage) {
      let uid = storage.getItem(STORAGE_KEY);
      if (!uid) {
        uid = `anon_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        storage.setItem(STORAGE_KEY, uid);
      }
      return uid;
    }
  } catch {
    // Ignore storage errors in restricted contexts
  }
  return `anon_temp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Ensures an authenticated session exists using Firebase Anonymous Auth.
 * If Firebase is offline or unconfigured, falls back to a synthetic local UID.
 */
export async function ensureAnonymousAuth(): Promise<User | { uid: string }> {
  if (!auth) {
    return { uid: getPersistentLocalUid() };
  }

  if (auth.currentUser) {
    return auth.currentUser;
  }

  try {
    const cred = await signInAnonymously(auth);
    return cred.user;
  } catch (err) {
    console.warn('Anonymous auth failed, falling back to local UID:', err);
    return { uid: getPersistentLocalUid() };
  }
}

/**
 * Subscribes to auth state changes, returning an unsubscribe callback.
 */
export function subscribeToAuthState(callback: (user: User | null) => void): () => void {
  if (!auth) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(auth, callback);
}
