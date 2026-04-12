'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { getIdToken } from '@/lib/firebase/auth';
import { useAuthStore } from '@/stores/auth-store';
import type { ApiSuccessResponse } from '@/types/api';
import { USER_ROLE } from '@/types/user';

/** 作業内容ドキュメント型 */
interface WorkType {
  id: string;
  name: string;
  category: string | null;
  sortOrder: number;
  isActive: boolean;
}

/** フォームの状態型 */
interface WorkTypeFormState {
  name: string;
  category: string;
  sortOrder: string;
  isActive: boolean;
}

const INITIAL_FORM: WorkTypeFormState = {
  name: '',
  category: '',
  sortOrder: '0',
  isActive: true,
};

/** 作業内容マスター管理画面 */
export default function WorkTypesPage() {
  const queryClient = useQueryClient();
  const [dialogMode, setDialogMode] = useState<'create' | 'edit' | null>(null);
  const [editTarget, setEditTarget] = useState<WorkType | null>(null);
  const [form, setForm] = useState<WorkTypeFormState>(INITIAL_FORM);
  const [deleteTarget, setDeleteTarget] = useState<WorkType | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // 作業内容一覧の取得
  const { data, isLoading } = useQuery<{ workTypes: WorkType[] }>({
    queryKey: ['masters', 'workTypes'],
    queryFn: async () => {
      const token = await getIdToken();
      const res = await fetch('/api/masters/work-types', {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (!res.ok) throw new Error('作業内容一覧の取得に失敗しました');
      const json = (await res.json()) as ApiSuccessResponse<{ workTypes: WorkType[] }>;
      return json.data;
    },
  });

  const role = useAuthStore((state) => state.role);
  const isReadOnly = role === USER_ROLE.A_SPECIAL || role === USER_ROLE.B;

  const workTypes = data?.workTypes ?? [];

  // 作業内容作成
  const createMutation = useMutation({
    mutationFn: async (payload: {
      name: string;
      category: string | null;
      sortOrder: number;
    }) => {
      const token = await getIdToken();
      const res = await fetch('/api/masters/work-types', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = (await res.json()) as { message?: string };
        throw new Error(err.message ?? '作業内容の作成に失敗しました');
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['masters', 'workTypes'] });
      setDialogMode(null);
      setForm(INITIAL_FORM);
      setFormError(null);
    },
    onError: (error: Error) => setFormError(error.message),
  });

  // 作業内容更新
  const updateMutation = useMutation({
    mutationFn: async (payload: {
      id: string;
      name: string;
      category: string | null;
      sortOrder: number;
      isActive: boolean;
    }) => {
      const token = await getIdToken();
      const res = await fetch(`/api/masters/work-types/${payload.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name: payload.name,
          category: payload.category,
          sortOrder: payload.sortOrder,
          isActive: payload.isActive,
        }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { message?: string };
        throw new Error(err.message ?? '作業内容の更新に失敗しました');
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['masters', 'workTypes'] });
      setDialogMode(null);
      setEditTarget(null);
      setForm(INITIAL_FORM);
      setFormError(null);
    },
    onError: (error: Error) => setFormError(error.message),
  });

  // 作業内容削除（論理削除）
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const token = await getIdToken();
      const res = await fetch(`/api/masters/work-types/${id}`, {
        method: 'DELETE',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (!res.ok) {
        const err = (await res.json()) as { message?: string };
        throw new Error(err.message ?? '作業内容の削除に失敗しました');
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['masters', 'workTypes'] });
      setDeleteTarget(null);
    },
  });

  function openCreateDialog() {
    setForm(INITIAL_FORM);
    setFormError(null);
    setEditTarget(null);
    setDialogMode('create');
  }

  function openEditDialog(wt: WorkType) {
    setForm({
      name: wt.name,
      category: wt.category ?? '',
      sortOrder: String(wt.sortOrder),
      isActive: wt.isActive,
    });
    setFormError(null);
    setEditTarget(wt);
    setDialogMode('edit');
  }

  function handleSubmit() {
    if (!form.name.trim()) {
      setFormError('作業名を入力してください');
      return;
    }

    const sortOrderNum = parseInt(form.sortOrder, 10);
    if (isNaN(sortOrderNum) || sortOrderNum < 0) {
      setFormError('並び順は0以上の整数を入力してください');
      return;
    }

    const payload = {
      name: form.name.trim(),
      category: form.category.trim() || null,
      sortOrder: sortOrderNum,
    };

    if (dialogMode === 'create') {
      createMutation.mutate(payload);
    } else if (dialogMode === 'edit' && editTarget) {
      updateMutation.mutate({ id: editTarget.id, ...payload, isActive: form.isActive });
    }
  }

  const isMutating = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">作業内容マスター管理</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            作業種別・カテゴリ・表示順を管理します
          </p>
          {isReadOnly && (
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
              閲覧専用です。編集操作はできません。
            </div>
          )}
        </div>
        <Button onClick={openCreateDialog} disabled={isReadOnly}>+ 作業内容を追加</Button>
      </div>

      {isLoading ? (
        <p className="text-center py-8 text-muted-foreground">読み込み中...</p>
      ) : workTypes.length > 0 ? (
        <div className="rounded-lg border bg-white overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>作業名</TableHead>
                <TableHead>カテゴリ</TableHead>
                <TableHead className="text-center">並び順</TableHead>
                <TableHead>状態</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {workTypes.map((wt) => (
                <TableRow key={wt.id}>
                  <TableCell className="font-medium">{wt.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {wt.category ?? '-'}
                  </TableCell>
                  <TableCell className="text-center">{wt.sortOrder}</TableCell>
                  <TableCell>
                    <Badge variant={wt.isActive ? 'outline' : 'destructive'}>
                      {wt.isActive ? '有効' : '無効'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditDialog(wt)}
                        disabled={isReadOnly}
                      >
                        編集
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setDeleteTarget(wt)}
                        disabled={!wt.isActive || isReadOnly}
                      >
                        削除
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <p className="text-center py-8 text-muted-foreground">作業内容データがありません</p>
      )}

      {/* 作成・編集ダイアログ */}
      <Dialog
        open={dialogMode !== null}
        onOpenChange={(open) => { if (!open) { setDialogMode(null); setFormError(null); } }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {dialogMode === 'create' ? '作業内容を追加' : '作業内容を編集'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="workTypeName">
                作業名 <span className="text-destructive">*</span>
              </Label>
              <Input
                id="workTypeName"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="例: 鉄骨組立"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="workTypeCategory">カテゴリ</Label>
              <Input
                id="workTypeCategory"
                value={form.category}
                onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
                placeholder="例: 躯体工事"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sortOrder">並び順</Label>
              <Input
                id="sortOrder"
                type="number"
                min={0}
                value={form.sortOrder}
                onChange={(e) => setForm((prev) => ({ ...prev, sortOrder: e.target.value }))}
                placeholder="0"
              />
            </div>

            {dialogMode === 'edit' && (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="wtIsActive"
                  checked={form.isActive}
                  onCheckedChange={(checked) =>
                    setForm((prev) => ({ ...prev, isActive: checked === true }))
                  }
                />
                <Label htmlFor="wtIsActive" className="cursor-pointer font-normal">
                  有効（チェックを外すと無効化されます）
                </Label>
              </div>
            )}

            {formError && <p className="text-sm text-destructive">{formError}</p>}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setDialogMode(null); setFormError(null); }}
            >
              キャンセル
            </Button>
            <Button onClick={handleSubmit} disabled={isMutating || isReadOnly}>
              {isMutating ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 削除確認ダイアログ */}
      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>作業内容を削除（無効化）しますか？</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            「{deleteTarget?.name}」を無効化します。
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              キャンセル
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
              }}
              disabled={deleteMutation.isPending || isReadOnly}
            >
              {deleteMutation.isPending ? '削除中...' : '削除（無効化）'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
