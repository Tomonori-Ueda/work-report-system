import 'server-only';

import { type NextRequest } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { verifyAuth } from '@/lib/firebase/api-auth';
import {
  successResponse,
  unauthorizedResponse,
  forbiddenResponse,
  serverErrorResponse,
  errorResponse,
} from '@/lib/utils/api-response';
import { isAdminRole, isSupervisor } from '@/types/user';
import { TRADE_TYPES, type TradeType } from '@/types/field-report';

/**
 * GET /api/field-reports/cumulative?siteId=xxx
 *
 * 指定現場マスターの全 field_reports から職種別稼働人員の累計と
 * 労働時間の累計を集計する。
 *
 * レスポンス:
 * {
 *   tradeWorkers: { [tradeType]: number },  // 各職種の累計人日
 *   laborHoursCumulative: number,           // 労働時間の合計
 * }
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth) return unauthorizedResponse();

    if (!isAdminRole(auth.role) && !isSupervisor(auth.role)) {
      return forbiddenResponse('累計データの閲覧権限がありません');
    }

    const { searchParams } = new URL(request.url);
    const siteId = searchParams.get('siteId');

    if (!siteId) {
      return errorResponse(
        'VALIDATION_ERROR',
        'siteId パラメータは必須です',
        400
      );
    }

    const db = getAdminDb();

    // 指定現場の全日報を取得（supervisorIdでフィルタし、siteIdはJS側で絞る）
    // Why: Firestoreの複合インデックスの制約回避
    const snapshot = await db
      .collection('field_reports')
      .where('siteId', '==', siteId)
      .get();

    // 職種別の累計を集計
    const tradeCumulative: Record<string, number> = {};
    for (const tradeType of TRADE_TYPES) {
      tradeCumulative[tradeType] = 0;
    }

    let laborHoursCumulative = 0;

    for (const doc of snapshot.docs) {
      const data = doc.data();

      // tradeWorkers から today を積み上げ
      const tradeWorkers = data.tradeWorkers as
        | Partial<Record<TradeType, { today?: number; cumulative?: number }>>
        | undefined;

      if (tradeWorkers) {
        for (const tradeType of TRADE_TYPES) {
          const entry = tradeWorkers[tradeType];
          if (entry?.today) {
            tradeCumulative[tradeType] =
              (tradeCumulative[tradeType] ?? 0) + entry.today;
          }
        }
      }

      // laborHoursToday を積み上げ
      const hoursToday = data.laborHoursToday as number | undefined;
      if (hoursToday) {
        laborHoursCumulative += hoursToday;
      }
    }

    return successResponse({
      siteId,
      tradeWorkers: tradeCumulative,
      laborHoursCumulative,
      reportCount: snapshot.size,
    });
  } catch (error) {
    console.error('累計集計エラー:', error);
    return serverErrorResponse();
  }
}
