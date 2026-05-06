import { create } from 'zustand';
import type { UserRole, ExecutiveTitle } from '@/types/user';

interface AuthState {
  /** Firebase UID */
  uid: string | null;
  /** メールアドレス */
  email: string | null;
  /** 表示名 */
  displayName: string | null;
  /** ユーザーロール */
  role: UserRole | null;
  /**
   * 4枠承認の役職タイトル。ロール A の中で専務/常務を区別するために使う。
   * AuthProvider が users ドキュメントから取得して埋める。
   */
  executiveTitle: ExecutiveTitle | null;
  /** 認証状態の読み込み中 */
  isLoading: boolean;
  /** 認証状態をセット */
  setAuth: (params: {
    uid: string;
    email: string | null;
    displayName: string | null;
    role: UserRole | null;
    executiveTitle: ExecutiveTitle | null;
  }) => void;
  /** 認証状態をクリア */
  clearAuth: () => void;
  /** ローディング状態をセット */
  setLoading: (isLoading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  uid: null,
  email: null,
  displayName: null,
  role: null,
  executiveTitle: null,
  isLoading: true,
  setAuth: ({ uid, email, displayName, role, executiveTitle }) =>
    set({ uid, email, displayName, role, executiveTitle, isLoading: false }),
  clearAuth: () =>
    set({
      uid: null,
      email: null,
      displayName: null,
      role: null,
      executiveTitle: null,
      isLoading: false,
    }),
  setLoading: (isLoading) => set({ isLoading }),
}));
