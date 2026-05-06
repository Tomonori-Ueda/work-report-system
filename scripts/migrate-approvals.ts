/**
 * 4枠承認データへのマイグレーションスクリプト
 *
 * 目的:
 * - 既存の users ドキュメントに executiveTitle が無い場合、role から推定して埋める
 * - 既存の daily_reports ドキュメントに approvals が無い場合、空 approvals を初期化
 *   （既存の checkedBy / approvedBy があれば該当 slot に押印として復元）
 *
 * 使い方:
 *   npx tsx scripts/migrate-approvals.ts
 *   （--dry を付けると書き込みをスキップして件数のみ表示）
 */

import { initializeApp, cert } from 'firebase-admin/app';
import {
  getFirestore,
  FieldValue,
  type Firestore,
  type Timestamp,
} from 'firebase-admin/firestore';
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

const db = getFirestore(app);
const isDryRun = process.argv.includes('--dry');

/** ロール → 役職タイトルの推定マップ（複数該当しうる A は executive にフォールバック） */
function inferExecutiveTitle(role: string): string | null {
  switch (role) {
    case 'S':
      return 'president';
    case 'A':
      return 'executive'; // 専務扱い。常務に変更したいユーザーは画面から修正
    case 'B':
      return 'construction_manager';
    default:
      return null;
  }
}

interface UserMini {
  id: string;
  displayName: string;
  role: string;
  executiveTitle: string | null | undefined;
}

async function migrateUsers(): Promise<Map<string, UserMini>> {
  console.log('--- users マイグレーション ---');
  const snap = await db.collection('users').get();
  const users = new Map<string, UserMini>();
  let updated = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    const role = (data.role as string) ?? 'general';
    const existing = data.executiveTitle as string | null | undefined;
    const inferred = inferExecutiveTitle(role);

    users.set(doc.id, {
      id: doc.id,
      displayName: (data.displayName as string) ?? '不明',
      role,
      executiveTitle: existing ?? inferred,
    });

    // executiveTitle 未設定で推定値が決まる場合のみ更新
    if (existing === undefined && inferred !== null) {
      if (!isDryRun) {
        await doc.ref.update({
          executiveTitle: inferred,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
      updated++;
      console.log(`  ${data.email ?? doc.id} (${role}) → ${inferred}`);
    }
  }
  console.log(`users 更新: ${updated}件 (${isDryRun ? 'DRY RUN' : '反映済み'})\n`);
  return users;
}

async function migrateReports(users: Map<string, UserMini>): Promise<void> {
  console.log('--- daily_reports マイグレーション ---');
  const snap = await db.collection('daily_reports').get();
  let updated = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    if (data.approvals && typeof data.approvals === 'object') {
      continue; // 既に approvals あり → スキップ
    }

    // 空 approvals を作って、既存の checkedBy/approvedBy を該当 slot に復元
    const approvals: Record<string, unknown> = {
      construction_manager: null,
      managing: null,
      executive: null,
      president: null,
    };

    const checkedBy = data.checkedBy as string | null | undefined;
    const checkedAt = data.checkedAt as Timestamp | null | undefined;
    if (checkedBy && checkedAt) {
      const u = users.get(checkedBy);
      approvals.construction_manager = {
        uid: checkedBy,
        displayName: u?.displayName ?? '不明',
        approvedAt: checkedAt,
      };
    }

    const approvedBy = data.approvedBy as string | null | undefined;
    const approvedAt = data.approvedAt as Timestamp | null | undefined;
    if (approvedBy && approvedAt) {
      const u = users.get(approvedBy);
      const slot =
        u?.role === 'S'
          ? 'president'
          : u?.role === 'A'
            ? u.executiveTitle === 'managing'
              ? 'managing'
              : 'executive'
            : 'president'; // 不明な場合は社長扱い（最終承認）
      approvals[slot] = {
        uid: approvedBy,
        displayName: u?.displayName ?? data.approvedByName ?? '不明',
        approvedAt,
      };
    }

    if (!isDryRun) {
      await doc.ref.update({
        approvals,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    updated++;
  }
  console.log(`daily_reports 更新: ${updated}件 (${isDryRun ? 'DRY RUN' : '反映済み'})\n`);
}

async function main(): Promise<void> {
  console.log(`=== 4枠承認マイグレーション ${isDryRun ? '(DRY RUN)' : ''} ===\n`);
  const users = await migrateUsers();
  await migrateReports(users);
  console.log('=== 完了 ===');
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

// db を _ で始まる lint 抑制目的に明示利用する必要がない場合は不要だが、
// 型チェックで未使用シンボル扱いを避けるため Firestore 型を import している
export type _Firestore = Firestore;
