/** API成功レスポンス */
export interface ApiSuccessResponse<T> {
  data: T;
}

/** APIエラーレスポンス */
export interface ApiErrorResponse {
  error: string;
  message: string;
}

/** APIレスポンス共通型 */
export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

/** ページネーション付きレスポンス */
export interface PaginatedResponse<T> {
  data: T[];
  hasMore: boolean;
  nextCursor?: string;
}

/** 一括承認レスポンス */
export interface BulkApproveResponse {
  approvedCount: number;
  failedIds: string[];
}

/** 照合チェック: 個別の不一致レコード（時間ズレ・現場日報なし系） */
export interface MismatchRecord {
  userId: string;
  userName: string;
  reportId: string;
  siteId: string;
  siteName: string;
  /** 作業員が申告した当該現場での合計時間 */
  workerTotalHours: number;
  /** 現場日報のID（null = 未作成） */
  fieldReportId: string | null;
  /** 現場監督が記録した作業員総数（参考値） */
  supervisorWorkerCount: number | null;
  mismatchType: 'missing_field_report' | 'hours_mismatch' | 'ok';
}

/**
 * 名寄せ照合の結果区分（Phase 3 追加）
 * - name_missing : 監督が記載した人物が users にいるが同日の本人日報がない
 * - site_mismatch: 本人日報あり、しかし別現場で提出されている
 * - hours_mismatch: 同日同現場の本人日報があるが時間が30分以上ズレる
 * - ok           : 整合
 */
export type NameMismatchKind =
  | 'name_missing'
  | 'site_mismatch'
  | 'hours_mismatch'
  | 'ok';

/** 名寄せ照合 1件 */
export interface NameMismatchRecord {
  /** 監督が記載した名前（生の入力値、表示用） */
  recordedName: string;
  /** 監督側の現場ID */
  supervisorSiteId: string;
  /** 監督側の現場名 */
  supervisorSiteName: string;
  /** 監督側の現場日報ID */
  fieldReportId: string;
  /** マッチした作業員のUID（users）。マッチしなければ null */
  matchedUserId: string | null;
  /** マッチした作業員の displayName */
  matchedUserName: string | null;
  /** 本人日報のID（site_mismatch / hours_mismatch のとき） */
  workerReportId: string | null;
  /** 本人が出した日報の現場ID */
  workerSiteId: string | null;
  /** 本人が出した日報の現場名 */
  workerSiteName: string | null;
  kind: NameMismatchKind;
}

/** 照合チェックレスポンス */
export interface MismatchCheckResponse {
  date: string;
  /** 既存の時間ズレ・現場日報なし照合（作業員視点） */
  mismatches: MismatchRecord[];
  /** Phase 3: 名寄せ照合（監督視点） */
  nameMismatches: NameMismatchRecord[];
  totalCount: number;
  mismatchCount: number;
  /** 名寄せ不一致のタブ件数表示用サマリ */
  nameMismatchSummary: {
    nameMissing: number;
    siteMismatch: number;
    hoursMismatch: number;
  };
}

/** ダッシュボード提出状況レスポンス */
export interface DashboardStatusResponse {
  date: string;
  totalWorkers: number;
  submittedCount: number;
  notSubmittedCount: number;
  approvedCount: number;
  submittedUsers: Array<{
    userId: string;
    displayName: string;
    status: string;
  }>;
  notSubmittedUsers: Array<{
    userId: string;
    displayName: string;
  }>;
}
