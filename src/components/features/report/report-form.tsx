'use client';

import { useEffect, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Trash2, PlusCircle, AlertCircle } from 'lucide-react';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCreateReport } from '@/hooks/use-reports';
import { getIdToken } from '@/lib/firebase/auth';
import {
  createReportSchema,
  type CreateReportFormValues,
} from '@/lib/validations/report';
import {
  calculateTotalHours,
  hasOverlappingBlocks,
  formatMinutesToDisplay,
  timeToMinutes,
} from '@/lib/utils/time-calc';
import { formatDateToISO } from '@/lib/utils/date';
import type { TimeBlock } from '@/types/report';

/** 現場マスターの型 */
interface SiteMaster {
  id: string;
  siteName: string;
}

/** その他（手入力）を示す特別な siteId 値 */
const OTHER_SITE_ID = '__other__';

/** 新規時間ブロックのデフォルト値を生成 */
function createDefaultTimeBlock(): CreateReportFormValues['timeBlocks'][number] {
  return {
    id: crypto.randomUUID(),
    startTime: '08:00',
    endTime: '17:00',
    siteId: null,
    siteName: '',
    workContent: '',
  };
}

interface ReportFormProps {
  /** 編集時のデフォルト値 */
  defaultValues?: Partial<{
    reportDate: string;
    timeBlocks: TimeBlock[];
    notes: string;
  }>;
  /** 編集モード時のレポートID */
  reportId?: string;
}

