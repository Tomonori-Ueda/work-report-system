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
import type {
  SubcontractorWork,
  OwnEmployee,
} from '@/types/field-report';
import type {
  MismatchRecord,
  NameMismatchRecord,
  NameMismatchKind,
} from '@/types/api';
import {
  normalizeName,
  indexUsersByNormalizedName,
} from '@/lib/utils/name-match';

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

    // 同日の現場日報を全件取得（siteId → FieldReport のマップを作成）
    // Phase 3 で名寄せにも使うため、reportsSnap が空でも取得する
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
    /**
     * 監督名寄せ照合に使う「現場日報1件分の主要情報」一覧。
     * Phase 3: ここから workerNames / ownEmployees を抽出して名寄せする。
     */
    const fieldReportEntries: Array<{
      id: string;
      siteId: string;
      siteName: string;
      subcontractorWorks: SubcontractorWork[];
      ownEmployees: OwnEmployee[];
    }> = [];
    fieldReportsSnap.docs.forEach((doc) => {
      const data = doc.data();
      const siteId = data.siteId as string | undefined;
      const siteName = (data.siteName as string | undefined) ?? siteId ?? '';
      const subWorks = (data.subcontractorWorks as SubcontractorWork[]) ?? [];
      const ownEmps = (data.ownEmployees as OwnEmployee[] | undefined) ?? [];
      if (siteId) {
        fieldReportsBySiteId.set(siteId, {
          id: doc.id,
          totalWorkerCount: (data.totalWorkerCount as number) ?? 0,
          subcontractorWorks: subWorks,
        });
        fieldReportEntries.push({
          id: doc.id,
          siteId,
          siteName,
          subcontractorWorks: subWorks,
          ownEmployees: ownEmps,
        });
      }
    });

    if (reportsSnap.empty && fieldReportEntries.length === 0) {
      return successResponse({
        date,
        mismatches: [] as MismatchRecord[],
        nameMismatches: [] as NameMismatchRecord[],
        totalCount: 0,
        mismatchCount: 0,
        nameMismatchSummary: { nameMissing: 0, siteMismatch: 0, hoursMismatch: 0 },
      });
    }

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

    // === Phase 3: 名寄せ照合のため、users 全件から「displayName 正規化 → user[]」を作る ===
    // Why: 監督が記載した名前は users の uid とは限らない（手書き）。
    //      同名衝突を検知するため配列で持つ。
    const allUsersSnap = await db
      .collection('users')
      .where('isActive', '==', true)
      .get();
    const activeUsers = allUsersSnap.docs.map((doc) => ({
      id: doc.id,
      displayName: (doc.data().displayName as string) ?? '',
    }));
    const usersByName = indexUsersByNormalizedName(activeUsers);

    // 同日提出済み日報を「uid → 報告」マップ化（名寄せ突合用）。
    // 1人が同日複数日報を出した場合は最後にループした方を保持する（通常運用では1件）。
    const reportsByUserId = new Map<string, {
      id: string;
      timeBlocks: TimeBlock[];
    }>();
    for (const doc of reportsSnap.docs) {
      const data = doc.data();
      const uid = data.userId as string;
      reportsByUserId.set(uid, {
        id: doc.id,
        timeBlocks: (data.timeBlocks as TimeBlock[]) ?? [],
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

    // ============================================================
    // Phase 3: 名寄せ照合
    // 各 field_report の作業員リスト（subcontractorWorks.workerNames + ownEmployees）
    // を取り出し、本人日報と突合する。
    // ============================================================
    const NAME_MISMATCH_THRESHOLD_HOURS = 0.5;
    const nameMismatches: NameMismatchRecord[] = [];

    for (const fr of fieldReportEntries) {
      // 監督が記載した「名前 + 直接 userId（あれば）」の対象リストを構築
      const targets: Array<{ recordedName: string; directUserId: string | null }> = [];
      for (const sw of fr.subcontractorWorks) {
        for (const name of sw.workerNames ?? []) {
          if (name.trim()) targets.push({ recordedName: name, directUserId: null });
        }
      }
      for (const oe of fr.ownEmployees) {
        if (oe.displayName.trim()) {
          targets.push({
            recordedName: oe.displayName,
            directUserId: oe.userId ?? null,
          });
        }
      }

      for (const t of targets) {
        // ユーザー特定: userId 直接指定があれば優先、無ければ正規化名で検索
        let matchedUser: { id: string; displayName: string } | null = null;
        if (t.directUserId) {
          const u = activeUsers.find((x) => x.id === t.directUserId);
          if (u) matchedUser = u;
        }
        if (!matchedUser) {
          const candidates = usersByName.get(normalizeName(t.recordedName)) ?? [];
          // 同名複数なら最初のもの（運用上はめったに発生しない想定）
          matchedUser = candidates[0] ?? null;
        }

        // === ケース1: users コレクションにマッチしない → 社外人員とみなしてスキップ ===
        // Why: 協力会社の作業員は users にいないのが正常。これを毎回 name_missing
        //      にすると不一致が膨大になり実用にならない。
        if (!matchedUser) continue;

        const workerReport = reportsByUserId.get(matchedUser.id);

        // === ケース2: 同日の本人日報がない → name_missing ===
        if (!workerReport) {
          nameMismatches.push({
            recordedName: t.recordedName,
            supervisorSiteId: fr.siteId,
            supervisorSiteName: fr.siteName,
            fieldReportId: fr.id,
            matchedUserId: matchedUser.id,
            matchedUserName: matchedUser.displayName,
            workerReportId: null,
            workerSiteId: null,
            workerSiteName: null,
            kind: 'name_missing',
          });
          continue;
        }

        // 本人日報の siteId 一覧
        const workerSiteIds = [
          ...new Set(
            workerReport.timeBlocks
              .filter((b) => b.siteId !== null && b.siteId !== '')
              .map((b) => b.siteId as string)
          ),
        ];

        const includesSupervisorSite = workerSiteIds.includes(fr.siteId);

        // === ケース3: 別現場で日報を出している → site_mismatch ===
        if (!includesSupervisorSite) {
          // 本人がどこに出していたかを表示用に取り出す（先頭のみ）
          const firstBlockWithSite = workerReport.timeBlocks.find(
            (b) => b.siteId !== null && b.siteId !== ''
          );
          nameMismatches.push({
            recordedName: t.recordedName,
            supervisorSiteId: fr.siteId,
            supervisorSiteName: fr.siteName,
            fieldReportId: fr.id,
            matchedUserId: matchedUser.id,
            matchedUserName: matchedUser.displayName,
            workerReportId: workerReport.id,
            workerSiteId: firstBlockWithSite?.siteId ?? null,
            workerSiteName: firstBlockWithSite?.siteName ?? null,
            kind: 'site_mismatch',
          });
          continue;
        }

        // === ケース4: 同日同現場の本人日報あり → 時間ズレを再評価 ===
        // 既存の MismatchRecord と重複するが、監督視点での再掲として nameMismatches にも入れる。
        // 監督側の同現場・同人物の時間が分かれば差分判定。
        const workerHoursAtSite = workerReport.timeBlocks
          .filter((b) => b.siteId === fr.siteId)
          .reduce((acc, b) => {
            const s = parseTimeToMinutes(b.startTime);
            const e = parseTimeToMinutes(b.endTime);
            if (s == null || e == null) return acc;
            return acc + Math.max(0, e - s) / 60;
          }, 0);

        // 監督側でその人物に対応する SubcontractorWork（時刻記録あり）の時間
        // 名前で逆引きする
        let supervisorIndividualHours: number | null = null;
        for (const sw of fr.subcontractorWorks) {
          const inThis = (sw.workerNames ?? []).some(
            (n) => normalizeName(n) === normalizeName(t.recordedName)
          );
          if (!inThis) continue;
          if (sw.startTime && sw.endTime) {
            const s = parseTimeToMinutes(sw.startTime);
            const e = parseTimeToMinutes(sw.endTime);
            if (s != null && e != null) {
              supervisorIndividualHours = Math.max(0, e - s) / 60;
            }
          }
        }
        // 自社作業員の場合
        if (supervisorIndividualHours == null) {
          const oe = fr.ownEmployees.find(
            (x) =>
              normalizeName(x.displayName) === normalizeName(t.recordedName) ||
              x.userId === matchedUser.id
          );
          if (oe?.startTime && oe.endTime) {
            const s = parseTimeToMinutes(oe.startTime);
            const e = parseTimeToMinutes(oe.endTime);
            if (s != null && e != null) {
              supervisorIndividualHours = Math.max(0, e - s) / 60;
            }
          }
        }

        let kind: NameMismatchKind = 'ok';
        if (supervisorIndividualHours != null) {
          const diff = Math.abs(workerHoursAtSite - supervisorIndividualHours);
          if (diff >= NAME_MISMATCH_THRESHOLD_HOURS) kind = 'hours_mismatch';
        }

        nameMismatches.push({
          recordedName: t.recordedName,
          supervisorSiteId: fr.siteId,
          supervisorSiteName: fr.siteName,
          fieldReportId: fr.id,
          matchedUserId: matchedUser.id,
          matchedUserName: matchedUser.displayName,
          workerReportId: workerReport.id,
          workerSiteId: fr.siteId,
          workerSiteName: fr.siteName,
          kind,
        });
      }
    }

    const nameMismatchSummary = {
      nameMissing: nameMismatches.filter((r) => r.kind === 'name_missing').length,
      siteMismatch: nameMismatches.filter((r) => r.kind === 'site_mismatch').length,
      hoursMismatch: nameMismatches.filter((r) => r.kind === 'hours_mismatch').length,
    };

    return successResponse({
      date,
      mismatches: records,
      nameMismatches,
      totalCount: records.length,
      mismatchCount,
      nameMismatchSummary,
    });
  } catch (error) {
    console.error('照合チェックエラー:', error);
    return serverErrorResponse();
  }
}
