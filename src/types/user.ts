import type { Timestamp } from 'firebase/firestore';

/** ユーザーロール */
export const USER_ROLE = {
  WORKER: 'worker',
  ADMIN: 'admin',
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
}
