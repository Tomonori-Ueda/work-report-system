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
 * 分数を時間（小数）に変換
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
 * 労働時間・残業時間を計算する
 *
 * 計算ルール:
 * 1. 実労働時間 = 勤務時間 - 休憩時間（休憩と勤務の重なり部分のみ除外）
 * 2. 所定労働時間 = MIN(実労働時間, 480分 = 8時間)
 * 3. 残業時間 = MAX(0, 実労働時間 - 480分)、15分刻み切り捨て
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

  // 所定労働時間内の時間
  const regularMinutes = Math.min(
    actualWorkMinutes,
    WORK_CONSTANTS.STANDARD_MINUTES
  );

  // 残業時間の計算（15分刻み切り捨て）
  const overtimeRaw = Math.max(
    0,
    actualWorkMinutes - WORK_CONSTANTS.STANDARD_MINUTES
  );
  const overtime15min =
    Math.floor(overtimeRaw / WORK_CONSTANTS.OVERTIME_ROUND_MINUTES) *
    WORK_CONSTANTS.OVERTIME_ROUND_MINUTES;

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
