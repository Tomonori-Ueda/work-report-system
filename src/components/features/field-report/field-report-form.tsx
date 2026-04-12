'use client';

import { useEffect, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Trash2, PlusCircle } from 'lucide-react';
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
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useCreateFieldReport, useUpdateFieldReport } from '@/hooks/use-field-reports';
import { getIdToken } from '@/lib/firebase/auth';
import {
  createFieldReportSchema,
  type CreateFieldReportFormValues,
} from '@/lib/validations/field-report';
import { formatDateToISO } from '@/lib/utils/date';
import {
  WEATHER,
  EXPENSE_CATEGORY,
  type Weather,
  type ExpenseCategory,
  type FieldReport,
} from '@/types/field-report';

/** 現場マスター型 */
interface SiteMaster {
  id: string;
  siteName: string;
}

/** 協力会社マスター型 */
interface SubcontractorMaster {
  id: string;
  companyName: string;
}

/** 作業内容マスター型 */
interface WorkTypeMaster {
  id: string;
  name: string;
}

/** その他（手入力）を示す特別な値 */
const OTHER_VALUE = '__other__';

/** 天候の表示ラベル */
const WEATHER_LABELS: Record<Weather, string> = {
  [WEATHER.SUNNY]: '晴れ',
  [WEATHER.CLOUDY]: '曇り',
  [WEATHER.RAINY]: '雨',
  [WEATHER.SNOWY]: '雪',
};

/** 経費科目の表示ラベル */
const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  [EXPENSE_CATEGORY.MATERIAL]: '材料費',
  [EXPENSE_CATEGORY.LABOR]: '労務費',
  [EXPENSE_CATEGORY.SUBCONTRACT]: '外注費',
  [EXPENSE_CATEGORY.OTHER]: '経費',
};

/** 新規協力会社行のデフォルト値 */
function createDefaultSubcontractorWork(): CreateFieldReportFormValues['subcontractorWorks'][number] {
  return {
    subcontractorId: null,
    companyName: '',
    workerCount: 0,
    workContent: '',
    expenseCategory: EXPENSE_CATEGORY.LABOR,
    startTime: undefined,
    endTime: undefined,
  };
}

/** 新規資材搬入行のデフォルト値 */
function createDefaultMaterialDelivery(): CreateFieldReportFormValues['materialDeliveries'][number] {
  return {
    materialName: '',
    quantity: '',
  };
}

interface FieldReportFormProps {
  /** 編集時の既存データ */
  defaultReport?: FieldReport;
  /** 編集対象の日報ID */
  reportId?: string;
}

