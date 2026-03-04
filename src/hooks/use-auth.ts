'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';
import type { UserRole } from '@/types/user';

/**
 * 認証状態を確認し、未認証ならリダイレクトするhook
 */
export function useRequireAuth(requiredRole?: UserRole) {
  const { uid, role, isLoading } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    if (!uid) {
      router.replace('/login');
      return;
    }

    if (requiredRole && role !== requiredRole) {
      // ロール不一致の場合は適切な画面にリダイレクト
      if (role === 'admin') {
        router.replace('/dashboard');
      } else {
        router.replace('/report/new');
      }
    }
  }, [uid, role, isLoading, requiredRole, router]);

  return { uid, role, isLoading, isAuthenticated: !!uid };
}
