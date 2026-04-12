import 'server-only';

import { type NextRequest } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/firebase/api-auth';
import {
  successResponse,
  unauthorizedResponse,
  forbiddenResponse,
  errorResponse,
  serverErrorResponse,
} from '@/lib/utils/api-response';
import { isAdminRole, isSupervisor } from '@/types/user';
import type { SubcontractorWork } from '@/types/field-report';

/**
 * GET /api/field-reports/site-summary?siteId=xxx
 * 現場ごとの工数累計を取得（現場監督・管理者のみ）
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();

    if (!isAdminRole(auth.role) && !isSupervisor(auth.role)) {
      return forbiddenResponse('現場日報の閲覧権限がありません');
    }

    const { searchParams } = new URL(request.url);
    const siteId = searchParams.get('siteId');

    if (!siteId) {
      return errorResponse('BAD_REQUEST', 'siteId は必須パラメータです', 400);
    }

    const db = getAdminDb();

    // 該当現場の現場日報を全件取得
    // Gロールは自分の日報のみ、管理者は全件
    let query: FirebaseFirestore.Query = db
      .collection('field_reports')
      .where('siteId', '==', siteId);

    if (isSupervisor(auth.role)) {
      query = query.where('supervisorId', '==', auth.uid);
    }

    const snapshot = await query.get();

    if (snapshot.empty) {
      return successResponse({
        siteId,
        siteName: null,
        totalReportCount: 0,
        totalWorkerDays: 0,
        totalWorkerHours: null,
        latestReportDate: null,
        oldestReportDate: null,
      });
    }

    let siteName: string | null = null;
    let totalWorkerDays = 0;
    let totalWorkerHours = 0;
    let hasTimeData = false;
    const reportDates: string[] = [];

    snapshot.docs.forEach((doc) => {
      const data = doc.data();

      if (!siteName && data.siteName) {
        siteName = data.siteName as string;
      }

      totalWorkerDays += (data.totalWorkerCount as number) ?? 0;

      if (data.reportDate) {
        reportDates.push(data.reportDate as string);
      }

      // 時刻記録がある協力会社作業から稼働時間を集計
      const works = (data.subcontractorWorks as SubcontractorWork[]) ?? [];
      works.forEach((work) => {
        if (
          work.startTime &&
          work.endTime &&
          /^\d{2}:\d{2}$/.test(work.startTime) &&
          /^\d{2}:\d{2}$/.test(work.endTime)
        ) {
          const [sh, sm] = work.startTime.split(':').map(Number);
          const [eh, em] = work.endTime.split(':').map(Number);
          const durationHours =
            Math.max(0, (eh ?? 0) * 60 + (em ?? 0) - (sh ?? 0) * 60 - (sm ?? 0)) /
            60;
          totalWorkerHours += durationHours * work.workerCount;
          hasTimeData = true;
        }
      });
    });

    reportDates.sort();

    return successResponse({
      siteId,
      siteName,
      totalReportCount: snapshot.size,
      totalWorkerDays,
      /** 時刻記録がある場合のみ合計時間を返す */
      totalWorkerHours: hasTimeData ? Math.round(totalWorkerHours * 10) / 10 : null,
      latestReportDate: reportDates[reportDates.length - 1] ?? null,
      oldestReportDate: reportDates[0] ?? null,
    });
  } catch (error) {
    console.error('現場工数累計APIエラー:', error);
    return serverErrorResponse();
  }
}
