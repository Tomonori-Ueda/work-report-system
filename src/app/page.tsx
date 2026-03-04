'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';

/** ルートページ: 認証状態に応じてリダイレクト */
export default function HomePage() {
  const { uid, role, isLoading } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    if (!uid) {
      router.replace('/login');
      return;
    }

    if (role === 'admin') {
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
