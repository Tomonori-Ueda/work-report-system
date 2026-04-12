'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';
import { isSupervisor } from '@/types/user';

/** 一般作業員用ナビアイテム */
const GENERAL_NAV_ITEMS = [
  { href: '/report/new', label: '日報入力', icon: '📝' },
  { href: '/report/history', label: '履歴', icon: '📋' },
  { href: '/leave', label: '有給申請', icon: '🏖️' },
] as const;

/** Gロール（現場監督）用ナビアイテム */
const SUPERVISOR_NAV_ITEMS = [
  { href: '/field-report/new', label: '日報入力', icon: '🏗️' },
  { href: '/field-report/history', label: '日報一覧', icon: '📋' },
  { href: '/field-report/mismatch', label: '照合', icon: '⚠️' },
  { href: '/leave', label: '有給申請', icon: '🏖️' },
] as const;

/** 作業員用ボトムナビゲーション */
export function WorkerNav() {
  const pathname = usePathname();
  const { role } = useAuthStore();

  // Gロールは現場日報ナビ、それ以外は一般作業員ナビ
  const navItems =
    role && isSupervisor(role) ? SUPERVISOR_NAV_ITEMS : GENERAL_NAV_ITEMS;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-white">
      <div className="container mx-auto flex max-w-lg">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-1 flex-col items-center gap-1 py-2 text-xs transition-colors',
                isActive
                  ? 'text-primary font-medium'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <span className="text-lg">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
