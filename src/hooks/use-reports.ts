'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getIdToken } from '@/lib/firebase/auth';
import { queryKeys } from '@/lib/query/keys';
import type { DailyReport, DailyReportWithUser, ReportFilter, CreateReportInput } from '@/types/report';
import type { ApiSuccessResponse, BulkApproveResponse, MismatchCheckResponse } from '@/types/api';

/** APIリクエストのヘッダーを取得 */
async function getAuthHeaders(): Promise<HeadersInit> {
  const token = await getIdToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/** 日報一覧を取得 */
export function useReports(filters?: ReportFilter) {
  return useQuery({
    queryKey: queryKeys.reports.list(filters),
    queryFn: async (): Promise<DailyReportWithUser[]> => {
      const params = new URLSearchParams();
      if (filters?.userId) params.set('userId', filters.userId);
      if (filters?.status) params.set('status', filters.status);
      if (filters?.startDate) params.set('startDate', filters.startDate);
      if (filters?.endDate) params.set('endDate', filters.endDate);

      const headers = await getAuthHeaders();
      const res = await fetch(`/api/reports?${params.toString()}`, { headers });
      if (!res.ok) throw new Error('日報の取得に失敗しました');
      const json = (await res.json()) as ApiSuccessResponse<DailyReportWithUser[]>;
      return json.data;
    },
  });
}

/** 日報詳細を取得 */
export function useReport(id: string) {
  return useQuery({
    queryKey: queryKeys.reports.detail(id),
    queryFn: async (): Promise<DailyReportWithUser> => {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/reports/${id}`, { headers });
      if (!res.ok) throw new Error('日報の取得に失敗しました');
      const json = (await res.json()) as ApiSuccessResponse<DailyReportWithUser>;
      return json.data;
    },
    enabled: !!id,
  });
}

/** 日報作成のミューテーション入力型（timeBlocksベース + status） */
type CreateReportMutationInput = CreateReportInput & { status?: 'draft' | 'submitted' };

/** 日報を作成 */
export function useCreateReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateReportMutationInput): Promise<DailyReport> => {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(
          (json as { message?: string }).message ?? '日報の作成に失敗しました'
        );
      }
      return (json as ApiSuccessResponse<DailyReport>).data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.reports.all });
    },
  });
}

/** 日報を一括承認 */
export function useBulkApprove() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (reportIds: string[]): Promise<BulkApproveResponse> => {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/reports/bulk-approve', {
        method: 'POST',
        headers,
        body: JSON.stringify({ reportIds }),
      });
      if (!res.ok) throw new Error('一括承認に失敗しました');
      const json = (await res.json()) as ApiSuccessResponse<BulkApproveResponse>;
      return json.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.reports.all });
      void queryClient.invalidateQueries({
        queryKey: ['dashboard'],
      });
    },
  });
}

/** 日報を承認（S/Aロール用） */
export function useApproveReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (reportId: string): Promise<void> => {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/reports/${reportId}/approve`, {
        method: 'PUT',
        headers,
      });
      if (!res.ok) throw new Error('承認に失敗しました');
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.reports.all });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

/** 日報を差し戻し */
export function useRejectReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      reportId,
      rejectReason,
    }: {
      reportId: string;
      rejectReason: string;
    }): Promise<void> => {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/reports/${reportId}/reject`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ rejectReason }),
      });
      if (!res.ok) throw new Error('差し戻しに失敗しました');
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.reports.all });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

/**
 * 現場監督確認（Gロール用）
 * PUT /api/reports/:id/approve を呼び、サーバー側でロールに応じたステータス遷移を行う
 */
export function useSupervisorConfirm() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (reportId: string): Promise<void> => {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/reports/${reportId}/approve`, {
        method: 'PUT',
        headers,
      });
      if (!res.ok) throw new Error('確認処理に失敗しました');
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.reports.all });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

/**
 * 施工部長チェック（Bロール用）
 * PUT /api/reports/:id/approve を呼び、サーバー側でロールに応じたステータス遷移を行う
 */
export function useManagerCheck() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (reportId: string): Promise<void> => {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/reports/${reportId}/approve`, {
        method: 'PUT',
        headers,
      });
      if (!res.ok) throw new Error('チェック処理に失敗しました');
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.reports.all });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

/**
 * 照合チェック結果を取得（管理者・現場監督用）
 * GET /api/reports/mismatch?date=YYYY-MM-DD
 */
export function useMismatchCheck(date: string) {
  return useQuery({
    queryKey: queryKeys.mismatch.check(date),
    queryFn: async (): Promise<MismatchCheckResponse> => {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/reports/mismatch?date=${encodeURIComponent(date)}`, {
        headers,
      });
      if (!res.ok) throw new Error('照合チェックの取得に失敗しました');
      const json = (await res.json()) as ApiSuccessResponse<MismatchCheckResponse>;
      return json.data;
    },
    enabled: !!date,
  });
}
