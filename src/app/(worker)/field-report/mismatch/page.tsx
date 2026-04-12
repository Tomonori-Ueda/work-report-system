'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getIdToken } from '@/lib/firebase/auth';
import { useRequireAuth } from '@/hooks/use-auth';
import { isSupervisor } from '@/types/user';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, AlertTriangle, FileQuestion } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ApiSuccessResponse } from '@/types/api';
import type { MismatchCheckResponse, MismatchRecord } from '@/types/api';

/** 不一致種別バッジ */
function MismatchBadge({ type }: { type: MismatchRecord['mismatchType'] }) {
  if (type === 'ok') {
    return (
      <Badge className="bg-green-100 text-green-800 border-green-300 gap-1">
        <CheckCircle2 className="h-3 w-3" />
        一致
      </Badge>
    );
  }
  if (type === 'hours_mismatch') {
    return (
      <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300 gap-1">
        <AlertTriangle className="h-3 w-3" />
        時間差異
      </Badge>
    );
  }
  // missing_field_report
  return (
    <Badge className="bg-red-100 text-red-800 border-red-300 gap-1">
      <FileQuestion className="h-3 w-3" />
      日報未作成
    </Badge>
  );
}

/** 今日の日付を YYYY-MM-DD 形式で返す */
function todayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** 照合チェックページ（現場監督用） */
export default function FieldReportMismatchPage() {
  const { role, isLoading: authLoading } = useRequireAuth();
  const [selectedDate, setSelectedDate] = useState(todayString());
  const [queryDate, setQueryDate] = useState(todayString());

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['mismatch', queryDate],
    queryFn: async () => {
      const token = await getIdToken();
      const res = await fetch(`/api/reports/mismatch?date=${queryDate}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('照合データの取得に失敗しました');
      const json = (await res.json()) as ApiSuccessResponse<MismatchCheckResponse>;
      return json.data;
    },
    enabled: !!queryDate,
  });

  if (authLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!role || !isSupervisor(role)) {
    return (
      <Card className="border-destructive">
        <CardContent className="flex items-center gap-3 py-6">
          <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
          <p className="text-sm text-destructive">
            照合チェックはGロール（現場監督）専用の機能です。
          </p>
        </CardContent>
      </Card>
    );
  }

  const mismatches = data?.mismatches ?? [];
  const problemRecords = mismatches.filter((r) => r.mismatchType !== 'ok');

  function handleSearch() {
    setQueryDate(selectedDate);
    void refetch();
  }

  return (
    <div className="space-y-4">
      {/* ヘッダー */}
      <div>
        <h1 className="text-xl font-bold">照合チェック</h1>
        <p className="text-sm text-muted-foreground mt-1">
          作業員の日報と現場日報を照合して差異を確認します
        </p>
      </div>

      {/* 日付選択 */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <p className="text-xs text-muted-foreground mb-1">確認日</p>
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                max={todayString()}
              />
            </div>
            <Button onClick={handleSearch} disabled={!selectedDate || isLoading}>
              照合する
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* サマリカード */}
      {data && (
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardHeader className="pb-1 pt-3 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                照合件数
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <p className="text-2xl font-bold">
                {data.totalCount}
                <span className="text-sm font-normal text-muted-foreground ml-1">件</span>
              </p>
            </CardContent>
          </Card>
          <Card className={cn(data.mismatchCount > 0 ? 'border-yellow-400' : '')}>
            <CardHeader className="pb-1 pt-3 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                要確認
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <p className={cn('text-2xl font-bold', data.mismatchCount > 0 ? 'text-yellow-600' : 'text-green-600')}>
                {data.mismatchCount}
                <span className="text-sm font-normal text-muted-foreground ml-1">件</span>
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ローディング */}
      {isLoading && (
        <div className="flex justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      )}

      {/* エラー */}
      {isError && (
        <Card className="border-destructive">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
            <p className="text-sm text-destructive">
              照合データの取得に失敗しました
            </p>
          </CardContent>
        </Card>
      )}

      {/* 要確認のみ表示 */}
      {!isLoading && data && problemRecords.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-yellow-700">要確認の記録</p>
          {problemRecords.map((record) => (
            <Card key={`${record.reportId}-${record.siteId}`} className="border-yellow-200 bg-yellow-50/40">
              <CardContent className="pt-3 pb-3 px-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{record.siteName}</p>
                    <p className="text-xs text-muted-foreground">{record.userName}</p>
                  </div>
                  <MismatchBadge type={record.mismatchType} />
                </div>
                <div className="flex gap-4 text-xs text-muted-foreground">
                  <span>
                    作業員申告:{' '}
                    <span className="font-medium text-foreground">
                      {record.workerTotalHours.toFixed(1)}h
                    </span>
                  </span>
                  {record.supervisorWorkerCount != null && (
                    <span>
                      現場人数:{' '}
                      <span className="font-medium text-foreground">
                        {record.supervisorWorkerCount}名
                      </span>
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 全件表示 */}
      {!isLoading && data && mismatches.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">全照合記録</p>
          {mismatches.map((record) => (
            <Card key={`all-${record.reportId}-${record.siteId}`}>
              <CardContent className="pt-3 pb-3 px-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm truncate">{record.siteName}</p>
                    <p className="text-xs text-muted-foreground">{record.userName}</p>
                  </div>
                  <MismatchBadge type={record.mismatchType} />
                </div>
                <div className="flex gap-4 text-xs text-muted-foreground mt-1">
                  <span>
                    申告:{' '}
                    <span className="font-medium text-foreground">
                      {record.workerTotalHours.toFixed(1)}h
                    </span>
                  </span>
                  {record.supervisorWorkerCount != null && (
                    <span>
                      現場人数:{' '}
                      <span className="font-medium text-foreground">
                        {record.supervisorWorkerCount}名
                      </span>
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 空状態 */}
      {!isLoading && data && mismatches.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <CheckCircle2 className="h-10 w-10 mx-auto mb-3 text-green-400" />
          <p className="text-sm">{queryDate} の照合対象データがありません</p>
        </div>
      )}
    </div>
  );
}
