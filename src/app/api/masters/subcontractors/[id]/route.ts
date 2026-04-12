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
const updateSubcontractorSchema = z.object({
  companyName: z.string().min(1, '会社名は必須です').max(100, '会社名は100文字以内で入力してください').optional(),
  contactPerson: z.string().max(50, '担当者名は50文字以内で入力してください').nullable().optional(),
  unitPrice: z.number().nonnegative('単価は0以上で入力してください').nullable().optional(),
  isActive: z.boolean().optional(),
});

/** PUT /api/masters/subcontractors/[id] - 協力会社更新（管理者系ロールのみ） */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();
    if (!isAdminRole(auth.role)) return forbiddenResponse();

    const { id } = await params;
    const body: unknown = await request.json();
    const result = updateSubcontractorSchema.safeParse(body);
    if (!result.success) {
      return errorResponse('VALIDATION_ERROR', result.error.issues[0]?.message ?? 'バリデーションエラー');
    }

    const db = getAdminDb();
    const doc = await db.collection('subcontractors').doc(id).get();
    if (!doc.exists) {
      return notFoundResponse('協力会社が見つかりません');
    }

    const updateData: Record<string, unknown> = {
      ...result.data,
      updatedAt: FieldValue.serverTimestamp(),
    };

    await db.collection('subcontractors').doc(id).update(updateData);
    const updated = await db.collection('subcontractors').doc(id).get();

    return successResponse({ id: updated.id, ...updated.data() });
  } catch (error) {
    console.error('協力会社更新エラー:', error);
    return serverErrorResponse();
  }
}

/** DELETE /api/masters/subcontractors/[id] - 協力会社論理削除（S/Aのみ） */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();
    if (!canApprove(auth.role)) return forbiddenResponse();

    const { id } = await params;
    const db = getAdminDb();
    const doc = await db.collection('subcontractors').doc(id).get();
    if (!doc.exists) {
      return notFoundResponse('協力会社が見つかりません');
    }

    await db.collection('subcontractors').doc(id).update({
      isActive: false,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return successResponse({ message: '協力会社を無効化しました' });
  } catch (error) {
    console.error('協力会社削除エラー:', error);
    return serverErrorResponse();
  }
}
