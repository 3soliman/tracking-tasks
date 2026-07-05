import { enrichActivitiesWithDuration } from "@/lib/activity-display";
import { formatDuration } from "@/lib/format";

export type ActivityLogItem = {
  event_type: string;
  label?: string | null;
  page_url?: string | null;
  url_label?: string;
  occurred_at?: string;
  duration_seconds?: number | null;
};

type Props = {
  items: ActivityLogItem[];
  emptyMessage?: string;
  /** When true, the newest event shows duration until now (live session). */
  live?: boolean;
};

export function ActivityLog({ items, emptyMessage = "لا توجد أحداث.", live = false }: Props) {
  if (items.length === 0) {
    return <li className="muted">{emptyMessage}</li>;
  }

  const withDuration = enrichActivitiesWithDuration(
    items.filter((item): item is ActivityLogItem & { occurred_at: string } => Boolean(item.occurred_at)),
    live ? { until: Date.now() } : undefined
  );

  return (
    <>
      {withDuration.map((item, idx) => (
        <li key={`${item.occurred_at}-${idx}`}>
          <div>
            <span>{item.label ?? item.event_type}</span>
            {item.page_url && (
              <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>
                {item.url_label ? `${item.url_label}: ` : ""}
                {item.page_url}
              </div>
            )}
          </div>
          <span className="muted activity-log-meta">
            {new Date(item.occurred_at).toLocaleTimeString("ar")}
            {item.duration_seconds != null && item.duration_seconds > 0 && (
              <> · {formatDuration(item.duration_seconds)}</>
            )}
          </span>
        </li>
      ))}
    </>
  );
}
