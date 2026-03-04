import 'server-only';

import { type NextRequest } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/firebase/api-auth';
import { calculateWorkingHours } from '@/lib/utils/time-calc';
import {
  successResponse,
  unauthorizedResponse,
  notFoundResponse,
  forbiddenResponse,
  serverErrorResponse,
  errorResponse,
} from '@/lib/utils/api-response';
import { createReportSchema } from '@/lib/validations/report';
import { REPORT_STATUS } from '@/types/report';
import { USER_ROLE } from '@/types/user';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** GET /api/reports/[id] - 日報詳細を取得 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();

    const { id } = await params;
    const db = getAdminDb();
    const doc = await db.collection('daily_reports').doc(id).get();

    if (!doc.exists) {
      return notFoundResponse('日報が見つかりません');
    }

    const data = doc.data()!;

    // 作業員は自分の日報のみ閲覧可
    if (auth.role !== USER_ROLE.ADMIN && data.userId !== auth.uid) {
      return forbiddenResponse();
    }

    // ユーザー情報を取得
    const userDoc = await db.collection('users').doc(data.userId as string).get();
    const userData = userDoc.data();

    return successResponse({
      id: doc.id,
      ...data,
      userName: userData?.displayName ?? '不明',
      userDepartment: userData?.department ?? null,
    });
  } catch (error) {
    console.error('日報詳細取得エラー:', error);
    return serverErrorResponse();
  }
}

/** PUT /api/reports/[id] - 日報を更新 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();

    const { id } = await params;
    const db = getAdminDb();
    const docRef = db.collection('daily_reports').doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return notFoundResponse('日報が見つかりません');
    }

    const existingData = doc.data()!;

    // 自分の日報のみ編集可
    if (existingData.userId !== auth.uid) {
      return forbiddenResponse();
    }

    // 提出済み以降は編集不可（下書きまたは差し戻しのみ編集可）
    if (
      existingData.status !== REPORT_STATUS.DRAFT &&
      existingData.status !== REPORT_STATUS.REJECTED
    ) {
      return errorResponse(
        'INVALID_STATUS',
        'この日報は編集できません',
        400
      );
    }

    const body: unknown = await request.json();
    const parsed = createReportSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(
        'VALIDATION_ERROR',
        parsed.error.issues[0]?.message ?? 'バリデーションエラー',
        400
      );
    }

    const { reportDate, startTime, endTime, workContent, notes } = parsed.data;
    const workHours = calculateWorkingHours({ startTime, endTime });

    const updateData = {
      reportDate,
      startTime,
      endTime,
      workContent,
      notes: notes ?? null,
      regularHours: workHours.regularHours,
      overtimeHours: workHours.overtimeHours,
      status: REPORT_STATUS.SUBMITTED,
      rejectReason: null,
      updatedAt: FieldValue.serverTimestamp(),
    };

    await docRef.update(updateData);

    return successResponse({ id, ...updateData });
  } catch (error) {
    console.error('日報更新エラー:', error);
    return serverErrorResponse();
  }
}
