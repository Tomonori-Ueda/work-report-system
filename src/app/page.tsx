'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { isAdminRole } from '@/types/user';

/** ルートページ: 認証状態に応じてリダイレクト */
export default function HomePage() {
  const { uid, role, isLoading } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    if (!uid) {
      // 古いセッションCookieが残っている場合に備えて削除してからリダイレクト
      void fetch('/api/auth/session', { method: 'DELETE' }).finally(() => {
        router.replace('/login');
      });
      return;
    }

    if (role && isAdminRole(role)) {
      router.replace('/dashboard');
    } else {
      router.replace('/report/new');
    }
  }, [uid, role, isLoading, router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );
}
