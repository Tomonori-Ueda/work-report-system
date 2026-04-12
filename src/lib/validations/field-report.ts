import { z } from 'zod/v4';
import { EXPENSE_CATEGORY, WEATHER } from '@/types/field-report';

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
  })
  .refine(
    (data) => {
      // 開始・終了どちらか一方だけ入力されている場合はエラー
      const hasStart = data.startTime != null && data.startTime !== '';
      const hasEnd = data.endTime != null && data.endTime !== '';
      if (hasStart !== hasEnd) return false;
      // 両方入力済みの場合、終了 > 開始であること
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

/** 現場日報作成スキーマ */
export const createFieldReportSchema = z.object({
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
});

export type CreateFieldReportFormValues = z.infer<typeof createFieldReportSchema>;

/** 現場日報フィルタ型 */
export interface FieldReportFilter {
  supervisorId?: string;
  siteId?: string;
  startDate?: string;
  endDate?: string;
}
