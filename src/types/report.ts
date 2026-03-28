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

/** 時間帯別作業エントリ */
export interface WorkEntry {
  startTime: string; // "HH:mm"
  endTime: string; // "HH:mm"
  content: string;
}

/** 承認情報 */
export interface ApprovalRecord {
  uid: string;
  displayName: string;
  approvedAt: Timestamp | null;
}

/** 日報ドキュメント型 */
export interface DailyReport {
  id: string;
  userId: string;
  reportDate: string; // "YYYY-MM-DD"
  startTime: string; // "HH:mm" 全体の開始時刻
  endTime: string; // "HH:mm" 全体の終了時刻
  /** 時間帯別の作業内容 */
  workEntries: WorkEntry[];
  /** 後方互換: workEntriesが無い古いデータ用 */
  workContent: string;
  notes: string | null;
  regularHours: number;
  overtimeHours: number;
  status: ReportStatus;
  /** 承認者UID（後方互換） */
  approvedBy: string | null;
  /** 承認者名 */
  approvedByName: string | null;
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
  workEntries: WorkEntry[];
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
