'use client';

import { type ReactNode } from 'react';
import { useRequireAuth } from '@/hooks/use-auth';
import { WorkerHeader } from '@/components/features/layout/worker-header';
import { WorkerNav } from '@/components/features/layout/worker-nav';

/** 作業員レイアウト: ヘッダー + メインコンテンツ + ボトムナビ */
export default function WorkerLayout({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated } = useRequireAuth();

  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      <WorkerHeader />
      <main className="flex-1 pb-20 pt-4">
        <div className="container mx-auto max-w-lg px-4">{children}</div>
      </main>
      <WorkerNav />
    </div>
  );
}
