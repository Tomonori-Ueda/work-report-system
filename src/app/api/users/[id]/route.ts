import 'server-only';

import { type NextRequest } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/firebase/api-auth';
import {
  successResponse,
  unauthorizedResponse,
  forbiddenResponse,
  notFoundResponse,
  serverErrorResponse,
} from '@/lib/utils/api-response';
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
