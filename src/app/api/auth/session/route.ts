import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

/** セッションCookie名 */
const SESSION_COOKIE = '__session';
/** セッション有効期間（5日） */
const SESSION_MAX_AGE = 60 * 60 * 24 * 5;

/** POST: IDトークンをセッションCookieにセット */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { idToken?: string };
    const idToken = body.idToken;

    if (!idToken) {
      return NextResponse.json(
        { error: 'INVALID_REQUEST', message: 'IDトークンが必要です' },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE, idToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_MAX_AGE,
    });

    return NextResponse.json({ data: { success: true } });
  } catch {
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'セッションの作成に失敗しました' },
      { status: 500 }
    );
  }
}

/** DELETE: セッションCookieを削除（ログアウト） */
export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);

  return NextResponse.json({ data: { success: true } });
}
