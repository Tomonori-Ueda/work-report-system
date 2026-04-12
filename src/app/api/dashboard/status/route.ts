import 'server-only';

import { type NextRequest } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/firebase/api-auth';
import {
  successResponse,
  unauthorizedResponse,
  forbiddenResponse,
  serverErrorResponse,
  errorResponse,
} from '@/lib/utils/api-response';
import { isAdminRole } from '@/types/user';
import { REPORT_STATUS } from '@/types/report';

/** GET /api/dashboard/status - 提出状況サマリを取得 */
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();
    if (!isAdminRole(auth.role)) return forbiddenResponse();

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');

    if (!date) {
      return errorResponse('VALIDATION_ERROR', '日付パラメータが必要です', 400);
    }

    const db = getAdminDb();

    // アクティブな全ユーザーを取得（6ランク対応のため role フィルタ不要）
    const workersSnap = await db
      .collection('users')
      .where('isActive', '==', true)
      .get();

    const allWorkers = workersSnap.docs.map((doc) => ({
      userId: doc.id,
      displayName: (doc.data().displayName as string) ?? '',
    }));

    // 指定日の日報を取得
    const reportsSnap = await db
      .collection('daily_reports')
      .where('reportDate', '==', date)
      .get();

    const reportsByUser = new Map<string, { status: string }>();
    reportsSnap.docs.forEach((doc) => {
      const data = doc.data();
      reportsByUser.set(data.userId as string, {
        status: data.status as string,
      });
    });

    const submittedUsers: Array<{
      userId: string;
      displayName: string;
      status: string;
    }> = [];
    const notSubmittedUsers: Array<{
      userId: string;
      displayName: string;
    }> = [];

    let approvedCount = 0;

    for (const worker of allWorkers) {
      const report = reportsByUser.get(worker.userId);
      if (report) {
        submittedUsers.push({
          ...worker,
          status: report.status,
        });
        if (report.status === REPORT_STATUS.APPROVED) {
          approvedCount++;
        }
      } else {
        notSubmittedUsers.push(worker);
      }
    }

    return successResponse({
      date,
      totalWorkers: allWorkers.length,
      submittedCount: submittedUsers.length,
      notSubmittedCount: notSubmittedUsers.length,
      approvedCount,
      submittedUsers,
      notSubmittedUsers,
    });
  } catch (error) {
    console.error('ダッシュボードステータス取得エラー:', error);
    return serverErrorResponse();
  }
}
