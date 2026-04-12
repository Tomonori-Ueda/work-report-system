'use client';

import { useState, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getIdToken } from '@/lib/firebase/auth';
import type { ApiSuccessResponse } from '@/types/api';
import type { User } from '@/types/user';

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

/** 社員行データ（ユーザー情報 + 給与計算結果） */
interface EmployeeSalaryRow {
  user: User;
  salary: SalaryMonthlyData | null;
  isLoading: boolean;
  error: string | null;
}

/** 現在の年のリストを生成（過去3年分） */
function generateYearOptions(): number[] {
  const currentYear = new Date().getFullYear();
  return [currentYear - 2, currentYear - 1, currentYear];
}

/** 月のリスト */
const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => i + 1);

/** 金額を日本円形式でフォーマット */
function formatCurrency(amount: number | null): string {
  if (amount === null) return '-';
  return `¥${amount.toLocaleString('ja-JP')}`;
}

/** 時間を小数2桁でフォーマット */
function formatHours(hours: number): string {
  return `${hours.toFixed(1)}h`;
}

/** 給与計算テーブルの行コンポーネント */
function SalaryTableRow({
  user,
  year,
  month,
}: {
  user: User;
  year: number;
  month: number;
}) {
  const { data, isLoading, error } = useQuery<SalaryMonthlyData>({
    queryKey: ['salary', 'monthly', user.id, year, month],
    queryFn: async () => {
      const token = await getIdToken();
      const res = await fetch(
        `/api/salary/monthly?userId=${user.id}&year=${year}&month=${month}`,
        {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        }
      );
      if (!res.ok) throw new Error('給与計算の取得に失敗しました');
      const json = (await res.json()) as ApiSuccessResponse<SalaryMonthlyData>;
      return json.data;
    },
    staleTime: 5 * 60 * 1000, // 5分キャッシュ
  });

  if (isLoading) {
    return (
      <TableRow>
        <TableCell>{user.displayName}</TableCell>
        <TableCell colSpan={7} className="text-center text-muted-foreground text-sm">
          読み込み中...
        </TableCell>
      </TableRow>
    );
  }

  if (error || !data) {
    return (
      <TableRow>
        <TableCell>{user.displayName}</TableCell>
        <TableCell colSpan={7} className="text-center text-destructive text-sm">
          取得エラー
        </TableCell>
      </TableRow>
    );
  }

  return (
    <TableRow>
      <TableCell className="font-medium">{user.displayName}</TableCell>
      <TableCell className="text-center">{data.workDays}日</TableCell>
      <TableCell className="text-center">{formatHours(data.totalHours)}</TableCell>
      <TableCell className="text-center">
        {data.overtimeHours > 0 ? (
          <Badge variant="secondary">{formatHours(data.overtimeHours)}</Badge>
        ) : (
          formatHours(data.overtimeHours)
        )}
      </TableCell>
      <TableCell className="text-center">{formatHours(data.nightHours)}</TableCell>
      <TableCell className="text-center">
        {data.paidLeaveDays > 0 ? (
          <Badge variant="outline" className="border-green-400 text-green-700 bg-green-50">
            {data.paidLeaveDays}日
          </Badge>
        ) : (
          <span className="text-muted-foreground text-sm">-</span>
        )}
      </TableCell>
      <TableCell className="text-right font-medium">
        {data.overtimePay !== null ? (
          <span className={data.overtimePay > 0 ? 'text-orange-600' : ''}>
            {formatCurrency(data.overtimePay)}
          </span>
        ) : (
          <span className="text-muted-foreground text-xs">月給未設定</span>
        )}
      </TableCell>
      <TableCell className="text-center">
        <Button variant="ghost" size="sm" asChild>
          <a
            href={`/salary/${user.id}?year=${year}&month=${month}`}
            className="text-primary hover:underline"
          >
            詳細
          </a>
        </Button>
      </TableCell>
    </TableRow>
  );
}