/** 現場日報入力フォーム */
export function FieldReportForm({ defaultReport, reportId }: FieldReportFormProps) {
  const router = useRouter();
  const createFieldReport = useCreateFieldReport();
  const updateFieldReport = useUpdateFieldReport();

  const [sites, setSites] = useState<SiteMaster[]>([]);
  const [subcontractors, setSubcontractors] = useState<SubcontractorMaster[]>([]);
  const [workTypes, setWorkTypes] = useState<WorkTypeMaster[]>([]);
  const [showPreview, setShowPreview] = useState(false);

  // 各マスターを取得（失敗しても空配列でフォールバック）
  useEffect(() => {
    const fetchMasters = async () => {
      const token = await getIdToken();
      const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};

      type SitesResponse = { data: { sites: SiteMaster[] } };
      type SubcontractorsResponse = { data: { subcontractors: SubcontractorMaster[] } };
      type WorkTypesResponse = { data: { workTypes: WorkTypeMaster[] } };

      await Promise.allSettled([
        fetch('/api/masters/sites?active=true', { headers })
          .then((res) => (res.ok ? res.json() : null))
          .then((json: unknown) => {
            const typed = json as SitesResponse | null;
            if (typed?.data?.sites && Array.isArray(typed.data.sites)) {
              setSites(typed.data.sites);
            }
          }),
        fetch('/api/masters/subcontractors?active=true', { headers })
          .then((res) => (res.ok ? res.json() : null))
          .then((json: unknown) => {
            const typed = json as SubcontractorsResponse | null;
            if (typed?.data?.subcontractors && Array.isArray(typed.data.subcontractors)) {
              setSubcontractors(typed.data.subcontractors);
            }
          }),
        fetch('/api/masters/work-types?active=true', { headers })
          .then((res) => (res.ok ? res.json() : null))
          .then((json: unknown) => {
            const typed = json as WorkTypesResponse | null;
            if (typed?.data?.workTypes && Array.isArray(typed.data.workTypes)) {
              setWorkTypes(typed.data.workTypes);
            }
          }),
      ]);
    };
    void fetchMasters();
  }, []);

  const form = useForm<CreateFieldReportFormValues>({
    resolver: zodResolver(createFieldReportSchema),
    defaultValues: {
      reportDate: defaultReport?.reportDate ?? formatDateToISO(new Date()),
      weather: defaultReport?.weather ?? WEATHER.SUNNY,
      siteId: defaultReport?.siteId ?? '',
      siteName: defaultReport?.siteName ?? '',
      subcontractorWorks:
        defaultReport?.subcontractorWorks && defaultReport.subcontractorWorks.length > 0
          ? defaultReport.subcontractorWorks.map((w) => ({
              ...w,
              startTime: w.startTime ?? null,
              endTime: w.endTime ?? null,
            }))
          : [createDefaultSubcontractorWork()],
      materialDeliveries: defaultReport?.materialDeliveries ?? [],
      notes: defaultReport?.notes ?? '',
    },
  });

  const {
    fields: subcontractorFields,
    append: appendSubcontractor,
    remove: removeSubcontractor,
  } = useFieldArray({
    control: form.control,
    name: 'subcontractorWorks',
  });

  const {
    fields: materialFields,
    append: appendMaterial,
    remove: removeMaterial,
  } = useFieldArray({
    control: form.control,
    name: 'materialDeliveries',
  });

  // 合計人数をリアルタイム計算
  const watchedWorks = form.watch('subcontractorWorks');
  const totalWorkerCount = watchedWorks.reduce(
    (sum, work) => sum + (Number(work.workerCount) || 0),
    0
  );

  async function handleSubmit(values: CreateFieldReportFormValues) {
    try {
      if (reportId) {
        await updateFieldReport.mutateAsync({ id: reportId, data: values });
        toast.success('現場日報を更新しました');
      } else {
        await createFieldReport.mutateAsync(values);
        toast.success('現場日報を保存しました');
      }
      router.push('/field-report/history');
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : '現場日報の保存に失敗しました'
      );
    }
  }

  const isSubmitting = form.formState.isSubmitting;
  const previewValues = form.watch();

  async function handlePreviewOpen() {
    const isValid = await form.trigger();
    if (isValid) setShowPreview(true);
  }

  return (
    <>
    {/* プレビューダイアログ */}
    <Dialog open={showPreview} onOpenChange={setShowPreview}>
      <DialogContent className="max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>入力内容の確認</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-xs text-muted-foreground">日付</p>
              <p className="font-medium">{previewValues.reportDate}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">天候</p>
              <p className="font-medium">{WEATHER_LABELS[previewValues.weather]}</p>
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">現場名</p>
            <p className="font-medium">{previewValues.siteName || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-2">協力会社</p>
            {previewValues.subcontractorWorks.map((work, i) => (
              <div key={i} className="bg-muted/40 rounded p-2 mb-2 space-y-1">
                <p className="font-medium">{work.companyName || `会社 ${i + 1}`}</p>
                <div className="flex gap-3 text-xs text-muted-foreground">
                  <span>{work.workerCount}名</span>
                  <span>{work.workContent}</span>
                  <span>{EXPENSE_CATEGORY_LABELS[work.expenseCategory]}</span>
                  {work.startTime && work.endTime && (
                    <span>{work.startTime}〜{work.endTime}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
          {previewValues.materialDeliveries.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-2">資材搬入</p>
              {previewValues.materialDeliveries.map((mat, i) => (
                <div key={i} className="bg-muted/40 rounded p-2 mb-2 text-xs">
                  {mat.materialName}：{mat.quantity}
                </div>
              ))}
            </div>
          )}
          {previewValues.notes && (
            <div>
              <p className="text-xs text-muted-foreground">備考</p>
              <p className="whitespace-pre-wrap">{previewValues.notes}</p>
            </div>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setShowPreview(false)}>
            修正する
          </Button>
          <Button
            onClick={() => {
              setShowPreview(false);
              void form.handleSubmit(handleSubmit)();
            }}
            disabled={isSubmitting}
          >
            {isSubmitting ? '保存中...' : reportId ? '更新する' : '保存する'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Form {...form}>
      <form
        onSubmit={(e) => void form.handleSubmit(handleSubmit)(e)}
        className="space-y-6"
      >
        {/* 日付 */}
        <FormField
          control={form.control}
          name="reportDate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>日付</FormLabel>
              <FormControl>
                <Input type="date" {...field} className="w-full" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* 天候 */}
        <FormField
          control={form.control}
          name="weather"
          render={({ field }) => (
            <FormItem>
              <FormLabel>天候</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="天候を選択してください" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {(Object.entries(WEATHER_LABELS) as [Weather, string][]).map(
                    ([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* 現場名 */}
        <SiteField form={form} sites={sites} />

        {/* 協力会社セクション */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium">協力会社</p>
              <Badge variant="secondary">合計 {totalWorkerCount} 名</Badge>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-[44px] px-4"
              onClick={() => appendSubcontractor(createDefaultSubcontractorWork())}
            >
              <PlusCircle className="h-4 w-4 mr-1" />
              行を追加
            </Button>
          </div>

          {subcontractorFields.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              協力会社行を追加してください
            </p>
          )}

          {subcontractorFields.map((field, index) => (
            <SubcontractorWorkRow
              key={field.id}
              index={index}
              form={form}
              subcontractors={subcontractors}
              workTypes={workTypes}
              canDelete={subcontractorFields.length > 1}
              onDelete={() => removeSubcontractor(index)}
            />
          ))}

          {form.formState.errors.subcontractorWorks?.message && (
            <p className="text-sm text-destructive">
              {form.formState.errors.subcontractorWorks.message}
            </p>
          )}
        </div>

        {/* 資材搬入セクション */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">資材搬入（任意）</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-[44px] px-4"
              onClick={() => appendMaterial(createDefaultMaterialDelivery())}
            >
              <PlusCircle className="h-4 w-4 mr-1" />
              行を追加
            </Button>
          </div>

          {materialFields.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4 bg-muted/30 rounded-md">
              資材搬入がある場合は行を追加してください
            </p>
          )}

          {materialFields.map((field, index) => (
            <MaterialDeliveryRow
              key={field.id}
              index={index}
              form={form}
              onDelete={() => removeMaterial(index)}
            />
          ))}
        </div>

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

        {/* プレビュー・保存ボタン */}
        <Button
          type="button"
          className="w-full min-h-[48px] text-base"
          disabled={isSubmitting}
          onClick={() => void handlePreviewOpen()}
        >
          {isSubmitting ? '保存中...' : '内容を確認する'}
        </Button>
      </form>
    </Form>
    </>
  );
}

/** 現場選択フィールド（マスターがあればセレクト、なければ手入力） */
function SiteField({
  form,
  sites,
}: {
  form: ReturnType<typeof useForm<CreateFieldReportFormValues>>;
  sites: SiteMaster[];
}) {
  const siteId = form.watch('siteId');
  const isOther = siteId === '' && sites.length > 0;

  function handleSiteChange(value: string) {
    if (value === OTHER_VALUE) {
      form.setValue('siteId', '');
      form.setValue('siteName', '');
    } else {
      const site = sites.find((s) => s.id === value);
      form.setValue('siteId', value);
      form.setValue('siteName', site?.siteName ?? '');
    }
  }

  const selectValue = siteId !== '' ? siteId : sites.length > 0 ? OTHER_VALUE : '';

  return (
    <div className="space-y-2">
      {sites.length > 0 && (
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
              <SelectItem value={OTHER_VALUE}>その他（手入力）</SelectItem>
            </SelectContent>
          </Select>
          {form.formState.errors.siteId && (
            <p className="text-sm text-destructive">
              {form.formState.errors.siteId.message}
            </p>
          )}
        </FormItem>
      )}

      {(sites.length === 0 || isOther) && (
        <FormField
          control={form.control}
          name="siteName"
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
    </div>
  );
}

/** 協力会社作業記録1行 */
function SubcontractorWorkRow({
  index,
  form,
  subcontractors,
  workTypes,
  canDelete,
  onDelete,
}: {
  index: number;
  form: ReturnType<typeof useForm<CreateFieldReportFormValues>>;
  subcontractors: SubcontractorMaster[];
  workTypes: WorkTypeMaster[];
  canDelete: boolean;
  onDelete: () => void;
}) {
  const subcontractorId = form.watch(`subcontractorWorks.${index}.subcontractorId`);
  const isOtherCompany = subcontractorId === null && subcontractors.length > 0;
  const workContent = form.watch(`subcontractorWorks.${index}.workContent`);
  const isOtherWork =
    workContent !== '' &&
    workTypes.length > 0 &&
    !workTypes.some((wt) => wt.name === workContent);

  function handleSubcontractorChange(value: string) {
    if (value === OTHER_VALUE) {
      form.setValue(`subcontractorWorks.${index}.subcontractorId`, null);
      form.setValue(`subcontractorWorks.${index}.companyName`, '');
    } else {
      const sub = subcontractors.find((s) => s.id === value);
      form.setValue(`subcontractorWorks.${index}.subcontractorId`, value);
      form.setValue(`subcontractorWorks.${index}.companyName`, sub?.companyName ?? '');
    }
  }

  const subSelectValue =
    subcontractorId !== null
      ? subcontractorId
      : subcontractors.length > 0
        ? OTHER_VALUE
        : '';

  return (
    <Card className="border border-border">
      <CardContent className="pt-4 pb-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground">
            協力会社 {index + 1}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={!canDelete}
            onClick={onDelete}
            className="h-11 w-11 text-muted-foreground hover:text-destructive disabled:opacity-30"
            aria-label={`協力会社 ${index + 1} を削除`}
          >
            <Trash2 className="h-5 w-5" />
          </Button>
        </div>

        {/* 協力会社選択 */}
        {subcontractors.length > 0 && (
          <FormItem>
            <FormLabel>協力会社</FormLabel>
            <Select value={subSelectValue} onValueChange={handleSubcontractorChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="協力会社を選択してください" />
              </SelectTrigger>
              <SelectContent>
                {subcontractors.map((sub) => (
                  <SelectItem key={sub.id} value={sub.id}>
                    {sub.companyName}
                  </SelectItem>
                ))}
                <SelectItem value={OTHER_VALUE}>その他（手入力）</SelectItem>
              </SelectContent>
            </Select>
          </FormItem>
        )}

        {/* 会社名手入力（マスターなし or その他選択時） */}
        {(subcontractors.length === 0 || isOtherCompany) && (
          <FormField
            control={form.control}
            name={`subcontractorWorks.${index}.companyName`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {subcontractors.length > 0 ? '会社名（手入力）' : '協力会社名'}
                </FormLabel>
                <FormControl>
                  <Input placeholder="会社名を入力してください" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {/* 人数 */}
        <FormField
          control={form.control}
          name={`subcontractorWorks.${index}.workerCount`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>人数</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={0}
                  max={999}
                  inputMode="numeric"
                  placeholder="0"
                  {...field}
                  onChange={(e) => field.onChange(Number(e.target.value))}
                  className="w-32"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* 作業内容 */}
        {workTypes.length > 0 && (
          <FormItem>
            <FormLabel>作業内容</FormLabel>
            <Select
              value={isOtherWork ? OTHER_VALUE : (workContent || '')}
              onValueChange={(value) => {
                if (value === OTHER_VALUE) {
                  form.setValue(`subcontractorWorks.${index}.workContent`, '');
                } else {
                  form.setValue(`subcontractorWorks.${index}.workContent`, value);
                }
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="作業内容を選択してください" />
              </SelectTrigger>
              <SelectContent>
                {workTypes.map((wt) => (
                  <SelectItem key={wt.id} value={wt.name}>
                    {wt.name}
                  </SelectItem>
                ))}
                <SelectItem value={OTHER_VALUE}>その他（手入力）</SelectItem>
              </SelectContent>
            </Select>
          </FormItem>
        )}

        {/* 作業内容手入力 */}
        {(workTypes.length === 0 || isOtherWork || workContent === '') && (
          <FormField
            control={form.control}
            name={`subcontractorWorks.${index}.workContent`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {workTypes.length > 0 ? '作業内容（手入力）' : '作業内容'}
                </FormLabel>
                <FormControl>
                  <Input placeholder="作業内容を入力してください" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {/* 経費科目 */}
        <FormField
          control={form.control}
          name={`subcontractorWorks.${index}.expenseCategory`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>経費科目</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="経費科目を選択してください" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {(
                    Object.entries(EXPENSE_CATEGORY_LABELS) as [
                      ExpenseCategory,
                      string,
                    ][]
                  ).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* 作業時間（任意）: 開始・終了時刻 */}
        <div className="grid grid-cols-2 gap-3">
          <FormField
            control={form.control}
            name={`subcontractorWorks.${index}.startTime`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>作業開始（任意）</FormLabel>
                <FormControl>
                  <Input
                    type="time"
                    value={field.value ?? ''}
                    onChange={(e) =>
                      field.onChange(e.target.value || null)
                    }
                    className="w-full"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name={`subcontractorWorks.${index}.endTime`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>作業終了（任意）</FormLabel>
                <FormControl>
                  <Input
                    type="time"
                    value={field.value ?? ''}
                    onChange={(e) =>
                      field.onChange(e.target.value || null)
                    }
                    className="w-full"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        {form.formState.errors.subcontractorWorks?.[index]?.endTime && (
          <p className="text-sm text-destructive">
            {form.formState.errors.subcontractorWorks[index].endTime?.message}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/** 資材搬入1行 */
function MaterialDeliveryRow({
  index,
  form,
  onDelete,
}: {
  index: number;
  form: ReturnType<typeof useForm<CreateFieldReportFormValues>>;
  onDelete: () => void;
}) {
  return (
    <Card className="border border-border">
      <CardContent className="pt-4 pb-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground">
            資材 {index + 1}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onDelete}
            className="h-11 w-11 text-muted-foreground hover:text-destructive"
            aria-label={`資材 ${index + 1} を削除`}
          >
            <Trash2 className="h-5 w-5" />
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FormField
            control={form.control}
            name={`materialDeliveries.${index}.materialName`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>材料名</FormLabel>
                <FormControl>
                  <Input placeholder="材料名を入力" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name={`materialDeliveries.${index}.quantity`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>数量</FormLabel>
                <FormControl>
                  <Input placeholder="例: 50袋" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </CardContent>
    </Card>
  );
}
