import 'server-only';

import { type NextRequest } from 'next/server';
import { z } from 'zod';
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
import { REPORT_STATUS, type ReportStatus } from '@/types/report';
import { USER_ROLE, type UserRole } from '@/types/user';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** 差し戻しリクエストのバリデーションスキーマ */
const rejectSchema = z.object({
  rejectReason: z
    .string()
    .min(1, '差し戻し理由を入力してください')
    .max(500, '500文字以内で入力してください'),
});

/** 差し戻し権限を持つロールかどうか（G, B, A, S のみ） */
function canReject(role: UserRole): boolean {
  return (
    role === USER_ROLE.G ||
    role === USER_ROLE.B ||
    role === USER_ROLE.A ||
    role === USER_ROLE.S
  );
}

/** 差し戻し可能なステータス（draft と rejected は不可） */
const REJECTABLE_STATUSES: ReportStatus[] = [
  REPORT_STATUS.SUBMITTED,
  REPORT_STATUS.SUPERVISOR_CONFIRMED,
  REPORT_STATUS.MANAGER_CHECKED,
  REPORT_STATUS.APPROVED,
];

/** PUT /api/reports/[id]/reject - 日報を差し戻し */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();
    if (!canReject(auth.role)) return forbiddenResponse();

    const { id } = await params;
    const body: unknown = await request.json();
    const parsed = rejectSchema.safeParse(body);

    if (!parsed.success) {
      return errorResponse(
        'VALIDATION_ERROR',
        parsed.error.issues[0]?.message ?? '差し戻し理由を入力してください',
        400
      );
    }

    const db = getAdminDb();
    const docRef = db.collection('daily_reports').doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return notFoundResponse('日報が見つかりません');
    }

    const currentStatus = doc.data()!.status as ReportStatus;

    if (!REJECTABLE_STATUSES.includes(currentStatus)) {
      return errorResponse(
        'INVALID_STATUS',
        '下書き中または差し戻し済みの日報は差し戻しできません',
        400
      );
    }

    await docRef.update({
      status: REPORT_STATUS.REJECTED,
      rejectReason: parsed.data.rejectReason,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return successResponse({
      id,
      status: REPORT_STATUS.REJECTED,
      rejectReason: parsed.data.rejectReason,
    });
  } catch (error) {
    console.error('日報差し戻しエラー:', error);
    return serverErrorResponse();
  }
}
