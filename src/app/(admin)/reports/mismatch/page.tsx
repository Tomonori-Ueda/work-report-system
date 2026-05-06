
'use client';

import { useMemo, useState } from 'react';
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useMismatchCheck } from '@/hooks/use-reports';
import { formatDateToISO } from '@/lib/utils/date';
import type {
  MismatchRecord,
  NameMismatchRecord,
  NameMismatchKind,
} from '@/types/api';

/** 既存の時間ズレ系バッジ */
function MismatchBadge({ type }: { type: MismatchRecord['mismatchType'] }) {
  switch (type) {
    case 'missing_field_report':
      return (
        <Badge variant="destructive" className="whitespace-nowrap">
          🔴 現場日報なし
        </Badge>
      );
    case 'hours_mismatch':
      return (
        <Badge
          variant="outline"
          className="whitespace-nowrap border-yellow-400 text-yellow-700 bg-yellow-50"
        >
          🟡 時間不一致
        </Badge>
      );
    case 'ok':
      return (
        <Badge
          variant="outline"
          className="whitespace-nowrap border-green-400 text-green-700 bg-green-50"
        >
          🟢 OK
        </Badge>
      );
  }
}

/** Phase 3: 名寄せ照合バッジ */
function NameMismatchBadge({ kind }: { kind: NameMismatchKind }) {
  switch (kind) {
    case 'name_missing':
      return (
        <Badge variant="destructive" className="whitespace-nowrap">
          🔴 本人日報なし
        </Badge>
      );
    case 'site_mismatch':
      return (
        <Badge
          variant="outline"
          className="whitespace-nowrap border-orange-400 text-orange-700 bg-orange-50"
        >
          🟠 別現場
        </Badge>
      );
    case 'hours_mismatch':
      return (
        <Badge
          variant="outline"
          className="whitespace-nowrap border-yellow-400 text-yellow-700 bg-yellow-50"
        >
          🟡 時間ズレ
        </Badge>
      );
    case 'ok':
      return (
        <Badge
          variant="outline"
          className="whitespace-nowrap border-green-400 text-green-700 bg-green-50"
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

  const summary = data?.nameMismatchSummary ?? {
    nameMissing: 0,
    siteMismatch: 0,
    hoursMismatch: 0,
  };

  // 既存（作業員視点）
  const hoursMismatches = useMemo<MismatchRecord[]>(
    () => data?.mismatches.filter((r) => r.mismatchType !== 'ok') ?? [],
    [data]
  );
  const missingFieldReportRecords = useMemo<MismatchRecord[]>(
    () =>
      data?.mismatches.filter((r) => r.mismatchType === 'missing_field_report') ??
      [],
    [data]
  );

  // 名寄せ（監督視点）
  const nameMismatches = useMemo<NameMismatchRecord[]>(
    () => data?.nameMismatches ?? [],
    [data]
  );
  const filterByKind = (kind: NameMismatchKind) =>
    nameMismatches.filter((r) => r.kind === kind);

  return (
    <div className="space-y-6">
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

      {/* サマリ */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        <SummaryCard
          label="本人日報なし"
          value={summary.nameMissing}
          color="text-red-600"
        />
        <SummaryCard
          label="別現場で日報"
          value={summary.siteMismatch}
          color="text-orange-600"
        />
        <SummaryCard
          label="時間ズレ"
          value={summary.hoursMismatch + hoursMismatches.length}
          color="text-yellow-600"
        />
        <SummaryCard
          label="現場日報なし"
          value={missingFieldReportRecords.length}
          color="text-red-600"
        />
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">読み込み中...</p>
      ) : isError ? (
        <p className="text-destructive">
          照合データの取得に失敗しました。再度お試しください。
        </p>
      ) : !data ? (
        <p className="py-8 text-center text-muted-foreground">
          {selectedDate} の照合対象データがありません
        </p>
      ) : (
        <Tabs defaultValue="name-missing">
          <TabsList className="flex-wrap">
            <TabsTrigger value="name-missing">
              本人日報なし
              {summary.nameMissing > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {summary.nameMissing}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="site-mismatch">
              別現場
              {summary.siteMismatch > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {summary.siteMismatch}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="hours-mismatch">
              時間ズレ
              {summary.hoursMismatch + hoursMismatches.length > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {summary.hoursMismatch + hoursMismatches.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="missing-field-report">
              現場日報なし
              {missingFieldReportRecords.length > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {missingFieldReportRecords.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="hours-all">作業員時間照合</TabsTrigger>
          </TabsList>

          <TabsContent value="name-missing" className="mt-4">
            <NameMismatchTable
              records={filterByKind('name_missing')}
              emptyText="本人日報なしの不一致はありません"
              showWorkerSiteCol={false}
            />
          </TabsContent>

          <TabsContent value="site-mismatch" className="mt-4">
            <NameMismatchTable
              records={filterByKind('site_mismatch')}
              emptyText="別現場の不一致はありません"
              showWorkerSiteCol
            />
          </TabsContent>

          <TabsContent value="hours-mismatch" className="mt-4">
            <NameMismatchTable
              records={filterByKind('hours_mismatch')}
              emptyText="名寄せ側の時間ズレはありません"
              showWorkerSiteCol={false}
            />
          </TabsContent>

          <TabsContent value="missing-field-report" className="mt-4">
            <HoursMismatchTable records={missingFieldReportRecords} />
          </TabsContent>

          <TabsContent value="hours-all" className="mt-4">
            <HoursMismatchTable records={data.mismatches} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <Card className="min-w-[120px]">
      <CardHeader className="pb-1 pt-3 px-4">
        <CardTitle className="text-xs font-medium text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-3">
        <p className={`text-2xl font-bold ${color}`}>
          {value}
          <span className="text-sm font-normal text-muted-foreground ml-1">件</span>
        </p>
      </CardContent>
    </Card>
  );
}

/** 名寄せ照合の表示テーブル */
function NameMismatchTable({
  records,
  emptyText,
  showWorkerSiteCol,
}: {
  records: NameMismatchRecord[];
  emptyText: string;
  showWorkerSiteCol: boolean;
}) {
  if (records.length === 0) {
    return (
      <p className="py-8 text-center text-muted-foreground">{emptyText}</p>
    );
  }
  return (
    <div className="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>監督が記載した名前</TableHead>
            <TableHead>マッチした作業員</TableHead>
            <TableHead>監督側の現場</TableHead>
            {showWorkerSiteCol && <TableHead>本人が出した現場</TableHead>}
            <TableHead>区分</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.map((r, i) => (
            <TableRow key={`${r.fieldReportId}-${r.recordedName}-${i}`}>
              <TableCell className="font-medium">{r.recordedName}</TableCell>
              <TableCell className="text-muted-foreground">
                {r.matchedUserName ?? '—'}
              </TableCell>
              <TableCell>{r.supervisorSiteName}</TableCell>
              {showWorkerSiteCol && (
                <TableCell className="text-muted-foreground">
                  {r.workerSiteName ?? '—'}
                </TableCell>
              )}
              <TableCell>
                <NameMismatchBadge kind={r.kind} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/** 既存の時間ズレ照合テーブル */
function HoursMismatchTable({ records }: { records: MismatchRecord[] }) {
  if (records.length === 0) {
    return (
      <p className="py-8 text-center text-muted-foreground">
        該当する不一致はありません
      </p>
    );
  }
  return (
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
          {records.map((r) => (
            <TableRow
              key={`${r.reportId}-${r.siteId}`}
              className={
                r.mismatchType === 'missing_field_report'
                  ? 'bg-red-50/50'
                  : r.mismatchType === 'hours_mismatch'
                  ? 'bg-yellow-50/50'
                  : undefined
              }
            >
              <TableCell className="font-medium">{r.userName}</TableCell>
              <TableCell>{r.siteName}</TableCell>
              <TableCell className="text-right tabular-nums">
                {r.workerTotalHours.toFixed(1)}h
              </TableCell>
              <TableCell className="text-muted-foreground">
                {supervisorRecordText(r)}
              </TableCell>
              <TableCell>
                <MismatchBadge type={r.mismatchType} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
