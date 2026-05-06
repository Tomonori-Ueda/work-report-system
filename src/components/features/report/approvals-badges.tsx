import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  APPROVAL_ORDER,
  type ApprovalSlot,
  type ReportApprovals,
} from '@/types/report';

/** 4枠承認 slot ごとの表示ラベル */
const SLOT_LABEL: Record<ApprovalSlot, string> = {
  construction_manager: '施工部長',
  managing: '常務',
  executive: '専務',
  president: '社長',
};

/**
 * 4枠承認の押印状況を `[施工部長✓][常務 ][専務 ][社長 ]` のように
 * 並べて表示するバッジ列。日報一覧で「日付の横」に表示する用途。
 */
export function ApprovalsBadges({
  approvals,
  size = 'sm',
}: {
  approvals: ReportApprovals | undefined;
  size?: 'sm' | 'md';
}) {
  const safe = approvals ?? {
    construction_manager: null,
    managing: null,
    executive: null,
    president: null,
  };
  return (
    <div className="inline-flex flex-wrap gap-1">
      {APPROVAL_ORDER.map((slot) => (
        <SlotBadge
          key={slot}
          label={SLOT_LABEL[slot]}
          approved={safe[slot] !== null}
          size={size}
        />
      ))}
    </div>
  );
}

function SlotBadge({
  label,
  approved,
  size,
}: {
  label: string;
  approved: boolean;
  size: 'sm' | 'md';
}) {
  const sizeClass =
    size === 'md'
      ? 'text-sm px-2 py-1'
      : 'text-[11px] px-1.5 py-0.5';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded border font-medium',
        sizeClass,
        approved
          ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-300 dark:border-green-900'
          : 'bg-muted/40 text-muted-foreground border-border'
      )}
      title={approved ? `${label} 承認済` : `${label} 未承認`}
    >
      {label}
      {approved && <Check className="h-3 w-3" />}
    </span>
  );
}
