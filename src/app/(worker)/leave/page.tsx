'use client';

import { useAuthStore } from '@/stores/auth-store';
import { LeaveRequestForm } from '@/components/features/leave/leave-request-form';
import { LeaveBalanceCard } from '@/components/features/leave/leave-balance-card';
import { useLeaveRequests } from '@/hooks/use-leave';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDateToJapanese } from '@/lib/utils/date';
import { LEAVE_STATUS, LEAVE_TYPE } from '@/types/leave';

const LEAVE_TYPE_LABELS: Record<string, string> = {
  [LEAVE_TYPE.PAID]: '有給休暇',
  [LEAVE_TYPE.SPECIAL]: '特別休暇',
  [LEAVE_TYPE.UNPAID]: '無給休暇',
};

const LEAVE_STATUS_CONFIG: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  [LEAVE_STATUS.PENDING]: { label: '申請中', variant: 'secondary' },
  [LEAVE_STATUS.APPROVED]: { label: '承認済', variant: 'outline' },
  [LEAVE_STATUS.REJECTED]: { label: '却下', variant: 'destructive' },
};

/** S007: 有給申請画面 */
export default function LeavePage() {
  const { uid } = useAuthStore();
  const { data: requests, isLoading } = useLeaveRequests();

  return (
    <div className="container max-w-lg mx-auto py-6 px-4 space-y-6">
      {uid && <LeaveBalanceCard userId={uid} />}

      <LeaveRequestForm />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">申請履歴</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <p className="text-center text-muted-foreground">読み込み中...</p>
          )}

          {requests && requests.length === 0 && (
            <p className="text-center text-muted-foreground">
              申請履歴がありません
            </p>
          )}

          {requests && requests.length > 0 && (
            <div className="space-y-3">
              {requests.map((req) => {
                const statusConfig = LEAVE_STATUS_CONFIG[req.status] ?? {
                  label: req.status,
                  variant: 'secondary' as const,
                };
                return (
                  <div
                    key={req.id}
                    className="flex items-center justify-between py-2 border-b last:border-0"
                  >
                    <div>
                      <p className="font-medium">
                        {formatDateToJapanese(req.leaveDate)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {LEAVE_TYPE_LABELS[req.leaveType] ?? req.leaveType}
                      </p>
                    </div>
                    <Badge variant={statusConfig.variant}>
                      {statusConfig.label}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
