'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useRequireAuth } from '@/hooks/use-auth';
import { useFieldReport, useDeleteFieldReport } from '@/hooks/use-field-reports';
import { getIdToken } from '@/lib/firebase/auth';
import { isSupervisor } from '@/types/user';
import {
  WEATHER,
  EXPENSE_CATEGORY,
  CARRY_OUT_CATEGORY,
  MACHINE_OWNERSHIP,
  TRADE_TYPES,
  TRADE_LABELS,
  type Weather,
  type ExpenseCategory,
  type CarryOutCategory,
  type MachineOwnership,
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
  Download,
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

/** 持ち出し品の取扱区分ラベル */
const CARRY_OUT_LABELS: Record<CarryOutCategory, string> = {
  [CARRY_OUT_CATEGORY.BORROW]: '借入',
  [CARRY_OUT_CATEGORY.RETURN]: '返却',
  [CARRY_OUT_CATEGORY.CONSUME]: '消却',
};

/** 機器の所有区分ラベル */
const OWNERSHIP_LABELS: Record<MachineOwnership, string> = {
  [MACHINE_OWNERSHIP.OWN]: '自社',
  [MACHINE_OWNERSHIP.LEASE]: 'リース',
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

  /**
   * 様式7.5-9-02 の Excel をダウンロードする。
   * Authorization ヘッダで IDトークンを渡し、レスポンス Blob から仮想リンクで保存する。
   */
  async function handleDownloadExcel() {
    try {
      const token = await getIdToken();
      const res = await fetch(`/api/field-reports/${id}/excel`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!res.ok) throw new Error('Excel生成に失敗しました');

      const blob = await res.blob();
      // ファイル名を Content-Disposition から取り出す（filename*=UTF-8''…）
      const dispo = res.headers.get('Content-Disposition') ?? '';
      const m = dispo.match(/filename\*=UTF-8''([^;]+)/);
      const fileName = m?.[1]
        ? decodeURIComponent(m[1])
        : `打合せ指示書_${report?.reportDate ?? ''}.xlsx`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'ダウンロードに失敗しました');
    }
  }

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
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="min-h-[40px]"
            onClick={() => void handleDownloadExcel()}
          >
            <Download className="h-4 w-4 mr-1" />
            様式7.5-9-02
          </Button>
          {isOwner && (
            <Button
              variant="outline"
              size="sm"
              className="min-h-[40px]"
              onClick={() => setIsEditMode(true)}
            >
              <Pencil className="h-4 w-4 mr-1" />
              編集
            </Button>
          )}
          {isOwner && (
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
          )}
        </div>
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

      {/* === Phase 2/4: 様式7.5-9-02 拡張フィールドの表示 === */}

      {/* 様式ヘッダ情報 */}
      {(report.projectName ||
        report.siteResponsible ||
        report.supervisorWorkStart ||
        report.supervisorWorkEnd ||
        report.workTimeStart) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">様式7.5-9-02 ヘッダ情報</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {report.projectName && (
              <KvRow label="工事名" value={report.projectName} />
            )}
            {report.siteResponsible && (
              <KvRow label="現場責任者" value={report.siteResponsible} />
            )}
            {(report.supervisorWorkStart || report.supervisorWorkEnd) && (
              <KvRow
                label="監督勤務時間"
                value={`${report.supervisorWorkStart ?? ''} 〜 ${report.supervisorWorkEnd ?? ''}`}
              />
            )}
            {report.workTimeStart && (
              <KvRow label="作業時間 開始" value={report.workTimeStart} />
            )}
          </CardContent>
        </Card>
      )}

      {/* 自社作業員 */}
      {report.ownEmployees && report.ownEmployees.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">自社作業員</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left pb-2 font-medium text-muted-foreground">氏名</th>
                  <th className="text-left pb-2 pl-3 font-medium text-muted-foreground">作業内容</th>
                  <th className="text-left pb-2 pl-3 font-medium text-muted-foreground">時間</th>
                </tr>
              </thead>
              <tbody>
                {report.ownEmployees.map((e, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-2 pr-2 font-medium">{e.displayName}</td>
                    <td className="py-2 pl-3">{e.workContent}</td>
                    <td className="py-2 pl-3 text-muted-foreground">
                      {e.startTime && e.endTime
                        ? `${e.startTime}〜${e.endTime}`
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* 工程内検査 */}
      {report.processInspection && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">工程内検査</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 text-xs">
              {(
                [
                  ['foundation_pile', '基礎杭'],
                  ['rebar', '鉄筋'],
                  ['formwork', '型枠'],
                  ['concrete', 'コンクリート'],
                  ['roof', '屋根'],
                  ['exterior_wall', '外壁'],
                  ['internal_waterproof', '内部防水'],
                  ['electrical', '電気'],
                  ['plumbing', '給排水衛生'],
                  ['roof_waterproof', '屋根防水'],
                  ['interior', '内装'],
                ] as const
              ).map(([key, label]) => (
                <span key={key} className="flex items-center gap-1">
                  <span>{report.processInspection?.[key] ? '☑' : '☐'}</span>
                  <span>{label}</span>
                </span>
              ))}
            </div>
            {report.processInspection.notes && (
              <div>
                <p className="text-xs text-muted-foreground mt-2">指摘・是正事項</p>
                <p className="whitespace-pre-wrap mt-1">{report.processInspection.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 受入先（外注工事含む） */}
      {report.receiveItems && report.receiveItems.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">受入先（外注工事含む）</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left pb-2 font-medium text-muted-foreground">受入先</th>
                  <th className="text-left pb-2 pl-3 font-medium text-muted-foreground">品名</th>
                  <th className="text-right pb-2 pl-3 font-medium text-muted-foreground">数量</th>
                  <th className="text-left pb-2 pl-3 font-medium text-muted-foreground">単位</th>
                </tr>
              </thead>
              <tbody>
                {report.receiveItems.map((it, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-2 pr-2">{it.receiver}</td>
                    <td className="py-2 pl-3">{it.itemName}</td>
                    <td className="py-2 pl-3 text-right">{it.quantity}</td>
                    <td className="py-2 pl-3 text-muted-foreground">{it.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* 持ち出し品 */}
      {report.carryOutItems && report.carryOutItems.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">持ち出し品</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left pb-2 font-medium text-muted-foreground">名称</th>
                  <th className="text-right pb-2 pl-3 font-medium text-muted-foreground">数量</th>
                  <th className="text-left pb-2 pl-3 font-medium text-muted-foreground">区分</th>
                </tr>
              </thead>
              <tbody>
                {report.carryOutItems.map((it, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-2 pr-2">{it.itemName}</td>
                    <td className="py-2 pl-3 text-right">{it.quantity}</td>
                    <td className="py-2 pl-3 text-muted-foreground">
                      {CARRY_OUT_LABELS[it.category] ?? it.category}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* 打合せ記録 */}
      {report.meetingRecords && report.meetingRecords.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">打合せ記録</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left pb-2 font-medium text-muted-foreground">相手先</th>
                  <th className="text-left pb-2 pl-3 font-medium text-muted-foreground">項目・対策</th>
                </tr>
              </thead>
              <tbody>
                {report.meetingRecords.map((m, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-2 pr-2">{m.partner}</td>
                    <td className="py-2 pl-3 whitespace-pre-wrap">{m.topic}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* 使用機器 */}
      {report.machineUsages && report.machineUsages.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">使用機器</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left pb-2 font-medium text-muted-foreground">機械名</th>
                  <th className="text-left pb-2 pl-3 font-medium text-muted-foreground">区分</th>
                  <th className="text-left pb-2 pl-3 font-medium text-muted-foreground">規格</th>
                  <th className="text-left pb-2 pl-3 font-medium text-muted-foreground">運転者</th>
                  <th className="text-right pb-2 pl-3 font-medium text-muted-foreground">使用時間</th>
                </tr>
              </thead>
              <tbody>
                {report.machineUsages.map((m, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-2 pr-2">{m.machineName}</td>
                    <td className="py-2 pl-3 text-muted-foreground">
                      {OWNERSHIP_LABELS[m.ownership] ?? m.ownership}
                    </td>
                    <td className="py-2 pl-3">{m.spec}</td>
                    <td className="py-2 pl-3">{m.operator}</td>
                    <td className="py-2 pl-3 text-right">{m.usageHours}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* 個人勤務時間 */}
      {report.individualWorkTimes && report.individualWorkTimes.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">個人勤務時間</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left pb-2 font-medium text-muted-foreground">氏名</th>
                  <th className="text-left pb-2 pl-3 font-medium text-muted-foreground">時間</th>
                  <th className="text-left pb-2 pl-3 font-medium text-muted-foreground">業務内容</th>
                </tr>
              </thead>
              <tbody>
                {report.individualWorkTimes.map((w, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-2 pr-2">{w.name}</td>
                    <td className="py-2 pl-3 text-muted-foreground">
                      {w.startTime}〜{w.endTime}
                    </td>
                    <td className="py-2 pl-3">{w.workContent}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* 職種別稼動人員（27職種・入力済みのみ） */}
      {report.tradeWorkers &&
        Object.keys(report.tradeWorkers).length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">職種別稼動人員</CardTitle>
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left pb-2 font-medium text-muted-foreground">職種</th>
                    <th className="text-right pb-2 pl-3 font-medium text-muted-foreground">本日</th>
                    <th className="text-right pb-2 pl-3 font-medium text-muted-foreground">累計</th>
                  </tr>
                </thead>
                <tbody>
                  {TRADE_TYPES.filter((t) => report.tradeWorkers?.[t]).map(
                    (t) => {
                      const v = report.tradeWorkers![t]!;
                      return (
                        <tr key={t} className="border-b last:border-0">
                          <td className="py-1 pr-2">{TRADE_LABELS[t]}</td>
                          <td className="py-1 pl-3 text-right tabular-nums">
                            {v.today}
                          </td>
                          <td className="py-1 pl-3 text-right tabular-nums">
                            {v.cumulative}
                          </td>
                        </tr>
                      );
                    }
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}

      {/* 労働時間累計 */}
      {(report.laborHoursToday !== undefined ||
        report.laborHoursCumulative !== undefined) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">労働時間累計</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {report.laborHoursToday !== undefined && (
              <KvRow
                label="労働本日時間"
                value={`${report.laborHoursToday} 時間`}
              />
            )}
            {report.laborHoursCumulative !== undefined && (
              <KvRow
                label="労働延時間 累計"
                value={`${report.laborHoursCumulative} 時間`}
              />
            )}
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

/** ラベル/値の1行表示（再利用用） */
function KvRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-right">{value}</span>
    </div>
  );
}
