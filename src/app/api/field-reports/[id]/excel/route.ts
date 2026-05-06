import 'server-only';

import { type NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/firebase/api-auth';
import {
  unauthorizedResponse,
  forbiddenResponse,
  notFoundResponse,
  serverErrorResponse,
} from '@/lib/utils/api-response';
import {
  generateFieldReportExcel,
  buildFieldReportFileName,
} from '@/lib/utils/field-report-excel';
import { isAdminRole, isSupervisor } from '@/types/user';
import type { FieldReport } from '@/types/field-report';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/field-reports/[id]/excel
 * 様式7.5-9-02 形式の Excel をダウンロード。
 * 閲覧権限: 管理者系（S/A/A_special/B）または現場監督本人。
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();
    if (!isAdminRole(auth.role) && !isSupervisor(auth.role)) {
      return forbiddenResponse('現場日報の閲覧権限がありません');
    }

    const { id } = await params;
    const db = getAdminDb();
    const docRef = db.collection('field_reports').doc(id);
    const snap = await docRef.get();
    if (!snap.exists) return notFoundResponse('現場日報が見つかりません');

    const data = snap.data()!;
    if (isSupervisor(auth.role) && data.supervisorId !== auth.uid) {
      return forbiddenResponse();
    }

    const report = { id: snap.id, ...data } as FieldReport;

    // 監督表示名を取得（無ければ uid のフォールバック）
    let supervisorName = '不明';
    try {
      const userDoc = await db.collection('users').doc(report.supervisorId).get();
      supervisorName = (userDoc.data()?.displayName as string) ?? supervisorName;
    } catch {
      // 取得失敗時はフォールバック
    }

    const buffer = await generateFieldReportExcel(report, supervisorName);
    const fileName = buildFieldReportFileName(report);

    // RFC 5987 準拠で日本語ファイル名を渡す
    const encoded = encodeURIComponent(fileName);
    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="report.xlsx"; filename*=UTF-8''${encoded}`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('現場日報Excel生成エラー:', error);
    return serverErrorResponse();
  }
}
