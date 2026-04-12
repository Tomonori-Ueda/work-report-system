import 'server-only';

import { type NextRequest } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';
import { getAdminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/firebase/api-auth';
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  forbiddenResponse,
  serverErrorResponse,
} from '@/lib/utils/api-response';
import { isAdminRole } from '@/types/user';

/** POST ボディのバリデーションスキーマ */
const createWorkTypeSchema = z.object({
  name: z.string().min(1, '作業内容名は必須です').max(100, '作業内容名は100文字以内で入力してください'),
  category: z.string().max(50, 'カテゴリは50文字以内で入力してください').optional().nullable(),
  sortOrder: z.number().int('表示順は整数で入力してください').nonnegative('表示順は0以上で入力してください').optional().default(0),
});

/** GET /api/masters/work-types - 作業内容一覧取得（全ロール可、sortOrder順） */
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();

    const db = getAdminDb();
    const snapshot = await db
      .collection('work_types')
      .orderBy('sortOrder')
      .get();

    const workTypes = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    return successResponse({ workTypes });
  } catch (error) {
    console.error('作業内容一覧取得エラー:', error);
    return serverErrorResponse();
  }
}

/** POST /api/masters/work-types - 作業内容登録（管理者系ロールのみ） */
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();
    if (!isAdminRole(auth.role)) return forbiddenResponse();

    const body: unknown = await request.json();
    const result = createWorkTypeSchema.safeParse(body);
    if (!result.success) {
      return errorResponse('VALIDATION_ERROR', result.error.issues[0]?.message ?? 'バリデーションエラー');
    }

    const { name, category, sortOrder } = result.data;

    const db = getAdminDb();
    const docRef = await db.collection('work_types').add({
      name,
      category: category ?? null,
      sortOrder,
      isActive: true,
      createdAt: FieldValue.serverTimestamp(),
    });

    const created = await docRef.get();

    return successResponse({ id: docRef.id, ...created.data() }, 201);
  } catch (error) {
    console.error('作業内容登録エラー:', error);
    return serverErrorResponse();
  }
}
