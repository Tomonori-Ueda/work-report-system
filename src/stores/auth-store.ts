import { create } from 'zustand';
import type { UserRole } from '@/types/user';

interface AuthState {
  /** Firebase UID */
  uid: string | null;
  /** メールアドレス */
  email: string | null;
  /** 表示名 */
  displayName: string | null;
  /** ユーザーロール */
  role: UserRole | null;
  /** 認証状態の読み込み中 */
  isLoading: boolean;
  /** 認証状態をセット */
  setAuth: (params: {
    uid: string;
    email: string | null;
    displayName: string | null;
    role: UserRole | null;
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
  isLoading: true,
  setAuth: ({ uid, email, displayName, role }) =>
    set({ uid, email, displayName, role, isLoading: false }),
  clearAuth: () =>
    set({
      uid: null,
      email: null,
      displayName: null,
      role: null,
      isLoading: false,
    }),
  setLoading: (isLoading) => set({ isLoading }),
}));
