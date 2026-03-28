import type { WorkEntry } from '@/types/report';

interface WorkEntriesDisplayProps {
  workEntries?: WorkEntry[];
  /** 後方互換: workEntriesが無い場合のフォールバック */
  workContent?: string;
}

/** 時間帯別作業内容の表示 */
export function WorkEntriesDisplay({
  workEntries,
  workContent,
}: WorkEntriesDisplayProps) {
  // workEntriesがある場合は時間帯別で表示
  if (workEntries && workEntries.length > 0) {
    return (
      <div>
        <p className="text-sm text-muted-foreground mb-2">作業内容</p>
        <div className="space-y-1">
          {workEntries.map((entry, index) => (
            <div
              key={index}
              className="flex gap-3 py-1.5 border-b last:border-0"
            >
              <span className="text-sm font-mono text-muted-foreground shrink-0">
                {entry.startTime}〜{entry.endTime}
              </span>
              <span className="text-sm">{entry.content}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 後方互換: 旧形式のworkContent
  if (workContent) {
    return (
      <div>
        <p className="text-sm text-muted-foreground">作業内容</p>
        <p className="whitespace-pre-wrap mt-1">{workContent}</p>
      </div>
    );
  }

  return null;
}
