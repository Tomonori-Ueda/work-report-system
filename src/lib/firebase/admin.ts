import 'server-only';

import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

/** Firebase Admin SDKの初期化（サーバー専用） */
function getAdminApp(): App {
  const existingApps = getApps();
  if (existingApps.length > 0) {
    return existingApps[0]!;
  }

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(
    /\\n/g,
    '\n'
  );

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Firebase Admin SDKの環境変数が設定されていません。' +
        'FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, ' +
        'FIREBASE_ADMIN_PRIVATE_KEY を確認してください。'
    );
  }

  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
    projectId,
  });
}

/** Admin Auth */
export function getAdminAuth(): Auth {
  return getAuth(getAdminApp());
}

/** Admin Firestore */
export function getAdminDb(): Firestore {
  return getFirestore(getAdminApp());
}
