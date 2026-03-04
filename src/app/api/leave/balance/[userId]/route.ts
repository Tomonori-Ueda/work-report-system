import 'server-only';

import { type NextRequest } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/firebase/api-auth';
import {
  successResponse,
  unauthorizedResponse,
  forbiddenResponse,
  notFoundResponse,
  serverErrorResponse,
} from '@/lib/utils/api-response';
import { USER_ROLE } from '@/types/user';

interface RouteParams {
  params: Promise<{ userId: string }>;
}

/** GET /api/leave/balance/[userId] - 有給残日数と履歴を取得 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();

    const { userId } = await params;

    // 自分自身のデータか管理者のみ閲覧可
    if (auth.role !== USER_ROLE.ADMIN && auth.uid !== userId) {
      return forbiddenResponse();
    }

    const db = getAdminDb();
    const userDoc = await db.collection('users').doc(userId).get();

    if (!userDoc.exists) {
      return notFoundResponse('ユーザーが見つかりません');
    }

    const balance = (userDoc.data()?.annualLeaveBalance as number) ?? 0;

    // 残日数変更ログを取得
    const logsSnap = await db
      .collection('users')
      .doc(userId)
      .collection('leave_balance_logs')
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    const logs = logsSnap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return successResponse({ balance, logs });
  } catch (error) {
    console.error('有給残日数取得エラー:', error);
    return serverErrorResponse();
  }
}
