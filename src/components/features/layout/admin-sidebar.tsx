'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { signOut } from '@/lib/firebase/auth';
import { useAuthStore } from '@/stores/auth-store';
import { useUiStore } from '@/stores/ui-store';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { USER_ROLE, type UserRole } from '@/types/user';

/** ナビゲーションアイテム定義 */
interface NavItem {
  href: string;
  label: string;
  icon: string;
  /** このメニューを表示できるロール。undefinedの場合は全管理者ロールに表示 */
  allowedRoles?: UserRole[];
}

const NAV_ITEMS: NavItem[] = [
  {
    href: '/dashboard',
    label: 'ダッシュボード',
    icon: '📊',
    // S/A/A_special/B 全員
  },
  {
    href: '/reports',
    label: '日報管理',
    icon: '📋',
    // S/A/A_special/B 全員
  },
  {
    href: '/reports/mismatch',
    label: '照合チェック',
    icon: '⚠️',
    // S/A/A_special/B 全員
  },
  {
    href: '/salary',
    label: '勤怠集計・給与',
    icon: '💴',
    // S/A/A_special/B 全員
  },
  {
    href: '/leaves',
    label: '休暇管理',
    icon: '🏖',
    // S/A/A_special のみ
    allowedRoles: [USER_ROLE.S, USER_ROLE.A, USER_ROLE.A_SPECIAL],
  },
  {
    href: '/masters',
    label: 'マスター管理',
    icon: '🗄️',
    // S/A/A_special のみ
    allowedRoles: [USER_ROLE.S, USER_ROLE.A, USER_ROLE.A_SPECIAL],
  },
  {
    href: '/employees',
    label: '従業員管理',
    icon: '👥',
    // S/A/A_special のみ（マスター管理系）
    allowedRoles: [USER_ROLE.S, USER_ROLE.A, USER_ROLE.A_SPECIAL],
  },
  {
    href: '/leave-calendar',
    label: '有給カレンダー',
    icon: '📅',
    // S/A/A_special のみ
    allowedRoles: [USER_ROLE.S, USER_ROLE.A, USER_ROLE.A_SPECIAL],
  },
];

/** ロール表示名マップ */
const ROLE_LABEL: Record<UserRole, string> = {
  [USER_ROLE.S]: '社長',
  [USER_ROLE.A]: '専務・常務',
  [USER_ROLE.A_SPECIAL]: '総務部長',
  [USER_ROLE.B]: '施工部長',
  [USER_ROLE.G]: '現場監督',
  [USER_ROLE.GENERAL]: '一般',
};

/** ロールバッジのカラーマップ */
function getRoleBadgeClass(role: UserRole): string {
  switch (role) {
    case USER_ROLE.S:
      return 'bg-red-100 text-red-700 border-red-200';
    case USER_ROLE.A:
      return 'bg-orange-100 text-orange-700 border-orange-200';
    case USER_ROLE.A_SPECIAL:
      return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    case USER_ROLE.B:
      return 'bg-purple-100 text-purple-700 border-purple-200';
    case USER_ROLE.G:
      return 'bg-blue-100 text-blue-700 border-blue-200';
    default:
      return 'bg-gray-100 text-gray-700 border-gray-200';
  }
}

/** サイドバーのナビ内容 */
function SidebarContent() {
  const pathname = usePathname();
  const { displayName, role } = useAuthStore();
  const router = useRouter();

  async function handleLogout() {
    await signOut();
    await fetch('/api/auth/session', { method: 'DELETE' });
    router.replace('/login');
  }

  // ロールに応じてメニューをフィルタ
  const visibleNavItems = NAV_ITEMS.filter((item) => {
    if (!item.allowedRoles) return true;
    if (!role) return false;
    return item.allowedRoles.includes(role);
  });

  return (
    <div className="flex h-full flex-col">
      <div className="p-6">
        <h1 className="text-xl font-bold text-primary">作業日報管理</h1>
        <p className="mt-1 text-xs text-muted-foreground">管理者画面</p>
      </div>

      <Separator />

      <nav className="flex-1 space-y-1 p-4">
        {visibleNavItems.map((item) => {
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

      {/* ユーザー情報 + ロールバッジ */}
      <div className="p-4 space-y-3">
        <div className="space-y-1">
          <p className="text-sm font-medium truncate">
            {displayName ?? 'ユーザー'}
          </p>
          {role && (
            <Badge
              variant="outline"
              className={cn('text-xs', getRoleBadgeClass(role))}
            >
              {ROLE_LABEL[role]}
            </Badge>
          )}
        </div>
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
