'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthChange } from '@/lib/firebase/auth';
import { useAuthStore } from '@/stores/auth-store';
import type { UserRole } from '@/types/user';

/** Firebase認証状態を監視し、Zustandストアに同期するプロバイダー */
export function AuthProvider({ children }: { children: ReactNode }) {
  const { setAuth, clearAuth, setLoading } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    setLoading(true);

    const unsubscribe = onAuthChange(async (firebaseUser) => {
      if (firebaseUser) {
        // カスタムクレームからロールを取得
        const tokenResult = await firebaseUser.getIdTokenResult();
        const role = (tokenResult.claims['role'] as UserRole) ?? null;

        setAuth({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          role,
        });
      } else {
        clearAuth();
      }
    });

    return () => unsubscribe();
  }, [setAuth, clearAuth, setLoading, router]);

  return <>{children}</>;
}
