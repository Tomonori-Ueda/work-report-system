'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/features/report/status-badge';
import { ApprovalsBadges } from '@/components/features/report/approvals-badges';
import { WorkHoursDisplay } from '@/components/features/report/work-hours-display';
import { useReports, useBulkApprove } from '@/hooks/use-reports';
import { useAuthStore } from '@/stores/auth-store';
import { formatDateToISO, formatDateToJapanese } from '@/lib/utils/date';
import {
  REPORT_STATUS,
  canApproveSlot,
  type DailyReportWithUser,
  type ReportApprovals,
} from '@/types/report';
import { getApprovalSlot } from '@/types/user';

/**
 * 4枠承認の slot を、ログイン中ユーザーから推定する。
 * Why: 一括スライドの「自分が押せる対象」判定を画面側でも行うため。
 *      サーバー側で最終判定するので、ここはあくまで UI 制御用のヒント。
 */
function useMyApprovalSlot() {
  const role = useAuthStore((s) => s.role);
  const executiveTitle = useAuthStore((s) => s.executiveTitle);
  if (!role) return null;
  return getApprovalSlot(role, executiveTitle);
}

/**
 * 当日提出された日報（draft / rejected を除く）を1枚ずつめくって確認 →
 * まとめて自分の slot に押印する画面。
 */
export function DailySlideApproval() {
  const [selectedDate, setSelectedDate] = useState(formatDateToISO(new Date()));
  const [pageIndex, setPageIndex] = useState(0);

  const { data: allReports, isLoading } = useReports({
    startDate: selectedDate,
    endDate: selectedDate,
  });

  const reviewableReports = useMemo<DailyReportWithUser[]>(() => {
    if (!allReports) return [];
    return allReports.filter(
      (r) =>
        r.status !== REPORT_STATUS.DRAFT && r.status !== REPORT_STATUS.REJECTED
    );
  }, [allReports]);

  const mySlot = useMyApprovalSlot();
  const bulkApprove = useBulkApprove();

  // 自分が押印可能な対象だけ抜粋（順序ガード + 未押印）
  const approvableByMe = useMemo<DailyReportWithUser[]>(() => {
    if (!mySlot) return [];
    return reviewableReports.filter((r) => {
      const approvals: ReportApprovals = r.approvals ?? {
        construction_manager: null,
        managing: null,
        executive: null,
        president: null,
      };
      return canApproveSlot(approvals, mySlot);
    });
  }, [reviewableReports, mySlot]);

  // 日付/件数変化でページを先頭に戻す
  if (pageIndex >= reviewableReports.length && reviewableReports.length > 0) {
    setPageIndex(0);
  }

  const current = reviewableReports[pageIndex];

  async function handleBulkApprove() {
    if (approvableByMe.length === 0) {
      toast.info('自分の段階で押印可能な日報がありません');
      return;
    }
    const ids = approvableByMe.map((r) => r.id);
    try {
      const result = await bulkApprove.mutateAsync(ids);
      const pieces: string[] = [`${result.approvedCount}件に押印しました`];
      if (result.failedIds.length > 0) {
        pieces.push(`${result.failedIds.length}件は押印できませんでした`);
      }
      toast.success(pieces.join(' / '));
    } catch {
      toast.error('一括押印に失敗しました');
    }
  }

  return (
    <div className="space-y-4">
      {/* 操作バー */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="text-xs text-muted-foreground">日付</label>
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => {
              setSelectedDate(e.target.value);
              setPageIndex(0);
            }}
            className="w-[180px]"
          />
        </div>
        <div className="text-sm text-muted-foreground">
          対象 {reviewableReports.length} 件 / 自分が押印可能 {approvableByMe.length} 件
        </div>
        <div className="ml-auto">
          <Button
            onClick={handleBulkApprove}
            disabled={bulkApprove.isPending || approvableByMe.length === 0}
          >
            {bulkApprove.isPending
              ? '処理中...'
              : `この日まとめて押印（${approvableByMe.length}件）`}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">読み込み中...</p>
      ) : reviewableReports.length === 0 ? (
        <p className="text-center py-12 text-muted-foreground border rounded-lg">
          {formatDateToJapanese(selectedDate)} に提出された日報はありません
        </p>
      ) : current ? (
        <ReportSlide
          report={current}
          pageIndex={pageIndex}
          totalCount={reviewableReports.length}
          onPrev={() => setPageIndex((i) => Math.max(0, i - 1))}
          onNext={() =>
            setPageIndex((i) => Math.min(reviewableReports.length - 1, i + 1))
          }
        />
      ) : null}
    </div>
  );
}

function ReportSlide({
  report,
  pageIndex,
  totalCount,
  onPrev,
  onNext,
}: {
  report: DailyReportWithUser;
  pageIndex: number;
  totalCount: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2 flex-wrap">
            <span>{formatDateToJapanese(report.reportDate)}</span>
            <Badge variant="outline">{report.userName}</Badge>
            <StatusBadge status={report.status} />
          </CardTitle>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Button variant="ghost" size="icon" onClick={onPrev} disabled={pageIndex === 0}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span>
              {pageIndex + 1} / {totalCount}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={onNext}
              disabled={pageIndex >= totalCount - 1}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-xs text-muted-foreground mb-1">承認状況</p>
          <ApprovalsBadges approvals={report.approvals} size="md" />
        </div>

        <WorkHoursDisplay
          timeBlocks={report.timeBlocks}
          startTime={report.startTime}
          endTime={report.endTime}
        />

        {/* 時間ブロック詳細 */}
        {report.timeBlocks && report.timeBlocks.length > 0 && (
          <div className="space-y-2">
            {report.timeBlocks.map((block, i) => (
              <div
                key={block.id ?? i}
                className="rounded-md border p-3 text-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">
                    {block.startTime} 〜 {block.endTime}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {block.siteName}
                  </span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-muted-foreground">
                  {block.workContent}
                </p>
              </div>
            ))}
          </div>
        )}

        {report.notes && (
          <div className="rounded-md bg-muted/50 p-3 text-sm">
            <p className="text-xs text-muted-foreground">備考</p>
            <p className="whitespace-pre-wrap mt-1">{report.notes}</p>
          </div>
        )}

        <div className="pt-2">
          <Link
            href={`/reports/${report.id}`}
            className="text-sm text-blue-600 hover:underline"
          >
            詳細画面で個別に承認・差し戻し →
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
