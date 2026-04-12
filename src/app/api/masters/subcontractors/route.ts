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
const createSubcontractorSchema = z.object({
  companyName: z.string().min(1, '会社名は必須です').max(100, '会社名は100文字以内で入力してください'),
  contactPerson: z.string().max(50, '担当者名は50文字以内で入力してください').optional().nullable(),
  unitPrice: z.number().nonnegative('単価は0以上で入力してください').optional().nullable(),
});

/** GET /api/masters/subcontractors - 協力会社一覧取得（全ロール可） */
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();

    const db = getAdminDb();
    const snapshot = await db
      .collection('subcontractors')
      .orderBy('companyName')
      .get();

    const subcontractors = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    return successResponse({ subcontractors });
  } catch (error) {
    console.error('協力会社一覧取得エラー:', error);
    return serverErrorResponse();
  }
}

/** POST /api/masters/subcontractors - 協力会社登録（管理者系ロールのみ） */
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();
    if (!isAdminRole(auth.role)) return forbiddenResponse();

    const body: unknown = await request.json();
    const result = createSubcontractorSchema.safeParse(body);
    if (!result.success) {
      return errorResponse('VALIDATION_ERROR', result.error.issues[0]?.message ?? 'バリデーションエラー');
    }

    const { companyName, contactPerson, unitPrice } = result.data;

    const now = FieldValue.serverTimestamp();
    const db = getAdminDb();
    const docRef = await db.collection('subcontractors').add({
      companyName,
      contactPerson: contactPerson ?? null,
      unitPrice: unitPrice ?? null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    const created = await docRef.get();

    return successResponse({ id: docRef.id, ...created.data() }, 201);
  } catch (error) {
    console.error('協力会社登録エラー:', error);
    return serverErrorResponse();
  }
}
