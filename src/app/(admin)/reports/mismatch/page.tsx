'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useMismatchCheck } from '@/hooks/use-reports';
import { formatDateToISO } from '@/lib/utils/date';
import type { MismatchRecord } from '@/types/api';

/** ミスマッチタイプに応じたラベルとスタイルを返す */
function MismatchBadge({ type }: { type: MismatchRecord['mismatchType'] }) {
  switch (type) {
    case 'missing_field_report':
      return (
        <Badge
          variant="destructive"
          className="whitespace-nowrap"
          aria-label="現場日報未記録"
        >
          🔴 要確認
        </Badge>
      );
    case 'hours_mismatch':
      return (
        <Badge
          variant="outline"
          className="whitespace-nowrap border-yellow-400 text-yellow-700 bg-yellow-50"
          aria-label="時間不一致"
        >
          🟡 確認中
        </Badge>
      );
    case 'ok':
      return (
        <Badge
          variant="outline"
          className="whitespace-nowrap border-green-400 text-green-700 bg-green-50"
          aria-label="問題なし"
        >
          🟢 OK
        </Badge>
      );
  }
}

/** 現場監督の記録欄テキストを生成 */
function supervisorRecordText(record: MismatchRecord): string {
  if (record.fieldReportId === null) {
    return '未記録';
  }
  if (record.supervisorWorkerCount !== null) {
    return `記録あり（${record.supervisorWorkerCount}名）`;
  }
  return '記録あり';
}

/** 照合チェックページ本体 */
export default function MismatchCheckPage() {
  const [selectedDate, setSelectedDate] = useState(formatDateToISO(new Date()));

  const { data, isLoading, isError } = useMismatchCheck(selectedDate);

  const missingCount = data?.mismatches.filter(
    (r) => r.mismatchType === 'missing_field_report'
  ).length ?? 0;

  const mismatchCount = data?.mismatchCount ?? 0;

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">照合チェック</h1>
        <Input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="w-[180px]"
          aria-label="照合対象日"
        />
      </div>

      {/* サマリバッジ */}
      <div className="flex flex-wrap gap-3">
        <Card className="min-w-[140px]">
          <CardHeader className="pb-1 pt-3 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              未照合（現場日報なし）
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <p className="text-2xl font-bold text-red-600">
              {isLoading ? '—' : missingCount}
              <span className="text-sm font-normal text-muted-foreground ml-1">件</span>
            </p>
          </CardContent>
        </Card>

        <Card className="min-w-[140px]">
          <CardHeader className="pb-1 pt-3 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              要確認（ミスマッチ）
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <p className="text-2xl font-bold text-yellow-600">
              {isLoading ? '—' : mismatchCount}
              <span className="text-sm font-normal text-muted-foreground ml-1">件</span>
            </p>
          </CardContent>
        </Card>

        <Card className="min-w-[140px]">
          <CardHeader className="pb-1 pt-3 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              照合対象合計
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <p className="text-2xl font-bold">
              {isLoading ? '—' : (data?.totalCount ?? 0)}
              <span className="text-sm font-normal text-muted-foreground ml-1">件</span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* テーブル */}
      {isLoading ? (
        <p className="text-muted-foreground">読み込み中...</p>
      ) : isError ? (
        <p className="text-destructive">照合データの取得に失敗しました。再度お試しください。</p>
      ) : !data || data.mismatches.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">
          {selectedDate} の照合対象データがありません
        </p>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>作業員名</TableHead>
                <TableHead>現場名</TableHead>
                <TableHead className="text-right">申告時間</TableHead>
                <TableHead>現場監督記録</TableHead>
                <TableHead>ステータス</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.mismatches.map((record) => (
                <TableRow
                  key={`${record.reportId}-${record.siteId}`}
                  className={
                    record.mismatchType === 'missing_field_report'
                      ? 'bg-red-50/50'
                      : record.mismatchType === 'hours_mismatch'
                      ? 'bg-yellow-50/50'
                      : undefined
                  }
                >
                  <TableCell className="font-medium">{record.userName}</TableCell>
                  <TableCell>{record.siteName}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {record.workerTotalHours.toFixed(1)}h
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {supervisorRecordText(record)}
                  </TableCell>
                  <TableCell>
                    <MismatchBadge type={record.mismatchType} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
