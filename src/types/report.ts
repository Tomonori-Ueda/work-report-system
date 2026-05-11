import type { Timestamp } from 'firebase/firestore';
import { EXECUTIVE_TITLE, type ExecutiveTitle } from './user';

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

/**
 * 4枠承認の押印エントリ。各 slot に1件ずつ。
 * approvedAt はサーバータイムスタンプ。
 */
export interface ApprovalEntry {
  uid: string;
  displayName: string;
  approvedAt: Timestamp;
}

/**
 * 4枠承認のデータ構造。slot ごとに押印済みなら ApprovalEntry、未押印なら null。
 */
export interface ReportApprovals {
  /** 施工部長（ロール B） */
  construction_manager: ApprovalEntry | null;
  /** 常務（ロール A + executiveTitle: managing） */
  managing: ApprovalEntry | null;
  /** 専務（ロール A + executiveTitle: executive） */
  executive: ApprovalEntry | null;
  /** 社長（ロール S） */
  president: ApprovalEntry | null;
}

/**
 * 4枠承認の表示順序。
 * 施工部長 → 社長 → 専務 → 常務
 *
 * Why: 実行順序は「施工部長が最初、残り3枠は順不同」だが、
 * UI表示やイテレーション用に固定順序を定義する。
 */
export const APPROVAL_ORDER = [
  EXECUTIVE_TITLE.CONSTRUCTION_MANAGER,
  EXECUTIVE_TITLE.PRESIDENT,
  EXECUTIVE_TITLE.EXECUTIVE,
  EXECUTIVE_TITLE.MANAGING,
] as const satisfies readonly ExecutiveTitle[];

/**
 * 施工部長より後の「並列承認」対象 slot 一覧。
 * この3枠は施工部長押印後であれば順不同で押印可能。
 */
const PARALLEL_SLOTS: readonly ApprovalSlot[] = [
  EXECUTIVE_TITLE.PRESIDENT,
  EXECUTIVE_TITLE.EXECUTIVE,
  EXECUTIVE_TITLE.MANAGING,
] as const;

export type ApprovalSlot = (typeof APPROVAL_ORDER)[number];

/** 空の approvals オブジェクトを生成（新規日報用） */
export function createEmptyApprovals(): ReportApprovals {
  return {
    construction_manager: null,
    managing: null,
    executive: null,
    president: null,
  };
}

/**
 * 指定 slot が「押印してよい」状態かを判定する。
 * - 施工部長: 自分の slot が未押印であればいつでも押印可能
 * - 社長/専務/常務: 施工部長が押印済み かつ 自分の slot が未押印
 *
 * Why: 施工部長が最初に押印し、残り3枠は順不同で並列承認可能とする運用。
 */
export function canApproveSlot(
  approvals: ReportApprovals,
  slot: ApprovalSlot
): boolean {
  // 施工部長は常に最初に押印可能（自分が未押印であれば）
  if (slot === EXECUTIVE_TITLE.CONSTRUCTION_MANAGER) {
    return approvals.construction_manager === null;
  }
  // 社長/専務/常務は施工部長が押印済みかつ自分が未押印なら OK
  if (!approvals.construction_manager) return false;
  return approvals[slot] === null;
}

/**
 * 自分の slot を取消してよいかを判定する。
 * - 施工部長: 後段（社長/専務/常務）に1つでも押印があれば取消不可
 * - 社長/専務/常務: 自分の slot が押印済みならいつでも取消可能（並列のため相互依存なし）
 */
export function canCancelSlot(
  approvals: ReportApprovals,
  slot: ApprovalSlot
): boolean {
  // 未押印の slot は取消できない
  if (approvals[slot] === null) return false;

  // 施工部長は後段に1つでも押印があれば取消不可
  if (slot === EXECUTIVE_TITLE.CONSTRUCTION_MANAGER) {
    return PARALLEL_SLOTS.every((s) => approvals[s] === null);
  }

  // 社長/専務/常務は並列なので、自分が押印済みならいつでも取消可能
  return true;
}

/** 4枠すべて押印済みなら true */
export function isFullyApproved(approvals: ReportApprovals): boolean {
  return APPROVAL_ORDER.every((slot) => approvals[slot] !== null);
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
  /** 承認者UID（後方互換: 4枠承認の最終押印者 = 社長と同義） */
  approvedBy: string | null;
  /** 承認者名（後方互換） */
  approvedByName: string | null;
  approvedAt: Timestamp | null;
  /**
   * 4枠承認の押印状況（施工部長→常務→専務→社長）。
   * 全 slot 押印で status=approved に遷移する。
   * 既存データには存在しないため optional。
   */
  approvals?: ReportApprovals;
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
