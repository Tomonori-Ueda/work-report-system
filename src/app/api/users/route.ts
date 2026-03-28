import 'server-only';

import { type NextRequest } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase/admin';
import { getAdminAuth } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/firebase/api-auth';
import {
  successResponse,
  unauthorizedResponse,
  forbiddenResponse,
  serverErrorResponse,
  errorResponse,
} from '@/lib/utils/api-response';
import { createUserSchema } from '@/lib/validations/user';
import { USER_ROLE } from '@/types/user';

/** GET /api/users - ユーザー一覧を取得（管理者のみ） */
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();
    if (auth.role !== USER_ROLE.ADMIN) return forbiddenResponse();

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

/** POST /api/users - ユーザーを新規作成（管理者のみ） */
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();
    if (auth.role !== USER_ROLE.ADMIN) return forbiddenResponse();

    const body: unknown = await request.json();
    const parsed = createUserSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(
        'VALIDATION_ERROR',
        parsed.error.issues[0]?.message ?? 'バリデーションエラー',
        400
      );
    }

    const { email, password, displayName, role, department, annualLeaveBalance } = parsed.data;

    // Firebase Authにユーザーを作成
    const adminAuth = getAdminAuth();
    const userRecord = await adminAuth.createUser({
      email,
      password,
      displayName,
    });

    // カスタムクレームにロールを設定
    await adminAuth.setCustomUserClaims(userRecord.uid, { role });

    // Firestoreにユーザードキュメントを作成
    const db = getAdminDb();
    await db.collection('users').doc(userRecord.uid).set({
      email,
      displayName,
      role,
      department: department ?? null,
      annualLeaveBalance: annualLeaveBalance ?? 0,
      isActive: true,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return successResponse({ id: userRecord.uid, email, displayName, role }, 201);
  } catch (error) {
    console.error('ユーザー作成エラー:', error);
    if (error instanceof Error && error.message.includes('email-already-exists')) {
      return errorResponse('DUPLICATE_EMAIL', 'このメールアドレスは既に使用されています', 400);
    }
    return serverErrorResponse();
  }
}
