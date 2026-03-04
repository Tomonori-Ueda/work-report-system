'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/features/report/status-badge';
import { WorkHoursDisplay } from '@/components/features/report/work-hours-display';
import { ApprovalActions } from '@/components/features/report/approval-actions';
import { useReport } from '@/hooks/use-reports';
import { formatDateToJapanese } from '@/lib/utils/date';
import { REPORT_STATUS } from '@/types/report';

/** S004: 日報詳細・承認画面（管理者） */
export default function AdminReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { data: report, isLoading, error } = useReport(id);

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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">開始時刻</p>
              <p className="font-medium">{report.startTime}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">終了時刻</p>
              <p className="font-medium">{report.endTime}</p>
            </div>
          </div>

          <WorkHoursDisplay
            startTime={report.startTime}
            endTime={report.endTime}
          />

          <div>
            <p className="text-sm text-muted-foreground">作業内容</p>
            <p className="whitespace-pre-wrap mt-1">{report.workContent}</p>
          </div>

          {report.notes && (
            <div>
              <p className="text-sm text-muted-foreground">備考</p>
              <p className="whitespace-pre-wrap mt-1">{report.notes}</p>
            </div>
          )}

          {report.rejectReason && (
            <div className="border-t pt-4">
              <p className="text-sm text-destructive font-medium">
                差し戻し理由
              </p>
              <p className="text-sm mt-1">{report.rejectReason}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 提出済みの場合のみ承認/差戻アクションを表示 */}
      {report.status === REPORT_STATUS.SUBMITTED && (
        <ApprovalActions reportId={report.id} />
      )}
    </div>
  );
}
