'use client';

import { ReportList } from '@/components/features/report/report-list';

/** S005: 日報履歴画面 */
export default function ReportHistoryPage() {
  return (
    <div className="container max-w-2xl mx-auto py-6 px-4">
      <h1 className="text-xl font-bold mb-4">日報履歴</h1>
      <ReportList />
    </div>
  );
}
