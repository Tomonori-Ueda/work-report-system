'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCreateLeaveRequest } from '@/hooks/use-leave';
import {
  createLeaveRequestSchema,
  type CreateLeaveRequestFormValues,
} from '@/lib/validations/leave';
import { LEAVE_TYPE } from '@/types/leave';
import { formatDateToISO } from '@/lib/utils/date';

/** 有給申請フォーム */
export function LeaveRequestForm() {
  const createRequest = useCreateLeaveRequest();

  const form = useForm<CreateLeaveRequestFormValues>({
    resolver: zodResolver(createLeaveRequestSchema),
    defaultValues: {
      leaveDate: formatDateToISO(new Date()),
      leaveType: LEAVE_TYPE.PAID,
      reason: '',
    },
  });

  async function onSubmit(values: CreateLeaveRequestFormValues) {
    try {
      await createRequest.mutateAsync(values);
      toast.success('有給申請を提出しました');
      form.reset();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : '有給申請に失敗しました'
      );
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>有給休暇申請</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="leaveDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>休暇日</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="leaveType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>休暇種別</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="休暇種別を選択" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={LEAVE_TYPE.PAID}>有給休暇</SelectItem>
                      <SelectItem value={LEAVE_TYPE.SPECIAL}>
                        特別休暇
                      </SelectItem>
                      <SelectItem value={LEAVE_TYPE.UNPAID}>
                        無給休暇
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>理由（任意）</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="休暇の理由があれば記入してください"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              className="w-full"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting ? '送信中...' : '申請する'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
