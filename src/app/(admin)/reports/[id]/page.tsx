'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/features/report/status-badge';
import { WorkHoursDisplay } from '@/components/features/report/work-hours-display';
import { WorkEntriesDisplay } from '@/components/features/report/work-entries-display';
import { ApprovedByDisplay } from '@/components/features/report/approved-by-display';
import { ApprovalActions } from '@/components/features/report/approval-actions';
import { useReport } from '@/hooks/use-reports';
import { useAuthStore } from '@/stores/auth-store';
import { formatDateToJapanese } from '@/lib/utils/date';
import { REPORT_STATUS } from '@/types/report';
import type { DailyReportWithUser } from '@/types/report';

/** FirestoreタイムスタンプまたはISO文字列を日本語表示に変換 */
function formatTimestamp(
  value: unknown
): string {
  if (!value) return '—';

  // FirestoreのAdmin SDKはシリアライズ時に { _seconds, _nanoseconds } になることがある
  if (
    typeof value === 'object' &&
    value !== null &&
    '_seconds' in value &&
    typeof (value as { _seconds: unknown })._seconds === 'number'
  ) {
    const date = new Date(
      (value as { _seconds: number })._seconds * 1000
    );
    return date.toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  // ISO文字列 or Date
  const date = new Date(value as string);
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** 5ステップ承認フロー履歴セクション */
function ApprovalFlowHistory({ report }: { report: DailyReportWithUser }) {
  const steps: Array<{
    step: number;
    label: string;
    isCompleted: boolean;
    actorId: string | null;
    timestamp: unknown;
  }> = [
    {
      step: 1,
      label: '提出',
      isCompleted: report.status !== REPORT_STATUS.DRAFT,
      actorId: report.userId,
      timestamp: report.createdAt,
    },
    {
      step: 2,
      label: '現場監督確認',
      isCompleted:
        report.status === REPORT_STATUS.SUPERVISOR_CONFIRMED ||
        report.status === REPORT_STATUS.MANAGER_CHECKED ||
        report.status === REPORT_STATUS.APPROVED,
      actorId: report.supervisorId,
      timestamp: report.supervisorConfirmedAt,
    },
    {
      step: 3,
      label: '施工部長チェック',
      isCompleted:
        report.status === REPORT_STATUS.MANAGER_CHECKED ||
        report.status === REPORT_STATUS.APPROVED,
      actorId: report.checkedBy,
      timestamp: report.checkedAt,
    },
    {
      step: 4,
      label: '承認',
      isCompleted: report.status === REPORT_STATUS.APPROVED,
      actorId: report.approvedBy,
      timestamp: report.approvedAt,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">承認フロー</CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="space-y-3">
          {steps.map((step) => (
            <li key={step.step} className="flex items-start gap-3">
              {/* ステップ番号バッジ */}
              <Badge
                variant={step.isCompleted ? 'default' : 'secondary'}
                className="mt-0.5 shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs"
              >
                {step.step}
              </Badge>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{step.label}</p>
                {step.isCompleted ? (
                  <p className="text-xs text-muted-foreground">
                    {formatTimestamp(step.timestamp)}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">未完了</p>
                )}
              </div>
              {/* 完了インジケータ */}
              <span
                className={`text-sm shrink-0 ${
                  step.isCompleted ? 'text-green-600' : 'text-muted-foreground'
                }`}
              >
                {step.isCompleted ? '✓' : '—'}
              </span>
            </li>
          ))}
        </ol>

        {/* 差し戻し理由 */}
        {report.status === REPORT_STATUS.REJECTED && report.rejectReason && (
          <div className="mt-4 rounded-md bg-destructive/10 p-3">
            <p className="text-sm font-medium text-destructive">差し戻し理由</p>
            <p className="text-sm mt-1">{report.rejectReason}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** S004: 日報詳細・承認画面（管理者） */
export default function AdminReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { data: report, isLoading, error } = useReport(id);
  // ロールを認証ストアから取得
  const userRole = useAuthStore((state) => state.role);

  if (isLoading) {
    return (
      <div className="max-w-2xl">
        <p className="text-muted-foreground">読み込み中...</p>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="max-w-2xl">
        <p className="text-destructive">日報の取得に失敗しました</p>
        <Button variant="outline" className="mt-4" onClick={() => router.back()}>
          戻る
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">日報詳細</h1>
        <Button variant="outline" onClick={() => router.back()}>
          一覧に戻る
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{report.userName}さんの日報</CardTitle>
            <StatusBadge status={report.status} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">作業日</p>
              <p className="font-medium">
                {formatDateToJapanese(report.reportDate)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">従業員</p>
              <p className="font-medium">{report.userName}</p>
            </div>
          </div>

          {/* 時間ブロック一覧 */}
          {report.timeBlocks && report.timeBlocks.length > 0 ? (
            <div className="space-y-3">
              <p className="text-sm font-medium text-muted-foreground">
                時間ブロック
              </p>
              {report.timeBlocks.map((block, idx) => (
                <div
                  key={block.id}
                  className="rounded-md border border-border p-3 space-y-1"
                >
                  <p className="text-xs text-muted-foreground font-medium">
                    ブロック {idx + 1}
                    {block.siteName ? ` — ${block.siteName}` : ''}
                  </p>
                  <p className="text-sm font-medium">
                    {block.startTime} 〜 {block.endTime}
                  </p>
                  <p className="text-sm whitespace-pre-wrap">
                    {block.workContent}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            /* 後方互換: 古い単一ブロックデータ */
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">開始時刻</p>
                <p className="font-medium">{report.startTime ?? '—'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">終了時刻</p>
                <p className="font-medium">{report.endTime ?? '—'}</p>
              </div>
            </div>
          )}

          <WorkHoursDisplay timeBlocks={report.timeBlocks} />

          {report.notes && (
            <div>
              <p className="text-sm text-muted-foreground">備考</p>
              <p className="whitespace-pre-wrap mt-1">{report.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 5ステップ承認フロー履歴 */}
      <ApprovalFlowHistory report={report} />

      {/* ロール別承認アクション */}
      {userRole && (
        <ApprovalActions
          reportId={report.id}
          currentStatus={report.status}
          userRole={userRole}
        />
      )}
    </div>
  );
}
