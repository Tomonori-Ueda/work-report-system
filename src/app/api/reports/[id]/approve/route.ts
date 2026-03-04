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
import { REPORT_STATUS } from '@/types/report';
import { USER_ROLE } from '@/types/user';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** PUT /api/reports/[id]/approve - 日報を承認 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();
    if (auth.role !== USER_ROLE.ADMIN) return forbiddenResponse();

    const { id } = await params;
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
        '提出済みの日報のみ承認できます',
        400
      );
    }

    await docRef.update({
      status: REPORT_STATUS.APPROVED,
      approvedBy: auth.uid,
      approvedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return successResponse({ id, status: REPORT_STATUS.APPROVED });
  } catch (error) {
    console.error('日報承認エラー:', error);
    return serverErrorResponse();
  }
}
