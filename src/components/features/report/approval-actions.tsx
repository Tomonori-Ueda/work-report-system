'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RejectionDialog } from './rejection-dialog';
import {
  useApproveReport,
  useRejectReport,
  useSupervisorConfirm,
  useManagerCheck,
} from '@/hooks/use-reports';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { REPORT_STATUS, type ReportStatus } from '@/types/report';
import { USER_ROLE, type UserRole } from '@/types/user';

interface ApprovalActionsProps {
  reportId: string;
  currentStatus: ReportStatus;
  userRole: UserRole;
  onApprove?: () => void;
  onReject?: () => void;
  onCheck?: () => void;
  onSupervisorConfirm?: () => void;
}

/**
 * 日報承認・確認アクション（ロール別表示）
 *
 * G:  submitted のときのみ「確認済みにする」
 * B:  supervisor_confirmed のときのみ「チェック済みにする」
 * A/S: 「承認する」「差し戻す」（Sはどのステータスでも表示）
 * A_special: ボタンなし（閲覧のみ）
 */
export function ApprovalActions({
  reportId,
  currentStatus,
  userRole,
  onApprove,
  onReject,
  onCheck,
  onSupervisorConfirm,
}: ApprovalActionsProps) {
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const router = useRouter();

  const approveReport = useApproveReport();
  const rejectReport = useRejectReport();
  const supervisorConfirm = useSupervisorConfirm();
  const managerCheck = useManagerCheck();

  // --- 現場監督（G）: submitted のときのみ「確認済みにする」 ---
  async function handleSupervisorConfirm() {
    try {
      await supervisorConfirm.mutateAsync(reportId);
      toast.success('現場監督確認済みにしました');
      onSupervisorConfirm?.();
      router.push('/dashboard');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '確認処理に失敗しました');
    }
  }

  // --- 施工部長（B）: supervisor_confirmed のときのみ「チェック済みにする」 ---
  async function handleManagerCheck() {
    try {
      await managerCheck.mutateAsync(reportId);
      toast.success('施工部長チェック済みにしました');
      onCheck?.();
      router.push('/dashboard');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'チェック処理に失敗しました');
    }
  }

  // --- 専務/常務・社長（A/S）: 承認 ---
  async function handleApprove() {
    try {
      await approveReport.mutateAsync(reportId);
      toast.success('日報を承認しました');
      onApprove?.();
      router.push('/dashboard');
    } catch (e) {
      // 4枠承認の順序ガード違反などをサーバーから返るメッセージそのままで表示する
      toast.error(e instanceof Error ? e.message : '承認に失敗しました');
    }
  }

  // --- 専務/常務・社長（A/S）: 差し戻し ---
  async function handleReject(rejectReason: string) {
    try {
      await rejectReport.mutateAsync({ reportId, rejectReason });
      toast.success('日報を差し戻しました');
      setShowRejectDialog(false);
      onReject?.();
      router.push('/dashboard');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '差し戻しに失敗しました');
    }
  }

  // A_special: 閲覧のみ
  if (userRole === USER_ROLE.A_SPECIAL) {
    return null;
  }

  // G（現場監督）: submitted のときのみ「確認済みにする」
  if (userRole === USER_ROLE.G) {
    if (currentStatus !== REPORT_STATUS.SUBMITTED) return null;
    return (
      <Button
        onClick={handleSupervisorConfirm}
        disabled={supervisorConfirm.isPending}
        className="w-full"
      >
        {supervisorConfirm.isPending ? '処理中...' : '確認済みにする'}
      </Button>
    );
  }

  // 4枠承認の対象ステータス（押印フェーズ中）
  const isApprovalPhase =
    currentStatus === REPORT_STATUS.SUBMITTED ||
    currentStatus === REPORT_STATUS.SUPERVISOR_CONFIRMED ||
    currentStatus === REPORT_STATUS.MANAGER_CHECKED;

  // B（施工部長）: 押印フェーズ中はいつでもボタン表示。
  // 順序判定はサーバー側（4枠承認の最初の slot）に任せ、失敗時は toast で通知する。
  if (userRole === USER_ROLE.B) {
    if (!isApprovalPhase) return null;
    return (
      <Button
        onClick={handleManagerCheck}
        disabled={managerCheck.isPending}
        className="w-full"
        variant="secondary"
      >
        {managerCheck.isPending ? '処理中...' : 'チェック済みにする'}
      </Button>
    );
  }

  // A（専務・常務）: 押印フェーズ中は承認・差し戻しを表示。順序ガードはサーバー側で。
  if (userRole === USER_ROLE.A) {
    if (!isApprovalPhase) return null;
    return (
      <>
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
        </div>
        <RejectionDialog
          open={showRejectDialog}
          onOpenChange={setShowRejectDialog}
          onConfirm={handleReject}
          isPending={rejectReport.isPending}
        />
      </>
    );
  }

  // S（社長）: 押印フェーズ中は承認・差し戻しを表示
  if (userRole === USER_ROLE.S) {
    if (!isApprovalPhase) return null;
    return (
      <>
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
        </div>
        <RejectionDialog
          open={showRejectDialog}
          onOpenChange={setShowRejectDialog}
          onConfirm={handleReject}
          isPending={rejectReport.isPending}
        />
      </>
    );
  }

  // 上記以外のロール（general等）: ボタンなし
  return null;
}
