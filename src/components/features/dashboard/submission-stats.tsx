'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { DashboardStatusResponse } from '@/types/api';

interface SubmissionStatsProps {
  data: DashboardStatusResponse;
}

/** 提出状況サマリカード */
export function SubmissionStats({ data }: SubmissionStatsProps) {
  const submissionRate =
    data.totalWorkers > 0
      ? Math.round((data.submittedCount / data.totalWorkers) * 100)
      : 0;

  return (
    <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            従業員数
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">{data.totalWorkers}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            提出済
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold text-blue-600">
            {data.submittedCount}
          </p>
          <p className="text-xs text-muted-foreground">
            提出率: {submissionRate}%
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            未提出
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold text-orange-600">
            {data.notSubmittedCount}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            承認済
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold text-green-600">
            {data.approvedCount}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
