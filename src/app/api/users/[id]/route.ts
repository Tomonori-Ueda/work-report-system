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
  errorResponse,
  serverErrorResponse,
} from '@/lib/utils/api-response';
import { isAdminRole, USER_ROLE } from '@/types/user';
import type { UserRole } from '@/types/user';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** GET /api/users/[id] - ユーザー詳細を取得 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();

    const { id } = await params;

    // 自分自身のデータか管理者系ロールのみ閲覧可
    if (!isAdminRole(auth.role) && auth.uid !== id) {
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

/** PUT /api/users/[id] - ユーザー情報を更新（管理者のみ） */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();
    if (!isAdminRole(auth.role)) return forbiddenResponse();

    const { id } = await params;

    const db = getAdminDb();
    const docRef = db.collection('users').doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return notFoundResponse('ユーザーが見つかりません');
    }

    const body = (await request.json()) as {
      displayName?: string;
      department?: string | null;
      role?: string;
      hireDate?: string | null;
      monthlySalary?: number | null;
      annualLeaveBalance?: number;
      isActive?: boolean;
    };

    // 更新可能フィールドの検証と構築
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (body.displayName !== undefined) {
      if (typeof body.displayName !== 'string' || body.displayName.trim() === '') {
        return errorResponse('BAD_REQUEST', '表示名は空にできません', 400);
      }
      updateData['displayName'] = body.displayName.trim();

      // Firebase Auth の表示名も更新
      const adminAuth = getAdminAuth();
      await adminAuth.updateUser(id, { displayName: body.displayName.trim() });
    }

    if (body.department !== undefined) {
      updateData['department'] = body.department;
    }

    if (body.role !== undefined) {
      const validRoles = Object.values(USER_ROLE) as string[];
      if (!validRoles.includes(body.role)) {
        return errorResponse('BAD_REQUEST', '無効なロールです', 400);
      }
      updateData['role'] = body.role as UserRole;

      // カスタムクレームのロールも更新
      const adminAuth = getAdminAuth();
      await adminAuth.setCustomUserClaims(id, { role: body.role });
    }

    if (body.hireDate !== undefined) {
      // YYYY-MM-DD形式チェック
      if (body.hireDate !== null && !/^\d{4}-\d{2}-\d{2}$/.test(body.hireDate)) {
        return errorResponse('BAD_REQUEST', '入社日は YYYY-MM-DD 形式で指定してください', 400);
      }
      updateData['hireDate'] = body.hireDate;
    }

    if (body.monthlySalary !== undefined) {
      if (body.monthlySalary !== null && (typeof body.monthlySalary !== 'number' || body.monthlySalary < 0)) {
        return errorResponse('BAD_REQUEST', '月給は0以上の数値で指定してください', 400);
      }
      updateData['monthlySalary'] = body.monthlySalary;
    }

    if (body.annualLeaveBalance !== undefined) {
      if (typeof body.annualLeaveBalance !== 'number' || body.annualLeaveBalance < 0) {
        return errorResponse('BAD_REQUEST', '有給残日数は0以上の数値で指定してください', 400);
      }
      updateData['annualLeaveBalance'] = body.annualLeaveBalance;
    }

    if (body.isActive !== undefined) {
      updateData['isActive'] = body.isActive;
    }

    // updatedAtはFirestore ServerTimestampで上書き
    updateData['updatedAt'] = FieldValue.serverTimestamp();

    await docRef.update(updateData);

    const updated = await docRef.get();
    return successResponse({ id: updated.id, ...updated.data() });
  } catch (error) {
    console.error('ユーザー更新エラー:', error);
    return serverErrorResponse();
  }
}
