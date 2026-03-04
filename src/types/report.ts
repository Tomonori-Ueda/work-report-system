import type { Timestamp } from 'firebase/firestore';

/** 日報ステータス */
export const REPORT_STATUS = {
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const;

export type ReportStatus =
  (typeof REPORT_STATUS)[keyof typeof REPORT_STATUS];

/** 日報ドキュメント型 */
export interface DailyReport {
  id: string;
  userId: string;
  reportDate: string; // "YYYY-MM-DD"
  startTime: string; // "HH:mm"
  endTime: string; // "HH:mm"
  workContent: string;
  notes: string | null;
  regularHours: number;
  overtimeHours: number;
  status: ReportStatus;
  approvedBy: string | null;
  approvedAt: Timestamp | null;
  rejectReason: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** 日報作成時の入力型 */
export interface CreateReportInput {
  reportDate: string;
  startTime: string;
  endTime: string;
  workContent: string;
  notes?: string;
}

/** 日報一覧のフィルタ条件 */
export interface ReportFilter {
  userId?: string;
  status?: ReportStatus;
  startDate?: string;
  endDate?: string;
  department?: string;
}

/** 日報一覧アイテム（ユーザー名付き） */
export interface DailyReportWithUser extends DailyReport {
  userName: string;
  userDepartment: string | null;
}
