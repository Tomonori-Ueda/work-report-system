'use client';

import { useRouter } from 'next/navigation';
import { signOut } from '@/lib/firebase/auth';
import { useAuthStore } from '@/stores/auth-store';
import { Button } from '@/components/ui/button';

/** 作業員用ヘッダー */
export function WorkerHeader() {
  const { displayName } = useAuthStore();
  const router = useRouter();

  async function handleLogout() {
    await signOut();
    router.replace('/login');
  }

  return (
    <header className="sticky top-0 z-40 border-b bg-white">
      <div className="container mx-auto flex h-14 max-w-lg items-center justify-between px-4">
        <h1 className="text-lg font-bold text-primary">作業日報</h1>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {displayName ?? 'ユーザー'}
          </span>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            ログアウト
          </Button>
        </div>
      </div>
    </header>
  );
}
