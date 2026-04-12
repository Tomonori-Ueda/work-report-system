import 'server-only';

import { type NextRequest } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/firebase/api-auth';
import {
  successResponse,
  unauthorizedResponse,
  serverErrorResponse,
  errorResponse,
} from '@/lib/utils/api-response';
import { createLeaveRequestSchema } from '@/lib/validations/leave';
import { LEAVE_STATUS, LEAVE_TYPE, LEAVE_UNIT } from '@/types/leave';
import { isAdminRole } from '@/types/user';
import { calcConsumeDays, ANNUAL_LEAVE_MAX_DAYS } from '@/lib/utils/leave-calc';

/** POST /api/leave/requests - 有給申請を作成 */
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();

    const body: unknown = await request.json();
    const parsed = createLeaveRequestSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(
        'VALIDATION_ERROR',
        parsed.error.issues[0]?.message ?? 'バリデーションエラー',
        400
      );
    }

    const {
      leaveDate,
      leaveType,
      leaveUnit,
      leaveHours,
      startTime,
      endTime,
      reason,
    } = parsed.data;

    // 消費日数を計算（有給残日数チェックに使用）
    const consumeDays = calcConsumeDays(leaveUnit, leaveHours);

    const db = getAdminDb();

    // 有給休暇の場合、残日数をチェック
    if (leaveType === LEAVE_TYPE.PAID) {
      const userDoc = await db.collection('users').doc(auth.uid).get();
      if (!userDoc.exists) {
        return errorResponse('NOT_FOUND', 'ユーザーが見つかりません', 404);
      }
      const userData = userDoc.data()!;
      // Firestore に保存された残日数（最大60日上限でキャップ）
      const rawBalance = (userData.annualLeaveBalance as number) ?? 0;
      const balance = Math.min(rawBalance, ANNUAL_LEAVE_MAX_DAYS);
      if (balance < consumeDays) {
        return errorResponse(
          'INSUFFICIENT_BALANCE',
          `有給休暇の残日数が不足しています（残: ${balance}日、必要: ${consumeDays}日）`,
          400
        );
      }
    }

    // 同日の申請が既にないかチェック（時間有給以外）
    // 時間有給は同日に複数申請可能なため、重複チェックを緩和
    // 複合インデックスを避けるため userId + leaveDate の2フィールドで絞り込み、
    // status フィルタは JS 側で行う
    if (leaveUnit !== LEAVE_UNIT.HOURLY) {
      const existingSnap = await db
        .collection('leave_requests')
        .where('userId', '==', auth.uid)
        .where('leaveDate', '==', leaveDate)
        .get();

      const hasActiveRequest = existingSnap.docs.some((doc) => {
        const s = doc.data().status as string | undefined;
        return s === LEAVE_STATUS.PENDING || s === LEAVE_STATUS.APPROVED;
      });

      if (hasActiveRequest) {
        return errorResponse(
          'DUPLICATE_REQUEST',
          'この日付の有給申請は既に存在します',
          400
        );
      }
    }

    const docRef = db.collection('leave_requests').doc();
    const requestData = {
      userId: auth.uid,
      leaveDate,
      leaveType,
      leaveUnit,
      leaveHours: leaveUnit === LEAVE_UNIT.HOURLY ? (leaveHours ?? null) : null,
      startTime: leaveUnit === LEAVE_UNIT.HOURLY ? (startTime ?? null) : null,
      endTime: leaveUnit === LEAVE_UNIT.HOURLY ? (endTime ?? null) : null,
      reason: reason ?? null,
      status: LEAVE_STATUS.PENDING,
      approvedBy: null,
      approvedAt: null,
      createdAt: FieldValue.serverTimestamp(),
    };

    await docRef.set(requestData);

    return successResponse({ id: docRef.id, ...requestData }, 201);
  } catch (error) {
    console.error('有給申請作成エラー:', error);
    return serverErrorResponse();
  }
}

/** GET /api/leave/requests - 有給申請一覧を取得 */
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();

    const db = getAdminDb();
    let query: FirebaseFirestore.Query = db.collection('leave_requests');

    // 管理者系ロール以外は自分の申請のみ
    if (!isAdminRole(auth.role)) {
      query = query.where('userId', '==', auth.uid);
    }

    query = query.orderBy('leaveDate', 'desc').limit(100);

    const snapshot = await query.get();
    const requests = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return successResponse(requests);
  } catch (error) {
    console.error('有給申請一覧取得エラー:', error);
    return serverErrorResponse();
  }
}
