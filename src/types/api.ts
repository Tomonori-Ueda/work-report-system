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
