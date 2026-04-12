'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/** マスター管理カードの定義 */
interface MasterCardItem {
  title: string;
  description: string;
  href: string;
  icon: string;
}

const MASTER_CARDS: MasterCardItem[] = [
  {
    title: '現場マスター管理',
    description: '現場コード・現場名・担当監督を管理します',
    href: '/masters/sites',
    icon: '🏗️',
  },
  {
    title: '協力会社マスター管理',
    description: '協力会社・担当者・単価情報を管理します',
    href: '/masters/subcontractors',
    icon: '🏢',
  },
  {
    title: '作業内容マスター管理',
    description: '作業種別・カテゴリ・表示順を管理します',
    href: '/masters/work-types',
    icon: '📝',
  },
  {
    title: '社員管理',
    description: '社員情報・権限ランク・給与情報を管理します',
    href: '/employees',
    icon: '👥',
  },
];

/** マスター管理トップページ */
export default function MastersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">マスター管理</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          各種マスターデータを管理します
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-2">
        {MASTER_CARDS.map((card) => (
          <Link key={card.href} href={card.href}>
            <Card className="h-full transition-colors hover:bg-muted/50 cursor-pointer">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-lg">
                  <span className="text-2xl">{card.icon}</span>
                  {card.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{card.description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
