import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
} as const;

/** Firebaseアプリのシングルトン */
export function getFirebaseApp(): FirebaseApp {
  const existingApps = getApps();
  if (existingApps.length > 0) {
    return existingApps[0]!;
  }
  return initializeApp(firebaseConfig);
}

/** Firebase Authのシングルトン */
export function getFirebaseAuth(): Auth {
  return getAuth(getFirebaseApp());
}

/** Firestoreのシングルトン */
export function getFirebaseDb(): Firestore {
  return getFirestore(getFirebaseApp());
}
