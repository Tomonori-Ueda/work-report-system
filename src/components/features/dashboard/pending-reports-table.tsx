'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/features/report/status-badge';
import { useBulkApprove } from '@/hooks/use-reports';
import { formatDateToJapanese } from '@/lib/utils/date';
import type { DailyReportWithUser } from '@/types/report';
import { REPORT_STATUS } from '@/types/report';

interface PendingReportsTableProps {
  reports: DailyReportWithUser[];
}

/** 未承認日報テーブル + 一括承認 */
export function PendingReportsTable({ reports }: PendingReportsTableProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const bulkApprove = useBulkApprove();

  const submittedReports = reports.filter(
    (r) => r.status === REPORT_STATUS.SUBMITTED
  );

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleAll() {
    if (selectedIds.size === submittedReports.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(submittedReports.map((r) => r.id)));
    }
  }

  async function handleBulkApprove() {
    if (selectedIds.size === 0) return;
    try {
      const result = await bulkApprove.mutateAsync([...selectedIds]);
      toast.success(`${result.approvedCount}件の日報を承認しました`);
      if (result.failedIds.length > 0) {
        toast.warning(`${result.failedIds.length}件は承認できませんでした`);
      }
      setSelectedIds(new Set());
    } catch {
      toast.error('一括承認に失敗しました');
    }
  }

  if (submittedReports.length === 0) {
    return (
      <p className="text-center py-8 text-muted-foreground">
        承認待ちの日報はありません
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-950/30 px-4 py-2 rounded-lg">
          <span className="text-sm">
            {selectedIds.size}件選択中
          </span>
          <Button
            size="sm"
            onClick={handleBulkApprove}
            disabled={bulkApprove.isPending}
          >
            {bulkApprove.isPending ? '処理中...' : '一括承認'}
          </Button>
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Checkbox
                checked={
                  selectedIds.size === submittedReports.length &&
                  submittedReports.length > 0
                }
                onCheckedChange={toggleAll}
              />
            </TableHead>
            <TableHead>日付</TableHead>
            <TableHead>従業員</TableHead>
            <TableHead>勤務時間</TableHead>
            <TableHead>残業</TableHead>
            <TableHead>ステータス</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {submittedReports.map((report) => (
            <TableRow key={report.id}>
              <TableCell>
                <Checkbox
                  checked={selectedIds.has(report.id)}
                  onCheckedChange={() => toggleSelect(report.id)}
                />
              </TableCell>
              <TableCell>
                <Link
                  href={`/reports/${report.id}`}
                  className="text-blue-600 hover:underline"
                >
                  {formatDateToJapanese(report.reportDate)}
                </Link>
              </TableCell>
              <TableCell>{report.userName}</TableCell>
              <TableCell>
                {report.startTime} 〜 {report.endTime}
              </TableCell>
              <TableCell>{report.overtimeHours}h</TableCell>
              <TableCell>
                <StatusBadge status={report.status} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