/** S0XX: 勤怠集計・給与計算（参考値）画面 */
export default function SalaryPage() {
  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState<number>(currentDate.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(currentDate.getMonth() + 1);

  const { data: users, isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: async () => {
      const token = await getIdToken();
      const res = await fetch('/api/users', {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) throw new Error('ユーザー一覧の取得に失敗しました');
      const json = (await res.json()) as ApiSuccessResponse<User[]>;
      return json.data;
    },
  });

  const activeUsers = useMemo(() => users?.filter((u) => u.isActive) ?? [], [users]);

  /** CSVエクスポート（クライアントサイド） */
  const handleExportCsv = useCallback(async () => {
    if (!activeUsers.length) return;

    // 各ユーザーの給与データを取得
    const token = await getIdToken();
    const results: EmployeeSalaryRow[] = await Promise.all(
      activeUsers.map(async (user) => {
        try {
          const res = await fetch(
            `/api/salary/monthly?userId=${user.id}&year=${selectedYear}&month=${selectedMonth}`,
            {
              headers: {
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
              },
            }
          );
          if (!res.ok) throw new Error('取得エラー');
          const json = (await res.json()) as ApiSuccessResponse<SalaryMonthlyData>;
          return { user, salary: json.data, isLoading: false, error: null };
        } catch {
          return { user, salary: null, isLoading: false, error: '取得エラー' };
        }
      })
    );

    // CSVヘッダ
    const headers = [
      '氏名',
      '勤務日数',
      '総時間',
      '残業時間',
      '夜間時間',
      '有給取得日数',
      '有給取得時間',
      '月給',
      '時間単価',
      '推定残業代',
      '夜間割増',
      '推定合計給与',
    ];

    const rows = results.map(({ user, salary }) => [
      user.displayName,
      salary ? String(salary.workDays) : '-',
      salary ? `${salary.totalHours.toFixed(1)}` : '-',
      salary ? `${salary.overtimeHours.toFixed(1)}` : '-',
      salary ? `${salary.nightHours.toFixed(1)}` : '-',
      salary ? String(salary.paidLeaveDays) : '-',
      salary ? `${salary.paidLeaveHours.toFixed(1)}` : '-',
      salary?.monthlySalary !== null && salary?.monthlySalary !== undefined
        ? String(salary.monthlySalary)
        : '-',
      salary?.hourlyRate !== null && salary?.hourlyRate !== undefined
        ? String(salary.hourlyRate)
        : '-',
      salary?.overtimePay !== null && salary?.overtimePay !== undefined
        ? String(salary.overtimePay)
        : '-',
      salary?.nightPremium !== null && salary?.nightPremium !== undefined
        ? String(salary.nightPremium)
        : '-',
      salary?.totalPay !== null && salary?.totalPay !== undefined
        ? String(salary.totalPay)
        : '-',
    ]);

    const csvContent =
      '\uFEFF' + // BOM (Excelで文字化けしないため)
      [headers, ...rows]
        .map((row) => row.map((cell) => `"${cell}"`).join(','))
        .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `勤怠集計_${selectedYear}年${selectedMonth}月.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [activeUsers, selectedYear, selectedMonth]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">勤怠集計・給与計算（参考値）</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            承認済み・施工部長チェック済み・現場監督確認済みの日報を集計します
          </p>
        </div>
        <Button onClick={handleExportCsv} disabled={usersLoading || activeUsers.length === 0}>
          CSVエクスポート
        </Button>
      </div>

      {/* 月選択 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">集計月を選択</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 items-center">
            <Select
              value={String(selectedYear)}
              onValueChange={(val) => setSelectedYear(parseInt(val, 10))}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {generateYearOptions().map((year) => (
                  <SelectItem key={year} value={String(year)}>
                    {year}年
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={String(selectedMonth)}
              onValueChange={(val) => setSelectedMonth(parseInt(val, 10))}
            >
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTH_OPTIONS.map((month) => (
                  <SelectItem key={month} value={String(month)}>
                    {month}月
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <span className="text-sm text-muted-foreground">
              {selectedYear}年{selectedMonth}月 の勤怠データ
            </span>
          </div>
        </CardContent>
      </Card>

      {/* 参考値注記 */}
      <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
        <span className="font-semibold">注意: </span>
        これは参考値です。給与計算の最終確定は総務部長が実施します。
        月給が未設定の社員は推定給与が表示されません。
      </div>

      {/* 社員別サマリテーブル */}
      {usersLoading ? (
        <p className="text-muted-foreground text-center py-8">読み込み中...</p>
      ) : activeUsers.length > 0 ? (
        <div className="rounded-lg border bg-white overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>氏名</TableHead>
                <TableHead className="text-center">勤務日数</TableHead>
                <TableHead className="text-center">総時間</TableHead>
                <TableHead className="text-center">残業時間</TableHead>
                <TableHead className="text-center">夜間時間</TableHead>
                <TableHead className="text-center">有給取得</TableHead>
                <TableHead className="text-right">推定残業代</TableHead>
                <TableHead className="text-center">詳細</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activeUsers.map((user) => (
                <SalaryTableRow
                  key={user.id}
                  user={user}
                  year={selectedYear}
                  month={selectedMonth}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <p className="text-center py-8 text-muted-foreground">
          有効な従業員データがありません
        </p>
      )}
    </div>
  );
}
