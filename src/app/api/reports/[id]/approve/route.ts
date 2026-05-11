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
import {
  REPORT_STATUS,
  type ReportStatus,
  type ReportApprovals,
  type ApprovalSlot,
  createEmptyApprovals,
  canApproveSlot,
  canCancelSlot,
  isFullyApproved,
} from '@/types/report';
import {
  USER_ROLE,
  EXECUTIVE_TITLE,
  type UserRole,
  type ExecutiveTitle,
  getApprovalSlot,
} from '@/types/user';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * 認証ユーザーの users ドキュメントから executiveTitle を解決する
 * 取得失敗時は null。
 */
async function resolveExecutiveTitle(
  uid: string
): Promise<{ executiveTitle: ExecutiveTitle | null; displayName: string }> {
  const db = getAdminDb();
  const doc = await db.collection('users').doc(uid).get();
  const data = doc.data();
  return {
    executiveTitle: (data?.executiveTitle as ExecutiveTitle | null) ?? null,
    displayName: (data?.displayName as string) ?? '不明',
  };
}

/** ロード済みの approvals を ReportApprovals 型として整える（欠損キーは null 補填） */
function normalizeApprovals(raw: unknown): ReportApprovals {
  const empty = createEmptyApprovals();
  if (!raw || typeof raw !== 'object') return empty;
  const r = raw as Record<string, unknown>;
  return {
    construction_manager:
      (r.construction_manager as ReportApprovals['construction_manager']) ?? null,
    managing: (r.managing as ReportApprovals['managing']) ?? null,
    executive: (r.executive as ReportApprovals['executive']) ?? null,
    president: (r.president as ReportApprovals['president']) ?? null,
  };
}

/**
 * G（現場監督）の確認操作。4枠承認とは独立した「事前確認」ステップ。
 * status: submitted → supervisor_confirmed
 */
async function handleSupervisorConfirm(
  docRef: FirebaseFirestore.DocumentReference,
  currentStatus: ReportStatus,
  uid: string
) {
  if (currentStatus !== REPORT_STATUS.SUBMITTED) {
    return errorResponse(
      'INVALID_STATUS',
      '現在のステータスではこの操作を実行できません',
      400
    );
  }
  const now = FieldValue.serverTimestamp();
  await docRef.update({
    status: REPORT_STATUS.SUPERVISOR_CONFIRMED,
    supervisorId: uid,
    supervisorConfirmedAt: now,
    updatedAt: now,
  });
  return successResponse({ status: REPORT_STATUS.SUPERVISOR_CONFIRMED });
}

/**
 * 4枠承認の押印を行う（B / A / S）。
 * - 順序ガード（canApproveSlot）で前段未押印なら 422
 * - 押印後、4 slot 揃えば status=approved、B 押印なら status=manager_checked にも遷移
 */
async function handleSlotApproval(args: {
  docRef: FirebaseFirestore.DocumentReference;
  currentStatus: ReportStatus;
  approvals: ReportApprovals;
  slot: ApprovalSlot;
  uid: string;
  displayName: string;
}) {
  const { docRef, currentStatus, approvals, slot, uid, displayName } = args;

  if (currentStatus === REPORT_STATUS.REJECTED) {
    return errorResponse(
      'INVALID_STATUS',
      '差し戻し中の日報は承認できません。再提出してください',
      400
    );
  }
  if (currentStatus === REPORT_STATUS.DRAFT) {
    return errorResponse('INVALID_STATUS', '下書きの日報は承認できません', 400);
  }

  if (!canApproveSlot(approvals, slot)) {
    return errorResponse(
      'APPROVAL_ORDER_VIOLATION',
      '承認順序が正しくありません。前段の承認者が未押印か、すでに押印済みです',
      422
    );
  }

  const now = FieldValue.serverTimestamp();
  const newApprovals: ReportApprovals = {
    ...approvals,
    [slot]: { uid, displayName, approvedAt: now },
  };

  const update: Record<string, unknown> = {
    [`approvals.${slot}`]: { uid, displayName, approvedAt: now },
    updatedAt: now,
  };

  // B 押印で status を manager_checked に進める（既存挙動互換）
  if (
    slot === EXECUTIVE_TITLE.CONSTRUCTION_MANAGER &&
    currentStatus !== REPORT_STATUS.MANAGER_CHECKED &&
    currentStatus !== REPORT_STATUS.APPROVED
  ) {
    update.status = REPORT_STATUS.MANAGER_CHECKED;
    update.checkedBy = uid;
    update.checkedAt = now;
  }

  // 4 slot 揃えば最終 approved
  if (isFullyApproved(newApprovals)) {
    update.status = REPORT_STATUS.APPROVED;
    update.approvedBy = uid;
    update.approvedByName = displayName;
    update.approvedAt = now;
  }

  await docRef.update(update);
  const finalStatus = (update.status as ReportStatus | undefined) ?? currentStatus;
  return successResponse({
    status: finalStatus,
    slot,
    approvals: newApprovals,
  });
}

