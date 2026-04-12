import { Badge } from '@/components/ui/badge';
import { REPORT_STATUS, type ReportStatus } from '@/types/report';

/** ステータスごとの表示設定（variant + カスタムclassNameで色を区別） */
const STATUS_CONFIG: Record<
  ReportStatus,
  {
    label: string;
    variant: 'default' | 'secondary' | 'destructive' | 'outline';
    className?: string;
  }
> = {
  [REPORT_STATUS.DRAFT]: {
    label: '下書き',
    variant: 'secondary',
  },
  [REPORT_STATUS.SUBMITTED]: {
    label: '提出済',
    variant: 'default',
    className: 'bg-yellow-500 hover:bg-yellow-600 text-white',
  },
  // 現場監督確認済: 青系
  [REPORT_STATUS.SUPERVISOR_CONFIRMED]: {
    label: '現場監督確認済',
    variant: 'default',
    className: 'bg-blue-500 hover:bg-blue-600 text-white',
  },
  // 施工部長確認済: 紫系
  [REPORT_STATUS.MANAGER_CHECKED]: {
    label: '施工部長確認済',
    variant: 'default',
    className: 'bg-purple-500 hover:bg-purple-600 text-white',
  },
  [REPORT_STATUS.APPROVED]: {
    label: '承認済',
    variant: 'outline',
    className: 'border-green-500 text-green-700',
  },
  [REPORT_STATUS.REJECTED]: {
    label: '差戻',
    variant: 'destructive',
  },
};

export function StatusBadge({ status }: { status: ReportStatus }) {
  const config = STATUS_CONFIG[status];
  return (
    <Badge variant={config.variant} className={config.className}>
      {config.label}
    </Badge>
  );
}
