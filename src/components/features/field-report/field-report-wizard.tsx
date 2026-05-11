'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm, useFieldArray, type FieldPath } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, PlusCircle, Trash2 } from 'lucide-react';
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
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useCreateFieldReport,
  useUpdateFieldReport,
} from '@/hooks/use-field-reports';
import { getIdToken } from '@/lib/firebase/auth';
import {
  createFieldReportSchema,
  pruneUndefinedTradeWorkers,
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

interface SiteMaster {
  id: string;
  siteName: string;
}
interface SubcontractorMaster {
  id: string;
  companyName: string;
}

const WEATHER_LABELS: Record<Weather, string> = {
  [WEATHER.SUNNY]: '晴れ',
  [WEATHER.CLOUDY]: '曇り',
  [WEATHER.RAINY]: '雨',
  [WEATHER.SNOWY]: '雪',
};

const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  [EXPENSE_CATEGORY.MATERIAL]: '材料費',
  [EXPENSE_CATEGORY.LABOR]: '労務費',
  [EXPENSE_CATEGORY.SUBCONTRACT]: '外注費',
  [EXPENSE_CATEGORY.OTHER]: '経費',
};

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

interface FieldReportWizardProps {
  defaultReport?: FieldReport;
  reportId?: string;
}

interface Step {
  /** 進捗バー表示用ラベル */
  title: string;
  /** ステップが任意（スキップ可）か */
  optional: boolean;
  /** 「次へ」押下時に検証する schema フィールドのパス */
  validateFields?: FieldPath<CreateFieldReportFormValues>[];
  /** 表示コンポーネント（form を受け取る） */
  render: (ctx: WizardCtx) => React.ReactNode;
}

interface WizardCtx {
  form: ReturnType<typeof useForm<CreateFieldReportFormValues>>;
  sites: SiteMaster[];
  subcontractors: SubcontractorMaster[];
}

/**
 * 対話型ウィザード。13ステップで現場日報を作成する。
 * Why: 既存の縦長フォームは項目が多くスクロールが大変。1画面1セクションで
 *      対話的に進められると入力負荷を減らせる。
 *
 * 設計:
 * - 単一の useForm でフォーム状態を保持。各ステップは該当部分だけ表示する。
 * - 「次へ」押下時に該当フィールドのみ trigger() し、検証成功でステップを進める。
 * - 「スキップ」は任意ステップで表示し、検証なしで次へ。
 * - 最終ステップで全体検証 + API 送信。失敗時は元のステップへ自動で戻る。
 */
