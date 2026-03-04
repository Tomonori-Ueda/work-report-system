import { create } from 'zustand';

interface UiState {
  /** サイドバーの開閉状態（管理者画面） */
  isSidebarOpen: boolean;
  /** サイドバー開閉を切り替え */
  toggleSidebar: () => void;
  /** サイドバーを閉じる */
  closeSidebar: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  isSidebarOpen: false,
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  closeSidebar: () => set({ isSidebarOpen: false }),
}));
