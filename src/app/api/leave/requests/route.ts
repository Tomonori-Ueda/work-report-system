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
import { LEAVE_STATUS, LEAVE_TYPE } from '@/types/leave';
import { USER_ROLE } from '@/types/user';

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

    const { leaveDate, leaveType, reason } = parsed.data;
    const db = getAdminDb();

    // 有給休暇の場合、残日数をチェック
    if (leaveType === LEAVE_TYPE.PAID) {
      const userDoc = await db.collection('users').doc(auth.uid).get();
      if (!userDoc.exists) {
        return errorResponse('NOT_FOUND', 'ユーザーが見つかりません', 404);
      }
      const balance = (userDoc.data()?.annualLeaveBalance as number) ?? 0;
      if (balance <= 0) {
        return errorResponse(
          'INSUFFICIENT_BALANCE',
          '有給休暇の残日数が不足しています',
          400
        );
      }
    }

    // 同日の申請が既にないかチェック
    const existingSnap = await db
      .collection('leave_requests')
      .where('userId', '==', auth.uid)
      .where('leaveDate', '==', leaveDate)
      .where('status', 'in', [LEAVE_STATUS.PENDING, LEAVE_STATUS.APPROVED])
      .get();

    if (!existingSnap.empty) {
      return errorResponse(
        'DUPLICATE_REQUEST',
        'この日付の有給申請は既に存在します',
        400
      );
    }

    const docRef = db.collection('leave_requests').doc();
    const requestData = {
      userId: auth.uid,
      leaveDate,
      leaveType,
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

    // 作業員は自分の申請のみ
    if (auth.role !== USER_ROLE.ADMIN) {
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
