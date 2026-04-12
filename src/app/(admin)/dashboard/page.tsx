'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SubmissionStats } from '@/components/features/dashboard/submission-stats';
import { PendingReportsTable } from '@/components/features/dashboard/pending-reports-table';
import { getIdToken } from '@/lib/firebase/auth';
import { queryKeys } from '@/lib/query/keys';
import { formatDateToISO } from '@/lib/utils/date';
import { useReports } from '@/hooks/use-reports';
import { useLeaveRequests } from '@/hooks/use-leave';
import { useAuthStore } from '@/stores/auth-store';
import type { ApiSuccessResponse, DashboardStatusResponse } from '@/types/api';
import { REPORT_STATUS } from '@/types/report';
import { LEAVE_STATUS } from '@/types/leave';
import { USER_ROLE } from '@/types/user';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { formatDateToJapanese } from '@/lib/utils/date';

/** S003: 管理者ダッシュボード */
export default function DashboardPage() {
  const [selectedDate, setSelectedDate] = useState(
    formatDateToISO(new Date())
  );
  const userRole = useAuthStore((state) => state.role);

  // 提出状況（日付別）
  const { data: dashboardData, isLoading: isLoadingDashboard } = useQuery({
    queryKey: queryKeys.dashboard.status(selectedDate),
    queryFn: async (): Promise<DashboardStatusResponse> => {
      const token = await getIdToken();
      const res = await fetch(`/api/dashboard/status?date=${selectedDate}`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) throw new Error('ダッシュボードの取得に失敗しました');
      const json =
        (await res.json()) as ApiSuccessResponse<DashboardStatusResponse>;
      return json.data;
    },
  });

  // 各ステータスの日報件数（5ステップ表示用）
  const { data: submittedReports } = useReports({ status: REPORT_STATUS.SUBMITTED });
  const { data: supervisorConfirmedReports } = useReports({
    status: REPORT_STATUS.SUPERVISOR_CONFIRMED,
  });
  const { data: managerCheckedReports } = useReports({
    status: REPORT_STATUS.MANAGER_CHECKED,
  });

  // 有給承認待ち
  const { data: leaveRequests } = useLeaveRequests();
  const pendingLeaves = leaveRequests?.filter(
    (r) => r.status === LEAVE_STATUS.PENDING
  );

  // S/A: 要対応件数（submitted + supervisor_confirmed + manager_checked の合計）
  const totalPendingCount =
    (submittedReports?.length ?? 0) +
    (supervisorConfirmedReports?.length ?? 0) +
    (managerCheckedReports?.length ?? 0);

  // A_special/B は閲覧専用バナーを表示するか
  const isReadOnlyRole =
    userRole === USER_ROLE.A_SPECIAL || userRole === USER_ROLE.B;

  // S/A は承認操作可能
  const canApproveRole =
    userRole === USER_ROLE.S || userRole === USER_ROLE.A;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">ダッシュボード</h1>
        <Input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="w-[180px]"
        />
      </div>

      {/* 閲覧専用バナー（A_special/B） */}
      {isReadOnlyRole && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3">
          <p className="text-sm text-yellow-800">
            このアカウントは閲覧専用です。日報の承認・差し戻し操作はできません。
          </p>
        </div>
      )}

      {/* 5ステップ別の要対応件数（S/A に表示） */}
      {canApproveRole && (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                提出済み（要確認）
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-yellow-600">
                {submittedReports?.length ?? '—'}
              </p>
              <p className="text-xs text-muted-foreground">現場監督待ち</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                現場監督確認済
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-blue-600">
                {supervisorConfirmedReports?.length ?? '—'}
              </p>
              <p className="text-xs text-muted-foreground">施工部長チェック待ち</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                施工部長確認済
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-purple-600">
                {managerCheckedReports?.length ?? '—'}
              </p>
              <p className="text-xs text-muted-foreground">承認待ち</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 日付別提出状況サマリ */}
      {isLoadingDashboard ? (
        <p className="text-muted-foreground">読み込み中...</p>
      ) : dashboardData ? (
        <SubmissionStats data={dashboardData} />
      ) : null}

      <Tabs defaultValue="reports">
        <TabsList>
          <TabsTrigger value="reports">
            {canApproveRole ? '承認待ち日報' : '日報一覧'}
            {canApproveRole && totalPendingCount > 0 && (
              <Badge variant="destructive" className="ml-2">
                {totalPendingCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="leaves">
            有給申請
            {pendingLeaves && pendingLeaves.length > 0 && (
              <Badge variant="destructive" className="ml-2">
                {pendingLeaves.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="reports" className="mt-4">
          {submittedReports ? (
            <PendingReportsTable
              reports={[
                ...(submittedReports ?? []),
                ...(supervisorConfirmedReports ?? []),
                ...(managerCheckedReports ?? []),
              ]}
            />
          ) : (
            <p className="text-muted-foreground">読み込み中...</p>
          )}
        </TabsContent>

        <TabsContent value="leaves" className="mt-4">
          <LeaveApprovalSection requests={pendingLeaves ?? []} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/** 有給承認セクション */
function LeaveApprovalSection({
  requests,
}: {
  requests: Array<{
    id: string;
    userId: string;
    leaveDate: string;
    leaveType: string;
    leaveUnit?: string;
    leaveHours?: number | null;
    reason: string | null;
    status: string;
  }>;
}) {
  if (requests.length === 0) {
    return (
      <p className="text-center py-8 text-muted-foreground">
        承認待ちの有給申請はありません
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {requests.map((req) => (
        <LeaveApprovalCard key={req.id} request={req} />
      ))}
    </div>
  );
}

const LEAVE_UNIT_LABELS: Record<string, string> = {
  full_day: '全日',
  half_day_am: '午前半休',
  half_day_pm: '午後半休',
  hourly: '時間有給',
};

/** 有給承認カード */
function LeaveApprovalCard({
  request,
}: {
  request: {
    id: string;
    userId: string;
    leaveDate: string;
    leaveType: string;
    leaveUnit?: string;
    leaveHours?: number | null;
    reason: string | null;
  };
}) {
  const [isProcessing, setIsProcessing] = useState(false);

  async function handleAction(action: 'approved' | 'rejected') {
    setIsProcessing(true);
    try {
      const token = await getIdToken();
      const res = await fetch(`/api/leave/requests/${request.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error('処理に失敗しました');
      toast.success(action === 'approved' ? '承認しました' : '却下しました');
      // ページをリロードして最新状態を反映
      window.location.reload();
    } catch {
      toast.error('処理に失敗しました');
    } finally {
      setIsProcessing(false);
    }
  }

  const typeLabels: Record<string, string> = {
    paid: '有給休暇',
    special: '特別休暇',
    unpaid: '無給休暇',
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">
          {formatDateToJapanese(request.leaveDate)} -{' '}
          {typeLabels[request.leaveType] ?? request.leaveType}
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          {LEAVE_UNIT_LABELS[request.leaveUnit ?? ''] ?? request.leaveUnit ?? '全日'}
          {request.leaveUnit === 'hourly' && request.leaveHours != null
            ? `（${request.leaveHours}時間）`
            : ''}
        </p>
      </CardHeader>
      <CardContent>
        {request.reason && (
          <p className="text-sm text-muted-foreground mb-3">
            理由: {request.reason}
          </p>
        )}
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={() => handleAction('approved')}
            disabled={isProcessing}
            className="flex-1"
          >
            承認
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => handleAction('rejected')}
            disabled={isProcessing}
            className="flex-1"
          >
            却下
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
