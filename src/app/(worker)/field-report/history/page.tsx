'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useRequireAuth } from '@/hooks/use-auth';
import { useFieldReports } from '@/hooks/use-field-reports';
import { getIdToken } from '@/lib/firebase/auth';
import { isSupervisor } from '@/types/user';
import { WEATHER, type Weather } from '@/types/field-report';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { PlusCircle, AlertCircle, CloudRain, Cloud, Sun, Snowflake } from 'lucide-react';
import type { FieldReportFilter } from '@/lib/validations/field-report';

/** 現場マスター型 */
interface SiteMaster {
  id: string;
  siteName: string;
}

/** 現場別工数累計型 */
interface SiteSummary {
  siteId: string;
  siteName: string | null;
  totalReportCount: number;
  totalWorkerDays: number;
  totalWorkerHours: number | null;
  latestReportDate: string | null;
  oldestReportDate: string | null;
}

/** 天候アイコンマッピング */
const WEATHER_ICON: Record<Weather, React.ReactNode> = {
  [WEATHER.SUNNY]: <Sun className="h-4 w-4 text-yellow-500" />,
  [WEATHER.CLOUDY]: <Cloud className="h-4 w-4 text-gray-400" />,
  [WEATHER.RAINY]: <CloudRain className="h-4 w-4 text-blue-400" />,
  [WEATHER.SNOWY]: <Snowflake className="h-4 w-4 text-cyan-400" />,
};

/** 天候ラベル */
const WEATHER_LABEL: Record<Weather, string> = {
  [WEATHER.SUNNY]: '晴れ',
  [WEATHER.CLOUDY]: '曇り',
  [WEATHER.RAINY]: '雨',
  [WEATHER.SNOWY]: '雪',
};

/** 全フィルターリセット用の定数 */
const ALL_FILTER_VALUE = '__all__';

/** 現場日報一覧画面 */
export default function FieldReportHistoryPage() {
  const { role, isLoading: authLoading } = useRequireAuth();

  const [sites, setSites] = useState<SiteMaster[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // 現場マスターを取得（失敗時は空配列）
  useEffect(() => {
    getIdToken()
      .then((token) =>
        fetch('/api/masters/sites?active=true', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
      )
      .then((res) => (res.ok ? res.json() : null))
      .then((json: unknown) => {
        const typed = json as { data?: { sites?: SiteMaster[] } } | null;
        if (typed?.data?.sites && Array.isArray(typed.data.sites)) {
          setSites(typed.data.sites);
        }
      })
      .catch(() => {
        // 現場マスターAPIが未実装でも無視
      });
  }, []);

  // 現場選択時に工数累計を取得（React Query でキャッシュ管理）
  const { data: siteSummary, isLoading: summaryLoading } = useQuery({
    queryKey: ['field-reports', 'site-summary', selectedSiteId],
    queryFn: async (): Promise<SiteSummary | null> => {
      const token = await getIdToken();
      const res = await fetch(
        `/api/field-reports/site-summary?siteId=${selectedSiteId}`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
      if (!res.ok) return null;
      const json = (await res.json()) as { data?: SiteSummary } | null;
      return json?.data ?? null;
    },
    enabled: !!selectedSiteId,
  });

  const filters: FieldReportFilter = {
    ...(selectedSiteId ? { siteId: selectedSiteId } : {}),
    ...(startDate ? { startDate } : {}),
    ...(endDate ? { endDate } : {}),
  };

  const { data, isLoading, error } = useFieldReports(filters);

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
            現場日報一覧はGロール（現場監督）専用の機能です。
          </p>
        </CardContent>
      </Card>
    );
  }

  const fieldReports = data?.fieldReports ?? [];

  return (
    <div className="space-y-4">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">現場日報一覧</h1>
        <Button asChild size="sm" className="min-h-[40px]">
          <Link href="/field-report/new">
            <PlusCircle className="h-4 w-4 mr-1" />
            新規入力
          </Link>
        </Button>
      </div>

      {/* フィルタ */}
      <Card>
        <CardContent className="pt-4 pb-4 space-y-3">
          {/* 現場フィルタ */}
          {sites.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">現場</p>
              <Select
                value={selectedSiteId || ALL_FILTER_VALUE}
                onValueChange={(v) =>
                  setSelectedSiteId(v === ALL_FILTER_VALUE ? '' : v)
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="すべての現場" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_FILTER_VALUE}>すべての現場</SelectItem>
                  {sites.map((site) => (
                    <SelectItem key={site.id} value={site.id}>
                      {site.siteName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* 現場別工数累計カード */}
          {selectedSiteId && (
            <Card className="bg-slate-50 border-slate-200">
              <CardHeader className="pb-1 pt-3 px-4">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  {siteSummary?.siteName ?? '現場'} — 工数累計
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                {summaryLoading ? (
                  <p className="text-xs text-muted-foreground">読み込み中...</p>
                ) : siteSummary ? (
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                      <p className="text-lg font-bold">{siteSummary.totalReportCount}</p>
                      <p className="text-xs text-muted-foreground">日報件数</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold">{siteSummary.totalWorkerDays}</p>
                      <p className="text-xs text-muted-foreground">延べ人工</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold">
                        {siteSummary.totalWorkerHours != null
                          ? `${siteSummary.totalWorkerHours}h`
                          : '—'}
                      </p>
                      <p className="text-xs text-muted-foreground">延べ時間</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">データがありません</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* 期間フィルタ */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-xs text-muted-foreground mb-1">開始日</p>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">終了日</p>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 一覧 */}
      {isLoading && (
        <div className="flex justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      )}

      {error && (
        <Card className="border-destructive">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
            <p className="text-sm text-destructive">
              現場日報の取得に失敗しました
            </p>
          </CardContent>
        </Card>
      )}

      {!isLoading && !error && fieldReports.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-sm">現場日報がありません</p>
          <Button asChild variant="outline" className="mt-4" size="sm">
            <Link href="/field-report/new">最初の日報を入力する</Link>
          </Button>
        </div>
      )}

      {!isLoading && fieldReports.length > 0 && (
        <div className="space-y-3">
          {fieldReports.map((report) => (
            <Link key={report.id} href={`/field-report/${report.id}`}>
              <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1 min-w-0">
                      <p className="font-medium truncate">{report.siteName}</p>
                      <p className="text-sm text-muted-foreground">
                        {report.reportDate}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        {WEATHER_ICON[report.weather as Weather]}
                        {WEATHER_LABEL[report.weather as Weather]}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 mt-2">
                    <Badge variant="secondary" className="text-xs">
                      協力会社 {report.subcontractorWorks.length} 社
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      合計 {report.totalWorkerCount} 名
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
