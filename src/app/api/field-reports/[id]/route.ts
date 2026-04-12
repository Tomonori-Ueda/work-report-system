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
import { createFieldReportSchema } from '@/lib/validations/field-report';
import { isAdminRole, isSupervisor, canApprove } from '@/types/user';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** GET /api/field-reports/[id] - 現場日報詳細を取得 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();

    if (!isAdminRole(auth.role) && !isSupervisor(auth.role)) {
      return forbiddenResponse('現場日報の閲覧権限がありません');
    }

    const { id } = await params;
    const db = getAdminDb();
    const doc = await db.collection('field_reports').doc(id).get();

    if (!doc.exists) {
      return notFoundResponse('現場日報が見つかりません');
    }

    const data = doc.data()!;

    // Gロールは自分の日報のみ閲覧可
    if (isSupervisor(auth.role) && data.supervisorId !== auth.uid) {
      return forbiddenResponse();
    }

    return successResponse({ id: doc.id, ...data });
  } catch (error) {
    console.error('現場日報詳細取得エラー:', error);
    return serverErrorResponse();
  }
}

/** PUT /api/field-reports/[id] - 現場日報を更新 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();

    const { id } = await params;
    const db = getAdminDb();
    const docRef = db.collection('field_reports').doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return notFoundResponse('現場日報が見つかりません');
    }

    const existingData = doc.data()!;

    // 作成者本人または管理者系ロールのみ更新可
    const isOwner = existingData.supervisorId === auth.uid;
    if (!isOwner && !isAdminRole(auth.role)) {
      return forbiddenResponse('この日報を編集する権限がありません');
    }

    const body: unknown = await request.json();
    const parsed = createFieldReportSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(
        'VALIDATION_ERROR',
        parsed.error.issues[0]?.message ?? 'バリデーションエラー',
        400
      );
    }

    const {
      siteId,
      siteName,
      reportDate,
      weather,
      subcontractorWorks,
      materialDeliveries,
      notes,
    } = parsed.data;

    // siteId or reportDate が変更される場合は重複チェック
    const isSiteChanged = siteId !== existingData.siteId;
    const isDateChanged = reportDate !== existingData.reportDate;

    if (isSiteChanged || isDateChanged) {
      // 複合インデックスを避けるため supervisorId + reportDate の2フィールドに絞り、
      // siteId の重複チェックは JS 側で行う
      const existingSnap = await db
        .collection('field_reports')
        .where('supervisorId', '==', existingData.supervisorId)
        .where('reportDate', '==', reportDate)
        .get();

      // 自分自身以外で同じ siteId の重複をチェック
      const isDuplicate = existingSnap.docs.some(
        (d) => d.id !== id && (d.data().siteId as string | undefined) === siteId
      );
      if (isDuplicate) {
        return errorResponse(
          'DUPLICATE_REPORT',
          '同じ現場・日付の日報が既に存在します',
          409
        );
      }
    }

    const totalWorkerCount = subcontractorWorks.reduce(
      (sum, work) => sum + work.workerCount,
      0
    );

    const updateData = {
      siteId,
      siteName,
      reportDate,
      weather,
      subcontractorWorks,
      materialDeliveries,
      notes: notes ?? null,
      totalWorkerCount,
      updatedAt: FieldValue.serverTimestamp(),
    };

    await docRef.update(updateData);

    return successResponse({ id, ...updateData });
  } catch (error) {
    console.error('現場日報更新エラー:', error);
    return serverErrorResponse();
  }
}

/** DELETE /api/field-reports/[id] - 現場日報を削除 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();

    const { id } = await params;
    const db = getAdminDb();
    const docRef = db.collection('field_reports').doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return notFoundResponse('現場日報が見つかりません');
    }

    const existingData = doc.data()!;

    // 作成者本人または承認権限者のみ削除可
    const isOwner = existingData.supervisorId === auth.uid;
    if (!isOwner && !canApprove(auth.role)) {
      return forbiddenResponse('この日報を削除する権限がありません');
    }

    await docRef.delete();

    return successResponse({ id });
  } catch (error) {
    console.error('現場日報削除エラー:', error);
    return serverErrorResponse();
  }
}
