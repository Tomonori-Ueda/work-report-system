'use client';

import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import {
  calculateWorkingHours,
  formatMinutesToDisplay,
} from '@/lib/utils/time-calc';

interface WorkHoursDisplayProps {
  startTime: string;
  endTime: string;
}

/** 労働時間のリアルタイム計算表示 */
export function WorkHoursDisplay({
  startTime,
  endTime,
}: WorkHoursDisplayProps) {
  const result = useMemo(() => {
    if (!startTime || !endTime) return null;

    // 時刻形式チェック
    const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
    if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) return null;
    if (startTime >= endTime) return null;

    try {
      return calculateWorkingHours({ startTime, endTime });
    } catch {
      return null;
    }
  }, [startTime, endTime]);

  if (!result) {
    return (
      <Card className="bg-muted/50">
        <CardContent className="py-3">
          <p className="text-sm text-muted-foreground text-center">
            開始・終了時刻を入力すると労働時間を計算します
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
      <CardContent className="py-3">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-xs text-muted-foreground">実労働時間</p>
            <p className="text-lg font-bold text-blue-700 dark:text-blue-300">
              {formatMinutesToDisplay(result.totalWorkMinutes)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">所定内</p>
            <p className="text-lg font-bold">
              {result.regularHours}h
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">残業</p>
            <p className={`text-lg font-bold ${result.overtimeHours > 0 ? 'text-orange-600 dark:text-orange-400' : ''}`}>
              {result.overtimeHours}h
            </p>
          </div>
        </div>
        {result.breakMinutes > 0 && (
          <p className="text-xs text-muted-foreground text-center mt-1">
            休憩: {result.breakMinutes}分
          </p>
        )}
      </CardContent>
    </Card>
  );
}
