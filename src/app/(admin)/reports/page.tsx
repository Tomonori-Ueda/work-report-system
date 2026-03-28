'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Download } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/features/report/status-badge';
import { useReports } from '@/hooks/use-reports';
import { formatDateToJapanese } from '@/lib/utils/date';
import { REPORT_STATUS, type ReportStatus, type DailyReportWithUser } from '@/types/report';
import { parseISO, startOfWeek, endOfWeek, format } from 'date-fns';
import { ja } from 'date-fns/locale';
import * as XLSX from 'xlsx';

/** 集計行 */
interface SummaryRow {
  label: string;
  regularHours: number;
  overtimeHours: number;
  totalHours: number;
  count: number;
}

/** 日報を指定キーでグルーピングし集計 */
function aggregateReports(
  reports: DailyReportWithUser[],
  keyFn: (r: DailyReportWithUser) => string
): SummaryRow[] {
  const map = new Map<string, SummaryRow>();
  for (const r of reports) {
    const key = keyFn(r);
    const existing = map.get(key);
    if (existing) {
      existing.regularHours += r.regularHours;
      existing.overtimeHours += r.overtimeHours;
      existing.totalHours += r.regularHours + r.overtimeHours;
      existing.count += 1;
    } else {
      map.set(key, {
        label: key,
        regularHours: r.regularHours,
        overtimeHours: r.overtimeHours,
        totalHours: r.regularHours + r.overtimeHours,
        count: 1,
      });
    }
  }
  return [...map.values()].sort((a, b) => b.label.localeCompare(a.label));
}

/** Excel出力 */
function exportToExcel(reports: DailyReportWithUser[]) {
  const rows = reports.map((r) => ({
    日付: r.reportDate,
    従業員: r.userName,
    開始: r.startTime,
    終了: r.endTime,
    所定時間: r.regularHours,
    残業時間: r.overtimeHours,
    合計時間: r.regularHours + r.overtimeHours,
    作業内容: r.workEntries
      ? r.workEntries.map((e) => `${e.startTime}〜${e.endTime} ${e.content}`).join('\n')
      : r.workContent,
    備考: r.notes ?? '',
    ステータス:
      r.status === 'approved' ? '承認済' :
      r.status === 'submitted' ? '提出済' :
      r.status === 'rejected' ? '差戻' : '下書き',
    承認者: r.approvedByName ?? '',
  }));

  const ws = XLSX.utils.json_to_sheet(rows);

  // 列幅を設定
  ws['!cols'] = [
    { wch: 12 }, { wch: 10 }, { wch: 6 }, { wch: 6 },
    { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 40 },
    { wch: 20 }, { wch: 8 }, { wch: 10 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '日報一覧');
  XLSX.writeFile(wb, `日報一覧_${format(new Date(), 'yyyyMMdd')}.xlsx`);
}

/** 管理者: 日報管理画面 */
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

  // 集計データ
  const dailySummary = useMemo(
    () => reports ? aggregateReports(reports, (r) => r.reportDate) : [],
    [reports]
  );

  const weeklySummary = useMemo(
    () => reports
      ? aggregateReports(reports, (r) => {
          const date = parseISO(r.reportDate);
          const weekStart = startOfWeek(date, { weekStartsOn: 1 });
          const weekEnd = endOfWeek(date, { weekStartsOn: 1 });
          return `${format(weekStart, 'MM/dd')}〜${format(weekEnd, 'MM/dd')}`;
        })
      : [],
    [reports]
  );

  const monthlySummary = useMemo(
    () => reports
      ? aggregateReports(reports, (r) => {
          const date = parseISO(r.reportDate);
          return format(date, 'yyyy年MM月', { locale: ja });
        })
      : [],
    [reports]
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">日報管理</h1>
        {reports && reports.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportToExcel(reports)}
          >
            <Download className="h-4 w-4 mr-1" />
            Excel出力
          </Button>
        )}
      </div>

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

      <Tabs defaultValue="list">
        <TabsList>
          <TabsTrigger value="list">一覧</TabsTrigger>
          <TabsTrigger value="daily">日別集計</TabsTrigger>
          <TabsTrigger value="weekly">週別集計</TabsTrigger>
          <TabsTrigger value="monthly">月別集計</TabsTrigger>
        </TabsList>

        {/* 一覧タブ */}
        <TabsContent value="list" className="mt-4">
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
        </TabsContent>

        {/* 日別集計 */}
        <TabsContent value="daily" className="mt-4">
          <SummaryTable rows={dailySummary} labelHeader="日付" />
        </TabsContent>

        {/* 週別集計 */}
        <TabsContent value="weekly" className="mt-4">
          <SummaryTable rows={weeklySummary} labelHeader="週" />
        </TabsContent>

        {/* 月別集計 */}
        <TabsContent value="monthly" className="mt-4">
          <SummaryTable rows={monthlySummary} labelHeader="月" />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/** 集計テーブル */
function SummaryTable({
  rows,
  labelHeader,
}: {
  rows: SummaryRow[];
  labelHeader: string;
}) {
  if (rows.length === 0) {
    return (
      <p className="text-center py-8 text-muted-foreground">データがありません</p>
    );
  }

  const totalRegular = rows.reduce((s, r) => s + r.regularHours, 0);
  const totalOvertime = rows.reduce((s, r) => s + r.overtimeHours, 0);
  const totalAll = rows.reduce((s, r) => s + r.totalHours, 0);
  const totalCount = rows.reduce((s, r) => s + r.count, 0);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{labelHeader}</TableHead>
          <TableHead className="text-right">件数</TableHead>
          <TableHead className="text-right">所定時間</TableHead>
          <TableHead className="text-right">残業時間</TableHead>
          <TableHead className="text-right">合計時間</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.label}>
            <TableCell className="font-medium">{row.label}</TableCell>
            <TableCell className="text-right">{row.count}</TableCell>
            <TableCell className="text-right">{row.regularHours}h</TableCell>
            <TableCell className="text-right">{row.overtimeHours}h</TableCell>
            <TableCell className="text-right font-medium">{row.totalHours}h</TableCell>
          </TableRow>
        ))}
        <TableRow className="bg-muted/50 font-bold">
          <TableCell>合計</TableCell>
          <TableCell className="text-right">{totalCount}</TableCell>
          <TableCell className="text-right">{totalRegular}h</TableCell>
          <TableCell className="text-right">{totalOvertime}h</TableCell>
          <TableCell className="text-right">{totalAll}h</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}