export function FieldReportWizard({
  defaultReport,
  reportId,
}: FieldReportWizardProps) {
  const router = useRouter();
  const createFieldReport = useCreateFieldReport();
  const updateFieldReport = useUpdateFieldReport();

  const [sites, setSites] = useState<SiteMaster[]>([]);
  const [subcontractors, setSubcontractors] = useState<SubcontractorMaster[]>(
    []
  );
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    void (async () => {
      const token = await getIdToken();
      const headers: HeadersInit = token
        ? { Authorization: `Bearer ${token}` }
        : {};
      type SitesRes = { data: { sites: SiteMaster[] } };
      type SubsRes = { data: { subcontractors: SubcontractorMaster[] } };
      await Promise.allSettled([
        fetch('/api/masters/sites?active=true', { headers })
          .then((r) => (r.ok ? r.json() : null))
          .then((j: unknown) => {
            const t = j as SitesRes | null;
            if (t?.data?.sites) setSites(t.data.sites);
          }),
        fetch('/api/masters/subcontractors?active=true', { headers })
          .then((r) => (r.ok ? r.json() : null))
          .then((j: unknown) => {
            const t = j as SubsRes | null;
            if (t?.data?.subcontractors)
              setSubcontractors(t.data.subcontractors);
          }),
      ]);
    })();
  }, []);

  const form = useForm<CreateFieldReportFormValues>({
    resolver: zodResolver(createFieldReportSchema),
    defaultValues: {
      reportDate: defaultReport?.reportDate ?? formatDateToISO(new Date()),
      weather: defaultReport?.weather ?? WEATHER.SUNNY,
      siteId: defaultReport?.siteId ?? '',
      siteName: defaultReport?.siteName ?? '',
      subcontractorWorks:
        defaultReport?.subcontractorWorks &&
          defaultReport.subcontractorWorks.length > 0
          ? defaultReport.subcontractorWorks.map((w) => ({
            ...w,
            startTime: w.startTime ?? null,
            endTime: w.endTime ?? null,
            workerNames: w.workerNames ?? [],
          }))
          : [
            {
              subcontractorId: null,
              companyName: '',
              workerCount: 0,
              workContent: '',
              expenseCategory: EXPENSE_CATEGORY.LABOR,
              startTime: undefined,
              endTime: undefined,
              workerNames: [],
            },
          ],
      materialDeliveries: defaultReport?.materialDeliveries ?? [],
      notes: defaultReport?.notes ?? '',
      projectName: defaultReport?.projectName ?? '',
      siteResponsible: defaultReport?.siteResponsible ?? '',
      supervisorWorkStart: defaultReport?.supervisorWorkStart ?? '',
      supervisorWorkEnd: defaultReport?.supervisorWorkEnd ?? '',
      workTimeStart: defaultReport?.workTimeStart ?? '',
      processInspection:
        defaultReport?.processInspection ?? createEmptyProcessInspection(),
      ownEmployees: defaultReport?.ownEmployees ?? [],
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

  const ctx: WizardCtx = { form, sites, subcontractors };

  const steps = useMemo(() => buildSteps(), []);
  const total = steps.length;
  const current = steps[stepIndex];
  const isLast = stepIndex === total - 1;

  /** 次へ: 該当フィールドだけ検証して進める */
  async function goNext() {
    if (!current) return;
    if (current.validateFields && current.validateFields.length > 0) {
      const ok = await form.trigger(current.validateFields);
      if (!ok) {
        toast.error('入力内容に不正があります。修正してから次へ進んでください。');
        return;
      }
    }
    setStepIndex((i) => Math.min(total - 1, i + 1));
  }

  /** スキップ: 検証なしで次へ */
  function goSkip() {
    setStepIndex((i) => Math.min(total - 1, i + 1));
  }

  function goBack() {
    setStepIndex((i) => Math.max(0, i - 1));
  }

  /** 確認ステップで「保存する」 */
  async function handleSave() {
    const ok = await form.trigger();
    if (!ok) {
      const firstErrorPath = findFirstErrorPath(form.formState.errors);
      const firstErrorMsg = findFirstErrorMessage(form.formState.errors);
      toast.error(
        firstErrorMsg
          ? `入力エラー: ${firstErrorMsg}（${firstErrorPath ?? ''}）`
          : '入力に不備があります。前のステップに戻って修正してください。'
      );
      return;
    }
    const values = form.getValues();
    const cleaned: CreateFieldReportFormValues = {
      ...values,
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
    };
    const payload = {
      ...cleaned,
      tradeWorkers: pruneUndefinedTradeWorkers(cleaned.tradeWorkers),
    };
    try {
      if (reportId) {
        await updateFieldReport.mutateAsync({ id: reportId, data: payload });
        toast.success('現場日報を更新しました');
      } else {
        await createFieldReport.mutateAsync(payload);
        toast.success('現場日報を保存しました');
      }
      router.push('/field-report/history');
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : '現場日報の保存に失敗しました'
      );
    }
  }

  if (!current) return null;

  const progressPct = ((stepIndex + 1) / total) * 100;
  const isSubmitting =
    createFieldReport.isPending || updateFieldReport.isPending;

  return (
    <Form {...form}>
      <div className="space-y-4">
        {/* 進捗バー */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">
              ステップ {stepIndex + 1} / {total}
            </span>
            <span className="text-muted-foreground">{current.title}</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* 現在のステップ */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{current.title}</CardTitle>
          </CardHeader>
          <CardContent>{current.render(ctx)}</CardContent>
        </Card>

        {/* ナビゲーション */}
        <div className="flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={goBack}
            disabled={stepIndex === 0 || isSubmitting}
            className="min-h-[44px]"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            戻る
          </Button>

          <div className="flex items-center gap-2">
            {current.optional && !isLast && (
              <Button
                type="button"
                variant="ghost"
                onClick={goSkip}
                disabled={isSubmitting}
                className="min-h-[44px]"
              >
                スキップ
              </Button>
            )}
            {isLast ? (
              <Button
                type="button"
                onClick={() => void handleSave()}
                disabled={isSubmitting}
                className="min-h-[44px] min-w-[120px]"
              >
                {isSubmitting ? '保存中...' : reportId ? '更新する' : '保存する'}
              </Button>
            ) : (
              <Button
                type="button"
                onClick={() => void goNext()}
                disabled={isSubmitting}
                className="min-h-[44px]"
              >
                次へ
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </Form>
  );
}

// ============================================================
// ステップ定義
// ============================================================
function buildSteps(): Step[] {
  return [
    {
      title: '基本情報（日付・天候・現場）',
      optional: false,
      validateFields: ['reportDate', 'weather', 'siteId', 'siteName'],
      render: (c) => <Step1Basic {...c} />,
    },
    {
      title: '工事名・現場責任者（任意）',
      optional: true,
      validateFields: ['projectName', 'siteResponsible'],
      render: (c) => <Step2Project {...c} />,
    },
    {
      title: '監督勤務時間（任意）',
      optional: true,
      validateFields: [
        'supervisorWorkStart',
        'supervisorWorkEnd',
        'workTimeStart',
      ],
      render: (c) => <Step3SupTime {...c} />,
    },
    {
      title: '協力会社（必須）',
      optional: false,
      validateFields: ['subcontractorWorks'],
      render: (c) => <Step4Subcontractors {...c} />,
    },
    {
      title: '自社作業員（任意）',
      optional: true,
      validateFields: ['ownEmployees'],
      render: (c) => <Step5OwnEmployees {...c} />,
    },
    {
      title: '工程内検査（任意）',
      optional: true,
      validateFields: ['processInspection'],
      render: (c) => <Step6Inspection {...c} />,
    },
    {
      title: '受入先（外注工事含む・任意）',
      optional: true,
      validateFields: ['receiveItems'],
      render: (c) => <Step7ReceiveItems {...c} />,
    },
    {
      title: '持ち出し品（任意）',
      optional: true,
      validateFields: ['carryOutItems'],
      render: (c) => <Step8CarryOut {...c} />,
    },
    {
      title: '打合せ記録（任意）',
      optional: true,
      validateFields: ['meetingRecords'],
      render: (c) => <Step9Meetings {...c} />,
    },
    {
      title: '使用機器（任意）',
      optional: true,
      validateFields: ['machineUsages'],
      render: (c) => <Step10Machines {...c} />,
    },
    {
      title: '個人勤務時間（任意）',
      optional: true,
      validateFields: ['individualWorkTimes'],
      render: (c) => <Step11Individual {...c} />,
    },
    {
      title: '職種別稼動人員 + 労働時間累計（任意）',
      optional: true,
      validateFields: ['tradeWorkers', 'laborHoursToday', 'laborHoursCumulative'],
      render: (c) => <Step12Trade {...c} />,
    },
    {
      title: '備考と確認',
      optional: false,
      render: (c) => <Step13Confirm {...c} />,
    },
  ];
}

// ============================================================
// ステップごとのレンダラ
// ============================================================
function Step1Basic({ form, sites }: WizardCtx) {
  const siteId = form.watch('siteId');
  return (
    <div className="space-y-4">
      <FormField
        control={form.control}
        name="reportDate"
        render={({ field }) => (
          <FormItem>
            <FormLabel>日付</FormLabel>
            <FormControl>
              <Input type="date" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="weather"
        render={({ field }) => (
          <FormItem>
            <FormLabel>天候</FormLabel>
            <Select value={field.value} onValueChange={field.onChange}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="天候" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {(Object.entries(WEATHER_LABELS) as [Weather, string][]).map(
                  ([v, l]) => (
                    <SelectItem key={v} value={v}>
                      {l}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
      {sites.length > 0 ? (
        <FormItem>
          <FormLabel>現場名</FormLabel>
          <Select
            value={siteId || ''}
            onValueChange={(v) => {
              if (v === '__other__') {
                form.setValue('siteId', '');
                form.setValue('siteName', '');
              } else {
                const site = sites.find((s) => s.id === v);
                form.setValue('siteId', v);
                form.setValue('siteName', site?.siteName ?? '');
              }
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="現場を選択" />
            </SelectTrigger>
            <SelectContent>
              {sites.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.siteName}
                </SelectItem>
              ))}
              <SelectItem value="__other__">その他（手入力）</SelectItem>
            </SelectContent>
          </Select>
          {form.formState.errors.siteId && (
            <p className="text-sm text-destructive">
              {form.formState.errors.siteId.message}
            </p>
          )}
        </FormItem>
      ) : null}
      {(!siteId || sites.length === 0) && (
        <FormField
          control={form.control}
          name="siteName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>現場名（手入力）</FormLabel>
              <FormControl>
                <Input placeholder="現場名" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )}
    </div>
  );
}

function Step2Project({ form }: WizardCtx) {
  return (
    <div className="space-y-4">
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
    </div>
  );
}

function Step3SupTime({ form }: WizardCtx) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <FormField
          control={form.control}
          name="supervisorWorkStart"
          render={({ field }) => (
            <FormItem>
              <FormLabel>監督勤務開始</FormLabel>
              <FormControl>
                <Input type="time" {...field} value={field.value ?? ''} />
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
                <Input type="time" {...field} value={field.value ?? ''} />
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
              <Input type="time" {...field} value={field.value ?? ''} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}

function Step4Subcontractors({ form, subcontractors }: WizardCtx) {
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'subcontractorWorks',
  });
  return (
    <div className="space-y-3">
      {fields.map((f, index) => (
        <Card key={f.id} className="border">
          <CardContent className="pt-4 pb-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                協力会社 {index + 1}
              </p>
              {fields.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => remove(index)}
                  aria-label={`協力会社 ${index + 1} を削除`}
                >
                  <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                </Button>
              )}
            </div>
            {subcontractors.length > 0 && (
              <FormItem>
                <FormLabel>協力会社</FormLabel>
                <Select
                  value={
                    form.watch(`subcontractorWorks.${index}.subcontractorId`) ??
                    '__other__'
                  }
                  onValueChange={(v) => {
                    if (v === '__other__') {
                      form.setValue(
                        `subcontractorWorks.${index}.subcontractorId`,
                        null
                      );
                      form.setValue(
                        `subcontractorWorks.${index}.companyName`,
                        ''
                      );
                    } else {
                      const s = subcontractors.find((x) => x.id === v);
                      form.setValue(
                        `subcontractorWorks.${index}.subcontractorId`,
                        v
                      );
                      form.setValue(
                        `subcontractorWorks.${index}.companyName`,
                        s?.companyName ?? ''
                      );
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="協力会社" />
                  </SelectTrigger>
                  <SelectContent>
                    {subcontractors.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.companyName}
                      </SelectItem>
                    ))}
                    <SelectItem value="__other__">その他（手入力）</SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
            )}
            <FormField
              control={form.control}
              name={`subcontractorWorks.${index}.companyName`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>会社名</FormLabel>
                  <FormControl>
                    <Input placeholder="会社名" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-3">
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
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name={`subcontractorWorks.${index}.expenseCategory`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>経費科目</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(
                          Object.entries(EXPENSE_CATEGORY_LABELS) as [
                            ExpenseCategory,
                            string,
                          ][]
                        ).map(([v, l]) => (
                          <SelectItem key={v} value={v}>
                            {l}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name={`subcontractorWorks.${index}.workContent`}
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
            <FormField
              control={form.control}
              name={`subcontractorWorks.${index}.workerNames`}
              render={({ field }) => {
                const arr = (field.value as string[] | undefined) ?? [];
                return (
                  <FormItem>
                    <FormLabel>作業員氏名（任意・改行区切り）</FormLabel>
                    <FormControl>
                      <Textarea
                        rows={2}
                        value={arr.join('\n')}
                        onChange={(e) => {
                          const names = e.target.value
                            .split(/[\n,、]/)
                            .map((s) => s.trim())
                            .filter(Boolean);
                          field.onChange(names);
                        }}
                      />
                    </FormControl>
                  </FormItem>
                );
              }}
            />
          </CardContent>
        </Card>
      ))}
      <Button
        type="button"
        variant="outline"
        onClick={() =>
          append({
            subcontractorId: null,
            companyName: '',
            workerCount: 0,
            workContent: '',
            expenseCategory: EXPENSE_CATEGORY.LABOR,
            startTime: undefined,
            endTime: undefined,
            workerNames: [],
          })
        }
        className="w-full min-h-[44px]"
      >
        <PlusCircle className="h-4 w-4 mr-1" />
        協力会社を追加
      </Button>
    </div>
  );
}

function Step5OwnEmployees({ form }: WizardCtx) {
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'ownEmployees',
  });
  return (
    <div className="space-y-3">
      {fields.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-3 bg-muted/30 rounded-md">
          自社（直営）作業員がいる場合は追加してください
        </p>
      )}
      {fields.map((f, index) => (
        <Card key={f.id} className="border">
          <CardContent className="pt-4 pb-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                自社作業員 {index + 1}
              </p>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => remove(index)}
              >
                <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
              </Button>
            </div>
            <FormField
              control={form.control}
              name={`ownEmployees.${index}.displayName`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>氏名</FormLabel>
                  <FormControl>
                    <Input placeholder="氏名" {...field} />
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
          </CardContent>
        </Card>
      ))}
      <Button
        type="button"
        variant="outline"
        onClick={() =>
          append({
            userId: null,
            displayName: '',
            workContent: '',
            startTime: null,
            endTime: null,
          })
        }
        className="w-full min-h-[44px]"
      >
        <PlusCircle className="h-4 w-4 mr-1" />
        自社作業員を追加
      </Button>
    </div>
  );
}

function Step6Inspection({ form }: WizardCtx) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
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
              <Textarea rows={3} {...field} value={field.value ?? ''} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}

function Step7ReceiveItems({ form }: WizardCtx) {
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'receiveItems',
  });
  return (
    <div className="space-y-3">
      {fields.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-3 bg-muted/30 rounded-md">
          受入があれば追加してください
        </p>
      )}
      {fields.map((f, i) => (
        <Card key={f.id} className="border">
          <CardContent className="pt-4 pb-4 space-y-3">
            <RowHead i={i} label="受入" onDel={() => remove(i)} />
            <FormField
              control={form.control}
              name={`receiveItems.${i}.receiver`}
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
              name={`receiveItems.${i}.itemName`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>品名</FormLabel>
                  <FormControl>
                    <Input placeholder="例: ガラス" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name={`receiveItems.${i}.quantity`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>数量</FormLabel>
                    <FormControl>
                      <Input placeholder="1" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name={`receiveItems.${i}.unit`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>単位</FormLabel>
                    <FormControl>
                      <Input placeholder="式" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>
      ))}
      <Button
        type="button"
        variant="outline"
        onClick={() =>
          append({ receiver: '', itemName: '', quantity: '', unit: '' })
        }
        className="w-full min-h-[44px]"
      >
        <PlusCircle className="h-4 w-4 mr-1" />
        受入を追加
      </Button>
    </div>
  );
}

function Step8CarryOut({ form }: WizardCtx) {
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'carryOutItems',
  });
  return (
    <div className="space-y-3">
      {fields.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-3 bg-muted/30 rounded-md">
          会社資材・機材・備品の持ち出しがあれば追加してください
        </p>
      )}
      {fields.map((f, i) => (
        <Card key={f.id} className="border">
          <CardContent className="pt-4 pb-4 space-y-3">
            <RowHead i={i} label="持ち出し品" onDel={() => remove(i)} />
            <FormField
              control={form.control}
              name={`carryOutItems.${i}.itemName`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>名称</FormLabel>
                  <FormControl>
                    <Input placeholder="例: 電動ドリル" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name={`carryOutItems.${i}.quantity`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>数量</FormLabel>
                    <FormControl>
                      <Input placeholder="例: 1台" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name={`carryOutItems.${i}.category`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>区分</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={CARRY_OUT_CATEGORY.BORROW}>
                          借入
                        </SelectItem>
                        <SelectItem value={CARRY_OUT_CATEGORY.RETURN}>
                          返却
                        </SelectItem>
                        <SelectItem value={CARRY_OUT_CATEGORY.CONSUME}>
                          消却
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>
      ))}
      <Button
        type="button"
        variant="outline"
        onClick={() =>
          append({
            itemName: '',
            quantity: '',
            category: CARRY_OUT_CATEGORY.BORROW,
          })
        }
        className="w-full min-h-[44px]"
      >
        <PlusCircle className="h-4 w-4 mr-1" />
        持ち出し品を追加
      </Button>
    </div>
  );
}

function Step9Meetings({ form }: WizardCtx) {
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'meetingRecords',
  });
  return (
    <div className="space-y-3">
      {fields.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-3 bg-muted/30 rounded-md">
          打合せがあれば追加してください
        </p>
      )}
      {fields.map((f, i) => (
        <Card key={f.id} className="border">
          <CardContent className="pt-4 pb-4 space-y-3">
            <RowHead i={i} label="打合せ" onDel={() => remove(i)} />
            <FormField
              control={form.control}
              name={`meetingRecords.${i}.partner`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>相手先</FormLabel>
                  <FormControl>
                    <Input placeholder="例: 建主" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name={`meetingRecords.${i}.topic`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>項目・対策</FormLabel>
                  <FormControl>
                    <Textarea rows={2} {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>
      ))}
      <Button
        type="button"
        variant="outline"
        onClick={() => append({ partner: '', topic: '' })}
        className="w-full min-h-[44px]"
      >
        <PlusCircle className="h-4 w-4 mr-1" />
        打合せを追加
      </Button>
    </div>
  );
}

function Step10Machines({ form }: WizardCtx) {
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'machineUsages',
  });
  return (
    <div className="space-y-3">
      {fields.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-3 bg-muted/30 rounded-md">
          使用機器があれば追加してください
        </p>
      )}
      {fields.map((f, i) => (
        <Card key={f.id} className="border">
          <CardContent className="pt-4 pb-4 space-y-3">
            <RowHead i={i} label="機器" onDel={() => remove(i)} />
            <FormField
              control={form.control}
              name={`machineUsages.${i}.machineName`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>機械名</FormLabel>
                  <FormControl>
                    <Input placeholder="例: クレーン" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name={`machineUsages.${i}.ownership`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>区分</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={MACHINE_OWNERSHIP.OWN}>
                          自社
                        </SelectItem>
                        <SelectItem value={MACHINE_OWNERSHIP.LEASE}>
                          リース
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name={`machineUsages.${i}.spec`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>規格</FormLabel>
                    <FormControl>
                      <Input placeholder="例: 4t" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name={`machineUsages.${i}.operator`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>運転者名</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name={`machineUsages.${i}.usageHours`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>使用時間（h）</FormLabel>
                    <FormControl>
                      <Input placeholder="4" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>
      ))}
      <Button
        type="button"
        variant="outline"
        onClick={() =>
          append({
            machineName: '',
            ownership: MACHINE_OWNERSHIP.OWN,
            spec: '',
            operator: '',
            usageHours: '',
          })
        }
        className="w-full min-h-[44px]"
      >
        <PlusCircle className="h-4 w-4 mr-1" />
        機器を追加
      </Button>
    </div>
  );
}

function Step11Individual({ form }: WizardCtx) {
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'individualWorkTimes',
  });
  return (
    <div className="space-y-3">
      {fields.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-3 bg-muted/30 rounded-md">
          個人別の勤務時間を入れたい場合は追加してください
        </p>
      )}
      {fields.map((f, i) => (
        <Card key={f.id} className="border">
          <CardContent className="pt-4 pb-4 space-y-3">
            <RowHead i={i} label="個人勤務" onDel={() => remove(i)} />
            <FormField
              control={form.control}
              name={`individualWorkTimes.${i}.name`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>氏名</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name={`individualWorkTimes.${i}.startTime`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>開始</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} value={field.value ?? ''} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name={`individualWorkTimes.${i}.endTime`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>終了</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} value={field.value ?? ''} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name={`individualWorkTimes.${i}.workContent`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>業務内容</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>
      ))}
      <Button
        type="button"
        variant="outline"
        onClick={() =>
          append({ name: '', startTime: '', endTime: '', workContent: '' })
        }
        className="w-full min-h-[44px]"
      >
        <PlusCircle className="h-4 w-4 mr-1" />
        個人勤務を追加
      </Button>
    </div>
  );
}

function Step12Trade({ form }: WizardCtx) {
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        値が 0 の職種は保存時に自動的に省略されます
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {TRADE_TYPES.map((trade) => (
          <TradeRow key={trade} form={form} trade={trade} />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 pt-3 border-t">
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
    </div>
  );
}

/**
 * 職種別人員 1 行の入力。
 * 本日・累計の 2 入力欄は独立した FormField でバインドし、片方の入力が
 * もう片方の値を上書きしないようにする（旧実装は setValue で全体を毎回置換していた）。
 * 「両方 0/未入力」のエントリは保存時に pruneUndefinedTradeWorkers が削除する。
 */
function TradeRow({
  form,
  trade,
}: {
  form: ReturnType<typeof useForm<CreateFieldReportFormValues>>;
  trade: TradeType;
}) {
  return (
    <div className="grid grid-cols-[1fr_5rem_5rem] gap-2 items-center">
      <span className="text-sm">{TRADE_LABELS[trade]}</span>
      <FormField
        control={form.control}
        name={`tradeWorkers.${trade}.today`}
        render={({ field }) => (
          <Input
            type="number"
            min={0}
            placeholder="本日"
            value={field.value ?? ''}
            onChange={(e) => {
              const v = e.target.value;
              field.onChange(v === '' ? undefined : Number(v));
            }}
            className="h-9"
            aria-label={`${TRADE_LABELS[trade]} 本日`}
          />
        )}
      />
      <FormField
        control={form.control}
        name={`tradeWorkers.${trade}.cumulative`}
        render={({ field }) => (
          <Input
            type="number"
            min={0}
            placeholder="累計"
            value={field.value ?? ''}
            onChange={(e) => {
              const v = e.target.value;
              field.onChange(v === '' ? undefined : Number(v));
            }}
            className="h-9"
            aria-label={`${TRADE_LABELS[trade]} 累計`}
          />
        )}
      />
    </div>
  );
}

function Step13Confirm({ form }: WizardCtx) {
  const v = form.watch();
  return (
    <div className="space-y-4 text-sm">
      <FormField
        control={form.control}
        name="notes"
        render={({ field }) => (
          <FormItem>
            <FormLabel>備考（任意）</FormLabel>
            <FormControl>
              <Textarea rows={3} {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <div className="rounded-md border p-3 bg-muted/30 space-y-1 text-xs">
        <p className="font-medium text-sm">入力内容サマリ</p>
        <p>日付: {v.reportDate} / 天候: {WEATHER_LABELS[v.weather as Weather]}</p>
        <p>現場: {v.siteName || '—'}</p>
        {v.projectName && <p>工事名: {v.projectName}</p>}
        {v.siteResponsible && <p>現場責任者: {v.siteResponsible}</p>}
        <p>協力会社: {v.subcontractorWorks?.length ?? 0} 社</p>
        <p>自社作業員: {v.ownEmployees?.length ?? 0} 名</p>
        <p>
          職種別人員入力: {Object.keys(v.tradeWorkers ?? {}).length} 職種
        </p>
        {v.laborHoursToday !== undefined && (
          <p>労働本日: {v.laborHoursToday} 時間</p>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        「保存する」を押すと現場日報が登録されます。
      </p>
    </div>
  );
}

// ============================================================
// 共通コンポーネント
// ============================================================
function RowHead({
  i,
  label,
  onDel,
}: {
  i: number;
  label: string;
  onDel: () => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <p className="text-sm text-muted-foreground">
        {label} {i + 1}
      </p>
      <Button type="button" variant="ghost" size="icon" onClick={onDel}>
        <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
      </Button>
    </div>
  );
}

// ============================================================
// エラー探索ヘルパー（field-report-form と同じ実装）
// ============================================================
function findFirstErrorMessage(errors: unknown): string | null {
  if (errors == null || typeof errors !== 'object') return null;
  const obj = errors as Record<string, unknown>;
  if (typeof obj.message === 'string' && obj.message.length > 0) {
    return obj.message;
  }
  for (const key of Object.keys(obj)) {
    const m = findFirstErrorMessage(obj[key]);
    if (m) return m;
  }
  return null;
}

function findFirstErrorPath(errors: unknown, prefix = ''): string | null {
  if (errors == null || typeof errors !== 'object') return null;
  const obj = errors as Record<string, unknown>;
  if (typeof obj.message === 'string' && obj.message.length > 0) {
    return prefix || null;
  }
  for (const key of Object.keys(obj)) {
    if (key === 'ref' || key === 'type' || key === 'types') continue;
    const next = prefix ? `${prefix}.${key}` : key;
    const p = findFirstErrorPath(obj[key], next);
    if (p) return p;
  }
  return null;
}
