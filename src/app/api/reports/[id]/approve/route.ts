import 'server-only';

import { type NextRequest } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/firebase/api-auth';
import {
  successResponse,
  unauthorizedResponse,
  forbiddenResponse,
  notFoundResponse,
  serverErrorResponse,
  errorResponse,
} from '@/lib/utils/api-response';
import { REPORT_STATUS, type ReportStatus } from '@/types/report';
import { USER_ROLE, type UserRole } from '@/types/user';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * ロールごとに承認可能なステータス一覧を返す
 * - G（現場監督）: submitted → supervisor_confirmed
 * - B（施工部長）: submitted / supervisor_confirmed → manager_checked
 * - A（専務/常務）: submitted / supervisor_confirmed / manager_checked → approved
 * - S（社長）: rejected 以外の全ステータス → approved
 */
function getApprovableStatuses(role: UserRole): ReportStatus[] {
  switch (role) {
    case USER_ROLE.G:
      return [REPORT_STATUS.SUBMITTED];
    case USER_ROLE.B:
      // 現場監督がスキップした場合も考慮して submitted も承認可
      return [REPORT_STATUS.SUBMITTED, REPORT_STATUS.SUPERVISOR_CONFIRMED];
    case USER_ROLE.A:
      // G/B のスキップを考慮して submitted / supervisor_confirmed / manager_checked から承認可
      return [
        REPORT_STATUS.SUBMITTED,
        REPORT_STATUS.SUPERVISOR_CONFIRMED,
        REPORT_STATUS.MANAGER_CHECKED,
      ];
    case USER_ROLE.S:
      // 社長は差し戻し以外すべてから承認可
      return [
        REPORT_STATUS.SUBMITTED,
        REPORT_STATUS.SUPERVISOR_CONFIRMED,
        REPORT_STATUS.MANAGER_CHECKED,
      ];
    default:
      return [];
  }
}

/**
 * ロールに応じた承認後ステータスとフィールド更新内容を返す
 */
function buildApproveUpdate(
  role: UserRole,
  uid: string
): Record<string, unknown> {
  const now = FieldValue.serverTimestamp();

  switch (role) {
    case USER_ROLE.G:
      // ①→② 現場監督確認
      return {
        status: REPORT_STATUS.SUPERVISOR_CONFIRMED,
        supervisorId: uid,
        supervisorConfirmedAt: now,
        updatedAt: now,
      };
    case USER_ROLE.B:
      // →③ 施工部長チェック
      return {
        status: REPORT_STATUS.MANAGER_CHECKED,
        checkedBy: uid,
        checkedAt: now,
        updatedAt: now,
      };
    case USER_ROLE.A:
    case USER_ROLE.S:
      // →④/⑤ 専務/常務/社長 承認
      return {
        status: REPORT_STATUS.APPROVED,
        approvedBy: uid,
        approvedAt: now,
        updatedAt: now,
      };
    default:
      return {};
  }
}

/** 承認権限を持つロールかどうか（G, B, A, S のみ） */
function canApproveWithRole(role: UserRole): boolean {
  return (
    role === USER_ROLE.G ||
    role === USER_ROLE.B ||
    role === USER_ROLE.A ||
    role === USER_ROLE.S
  );
}

/** PUT /api/reports/[id]/approve - ロール別の5ステップ日報承認 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();
    if (!canApproveWithRole(auth.role)) return forbiddenResponse();

    const { id } = await params;
    const db = getAdminDb();
    const docRef = db.collection('daily_reports').doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return notFoundResponse('日報が見つかりません');
    }

    const currentStatus = doc.data()!.status as ReportStatus;
    const approvableStatuses = getApprovableStatuses(auth.role);

    // 既に承認済みは再承認不可
    if (currentStatus === REPORT_STATUS.APPROVED) {
      return errorResponse('INVALID_STATUS', 'この日報はすでに承認済みです', 400);
    }

    // 差し戻し中は承認不可（再提出が必要）
    if (currentStatus === REPORT_STATUS.REJECTED) {
      return errorResponse(
        'INVALID_STATUS',
        '差し戻し中の日報は承認できません。再提出してください',
        400
      );
    }

    if (!approvableStatuses.includes(currentStatus)) {
      return errorResponse(
        'INVALID_STATUS',
        '現在のステータスではこの操作を実行できません',
        400
      );
    }

    const updateData = buildApproveUpdate(auth.role, auth.uid);
    await docRef.update(updateData);

    const nextStatus = updateData.status as ReportStatus;
    return successResponse({ id, status: nextStatus });
  } catch (error) {
    console.error('日報承認エラー:', error);
    return serverErrorResponse();
  }
}
