import { Badge } from '@/components/ui/badge';

interface ApprovedByDisplayProps {
  approvedByName: string | null;
}

/** 承認者表示 */
export function ApprovedByDisplay({ approvedByName }: ApprovedByDisplayProps) {
  if (!approvedByName) return null;

  return (
    <div className="border-t pt-4">
      <p className="text-sm text-muted-foreground">承認者</p>
      <Badge variant="outline" className="mt-1">
        {approvedByName}
      </Badge>
    </div>
  );
}
