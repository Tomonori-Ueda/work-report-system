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
import type { ApiSuccessResponse } from '@/types/api';

/** 協力会社ドキュメント型 */
interface Subcontractor {
  id: string;
  companyName: string;
  contactPerson: string | null;
  unitPrice: number | null;
  isActive: boolean;
}

/** フォームの状態型 */
interface SubcontractorFormState {
  companyName: string;
  contactPerson: string;
  unitPrice: string;
  isActive: boolean;
}

const INITIAL_FORM: SubcontractorFormState = {
  companyName: '',
  contactPerson: '',
  unitPrice: '',
  isActive: true,
};

/** 協力会社マスター管理画面 */
export default function SubcontractorsPage() {
  const queryClient = useQueryClient();
  const [dialogMode, setDialogMode] = useState<'create' | 'edit' | null>(null);
  const [editTarget, setEditTarget] = useState<Subcontractor | null>(null);
  const [form, setForm] = useState<SubcontractorFormState>(INITIAL_FORM);
  const [deleteTarget, setDeleteTarget] = useState<Subcontractor | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // 協力会社一覧の取得
  const { data, isLoading } = useQuery<{ subcontractors: Subcontractor[] }>({
    queryKey: ['masters', 'subcontractors'],
    queryFn: async () => {
      const token = await getIdToken();
      const res = await fetch('/api/masters/subcontractors', {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (!res.ok) throw new Error('協力会社一覧の取得に失敗しました');
      const json = (await res.json()) as ApiSuccessResponse<{ subcontractors: Subcontractor[] }>;
      return json.data;
    },
  });

  const subcontractors = data?.subcontractors ?? [];

  // 協力会社作成
  const createMutation = useMutation({
    mutationFn: async (payload: {
      companyName: string;
      contactPerson: string | null;
      unitPrice: number | null;
    }) => {
      const token = await getIdToken();
      const res = await fetch('/api/masters/subcontractors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = (await res.json()) as { message?: string };
        throw new Error(err.message ?? '協力会社の作成に失敗しました');
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['masters', 'subcontractors'] });
      setDialogMode(null);
      setForm(INITIAL_FORM);
      setFormError(null);
    },
    onError: (error: Error) => setFormError(error.message),
  });

  // 協力会社更新
  const updateMutation = useMutation({
    mutationFn: async (payload: {
      id: string;
      companyName: string;
      contactPerson: string | null;
      unitPrice: number | null;
      isActive: boolean;
    }) => {
      const token = await getIdToken();
      const res = await fetch(`/api/masters/subcontractors/${payload.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          companyName: payload.companyName,
          contactPerson: payload.contactPerson,
          unitPrice: payload.unitPrice,
          isActive: payload.isActive,
        }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { message?: string };
        throw new Error(err.message ?? '協力会社の更新に失敗しました');
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['masters', 'subcontractors'] });
      setDialogMode(null);
      setEditTarget(null);
      setForm(INITIAL_FORM);
      setFormError(null);
    },
    onError: (error: Error) => setFormError(error.message),
  });

  // 協力会社削除（論理削除）
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const token = await getIdToken();
      const res = await fetch(`/api/masters/subcontractors/${id}`, {
        method: 'DELETE',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (!res.ok) {
        const err = (await res.json()) as { message?: string };
        throw new Error(err.message ?? '協力会社の削除に失敗しました');
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['masters', 'subcontractors'] });
      setDeleteTarget(null);
    },
  });

  function openCreateDialog() {
    setForm(INITIAL_FORM);
    setFormError(null);
    setEditTarget(null);
    setDialogMode('create');
  }

  function openEditDialog(sub: Subcontractor) {
    setForm({
      companyName: sub.companyName,
      contactPerson: sub.contactPerson ?? '',
      unitPrice: sub.unitPrice !== null ? String(sub.unitPrice) : '',
      isActive: sub.isActive,
    });
    setFormError(null);
    setEditTarget(sub);
    setDialogMode('edit');
  }

  function handleSubmit() {
    if (!form.companyName.trim()) {
      setFormError('会社名を入力してください');
      return;
    }

    const unitPriceNum = form.unitPrice !== '' ? Number(form.unitPrice) : null;
    if (form.unitPrice !== '' && (isNaN(unitPriceNum!) || unitPriceNum! < 0)) {
      setFormError('単価は0以上の数値を入力してください');
      return;
    }

    const payload = {
      companyName: form.companyName.trim(),
      contactPerson: form.contactPerson.trim() || null,
      unitPrice: unitPriceNum,
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
          <h1 className="text-2xl font-bold">協力会社マスター管理</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            協力会社・担当者・単価情報を管理します
          </p>
        </div>
        <Button onClick={openCreateDialog}>+ 協力会社を追加</Button>
      </div>

      {isLoading ? (
        <p className="text-center py-8 text-muted-foreground">読み込み中...</p>
      ) : subcontractors.length > 0 ? (
        <div className="rounded-lg border bg-white overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>会社名</TableHead>
                <TableHead>担当者</TableHead>
                <TableHead className="text-right">単価</TableHead>
                <TableHead>状態</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subcontractors.map((sub) => (
                <TableRow key={sub.id}>
                  <TableCell className="font-medium">{sub.companyName}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {sub.contactPerson ?? '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    {sub.unitPrice !== null
                      ? `¥${sub.unitPrice.toLocaleString('ja-JP')}`
                      : '-'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={sub.isActive ? 'outline' : 'destructive'}>
                      {sub.isActive ? '有効' : '無効'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditDialog(sub)}
                      >
                        編集
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setDeleteTarget(sub)}
                        disabled={!sub.isActive}
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
        <p className="text-center py-8 text-muted-foreground">協力会社データがありません</p>
      )}

      {/* 作成・編集ダイアログ */}
      <Dialog
        open={dialogMode !== null}
        onOpenChange={(open) => { if (!open) { setDialogMode(null); setFormError(null); } }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {dialogMode === 'create' ? '協力会社を追加' : '協力会社を編集'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="companyName">
                会社名 <span className="text-destructive">*</span>
              </Label>
              <Input
                id="companyName"
                value={form.companyName}
                onChange={(e) => setForm((prev) => ({ ...prev, companyName: e.target.value }))}
                placeholder="例: 〇〇建設株式会社"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contactPerson">担当者</Label>
              <Input
                id="contactPerson"
                value={form.contactPerson}
                onChange={(e) => setForm((prev) => ({ ...prev, contactPerson: e.target.value }))}
                placeholder="例: 山田太郎"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="unitPrice">単価（円）</Label>
              <Input
                id="unitPrice"
                type="number"
                min={0}
                value={form.unitPrice}
                onChange={(e) => setForm((prev) => ({ ...prev, unitPrice: e.target.value }))}
                placeholder="例: 50000"
              />
            </div>

            {dialogMode === 'edit' && (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="subIsActive"
                  checked={form.isActive}
                  onCheckedChange={(checked) =>
                    setForm((prev) => ({ ...prev, isActive: checked === true }))
                  }
                />
                <Label htmlFor="subIsActive" className="cursor-pointer font-normal">
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
            <Button onClick={handleSubmit} disabled={isMutating}>
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
            <DialogTitle>協力会社を削除（無効化）しますか？</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            「{deleteTarget?.companyName}」を無効化します。
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
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? '削除中...' : '削除（無効化）'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