/** 日報入力フォーム（複数時間ブロック対応） */
export function ReportForm({ defaultValues, reportId }: ReportFormProps) {
  const router = useRouter();
  const createReport = useCreateReport();
  const [sites, setSites] = useState<SiteMaster[]>([]);

  // 現場マスターを取得（失敗しても空配列でフォールバック）
  useEffect(() => {
    const fetchSites = async () => {
      try {
        const token = await getIdToken();
        const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await fetch('/api/masters/sites?active=true', { headers });
        if (!res.ok) return;
        const json = (await res.json()) as { data?: { sites?: SiteMaster[] } };
        if (Array.isArray(json.data?.sites)) {
          setSites(json.data.sites);
        }
      } catch {
        // マスターAPIが利用不可でも無視してフォームを続行する
      }
    };
    void fetchSites();
  }, []);

  const form = useForm<CreateReportFormValues>({
    resolver: zodResolver(createReportSchema),
    defaultValues: {
      reportDate: defaultValues?.reportDate ?? formatDateToISO(new Date()),
      timeBlocks:
        defaultValues?.timeBlocks && defaultValues.timeBlocks.length > 0
          ? defaultValues.timeBlocks
          : [createDefaultTimeBlock()],
      notes: defaultValues?.notes ?? '',
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'timeBlocks',
  });

  // 時間ブロックの変化をウォッチして合計時間をリアルタイム計算
  const watchedBlocks = form.watch('timeBlocks');

  const totals = (() => {
    try {
      const validBlocks = watchedBlocks.filter(
        (b) =>
          b.startTime &&
          b.endTime &&
          /^([01]\d|2[0-3]):[0-5]\d$/.test(b.startTime) &&
          /^([01]\d|2[0-3]):[0-5]\d$/.test(b.endTime) &&
          b.startTime < b.endTime
      );
      if (validBlocks.length === 0) return null;
      return calculateTotalHours(validBlocks);
    } catch {
      return null;
    }
  })();

  // 時間重複警告（バリデーション前のリアルタイム表示用）
  const hasOverlap = (() => {
    try {
      const validBlocks = watchedBlocks.filter(
        (b) =>
          b.startTime &&
          b.endTime &&
          /^([01]\d|2[0-3]):[0-5]\d$/.test(b.startTime) &&
          /^([01]\d|2[0-3]):[0-5]\d$/.test(b.endTime) &&
          b.startTime < b.endTime
      );
      return hasOverlappingBlocks(validBlocks);
    } catch {
      return false;
    }
  })();

  // 合計労働時間（分）
  const totalWorkMinutes = (() => {
    try {
      const validBlocks = watchedBlocks.filter(
        (b) =>
          b.startTime &&
          b.endTime &&
          /^([01]\d|2[0-3]):[0-5]\d$/.test(b.startTime) &&
          /^([01]\d|2[0-3]):[0-5]\d$/.test(b.endTime) &&
          b.startTime < b.endTime
      );
      return validBlocks.reduce((acc, b) => {
        return acc + (timeToMinutes(b.endTime) - timeToMinutes(b.startTime));
      }, 0);
    } catch {
      return 0;
    }
  })();

  async function handleSubmit(status: 'draft' | 'submitted') {
    const valid = await form.trigger();
    if (!valid) return;

    const values = form.getValues();

    try {
      if (reportId) {
        // 更新
        const res = await fetch(`/api/reports/${reportId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...values, status }),
        });
        if (!res.ok) {
          const error = await res.json();
          throw new Error(
            (error as { message?: string }).message ?? '更新に失敗しました'
          );
        }
        toast.success(status === 'draft' ? '下書きを保存しました' : '日報を更新しました');
      } else {
        await createReport.mutateAsync({ ...values, status });
        toast.success(status === 'draft' ? '下書きを保存しました' : '日報を提出しました');
      }
      router.push('/report/history');
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : '日報の保存に失敗しました'
      );
    }
  }

  const isSubmitting = form.formState.isSubmitting;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{reportId ? '日報を編集' : '日報を入力'}</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form className="space-y-6">
            {/* 作業日 */}
            <FormField
              control={form.control}
              name="reportDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>作業日</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 時間ブロック */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">時間ブロック</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append(createDefaultTimeBlock())}
                >
                  <PlusCircle className="h-4 w-4 mr-1" />
                  時間ブロックを追加
                </Button>
              </div>

              {/* 重複警告 */}
              {hasOverlap && (
                <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>時間帯が重複しているブロックがあります</span>
                </div>
              )}

              {fields.map((field, index) => (
                <TimeBlockRow
                  key={field.id}
                  index={index}
                  form={form}
                  sites={sites}
                  canDelete={fields.length > 1}
                  onDelete={() => remove(index)}
                />
              ))}

              {/* timeBlocks 全体のエラー表示 */}
              {form.formState.errors.timeBlocks?.root?.message && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.timeBlocks.root.message}
                </p>
              )}
              {form.formState.errors.timeBlocks?.message && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.timeBlocks.message}
                </p>
              )}
            </div>

            {/* 合計時間表示 */}
            {totals && (
              <Card className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
                <CardContent className="py-3">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-xs text-muted-foreground">実労働時間</p>
                      <p className="text-lg font-bold text-blue-700 dark:text-blue-300">
                        {formatMinutesToDisplay(totalWorkMinutes)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">所定内</p>
                      <p className="text-lg font-bold">{totals.totalRegularHours}h</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">残業</p>
                      <p
                        className={`text-lg font-bold ${totals.totalOvertimeHours > 0 ? 'text-orange-600 dark:text-orange-400' : ''}`}
                      >
                        {totals.totalOvertimeHours}h
                      </p>
                    </div>
                  </div>
                  {totals.totalNightHours > 0 && (
                    <p className="text-xs text-muted-foreground text-center mt-1">
                      深夜割増: {totals.totalNightHours}h
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* 備考 */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>備考（任意）</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="特記事項があれば記入してください"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* ボタン */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                disabled={isSubmitting}
                onClick={() => void handleSubmit('draft')}
              >
                {isSubmitting ? '保存中...' : '下書き保存'}
              </Button>
              <Button
                type="button"
                className="flex-1"
                disabled={isSubmitting}
                onClick={() => void handleSubmit('submitted')}
              >
                {isSubmitting
                  ? '送信中...'
                  : reportId
                    ? '更新して再提出'
                    : '提出する'}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

/** 時間ブロック1行コンポーネント */
function TimeBlockRow({
  index,
  form,
  sites,
  canDelete,
  onDelete,
}: {
  index: number;
  form: ReturnType<typeof useForm<CreateReportFormValues>>;
  sites: SiteMaster[];
  canDelete: boolean;
  onDelete: () => void;
}) {
  // 現場選択の状態管理（「その他」選択時に手入力を表示）
  const siteId = form.watch(`timeBlocks.${index}.siteId`);
  const isOther = siteId === null && sites.length > 0;

  // 現場選択ハンドラー
  function handleSiteChange(value: string) {
    if (value === OTHER_SITE_ID) {
      // 「その他」選択時: siteId=null、siteName はそのままに（手入力へ）
      form.setValue(`timeBlocks.${index}.siteId`, null);
      form.setValue(`timeBlocks.${index}.siteName`, '');
    } else {
      const site = sites.find((s) => s.id === value);
      form.setValue(`timeBlocks.${index}.siteId`, value);
      form.setValue(`timeBlocks.${index}.siteName`, site?.siteName ?? '');
    }
  }

  // Select の現在値（null かつ sites あり → OTHER_SITE_ID、それ以外は siteId）
  const selectValue = siteId !== null ? siteId : sites.length > 0 ? OTHER_SITE_ID : '';

  return (
    <Card className="border border-border">
      <CardContent className="pt-4 pb-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground">
            ブロック {index + 1}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={!canDelete}
            onClick={onDelete}
            className="h-7 w-7 text-muted-foreground hover:text-destructive disabled:opacity-30"
            aria-label={`ブロック ${index + 1} を削除`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        {/* 現場名 */}
        {sites.length > 0 ? (
          <FormItem>
            <FormLabel>現場名</FormLabel>
            <Select value={selectValue} onValueChange={handleSiteChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="現場を選択してください" />
              </SelectTrigger>
              <SelectContent>
                {sites.map((site) => (
                  <SelectItem key={site.id} value={site.id}>
                    {site.siteName}
                  </SelectItem>
                ))}
                <SelectItem value={OTHER_SITE_ID}>その他（手入力）</SelectItem>
              </SelectContent>
            </Select>
            {form.formState.errors.timeBlocks?.[index]?.siteId && (
              <p className="text-sm text-destructive">
                {form.formState.errors.timeBlocks[index]?.siteId?.message}
              </p>
            )}
          </FormItem>
        ) : null}

        {/* 手入力フィールド（現場マスターなし or「その他」選択時） */}
        {(sites.length === 0 || isOther) && (
          <FormField
            control={form.control}
            name={`timeBlocks.${index}.siteName`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>{sites.length > 0 ? '現場名（手入力）' : '現場名'}</FormLabel>
                <FormControl>
                  <Input placeholder="現場名を入力してください" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {/* 開始・終了時刻 */}
        <div className="grid grid-cols-2 gap-3">
          <FormField
            control={form.control}
            name={`timeBlocks.${index}.startTime`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>開始時刻</FormLabel>
                <FormControl>
                  <Input type="time" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name={`timeBlocks.${index}.endTime`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>終了時刻</FormLabel>
                <FormControl>
                  <Input type="time" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* 作業内容 */}
        <FormField
          control={form.control}
          name={`timeBlocks.${index}.workContent`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>作業内容</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="この時間帯の作業内容を入力してください"
                  rows={3}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </CardContent>
    </Card>
  );
}
