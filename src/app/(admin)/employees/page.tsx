'use client';

import { useQuery } from '@tanstack/react-query';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { getIdToken } from '@/lib/firebase/auth';
import { queryKeys } from '@/lib/query/keys';
import type { ApiSuccessResponse } from '@/types/api';
import type { User } from '@/types/user';
import { USER_ROLE } from '@/types/user';

/** S008: 従業員管理画面 */
export default function EmployeesPage() {
  const { data: users, isLoading } = useQuery({
    queryKey: queryKeys.users.all,
    queryFn: async (): Promise<User[]> => {
      const token = await getIdToken();
      const res = await fetch('/api/users', {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) throw new Error('ユーザー一覧の取得に失敗しました');
      const json = (await res.json()) as ApiSuccessResponse<User[]>;
      return json.data;
    },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">従業員管理</h1>

      {isLoading ? (
        <p className="text-muted-foreground">読み込み中...</p>
      ) : users && users.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>名前</TableHead>
              <TableHead>メールアドレス</TableHead>
              <TableHead>部署</TableHead>
              <TableHead>ロール</TableHead>
              <TableHead>有給残日数</TableHead>
              <TableHead>ステータス</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">
                  {user.displayName}
                </TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>{user.department ?? '-'}</TableCell>
                <TableCell>
                  <Badge
                    variant={
                      user.role === USER_ROLE.ADMIN ? 'default' : 'secondary'
                    }
                  >
                    {user.role === USER_ROLE.ADMIN ? '管理者' : '作業員'}
                  </Badge>
                </TableCell>
                <TableCell>{user.annualLeaveBalance}日</TableCell>
                <TableCell>
                  <Badge
                    variant={user.isActive ? 'outline' : 'destructive'}
                  >
                    {user.isActive ? '有効' : '無効'}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <p className="text-center py-8 text-muted-foreground">
          従業員データがありません
        </p>
      )}
    </div>
  );
}
