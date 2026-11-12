import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  getFirestore,
  Firestore,
  CACHE_SIZE_UNLIMITED,
} from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';

// Your web app's Firebase configuration provided by user
export const firebaseConfig = {
  apiKey: "AIzaSyDuRXRbI8Qwj7rYllCwhVEJOeqEm3cqnro",
  authDomain: "zuhaia-lengawi.firebaseapp.com",
  projectId: "zuhaia-lengawi",
  storageBucket: "zuhaia-lengawi.firebasestorage.app",
  messagingSenderId: "926937604159",
  appId: "1:926937604159:web:56bfbcf376e7d6a8cd988a",
};

// Initialize Firebase app singleton
export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialize Firestore with persistent multi-tab IndexedDB cache
// This drastically minimizes read operations by serving cached documents locally across tabs & reloads
let firestoreDb: Firestore;
try {
  firestoreDb = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
      cacheSizeBytes: CACHE_SIZE_UNLIMITED,
    }),
    experimentalAutoDetectLongPolling: true,
  });
} catch {
  // Graceful fallback for restricted browser sandbox / private browsing
  firestoreDb = getFirestore(app);
}

export const db = firestoreDb;
export const auth = getAuth(app);

// Silently ensure an active Firebase Auth session so writes are never blocked
if (typeof window !== 'undefined') {
  auth.onAuthStateChanged((user) => {
    if (!user) {
      signInAnonymously(auth).catch(() => {
        // Silently handle if anonymous auth is not enabled in Firebase Console
      });
    }
  });
}
