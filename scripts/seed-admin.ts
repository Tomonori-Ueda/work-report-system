/**
 * テストアカウント作成スクリプト（6ランク対応）
 *
 * 使い方:
 *   npx tsx scripts/seed-admin.ts
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');

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

interface Account {
  email: string;
  password: string;
  displayName: string;
  role: string;
  department: string;
  hireDate: string;
  monthlySalary: number;
}

const ACCOUNTS: Account[] = [
  // 社長（S）
  {
    email: 'president@daishin.test',
    password: 'Test1234!',
    displayName: '社長 テスト',
    role: 'S',
    department: '経営',
    hireDate: '2000-04-01',
    monthlySalary: 800000,
  },
  // 専務（A）
  {
    email: 'director@daishin.test',
    password: 'Test1234!',
    displayName: '専務 テスト',
    role: 'A',
    department: '経営',
    hireDate: '2005-04-01',
    monthlySalary: 600000,
  },
  // 総務部長（A_special）
  {
    email: 'general-affairs@daishin.test',
    password: 'Test1234!',
    displayName: '総務部長 テスト',
    role: 'A_special',
    department: '総務',
    hireDate: '2010-04-01',
    monthlySalary: 450000,
  },
  // 施工部長（B）
  {
    email: 'construction-manager@daishin.test',
    password: 'Test1234!',
    displayName: '施工部長 テスト',
    role: 'B',
    department: '施工',
    hireDate: '2008-04-01',
    monthlySalary: 500000,
  },
  // 現場監督（G）
  {
    email: 'supervisor@daishin.test',
    password: 'Test1234!',
    displayName: '横山 憲章',
    role: 'G',
    department: '施工',
    hireDate: '2015-04-01',
    monthlySalary: 380000,
  },
  // 作業員（general）
  {
    email: 'worker@daishin.test',
    password: 'Test1234!',
    displayName: '田中 太郎',
    role: 'general',
    department: '施工',
    hireDate: '2020-04-01',
    monthlySalary: 280000,
  },
];

async function upsertAccount(account: Account): Promise<void> {
  let uid: string;

  try {
    const existing = await auth.getUserByEmail(account.email);
    uid = existing.uid;
    await auth.updateUser(uid, {
      displayName: account.displayName,
      password: account.password,
    });
    console.log(`  更新: ${account.email}`);
  } catch {
    const created = await auth.createUser({
      email: account.email,
      password: account.password,
      displayName: account.displayName,
    });
    uid = created.uid;
    console.log(`  作成: ${account.email}`);
  }

  // カスタムクレームにロールをセット
  await auth.setCustomUserClaims(uid, { role: account.role });

  // Firestoreにupsert
  await db.collection('users').doc(uid).set(
    {
      email: account.email,
      displayName: account.displayName,
      role: account.role,
      department: account.department,
      annualLeaveBalance: 10,
      hireDate: account.hireDate,
      monthlySalary: account.monthlySalary,
      isActive: true,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

async function main(): Promise<void> {
  console.log('=== テストアカウント作成開始 ===\n');

  for (const account of ACCOUNTS) {
    await upsertAccount(account);
  }

  console.log('\n=== 完了 ===\n');
  console.log('ログイン情報:');
  console.log('');
  console.log('【管理者系】');
  console.log('  社長（S）    : president@daishin.test       / Test1234!');
  console.log('  専務（A）    : director@daishin.test        / Test1234!');
  console.log('  総務部長（A_special）: general-affairs@daishin.test / Test1234!');
  console.log('  施工部長（B）: construction-manager@daishin.test / Test1234!');
  console.log('');
  console.log('【現場系】');
  console.log('  現場監督（G）: supervisor@daishin.test      / Test1234!');
  console.log('  作業員（general）: worker@daishin.test      / Test1234!');
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
