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
import { isAdminRole } from '@/types/user';
import {
  getNextGrantInfo,
  calculateTheoreticalBalance,
  getExpiringGrants,
  ANNUAL_LEAVE_MAX_DAYS,
} from '@/lib/utils/leave-calc';

interface RouteParams {
  params: Promise<{ userId: string }>;
}

/** GET /api/leave/balance/[userId] - 有給残日数と履歴を取得 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();

    const { userId } = await params;

    // 自分自身のデータか管理者系ロールのみ閲覧可
    if (!isAdminRole(auth.role) && auth.uid !== userId) {
      return forbiddenResponse();
    }

    const db = getAdminDb();
    const userDoc = await db.collection('users').doc(userId).get();

    if (!userDoc.exists) {
      return notFoundResponse('ユーザーが見つかりません');
    }

    const userData = userDoc.data()!;
    const balance = (userData.annualLeaveBalance as number) ?? 0;
    const hireDate = (userData.hireDate as string | null | undefined) ?? null;

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

    // hireDate がある場合のみ自動計算情報を付加
    const nextGrantInfo =
      hireDate != null ? getNextGrantInfo(hireDate) : null;
    const theoreticalBalance =
      hireDate != null ? calculateTheoreticalBalance(hireDate) : null;
    // 30日以内に有効期限が切れる付与分を警告
    const expiringGrants =
      hireDate != null ? getExpiringGrants(hireDate, 30) : [];

    return successResponse({
      balance,
      logs,
      hireDate,
      nextGrantInfo,
      theoreticalBalance,
      expiringGrants,
      maxDays: ANNUAL_LEAVE_MAX_DAYS,
    });
  } catch (error) {
    console.error('有給残日数取得エラー:', error);
    return serverErrorResponse();
  }
}
