import 'server-only';

import { type NextRequest } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/firebase/api-auth';
import {
  successResponse,
  unauthorizedResponse,
  forbiddenResponse,
  notFoundResponse,
  serverErrorResponse,
  errorResponse,
} from '@/lib/utils/api-response';
import { approveLeaveRequestSchema } from '@/lib/validations/leave';
import { LEAVE_STATUS, LEAVE_TYPE, BALANCE_CHANGE_TYPE } from '@/types/leave';
import { USER_ROLE } from '@/types/user';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** PUT /api/leave/requests/[id] - 有給申請を承認/却下 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();
    if (auth.role !== USER_ROLE.ADMIN) return forbiddenResponse();

    const { id } = await params;
    const body: unknown = await request.json();
    const parsed = approveLeaveRequestSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(
        'VALIDATION_ERROR',
        parsed.error.issues[0]?.message ?? 'バリデーションエラー',
        400
      );
    }

    const { action, rejectReason } = parsed.data;
    const db = getAdminDb();
    const docRef = db.collection('leave_requests').doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return notFoundResponse('有給申請が見つかりません');
    }

    const data = doc.data()!;
    if (data.status !== LEAVE_STATUS.PENDING) {
      return errorResponse(
        'INVALID_STATUS',
        '申請中の有給のみ承認/却下できます',
        400
      );
    }

    if (action === 'approved') {
      // 有給休暇承認：トランザクションで残日数を減算
      if (data.leaveType === LEAVE_TYPE.PAID) {
        await db.runTransaction(async (transaction) => {
          const userRef = db.collection('users').doc(data.userId as string);
          const userDoc = await transaction.get(userRef);

          if (!userDoc.exists) {
            throw new Error('ユーザーが見つかりません');
          }

          const currentBalance =
            (userDoc.data()?.annualLeaveBalance as number) ?? 0;
          if (currentBalance <= 0) {
            throw new Error('有給休暇の残日数が不足しています');
          }

          const newBalance = currentBalance - 1;

          // ユーザーの残日数を更新
          transaction.update(userRef, {
            annualLeaveBalance: newBalance,
            updatedAt: FieldValue.serverTimestamp(),
          });

          // 有給申請を承認
          transaction.update(docRef, {
            status: LEAVE_STATUS.APPROVED,
            approvedBy: auth.uid,
            approvedAt: FieldValue.serverTimestamp(),
          });

          // 残日数変更ログを記録
          const logRef = userRef.collection('leave_balance_logs').doc();
          transaction.set(logRef, {
            userId: data.userId,
            changeType: BALANCE_CHANGE_TYPE.USE,
            changeDays: -1,
            balanceAfter: newBalance,
            note: `有給休暇使用（${data.leaveDate}）`,
            createdAt: FieldValue.serverTimestamp(),
          });
        });
      } else {
        // 特別休暇・無給休暇の場合は残日数減算なし
        await docRef.update({
          status: LEAVE_STATUS.APPROVED,
          approvedBy: auth.uid,
          approvedAt: FieldValue.serverTimestamp(),
        });
      }
    } else {
      // 却下
      await docRef.update({
        status: LEAVE_STATUS.REJECTED,
        approvedBy: auth.uid,
        approvedAt: FieldValue.serverTimestamp(),
        rejectReason: rejectReason ?? null,
      });
    }

    return successResponse({ id, status: action });
  } catch (error) {
    console.error('有給申請承認/却下エラー:', error);
    if (error instanceof Error && error.message.includes('残日数')) {
      return errorResponse('INSUFFICIENT_BALANCE', error.message, 400);
    }
    return serverErrorResponse();
  }
}
