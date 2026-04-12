import 'server-only';

import { type NextRequest } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/firebase/api-auth';
import {
  successResponse,
  unauthorizedResponse,
  forbiddenResponse,
  notFoundResponse,
  errorResponse,
  serverErrorResponse,
} from '@/lib/utils/api-response';
import { isAdminRole } from '@/types/user';
import type { DailyReport } from '@/types/report';
import { REPORT_STATUS } from '@/types/report';
import { LEAVE_STATUS, LEAVE_TYPE } from '@/types/leave';
import { calcConsumeDays } from '@/lib/utils/leave-calc';

/** 月給から時間単価を計算する定数 */
const SALARY_CONSTANTS = {
  /** 1日の所定労働時間 */
  STANDARD_HOURS_PER_DAY: 8,
  /** 月の所定労働日数（固定） */
  STANDARD_WORK_DAYS_PER_MONTH: 20,
  /** 残業割増率（法定1.25倍） */
  OVERTIME_RATE: 1.25,
  /** 夜間追加割増率（22時以降の追加割増分0.25） */
  NIGHT_PREMIUM_RATE: 0.25,
} as const;

/** 給与計算レスポンス型 */
interface SalaryMonthlyResponse {
  userId: string;
  year: number;
  month: number;
  workDays: number;
  totalHours: number;
  regularHours: number;
  overtimeHours: number;
  nightHours: number;
  /** 当月の承認済み有給休暇取得日数 */
  paidLeaveDays: number;
  /** 当月の承認済み有給休暇取得時間数 */
  paidLeaveHours: number;
  monthlySalary: number | null;
  hourlyRate: number | null;
  overtimePay: number | null;
  nightPremium: number | null;
  totalPay: number | null;
  note: '給与計算の最終確定は総務部長が実施します。これは参考値です。';
}

