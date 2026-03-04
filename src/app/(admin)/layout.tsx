'use client';

import { type ReactNode } from 'react';
import { useRequireAuth } from '@/hooks/use-auth';
import { AdminSidebar } from '@/components/features/layout/admin-sidebar';

/** 管理者レイアウト: サイドバー + メインコンテンツ */
export default function AdminLayout({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated, role } = useRequireAuth('admin');

  if (isLoading || !isAuthenticated || role !== 'admin') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <AdminSidebar />
      <main className="flex-1 bg-muted/30 p-6 md:ml-64">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
