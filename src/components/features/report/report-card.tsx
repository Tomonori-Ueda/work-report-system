'use client';

import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { StatusBadge } from './status-badge';
import { formatDateToJapanese } from '@/lib/utils/date';
import type { DailyReport } from '@/types/report';

interface ReportCardProps {
  report: DailyReport & { userName?: string };
  /** 詳細ページへのリンクベースパス */
  basePath?: string;
}

/** 日報カード表示 */
export function ReportCard({
  report,
  basePath = '/report',
}: ReportCardProps) {
  // 先頭ブロックのサマリ（後方互換: timeBlocks がない古いデータにも対応）
  const firstBlock = report.timeBlocks?.[0];
  const timeRange = firstBlock
    ? `${firstBlock.startTime} 〜 ${firstBlock.endTime}`
    : report.startTime && report.endTime
      ? `${report.startTime} 〜 ${report.endTime}`
      : '—';

  const blockCount = report.timeBlocks?.length ?? 0;

  // 先頭ブロックの作業内容（後方互換: workContent フィールドも参照）
  const summaryText = firstBlock?.workContent ?? report.workContent ?? '';

  return (
    <Link href={`${basePath}/${report.id}`}>
      <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
        <CardContent className="py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium">
              {formatDateToJapanese(report.reportDate)}
            </span>
            <StatusBadge status={report.status} />
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span>{timeRange}</span>
            {blockCount > 1 && (
              <span className="text-xs bg-muted px-1.5 py-0.5 rounded">
                {blockCount}ブロック
              </span>
            )}
            <span>
              所定 {report.totalRegularHours ?? (report as { regularHours?: number }).regularHours ?? 0}h
              {' '}/ 残業 {report.totalOvertimeHours ?? (report as { overtimeHours?: number }).overtimeHours ?? 0}h
            </span>
          </div>

          {report.userName && (
            <p className="text-sm text-muted-foreground mt-1">
              {report.userName}
            </p>
          )}

          {summaryText && (
            <p className="text-sm mt-2 line-clamp-2">{summaryText}</p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
