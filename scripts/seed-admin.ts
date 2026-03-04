/**
 * 管理者アカウント作成スクリプト
 *
 * 使い方:
 *   npx tsx scripts/seed-admin.ts
 *
 * 事前準備:
 *   - .env.local に Firebase Admin SDK の環境変数を設定
 *   - Firebase Authenticationが有効であること
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(
  /\\n/g,
  '\n'
);

if (!projectId || !clientEmail || !privateKey) {
  console.error('Firebase Admin SDK の環境変数が不足しています');
  process.exit(1);
}

const app = initializeApp({
  credential: cert({ projectId, clientEmail, privateKey }),
  projectId,
});

const auth = getAuth(app);
const db = getFirestore(app);

async function seedAdmin() {
  const adminEmail = 'admin@example.com';
  const adminPassword = 'admin123456';

  try {
    // Firebase Auth にユーザー作成
    let userRecord;
    try {
      userRecord = await auth.getUserByEmail(adminEmail);
      console.log(`既存の管理者ユーザーを使用: ${userRecord.uid}`);
    } catch {
      userRecord = await auth.createUser({
        email: adminEmail,
        password: adminPassword,
        displayName: '管理者',
      });
      console.log(`管理者ユーザーを作成: ${userRecord.uid}`);
    }

    // カスタムクレームでロール設定
    await auth.setCustomUserClaims(userRecord.uid, { role: 'admin' });
    console.log('カスタムクレーム設定完了: role=admin');

    // Firestore にユーザードキュメント作成
    await db
      .collection('users')
      .doc(userRecord.uid)
      .set(
        {
          email: adminEmail,
          displayName: '管理者',
          role: 'admin',
          department: '管理部',
          annualLeaveBalance: 20,
          isActive: true,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    console.log('Firestoreドキュメント作成完了');

    console.log('\n--- 管理者アカウント情報 ---');
    console.log(`メール: ${adminEmail}`);
    console.log(`パスワード: ${adminPassword}`);
    console.log(`UID: ${userRecord.uid}`);
    console.log('ロール: admin');
  } catch (error) {
    console.error('エラー:', error);
    process.exit(1);
  }
}

async function seedWorkers() {
  const workers = [
    { email: 'tanaka@example.com', name: '田中 太郎', department: '建設部' },
    { email: 'sato@example.com', name: '佐藤 花子', department: '建設部' },
    { email: 'suzuki@example.com', name: '鈴木 一郎', department: '設備部' },
    { email: 'yamada@example.com', name: '山田 次郎', department: '設備部' },
  ];

  for (const worker of workers) {
    try {
      let userRecord;
      try {
        userRecord = await auth.getUserByEmail(worker.email);
        console.log(`既存の作業員を使用: ${worker.name} (${userRecord.uid})`);
      } catch {
        userRecord = await auth.createUser({
          email: worker.email,
          password: 'worker123456',
          displayName: worker.name,
        });
        console.log(`作業員を作成: ${worker.name} (${userRecord.uid})`);
      }

      await auth.setCustomUserClaims(userRecord.uid, { role: 'worker' });

      await db
        .collection('users')
        .doc(userRecord.uid)
        .set(
          {
            email: worker.email,
            displayName: worker.name,
            role: 'worker',
            department: worker.department,
            annualLeaveBalance: 20,
            isActive: true,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
    } catch (error) {
      console.error(`${worker.name}の作成エラー:`, error);
    }
  }

  console.log('\nテスト作業員の作成完了');
}

async function main() {
  console.log('=== 初期データ投入開始 ===\n');
  await seedAdmin();
  console.log('');
  await seedWorkers();
  console.log('\n=== 初期データ投入完了 ===');
  process.exit(0);
}

main();
