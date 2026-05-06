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

/**
 * 承認時の役職タイトル（4枠承認の slot を決定）
 * 同じロール A の中で「専務」と「常務」を区別するために使用。
 */
export const EXECUTIVE_TITLE = {
  PRESIDENT: 'president',                       // 社長（ロール S）
  EXECUTIVE: 'executive',                       // 専務（ロール A）
  MANAGING: 'managing',                         // 常務（ロール A）
  CONSTRUCTION_MANAGER: 'construction_manager', // 施工部長（ロール B）
} as const;

export type ExecutiveTitle =
  (typeof EXECUTIVE_TITLE)[keyof typeof EXECUTIVE_TITLE];

/** ユーザードキュメント型 */
export interface User {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  /**
   * 承認用の役職タイトル。null の場合は4枠承認には参加しない（一般作業員等）。
   * ロール A の中で「専務 (executive) / 常務 (managing)」を区別する目的で導入。
   * 既存ユーザーは null（マイグレーションで初期値を補う運用）。
   */
  executiveTitle: ExecutiveTitle | null;
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
  executiveTitle?: ExecutiveTitle | null;
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

/**
 * ロール + 役職から、4枠承認の slot を決定する。
 * 4枠承認に参加しないユーザーは null を返す。
 *
 * Why: ロール A は「専務」と「常務」を含むため、ロールだけでは
 * どちらの slot を埋めるか判別できない。`executiveTitle` で分岐する。
 */
export function getApprovalSlot(
  role: UserRole,
  executiveTitle: ExecutiveTitle | null | undefined
): ExecutiveTitle | null {
  if (role === USER_ROLE.S) return EXECUTIVE_TITLE.PRESIDENT;
  if (role === USER_ROLE.B) return EXECUTIVE_TITLE.CONSTRUCTION_MANAGER;
  if (role === USER_ROLE.A) {
    if (executiveTitle === EXECUTIVE_TITLE.EXECUTIVE) {
      return EXECUTIVE_TITLE.EXECUTIVE;
    }
    if (executiveTitle === EXECUTIVE_TITLE.MANAGING) {
      return EXECUTIVE_TITLE.MANAGING;
    }
    // ロールA で executiveTitle 未設定 → 旧データ。デフォルトは専務扱いとする
    return EXECUTIVE_TITLE.EXECUTIVE;
  }
  return null;
}
