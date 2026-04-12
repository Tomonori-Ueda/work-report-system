import type { TimeBlock } from '@/types/report';

/** 勤務時間に関する定数 */
const WORK_CONSTANTS = {
  /** 所定労働時間（分） */
  STANDARD_MINUTES: 480, // 8時間
  /** 残業丸め単位（分） */
  OVERTIME_ROUND_MINUTES: 15,
  /** デフォルト休憩開始 */
  DEFAULT_BREAK_START: '12:00',
  /** デフォルト休憩終了 */
  DEFAULT_BREAK_END: '13:00',
  /** 夜間割増開始時刻（分） 22:00 = 1320分 */
  NIGHT_START_MINUTES: 1320,
  /** 翌日0:00（分） */
  NEXT_DAY_MINUTES: 1440,
} as const;

/**
 * 時刻文字列（"HH:mm"）を当日0:00からの分数に変換
 * @example timeToMinutes("08:30") => 510
 */
export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  if (hours === undefined || minutes === undefined) {
    throw new Error(`不正な時刻形式: ${time}`);
  }
  return hours * 60 + minutes;
}

/**
 * 分数を時間（小数）に変換し、15分刻みで丸める
 * @example minutesToHours(510) => 8.5
 */
export function minutesToHours(minutes: number): number {
  return Math.round((minutes / 60) * 100) / 100;
}

/**
 * 休憩時間（分）を計算
 * 勤務時間帯と休憩時間帯の重なりを正確に計算する
 */
function calculateBreakMinutes(
  startMinutes: number,
  endMinutes: number,
  breakStartMinutes: number,
  breakEndMinutes: number
): number {
  // 重なりの開始 = MAX(勤務開始, 休憩開始)
  const overlapStart = Math.max(startMinutes, breakStartMinutes);
  // 重なりの終了 = MIN(勤務終了, 休憩終了)
  const overlapEnd = Math.min(endMinutes, breakEndMinutes);
  // 重なりがない場合は0
  return Math.max(0, overlapEnd - overlapStart);
}

/** 労働時間計算の入力 */
export interface WorkHoursInput {
  startTime: string; // "HH:mm"
  endTime: string; // "HH:mm"
  breakStartTime?: string; // デフォルト "12:00"
  breakEndTime?: string; // デフォルト "13:00"
}

/** 労働時間計算の結果 */
export interface WorkHoursResult {
  /** 実労働時間（時間単位、小数） */
  regularHours: number;
  /** 残業時間（時間単位、小数、15分刻み） */
  overtimeHours: number;
  /** 実労働時間（分） */
  totalWorkMinutes: number;
  /** 休憩時間（分） */
  breakMinutes: number;
}

/**
 * 夜間時間（22:00以降）の計算
 * @param startTime 開始時刻 "HH:mm"
 * @param endTime 終了時刻 "HH:mm"
 * @returns 夜間時間（時間単位、小数）
 */
export function calculateNightHours(startTime: string, endTime: string): number {
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);

  if (endMinutes <= startMinutes) {
    return 0;
  }

  // 22:00（1320分）以降の時間と勤務時間の重なりを計算
  const nightOverlapStart = Math.max(startMinutes, WORK_CONSTANTS.NIGHT_START_MINUTES);
  const nightOverlapEnd = Math.min(endMinutes, WORK_CONSTANTS.NEXT_DAY_MINUTES);
  const nightMinutes = Math.max(0, nightOverlapEnd - nightOverlapStart);

  return minutesToHours(nightMinutes);
}

/**
 * 単一時間ブロックの労働時間計算
 * - regularHours: 所定労働時間内の時間（最大8h相当の分）
 * - overtimeHours: 残業時間（15分刻み切り捨て）
 * - nightHours: 22:00以降の時間
 */
export function calculateBlockHours(
  block: Pick<TimeBlock, 'startTime' | 'endTime'>
): {
  regularHours: number;
  overtimeHours: number;
  nightHours: number;
} {
  const startMinutes = timeToMinutes(block.startTime);
  const endMinutes = timeToMinutes(block.endTime);

  if (endMinutes <= startMinutes) {
    return { regularHours: 0, overtimeHours: 0, nightHours: 0 };
  }

  const totalMinutes = endMinutes - startMinutes;

  // 残業（このブロック単体での8h超過）
  const overtimeRaw = Math.max(0, totalMinutes - WORK_CONSTANTS.STANDARD_MINUTES);
  const overtime15min =
    Math.floor(overtimeRaw / WORK_CONSTANTS.OVERTIME_ROUND_MINUTES) *
    WORK_CONSTANTS.OVERTIME_ROUND_MINUTES;

  const regularMinutes = Math.min(totalMinutes, WORK_CONSTANTS.STANDARD_MINUTES);
  const nightHours = calculateNightHours(block.startTime, block.endTime);

  return {
    regularHours: minutesToHours(regularMinutes),
    overtimeHours: minutesToHours(overtime15min),
    nightHours,
  };
}

/**
 * 複数時間ブロックの合計時間計算
 * - totalRegularHours: 全ブロック合計の所定内時間（合計8h超過分は残業に振り替え）
 * - totalOvertimeHours: 合計8h超過分（15分刻み切り捨て）
 * - totalNightHours: 全ブロック合計の夜間時間
 */
