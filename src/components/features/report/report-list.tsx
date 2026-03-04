'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ReportCard } from './report-card';
import { useReports } from '@/hooks/use-reports';
import { REPORT_STATUS, type ReportStatus } from '@/types/report';

/** 日報履歴一覧 */
export function ReportList() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const filters = {
    ...(statusFilter !== 'all' ? { status: statusFilter as ReportStatus } : {}),
    ...(startDate ? { startDate } : {}),
    ...(endDate ? { endDate } : {}),
  };

  const { data: reports, isLoading, error } = useReports(filters);

  return (
    <div className="space-y-4">
      {/* フィルタ */}
      <div className="flex flex-col sm:flex-row gap-2">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[140px]">
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
          placeholder="開始日"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="w-full sm:w-[160px]"
        />
        <Input
          type="date"
          placeholder="終了日"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="w-full sm:w-[160px]"
        />
      </div>

      {/* 一覧 */}
      {isLoading && (
        <div className="text-center py-8 text-muted-foreground">
          読み込み中...
        </div>
      )}

      {error && (
        <div className="text-center py-8 text-destructive">
          日報の取得に失敗しました
        </div>
      )}

      {reports && reports.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          日報がありません
        </div>
      )}

      {reports && reports.length > 0 && (
        <div className="space-y-2">
          {reports.map((report) => (
            <ReportCard key={report.id} report={report} />
          ))}
        </div>
      )}
    </div>
  );
}
