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
  notFoundResponse,
  serverErrorResponse,
  errorResponse,
} from '@/lib/utils/api-response';
import { updateUserSchema } from '@/lib/validations/user';
import { USER_ROLE } from '@/types/user';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** GET /api/users/[id] - ユーザー詳細を取得 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();

    const { id } = await params;

    // 自分自身のデータか管理者のみ閲覧可
    if (auth.role !== USER_ROLE.ADMIN && auth.uid !== id) {
      return forbiddenResponse();
    }

    const db = getAdminDb();
    const doc = await db.collection('users').doc(id).get();

    if (!doc.exists) {
      return notFoundResponse('ユーザーが見つかりません');
    }

    return successResponse({ id: doc.id, ...doc.data() });
  } catch (error) {
    console.error('ユーザー詳細取得エラー:', error);
    return serverErrorResponse();
  }
}

/** PUT /api/users/[id] - ユーザーを更新（管理者のみ） */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();
    if (auth.role !== USER_ROLE.ADMIN) return forbiddenResponse();

    const { id } = await params;
    const body: unknown = await request.json();
    const parsed = updateUserSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(
        'VALIDATION_ERROR',
        parsed.error.issues[0]?.message ?? 'バリデーションエラー',
        400
      );
    }

    const { displayName, role, department, annualLeaveBalance, isActive } = parsed.data;
    const db = getAdminDb();
    const docRef = db.collection('users').doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return notFoundResponse('ユーザーが見つかりません');
    }

    // Firebase Authの表示名を更新
    const adminAuth = getAdminAuth();
    await adminAuth.updateUser(id, { displayName });

    // ロールが変更された場合、カスタムクレームを更新
    await adminAuth.setCustomUserClaims(id, { role });

    // Firestoreを更新
    await docRef.update({
      displayName,
      role,
      department: department ?? null,
      annualLeaveBalance: annualLeaveBalance ?? 0,
      isActive,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return successResponse({ id, displayName, role, department, annualLeaveBalance, isActive });
  } catch (error) {
    console.error('ユーザー更新エラー:', error);
    return serverErrorResponse();
  }
}
