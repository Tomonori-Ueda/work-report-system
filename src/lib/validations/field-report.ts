import { z } from 'zod/v4';
import {
  EXPENSE_CATEGORY,
  WEATHER,
  CARRY_OUT_CATEGORY,
  MACHINE_OWNERSHIP,
  TRADE_TYPES,
} from '@/types/field-report';

/** 日付文字列バリデーション（YYYY-MM-DD形式） */
const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, '日付形式が不正です（YYYY-MM-DD）');

/** 時刻文字列バリデーション（HH:mm形式、nullable・optional） */
const timeStringNullableSchema = z
  .string()
  .regex(/^\d{2}:\d{2}$/, '時刻形式が不正です（HH:mm）')
  .nullable()
  .optional();

/**
 * 時刻文字列バリデーション（HH:mm形式、optional）
 * フォームのデフォルト値が "" のため、空文字も許容する。
 * Why: optional は undefined を許容するだけで、'' は regex 検証で
 *      落ちてしまい「時刻形式が不正です」エラーになる。
 */
const timeStringOptionalSchema = z
  .union([
    z.string().regex(/^\d{2}:\d{2}$/, '時刻形式が不正です（HH:mm）'),
    z.literal(''),
  ])
  .optional();

/** 協力会社作業記録スキーマ */
export const subcontractorWorkSchema = z
  .object({
    subcontractorId: z.string().nullable(),
    companyName: z.string().min(1, '会社名を入力してください').max(100),
    workerCount: z
      .number({ error: '人数は数値で入力してください' })
      .int('人数は整数で入力してください')
      .min(0, '人数は0以上で入力してください')
      .max(999, '人数が大きすぎます'),
    workContent: z.string().min(1, '作業内容を入力してください').max(500),
    expenseCategory: z.enum(
      [
        EXPENSE_CATEGORY.MATERIAL,
        EXPENSE_CATEGORY.LABOR,
        EXPENSE_CATEGORY.SUBCONTRACT,
        EXPENSE_CATEGORY.OTHER,
      ],
      { error: '経費科目を選択してください' }
    ),
    startTime: timeStringNullableSchema,
    endTime: timeStringNullableSchema,
    /** 作業員氏名（人名単位の照合用） */
    workerNames: z.array(z.string().min(1).max(100)).max(50).optional(),
  })
  .refine(
    (data) => {
      const hasStart = data.startTime != null && data.startTime !== '';
      const hasEnd = data.endTime != null && data.endTime !== '';
      if (hasStart !== hasEnd) return false;
      if (hasStart && hasEnd) {
        return data.endTime! > data.startTime!;
      }
      return true;
    },
    { message: '終了時刻は開始時刻より後にしてください', path: ['endTime'] }
  );

/** 資材搬入記録スキーマ */
export const materialDeliverySchema = z.object({
  materialName: z.string().min(1, '材料名を入力してください').max(100),
  quantity: z.string().min(1, '数量を入力してください').max(50),
});

/** 工程内検査スキーマ */
export const processInspectionSchema = z.object({
  foundation_pile: z.boolean(),
  rebar: z.boolean(),
  formwork: z.boolean(),
  concrete: z.boolean(),
  roof: z.boolean(),
  exterior_wall: z.boolean(),
  internal_waterproof: z.boolean(),
  electrical: z.boolean(),
  plumbing: z.boolean(),
  roof_waterproof: z.boolean(),
  interior: z.boolean(),
  notes: z.string().max(500),
});

/** 受入先スキーマ */
export const receiveItemSchema = z.object({
  receiver: z.string().max(100),
  itemName: z.string().max(100),
  quantity: z.string().max(50),
  unit: z.string().max(20),
});

/** 持ち出し品スキーマ */
export const carryOutItemSchema = z.object({
  itemName: z.string().max(100),
  quantity: z.string().max(50),
  category: z.enum(
    [
      CARRY_OUT_CATEGORY.BORROW,
      CARRY_OUT_CATEGORY.RETURN,
      CARRY_OUT_CATEGORY.CONSUME,
    ],
    { error: '区分を選択してください' }
  ),
});

/** 打合せ記録スキーマ */
export const meetingRecordSchema = z.object({
  partner: z.string().max(100),
  topic: z.string().max(500),
});

/** 使用機器スキーマ */
export const machineUsageSchema = z.object({
  machineName: z.string().max(100),
  ownership: z.enum([MACHINE_OWNERSHIP.OWN, MACHINE_OWNERSHIP.LEASE], {
    error: '所有区分を選択してください',
  }),
  spec: z.string().max(100),
  operator: z.string().max(100),
  usageHours: z.string().max(20),
});

/** 個人勤務時間スキーマ */
export const individualWorkTimeSchema = z.object({
  name: z.string().max(100),
  startTime: z.union([
    z.string().regex(/^\d{2}:\d{2}$/),
    z.literal(''),
  ]),
  endTime: z.union([
    z.string().regex(/^\d{2}:\d{2}$/),
    z.literal(''),
  ]),
  workContent: z.string().max(200),
});

