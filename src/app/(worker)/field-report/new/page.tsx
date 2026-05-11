'use client';

import { useState } from 'react';
import { useRequireAuth } from '@/hooks/use-auth';
import { isSupervisor } from '@/types/user';
import { FieldReportForm } from '@/components/features/field-report/field-report-form';
import { FieldReportTableForm } from '@/components/features/field-report/field-report-table-form';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, Wand2, Table2, ListChecks } from 'lucide-react';
import Link from 'next/link';

type InputMode = 'form' | 'table';

/** 現場日報入力画面（Gロール専用） */
export default function NewFieldReportPage() {
  const { role, isLoading } = useRequireAuth();
  const [mode, setMode] = useState<InputMode>('table');

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
    <div
      className={
        mode === 'table'
          ? 'relative left-1/2 w-[calc(100vw-2rem)] max-w-[1180px] -translate-x-1/2 space-y-4'
          : 'space-y-4'
      }
    >
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-xl font-bold">現場日報入力</h1>
        <div className="flex items-center gap-2">
          {/* 入力モード切替 */}
          <div className="inline-flex rounded-md border border-border overflow-hidden">
            <button
              onClick={() => setMode('table')}
              className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium transition-colors ${
                mode === 'table'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-background text-muted-foreground hover:bg-muted'
              }`}
            >
              <Table2 className="h-3.5 w-3.5" />
              一括入力
            </button>
            <button
              onClick={() => setMode('form')}
              className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium transition-colors ${
                mode === 'form'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-background text-muted-foreground hover:bg-muted'
              }`}
            >
              <ListChecks className="h-3.5 w-3.5" />
              通常フォーム
            </button>
          </div>
          <Button asChild variant="outline" size="sm" className="min-h-[40px]">
            <Link href="/field-report/wizard">
              <Wand2 className="h-4 w-4 mr-1" />
              ウィザード
            </Link>
          </Button>
        </div>
      </div>

      {mode === 'table' ? (
        <FieldReportTableForm />
      ) : (
        <FieldReportForm />
      )}
    </div>
  );
}