/** 押印操作を行う認証ロールかどうか */
function canPerformApproval(role: UserRole): boolean {
  return (
    role === USER_ROLE.G ||
    role === USER_ROLE.B ||
    role === USER_ROLE.A ||
    role === USER_ROLE.S
  );
}

/** PUT /api/reports/[id]/approve - 4枠承認の押印 + G の事前確認 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();
    if (!canPerformApproval(auth.role)) return forbiddenResponse();

    const { id } = await params;
    const db = getAdminDb();
    const docRef = db.collection('daily_reports').doc(id);
    const doc = await docRef.get();
    if (!doc.exists) return notFoundResponse('日報が見つかりません');

    const data = doc.data()!;
    const currentStatus = data.status as ReportStatus;

    // G は4枠承認に参加せず、事前確認のみ
    if (auth.role === USER_ROLE.G) {
      return await handleSupervisorConfirm(docRef, currentStatus, auth.uid);
    }

    // B / A / S → slot 判定して押印
    const { executiveTitle, displayName } = await resolveExecutiveTitle(auth.uid);
    const slot = getApprovalSlot(auth.role, executiveTitle);
    if (!slot) {
      return forbiddenResponse('承認権限のある役職が設定されていません');
    }

    const approvals = normalizeApprovals(data.approvals);
    return await handleSlotApproval({
      docRef,
      currentStatus,
      approvals,
      slot,
      uid: auth.uid,
      displayName,
    });
  } catch (error) {
    console.error('日報承認エラー:', error);
    return serverErrorResponse();
  }
}

/**
 * DELETE /api/reports/[id]/approve - 自分の slot の押印を取り消す
 * 取消可能条件: 自分の slot に押印済み かつ 自分より後の slot が未押印
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();

    // G は4枠承認の取消対象外
    if (auth.role === USER_ROLE.G || !canPerformApproval(auth.role)) {
      return forbiddenResponse();
    }

    const { id } = await params;
    const db = getAdminDb();
    const docRef = db.collection('daily_reports').doc(id);
    const doc = await docRef.get();
    if (!doc.exists) return notFoundResponse('日報が見つかりません');

    const data = doc.data()!;
    const currentStatus = data.status as ReportStatus;
    const { executiveTitle } = await resolveExecutiveTitle(auth.uid);
    const slot = getApprovalSlot(auth.role, executiveTitle);
    if (!slot) {
      return forbiddenResponse('承認権限のある役職が設定されていません');
    }

    const approvals = normalizeApprovals(data.approvals);
    const entry = approvals[slot];
    if (!entry) {
      return errorResponse('NOT_APPROVED', 'この日報には未押印です', 400);
    }
    if (entry.uid !== auth.uid) {
      return forbiddenResponse('他のユーザーの押印は取消できません');
    }
    if (!canCancelSlot(approvals, slot)) {
      return errorResponse(
        'CANCEL_BLOCKED',
        '後段の承認者が押印済みのため取消できません。先に後段を取消してください',
        422
      );
    }

    const now = FieldValue.serverTimestamp();
    const update: Record<string, unknown> = {
      [`approvals.${slot}`]: null,
      updatedAt: now,
    };

    // 取消で status を1段階戻す
    if (slot === EXECUTIVE_TITLE.CONSTRUCTION_MANAGER) {
      // B 取消 → status を supervisor_confirmed に戻す
      update.status = REPORT_STATUS.SUPERVISOR_CONFIRMED;
      update.checkedBy = null;
      update.checkedAt = null;
    }
    // 社長/専務/常務（並列枠）の取消で approved → manager_checked に戻す
    if (
      slot !== EXECUTIVE_TITLE.CONSTRUCTION_MANAGER &&
      currentStatus === REPORT_STATUS.APPROVED
    ) {
      update.status = REPORT_STATUS.MANAGER_CHECKED;
      update.approvedBy = null;
      update.approvedByName = null;
      update.approvedAt = null;
    }

    await docRef.update(update);
    return successResponse({ canceled: slot });
  } catch (error) {
    console.error('承認取消エラー:', error);
    return serverErrorResponse();
  }
}
