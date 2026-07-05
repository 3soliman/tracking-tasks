import { enrichActivitiesWithDuration, parseActivityPayload } from "@/lib/activity-display";
import { formatDurationLong } from "@/lib/format";
import { getHostname } from "@/lib/url";

type ActivityRow = {
  event_type: string;
  label?: string | null;
  page_url?: string | null;
  occurred_at: string | Date;
  duration_seconds?: number | null;
};

const VISIT_EVENT_TYPES = new Set([
  "open_external_tab",
  "external_page_view",
  "external_presence",
  "external_click",
  "external_scroll",
  "extension_click",
]);

/** Summarize employee-reported and inferred site visits with durations. */
export function aggregateSiteVisits(activities: ActivityRow[]): Array<{
  url: string;
  hostname: string;
  total_seconds: number;
  total_label: string;
  visit_count: number;
  employee_reported: boolean;
}> {
  const enriched = enrichActivitiesWithDuration(
    activities.filter((a) => a.occurred_at),
    undefined
  );

  const byUrl = new Map<
    string,
    { total_seconds: number; visit_count: number; employee_reported: boolean }
  >();

  for (const activity of enriched) {
    let url: string | null = null;
    let employeeReported = false;

    if (VISIT_EVENT_TYPES.has(activity.event_type) && activity.page_url) {
      url = activity.page_url;
      employeeReported = activity.event_type.startsWith("external_");
    } else if (
      (activity.event_type === "visibility_hidden" || activity.event_type === "window_blur") &&
      activity.page_url &&
      activity.duration_seconds &&
      activity.duration_seconds > 0
    ) {
      url = activity.page_url;
    }

    if (!url) continue;

    const entry = byUrl.get(url) ?? {
      total_seconds: 0,
      visit_count: 0,
      employee_reported: false,
    };
    entry.total_seconds += activity.duration_seconds ?? 0;
    if (VISIT_EVENT_TYPES.has(activity.event_type)) {
      entry.visit_count += 1;
      entry.employee_reported = entry.employee_reported || employeeReported;
    }
    byUrl.set(url, entry);
  }

  return [...byUrl.entries()]
    .map(([url, stats]) => ({
      url,
      hostname: getHostname(url),
      total_seconds: stats.total_seconds,
      total_label: formatDurationLong(stats.total_seconds),
      visit_count: stats.visit_count,
      employee_reported: stats.employee_reported,
    }))
    .sort((a, b) => b.total_seconds - a.total_seconds);
}

export function parseActivityPayloadFromRow(activity: {
  event_type: string;
  payload?: string | null;
}): ReturnType<typeof parseActivityPayload> {
  return parseActivityPayload(activity.payload ?? null);
}
