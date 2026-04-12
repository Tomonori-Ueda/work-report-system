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

/** 照合チェック: 個別の不一致レコード */
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

/** 照合チェックレスポンス */
export interface MismatchCheckResponse {
  date: string;
  mismatches: MismatchRecord[];
  totalCount: number;
  mismatchCount: number;
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
