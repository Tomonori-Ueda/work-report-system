import { z } from 'zod/v4';
import { LEAVE_TYPE } from '@/types/leave';

/** 有給申請作成スキーマ */
export const createLeaveRequestSchema = z.object({
  leaveDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, '日付形式が不正です（YYYY-MM-DD）'),
  leaveType: z.enum([LEAVE_TYPE.PAID, LEAVE_TYPE.SPECIAL, LEAVE_TYPE.UNPAID], {
    error: '休暇種別を選択してください',
  }),
  reason: z.string().max(500, '500文字以内で入力してください').optional(),
});

export type CreateLeaveRequestFormValues = z.infer<
  typeof createLeaveRequestSchema
>;

/** 有給申請承認/却下スキーマ */
export const approveLeaveRequestSchema = z.object({
  action: z.enum(['approved', 'rejected'], {
    error: '承認または却下を選択してください',
  }),
  rejectReason: z
    .string()
    .max(500, '500文字以内で入力してください')
    .optional(),
});

export type ApproveLeaveRequestFormValues = z.infer<
  typeof approveLeaveRequestSchema
>;
