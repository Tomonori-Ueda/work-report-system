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
import { REPORT_STATUS } from '@/types/report';
import type { TimeBlock } from '@/types/report';
import type { SubcontractorWork } from '@/types/field-report';
import type { MismatchRecord } from '@/types/api';

/**
 * "HH:mm" 形式の時刻文字列を分単位の整数に変換する
 * パース失敗時はnullを返す
 */
function parseTimeToMinutes(time: string): number | null {
  const parts = time.split(':');
  if (parts.length !== 2) return null;
  const hours = parseInt(parts[0] ?? '0', 10);
  const minutes = parseInt(parts[1] ?? '0', 10);
  if (isNaN(hours) || isNaN(minutes)) return null;
  return hours * 60 + minutes;
}

/**
 * TimeBlockの配列から指定siteIdの合計時間を計算する
 * "HH:mm" 形式の startTime / endTime の差分を合計する
 */
function calcHoursForSite(timeBlocks: TimeBlock[], siteId: string): number {
  return timeBlocks
    .filter((block) => block.siteId === siteId)
    .reduce((sum, block) => {
      const startMinutes = parseTimeToMinutes(block.startTime);
      const endMinutes = parseTimeToMinutes(block.endTime);
      if (startMinutes === null || endMinutes === null) {
        return sum;
      }
      const durationMinutes = endMinutes - startMinutes;
      return sum + Math.max(0, durationMinutes) / 60;
    }, 0);
}

/**
 * 現場日報の協力会社作業から合計稼働時間を計算する
 * startTime/endTime が記録されている場合: 時刻差 × 人数
 * 記録がない場合: null（比較不可）
 */
function calcSupervisorHoursForSite(
  subcontractorWorks: SubcontractorWork[]
): number | null {
  // 時刻記録があるエントリのみ対象
  const worksWithTime = subcontractorWorks.filter(
    (w) =>
      w.startTime != null &&
      w.startTime !== '' &&
      w.endTime != null &&
      w.endTime !== ''
  );
  if (worksWithTime.length === 0) return null;

  return worksWithTime.reduce((sum, work) => {
    const startMinutes = parseTimeToMinutes(work.startTime ?? '');
    const endMinutes = parseTimeToMinutes(work.endTime ?? '');
    if (startMinutes === null || endMinutes === null) return sum;
    const durationHours = Math.max(0, endMinutes - startMinutes) / 60;
    // 時間 × 人数 = その会社の総稼働時間
    return sum + durationHours * work.workerCount;
  }, 0);
}

