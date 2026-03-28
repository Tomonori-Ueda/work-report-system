'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useLeaveRequests } from '@/hooks/use-leave';
import { formatDateToJapanese } from '@/lib/utils/date';
import { LEAVE_STATUS, LEAVE_TYPE } from '@/types/leave';
import { getIdToken } from '@/lib/firebase/auth';
import { toast } from 'sonner';
import { LeaveRequestForm } from '@/components/features/leave/leave-request-form';

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

/** 管理者: 休暇管理画面 */
export default function AdminLeavesPage() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const { data: requests, isLoading } = useLeaveRequests();

  const filtered = requests?.filter((r) =>
    statusFilter === 'all' ? true : r.status === statusFilter
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">休暇管理</h1>

      {/* 管理者自身の休暇申請フォーム */}
      <LeaveRequestForm />

      {/* フィルタ */}
      <div className="flex flex-wrap gap-2">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="ステータス" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">すべて</SelectItem>
            <SelectItem value={LEAVE_STATUS.PENDING}>申請中</SelectItem>
            <SelectItem value={LEAVE_STATUS.APPROVED}>承認済</SelectItem>
            <SelectItem value={LEAVE_STATUS.REJECTED}>却下</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* テーブル */}
      {isLoading ? (
        <p className="text-muted-foreground">読み込み中...</p>
      ) : filtered && filtered.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>申請者</TableHead>
              <TableHead>休暇日</TableHead>
              <TableHead>種別</TableHead>
              <TableHead>理由</TableHead>
              <TableHead>ステータス</TableHead>
              <TableHead>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((req) => {
              const statusConfig = LEAVE_STATUS_CONFIG[req.status] ?? {
                label: req.status,
                variant: 'secondary' as const,
              };
              return (
                <TableRow key={req.id}>
                  <TableCell className="font-medium">
                    {req.userName}
                  </TableCell>
                  <TableCell>
                    {formatDateToJapanese(req.leaveDate)}
                  </TableCell>
                  <TableCell>
                    {LEAVE_TYPE_LABELS[req.leaveType] ?? req.leaveType}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    {req.reason ?? '-'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusConfig.variant}>
                      {statusConfig.label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {req.status === LEAVE_STATUS.PENDING && (
                      <LeaveActionButtons requestId={req.id} />
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      ) : (
        <p className="text-center py-8 text-muted-foreground">
          休暇申請がありません
        </p>
      )}
    </div>
  );
}

/** 承認/却下ボタン */
function LeaveActionButtons({ requestId }: { requestId: string }) {
  const [isProcessing, setIsProcessing] = useState(false);

  async function handleAction(action: 'approved' | 'rejected') {
    setIsProcessing(true);
    try {
      const token = await getIdToken();
      const res = await fetch(`/api/leave/requests/${requestId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error('処理に失敗しました');
      toast.success(action === 'approved' ? '承認しました' : '却下しました');
      window.location.reload();
    } catch {
      toast.error('処理に失敗しました');
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <div className="flex gap-1">
      <Button
        size="sm"
        variant="outline"
        onClick={() => handleAction('approved')}
        disabled={isProcessing}
      >
        承認
      </Button>
      <Button
        size="sm"
        variant="destructive"
        onClick={() => handleAction('rejected')}
        disabled={isProcessing}
      >
        却下
      </Button>
    </div>
  );
}
