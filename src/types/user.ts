import type { Timestamp } from 'firebase/firestore';

/** ユーザーロール（6段階） */
export const USER_ROLE = {
  S: 'S',           // 社長 - 全閲覧・全承認
  A: 'A',           // 専務・常務 - 現場ごと承認・全閲覧
  A_SPECIAL: 'A_special', // 総務部長 - 全閲覧のみ・承認不可
  B: 'B',           // 施工部長・経理担当 - 閲覧・チェックのみ
  G: 'G',           // 現場監督9名 - 現場日報入力・照合確認
  GENERAL: 'general', // 作業員・営業・設計 - 自分の日報入力のみ
} as const;

export type UserRole = (typeof USER_ROLE)[keyof typeof USER_ROLE];

/** ユーザードキュメント型 */
export interface User {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  department: string | null;
  annualLeaveBalance: number;
  isActive: boolean;
  /** 入社日（YYYY-MM-DD）。有給自動計算用 */
  hireDate: string | null;
  /** 月給（給与計算用） */
  monthlySalary: number | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** ユーザー作成時の入力型 */
export interface CreateUserInput {
  email: string;
  displayName: string;
  role: UserRole;
  department?: string;
  annualLeaveBalance?: number;
  hireDate?: string;
  monthlySalary?: number;
}

// -------------------------
// 権限チェックヘルパー関数
// -------------------------

/** 承認権限あり（S, A） */
export function canApprove(role: UserRole): boolean {
  return role === USER_ROLE.S || role === USER_ROLE.A;
}

/** 管理者系ロール（S, A, A_special, B） */
export function isAdminRole(role: UserRole): boolean {
  return (
    role === USER_ROLE.S ||
    role === USER_ROLE.A ||
    role === USER_ROLE.A_SPECIAL ||
    role === USER_ROLE.B
  );
}

/** 現場監督（G） */
export function isSupervisor(role: UserRole): boolean {
  return role === USER_ROLE.G;
}

/** 全閲覧権限（管理者系全員） */
export function canViewAll(role: UserRole): boolean {
  return isAdminRole(role);
}
