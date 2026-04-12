'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle } from 'lucide-react';
import { useLeaveBalance } from '@/hooks/use-leave';
import { formatDateToJapanese } from '@/lib/utils/date';

interface LeaveBalanceCardProps {
  userId: string;
}

/** 有給残日数カード（期限切れ警告・60日上限表示対応） */
export function LeaveBalanceCard({ userId }: LeaveBalanceCardProps) {
  const { data, isLoading } = useLeaveBalance(userId);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-6">
          <p className="text-center text-muted-foreground">読み込み中...</p>
        </CardContent>
      </Card>
    );
  }

  const balance = data?.balance ?? 0;
  // 1日 = 8時間換算
  const balanceHours = balance * 8;
  const maxDays = data?.maxDays ?? 60;
  const expiringGrants = data?.expiringGrants ?? [];
  // 上限に近い場合（残り5日以内）は警告
  const isNearMax = balance >= maxDays - 5;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          有給休暇残日数
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* 残日数メイン表示 */}
        <div className="text-center">
          <p className="text-3xl font-bold">
            {balance}
            <span className="text-base font-normal text-muted-foreground ml-1">
              日
            </span>
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            ({balanceHours}時間相当)
          </p>
          {/* 上限60日に近い場合の注意表示 */}
          {isNearMax && (
            <Badge
              variant="outline"
              className="mt-2 border-amber-400 text-amber-700 bg-amber-50"
            >
              上限 {maxDays}日 に近づいています
            </Badge>
          )}
        </div>

        {/* 期限切れ間近の付与分警告（30日以内） */}
        {expiringGrants.length > 0 && (
          <div className="rounded-md border border-yellow-300 bg-yellow-50 px-3 py-2 text-sm space-y-1">
            <div className="flex items-center gap-1.5 text-yellow-800 font-medium">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>有効期限切れ間近</span>
            </div>
            {expiringGrants.map((grant) => (
              <div
                key={grant.grantDate}
                className="flex justify-between items-center text-yellow-700 text-xs"
              >
                <span>
                  {formatDateToJapanese(grant.grantDate)} 付与分
                  （{grant.grantDays}日）
                </span>
                <span className="font-medium">
                  期限: {formatDateToJapanese(grant.expiryDate)}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* 次回付与情報（hireDate がある場合のみ） */}
        {data?.nextGrantInfo != null && (
          <div className="rounded-md border bg-muted/30 px-4 py-3 text-sm space-y-1">
            <p className="font-medium text-muted-foreground">次回付与予定</p>
            <div className="flex justify-between items-center">
              <span className="text-foreground">
                {formatDateToJapanese(data.nextGrantInfo.nextGrantDate)}
              </span>
              <span className="font-semibold text-primary">
                +{data.nextGrantInfo.nextGrantDays}日
              </span>
            </div>
          </div>
        )}

        {/* 法定上限の注記 */}
        <p className="text-xs text-muted-foreground text-center">
          法定上限: {maxDays}日 / 有効期限: 付与日から2年間
        </p>
      </CardContent>
    </Card>
  );
}