export function calculateTotalHours(
  timeBlocks: Pick<TimeBlock, 'startTime' | 'endTime'>[]
): {
  totalRegularHours: number;
  totalOvertimeHours: number;
  totalNightHours: number;
} {
  if (timeBlocks.length === 0) {
    return { totalRegularHours: 0, totalOvertimeHours: 0, totalNightHours: 0 };
  }

  // 全ブロックの合計実労働時間（分）と夜間時間（分）を集計
  let totalWorkMinutes = 0;
  let totalNightMinutes = 0;

  for (const block of timeBlocks) {
    const startMinutes = timeToMinutes(block.startTime);
    const endMinutes = timeToMinutes(block.endTime);
    if (endMinutes > startMinutes) {
      totalWorkMinutes += endMinutes - startMinutes;
      // 夜間時間（分）
      const nightOverlapStart = Math.max(startMinutes, WORK_CONSTANTS.NIGHT_START_MINUTES);
      const nightOverlapEnd = Math.min(endMinutes, WORK_CONSTANTS.NEXT_DAY_MINUTES);
      totalNightMinutes += Math.max(0, nightOverlapEnd - nightOverlapStart);
    }
  }

  // 合計での残業判定（8h超過を残業とする）
  const overtimeRaw = Math.max(0, totalWorkMinutes - WORK_CONSTANTS.STANDARD_MINUTES);
  const overtime15min =
    Math.floor(overtimeRaw / WORK_CONSTANTS.OVERTIME_ROUND_MINUTES) *
    WORK_CONSTANTS.OVERTIME_ROUND_MINUTES;

  const regularMinutes = Math.min(totalWorkMinutes, WORK_CONSTANTS.STANDARD_MINUTES);

  return {
    totalRegularHours: minutesToHours(regularMinutes),
    totalOvertimeHours: minutesToHours(overtime15min),
    totalNightHours: minutesToHours(totalNightMinutes),
  };
}

/**
 * 時間ブロックの重複チェック
 * 1分でも重なっていれば true を返す
 */
export function hasOverlappingBlocks(
  timeBlocks: Pick<TimeBlock, 'startTime' | 'endTime'>[]
): boolean {
  if (timeBlocks.length < 2) {
    return false;
  }

  // 開始時刻でソートして隣接ブロック同士で重複を確認
  const sorted = [...timeBlocks]
    .map((b) => ({
      start: timeToMinutes(b.startTime),
      end: timeToMinutes(b.endTime),
    }))
    .sort((a, b) => a.start - b.start);

  for (let i = 0; i < sorted.length - 1; i++) {
    const current = sorted[i];
    const next = sorted[i + 1];
    // current.end > next.start なら重複あり
    if (current !== undefined && next !== undefined && current.end > next.start) {
      return true;
    }
  }

  return false;
}

/**
 * 労働時間・残業時間を計算する（後方互換 API）
 *
 * 計算ルール:
 * 1. 実労働時間 = 勤務時間 - 休憩時間（休憩と勤務の重なり部分のみ除外）
 * 2. 所定労働時間 = MIN(実労働時間, 480分 = 8時間)
 * 3. 残業時間 = MAX(0, 実労働時間 - 480分)、15分刻み切り捨て
 *
 * @deprecated 新規実装では calculateBlockHours / calculateTotalHours を使用すること
 */
export function calculateWorkingHours(input: WorkHoursInput): WorkHoursResult {
  const startMinutes = timeToMinutes(input.startTime);
  const endMinutes = timeToMinutes(input.endTime);
  const breakStartMinutes = timeToMinutes(
    input.breakStartTime ?? WORK_CONSTANTS.DEFAULT_BREAK_START
  );
  const breakEndMinutes = timeToMinutes(
    input.breakEndTime ?? WORK_CONSTANTS.DEFAULT_BREAK_END
  );

  // 勤務時間（分）
  const totalMinutes = endMinutes - startMinutes;

  // 休憩時間の除外（勤務時間と休憩時間の重なり部分のみ）
  const breakMinutes = calculateBreakMinutes(
    startMinutes,
    endMinutes,
    breakStartMinutes,
    breakEndMinutes
  );

  // 実労働時間（分）
  const actualWorkMinutes = totalMinutes - breakMinutes;

  // calculateBlockHours の内部ロジックを再利用して残業計算
  const overtimeRaw = Math.max(0, actualWorkMinutes - WORK_CONSTANTS.STANDARD_MINUTES);
  const overtime15min =
    Math.floor(overtimeRaw / WORK_CONSTANTS.OVERTIME_ROUND_MINUTES) *
    WORK_CONSTANTS.OVERTIME_ROUND_MINUTES;

  const regularMinutes = Math.min(actualWorkMinutes, WORK_CONSTANTS.STANDARD_MINUTES);

  return {
    regularHours: minutesToHours(regularMinutes),
    overtimeHours: minutesToHours(overtime15min),
    totalWorkMinutes: actualWorkMinutes,
    breakMinutes,
  };
}

/**
 * 分数を "Xh YYm" 形式の文字列に変換
 * @example formatMinutesToDisplay(510) => "8h 30m"
 */
export function formatMinutesToDisplay(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${String(mins).padStart(2, '0')}m`;
}
