import 'server-only';

import { type NextRequest } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/firebase/api-auth';
import {
  successResponse,
  unauthorizedResponse,
  forbiddenResponse,
  serverErrorResponse,
  errorResponse,
} from '@/lib/utils/api-response';
import { bulkApproveSchema } from '@/lib/validations/report';
import {
  REPORT_STATUS,
  type ReportApprovals,
  type ApprovalSlot,
  type ReportStatus,
  createEmptyApprovals,
  canApproveSlot,
  isFullyApproved,
} from '@/types/report';
import {
  USER_ROLE,
  EXECUTIVE_TITLE,
  type UserRole,
  type ExecutiveTitle,
  getApprovalSlot,
} from '@/types/user';

/** Firestoreバッチ書き込みの最大件数 */
const BATCH_LIMIT = 500;

/** ロード済みの approvals を ReportApprovals 型として整える */
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

/** 一括承認操作を行えるロールか（B / A / S） */
function canBulkApprove(role: UserRole): boolean {
  return role === USER_ROLE.B || role === USER_ROLE.A || role === USER_ROLE.S;
}

/**
 * POST /api/reports/bulk-approve
 * 4枠承認モデル下では「自分の slot に対して、押印可能な対象だけまとめて押印」する。
 * 押印できない（順序違反 / 既押印 / 差し戻し中など）対象は failedIds に積む。
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();
    if (!canBulkApprove(auth.role)) return forbiddenResponse();

    const body: unknown = await request.json();
    const parsed = bulkApproveSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(
        'VALIDATION_ERROR',
        parsed.error.issues[0]?.message ?? '承認する日報を選択してください',
        400
      );
    }

    const { reportIds } = parsed.data;
    const db = getAdminDb();

    // 認証ユーザーの役職タイトルから slot を解決
    const userDoc = await db.collection('users').doc(auth.uid).get();
    const userData = userDoc.data();
    const executiveTitle =
      (userData?.executiveTitle as ExecutiveTitle | null) ?? null;
    const displayName = (userData?.displayName as string) ?? '不明';
    const slot = getApprovalSlot(auth.role, executiveTitle);
    if (!slot) {
      return forbiddenResponse('承認権限のある役職が設定されていません');
    }

    let approvedCount = 0;
    const failedIds: string[] = [];

    for (let i = 0; i < reportIds.length; i += BATCH_LIMIT) {
      const chunk = reportIds.slice(i, i + BATCH_LIMIT);
      const batch = db.batch();

      for (const reportId of chunk) {
        const docRef = db.collection('daily_reports').doc(reportId);
        const docSnap = await docRef.get();
        if (!docSnap.exists) {
          failedIds.push(reportId);
          continue;
        }
        const data = docSnap.data()!;
        const status = data.status as ReportStatus;
        if (status === REPORT_STATUS.DRAFT || status === REPORT_STATUS.REJECTED) {
          failedIds.push(reportId);
          continue;
        }

        const approvals = normalizeApprovals(data.approvals);
        if (!canApproveSlot(approvals, slot)) {
          failedIds.push(reportId);
          continue;
        }

        const now = FieldValue.serverTimestamp();
        const newApprovals: ReportApprovals = {
          ...approvals,
          [slot]: { uid: auth.uid, displayName, approvedAt: now },
        };

        const update: Record<string, unknown> = {
          [`approvals.${slot}`]: { uid: auth.uid, displayName, approvedAt: now },
          updatedAt: now,
        };

        if (
          slot === EXECUTIVE_TITLE.CONSTRUCTION_MANAGER &&
          status !== REPORT_STATUS.MANAGER_CHECKED &&
          status !== REPORT_STATUS.APPROVED
        ) {
          update.status = REPORT_STATUS.MANAGER_CHECKED;
          update.checkedBy = auth.uid;
          update.checkedAt = now;
        }

        if (isFullyApproved(newApprovals)) {
          update.status = REPORT_STATUS.APPROVED;
          update.approvedBy = auth.uid;
          update.approvedByName = displayName;
          update.approvedAt = now;
        }

        batch.update(docRef, update);
        approvedCount++;
      }

      await batch.commit();
    }

    const slotForResponse: ApprovalSlot = slot;
    return successResponse({ approvedCount, failedIds, slot: slotForResponse });
  } catch (error) {
    console.error('一括承認エラー:', error);
    return serverErrorResponse();
  }
}
