'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { getIdToken } from '@/lib/firebase/auth';
import { queryKeys } from '@/lib/query/keys';
import { toast } from 'sonner';
import type { ApiSuccessResponse } from '@/types/api';
import type { User, UserRole } from '@/types/user';
import { USER_ROLE } from '@/types/user';
import { cn } from '@/lib/utils';

/** ロール表示名マップ */
const ROLE_LABEL: Record<UserRole, string> = {
  [USER_ROLE.S]: '社長 (S)',
  [USER_ROLE.A]: '専務・常務 (A)',
  [USER_ROLE.A_SPECIAL]: '総務部長 (A_special)',
  [USER_ROLE.B]: '施工部長 (B)',
  [USER_ROLE.G]: '現場監督 (G)',
  [USER_ROLE.GENERAL]: '一般 (general)',
};

/** ロールバッジのカラークラス */
function getRoleBadgeClass(role: UserRole): string {
  switch (role) {
    case USER_ROLE.S:
      return 'bg-red-100 text-red-700 border-red-200';
    case USER_ROLE.A:
      return 'bg-orange-100 text-orange-700 border-orange-200';
    case USER_ROLE.A_SPECIAL:
      return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    case USER_ROLE.B:
      return 'bg-purple-100 text-purple-700 border-purple-200';
    case USER_ROLE.G:
      return 'bg-blue-100 text-blue-700 border-blue-200';
    default:
      return 'bg-gray-100 text-gray-700 border-gray-200';
  }
}

/** 編集フォームの状態型 */
interface EditFormState {
  displayName: string;
  department: string;
  role: UserRole;
  hireDate: string;
  monthlySalary: string;
  annualLeaveBalance: string;
  isActive: boolean;
}

/** 新規登録フォームの状態型 */
interface CreateFormState {
  email: string;
  password: string;
  displayName: string;
  role: UserRole;
  department: string;
  hireDate: string;
  monthlySalary: string;
  annualLeaveBalance: string;
}

const DEFAULT_CREATE_FORM: CreateFormState = {
  email: '',
  password: '',
  displayName: '',
  role: USER_ROLE.GENERAL,
  department: '',
  hireDate: '',
  monthlySalary: '',
  annualLeaveBalance: '0',
};

