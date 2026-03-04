'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/features/report/status-badge';
import { WorkHoursDisplay } from '@/components/features/report/work-hours-display';
import { ReportForm } from '@/components/features/report/report-form';
import { useReport } from '@/hooks/use-reports';
import { formatDateToJapanese } from '@/lib/utils/date';
import { REPORT_STATUS } from '@/types/report';

/** S006: 日報詳細画面 */
export default function ReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { data: report, isLoading, error } = useReport(id);

  if (isLoading) {
    return (
      <div className="container max-w-lg mx-auto py-6 px-4">
        <p className="text-center text-muted-foreground">読み込み中...</p>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="container max-w-lg mx-auto py-6 px-4">
        <p className="text-center text-destructive">
          日報の取得に失敗しました
        </p>
        <Button
          variant="outline"
          className="mx-auto mt-4 block"
          onClick={() => router.back()}
        >
          戻る
        </Button>
      </div>
    );
  }

  // 差し戻しの場合は編集フォームを表示
  if (report.status === REPORT_STATUS.REJECTED) {
    return (
      <div className="container max-w-lg mx-auto py-6 px-4">
        {report.rejectReason && (
          <Card className="mb-4 border-destructive">
            <CardContent className="py-3">
              <p className="text-sm text-destructive font-medium">
                差し戻し理由:
              </p>
              <p className="text-sm mt-1">{report.rejectReason}</p>
            </CardContent>
          </Card>
        )}
        <ReportForm
          reportId={report.id}
          defaultValues={{
            reportDate: report.reportDate,
            startTime: report.startTime,
            endTime: report.endTime,
            workContent: report.workContent,
            notes: report.notes ?? '',
          }}
        />
      </div>
    );
  }

  // 通常表示
  return (
    <div className="container max-w-lg mx-auto py-6 px-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>日報詳細</CardTitle>
            <StatusBadge status={report.status} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">作業日</p>
            <p className="font-medium">
              {formatDateToJapanese(report.reportDate)}
            </p>
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
        </CardContent>
      </Card>

      <Button
        variant="outline"
        className="w-full mt-4"
        onClick={() => router.back()}
      >
        戻る
      </Button>
    </div>
  );
}
