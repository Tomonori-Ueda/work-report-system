import { addMonths, addYears, parseISO, isAfter, isBefore, format } from 'date-fns';
import { LEGAL_LEAVE_GRANT_SCHEDULE } from '@/types/leave';

/** 付与スケジュール1エントリ */
export interface GrantEntry {
  /** 付与日 "YYYY-MM-DD" */
  grantDate: string;
  /** 付与日数 */
  grantDays: number;
  /** 有効期限 "YYYY-MM-DD"（付与日から2年後） */
  expiryDate: string;
}

/**
 * 入社日から、指定日時点での有給付与スケジュールを返す。
 * 各エントリは「何日に何日付与されるか」を表す。
 * 指定日（asOfDate）以前の付与分のみ返す。
 *
 * @param hireDate  入社日 "YYYY-MM-DD"
 * @param asOfDate  基準日 "YYYY-MM-DD"（省略時は今日）
 */
export function getGrantSchedule(
  hireDate: string,
  asOfDate?: string
): GrantEntry[] {
  const hireDateObj = parseISO(hireDate);
  const asOf = asOfDate ? parseISO(asOfDate) : new Date();

  return LEGAL_LEAVE_GRANT_SCHEDULE.flatMap((schedule) => {
    const { yearsOfService, grantDays } = schedule;

    // yearsOfService は 0.5 刻みなので、0.5年 = 6ヶ月 として計算
    const fullYears = Math.floor(yearsOfService);
    const hasHalfYear = yearsOfService % 1 !== 0;

    let grantDateObj = addYears(hireDateObj, fullYears);
    if (hasHalfYear) {
      grantDateObj = addMonths(grantDateObj, 6);
    }

    // 基準日より未来の付与分は除外
    if (isAfter(grantDateObj, asOf)) {
      return [];
    }

    const expiryDateObj = addYears(grantDateObj, 2);

    return [
      {
        grantDate: format(grantDateObj, 'yyyy-MM-dd'),
        grantDays,
        expiryDate: format(expiryDateObj, 'yyyy-MM-dd'),
      },
    ];
  });
}

/** 有給残日数の上限（法定：最大60日ストック可能） */
export const ANNUAL_LEAVE_MAX_DAYS = 60;

/**
 * 指定日時点での理論上の有給残日数を計算する（純粋に付与スケジュールから算出）。
 * 有効期限切れの付与分を除外し、上限60日でカットする。
 * 実際の残日数は Firestore の leave_balance_logs から計算するため、これは参考値。
 *
 * @param hireDate  入社日 "YYYY-MM-DD"
 * @param asOfDate  基準日 "YYYY-MM-DD"（省略時は今日）
 */
export function calculateTheoreticalBalance(
  hireDate: string,
  asOfDate?: string
): number {
  const asOf = asOfDate ? parseISO(asOfDate) : new Date();
  const schedule = getGrantSchedule(hireDate, asOfDate);

  // 有効期限切れでない付与分の合計（上限60日でキャップ）
  const total = schedule.reduce((sum, entry) => {
    const expiryDateObj = parseISO(entry.expiryDate);
    // 有効期限が asOf より後（または同日）であれば有効
    if (!isBefore(expiryDateObj, asOf)) {
      return sum + entry.grantDays;
    }
    return sum;
  }, 0);

  return Math.min(total, ANNUAL_LEAVE_MAX_DAYS);
}

/**
 * 指定日時点で有効期限が近い付与分のリストを返す（警告表示用）。
 * 指定日から daysThreshold 日以内に期限切れになる付与分を返す。
 *
 * @param hireDate      入社日 "YYYY-MM-DD"
 * @param daysThreshold 警告の閾値（日数）、デフォルト30日
 * @param asOfDate      基準日 "YYYY-MM-DD"（省略時は今日）
 */
