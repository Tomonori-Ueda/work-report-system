import { z } from 'zod/v4';

/** 時刻文字列バリデーション（HH:mm形式） */
const timeStringSchema = z
  .string()
  .regex(
    /^([01]\d|2[0-3]):[0-5]\d$/,
    '有効な時刻を入力してください（HH:mm）'
  );

/** 日付文字列バリデーション（YYYY-MM-DD形式） */
const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, '日付形式が不正です（YYYY-MM-DD）');

/** 時間帯別作業エントリのスキーマ */
const workEntrySchema = z
  .object({
    startTime: timeStringSchema,
    endTime: timeStringSchema,
    content: z
      .string()
      .min(1, '作業内容を入力してください')
      .max(500, '500文字以内で入力してください'),
  })
  .refine((data) => data.startTime < data.endTime, {
    message: '終了時刻は開始時刻より後にしてください',
    path: ['endTime'],
  });

/** 日報作成スキーマ */
export const createReportSchema = z
  .object({
    reportDate: dateStringSchema,
    startTime: timeStringSchema,
    endTime: timeStringSchema,
    workEntries: z
      .array(workEntrySchema)
      .min(1, '作業内容を1つ以上入力してください'),
    notes: z.string().max(500, '500文字以内で入力してください').optional(),
  })
  .refine((data) => data.startTime < data.endTime, {
    message: '終了時刻は開始時刻より後にしてください',
    path: ['endTime'],
  });

export type CreateReportFormValues = z.infer<typeof createReportSchema>;

/** 日報差し戻しスキーマ */
export const rejectReportSchema = z.object({
  rejectReason: z
    .string()
    .min(1, '差し戻し理由を入力してください')
    .max(500, '500文字以内で入力してください'),
});

export type RejectReportFormValues = z.infer<typeof rejectReportSchema>;

/** 一括承認スキーマ */
export const bulkApproveSchema = z.object({
  reportIds: z
    .array(z.string().min(1))
    .min(1, '承認する日報を選択してください'),
});

export type BulkApproveFormValues = z.infer<typeof bulkApproveSchema>;
