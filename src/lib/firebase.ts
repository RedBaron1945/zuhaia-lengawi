import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// Your web app's Firebase configuration provided by user
export const firebaseConfig = {
  apiKey: "AIzaSyDuRXRbI8Qwj7rYllCwhVEJOeqEm3cqnro",
  authDomain: "zuhaia-lengawi.firebaseapp.com",
  projectId: "zuhaia-lengawi",
  storageBucket: "zuhaia-lengawi.firebasestorage.app",
  messagingSenderId: "926937604159",
  appId: "1:926937604159:web:56bfbcf376e7d6a8cd988a"
};

// Initialize Firebase app singleton
export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialize Firestore & Auth
export const db = getFirestore(app);
export const auth = getAuth(app);
