import { z } from 'zod/v4';
import { LEAVE_TYPE, LEAVE_UNIT } from '@/types/leave';

/** 有給申請作成スキーマ */
export const createLeaveRequestSchema = z
  .object({
    leaveDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, '日付形式が不正です（YYYY-MM-DD）'),
    leaveType: z.enum(
      [LEAVE_TYPE.PAID, LEAVE_TYPE.SPECIAL, LEAVE_TYPE.UNPAID],
      { error: '休暇種別を選択してください' }
    ),
    leaveUnit: z.enum(
      [
        LEAVE_UNIT.FULL_DAY,
        LEAVE_UNIT.HALF_DAY_AM,
        LEAVE_UNIT.HALF_DAY_PM,
        LEAVE_UNIT.HOURLY,
      ],
      { error: '申請単位を選択してください' }
    ),
    /** 時間有給の時間数（0.25刻み）。hourly の場合のみ必須 */
    leaveHours: z.number().min(0.25).max(8).optional(),
    /** 時間有給の開始時刻 "HH:mm"。hourly の場合のみ必須 */
    startTime: z
      .string()
      .regex(/^\d{2}:\d{2}$/, '時刻形式が不正です（HH:mm）')
      .optional(),
    /** 時間有給の終了時刻 "HH:mm"。hourly の場合のみ必須 */
    endTime: z
      .string()
      .regex(/^\d{2}:\d{2}$/, '時刻形式が不正です（HH:mm）')
      .optional(),
    reason: z.string().max(500, '500文字以内で入力してください').optional(),
  })
  .refine(
    (data) => {
      // 時間有給の場合は leaveHours・startTime・endTime が必須
      if (data.leaveUnit === LEAVE_UNIT.HOURLY) {
        return (
          data.leaveHours != null &&
          data.startTime != null &&
          data.endTime != null
        );
      }
      return true;
    },
    { message: '時間有給の場合は時間数・開始・終了時刻を入力してください' }
  );

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
