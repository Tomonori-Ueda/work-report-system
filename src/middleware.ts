import { NextRequest, NextResponse } from 'next/server';

/** 公開ルート（認証不要） */
const PUBLIC_PATHS = ['/login', '/api/auth'];

/** 静的ファイルやNext.js内部パス（ルートガード対象外） */
const IGNORED_PATHS = ['/_next', '/favicon.ico', '/api/auth'];

/** 管理者系ロール（S, A, A_special, B） */
const ADMIN_ROLES = ['S', 'A', 'A_special', 'B'];

/** 現場監督ロール（G） */
const SUPERVISOR_ROLES = ['G'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 静的ファイル・APIルートは無視
  if (IGNORED_PATHS.some((path) => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  const session = request.cookies.get('__session')?.value;
  const role = request.cookies.get('__role')?.value;

  // 未認証で保護ルートにアクセス → ログインへリダイレクト
  if (!session && !PUBLIC_PATHS.some((path) => pathname.startsWith(path))) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // 認証済みの場合のロールベースリダイレクト
  if (session && role) {
    const isAdmin = ADMIN_ROLES.includes(role);
    const isSupervisor = SUPERVISOR_ROLES.includes(role);

    // ルートページ → ロール別リダイレクト
    if (pathname === '/') {
      if (isAdmin) return NextResponse.redirect(new URL('/dashboard', request.url));
      // 将来: 現場監督は /field-report/history に遷移予定。現時点は /dashboard
      if (isSupervisor) return NextResponse.redirect(new URL('/field-report/history', request.url));
      return NextResponse.redirect(new URL('/report/history', request.url));
    }

    // 現場監督（G）は /reports/[id] 個別詳細ページのみアクセス許可（確認操作のため）
    // /reports 一覧・/reports/mismatch 等はブロック
    const isSupervisorReportDetail =
      isSupervisor && /^\/reports\/[^/]+$/.test(pathname);

    // 管理者エリアへの非管理者アクセスをブロック
    const adminPaths = ['/dashboard', '/reports', '/employees', '/salary', '/masters', '/leave-calendar'];
    if (adminPaths.some((p) => pathname.startsWith(p)) && !isAdmin && !isSupervisorReportDetail) {
      if (isSupervisor) return NextResponse.redirect(new URL('/field-report/history', request.url));
      return NextResponse.redirect(new URL('/report/history', request.url));
    }

    // 現場日報エリアへの非監督者・非管理者アクセスをブロック
    if (pathname.startsWith('/field-report') && !isSupervisor && !isAdmin) {
      return NextResponse.redirect(new URL('/report/history', request.url));
    }

    // 管理者が作業員エリアにアクセス → dashboardへリダイレクト
    // NOTE: '/report'（作業員）と '/reports'（管理者）を区別するため
    //       完全一致またはセグメント先頭一致（/report/）でチェックする
    const workerPaths = ['/report', '/leave'];
    if (
      workerPaths.some((p) => pathname === p || pathname.startsWith(p + '/')) &&
      isAdmin
    ) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