/** GET /api/salary/monthly?userId=xxx&year=2025&month=4 */
export async function GET(request: NextRequest): Promise<Response> {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const yearStr = searchParams.get('year');
    const monthStr = searchParams.get('month');

    if (!userId || !yearStr || !monthStr) {
      return errorResponse(
        'BAD_REQUEST',
        'userId, year, month は必須パラメータです',
        400
      );
    }

    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);

    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      return errorResponse(
        'BAD_REQUEST',
        'year, month の値が不正です',
        400
      );
    }

    // 認証チェック: 管理者ロールまたは自分のデータのみ
    if (!isAdminRole(auth.role) && auth.uid !== userId) {
      return forbiddenResponse();
    }

    const db = getAdminDb();

    // 対象ユーザーの取得
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return notFoundResponse('ユーザーが見つかりません');
    }

    const userData = userDoc.data();
    const monthlySalary: number | null = (userData?.['monthlySalary'] as number | null) ?? null;

    // 指定月の日付範囲を計算（YYYY-MM-DD形式）
    const monthPadded = String(month).padStart(2, '0');
    const startDate = `${year}-${monthPadded}-01`;

    // 月末日を計算
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${monthPadded}-${String(lastDay).padStart(2, '0')}`;

    // 承認済み以上（approved）の日報を取得
    // statusが supervisor_confirmed, manager_checked, approved の場合も集計対象とする
    const approvedStatuses = [
      REPORT_STATUS.APPROVED,
      REPORT_STATUS.MANAGER_CHECKED,
      REPORT_STATUS.SUPERVISOR_CONFIRMED,
    ];

    // 複合インデックスを避けるため userId のみで絞り込み、
    // 日付フィルタと status フィルタは JS 側で行う
    const snapshot = await db
      .collection('daily_reports')
      .where('userId', '==', userId)
      .orderBy('reportDate', 'desc')
      .get();

    // 承認済み以上かつ指定月の範囲内のレポートのみフィルタ
    const reports = snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() } as DailyReport))
      .filter(
        (report) =>
          (approvedStatuses as string[]).includes(report.status) &&
          report.reportDate >= startDate &&
          report.reportDate <= endDate
      );

    // 月次サマリの集計
    const workDays = reports.length;
    let totalRegularHours = 0;
    let totalOvertimeHours = 0;
    let totalNightHours = 0;

    for (const report of reports) {
      totalRegularHours += report.totalRegularHours ?? 0;
      totalOvertimeHours += report.totalOvertimeHours ?? 0;
      totalNightHours += report.totalNightHours ?? 0;
    }

    const totalHours = totalRegularHours + totalOvertimeHours;

    // 当月の承認済み有給申請を取得
    // userId のみで絞り込み、月フィルタは JS 側で適用
    const leaveSnap = await db
      .collection('leave_requests')
      .where('userId', '==', userId)
      .where('status', '==', LEAVE_STATUS.APPROVED)
      .get();

    let paidLeaveDays = 0;
    let paidLeaveHours = 0;

    leaveSnap.docs.forEach((doc) => {
      const data = doc.data();
      const leaveDate = data.leaveDate as string | undefined;
      const leaveType = data.leaveType as string | undefined;

      // 有給休暇のみカウント（特別休暇・欠勤は対象外）
      if (leaveType !== LEAVE_TYPE.PAID) return;

      // 指定月内の日付かチェック
      if (!leaveDate || leaveDate < startDate || leaveDate > endDate) return;

      const consumeDays = calcConsumeDays(
        data.leaveUnit as string,
        data.leaveHours as number | null
      );
      paidLeaveDays += consumeDays;
      // 日数 × 8時間 = 時間換算
      paidLeaveHours += consumeDays * SALARY_CONSTANTS.STANDARD_HOURS_PER_DAY;
    });

    // 給与計算（monthlySalaryがある場合のみ）
    let hourlyRate: number | null = null;
    let overtimePay: number | null = null;
    let nightPremium: number | null = null;
    let totalPay: number | null = null;

    if (monthlySalary !== null && monthlySalary > 0) {
      // 時間単価 = 月給 ÷ (所定時間/日 × 月所定労働日数)
      hourlyRate =
        monthlySalary /
        (SALARY_CONSTANTS.STANDARD_HOURS_PER_DAY *
          SALARY_CONSTANTS.STANDARD_WORK_DAYS_PER_MONTH);

      // 残業代 = 時間単価 × 残業割増率 × 残業時間
      overtimePay =
        hourlyRate * SALARY_CONSTANTS.OVERTIME_RATE * totalOvertimeHours;

      // 夜間割増 = 時間単価 × 夜間追加割増率 × 夜間時間
      nightPremium =
        hourlyRate * SALARY_CONSTANTS.NIGHT_PREMIUM_RATE * totalNightHours;

      // 合計推定給与 = 月給 + 残業代 + 夜間割増
      totalPay = monthlySalary + overtimePay + nightPremium;

      // 小数点以下を整数に丸める
      hourlyRate = Math.round(hourlyRate);
      overtimePay = Math.round(overtimePay);
      nightPremium = Math.round(nightPremium);
      totalPay = Math.round(totalPay);
    }

    const response: SalaryMonthlyResponse = {
      userId,
      year,
      month,
      workDays,
      totalHours: Math.round(totalHours * 100) / 100,
      regularHours: Math.round(totalRegularHours * 100) / 100,
      overtimeHours: Math.round(totalOvertimeHours * 100) / 100,
      nightHours: Math.round(totalNightHours * 100) / 100,
      paidLeaveDays: Math.round(paidLeaveDays * 100) / 100,
      paidLeaveHours: Math.round(paidLeaveHours * 100) / 100,
      monthlySalary,
      hourlyRate,
      overtimePay,
      nightPremium,
      totalPay,
      note: '給与計算の最終確定は総務部長が実施します。これは参考値です。',
    };

    return successResponse(response);
  } catch (error) {
    console.error('給与計算API エラー:', error);
    return serverErrorResponse();
  }
}
