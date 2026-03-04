import 'server-only';

import { getAdminAuth } from './admin';

/** 認証情報 */
export interface AuthInfo {
  uid: string;
  role: string;
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
    const role = (decoded['role'] as string) ?? 'worker';
    return { uid: decoded.uid, role };
  } catch {
    return null;
  }
}
