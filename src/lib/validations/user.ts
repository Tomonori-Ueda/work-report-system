import { z } from 'zod/v4';
import { USER_ROLE } from '@/types/user';

/** ユーザー作成スキーマ */
export const createUserSchema = z.object({
  email: z
    .string()
    .min(1, 'メールアドレスを入力してください')
    .email('有効なメールアドレスを入力してください'),
  password: z
    .string()
    .min(6, 'パスワードは6文字以上で入力してください')
    .max(128, 'パスワードは128文字以内で入力してください'),
  displayName: z
    .string()
    .min(1, '名前を入力してください')
    .max(50, '50文字以内で入力してください'),
  role: z.enum([USER_ROLE.WORKER, USER_ROLE.ADMIN], {
    error: 'ロールを選択してください',
  }),
  department: z.string().max(50, '50文字以内で入力してください').optional(),
  annualLeaveBalance: z.number().min(0, '0以上の値を入力してください').optional(),
});

export type CreateUserFormValues = z.infer<typeof createUserSchema>;

/** ユーザー更新スキーマ */
export const updateUserSchema = z.object({
  displayName: z
    .string()
    .min(1, '名前を入力してください')
    .max(50, '50文字以内で入力してください'),
  role: z.enum([USER_ROLE.WORKER, USER_ROLE.ADMIN], {
    error: 'ロールを選択してください',
  }),
  department: z.string().max(50, '50文字以内で入力してください').optional(),
  annualLeaveBalance: z.number().min(0, '0以上の値を入力してください').optional(),
  isActive: z.boolean(),
});

export type UpdateUserFormValues = z.infer<typeof updateUserSchema>;
