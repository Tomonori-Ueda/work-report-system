import 'server-only';

import { type NextRequest } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';
import { getAdminDb, getAdminAuth } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/firebase/api-auth';
import {
  successResponse,
  unauthorizedResponse,
  forbiddenResponse,
  errorResponse,
  serverErrorResponse,
} from '@/lib/utils/api-response';
import { isAdminRole, USER_ROLE } from '@/types/user';
import type { UserRole } from '@/types/user';

/** ユーザー作成ボディのバリデーションスキーマ */
const createUserSchema = z.object({
  email: z.string().email('有効なメールアドレスを入力してください'),
  password: z
    .string()
    .min(8, 'パスワードは8文字以上で入力してください')
    .max(128),
  displayName: z.string().min(1, '表示名は必須です').max(50),
  role: z.enum([
    USER_ROLE.S,
    USER_ROLE.A,
    USER_ROLE.A_SPECIAL,
    USER_ROLE.B,
    USER_ROLE.G,
    USER_ROLE.GENERAL,
  ]),
  department: z.string().max(50).optional().nullable(),
  hireDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, '日付形式が不正です（YYYY-MM-DD）')
    .optional()
    .nullable(),
  monthlySalary: z.number().nonnegative().optional().nullable(),
  annualLeaveBalance: z.number().int().nonnegative().default(0),
});

/** GET /api/users - ユーザー一覧を取得（管理者のみ） */
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();
    if (!isAdminRole(auth.role)) return forbiddenResponse();

    const db = getAdminDb();
    const snapshot = await db
      .collection('users')
      .orderBy('displayName')
      .get();

    const users = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return successResponse(users);
  } catch (error) {
    console.error('ユーザー一覧取得エラー:', error);
    return serverErrorResponse();
  }
}

/** POST /api/users - 新規ユーザー登録（管理者のみ） */
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();
    if (!isAdminRole(auth.role)) return forbiddenResponse();

    const body: unknown = await request.json();
    const result = createUserSchema.safeParse(body);
    if (!result.success) {
      return errorResponse(
        'VALIDATION_ERROR',
        result.error.issues[0]?.message ?? 'バリデーションエラー',
        400
      );
    }

    const {
      email,
      password,
      displayName,
      role,
      department,
      hireDate,
      monthlySalary,
      annualLeaveBalance,
    } = result.data;

    const adminAuth = getAdminAuth();
    const db = getAdminDb();

    // Firebase Auth ユーザー作成
    let firebaseUser;
    try {
      firebaseUser = await adminAuth.createUser({
        email,
        password,
        displayName,
      });
    } catch (authError) {
      const code = (authError as { code?: string }).code;
      if (code === 'auth/email-already-exists') {
        return errorResponse('EMAIL_ALREADY_EXISTS', 'このメールアドレスは既に使用されています', 409);
      }
      throw authError;
    }

    // カスタムクレーム（ロール）を設定
    await adminAuth.setCustomUserClaims(firebaseUser.uid, { role: role as UserRole });

    // Firestore にユーザードキュメントを作成
    const now = FieldValue.serverTimestamp();
    const userData = {
      email,
      displayName,
      role,
      department: department ?? null,
      hireDate: hireDate ?? null,
      monthlySalary: monthlySalary ?? null,
      annualLeaveBalance,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    await db.collection('users').doc(firebaseUser.uid).set(userData);

    return successResponse(
      { id: firebaseUser.uid, ...userData },
      201
    );
  } catch (error) {
    console.error('ユーザー作成エラー:', error);
    return serverErrorResponse();
  }
}
