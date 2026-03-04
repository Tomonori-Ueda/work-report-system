'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { WorkHoursDisplay } from './work-hours-display';
import { useCreateReport } from '@/hooks/use-reports';
import {
  createReportSchema,
  type CreateReportFormValues,
} from '@/lib/validations/report';
import { formatDateToISO } from '@/lib/utils/date';

interface ReportFormProps {
  /** 編集時のデフォルト値 */
  defaultValues?: Partial<CreateReportFormValues>;
  /** 編集モード時のレポートID */
  reportId?: string;
}

/** 日報入力フォーム */
export function ReportForm({ defaultValues, reportId }: ReportFormProps) {
  const router = useRouter();
  const createReport = useCreateReport();

  const form = useForm<CreateReportFormValues>({
    resolver: zodResolver(createReportSchema),
    defaultValues: {
      reportDate: defaultValues?.reportDate ?? formatDateToISO(new Date()),
      startTime: defaultValues?.startTime ?? '08:00',
      endTime: defaultValues?.endTime ?? '17:00',
      workContent: defaultValues?.workContent ?? '',
      notes: defaultValues?.notes ?? '',
    },
  });

  const startTime = form.watch('startTime');
  const endTime = form.watch('endTime');

  async function onSubmit(values: CreateReportFormValues) {
    try {
      if (reportId) {
        // 更新
        const res = await fetch(`/api/reports/${reportId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(values),
        });
        if (!res.ok) {
          const error = await res.json();
          throw new Error(
            (error as { message?: string }).message ?? '更新に失敗しました'
          );
        }
        toast.success('日報を更新しました');
      } else {
        await createReport.mutateAsync(values);
        toast.success('日報を提出しました');
      }
      router.push('/report/history');
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : '日報の保存に失敗しました'
      );
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{reportId ? '日報を編集' : '日報を入力'}</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="reportDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>作業日</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="startTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>開始時刻</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="endTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>終了時刻</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <WorkHoursDisplay startTime={startTime} endTime={endTime} />

            <FormField
              control={form.control}
              name="workContent"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>作業内容</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="本日の作業内容を記入してください"
                      rows={5}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>備考（任意）</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="特記事項があれば記入してください"
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
              {form.formState.isSubmitting
                ? '送信中...'
                : reportId
                  ? '更新して再提出'
                  : '提出する'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
