'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useLeaveBalance } from '@/hooks/use-leave';

interface LeaveBalanceCardProps {
  userId: string;
}

/** 有給残日数カード */
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

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          有給休暇残日数
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold text-center">
          {data?.balance ?? 0}
          <span className="text-base font-normal text-muted-foreground ml-1">
            日
          </span>
        </p>
      </CardContent>
    </Card>
  );
}
