'use client';

import { useRequireAuth } from '@/hooks/use-auth';
import { isSupervisor } from '@/types/user';
import { FieldReportForm } from '@/components/features/field-report/field-report-form';
import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';

/** 現場日報入力画面（Gロール専用） */
export default function NewFieldReportPage() {
  const { role, isLoading } = useRequireAuth();

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  // Gロール以外はアクセス不可
  if (!role || !isSupervisor(role)) {
    return (
      <Card className="border-destructive">
        <CardContent className="flex items-center gap-3 py-6">
          <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
          <p className="text-sm text-destructive">
            現場日報入力はGロール（現場監督）専用の機能です。
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">現場日報入力</h1>
      <FieldReportForm />
    </div>
  );
}