/** 自社作業員スキーマ */
export const ownEmployeeSchema = z.object({
  userId: z.string().nullable(),
  displayName: z.string().min(1, '氏名を入力してください').max(100),
  workContent: z.string().max(500),
  startTime: timeStringNullableSchema,
  endTime: timeStringNullableSchema,
});

/**
 * 職種別人員エントリ（today / cumulative とも個別 optional）
 * Why: 入力 UX を独立バインド方式にするため、片方だけ入力された途中状態も
 *      RHF の resolver で受理できる必要がある。最終的に Firestore 書き込み前に
 *      pruneUndefinedTradeWorkers が「両方 undefined / 両方 0」のエントリを削除し、
 *      残ったエントリは欠けた側を 0 で埋める。
 */
const tradeWorkerEntrySchema = z.object({
  today: z.number().int().min(0).max(999).optional(),
  cumulative: z.number().int().min(0).max(99999).optional(),
});

// 各エントリ自体も optional にする。
// Why: zod 4 の `z.record(enum, schema)` は「全キー必須」と解釈されるため、
//      入力されていない職種があると `expected object, received undefined` で
//      400 エラーになり Phase 2/4 全フィールドが API で破棄されていた。
// NOTE: zod 4 + record + optional 値の出力は「全27キー（一部値が undefined）」になる。
//       Firestore Admin SDK は undefined を拒否するため、保存前に
//       API 側で `pruneUndefinedTradeWorkers` を通す必要がある（Resolver 互換性
//       の都合で transform をスキーマに含められないため）。
export const tradeWorkersSchema = z
  .record(z.enum(TRADE_TYPES), tradeWorkerEntrySchema.optional())
  .optional();

/** 入力途中の片埋まりエントリ */
type TradeWorkerEntryPartial = {
  today?: number;
  cumulative?: number;
};

/**
 * tradeWorkers を Firestore 書き込み形式（{today:number, cumulative:number}）に正規化する。
 *
 * - undefined 値のキーは除去（zod 4 の record + optional は全 27 キーを返すため）
 * - 「today も cumulative も未入力」または「両方 0」のエントリは保存しない
 * - 片方だけ入力されたエントリは、欠けた側を 0 で埋めて保存する
 *
 * Why:
 *  - Firestore Admin SDK は undefined を弾く（Cannot use "undefined" as a Firestore value）
 *  - エントリ型は最終的に {today:number, cumulative:number} に揃えたい
 */
export function pruneUndefinedTradeWorkers(
  value:
    | Partial<Record<string, TradeWorkerEntryPartial | undefined>>
    | undefined,
): Partial<Record<string, { today: number; cumulative: number }>> | undefined {
  if (!value) return value;
  const cleaned: Record<string, { today: number; cumulative: number }> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (entry === undefined) continue;
    const today = entry.today ?? 0;
    const cumulative = entry.cumulative ?? 0;
    if (today === 0 && cumulative === 0) continue;
    cleaned[key] = { today, cumulative };
  }
  return cleaned;
}

/** 現場日報作成スキーマ（Phase 2 拡張版） */
export const createFieldReportSchema = z.object({
  // 既存
  siteId: z.string().min(1, '現場を選択してください'),
  siteName: z.string().min(1, '現場名を入力してください').max(100),
  reportDate: dateStringSchema,
  weather: z.enum([WEATHER.SUNNY, WEATHER.CLOUDY, WEATHER.RAINY, WEATHER.SNOWY], {
    error: '天候を選択してください',
  }),
  subcontractorWorks: z
    .array(subcontractorWorkSchema)
    .min(1, '協力会社作業記録を1件以上入力してください'),
  materialDeliveries: z.array(materialDeliverySchema),
  notes: z.string().max(1000, '備考は1000文字以内で入力してください').optional(),

  // === Phase 2 拡張（すべて optional・既存リクエストは引き続き有効） ===
  projectName: z.string().max(200).optional(),
  siteResponsible: z.string().max(100).optional(),
  supervisorWorkStart: timeStringOptionalSchema,
  supervisorWorkEnd: timeStringOptionalSchema,
  workTimeStart: timeStringOptionalSchema,
  processInspection: processInspectionSchema.optional(),
  receiveItems: z.array(receiveItemSchema).max(30).optional(),
  carryOutItems: z.array(carryOutItemSchema).max(30).optional(),
  meetingRecords: z.array(meetingRecordSchema).max(30).optional(),
  machineUsages: z.array(machineUsageSchema).max(30).optional(),
  individualWorkTimes: z.array(individualWorkTimeSchema).max(50).optional(),
  ownEmployees: z.array(ownEmployeeSchema).max(50).optional(),
  tradeWorkers: tradeWorkersSchema,
  laborHoursToday: z.number().min(0).max(99999).optional(),
  laborHoursCumulative: z.number().min(0).max(9999999).optional(),
});

export type CreateFieldReportFormValues = z.infer<typeof createFieldReportSchema>;

/** 現場日報フィルタ型 */
export interface FieldReportFilter {
  supervisorId?: string;
  siteId?: string;
  startDate?: string;
  endDate?: string;
}
