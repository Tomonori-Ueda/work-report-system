'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RejectionDialog } from './rejection-dialog';
import { useApproveReport, useRejectReport } from '@/hooks/use-reports';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

interface ApprovalActionsProps {
  reportId: string;
}

/** 日報承認・差戻アクション */
export function ApprovalActions({ reportId }: ApprovalActionsProps) {
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const router = useRouter();
  const approveReport = useApproveReport();
  const rejectReport = useRejectReport();

  async function handleApprove() {
    try {
      await approveReport.mutateAsync(reportId);
      toast.success('日報を承認しました');
      router.push('/dashboard');
    } catch {
      toast.error('承認に失敗しました');
    }
  }

  async function handleReject(rejectReason: string) {
    try {
      await rejectReport.mutateAsync({ reportId, rejectReason });
      toast.success('日報を差し戻しました');
      setShowRejectDialog(false);
      router.push('/dashboard');
    } catch {
      toast.error('差し戻しに失敗しました');
    }
  }

  return (
    <div className="flex gap-3">
      <Button
        onClick={handleApprove}
        disabled={approveReport.isPending}
        className="flex-1"
      >
        {approveReport.isPending ? '処理中...' : '承認する'}
      </Button>
      <Button
        variant="destructive"
        onClick={() => setShowRejectDialog(true)}
        disabled={rejectReport.isPending}
        className="flex-1"
      >
        差し戻す
      </Button>

      <RejectionDialog
        open={showRejectDialog}
        onOpenChange={setShowRejectDialog}
        onConfirm={handleReject}
        isPending={rejectReport.isPending}
      />
    </div>
  );
}
