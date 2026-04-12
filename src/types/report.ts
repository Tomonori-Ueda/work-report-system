import type { Timestamp } from 'firebase/firestore';

/** 時間ブロック（複数追加可能） */
export interface TimeBlock {
  /** クライアント側のユニークID（nanoid等） */
  id: string;
  /** 開始時刻 "HH:mm" */
  startTime: string;
  /** 終了時刻 "HH:mm" */
  endTime: string;
  /** 現場マスターのID（未選択時はnull） */
  siteId: string | null;
  /** 現場名（マスター名 or 手入力） */
  siteName: string;
  /** 作業内容 */
  workContent: string;
}

/** 日報ステータス（5ステップ） */
export const REPORT_STATUS = {
  DRAFT: 'draft',                              // 下書き
  SUBMITTED: 'submitted',                      // 提出済み（作業員→現場監督待ち）
  SUPERVISOR_CONFIRMED: 'supervisor_confirmed', // 現場監督確認済み
  MANAGER_CHECKED: 'manager_checked',          // 施工部長チェック済み
  APPROVED: 'approved',                        // 専務/常務/社長承認済み
  REJECTED: 'rejected',                        // 差し戻し
} as const;

export type ReportStatus = (typeof REPORT_STATUS)[keyof typeof REPORT_STATUS];

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
  /** 日付 "YYYY-MM-DD" */
  reportDate: string;
  /** 時間ブロック（複数） */
  timeBlocks: TimeBlock[];
  // 後方互換フィールド（既存データ用）
  startTime?: string;
  endTime?: string;
  workContent?: string;
  /** 時間帯別の作業内容（後方互換） */
  workEntries?: WorkEntry[];
  // 集計値
  totalRegularHours: number;
  totalOvertimeHours: number;
  /** 22時以降の深夜時間 */
  totalNightHours: number;
  notes: string | null;
  status: ReportStatus;
  // 承認フロー
  /** 確認した現場監督UID */
  supervisorId: string | null;
  supervisorConfirmedAt: Timestamp | null;
  /** チェックした施工部長UID */
  checkedBy: string | null;
  checkedAt: Timestamp | null;
  /** 承認者UID */
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
  timeBlocks: Omit<TimeBlock, 'id'>[];
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
