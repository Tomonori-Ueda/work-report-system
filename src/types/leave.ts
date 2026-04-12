import type { Timestamp } from 'firebase/firestore';

/** 休暇種別 */
export const LEAVE_TYPE = {
  PAID: 'paid',
  SPECIAL: 'special',
  UNPAID: 'unpaid',
} as const;

export type LeaveType = (typeof LEAVE_TYPE)[keyof typeof LEAVE_TYPE];

/** 休暇申請ステータス */
export const LEAVE_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const;

export type LeaveStatus = (typeof LEAVE_STATUS)[keyof typeof LEAVE_STATUS];

/** 休暇単位 */
export const LEAVE_UNIT = {
  FULL_DAY: 'full_day',       // 全日
  HALF_DAY_AM: 'half_day_am', // 午前半休
  HALF_DAY_PM: 'half_day_pm', // 午後半休
  HOURLY: 'hourly',           // 時間単位
} as const;

export type LeaveUnit = (typeof LEAVE_UNIT)[keyof typeof LEAVE_UNIT];

/** 有給残日数変更種別 */
export const BALANCE_CHANGE_TYPE = {
  GRANT: 'grant',
  USE: 'use',
  EXPIRE: 'expire',
  ADJUST: 'adjust',
} as const;

export type BalanceChangeType =
  (typeof BALANCE_CHANGE_TYPE)[keyof typeof BALANCE_CHANGE_TYPE];

/** 有給休暇申請ドキュメント型 */
export interface LeaveRequest {
  id: string;
  userId: string;
  /** 休暇日 "YYYY-MM-DD" */
  leaveDate: string;
  leaveType: LeaveType;
  /** 休暇単位 */
  leaveUnit: LeaveUnit;
  /** 時間単位有給の時間数（0.25刻み、例: 2.5時間）。時間単位以外はnull */
  leaveHours: number | null;
  /** 時間有給の開始時刻 "HH:mm" */
  startTime: string | null;
  /** 時間有給の終了時刻 "HH:mm" */
  endTime: string | null;
  reason: string | null;
  status: LeaveStatus;
  approvedBy: string | null;
  approvedAt: Timestamp | null;
  createdAt: Timestamp;
}

/** 有給残日数履歴ドキュメント型 */
export interface LeaveBalanceLog {
  id: string;
  userId: string;
  changeType: BalanceChangeType;
  /** 使用時はマイナス値 */
  changeDays: number;
  balanceAfter: number;
  note: string | null;
  createdAt: Timestamp;
}

/** 有給申請作成時の入力型 */
export interface CreateLeaveRequestInput {
  leaveDate: string;
  leaveType: LeaveType;
  leaveUnit?: LeaveUnit;
  leaveHours?: number;
  startTime?: string;
  endTime?: string;
  reason?: string;
}

/** 有給付与スケジュール（法定） */
export interface LeaveGrantSchedule {
  /** 勤続年数（0.5, 1.5, 2.5, ...） */
  yearsOfService: number;
  /** 付与日数 */
  grantDays: number;
}

/** 法定有給付与日数テーブル */
export const LEGAL_LEAVE_GRANT_SCHEDULE: LeaveGrantSchedule[] = [
  { yearsOfService: 0.5, grantDays: 10 },
  { yearsOfService: 1.5, grantDays: 11 },
  { yearsOfService: 2.5, grantDays: 12 },
  { yearsOfService: 3.5, grantDays: 14 },
  { yearsOfService: 4.5, grantDays: 16 },
  { yearsOfService: 5.5, grantDays: 18 },
  { yearsOfService: 6.5, grantDays: 20 },
];
