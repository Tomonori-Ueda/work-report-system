'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getIdToken } from '@/lib/firebase/auth';
import { queryKeys } from '@/lib/query/keys';
import type { FieldReport, CreateFieldReportInput } from '@/types/field-report';
import type { ApiSuccessResponse } from '@/types/api';
import type { FieldReportFilter } from '@/lib/validations/field-report';

/** APIリクエストの認証ヘッダーを取得 */
async function getAuthHeaders(): Promise<HeadersInit> {
  const token = await getIdToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/** 現場日報一覧を取得 */
export function useFieldReports(filters?: FieldReportFilter) {
  return useQuery({
    queryKey: queryKeys.fieldReports.list(filters),
    queryFn: async (): Promise<{ fieldReports: FieldReport[] }> => {
      const params = new URLSearchParams();
      if (filters?.supervisorId) params.set('supervisorId', filters.supervisorId);
      if (filters?.siteId) params.set('siteId', filters.siteId);
      if (filters?.startDate) params.set('startDate', filters.startDate);
      if (filters?.endDate) params.set('endDate', filters.endDate);

      const headers = await getAuthHeaders();
      const res = await fetch(`/api/field-reports?${params.toString()}`, {
        headers,
      });
      if (!res.ok) throw new Error('現場日報一覧の取得に失敗しました');
      const json = (await res.json()) as ApiSuccessResponse<{
        fieldReports: FieldReport[];
      }>;
      return json.data;
    },
  });
}

/** 現場日報詳細を取得 */
export function useFieldReport(id: string) {
  return useQuery({
    queryKey: queryKeys.fieldReports.detail(id),
    queryFn: async (): Promise<FieldReport> => {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/field-reports/${id}`, { headers });
      if (!res.ok) throw new Error('現場日報の取得に失敗しました');
      const json = (await res.json()) as ApiSuccessResponse<FieldReport>;
      return json.data;
    },
    enabled: !!id,
  });
}

/** 現場日報を作成 */
export function useCreateFieldReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateFieldReportInput): Promise<FieldReport> => {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/field-reports', {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(
          (json as { message?: string }).message ?? '現場日報の作成に失敗しました'
        );
      }
      return (json as ApiSuccessResponse<FieldReport>).data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.fieldReports.all,
      });
    },
  });
}

/** 現場日報を更新 */
export function useUpdateFieldReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: CreateFieldReportInput;
    }): Promise<FieldReport> => {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/field-reports/${id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(
          (json as { message?: string }).message ?? '現場日報の更新に失敗しました'
        );
      }
      return (json as ApiSuccessResponse<FieldReport>).data;
    },
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.fieldReports.all,
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.fieldReports.detail(variables.id),
      });
    },
  });
}

/** 現場日報を削除 */
export function useDeleteFieldReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/field-reports/${id}`, {
        method: 'DELETE',
        headers,
      });
      if (!res.ok) throw new Error('現場日報の削除に失敗しました');
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.fieldReports.all,
      });
    },
  });
}
