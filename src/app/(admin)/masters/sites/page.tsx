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
import type { User } from '@/types/user';
import { USER_ROLE } from '@/types/user';

/** 現場ドキュメント型 */
interface Site {
  id: string;
  siteCode: string;
  siteName: string;
  supervisorIds: string[];
  isActive: boolean;
}

/** 現場フォームの状態型 */
interface SiteFormState {
  siteCode: string;
  siteName: string;
  supervisorIds: string[];
  isActive: boolean;
}

const INITIAL_FORM: SiteFormState = {
  siteCode: '',
  siteName: '',
  supervisorIds: [],
  isActive: true,
};

/** 現場マスター管理画面 */
export default function SitesPage() {
  const queryClient = useQueryClient();
  const [dialogMode, setDialogMode] = useState<'create' | 'edit' | null>(null);
  const [editTarget, setEditTarget] = useState<Site | null>(null);
  const [form, setForm] = useState<SiteFormState>(INITIAL_FORM);
  const [deleteTarget, setDeleteTarget] = useState<Site | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // 現場一覧の取得
  const { data: sitesData, isLoading: sitesLoading } = useQuery<{ sites: Site[] }>({
    queryKey: ['masters', 'sites'],
    queryFn: async () => {
      const token = await getIdToken();
      const res = await fetch('/api/masters/sites', {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (!res.ok) throw new Error('現場一覧の取得に失敗しました');
      const json = (await res.json()) as ApiSuccessResponse<{ sites: Site[] }>;
      return json.data;
    },
  });

  // Gロールのユーザー一覧の取得（担当監督選択用）
  const { data: usersData } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: async () => {
      const token = await getIdToken();
      const res = await fetch('/api/users', {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (!res.ok) throw new Error('ユーザー一覧の取得に失敗しました');
      const json = (await res.json()) as ApiSuccessResponse<User[]>;
      return json.data;
    },
  });

  const role = useAuthStore((state) => state.role);
  const isReadOnly = role === USER_ROLE.A_SPECIAL || role === USER_ROLE.B;

  const supervisorUsers = usersData?.filter((u) => u.role === USER_ROLE.G && u.isActive) ?? [];
  const sites = sitesData?.sites ?? [];

  // 現場作成のミューテーション
  const createMutation = useMutation({
    mutationFn: async (data: { siteCode: string; siteName: string; supervisorIds: string[] }) => {
      const token = await getIdToken();
      const res = await fetch('/api/masters/sites', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = (await res.json()) as { message?: string };
        throw new Error(err.message ?? '現場の作成に失敗しました');
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['masters', 'sites'] });
      setDialogMode(null);
      setForm(INITIAL_FORM);
      setFormError(null);
    },
    onError: (error: Error) => {
      setFormError(error.message);
    },
  });

  // 現場更新のミューテーション
  const updateMutation = useMutation({
    mutationFn: async (data: {
      id: string;
      siteName: string;
      supervisorIds: string[];
      isActive: boolean;
    }) => {
      const token = await getIdToken();
      const res = await fetch(`/api/masters/sites/${data.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          siteName: data.siteName,
          supervisorIds: data.supervisorIds,
          isActive: data.isActive,
        }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { message?: string };
        throw new Error(err.message ?? '現場の更新に失敗しました');
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['masters', 'sites'] });
      setDialogMode(null);
      setEditTarget(null);
      setForm(INITIAL_FORM);
      setFormError(null);
    },
    onError: (error: Error) => {
      setFormError(error.message);
    },
  });

  // 現場削除（論理削除）のミューテーション
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const token = await getIdToken();
      const res = await fetch(`/api/masters/sites/${id}`, {
        method: 'DELETE',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (!res.ok) {
        const err = (await res.json()) as { message?: string };
        throw new Error(err.message ?? '現場の削除に失敗しました');
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['masters', 'sites'] });
      setDeleteTarget(null);
    },
  });

  function openCreateDialog() {
    setForm(INITIAL_FORM);
    setFormError(null);
    setEditTarget(null);
    setDialogMode('create');
  }

  function openEditDialog(site: Site) {
    setForm({
      siteCode: site.siteCode,
      siteName: site.siteName,
      supervisorIds: site.supervisorIds,
      isActive: site.isActive,
    });
    setFormError(null);
    setEditTarget(site);
    setDialogMode('edit');
  }

  function handleSubmit() {
    if (!form.siteCode.trim()) {
      setFormError('現場コードを入力してください');
      return;
    }
    if (!form.siteName.trim()) {
      setFormError('現場名を入力してください');
      return;
    }

    if (dialogMode === 'create') {
      createMutation.mutate({
        siteCode: form.siteCode.trim(),
        siteName: form.siteName.trim(),
        supervisorIds: form.supervisorIds,
      });
    } else if (dialogMode === 'edit' && editTarget) {
      updateMutation.mutate({
        id: editTarget.id,
        siteName: form.siteName.trim(),
        supervisorIds: form.supervisorIds,
        isActive: form.isActive,
      });
    }
  }

  function toggleSupervisor(userId: string) {
    setForm((prev) => ({
      ...prev,
      supervisorIds: prev.supervisorIds.includes(userId)
        ? prev.supervisorIds.filter((id) => id !== userId)
        : [...prev.supervisorIds, userId],
    }));
  }

  function getSupervisorNames(supervisorIds: string[]): string {
    if (supervisorIds.length === 0) return '-';
    return supervisorIds
      .map((id) => usersData?.find((u) => u.id === id)?.displayName ?? id)
      .join(', ');
  }

  const isMutating = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">現場マスター管理</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            現場コード・現場名・担当監督を管理します
          </p>
          {isReadOnly && (
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
              閲覧専用です。編集操作はできません。
            </div>
          )}
        </div>
        <Button onClick={openCreateDialog} disabled={isReadOnly}>+ 現場を追加</Button>
      </div>

      {sitesLoading ? (
        <p className="text-center py-8 text-muted-foreground">読み込み中...</p>
      ) : sites.length > 0 ? (
        <div className="rounded-lg border bg-white overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>現場コード</TableHead>
                <TableHead>現場名</TableHead>
                <TableHead>担当監督</TableHead>
                <TableHead>状態</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sites.map((site) => (
                <TableRow key={site.id}>
                  <TableCell className="font-mono text-sm">{site.siteCode}</TableCell>
                  <TableCell className="font-medium">{site.siteName}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {getSupervisorNames(site.supervisorIds)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={site.isActive ? 'outline' : 'destructive'}>
                      {site.isActive ? '有効' : '無効'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditDialog(site)}
                        disabled={isReadOnly}
                      >
                        編集
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setDeleteTarget(site)}
                        disabled={!site.isActive || isReadOnly}
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
        <p className="text-center py-8 text-muted-foreground">現場データがありません</p>
      )}

      {/* 作成・編集ダイアログ */}
      <Dialog open={dialogMode !== null} onOpenChange={(open) => { if (!open) { setDialogMode(null); setFormError(null); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {dialogMode === 'create' ? '現場を追加' : '現場を編集'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="siteCode">
                現場コード <span className="text-destructive">*</span>
              </Label>
              <Input
                id="siteCode"
                value={form.siteCode}
                onChange={(e) => setForm((prev) => ({ ...prev, siteCode: e.target.value }))}
                placeholder="例: SITE-001"
                disabled={dialogMode === 'edit'} // 編集時は変更不可
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="siteName">
                現場名 <span className="text-destructive">*</span>
              </Label>
              <Input
                id="siteName"
                value={form.siteName}
                onChange={(e) => setForm((prev) => ({ ...prev, siteName: e.target.value }))}
                placeholder="例: 〇〇ビル新築工事"
              />
            </div>

            <div className="space-y-2">
              <Label>担当現場監督（複数選択可）</Label>
              {supervisorUsers.length > 0 ? (
                <div className="space-y-2 max-h-40 overflow-y-auto rounded border p-2">
                  {supervisorUsers.map((user) => (
                    <div key={user.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`supervisor-${user.id}`}
                        checked={form.supervisorIds.includes(user.id)}
                        onCheckedChange={() => toggleSupervisor(user.id)}
                      />
                      <Label htmlFor={`supervisor-${user.id}`} className="cursor-pointer font-normal">
                        {user.displayName}
                      </Label>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  現場監督（Gロール）のユーザーがいません
                </p>
              )}
            </div>

            {dialogMode === 'edit' && (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="isActive"
                  checked={form.isActive}
                  onCheckedChange={(checked) =>
                    setForm((prev) => ({ ...prev, isActive: checked === true }))
                  }
                />
                <Label htmlFor="isActive" className="cursor-pointer font-normal">
                  有効（チェックを外すと無効化されます）
                </Label>
              </div>
            )}

            {formError && (
              <p className="text-sm text-destructive">{formError}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setDialogMode(null); setFormError(null); }}
            >
              キャンセル
            </Button>
            <Button onClick={handleSubmit} disabled={isMutating}>
              {isMutating ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 削除確認ダイアログ */}
      <Dialog open={deleteTarget !== null} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>現場を削除（無効化）しますか？</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            「{deleteTarget?.siteName}」を無効化します。この操作は元に戻せますが、
            無効化された現場は日報の現場選択に表示されなくなります。
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
