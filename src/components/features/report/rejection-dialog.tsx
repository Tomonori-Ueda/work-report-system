'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  rejectReportSchema,
  type RejectReportFormValues,
} from '@/lib/validations/report';

interface RejectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => void;
  isPending: boolean;
}

/** 差し戻し理由入力ダイアログ */
export function RejectionDialog({
  open,
  onOpenChange,
  onConfirm,
  isPending,
}: RejectionDialogProps) {
  const form = useForm<RejectReportFormValues>({
    resolver: zodResolver(rejectReportSchema),
    defaultValues: { rejectReason: '' },
  });

  function handleSubmit(values: RejectReportFormValues) {
    onConfirm(values.rejectReason);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>日報の差し戻し</DialogTitle>
          <DialogDescription>
            差し戻し理由を入力してください。作業員に通知されます。
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="rejectReason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>差し戻し理由</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="差し戻し理由を入力してください"
                      rows={4}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                キャンセル
              </Button>
              <Button type="submit" variant="destructive" disabled={isPending}>
                {isPending ? '処理中...' : '差し戻す'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