/**
 * GET /api/reports/mismatch
 * 指定日の作業員日報と現場日報を照合してミスマッチを検出する
 * 認証: isAdminRole または isSupervisor
 * クエリパラメータ: date=YYYY-MM-DD（必須）
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();

    // 管理者ロールまたは現場監督のみアクセス可
    if (!isAdminRole(auth.role) && !isSupervisor(auth.role)) {
      return forbiddenResponse('照合チェックの閲覧権限がありません');
    }

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');

    if (!date) {
      return errorResponse('VALIDATION_ERROR', 'クエリパラメータ date は必須です', 400);
    }

    // 日付フォーマット検証（YYYY-MM-DD）
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return errorResponse('VALIDATION_ERROR', 'date は YYYY-MM-DD 形式で指定してください', 400);
    }

    const db = getAdminDb();

    // 指定日の提出済み以降の日報を全件取得
    const submittedStatuses = [
      REPORT_STATUS.SUBMITTED,
      REPORT_STATUS.SUPERVISOR_CONFIRMED,
      REPORT_STATUS.MANAGER_CHECKED,
      REPORT_STATUS.APPROVED,
      REPORT_STATUS.REJECTED,
    ];

    // 複合インデックスを避けるため reportDate のみでクエリし、
    // status フィルタは JS 側で行う
    const allReportsSnap = await db
      .collection('daily_reports')
      .where('reportDate', '==', date)
      .get();

    const filteredReportDocs = allReportsSnap.docs.filter((doc) =>
      (submittedStatuses as string[]).includes(doc.data().status as string)
    );

    const reportsSnap = {
      empty: filteredReportDocs.length === 0,
      docs: filteredReportDocs,
    };

    if (reportsSnap.empty) {
      return successResponse({
        date,
        mismatches: [] as MismatchRecord[],
        totalCount: 0,
        mismatchCount: 0,
      });
    }

    // 同日の現場日報を全件取得（siteId → FieldReport のマップを作成）
    const fieldReportsSnap = await db
      .collection('field_reports')
      .where('reportDate', '==', date)
      .get();

    const fieldReportsBySiteId = new Map<
      string,
      {
        id: string;
        totalWorkerCount: number;
        subcontractorWorks: SubcontractorWork[];
      }
    >();
    fieldReportsSnap.docs.forEach((doc) => {
      const data = doc.data();
      const siteId = data.siteId as string | undefined;
      if (siteId) {
        fieldReportsBySiteId.set(siteId, {
          id: doc.id,
          totalWorkerCount: (data.totalWorkerCount as number) ?? 0,
          subcontractorWorks: (data.subcontractorWorks as SubcontractorWork[]) ?? [],
        });
      }
    });

    // 日報に含まれるユーザーIDを収集してユーザー情報を一括取得
    const userIds = [
      ...new Set(reportsSnap.docs.map((doc) => doc.data().userId as string)),
    ];

    const usersMap = new Map<string, string>();
    const USER_ID_CHUNK_SIZE = 30; // Firestore IN クエリの上限
    for (let i = 0; i < userIds.length; i += USER_ID_CHUNK_SIZE) {
      const chunk = userIds.slice(i, i + USER_ID_CHUNK_SIZE);
      const usersSnap = await db
        .collection('users')
        .where('__name__', 'in', chunk)
        .get();
      usersSnap.docs.forEach((doc) => {
        const data = doc.data();
        usersMap.set(doc.id, (data.displayName as string) ?? '不明');
      });
    }

    // 各日報のtimeBlocksにある各siteIdを展開して照合
    const records: MismatchRecord[] = [];

    for (const doc of reportsSnap.docs) {
      const data = doc.data();
      const userId = data.userId as string;
      const timeBlocks = (data.timeBlocks as TimeBlock[]) ?? [];

      // siteIdが設定されているブロックのみ対象
      const siteIds = [
        ...new Set(
          timeBlocks
            .filter((block) => block.siteId !== null && block.siteId !== '')
            .map((block) => block.siteId as string)
        ),
      ];

      if (siteIds.length === 0) continue;

      const userName = usersMap.get(userId) ?? '不明';

      for (const siteId of siteIds) {
        // 当該現場のtimeBlocksから合計時間を算出
        const workerTotalHours = calcHoursForSite(timeBlocks, siteId);

        // 現場名は最初のブロックから取得
        const firstBlock = timeBlocks.find((b) => b.siteId === siteId);
        const siteName = firstBlock?.siteName ?? siteId;

        const fieldReport = fieldReportsBySiteId.get(siteId);

        let mismatchType: MismatchRecord['mismatchType'];
        let fieldReportId: string | null = null;
        let supervisorWorkerCount: number | null = null;

        // 要件: 30分（0.5時間）以上の差異で「要確認」
        const MISMATCH_THRESHOLD_HOURS = 0.5;

        if (!fieldReport) {
          // 現場日報が存在しない
          mismatchType = 'missing_field_report';
        } else {
          fieldReportId = fieldReport.id;
          supervisorWorkerCount = fieldReport.totalWorkerCount;

          // 監督の協力会社作業記録から稼働時間を計算
          const supervisorTotalHours = calcSupervisorHoursForSite(
            fieldReport.subcontractorWorks
          );

          if (supervisorTotalHours !== null) {
            // 監督の記録時間と作業員申告時間を比較
            // supervisorTotalHours は全協力会社の合計。
            // 作業員は1人分なので、監督側の1人あたり平均と比較する
            const avgSupervisorHours =
              supervisorWorkerCount > 0
                ? supervisorTotalHours / supervisorWorkerCount
                : supervisorTotalHours;
            const diff = Math.abs(workerTotalHours - avgSupervisorHours);
            mismatchType =
              diff >= MISMATCH_THRESHOLD_HOURS ? 'hours_mismatch' : 'ok';
          } else if (supervisorWorkerCount > 0) {
            // 時刻記録なし・人数のみ記録: 人数がゼロでなければ作業員は現場に居たとみなす
            // 申告時間が8時間と0.5時間以上ずれている場合のみ警告
            const STANDARD_WORK_HOURS = 8;
            const diff = Math.abs(workerTotalHours - STANDARD_WORK_HOURS);
            mismatchType =
              diff >= MISMATCH_THRESHOLD_HOURS ? 'hours_mismatch' : 'ok';
          } else {
            // 人数も時刻も記録なし: 比較不可
            mismatchType = 'ok';
          }
        }

        records.push({
          userId,
          userName,
          reportId: doc.id,
          siteId,
          siteName,
          workerTotalHours,
          fieldReportId,
          supervisorWorkerCount,
          mismatchType,
        });
      }
    }

    const mismatchCount = records.filter((r) => r.mismatchType !== 'ok').length;

    return successResponse({
      date,
      mismatches: records,
      totalCount: records.length,
      mismatchCount,
    });
  } catch (error) {
    console.error('照合チェックエラー:', error);
    return serverErrorResponse();
  }
}
