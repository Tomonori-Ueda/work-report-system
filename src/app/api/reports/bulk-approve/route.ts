import 'server-only';

import { type NextRequest } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/firebase/api-auth';
import {
  successResponse,
  unauthorizedResponse,
  forbiddenResponse,
  serverErrorResponse,
  errorResponse,
} from '@/lib/utils/api-response';
import { bulkApproveSchema } from '@/lib/validations/report';
import { REPORT_STATUS } from '@/types/report';
import { USER_ROLE } from '@/types/user';

/** Firestoreバッチ書き込みの最大件数 */
const BATCH_LIMIT = 500;

/** POST /api/reports/bulk-approve - 日報を一括承認 */
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();
    if (auth.role !== USER_ROLE.ADMIN) return forbiddenResponse();

    const body: unknown = await request.json();
    const parsed = bulkApproveSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(
        'VALIDATION_ERROR',
        parsed.error.issues[0]?.message ?? '承認する日報を選択してください',
        400
      );
    }

    const { reportIds } = parsed.data;
    const db = getAdminDb();
    let approvedCount = 0;
    const failedIds: string[] = [];

    // 承認者名を取得
    const adminDoc = await db.collection('users').doc(auth.uid).get();
    const adminName = (adminDoc.data()?.displayName as string) ?? '不明';

    // バッチ処理（500件ずつ）
    for (let i = 0; i < reportIds.length; i += BATCH_LIMIT) {
      const chunk = reportIds.slice(i, i + BATCH_LIMIT);
      const batch = db.batch();

      for (const reportId of chunk) {
        const docRef = db.collection('daily_reports').doc(reportId);
        const doc = await docRef.get();

        if (!doc.exists || doc.data()?.status !== REPORT_STATUS.SUBMITTED) {
          failedIds.push(reportId);
          continue;
        }

        batch.update(docRef, {
          status: REPORT_STATUS.APPROVED,
          approvedBy: auth.uid,
          approvedByName: adminName,
          approvedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        approvedCount++;
      }

      await batch.commit();
    }

    return successResponse({ approvedCount, failedIds });
  } catch (error) {
    console.error('一括承認エラー:', error);
    return serverErrorResponse();
  }
}
