import { Badge } from '@/components/ui/badge';
import { REPORT_STATUS, type ReportStatus } from '@/types/report';

const STATUS_CONFIG: Record<
  ReportStatus,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  [REPORT_STATUS.DRAFT]: { label: '下書き', variant: 'secondary' },
  [REPORT_STATUS.SUBMITTED]: { label: '提出済', variant: 'default' },
  [REPORT_STATUS.APPROVED]: { label: '承認済', variant: 'outline' },
  [REPORT_STATUS.REJECTED]: { label: '差戻', variant: 'destructive' },
};

export function StatusBadge({ status }: { status: ReportStatus }) {
  const config = STATUS_CONFIG[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
