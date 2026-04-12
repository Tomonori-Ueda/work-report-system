import 'server-only';

import { type NextRequest } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/firebase/api-auth';
import {
  successResponse,
  unauthorizedResponse,
  forbiddenResponse,
  errorResponse,
  serverErrorResponse,
} from '@/lib/utils/api-response';
import { isAdminRole } from '@/types/user';

/** 有給カレンダーエントリ型 */
export interface LeaveCalendarEntry {
  id: string;
  leaveDate: string;
  userId: string;
  userName: string;
  leaveType: string;
  leaveUnit: string;
  leaveHours: number | null;
  status: string;
}

/**
 * GET /api/leave/calendar?year=2026&month=4
 * 指定月の有給申請をカレンダー表示用に返す（管理者のみ）
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();
    if (!isAdminRole(auth.role)) return forbiddenResponse();

    const { searchParams } = new URL(request.url);
    const yearStr = searchParams.get('year');
    const monthStr = searchParams.get('month');

    if (!yearStr || !monthStr) {
      return errorResponse('BAD_REQUEST', 'year と month は必須パラメータです', 400);
    }

    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);

    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      return errorResponse('BAD_REQUEST', 'year, month の値が不正です', 400);
    }

    const monthPadded = String(month).padStart(2, '0');
    const startDate = `${year}-${monthPadded}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${monthPadded}-${String(lastDay).padStart(2, '0')}`;

    const db = getAdminDb();

    // 指定月の有給申請を取得（レンジクエリ、単一フィールドなので複合インデックス不要）
    const snapshot = await db
      .collection('leave_requests')
      .where('leaveDate', '>=', startDate)
      .where('leaveDate', '<=', endDate)
      .get();

    if (snapshot.empty) {
      return successResponse({ year, month, entries: [] as LeaveCalendarEntry[] });
    }

    // ユーザーIDを収集してユーザー情報を一括取得
    const userIds = [
      ...new Set(snapshot.docs.map((doc) => doc.data().userId as string)),
    ];
    const usersMap = new Map<string, string>();

    const CHUNK_SIZE = 30;
    for (let i = 0; i < userIds.length; i += CHUNK_SIZE) {
      const chunk = userIds.slice(i, i + CHUNK_SIZE);
      const usersSnap = await db
        .collection('users')
        .where('__name__', 'in', chunk)
        .get();
      usersSnap.docs.forEach((doc) => {
        usersMap.set(doc.id, (doc.data().displayName as string) ?? '不明');
      });
    }

    const entries: LeaveCalendarEntry[] = snapshot.docs
      .map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          leaveDate: data.leaveDate as string,
          userId: data.userId as string,
          userName: usersMap.get(data.userId as string) ?? '不明',
          leaveType: data.leaveType as string,
          leaveUnit: data.leaveUnit as string,
          leaveHours: (data.leaveHours as number | null) ?? null,
          status: data.status as string,
        };
      })
      .sort((a, b) => a.leaveDate.localeCompare(b.leaveDate));

    return successResponse({ year, month, entries });
  } catch (error) {
    console.error('有給カレンダーAPIエラー:', error);
    return serverErrorResponse();
  }
}
