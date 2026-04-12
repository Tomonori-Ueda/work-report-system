'use client';

import { use } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/features/report/status-badge';
import { getIdToken } from '@/lib/firebase/auth';
import { getMonthRange, formatDateToJapanese } from '@/lib/utils/date';
import type { ApiSuccessResponse } from '@/types/api';
import type { User } from '@/types/user';
import type { DailyReportWithUser } from '@/types/report';

/** 給与計算APIレスポンス型 */
interface SalaryMonthlyData {
  userId: string;
  year: number;
  month: number;
  workDays: number;
  totalHours: number;
  regularHours: number;
  overtimeHours: number;
  nightHours: number;
  paidLeaveDays: number;
  paidLeaveHours: number;
  monthlySalary: number | null;
  hourlyRate: number | null;
  overtimePay: number | null;
  nightPremium: number | null;
  totalPay: number | null;
  note: string;
}

/** 金額を日本円形式でフォーマット */
function formatCurrency(amount: number | null): string {
  if (amount == null) return '-';
  return `¥${amount.toLocaleString('ja-JP')}`;
}

/** 時間を小数1桁でフォーマット */
function formatHours(hours: number): string {
  return `${hours.toFixed(1)}h`;
}

/** ページコンポーネント */
export default function SalaryDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = use(params);
  const searchParams = useSearchParams();
  const router = useRouter();

  const yearParam = searchParams.get('year');
  const monthParam = searchParams.get('month');
  const currentDate = new Date();
  const year = yearParam ? parseInt(yearParam, 10) : currentDate.getFullYear();
  const month = monthParam ? parseInt(monthParam, 10) : currentDate.getMonth() + 1;

  const { startDate, endDate } = getMonthRange(year, month);

  /** ユーザー情報取得 */
  const { data: user, isLoading: userLoading } = useQuery<User>({
    queryKey: ['users', 'detail', userId],
    queryFn: async () => {
      const token = await getIdToken();
      const res = await fetch(`/api/users/${userId}`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (!res.ok) throw new Error('ユーザー情報の取得に失敗しました');
      const json = (await res.json()) as ApiSuccessResponse<User>;
      return json.data;
    },
  });

  /** 給与サマリ取得 */
  const { data: salary, isLoading: salaryLoading } = useQuery<SalaryMonthlyData>({
    queryKey: ['salary', 'monthly', userId, year, month],
    queryFn: async () => {
      const token = await getIdToken();
      const res = await fetch(
        `/api/salary/monthly?userId=${userId}&year=${year}&month=${month}`,
        {
          headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        }
      );
      if (!res.ok) throw new Error('給与計算の取得に失敗しました');
      const json = (await res.json()) as ApiSuccessResponse<SalaryMonthlyData>;
      return json.data;
    },
  });

  /** 当月の日報一覧取得 */
  const { data: reports, isLoading: reportsLoading } = useQuery<DailyReportWithUser[]>({
    queryKey: ['reports', 'list', { userId, startDate, endDate }],
    queryFn: async () => {
      const token = await getIdToken();
      const params = new URLSearchParams({
        userId,
        startDate,
        endDate,
      });
      const res = await fetch(`/api/reports?${params.toString()}`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (!res.ok) throw new Error('日報一覧の取得に失敗しました');
      const json = (await res.json()) as ApiSuccessResponse<DailyReportWithUser[]>;
      return json.data;
    },
  });

  const isLoading = userLoading || salaryLoading || reportsLoading;

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          ← 戻る
        </Button>
        <div>
          <h1 className="text-2xl font-bold">
            {userLoading ? '...' : (user?.displayName ?? '社員')} の勤怠詳細
          </h1>
          <p className="text-sm text-muted-foreground">
            {year}年{month}月（{startDate} 〜 {endDate}）
          </p>
        </div>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground py-8 text-center">読み込み中...</p>
      ) : (
        <>
          {/* 給与サマリカード */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Card>
              <CardHeader className="pb-1 pt-3 px-4">
                <CardTitle className="text-xs font-medium text-muted-foreground">勤務日数</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <p className="text-2xl font-bold">{salary?.workDays ?? 0}<span className="text-sm font-normal text-muted-foreground ml-1">日</span></p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1 pt-3 px-4">
                <CardTitle className="text-xs font-medium text-muted-foreground">総労働時間</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <p className="text-2xl font-bold">{salary ? formatHours(salary.totalHours) : '-'}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1 pt-3 px-4">
                <CardTitle className="text-xs font-medium text-muted-foreground">残業時間</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <p className={`text-2xl font-bold ${(salary?.overtimeHours ?? 0) > 0 ? 'text-orange-600' : ''}`}>
                  {salary ? formatHours(salary.overtimeHours) : '-'}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1 pt-3 px-4">
                <CardTitle className="text-xs font-medium text-muted-foreground">有給取得</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <p className="text-2xl font-bold text-green-600">
                  {salary?.paidLeaveDays ?? 0}
                  <span className="text-sm font-normal text-muted-foreground ml-1">日</span>
                </p>
              </CardContent>
            </Card>
          </div>

          {/* 給与計算サマリ */}
          {salary && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">給与計算サマリ（参考値）</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm sm:grid-cols-3">
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-muted-foreground">月給</span>
                    <span className="font-medium">{formatCurrency(salary.monthlySalary)}</span>
                  </div>
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-muted-foreground">時間単価</span>
                    <span className="font-medium">{formatCurrency(salary.hourlyRate)}</span>
                  </div>
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-muted-foreground">所定内時間</span>
                    <span className="font-medium">{formatHours(salary.regularHours)}</span>
                  </div>
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-muted-foreground">残業時間</span>
                    <span className={`font-medium ${salary.overtimeHours > 0 ? 'text-orange-600' : ''}`}>
                      {formatHours(salary.overtimeHours)}
                    </span>
                  </div>
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-muted-foreground">深夜時間</span>
                    <span className="font-medium">{formatHours(salary.nightHours)}</span>
                  </div>
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-muted-foreground">残業代</span>
                    <span className={`font-medium ${(salary.overtimePay ?? 0) > 0 ? 'text-orange-600' : ''}`}>
                      {formatCurrency(salary.overtimePay)}
                    </span>
                  </div>
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-muted-foreground">深夜割増</span>
                    <span className="font-medium">{formatCurrency(salary.nightPremium)}</span>
                  </div>
                  <div className="flex justify-between border-b pb-2 sm:col-span-2">
                    <span className="text-muted-foreground font-semibold">推定合計給与</span>
                    <span className="font-bold text-base">{formatCurrency(salary.totalPay)}</span>
                  </div>
                </div>
                {salary.monthlySalary == null && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    ※ 月給が未設定のため給与計算を表示できません。従業員管理から月給を設定してください。
                  </p>
                )}
                <p className="mt-2 text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded px-2 py-1">
                  {salary.note}
                </p>
              </CardContent>
            </Card>
          )}

          {/* 日報一覧 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">当月の日報一覧</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {!reports || reports.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  {year}年{month}月の日報はありません
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>日付</TableHead>
                      <TableHead className="text-center">所定内</TableHead>
                      <TableHead className="text-center">残業</TableHead>
                      <TableHead className="text-center">深夜</TableHead>
                      <TableHead>ステータス</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reports.map((report) => (
                      <TableRow key={report.id}>
                        <TableCell className="text-sm">
                          {formatDateToJapanese(report.reportDate)}
                        </TableCell>
                        <TableCell className="text-center text-sm">
                          {formatHours(report.totalRegularHours)}
                        </TableCell>
                        <TableCell className="text-center text-sm">
                          {report.totalOvertimeHours > 0 ? (
                            <Badge variant="secondary">
                              {formatHours(report.totalOvertimeHours)}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">{formatHours(report.totalOvertimeHours)}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center text-sm">
                          {formatHours(report.totalNightHours)}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={report.status} />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/reports/${report.id}`}>
                              詳細
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
