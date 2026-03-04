'use client';

import { useState } from 'react';
import Link from 'next/link';
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
import { StatusBadge } from '@/components/features/report/status-badge';
import { useReports } from '@/hooks/use-reports';
import { formatDateToJapanese } from '@/lib/utils/date';
import { REPORT_STATUS, type ReportStatus } from '@/types/report';

/** S008: 提出状況一覧（管理者） */
export default function AdminReportsPage() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const filters = {
    ...(statusFilter !== 'all' ? { status: statusFilter as ReportStatus } : {}),
    ...(startDate ? { startDate } : {}),
    ...(endDate ? { endDate } : {}),
  };

  const { data: reports, isLoading } = useReports(filters);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">提出状況一覧</h1>

      {/* フィルタ */}
      <div className="flex flex-wrap gap-2">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="ステータス" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">すべて</SelectItem>
            <SelectItem value={REPORT_STATUS.SUBMITTED}>提出済</SelectItem>
            <SelectItem value={REPORT_STATUS.APPROVED}>承認済</SelectItem>
            <SelectItem value={REPORT_STATUS.REJECTED}>差戻</SelectItem>
            <SelectItem value={REPORT_STATUS.DRAFT}>下書き</SelectItem>
          </SelectContent>
        </Select>
        <Input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="w-[160px]"
        />
        <Input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="w-[160px]"
        />
      </div>

      {/* テーブル */}
      {isLoading ? (
        <p className="text-muted-foreground">読み込み中...</p>
      ) : reports && reports.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>日付</TableHead>
              <TableHead>従業員</TableHead>
              <TableHead>勤務時間</TableHead>
              <TableHead>所定</TableHead>
              <TableHead>残業</TableHead>
              <TableHead>ステータス</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reports.map((report) => (
              <TableRow key={report.id}>
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
                <TableCell>{report.regularHours}h</TableCell>
                <TableCell>{report.overtimeHours}h</TableCell>
                <TableCell>
                  <StatusBadge status={report.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <p className="text-center py-8 text-muted-foreground">
          日報がありません
        </p>
      )}
    </div>
  );
}
