import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAdminAuth, getAdminDb } from '@/lib/firebase/admin';
import type { UserRole } from '@/types/user';

/** セッションCookie名 */
const SESSION_COOKIE = '__session';
/** ロールCookie名 */
const ROLE_COOKIE = '__role';
/** セッション有効期間（5日） */
const SESSION_MAX_AGE = 60 * 60 * 24 * 5;

/** Firestoreからユーザーロールを取得する */
async function fetchUserRoleFromFirestore(uid: string): Promise<UserRole | null> {
  try {
    const db = getAdminDb();
    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists) return null;
    const data = userDoc.data();
    return (data?.role as UserRole) ?? null;
  } catch {
    // Firestoreアクセス失敗時はnullを返す（Cookieをセットしない）
    return null;
  }
}

/** POST: IDトークンをセッションCookieにセット。同時に __role Cookieもセット */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { idToken?: string; role?: UserRole };
    const { idToken, role: roleFromBody } = body;

    if (!idToken) {
      return NextResponse.json(
        { error: 'INVALID_REQUEST', message: 'IDトークンが必要です' },
        { status: 400 }
      );
    }

    // IDトークンを検証してUIDを取得
    let uid: string;
    try {
      const decoded = await getAdminAuth().verifyIdToken(idToken);
      uid = decoded.uid;
    } catch {
      return NextResponse.json(
        { error: 'INVALID_TOKEN', message: 'IDトークンの検証に失敗しました' },
        { status: 401 }
      );
    }

    // roleはリクエストボディから優先して使用。なければFirestoreから取得
    const role: UserRole | null = roleFromBody ?? (await fetchUserRoleFromFirestore(uid));

    const cookieStore = await cookies();

    // セッションCookieをセット
    cookieStore.set(SESSION_COOKIE, idToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_MAX_AGE,
    });

    // ロールCookieをセット（roleが取得できた場合のみ）
    if (role) {
      cookieStore.set(ROLE_COOKIE, role, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: SESSION_MAX_AGE,
        path: '/',
      });
    }

    return NextResponse.json({ data: { success: true, role: role ?? null } });
  } catch {
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'セッションの作成に失敗しました' },
      { status: 500 }
    );
  }
}

/** DELETE: セッションCookieと __role Cookieを削除（ログアウト） */
export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  cookieStore.delete(ROLE_COOKIE);

  return NextResponse.json({ data: { success: true } });
}