/** 従業員管理画面 */
export default function EmployeesPage() {
  const queryClient = useQueryClient();
  const [editTarget, setEditTarget] = useState<User | null>(null);
  const [form, setForm] = useState<EditFormState | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createForm, setCreateForm] = useState<CreateFormState>(DEFAULT_CREATE_FORM);
  const [createError, setCreateError] = useState<string | null>(null);

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

  // ユーザー更新ミューテーション
  const updateMutation = useMutation({
    mutationFn: async (payload: {
      id: string;
      displayName: string;
      department: string | null;
      role: UserRole;
      hireDate: string | null;
      monthlySalary: number | null;
      annualLeaveBalance: number;
      isActive: boolean;
    }) => {
      const token = await getIdToken();
      const res = await fetch(`/api/users/${payload.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          displayName: payload.displayName,
          department: payload.department,
          role: payload.role,
          hireDate: payload.hireDate,
          monthlySalary: payload.monthlySalary,
          annualLeaveBalance: payload.annualLeaveBalance,
          isActive: payload.isActive,
        }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { message?: string };
        throw new Error(err.message ?? 'ユーザーの更新に失敗しました');
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
      toast.success('従業員情報を更新しました');
      setEditTarget(null);
      setForm(null);
      setFormError(null);
    },
    onError: (error: Error) => {
      setFormError(error.message);
    },
  });

  // 新規ユーザー作成ミューテーション
  const createMutation = useMutation({
    mutationFn: async (payload: {
      email: string;
      password: string;
      displayName: string;
      role: UserRole;
      department: string | null;
      hireDate: string | null;
      monthlySalary: number | null;
      annualLeaveBalance: number;
    }) => {
      const token = await getIdToken();
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as { message?: string };
      if (!res.ok) {
        throw new Error(json.message ?? 'ユーザーの登録に失敗しました');
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
      toast.success('従業員を登録しました');
      setShowCreateDialog(false);
      setCreateForm(DEFAULT_CREATE_FORM);
      setCreateError(null);
    },
    onError: (error: Error) => {
      setCreateError(error.message);
    },
  });

  function handleCreate() {
    if (!createForm.email.trim()) {
      setCreateError('メールアドレスを入力してください');
      return;
    }
    if (createForm.password.length < 8) {
      setCreateError('パスワードは8文字以上で入力してください');
      return;
    }
    if (!createForm.displayName.trim()) {
      setCreateError('表示名を入力してください');
      return;
    }
    const annualLeaveBalance = parseInt(createForm.annualLeaveBalance, 10);
    if (isNaN(annualLeaveBalance) || annualLeaveBalance < 0) {
      setCreateError('有給残日数は0以上の整数を入力してください');
      return;
    }
    const monthlySalary =
      createForm.monthlySalary !== '' ? Number(createForm.monthlySalary) : null;
    if (
      createForm.monthlySalary !== '' &&
      (isNaN(monthlySalary!) || monthlySalary! < 0)
    ) {
      setCreateError('月給は0以上の数値を入力してください');
      return;
    }

    createMutation.mutate({
      email: createForm.email.trim(),
      password: createForm.password,
      displayName: createForm.displayName.trim(),
      role: createForm.role,
      department: createForm.department.trim() || null,
      hireDate: createForm.hireDate || null,
      monthlySalary,
      annualLeaveBalance,
    });
  }

  function openEditDialog(user: User) {
    setForm({
      displayName: user.displayName,
      department: user.department ?? '',
      role: user.role,
      hireDate: user.hireDate ?? '',
      monthlySalary: user.monthlySalary !== null ? String(user.monthlySalary) : '',
      annualLeaveBalance: String(user.annualLeaveBalance),
      isActive: user.isActive,
    });
    setFormError(null);
    setEditTarget(user);
  }

  function handleSubmit() {
    if (!form || !editTarget) return;

    if (!form.displayName.trim()) {
      setFormError('表示名を入力してください');
      return;
    }

    const annualLeaveBalance = parseInt(form.annualLeaveBalance, 10);
    if (isNaN(annualLeaveBalance) || annualLeaveBalance < 0) {
      setFormError('有給残日数は0以上の整数を入力してください');
      return;
    }

    const monthlySalary = form.monthlySalary !== '' ? Number(form.monthlySalary) : null;
    if (form.monthlySalary !== '' && (isNaN(monthlySalary!) || monthlySalary! < 0)) {
      setFormError('月給は0以上の数値を入力してください');
      return;
    }

    if (form.hireDate !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(form.hireDate)) {
      setFormError('入社日は YYYY-MM-DD 形式で入力してください');
      return;
    }

    updateMutation.mutate({
      id: editTarget.id,
      displayName: form.displayName.trim(),
      department: form.department.trim() || null,
      role: form.role,
      hireDate: form.hireDate || null,
      monthlySalary,
      annualLeaveBalance,
      isActive: form.isActive,
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">従業員管理</h1>
        <Button onClick={() => { setShowCreateDialog(true); setCreateError(null); }}>
          + 新規登録
        </Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">読み込み中...</p>
      ) : users && users.length > 0 ? (
        <div className="rounded-lg border bg-white overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>名前</TableHead>
                <TableHead>メールアドレス</TableHead>
                <TableHead>部署</TableHead>
                <TableHead>権限ランク</TableHead>
                <TableHead>入社日</TableHead>
                <TableHead className="text-right">月給</TableHead>
                <TableHead className="text-center">有給残</TableHead>
                <TableHead>ステータス</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">
                    {user.displayName}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{user.email}</TableCell>
                  <TableCell>{user.department ?? '-'}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn('text-xs', getRoleBadgeClass(user.role))}
                    >
                      {user.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {user.hireDate ?? '-'}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {user.monthlySalary != null
                      ? `¥${user.monthlySalary.toLocaleString('ja-JP')}`
                      : '-'}
                  </TableCell>
                  <TableCell className="text-center">{user.annualLeaveBalance ?? 0}日</TableCell>
                  <TableCell>
                    <Badge
                      variant={user.isActive ? 'outline' : 'destructive'}
                    >
                      {user.isActive ? '有効' : '無効'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditDialog(user)}
                    >
                      <Pencil className="h-3 w-3 mr-1" />
                      編集
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <p className="text-center py-8 text-muted-foreground">
          従業員データがありません
        </p>
      )}

      {/* 新規登録ダイアログ */}
      <Dialog
        open={showCreateDialog}
        onOpenChange={(open) => {
          if (!open) {
            setShowCreateDialog(false);
            setCreateForm(DEFAULT_CREATE_FORM);
            setCreateError(null);
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>新規社員登録</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto pr-1">
            <div className="space-y-2">
              <Label htmlFor="createEmail">
                メールアドレス <span className="text-destructive">*</span>
              </Label>
              <Input
                id="createEmail"
                type="email"
                value={createForm.email}
                onChange={(e) =>
                  setCreateForm((prev) => ({ ...prev, email: e.target.value }))
                }
                placeholder="例: yamada@example.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="createPassword">
                パスワード <span className="text-destructive">*</span>
              </Label>
              <Input
                id="createPassword"
                type="password"
                value={createForm.password}
                onChange={(e) =>
                  setCreateForm((prev) => ({ ...prev, password: e.target.value }))
                }
                placeholder="8文字以上"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="createDisplayName">
                表示名 <span className="text-destructive">*</span>
              </Label>
              <Input
                id="createDisplayName"
                value={createForm.displayName}
                onChange={(e) =>
                  setCreateForm((prev) => ({ ...prev, displayName: e.target.value }))
                }
                placeholder="例: 山田 太郎"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="createRole">
                権限ランク <span className="text-destructive">*</span>
              </Label>
              <Select
                value={createForm.role}
                onValueChange={(val) =>
                  setCreateForm((prev) => ({ ...prev, role: val as UserRole }))
                }
              >
                <SelectTrigger id="createRole">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(ROLE_LABEL) as [UserRole, string][]).map(
                    ([roleVal, roleLabel]) => (
                      <SelectItem key={roleVal} value={roleVal}>
                        {roleLabel}
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="createDepartment">部署</Label>
              <Input
                id="createDepartment"
                value={createForm.department}
                onChange={(e) =>
                  setCreateForm((prev) => ({ ...prev, department: e.target.value }))
                }
                placeholder="例: 施工部"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="createHireDate">入社日</Label>
              <Input
                id="createHireDate"
                type="date"
                value={createForm.hireDate}
                onChange={(e) =>
                  setCreateForm((prev) => ({ ...prev, hireDate: e.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="createMonthlySalary">月給（円）</Label>
              <Input
                id="createMonthlySalary"
                type="number"
                min={0}
                value={createForm.monthlySalary}
                onChange={(e) =>
                  setCreateForm((prev) => ({ ...prev, monthlySalary: e.target.value }))
                }
                placeholder="例: 300000"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="createAnnualLeave">有給残日数</Label>
              <Input
                id="createAnnualLeave"
                type="number"
                min={0}
                value={createForm.annualLeaveBalance}
                onChange={(e) =>
                  setCreateForm((prev) => ({ ...prev, annualLeaveBalance: e.target.value }))
                }
              />
            </div>

            {createError && (
              <p className="text-sm text-destructive">{createError}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateDialog(false);
                setCreateForm(DEFAULT_CREATE_FORM);
                setCreateError(null);
              }}
            >
              キャンセル
            </Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? '登録中...' : '登録する'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 編集ダイアログ */}
      <Dialog
        open={editTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setEditTarget(null);
            setForm(null);
            setFormError(null);
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>社員情報を編集</DialogTitle>
          </DialogHeader>

          {form && (
            <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto pr-1">
              <div className="space-y-2">
                <Label htmlFor="editDisplayName">
                  表示名 <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="editDisplayName"
                  value={form.displayName}
                  onChange={(e) =>
                    setForm((prev) =>
                      prev ? { ...prev, displayName: e.target.value } : null
                    )
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="editDepartment">部署</Label>
                <Input
                  id="editDepartment"
                  value={form.department}
                  onChange={(e) =>
                    setForm((prev) =>
                      prev ? { ...prev, department: e.target.value } : null
                    )
                  }
                  placeholder="例: 施工部"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="editRole">
                  権限ランク <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={form.role}
                  onValueChange={(val) =>
                    setForm((prev) =>
                      prev ? { ...prev, role: val as UserRole } : null
                    )
                  }
                >
                  <SelectTrigger id="editRole">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.entries(ROLE_LABEL) as [UserRole, string][]).map(
                      ([roleVal, roleLabel]) => (
                        <SelectItem key={roleVal} value={roleVal}>
                          {roleLabel}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="editHireDate">入社日</Label>
                <Input
                  id="editHireDate"
                  type="date"
                  value={form.hireDate}
                  onChange={(e) =>
                    setForm((prev) =>
                      prev ? { ...prev, hireDate: e.target.value } : null
                    )
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="editMonthlySalary">月給（円）</Label>
                <Input
                  id="editMonthlySalary"
                  type="number"
                  min={0}
                  value={form.monthlySalary}
                  onChange={(e) =>
                    setForm((prev) =>
                      prev ? { ...prev, monthlySalary: e.target.value } : null
                    )
                  }
                  placeholder="例: 300000"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="editAnnualLeave">有給残日数</Label>
                <Input
                  id="editAnnualLeave"
                  type="number"
                  min={0}
                  value={form.annualLeaveBalance}
                  onChange={(e) =>
                    setForm((prev) =>
                      prev ? { ...prev, annualLeaveBalance: e.target.value } : null
                    )
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="editIsActive">ステータス</Label>
                <Select
                  value={form.isActive ? 'active' : 'inactive'}
                  onValueChange={(val) =>
                    setForm((prev) =>
                      prev ? { ...prev, isActive: val === 'active' } : null
                    )
                  }
                >
                  <SelectTrigger id="editIsActive">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">有効</SelectItem>
                    <SelectItem value="inactive">無効</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formError && (
                <p className="text-sm text-destructive">{formError}</p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditTarget(null);
                setForm(null);
                setFormError(null);
              }}
            >
              キャンセル
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
