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
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>
              {report.startTime} 〜 {report.endTime}
            </span>
            <span>
              所定 {report.regularHours}h / 残業 {report.overtimeHours}h
            </span>
          </div>
          {report.userName && (
            <p className="text-sm text-muted-foreground mt-1">
              {report.userName}
            </p>
          )}
          {report.workEntries && report.workEntries.length > 0 ? (
            <div className="text-sm mt-2 space-y-0.5">
              {report.workEntries.slice(0, 2).map((entry, i) => (
                <p key={i} className="line-clamp-1">
                  <span className="text-muted-foreground font-mono text-xs">
                    {entry.startTime}〜{entry.endTime}
                  </span>{' '}
                  {entry.content}
                </p>
              ))}
              {report.workEntries.length > 2 && (
                <p className="text-muted-foreground text-xs">
                  他{report.workEntries.length - 2}件
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm mt-2 line-clamp-2">
              {report.workContent}
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
