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

export type LeaveStatus =
  (typeof LEAVE_STATUS)[keyof typeof LEAVE_STATUS];

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
  leaveDate: string; // "YYYY-MM-DD"
  leaveType: LeaveType;
  reason: string | null;
  status: LeaveStatus;
  approvedBy: string | null;
  approvedAt: Timestamp | null;
  createdAt: Timestamp;
}

/** 有給休暇申請（ユーザー名付き） */
export interface LeaveRequestWithUser extends LeaveRequest {
  userName: string;
}

/** 有給残日数履歴ドキュメント型 */
export interface LeaveBalanceLog {
  id: string;
  userId: string;
  changeType: BalanceChangeType;
  changeDays: number; // 使用時はマイナス値
  balanceAfter: number;
  note: string | null;
  createdAt: Timestamp;
}

/** 有給申請作成時の入力型 */
export interface CreateLeaveRequestInput {
  leaveDate: string;
  leaveType: LeaveType;
  reason?: string;
}
