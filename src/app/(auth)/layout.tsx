import type { ReactNode } from 'react';

/** 認証ページレイアウト: 中央寄せ */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/50 p-4">
      {children}
    </div>
  );
}
