'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { signOut } from '@/lib/firebase/auth';
import { useAuthStore } from '@/stores/auth-store';
import { useUiStore } from '@/stores/ui-store';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'ダッシュボード', icon: '📊' },
  { href: '/reports', label: '日報管理', icon: '📋' },
  { href: '/employees', label: '従業員管理', icon: '👥' },
] as const;

/** サイドバーのナビ内容 */
function SidebarContent() {
  const pathname = usePathname();
  const { displayName } = useAuthStore();
  const router = useRouter();

  async function handleLogout() {
    await signOut();
    router.replace('/login');
  }

  return (
    <div className="flex h-full flex-col">
      <div className="p-6">
        <h1 className="text-xl font-bold text-primary">作業日報管理</h1>
        <p className="mt-1 text-xs text-muted-foreground">管理者画面</p>
      </div>

      <Separator />

      <nav className="flex-1 space-y-1 p-4">
        {NAV_ITEMS.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <Separator />

      <div className="p-4">
        <p className="mb-2 text-sm text-muted-foreground">
          {displayName ?? 'ユーザー'}
        </p>
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={handleLogout}
        >
          ログアウト
        </Button>
      </div>
    </div>
  );
}

/** 管理者サイドバー: デスクトップは固定、モバイルはSheet */
export function AdminSidebar() {
  const { isSidebarOpen, toggleSidebar, closeSidebar } = useUiStore();

  return (
    <>
      {/* デスクトップ: 固定サイドバー */}
      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-64 border-r bg-white md:block">
        <SidebarContent />
      </aside>

      {/* モバイル: ハンバーガーメニュー */}
      <div className="fixed left-0 top-0 z-50 md:hidden">
        <Sheet open={isSidebarOpen} onOpenChange={toggleSidebar}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="m-2"
              aria-label="メニューを開く"
            >
              <span className="text-xl">☰</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <div onClick={closeSidebar}>
              <SidebarContent />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
