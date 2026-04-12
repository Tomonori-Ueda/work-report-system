'use client';

import { Card, CardContent } from '@/components/ui/card';
import {
  calculateTotalHours,
  formatMinutesToDisplay,
  timeToMinutes,
} from '@/lib/utils/time-calc';
import type { TimeBlock } from '@/types/report';

interface WorkHoursDisplayProps {
  /** 複数時間ブロック（timeBlocksベース） */
  timeBlocks?: Pick<TimeBlock, 'startTime' | 'endTime'>[];
  /** 後方互換: 単一ブロックの開始時刻 */
  startTime?: string;
  /** 後方互換: 単一ブロックの終了時刻 */
  endTime?: string;
}

/** 労働時間のリアルタイム計算表示（複数ブロック対応） */
export function WorkHoursDisplay({
  timeBlocks,
  startTime,
  endTime,
}: WorkHoursDisplayProps) {
  // timeBlocks が渡されていれば優先。なければ後方互換で単一ブロックとして扱う
  const blocks: Pick<TimeBlock, 'startTime' | 'endTime'>[] = (() => {
    if (timeBlocks && timeBlocks.length > 0) {
      return timeBlocks;
    }
    if (startTime && endTime) {
      return [{ startTime, endTime }];
    }
    return [];
  })();

  const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
  const validBlocks = blocks.filter(
    (b) =>
      b.startTime &&
      b.endTime &&
      timeRegex.test(b.startTime) &&
      timeRegex.test(b.endTime) &&
      b.startTime < b.endTime
  );

  if (validBlocks.length === 0) {
    return (
      <Card className="bg-muted/50">
        <CardContent className="py-3">
          <p className="text-sm text-muted-foreground text-center">
            時間ブロックを入力すると労働時間を計算します
          </p>
        </CardContent>
      </Card>
    );
  }

  const totals = calculateTotalHours(validBlocks);
  const totalWorkMinutes = validBlocks.reduce(
    (acc, b) => acc + (timeToMinutes(b.endTime) - timeToMinutes(b.startTime)),
    0
  );

  return (
    <Card className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
      <CardContent className="py-3">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-xs text-muted-foreground">実労働時間</p>
            <p className="text-lg font-bold text-blue-700 dark:text-blue-300">
              {formatMinutesToDisplay(totalWorkMinutes)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">所定内</p>
            <p className="text-lg font-bold">{totals.totalRegularHours}h</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">残業</p>
            <p
              className={`text-lg font-bold ${totals.totalOvertimeHours > 0 ? 'text-orange-600 dark:text-orange-400' : ''}`}
            >
              {totals.totalOvertimeHours}h
            </p>
          </div>
        </div>
        {totals.totalNightHours > 0 && (
          <p className="text-xs text-muted-foreground text-center mt-1">
            深夜割増: {totals.totalNightHours}h
          </p>
        )}
      </CardContent>
    </Card>
  );
}
