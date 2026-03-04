import { NextResponse } from 'next/server';

/** 成功レスポンスを返す */
export function successResponse<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ data }, { status });
}

/** エラーレスポンスを返す */
export function errorResponse(
  error: string,
  message: string,
  status = 400
): NextResponse {
  return NextResponse.json({ error, message }, { status });
}

/** 認証エラーレスポンス */
export function unauthorizedResponse(
  message = '認証が必要です'
): NextResponse {
  return errorResponse('UNAUTHORIZED', message, 401);
}

/** 権限エラーレスポンス */
export function forbiddenResponse(
  message = '権限がありません'
): NextResponse {
  return errorResponse('FORBIDDEN', message, 403);
}

/** Not Foundレスポンス */
export function notFoundResponse(
  message = 'リソースが見つかりません'
): NextResponse {
  return errorResponse('NOT_FOUND', message, 404);
}

/** サーバーエラーレスポンス */
export function serverErrorResponse(
  message = 'サーバーエラーが発生しました'
): NextResponse {
  return errorResponse('INTERNAL_SERVER_ERROR', message, 500);
}
