import 'server-only';

import { type NextRequest } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/firebase/api-auth';
import {
  successResponse,
  unauthorizedResponse,
  forbiddenResponse,
  serverErrorResponse,
} from '@/lib/utils/api-response';
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
