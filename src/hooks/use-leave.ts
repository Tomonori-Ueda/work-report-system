'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getIdToken } from '@/lib/firebase/auth';
import { queryKeys } from '@/lib/query/keys';
import type { LeaveRequest, LeaveRequestWithUser, LeaveBalanceLog } from '@/types/leave';
import type { ApiSuccessResponse } from '@/types/api';

/** APIリクエストのヘッダーを取得 */
async function getAuthHeaders(): Promise<HeadersInit> {
  const token = await getIdToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/** 有給申請一覧を取得 */
export function useLeaveRequests() {
  return useQuery({
    queryKey: queryKeys.leave.requests(),
    queryFn: async (): Promise<LeaveRequestWithUser[]> => {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/leave/requests', { headers });
      if (!res.ok) throw new Error('有給申請の取得に失敗しました');
      const json = (await res.json()) as ApiSuccessResponse<LeaveRequestWithUser[]>;
      return json.data;
    },
  });
}

/** 有給残日数を取得 */
export function useLeaveBalance(userId: string) {
  return useQuery({
    queryKey: queryKeys.leave.balance(userId),
    queryFn: async (): Promise<{
      balance: number;
      logs: LeaveBalanceLog[];
    }> => {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/leave/balance/${userId}`, { headers });
      if (!res.ok) throw new Error('有給残日数の取得に失敗しました');
      const json = (await res.json()) as ApiSuccessResponse<{
        balance: number;
        logs: LeaveBalanceLog[];
      }>;
      return json.data;
    },
    enabled: !!userId,
  });
}

/** 有給申請を作成 */
export function useCreateLeaveRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      leaveDate: string;
      leaveType: string;
      reason?: string;
    }): Promise<LeaveRequest> => {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/leave/requests', {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(
          (json as { message?: string }).message ?? '有給申請に失敗しました'
        );
      }
      return (json as ApiSuccessResponse<LeaveRequest>).data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.leave.requests(),
      });
    },
  });
}
