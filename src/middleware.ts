import { NextRequest, NextResponse } from 'next/server';

/** 公開ルート（認証不要） */
const PUBLIC_PATHS = ['/login', '/api/auth'];

/** 静的ファイルやNext.js内部パス */
const IGNORED_PATHS = ['/_next', '/favicon.ico', '/api/auth'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 静的ファイルは無視
  if (IGNORED_PATHS.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // セッションCookieの存在チェック
  const session = request.cookies.get('__session')?.value;

  // 未認証で保護ルートにアクセス → ログインへリダイレクト
  if (!session && !PUBLIC_PATHS.some((path) => pathname.startsWith(path))) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  // 認証済みでログインページにアクセス → ルートへリダイレクト
  if (session && pathname === '/login') {
    const homeUrl = new URL('/', request.url);
    return NextResponse.redirect(homeUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
