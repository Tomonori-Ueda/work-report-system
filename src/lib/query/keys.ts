/** TanStack Query キー定数 */
export const queryKeys = {
  /** 日報関連 */
  reports: {
    all: ['reports'] as const,
    list: (filters?: object) =>
      ['reports', 'list', filters] as const,
    detail: (id: string) => ['reports', 'detail', id] as const,
  },
  /** ダッシュボード */
  dashboard: {
    status: (date: string) => ['dashboard', 'status', date] as const,
  },
  /** ユーザー */
  users: {
    all: ['users'] as const,
    detail: (id: string) => ['users', 'detail', id] as const,
  },
  /** 有給休暇 */
  leave: {
    requests: (filters?: object) =>
      ['leave', 'requests', filters] as const,
    balance: (userId: string) => ['leave', 'balance', userId] as const,
  },
} as const;
