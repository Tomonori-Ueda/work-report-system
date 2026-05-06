'use client';

import { useRequireAuth } from '@/hooks/use-auth';
import { isSupervisor } from '@/types/user';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { FieldReportWizard } from '@/components/features/field-report/field-report-wizard';

/** 現場日報の対話型ウィザード入力ページ */
export default function FieldReportWizardPage() {
  const { role, isLoading } = useRequireAuth();

  if (isLoading) {
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
            現場日報はGロール（現場監督）専用の機能です。
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">現場日報（ウィザードモード）</h1>
        <Button asChild variant="ghost" size="sm">
          <Link href="/field-report/new">
            <ArrowLeft className="h-4 w-4 mr-1" />
            通常モードに戻す
          </Link>
        </Button>
      </div>
      <FieldReportWizard />
    </div>
  );
}