export function getExpiringGrants(
  hireDate: string,
  daysThreshold = 30,
  asOfDate?: string
): GrantEntry[] {
  const asOf = asOfDate ? parseISO(asOfDate) : new Date();
  // daysThreshold 日後の日付を計算
  const alertDate = new Date(asOf);
  alertDate.setDate(alertDate.getDate() + daysThreshold);

  const schedule = getGrantSchedule(hireDate, asOfDate);

  return schedule.filter((entry) => {
    const expiryDateObj = parseISO(entry.expiryDate);
    // 有効期限が asOf より後かつ alertDate 以前のもの（期限切れ間近）
    return !isBefore(expiryDateObj, asOf) && !isAfter(expiryDateObj, alertDate);
  });
}

/** 次回付与情報 */
export interface NextGrantInfo {
  /** 次回付与日 "YYYY-MM-DD" */
  nextGrantDate: string;
  /** 次回付与日数 */
  nextGrantDays: number;
}

/**
 * 入社日から次回付与日と付与日数を返す。
 * 既に最大付与（6年6ヶ月超）に達している場合は null を返す。
 *
 * @param hireDate  入社日 "YYYY-MM-DD"
 * @param asOfDate  基準日 "YYYY-MM-DD"（省略時は今日）
 */
export function getNextGrantInfo(
  hireDate: string,
  asOfDate?: string
): NextGrantInfo | null {
  const hireDateObj = parseISO(hireDate);
  const asOf = asOfDate ? parseISO(asOfDate) : new Date();

  for (const schedule of LEGAL_LEAVE_GRANT_SCHEDULE) {
    const { yearsOfService, grantDays } = schedule;

    const fullYears = Math.floor(yearsOfService);
    const hasHalfYear = yearsOfService % 1 !== 0;

    let grantDateObj = addYears(hireDateObj, fullYears);
    if (hasHalfYear) {
      grantDateObj = addMonths(grantDateObj, 6);
    }

    // 基準日より未来の付与であれば次回付与
    if (isAfter(grantDateObj, asOf)) {
      return {
        nextGrantDate: format(grantDateObj, 'yyyy-MM-dd'),
        nextGrantDays: grantDays,
      };
    }
  }

  // 全スケジュール消化済み（6年6ヶ月超）→ 毎年20日付与が継続するが、
  // 法定スケジュール上は最終エントリ以降は同日数継続とみなす
  const lastSchedule =
    LEGAL_LEAVE_GRANT_SCHEDULE[LEGAL_LEAVE_GRANT_SCHEDULE.length - 1];
  if (lastSchedule === undefined) return null;

  // 最終付与から経過した年数を求め、1年後の付与日を返す
  const lastFullYears = Math.floor(lastSchedule.yearsOfService);
  const lastHasHalfYear = lastSchedule.yearsOfService % 1 !== 0;
  let lastGrantDateObj = addYears(hireDateObj, lastFullYears);
  if (lastHasHalfYear) {
    lastGrantDateObj = addMonths(lastGrantDateObj, 6);
  }

  // 最終付与日から何年経過したか
  const yearsAfterLast = Math.floor(
    (asOf.getTime() - lastGrantDateObj.getTime()) /
      (1000 * 60 * 60 * 24 * 365.25)
  );
  const nextGrantDateObj = addYears(lastGrantDateObj, yearsAfterLast + 1);

  return {
    nextGrantDate: format(nextGrantDateObj, 'yyyy-MM-dd'),
    nextGrantDays: lastSchedule.grantDays,
  };
}

/**
 * 有給申請単位から消費日数を計算する。
 * - full_day: 1日
 * - half_day_am / half_day_pm: 0.5日
 * - hourly: leaveHours / 8 日（例: 2時間 → 0.25日）
 *
 * @param leaveUnit  申請単位
 * @param leaveHours 時間数（hourly の場合のみ使用）
 */
export function calcConsumeDays(
  leaveUnit: string,
  leaveHours?: number | null
): number {
  switch (leaveUnit) {
    case 'full_day':
      return 1;
    case 'half_day_am':
    case 'half_day_pm':
      return 0.5;
    case 'hourly': {
      const hours = leaveHours ?? 0;
      // 0.25刻みで切り上げ（最小0.25日、最大1日）
      return Math.round((hours / 8) * 4) / 4;
    }
    default:
      return 1;
  }
}
