'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getIdToken } from '@/lib/firebase/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { ApiSuccessResponse } from '@/types/api';
import type { LeaveCalendarEntry } from '@/app/api/leave/calendar/route';

/** 休暇種別ラベル */
const LEAVE_TYPE_LABEL: Record<string, string> = {
  paid: '有給',
  special: '特別',
  unpaid: '無休',
};

/** 休暇単位ラベル */
const LEAVE_UNIT_LABEL: Record<string, string> = {
  full_day: '全日',
  half_day_am: '午前半休',
  half_day_pm: '午後半休',
  hourly: '時間単位',
};

/** ステータス別バッジスタイル */
function LeaveBadge({
  entry,
}: {
  entry: LeaveCalendarEntry;
}) {
  const typeLabel = LEAVE_TYPE_LABEL[entry.leaveType] ?? entry.leaveType;
  const unitLabel = LEAVE_UNIT_LABEL[entry.leaveUnit] ?? entry.leaveUnit;
  const label =
    entry.leaveUnit === 'hourly' && entry.leaveHours != null
      ? `${entry.userName}（${typeLabel}・${entry.leaveHours}h）`
      : `${entry.userName}（${typeLabel}・${unitLabel}）`;

  const colorClass =
    entry.status === 'approved'
      ? 'bg-green-100 text-green-800 border-green-300'
      : entry.status === 'rejected'
      ? 'bg-red-100 text-red-800 border-red-300 line-through opacity-60'
      : 'bg-yellow-100 text-yellow-800 border-yellow-300';

  return (
    <span
      className={cn(
        'block truncate rounded border px-1 py-0.5 text-xs leading-tight',
        colorClass
      )}
      title={label}
    >
      {label}
    </span>
  );
}

/** 年リスト（過去2年〜来年） */
function generateYearOptions(): number[] {
  const y = new Date().getFullYear();
  return [y - 2, y - 1, y, y + 1];
}

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => i + 1);

/** カレンダーの1週行の曜日ヘッダー */
const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'] as const;

/** 有給カレンダーページ */
export default function LeaveCalendarPage() {
  const today = new Date();
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['leave', 'calendar', selectedYear, selectedMonth],
    queryFn: async () => {
      const token = await getIdToken();
      const res = await fetch(
        `/api/leave/calendar?year=${selectedYear}&month=${selectedMonth}`,
        {
          headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        }
      );
      if (!res.ok) throw new Error('有給カレンダーの取得に失敗しました');
      const json = (await res.json()) as ApiSuccessResponse<{
        year: number;
        month: number;
        entries: LeaveCalendarEntry[];
      }>;
      return json.data;
    },
  });

  // 日付 → エントリ配列のマップを構築
  const entriesByDate = new Map<string, LeaveCalendarEntry[]>();
  data?.entries.forEach((entry) => {
    const list = entriesByDate.get(entry.leaveDate) ?? [];
    list.push(entry);
    entriesByDate.set(entry.leaveDate, list);
  });

  // カレンダーグリッドを生成（日曜始まり）
  const firstDay = new Date(selectedYear, selectedMonth - 1, 1).getDay(); // 0=日
  const lastDate = new Date(selectedYear, selectedMonth, 0).getDate();

  // 承認済みの取得者数（当月合計）
  const approvedCount =
    data?.entries.filter((e) => e.status === 'approved').length ?? 0;
  const pendingCount =
    data?.entries.filter((e) => e.status === 'pending').length ?? 0;

  // 前月・次月ナビゲーション
  function goPrev() {
    if (selectedMonth === 1) {
      setSelectedYear((y) => y - 1);
      setSelectedMonth(12);
    } else {
      setSelectedMonth((m) => m - 1);
    }
  }
  function goNext() {
    if (selectedMonth === 12) {
      setSelectedYear((y) => y + 1);
      setSelectedMonth(1);
    } else {
      setSelectedMonth((m) => m + 1);
    }
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">有給カレンダー</h1>
          <p className="text-sm text-muted-foreground mt-1">
            社員の有給取得状況を月別で確認できます
          </p>
        </div>

        {/* 月選択 */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={goPrev}>
            ‹
          </Button>
          <Select
            value={String(selectedYear)}
            onValueChange={(v) => setSelectedYear(parseInt(v, 10))}
          >
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {generateYearOptions().map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}年
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={String(selectedMonth)}
            onValueChange={(v) => setSelectedMonth(parseInt(v, 10))}
          >
            <SelectTrigger className="w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTH_OPTIONS.map((m) => (
                <SelectItem key={m} value={String(m)}>
                  {m}月
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={goNext}>
            ›
          </Button>
        </div>
      </div>

      {/* サマリ */}
      <div className="flex gap-3 flex-wrap">
        <Card className="min-w-[120px]">
          <CardHeader className="pb-1 pt-3 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              承認済み
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <p className="text-2xl font-bold text-green-600">
              {isLoading ? '—' : approvedCount}
              <span className="text-sm font-normal text-muted-foreground ml-1">件</span>
            </p>
          </CardContent>
        </Card>
        <Card className="min-w-[120px]">
          <CardHeader className="pb-1 pt-3 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              申請中
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <p className="text-2xl font-bold text-yellow-600">
              {isLoading ? '—' : pendingCount}
              <span className="text-sm font-normal text-muted-foreground ml-1">件</span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 凡例 */}
      <div className="flex gap-3 text-xs flex-wrap">
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded bg-green-100 border border-green-300" />
          承認済み
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded bg-yellow-100 border border-yellow-300" />
          申請中
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded bg-red-100 border border-red-300" />
          却下
        </span>
      </div>

      {/* カレンダーグリッド */}
      {isLoading ? (
        <p className="text-muted-foreground py-8 text-center">読み込み中...</p>
      ) : isError ? (
        <p className="text-destructive py-4">カレンダーデータの取得に失敗しました</p>
      ) : (
        <div className="rounded-lg border overflow-hidden bg-white">
          {/* 曜日ヘッダー */}
          <div className="grid grid-cols-7 border-b">
            {WEEKDAYS.map((day, i) => (
              <div
                key={day}
                className={cn(
                  'py-2 text-center text-sm font-medium',
                  i === 0 && 'text-red-500',
                  i === 6 && 'text-blue-500'
                )}
              >
                {day}
              </div>
            ))}
          </div>

          {/* 日付セル */}
          <div className="grid grid-cols-7">
            {/* 月初の空白 */}
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`empty-${i}`} className="min-h-[80px] border-b border-r bg-gray-50/50" />
            ))}

            {/* 日付 */}
            {Array.from({ length: lastDate }, (_, i) => i + 1).map((day) => {
              const dateStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const entries = entriesByDate.get(dateStr) ?? [];
              const isToday =
                day === today.getDate() &&
                selectedMonth === today.getMonth() + 1 &&
                selectedYear === today.getFullYear();
              const dayOfWeek = new Date(selectedYear, selectedMonth - 1, day).getDay();

              return (
                <div
                  key={day}
                  className={cn(
                    'min-h-[80px] border-b border-r p-1',
                    isToday && 'bg-blue-50/50',
                    entries.length > 0 && 'bg-amber-50/30'
                  )}
                >
                  <p
                    className={cn(
                      'text-sm font-medium mb-1',
                      isToday &&
                        'inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white text-xs',
                      !isToday && dayOfWeek === 0 && 'text-red-500',
                      !isToday && dayOfWeek === 6 && 'text-blue-500'
                    )}
                  >
                    {day}
                  </p>
                  <div className="space-y-0.5">
                    {entries.map((entry) => (
                      <LeaveBadge key={entry.id} entry={entry} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
