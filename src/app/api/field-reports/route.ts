import 'server-only';

import { type NextRequest } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/firebase/api-auth';
import {
  successResponse,
  unauthorizedResponse,
  forbiddenResponse,
  serverErrorResponse,
  errorResponse,
} from '@/lib/utils/api-response';
import { createFieldReportSchema } from '@/lib/validations/field-report';
import { isAdminRole, isSupervisor } from '@/types/user';

/** GET /api/field-reports - 現場日報一覧を取得 */
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();

    // 管理者系ロールまたはGロールのみアクセス可
    if (!isAdminRole(auth.role) && !isSupervisor(auth.role)) {
      return forbiddenResponse('現場日報の閲覧権限がありません');
    }

    const { searchParams } = new URL(request.url);
    const supervisorId = searchParams.get('supervisorId');
    const siteId = searchParams.get('siteId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const db = getAdminDb();
    let query: FirebaseFirestore.Query = db.collection('field_reports');

    // Gロールは自分の日報のみ取得可能
    if (isSupervisor(auth.role)) {
      query = query.where('supervisorId', '==', auth.uid);
    } else if (supervisorId) {
      // 管理者系ロールは特定監督の日報を指定可能
      query = query.where('supervisorId', '==', supervisorId);
    }

    // supervisorId（equality）と reportDate（range）を同時に使うと複合インデックスが必要。
    // siteId フィルタと日付フィルタは JS 側で適用する。
    query = query.orderBy('reportDate', 'desc').limit(200);

    const snapshot = await query.get();

    let fieldReports = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Array<{ id: string; siteId?: string; reportDate?: string; [key: string]: unknown }>;

    // siteId フィルタを JS 側で適用
    if (siteId) {
      fieldReports = fieldReports.filter((r) => r.siteId === siteId);
    }
    // 日付 range フィルタを JS 側で適用
    if (startDate) {
      fieldReports = fieldReports.filter((r) => (r.reportDate ?? '') >= startDate);
    }
    if (endDate) {
      fieldReports = fieldReports.filter((r) => (r.reportDate ?? '') <= endDate);
    }

    return successResponse({ fieldReports });
  } catch (error) {
    console.error('現場日報一覧取得エラー:', error);
    return serverErrorResponse();
  }
}

/** POST /api/field-reports - 現場日報を作成 */
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();

    // Gロール（現場監督）のみ作成可能
    if (!isSupervisor(auth.role)) {
      return forbiddenResponse('現場日報の作成はGロール（現場監督）のみ可能です');
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

    const db = getAdminDb();

    // 同一 siteId + reportDate の重複チェック
    // supervisorId + reportDate の2フィールドで絞り込み、siteId は JS 側でフィルタする
    const existingSnap = await db
      .collection('field_reports')
      .where('supervisorId', '==', auth.uid)
      .where('reportDate', '==', reportDate)
      .get();

    const isDuplicatePost = existingSnap.docs.some(
      (doc) => (doc.data().siteId as string | undefined) === siteId
    );

    if (isDuplicatePost) {
      return errorResponse(
        'DUPLICATE_REPORT',
        '同じ現場・日付の日報が既に存在します',
        409
      );
    }

    // workerCount の合計を自動計算
    const totalWorkerCount = subcontractorWorks.reduce(
      (sum, work) => sum + work.workerCount,
      0
    );

    const docRef = db.collection('field_reports').doc();
    const reportData = {
      supervisorId: auth.uid,
      siteId,
      siteName,
      reportDate,
      weather,
      subcontractorWorks,
      materialDeliveries,
      notes: notes ?? null,
      totalWorkerCount,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    await docRef.set(reportData);

    return successResponse({ id: docRef.id, ...reportData }, 201);
  } catch (error) {
    console.error('現場日報作成エラー:', error);
    return serverErrorResponse();
  }
}
