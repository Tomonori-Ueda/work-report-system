import 'server-only';

import { type NextRequest } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/firebase/api-auth';
import { calculateWorkingHours } from '@/lib/utils/time-calc';
import {
  successResponse,
  unauthorizedResponse,
  serverErrorResponse,
  errorResponse,
} from '@/lib/utils/api-response';
import { createReportSchema } from '@/lib/validations/report';
import { REPORT_STATUS } from '@/types/report';
import { USER_ROLE } from '@/types/user';

/** POST /api/reports - 日報を作成 */
export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();

    const body: unknown = await request.json();
    const parsed = createReportSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(
        'VALIDATION_ERROR',
        parsed.error.issues[0]?.message ?? 'バリデーションエラー',
        400
      );
    }

    const { reportDate, startTime, endTime, workEntries, notes } = parsed.data;

    // 労働時間計算
    const workHours = calculateWorkingHours({ startTime, endTime });

    // workEntriesからworkContent文字列を生成（後方互換用）
    const workContent = workEntries
      .map((e) => `${e.startTime}〜${e.endTime} ${e.content}`)
      .join('\n');

    const db = getAdminDb();
    const docRef = db.collection('daily_reports').doc();

    const reportData = {
      userId: auth.uid,
      reportDate,
      startTime,
      endTime,
      workEntries,
      workContent,
      notes: notes ?? null,
      regularHours: workHours.regularHours,
      overtimeHours: workHours.overtimeHours,
      status: REPORT_STATUS.SUBMITTED,
      approvedBy: null,
      approvedByName: null,
      approvedAt: null,
      rejectReason: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    await docRef.set(reportData);

    return successResponse({ id: docRef.id, ...reportData }, 201);
  } catch (error) {
    console.error('日報作成エラー:', error);
    return serverErrorResponse();
  }
}

/** GET /api/reports - 日報一覧を取得 */
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const status = searchParams.get('status');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const db = getAdminDb();
    let query: FirebaseFirestore.Query = db.collection('daily_reports');

    // 作業員は自分の日報のみ取得
    if (auth.role !== USER_ROLE.ADMIN) {
      query = query.where('userId', '==', auth.uid);
    } else if (userId) {
      query = query.where('userId', '==', userId);
    }

    if (status) {
      query = query.where('status', '==', status);
    }
    if (startDate) {
      query = query.where('reportDate', '>=', startDate);
    }
    if (endDate) {
      query = query.where('reportDate', '<=', endDate);
    }

    query = query.orderBy('reportDate', 'desc').limit(100);

    const snapshot = await query.get();

    const reports = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        userId: data.userId as string,
        ...data,
      };
    });

    // ユーザー情報を付与
    const userIds = [...new Set(reports.map((r) => r.userId))];
    const usersMap = new Map<string, { displayName: string; department: string | null }>();

    if (userIds.length > 0) {
      // Firestoreの in クエリは最大30件
      const chunks: string[][] = [];
      for (let i = 0; i < userIds.length; i += 30) {
        chunks.push(userIds.slice(i, i + 30));
      }
      for (const chunk of chunks) {
        const usersSnap = await db
          .collection('users')
          .where('__name__', 'in', chunk)
          .get();
        usersSnap.docs.forEach((doc) => {
          const data = doc.data();
          usersMap.set(doc.id, {
            displayName: (data.displayName as string) ?? '',
            department: (data.department as string) ?? null,
          });
        });
      }
    }

    const reportsWithUser = reports.map((r) => {
      const user = usersMap.get(r.userId);
      return {
        ...r,
        userName: user?.displayName ?? '不明',
        userDepartment: user?.department ?? null,
      };
    });

    return successResponse(reportsWithUser);
  } catch (error) {
    console.error('日報一覧取得エラー:', error);
    return serverErrorResponse();
  }
}
