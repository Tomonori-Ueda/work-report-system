'use client';

import { useEffect } from 'react';
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
import { LEAVE_TYPE, LEAVE_UNIT } from '@/types/leave';
import { formatDateToISO } from '@/lib/utils/date';

/** 時刻文字列 "HH:mm" から分数に変換 */
function timeToMinutes(time: string): number {
  const [hoursStr, minutesStr] = time.split(':');
  const hours = parseInt(hoursStr ?? '0', 10);
  const minutes = parseInt(minutesStr ?? '0', 10);
  return hours * 60 + minutes;
}

/** 分差を時間数（0.25刻み）に変換 */
function minutesToHours(minutes: number): number {
  // 0.25刻みで丸める
  return Math.round((minutes / 60) * 4) / 4;
}

/** 有給申請フォーム */
export function LeaveRequestForm() {
  const createRequest = useCreateLeaveRequest();

  const form = useForm<CreateLeaveRequestFormValues>({
    resolver: zodResolver(createLeaveRequestSchema),
    defaultValues: {
      leaveDate: formatDateToISO(new Date()),
      leaveType: LEAVE_TYPE.PAID,
      leaveUnit: LEAVE_UNIT.FULL_DAY,
      leaveHours: undefined,
      startTime: undefined,
      endTime: undefined,
      reason: '',
    },
  });

  const leaveUnit = form.watch('leaveUnit');
  const startTime = form.watch('startTime');
  const endTime = form.watch('endTime');

  // 開始・終了時刻から時間数を自動計算
  useEffect(() => {
    if (
      leaveUnit !== LEAVE_UNIT.HOURLY ||
      startTime == null ||
      endTime == null ||
      startTime === '' ||
      endTime === ''
    ) {
      return;
    }
    const startMin = timeToMinutes(startTime);
    const endMin = timeToMinutes(endTime);
    if (endMin > startMin) {
      const hours = minutesToHours(endMin - startMin);
      form.setValue('leaveHours', hours, { shouldValidate: true });
    }
  }, [leaveUnit, startTime, endTime, form]);

  // 申請単位が変わったら時間関連フィールドをリセット
  useEffect(() => {
    if (leaveUnit !== LEAVE_UNIT.HOURLY) {
      form.setValue('leaveHours', undefined);
      form.setValue('startTime', undefined);
      form.setValue('endTime', undefined);
    }
  }, [leaveUnit, form]);

  async function onSubmit(values: CreateLeaveRequestFormValues) {
    try {
      await createRequest.mutateAsync(values);
      toast.success('有給申請を提出しました');
      form.reset({
        leaveDate: formatDateToISO(new Date()),
        leaveType: LEAVE_TYPE.PAID,
        leaveUnit: LEAVE_UNIT.FULL_DAY,
        leaveHours: undefined,
        startTime: undefined,
        endTime: undefined,
        reason: '',
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : '有給申請に失敗しました'
      );
    }
  }

  const isHourly = leaveUnit === LEAVE_UNIT.HOURLY;

  return (
    <Card>
      <CardHeader>
        <CardTitle>有給休暇申請</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* 休暇日 */}
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

            {/* 休暇種別 */}
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

            {/* 申請単位 */}
            <FormField
              control={form.control}
              name="leaveUnit"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>申請単位</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="申請単位を選択" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={LEAVE_UNIT.FULL_DAY}>全日</SelectItem>
                      <SelectItem value={LEAVE_UNIT.HALF_DAY_AM}>
                        午前半休
                      </SelectItem>
                      <SelectItem value={LEAVE_UNIT.HALF_DAY_PM}>
                        午後半休
                      </SelectItem>
                      <SelectItem value={LEAVE_UNIT.HOURLY}>
                        時間有給
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 時間有給の場合のみ表示 */}
            {isHourly && (
              <div className="space-y-4 rounded-md border p-4 bg-muted/30">
                <p className="text-sm font-medium text-muted-foreground">
                  時間有給の詳細
                </p>

                <div className="grid grid-cols-2 gap-4">
                  {/* 開始時刻 */}
                  <FormField
                    control={form.control}
                    name="startTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>開始時刻</FormLabel>
                        <FormControl>
                          <Input
                            type="time"
                            {...field}
                            value={field.value ?? ''}
                            onChange={(e) =>
                              field.onChange(e.target.value || undefined)
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* 終了時刻 */}
                  <FormField
                    control={form.control}
                    name="endTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>終了時刻</FormLabel>
                        <FormControl>
                          <Input
                            type="time"
                            {...field}
                            value={field.value ?? ''}
                            onChange={(e) =>
                              field.onChange(e.target.value || undefined)
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* 時間数（自動計算・読み取り専用表示） */}
                <FormField
                  control={form.control}
                  name="leaveHours"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>時間数（自動計算）</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.25"
                          min="0.25"
                          max="8"
                          readOnly
                          placeholder="開始・終了時刻から自動計算"
                          value={field.value ?? ''}
                          onChange={() => {
                            // 読み取り専用のため入力無効
                          }}
                          className="bg-muted text-muted-foreground"
                        />
                      </FormControl>
                      <FormMessage />
                      {field.value != null && (
                        <p className="text-xs text-muted-foreground">
                          {field.value}時間（{field.value / 8}日分）消費
                        </p>
                      )}
                    </FormItem>
                  )}
                />
              </div>
            )}

            {/* 理由 */}
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
