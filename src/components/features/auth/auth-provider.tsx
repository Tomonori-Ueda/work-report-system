'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { onAuthChange } from '@/lib/firebase/auth';
import { getFirebaseDb } from '@/lib/firebase/config';
import { useAuthStore } from '@/stores/auth-store';
import type { UserRole, ExecutiveTitle } from '@/types/user';

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

        // 4枠承認 slot の判定に使う executiveTitle を Firestore から取得
        let executiveTitle: ExecutiveTitle | null = null;
        try {
          const db = getFirebaseDb();
          const snap = await getDoc(doc(db, 'users', firebaseUser.uid));
          executiveTitle =
            (snap.data()?.executiveTitle as ExecutiveTitle | null) ?? null;
        } catch {
          // 取得失敗時は null のまま（4枠承認に参加しない扱い）
        }

        setAuth({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          role,
          executiveTitle,
        });
      } else {
        clearAuth();
      }
      // 認証状態の確定後にローディングを解除
      setLoading(false);
    });

    return () => unsubscribe();
  }, [setAuth, clearAuth, setLoading, router]);

  return <>{children}</>;
}
