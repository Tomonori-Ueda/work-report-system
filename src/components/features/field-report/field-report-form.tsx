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
  CARRY_OUT_CATEGORY,
  MACHINE_OWNERSHIP,
  TRADE_TYPES,
  TRADE_LABELS,
  createEmptyProcessInspection,
  type Weather,
  type ExpenseCategory,
  type FieldReport,
  type ProcessInspection,
  type TradeType,
} from '@/types/field-report';
import { Checkbox } from '@/components/ui/checkbox';

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
    workerNames: [],
  };
}

/** 新規自社作業員行のデフォルト値 */
function createDefaultOwnEmployee(): CreateFieldReportFormValues['ownEmployees'] extends Array<infer T> | undefined
  ? T
  : never {
  return {
    userId: null,
    displayName: '',
    workContent: '',
    startTime: null,
    endTime: null,
  };
}

/** 工程内検査チェックボックスの順序とラベル（Excel出力と同順） */
const PROCESS_INSPECTION_ITEMS: Array<[keyof ProcessInspection, string]> = [
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
];

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
              workerNames: w.workerNames ?? [],
            }))
          : [createDefaultSubcontractorWork()],
      materialDeliveries: defaultReport?.materialDeliveries ?? [],
      notes: defaultReport?.notes ?? '',
      // === Phase 2 拡張 ===
      projectName: defaultReport?.projectName ?? '',
      siteResponsible: defaultReport?.siteResponsible ?? '',
      supervisorWorkStart: defaultReport?.supervisorWorkStart ?? '',
      supervisorWorkEnd: defaultReport?.supervisorWorkEnd ?? '',
      workTimeStart: defaultReport?.workTimeStart ?? '',
      processInspection: defaultReport?.processInspection ?? createEmptyProcessInspection(),
      ownEmployees: defaultReport?.ownEmployees ?? [],
      // === Phase 4 拡張: 様式7.5-9-02 の残り入力欄 ===
      receiveItems: defaultReport?.receiveItems ?? [],
      carryOutItems: defaultReport?.carryOutItems ?? [],
      meetingRecords: defaultReport?.meetingRecords ?? [],
      machineUsages: defaultReport?.machineUsages ?? [],
      individualWorkTimes: defaultReport?.individualWorkTimes ?? [],
      tradeWorkers: defaultReport?.tradeWorkers ?? {},
      laborHoursToday: defaultReport?.laborHoursToday ?? undefined,
      laborHoursCumulative: defaultReport?.laborHoursCumulative ?? undefined,
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

  const {
    fields: ownEmployeeFields,
    append: appendOwnEmployee,
    remove: removeOwnEmployee,
  } = useFieldArray({
    control: form.control,
    name: 'ownEmployees',
  });

  // Phase 4 追加セクション
  const {
    fields: receiveItemFields,
    append: appendReceiveItem,
    remove: removeReceiveItem,
  } = useFieldArray({ control: form.control, name: 'receiveItems' });

  const {
    fields: carryOutFields,
    append: appendCarryOut,
    remove: removeCarryOut,
  } = useFieldArray({ control: form.control, name: 'carryOutItems' });

  const {
    fields: meetingFields,
    append: appendMeeting,
    remove: removeMeeting,
  } = useFieldArray({ control: form.control, name: 'meetingRecords' });

  const {
    fields: machineFields,
    append: appendMachine,
    remove: removeMachine,
  } = useFieldArray({ control: form.control, name: 'machineUsages' });

  const {
    fields: individualWorkFields,
    append: appendIndividualWork,
    remove: removeIndividualWork,
  } = useFieldArray({ control: form.control, name: 'individualWorkTimes' });

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

  /**
   * 動的セクション（自社作業員・受入先・持ち出し品・打合せ・使用機器・個人勤務時間）で
   * ユーザーが「行を追加」だけして埋めずに残した空行を、検証前に削除する。
   *
   * Why: 空行を残したまま「内容を確認する」を押すと displayName 等の必須エラーで
   *      trigger() が失敗し、UIには反応がないように見えてしまう。
   *      空行は明らかに送信不要なので自動で除去する。
   */
  function pruneEmptyArrays(): void {
    const values = form.getValues();
    const next = {
      ownEmployees: (values.ownEmployees ?? []).filter(
        (e) => (e.displayName ?? '').trim().length > 0
      ),
      receiveItems: (values.receiveItems ?? []).filter(
        (e) =>
          (e.receiver ?? '').trim().length > 0 ||
          (e.itemName ?? '').trim().length > 0 ||
          (e.quantity ?? '').trim().length > 0 ||
          (e.unit ?? '').trim().length > 0
      ),
      carryOutItems: (values.carryOutItems ?? []).filter(
        (e) =>
          (e.itemName ?? '').trim().length > 0 ||
          (e.quantity ?? '').trim().length > 0
      ),
      meetingRecords: (values.meetingRecords ?? []).filter(
        (e) =>
          (e.partner ?? '').trim().length > 0 ||
          (e.topic ?? '').trim().length > 0
      ),
      machineUsages: (values.machineUsages ?? []).filter(
        (e) =>
          (e.machineName ?? '').trim().length > 0 ||
          (e.spec ?? '').trim().length > 0 ||
          (e.operator ?? '').trim().length > 0 ||
          (e.usageHours ?? '').trim().length > 0
      ),
      individualWorkTimes: (values.individualWorkTimes ?? []).filter(
        (e) =>
          (e.name ?? '').trim().length > 0 ||
          (e.workContent ?? '').trim().length > 0
      ),
      materialDeliveries: (values.materialDeliveries ?? []).filter(
        (e) =>
          (e.materialName ?? '').trim().length > 0 ||
          (e.quantity ?? '').trim().length > 0
      ),
    };
    form.setValue('ownEmployees', next.ownEmployees, { shouldDirty: true });
    form.setValue('receiveItems', next.receiveItems, { shouldDirty: true });
    form.setValue('carryOutItems', next.carryOutItems, { shouldDirty: true });
    form.setValue('meetingRecords', next.meetingRecords, { shouldDirty: true });
    form.setValue('machineUsages', next.machineUsages, { shouldDirty: true });
    form.setValue('individualWorkTimes', next.individualWorkTimes, {
      shouldDirty: true,
    });
    form.setValue('materialDeliveries', next.materialDeliveries, {
      shouldDirty: true,
    });
  }

  /**
   * 「内容を確認する」ボタンを押すと無条件にプレビューを開く。
   * Why: 旧実装は trigger() が失敗するとプレビューを開かず、ユーザーには
   *      無反応に見える事故が頻発した。プレビューは見るだけの画面なので
   *      開く側は無検証で OK。実検証はプレビュー内「保存する」ボタンで実施する。
   */
  function handlePreviewOpen() {
    pruneEmptyArrays();
    setShowPreview(true);
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

        {/* 様式7.5-9-02 ヘッダ情報 */}
        <Card className="border-dashed">
          <CardContent className="pt-4 pb-4 space-y-3">
            <p className="text-sm font-medium text-muted-foreground">
              様式7.5-9-02 ヘッダ情報（任意）
            </p>
            <FormField
              control={form.control}
              name="projectName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>工事名</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="例: (軽井沢)小峯様別荘新築工事"
                      {...field}
                      value={field.value ?? ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="siteResponsible"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>現場責任者</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="例: 小林 紀之"
                      {...field}
                      value={field.value ?? ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="supervisorWorkStart"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>監督勤務開始</FormLabel>
                    <FormControl>
                      <Input
                        type="time"
                        {...field}
                        value={field.value ?? ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="supervisorWorkEnd"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>監督勤務終了</FormLabel>
                    <FormControl>
                      <Input
                        type="time"
                        {...field}
                        value={field.value ?? ''}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="workTimeStart"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>作業時間 開始</FormLabel>
                  <FormControl>
                    <Input
                      type="time"
                      {...field}
                      value={field.value ?? ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

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

        {/* 自社作業員セクション（人名単位） */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">自社作業員（人名単位・任意）</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-[44px] px-4"
              onClick={() => appendOwnEmployee(createDefaultOwnEmployee())}
            >
              <PlusCircle className="h-4 w-4 mr-1" />
              行を追加
            </Button>
          </div>
          {ownEmployeeFields.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-3 bg-muted/30 rounded-md">
              自社（直営）作業員を入れた場合は氏名を追加してください
            </p>
          )}
          {ownEmployeeFields.map((field, index) => (
            <Card key={field.id} className="border border-border">
              <CardContent className="pt-4 pb-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    自社作業員 {index + 1}
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeOwnEmployee(index)}
                    className="h-11 w-11 text-muted-foreground hover:text-destructive"
                    aria-label={`自社作業員 ${index + 1} を削除`}
                  >
                    <Trash2 className="h-5 w-5" />
                  </Button>
                </div>
                <FormField
                  control={form.control}
                  name={`ownEmployees.${index}.displayName`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>氏名</FormLabel>
                      <FormControl>
                        <Input placeholder="例: 田中 太郎" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name={`ownEmployees.${index}.workContent`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>作業内容</FormLabel>
                      <FormControl>
                        <Input placeholder="作業内容" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name={`ownEmployees.${index}.startTime`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>開始（任意）</FormLabel>
                        <FormControl>
                          <Input
                            type="time"
                            value={field.value ?? ''}
                            onChange={(e) => field.onChange(e.target.value || null)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`ownEmployees.${index}.endTime`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>終了（任意）</FormLabel>
                        <FormControl>
                          <Input
                            type="time"
                            value={field.value ?? ''}
                            onChange={(e) => field.onChange(e.target.value || null)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* 工程内検査セクション */}
        <Card className="border-dashed">
          <CardContent className="pt-4 pb-4 space-y-3">
            <p className="text-sm font-medium">工程内検査（任意）</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {PROCESS_INSPECTION_ITEMS.map(([key, label]) => (
                <FormField
                  key={key}
                  control={form.control}
                  name={`processInspection.${key}`}
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center gap-2 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={Boolean(field.value)}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormLabel className="text-sm font-normal cursor-pointer">
                        {label}
                      </FormLabel>
                    </FormItem>
                  )}
                />
              ))}
            </div>
            <FormField
              control={form.control}
              name="processInspection.notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>指摘・是正事項</FormLabel>
                  <FormControl>
                    <Textarea rows={2} {...field} value={field.value ?? ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* 受入先（外注工事含む） */}
        <DynamicSection
          title="受入先（外注工事含む・任意）"
          fieldsLength={receiveItemFields.length}
          onAdd={() =>
            appendReceiveItem({ receiver: '', itemName: '', quantity: '', unit: '' })
          }
          emptyText="受入があれば行を追加してください"
        >
          {receiveItemFields.map((field, index) => (
            <Card key={field.id} className="border border-border">
              <CardContent className="pt-4 pb-4 space-y-3">
                <RowHeader
                  label={`受入先 ${index + 1}`}
                  onDelete={() => removeReceiveItem(index)}
                />
                <FormField
                  control={form.control}
                  name={`receiveItems.${index}.receiver`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>受入先</FormLabel>
                      <FormControl>
                        <Input placeholder="例: ㈱カネト" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name={`receiveItems.${index}.itemName`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>品名</FormLabel>
                      <FormControl>
                        <Input placeholder="例: ガラス" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name={`receiveItems.${index}.quantity`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>数量</FormLabel>
                        <FormControl>
                          <Input placeholder="例: 1" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`receiveItems.${index}.unit`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>単位</FormLabel>
                        <FormControl>
                          <Input placeholder="例: 式" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </DynamicSection>

        {/* 持ち出し品 */}
        <DynamicSection
          title="持ち出し品（任意）"
          fieldsLength={carryOutFields.length}
          onAdd={() =>
            appendCarryOut({
              itemName: '',
              quantity: '',
              category: CARRY_OUT_CATEGORY.BORROW,
            })
          }
          emptyText="会社資材・機材・備品の持ち出しがあれば行を追加してください"
        >
          {carryOutFields.map((field, index) => (
            <Card key={field.id} className="border border-border">
              <CardContent className="pt-4 pb-4 space-y-3">
                <RowHeader
                  label={`持ち出し品 ${index + 1}`}
                  onDelete={() => removeCarryOut(index)}
                />
                <FormField
                  control={form.control}
                  name={`carryOutItems.${index}.itemName`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>名称</FormLabel>
                      <FormControl>
                        <Input placeholder="例: 電動ドリル" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name={`carryOutItems.${index}.quantity`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>数量</FormLabel>
                        <FormControl>
                          <Input placeholder="例: 1台" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`carryOutItems.${index}.category`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>区分</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value={CARRY_OUT_CATEGORY.BORROW}>借入</SelectItem>
                            <SelectItem value={CARRY_OUT_CATEGORY.RETURN}>返却</SelectItem>
                            <SelectItem value={CARRY_OUT_CATEGORY.CONSUME}>消却</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </DynamicSection>

        {/* 打合せ記録 */}
        <DynamicSection
          title="打合せ記録（任意）"
          fieldsLength={meetingFields.length}
          onAdd={() => appendMeeting({ partner: '', topic: '' })}
          emptyText="打合せがあれば行を追加してください"
        >
          {meetingFields.map((field, index) => (
            <Card key={field.id} className="border border-border">
              <CardContent className="pt-4 pb-4 space-y-3">
                <RowHeader
                  label={`打合せ ${index + 1}`}
                  onDelete={() => removeMeeting(index)}
                />
                <FormField
                  control={form.control}
                  name={`meetingRecords.${index}.partner`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>相手先</FormLabel>
                      <FormControl>
                        <Input placeholder="例: 建主" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name={`meetingRecords.${index}.topic`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>項目・対策</FormLabel>
                      <FormControl>
                        <Textarea rows={2} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          ))}
        </DynamicSection>

        {/* 使用機器 */}
        <DynamicSection
          title="使用機器（任意）"
          fieldsLength={machineFields.length}
          onAdd={() =>
            appendMachine({
              machineName: '',
              ownership: MACHINE_OWNERSHIP.OWN,
              spec: '',
              operator: '',
              usageHours: '',
            })
          }
          emptyText="使用機器があれば行を追加してください"
        >
          {machineFields.map((field, index) => (
            <Card key={field.id} className="border border-border">
              <CardContent className="pt-4 pb-4 space-y-3">
                <RowHeader
                  label={`使用機器 ${index + 1}`}
                  onDelete={() => removeMachine(index)}
                />
                <FormField
                  control={form.control}
                  name={`machineUsages.${index}.machineName`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>機械名</FormLabel>
                      <FormControl>
                        <Input placeholder="例: クレーン" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name={`machineUsages.${index}.ownership`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>自社/リース</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value={MACHINE_OWNERSHIP.OWN}>自社</SelectItem>
                            <SelectItem value={MACHINE_OWNERSHIP.LEASE}>リース</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`machineUsages.${index}.spec`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>規格</FormLabel>
                        <FormControl>
                          <Input placeholder="例: 4t" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name={`machineUsages.${index}.operator`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>運転者名</FormLabel>
                        <FormControl>
                          <Input placeholder="運転者名" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`machineUsages.${index}.usageHours`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>使用時間（h）</FormLabel>
                        <FormControl>
                          <Input placeholder="例: 4" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </DynamicSection>

        {/* 個人勤務時間 */}
        <DynamicSection
          title="個人勤務時間（任意）"
          fieldsLength={individualWorkFields.length}
          onAdd={() =>
            appendIndividualWork({
              name: '',
              startTime: '',
              endTime: '',
              workContent: '',
            })
          }
          emptyText="個人別の勤務時間を入れたい場合は行を追加してください"
        >
          {individualWorkFields.map((field, index) => (
            <Card key={field.id} className="border border-border">
              <CardContent className="pt-4 pb-4 space-y-3">
                <RowHeader
                  label={`個人勤務 ${index + 1}`}
                  onDelete={() => removeIndividualWork(index)}
                />
                <FormField
                  control={form.control}
                  name={`individualWorkTimes.${index}.name`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>氏名</FormLabel>
                      <FormControl>
                        <Input placeholder="例: 小林 紀之" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name={`individualWorkTimes.${index}.startTime`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>開始</FormLabel>
                        <FormControl>
                          <Input type="time" {...field} value={field.value ?? ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`individualWorkTimes.${index}.endTime`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>終了</FormLabel>
                        <FormControl>
                          <Input type="time" {...field} value={field.value ?? ''} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name={`individualWorkTimes.${index}.workContent`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>業務内容</FormLabel>
                      <FormControl>
                        <Input placeholder="例: 現場管理" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          ))}
        </DynamicSection>

        {/* 職種別稼動人員（27項目） */}
        <TradeWorkersSection form={form} />

        {/* 労働時間累計 */}
        <Card className="border-dashed">
          <CardContent className="pt-4 pb-4 space-y-3">
            <p className="text-sm font-medium">労働時間累計（任意）</p>
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="laborHoursToday"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>労働本日時間</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        step="0.5"
                        inputMode="decimal"
                        placeholder="例: 104"
                        value={field.value ?? ''}
                        onChange={(e) => {
                          const v = e.target.value;
                          field.onChange(v === '' ? undefined : Number(v));
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="laborHoursCumulative"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>労働延時間 累計</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        step="0.5"
                        inputMode="decimal"
                        placeholder="例: 6248"
                        value={field.value ?? ''}
                        onChange={(e) => {
                          const v = e.target.value;
                          field.onChange(v === '' ? undefined : Number(v));
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

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

        {/* 作業員氏名（カンマまたは改行区切り。Phase 3 名寄せ用） */}
        <FormField
          control={form.control}
          name={`subcontractorWorks.${index}.workerNames`}
          render={({ field }) => {
            const valueArr = (field.value as string[] | undefined) ?? [];
            const text = valueArr.join('\n');
            return (
              <FormItem>
                <FormLabel>作業員氏名（任意・改行区切り）</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="例：山田 太郎&#10;佐藤 次郎"
                    rows={2}
                    value={text}
                    onChange={(e) => {
                      const names = e.target.value
                        .split(/[\n,、]/)
                        .map((s) => s.trim())
                        .filter((s) => s.length > 0);
                      field.onChange(names);
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            );
          }}
        />
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

/**
 * 動的にカード行を追加できるセクションのラッパー。
 * Phase 4 で追加した受入先・持ち出し品・打合せ・使用機器・個人勤務時間を共通化する。
 */
function DynamicSection({
  title,
  fieldsLength,
  onAdd,
  emptyText,
  children,
}: {
  title: string;
  fieldsLength: number;
  onAdd: () => void;
  emptyText: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">{title}</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-[44px] px-4"
          onClick={onAdd}
        >
          <PlusCircle className="h-4 w-4 mr-1" />
          行を追加
        </Button>
      </div>
      {fieldsLength === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-3 bg-muted/30 rounded-md">
          {emptyText}
        </p>
      ) : (
        children
      )}
    </div>
  );
}

/** 行カードのヘッダ（ラベル + 削除ボタン）。共通化用。 */
function RowHeader({
  label,
  onDelete,
}: {
  label: string;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <p className="text-sm text-muted-foreground">{label}</p>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onDelete}
        className="h-11 w-11 text-muted-foreground hover:text-destructive"
        aria-label={`${label} を削除`}
      >
        <Trash2 className="h-5 w-5" />
      </Button>
    </div>
  );
}

/**
 * 職種別稼動人員 27項目の入力セクション。
 * tradeWorkers は Record 型なので useFieldArray は使えず、各職種ごとに
 * Controller (FormField) で 本日/累計 の2フィールドを直接バインドする。
 *
 * UX 配慮: 27 行を一覧表示するとフォームが長くなりすぎるので、
 * 折りたたみ可能（details/summary）にして、入力済みの職種数を見出しに表示する。
 */
function TradeWorkersSection({
  form,
}: {
  form: ReturnType<typeof useForm<CreateFieldReportFormValues>>;
}) {
  const watched = form.watch('tradeWorkers');
  const enteredCount = TRADE_TYPES.reduce((acc, t) => {
    const v = watched?.[t];
    if (v && (v.today > 0 || v.cumulative > 0)) return acc + 1;
    return acc;
  }, 0);

  return (
    <details className="rounded-lg border border-dashed">
      <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium flex items-center justify-between">
        <span>職種別稼動人員（27職種・任意）</span>
        <span className="text-xs text-muted-foreground">
          {enteredCount > 0 ? `${enteredCount} 職種入力済み` : '展開して入力'}
        </span>
      </summary>
      <div className="px-4 pb-4 grid gap-2 sm:grid-cols-2">
        {TRADE_TYPES.map((trade) => (
          <TradeWorkerRow key={trade} form={form} trade={trade} />
        ))}
      </div>
    </details>
  );
}

function TradeWorkerRow({
  form,
  trade,
}: {
  form: ReturnType<typeof useForm<CreateFieldReportFormValues>>;
  trade: TradeType;
}) {
  const value = form.watch(`tradeWorkers.${trade}`);
  const today = value?.today;
  const cumulative = value?.cumulative;

  function update(next: { today?: number; cumulative?: number }) {
    const merged = {
      today: next.today ?? today ?? 0,
      cumulative: next.cumulative ?? cumulative ?? 0,
    };
    // zod の record() 推論型と setValue の期待型のズレを回避するためキャストする。
    // 実体は Partial<Record<TradeType, ...>>。空キーは省略する運用。
    type TradeFormMap = NonNullable<CreateFieldReportFormValues['tradeWorkers']>;
    const current = (form.getValues('tradeWorkers') ?? {}) as TradeFormMap &
      Record<string, { today: number; cumulative: number }>;
    if (merged.today === 0 && merged.cumulative === 0) {
      const { [trade]: _omit, ...rest } = current;
      void _omit;
      form.setValue('tradeWorkers', rest as TradeFormMap, { shouldDirty: true });
    } else {
      const nextMap = { ...current, [trade]: merged } as TradeFormMap;
      form.setValue('tradeWorkers', nextMap, { shouldDirty: true });
    }
  }

  return (
    <div className="grid grid-cols-[1fr_5rem_5rem] gap-2 items-center">
      <span className="text-sm">{TRADE_LABELS[trade]}</span>
      <Input
        type="number"
        inputMode="decimal"
        min={0}
        step="0.5"
        placeholder="本日"
        value={today ?? ''}
        onChange={(e) =>
          update({ today: e.target.value === '' ? 0 : Number(e.target.value) })
        }
        className="h-9"
        aria-label={`${TRADE_LABELS[trade]} 本日`}
      />
      <Input
        type="number"
        inputMode="decimal"
        min={0}
        step="0.5"
        placeholder="累計"
        value={cumulative ?? ''}
        onChange={(e) =>
          update({
            cumulative: e.target.value === '' ? 0 : Number(e.target.value),
          })
        }
        className="h-9"
        aria-label={`${TRADE_LABELS[trade]} 累計`}
      />
    </div>
  );
}
