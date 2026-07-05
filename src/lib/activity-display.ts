import { isOnTaskTarget } from "@/lib/url";

type ActivityPayload = {
  page_url?: string;
  href?: string;
  external_url?: string;
  task_target_url?: string;
  source?: string;
  hostname?: string;
  pathname?: string;
  site_known?: boolean;
  on_task_target?: boolean;
  outside_task?: boolean;
};

const EXTERNAL_EVENT_TYPES = new Set([
  "open_external_tab",
  "external_page_view",
  "external_presence",
  "external_click",
  "external_scroll",
]);

const DASHBOARD_EVENT_TYPES = new Set([
  "click",
  "keydown",
  "scroll",
  "window_blur",
  "window_focus",
  "visibility_hidden",
  "visibility_visible",
  "manual_read",
  "manual_click",
  "manual_scroll",
  "manual_search",
  "manual_book",
  "external_mode",
  "session_start",
  "session_end",
]);

export function parseActivityPayload(raw: string | null): ActivityPayload {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as ActivityPayload;
  } catch {
    return {};
  }
}

function blurHiddenLabel(payload: ActivityPayload, externalUrl: string | null): string {
  if (!externalUrl) return "خارج رابط المهمة — الرابط غير معروف";
  if (payload.on_task_target === true) return "على هدف المهمة";
  return "خارج رابط المهمة";
}

export function resolveActivityDisplay(
  eventType: string,
  payloadRaw: string | null,
  taskTargetUrl: string
): {
  page_url: string | null;
  url_label: string;
} {
  const payload = parseActivityPayload(payloadRaw);
  const pageUrl = payload.page_url || payload.href || null;
  const externalUrl = payload.external_url || pageUrl || null;

  if (
    EXTERNAL_EVENT_TYPES.has(eventType) ||
    eventType.startsWith("agoda_") ||
    eventType.startsWith("extension_")
  ) {
    if (pageUrl) {
      const onTarget = payload.on_task_target ?? isOnTaskTarget(pageUrl, taskTargetUrl);
      return {
        page_url: pageUrl,
        url_label: onTarget ? "على هدف المهمة" : "خارج رابط المهمة",
      };
    }
  }

  if (eventType === "external_page_view" || eventType === "external_presence") {
    if (pageUrl) {
      const onTarget = isOnTaskTarget(pageUrl, taskTargetUrl);
      return {
        page_url: pageUrl,
        url_label: onTarget ? "على هدف المهمة" : "خارج رابط المهمة",
      };
    }
  }

  if (eventType === "window_blur" || eventType === "visibility_hidden") {
    return {
      page_url: externalUrl,
      url_label: blurHiddenLabel(payload, externalUrl),
    };
  }

  if (eventType === "open_external_tab") {
    const url = externalUrl || taskTargetUrl;
    return { page_url: url, url_label: "فُتح هدف المهمة" };
  }

  if (eventType === "external_mode") {
    return { page_url: taskTargetUrl, url_label: "هدف المهمة" };
  }

  if (eventType === "session_end") {
    return { page_url: taskTargetUrl, url_label: "هدف المهمة" };
  }

  if (DASHBOARD_EVENT_TYPES.has(eventType) || payload.source === "dashboard") {
    if (pageUrl) {
      return { page_url: pageUrl, url_label: "لوحة المتابعة" };
    }
    return { page_url: null, url_label: "لوحة المتابعة" };
  }

  if (pageUrl) {
    const onTarget = isOnTaskTarget(pageUrl, taskTargetUrl);
    return {
      page_url: pageUrl,
      url_label: onTarget ? "على هدف المهمة" : "خارج رابط المهمة",
    };
  }

  return { page_url: taskTargetUrl, url_label: "هدف المهمة" };
}

export function formatActivityForResponse(
  eventType: string,
  label: string | null,
  payloadRaw: string | null,
  taskTargetUrl: string,
  occurredAt: Date | string
) {
  const { page_url, url_label } = resolveActivityDisplay(eventType, payloadRaw, taskTargetUrl);
  return {
    event_type: eventType,
    label,
    page_url,
    url_label,
    occurred_at: occurredAt,
  };
}

export type ActivityListItem = {
  occurred_at: Date | string;
  duration_seconds?: number | null;
};

/** Activities must be newest-first. Duration = time until the next event chronologically. */
export function enrichActivitiesWithDuration<T extends ActivityListItem>(
  activities: T[],
  options?: { until?: Date | number }
): (T & { duration_seconds: number | null })[] {
  const untilMs =
    options?.until != null
      ? typeof options.until === "number"
        ? options.until
        : options.until.getTime()
      : null;

  return activities.map((activity, idx) => {
    const currentMs = new Date(activity.occurred_at).getTime();
    let nextMs: number | null = null;

    if (idx === 0 && untilMs != null) {
      nextMs = untilMs;
    } else if (idx > 0) {
      nextMs = new Date(activities[idx - 1].occurred_at).getTime();
    }

    if (nextMs == null || Number.isNaN(currentMs)) {
      return { ...activity, duration_seconds: null };
    }

    const seconds = Math.max(0, Math.round((nextMs - currentMs) / 1000));
    return { ...activity, duration_seconds: seconds };
  });
}
