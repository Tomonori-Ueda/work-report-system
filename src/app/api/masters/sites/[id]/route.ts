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
const updateSiteSchema = z.object({
  siteName: z.string().min(1, '現場名は必須です').max(100, '現場名は100文字以内で入力してください').optional(),
  supervisorIds: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

/** GET /api/masters/sites/[id] - 現場詳細取得（全ロール可） */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();

    const { id } = await params;
    const db = getAdminDb();
    const doc = await db.collection('sites').doc(id).get();

    if (!doc.exists) {
      return notFoundResponse('現場が見つかりません');
    }

    return successResponse({ id: doc.id, ...doc.data() });
  } catch (error) {
    console.error('現場詳細取得エラー:', error);
    return serverErrorResponse();
  }
}

/** PUT /api/masters/sites/[id] - 現場更新（管理者系ロールのみ） */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();
    if (!isAdminRole(auth.role)) return forbiddenResponse();

    const { id } = await params;
    const body: unknown = await request.json();
    const result = updateSiteSchema.safeParse(body);
    if (!result.success) {
      return errorResponse('VALIDATION_ERROR', result.error.issues[0]?.message ?? 'バリデーションエラー');
    }

    const db = getAdminDb();
    const doc = await db.collection('sites').doc(id).get();
    if (!doc.exists) {
      return notFoundResponse('現場が見つかりません');
    }

    const updateData: Record<string, unknown> = {
      ...result.data,
      updatedAt: FieldValue.serverTimestamp(),
    };

    await db.collection('sites').doc(id).update(updateData);
    const updated = await db.collection('sites').doc(id).get();

    return successResponse({ id: updated.id, ...updated.data() });
  } catch (error) {
    console.error('現場更新エラー:', error);
    return serverErrorResponse();
  }
}

/** DELETE /api/masters/sites/[id] - 現場論理削除（S/Aのみ） */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();
    if (!canApprove(auth.role)) return forbiddenResponse();

    const { id } = await params;
    const db = getAdminDb();
    const doc = await db.collection('sites').doc(id).get();
    if (!doc.exists) {
      return notFoundResponse('現場が見つかりません');
    }

    await db.collection('sites').doc(id).update({
      isActive: false,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return successResponse({ message: '現場を無効化しました' });
  } catch (error) {
    console.error('現場削除エラー:', error);
    return serverErrorResponse();
  }
}
