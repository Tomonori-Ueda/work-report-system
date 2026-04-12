import 'server-only';

import { getAdminAuth } from './admin';
import type { UserRole } from '@/types/user';
import { USER_ROLE } from '@/types/user';

/** 認証情報 */
export interface AuthInfo {
  uid: string;
  role: UserRole;
}

/**
 * APIリクエストのIDトークンを検証し、認証情報を返す
 * 認証失敗時はnullを返す
 */
export async function verifyAuth(request: Request): Promise<AuthInfo | null> {
  const authHeader = request.headers.get('Authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice(7);

  try {
    const decoded = await getAdminAuth().verifyIdToken(token);
    // カスタムクレームにroleがない場合は一般ユーザー（general）をデフォルトとする
    const role = ((decoded['role'] as string) ?? USER_ROLE.GENERAL) as UserRole;
    return { uid: decoded.uid, role };
  } catch {
    return null;
  }
}
