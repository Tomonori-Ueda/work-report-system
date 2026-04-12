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
  notFoundResponse,
  serverErrorResponse,
} from '@/lib/utils/api-response';
import { isAdminRole, canApprove } from '@/types/user';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** PUT ボディのバリデーションスキーマ */
const updateWorkTypeSchema = z.object({
  name: z.string().min(1, '作業内容名は必須です').max(100, '作業内容名は100文字以内で入力してください').optional(),
  category: z.string().max(50, 'カテゴリは50文字以内で入力してください').nullable().optional(),
  sortOrder: z.number().int('表示順は整数で入力してください').nonnegative('表示順は0以上で入力してください').optional(),
  isActive: z.boolean().optional(),
});

/** PUT /api/masters/work-types/[id] - 作業内容更新（管理者系ロールのみ） */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();
    if (!isAdminRole(auth.role)) return forbiddenResponse();

    const { id } = await params;
    const body: unknown = await request.json();
    const result = updateWorkTypeSchema.safeParse(body);
    if (!result.success) {
      return errorResponse('VALIDATION_ERROR', result.error.issues[0]?.message ?? 'バリデーションエラー');
    }

    const db = getAdminDb();
    const doc = await db.collection('work_types').doc(id).get();
    if (!doc.exists) {
      return notFoundResponse('作業内容が見つかりません');
    }

    const updateData: Record<string, unknown> = {
      ...result.data,
      updatedAt: FieldValue.serverTimestamp(),
    };

    await db.collection('work_types').doc(id).update(updateData);
    const updated = await db.collection('work_types').doc(id).get();

    return successResponse({ id: updated.id, ...updated.data() });
  } catch (error) {
    console.error('作業内容更新エラー:', error);
    return serverErrorResponse();
  }
}

/** DELETE /api/masters/work-types/[id] - 作業内容論理削除（S/Aのみ） */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();
    if (!canApprove(auth.role)) return forbiddenResponse();

    const { id } = await params;
    const db = getAdminDb();
    const doc = await db.collection('work_types').doc(id).get();
    if (!doc.exists) {
      return notFoundResponse('作業内容が見つかりません');
    }

    await db.collection('work_types').doc(id).update({
      isActive: false,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return successResponse({ message: '作業内容を無効化しました' });
  } catch (error) {
    console.error('作業内容削除エラー:', error);
    return serverErrorResponse();
  }
}
