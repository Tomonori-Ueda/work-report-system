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
import { rejectReportSchema } from '@/lib/validations/report';
import { REPORT_STATUS } from '@/types/report';
import { USER_ROLE } from '@/types/user';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** PUT /api/reports/[id]/reject - 日報を差し戻し */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();
    if (auth.role !== USER_ROLE.ADMIN) return forbiddenResponse();

    const { id } = await params;
    const body: unknown = await request.json();
    const parsed = rejectReportSchema.safeParse(body);
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

    const data = doc.data()!;
    if (data.status !== REPORT_STATUS.SUBMITTED) {
      return errorResponse(
        'INVALID_STATUS',
        '提出済みの日報のみ差し戻しできます',
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
