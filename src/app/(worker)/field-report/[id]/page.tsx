'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useRequireAuth } from '@/hooks/use-auth';
import { useFieldReport, useDeleteFieldReport } from '@/hooks/use-field-reports';
import { isSupervisor } from '@/types/user';
import {
  WEATHER,
  EXPENSE_CATEGORY,
  type Weather,
  type ExpenseCategory,
} from '@/types/field-report';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { FieldReportForm } from '@/components/features/field-report/field-report-form';
import {
  AlertCircle,
  Pencil,
  Trash2,
  CloudRain,
  Cloud,
  Sun,
  Snowflake,
  ArrowLeft,
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

/** 天候ラベルとアイコン */
const WEATHER_DISPLAY: Record<Weather, { label: string; icon: React.ReactNode }> = {
  [WEATHER.SUNNY]: { label: '晴れ', icon: <Sun className="h-4 w-4 text-yellow-500" /> },
  [WEATHER.CLOUDY]: { label: '曇り', icon: <Cloud className="h-4 w-4 text-gray-400" /> },
  [WEATHER.RAINY]: { label: '雨', icon: <CloudRain className="h-4 w-4 text-blue-400" /> },
  [WEATHER.SNOWY]: { label: '雪', icon: <Snowflake className="h-4 w-4 text-cyan-400" /> },
};

/** 経費科目ラベル */
const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  [EXPENSE_CATEGORY.MATERIAL]: '材料費',
  [EXPENSE_CATEGORY.LABOR]: '労務費',
  [EXPENSE_CATEGORY.SUBCONTRACT]: '外注費',
  [EXPENSE_CATEGORY.OTHER]: '経費',
};

interface PageProps {
  params: Promise<{ id: string }>;
}

/** 現場日報詳細・編集画面 */
export default function FieldReportDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const { role, uid, isLoading: authLoading } = useRequireAuth();
  const { data: report, isLoading, error } = useFieldReport(id);
  const deleteFieldReport = useDeleteFieldReport();
  const [isEditMode, setIsEditMode] = useState(false);

  if (authLoading || isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!role || !isSupervisor(role)) {
    return (
      <Card className="border-destructive">
        <CardContent className="flex items-center gap-3 py-6">
          <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
          <p className="text-sm text-destructive">
            現場日報はGロール（現場監督）専用の機能です。
          </p>
        </CardContent>
      </Card>
    );
  }

  if (error || !report) {
    return (
      <div className="space-y-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/field-report/history">
            <ArrowLeft className="h-4 w-4 mr-1" />
            一覧に戻る
          </Link>
        </Button>
        <Card className="border-destructive">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
            <p className="text-sm text-destructive">現場日報の取得に失敗しました</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isOwner = report.supervisorId === uid;
  const weather = WEATHER_DISPLAY[report.weather as Weather] ?? { label: report.weather, icon: null };

  async function handleDelete() {
    try {
      await deleteFieldReport.mutateAsync(id);
      toast.success('現場日報を削除しました');
      router.push('/field-report/history');
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : '削除に失敗しました'
      );
    }
  }

  if (isEditMode) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">現場日報を編集</h1>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsEditMode(false)}
          >
            キャンセル
          </Button>
        </div>
        <FieldReportForm defaultReport={report} reportId={id} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ナビゲーション */}
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/field-report/history">
          <ArrowLeft className="h-4 w-4 mr-1" />
          一覧に戻る
        </Link>
      </Button>

      {/* ヘッダー */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold">{report.siteName}</h1>
          <p className="text-sm text-muted-foreground mt-1">{report.reportDate}</p>
        </div>
        {isOwner && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="min-h-[40px]"
              onClick={() => setIsEditMode(true)}
            >
              <Pencil className="h-4 w-4 mr-1" />
              編集
            </Button>
            <Dialog>
              <DialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="min-h-[40px] text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent showCloseButton={false}>
                <DialogHeader>
                  <DialogTitle>現場日報を削除しますか？</DialogTitle>
                  <DialogDescription>
                    {report.reportDate}の{report.siteName}の日報を削除します。
                    この操作は元に戻せません。
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="outline">キャンセル</Button>
                  </DialogClose>
                  <Button
                    variant="destructive"
                    onClick={() => void handleDelete()}
                  >
                    削除する
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>

      {/* 基本情報 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">基本情報</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">天候</span>
            <span className="flex items-center gap-1 text-sm">
              {weather.icon}
              {weather.label}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">合計人数</span>
            <Badge variant="secondary">{report.totalWorkerCount} 名</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">協力会社数</span>
            <span className="text-sm">{report.subcontractorWorks.length} 社</span>
          </div>
        </CardContent>
      </Card>

      {/* 協力会社一覧 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">協力会社一覧</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left pb-2 font-medium text-muted-foreground">会社名</th>
                  <th className="text-right pb-2 font-medium text-muted-foreground">人数</th>
                  <th className="text-left pb-2 font-medium text-muted-foreground pl-3">作業内容</th>
                  <th className="text-left pb-2 font-medium text-muted-foreground pl-3">経費科目</th>
                </tr>
              </thead>
              <tbody>
                {report.subcontractorWorks.map((work, index) => (
                  <tr key={index} className="border-b last:border-0">
                    <td className="py-2 pr-2">{work.companyName}</td>
                    <td className="py-2 text-right">{work.workerCount} 名</td>
                    <td className="py-2 pl-3 text-muted-foreground">{work.workContent}</td>
                    <td className="py-2 pl-3 text-muted-foreground">
                      {EXPENSE_CATEGORY_LABELS[work.expenseCategory as ExpenseCategory] ?? work.expenseCategory}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* 資材搬入一覧 */}
      {report.materialDeliveries.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">資材搬入</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left pb-2 font-medium text-muted-foreground">材料名</th>
                    <th className="text-right pb-2 font-medium text-muted-foreground">数量</th>
                  </tr>
                </thead>
                <tbody>
                  {report.materialDeliveries.map((delivery, index) => (
                    <tr key={index} className="border-b last:border-0">
                      <td className="py-2 pr-2">{delivery.materialName}</td>
                      <td className="py-2 text-right">{delivery.quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 備考 */}
      {report.notes && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">備考</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{report.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
