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
const createSiteSchema = z.object({
  siteCode: z.string().min(1, '現場コードは必須です').max(20, '現場コードは20文字以内で入力してください'),
  siteName: z.string().min(1, '現場名は必須です').max(100, '現場名は100文字以内で入力してください'),
  supervisorIds: z.array(z.string()).optional().default([]),
});

/** GET /api/masters/sites - 現場一覧取得（全ロール可） */
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();

    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('active') === 'true';

    const db = getAdminDb();
    // where + orderBy の複合インデックスを避けるため、JS側でソートする
    let baseQuery = db.collection('sites') as FirebaseFirestore.Query;
    if (activeOnly) {
      baseQuery = baseQuery.where('isActive', '==', true);
    }

    const snapshot = await baseQuery.get();
    const sites = snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() } as Record<string, unknown> & { id: string }))
      .sort((a, b) =>
        String(a['siteCode'] ?? '').localeCompare(String(b['siteCode'] ?? ''), 'ja')
      );

    return successResponse({ sites });
  } catch (error) {
    console.error('現場一覧取得エラー:', error);
    return serverErrorResponse();
  }
}

/** POST /api/masters/sites - 現場登録（管理者系ロールのみ） */
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();
    if (!isAdminRole(auth.role)) return forbiddenResponse();

    const body: unknown = await request.json();
    const result = createSiteSchema.safeParse(body);
    if (!result.success) {
      return errorResponse('VALIDATION_ERROR', result.error.issues[0]?.message ?? 'バリデーションエラー');
    }

    const { siteCode, siteName, supervisorIds } = result.data;

    const db = getAdminDb();

    // 同一siteCodeの重複チェック
    const existing = await db
      .collection('sites')
      .where('siteCode', '==', siteCode)
      .limit(1)
      .get();

    if (!existing.empty) {
      return errorResponse('DUPLICATE_SITE_CODE', '同じ現場コードがすでに存在します', 409);
    }

    const now = FieldValue.serverTimestamp();
    const docRef = await db.collection('sites').add({
      siteCode,
      siteName,
      supervisorIds,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    const created = await docRef.get();

    return successResponse({ id: docRef.id, ...created.data() }, 201);
  } catch (error) {
    console.error('現場登録エラー:', error);
    return serverErrorResponse();
  }
}
