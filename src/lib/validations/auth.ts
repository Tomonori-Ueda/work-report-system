import { z } from 'zod/v4';

/** ログインフォームスキーマ */
export const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'メールアドレスを入力してください')
    .email('有効なメールアドレスを入力してください'),
  password: z
    .string()
    .min(6, 'パスワードは6文字以上で入力してください')
    .max(128, 'パスワードは128文字以内で入力してください'),
});

export type LoginFormValues = z.infer<typeof loginSchema>;
