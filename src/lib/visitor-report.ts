import { formatDurationLong } from "@/lib/format";
import { buildSessionSummary, getTotalEngagedSeconds, pickReportClick } from "@/lib/session-report";
import { parseUserAgent } from "@/lib/user-agent";

type ClickLike = {
  id: string;
  clickedAt: Date;
  endedAt: Date | null;
  completionStatus: string;
  completionPercent: number;
  activeDurationSeconds: number;
  externalDurationSeconds: number;
  visibleDurationSeconds: number;
  manualInteractionCount: number;
  interactionCount: number;
  requiredDurationSeconds: number;
  trackingMode: string;
  referer: string | null;
  userAgent: string | null;
  ipAddress: string | null;
  ipHash: string | null;
  isValid: boolean;
  invalidReason: string | null;
};

type VisitorLike = {
  id: string;
  label: string;
  firstSeenAt: Date;
  lastSeenAt: Date;
  userAgent: string | null;
  ipAddress: string | null;
  ipHash: string | null;
} | null;

export function formatIpFingerprint(ipHash: string | null | undefined): string | null {
  if (!ipHash) return null;
  return ipHash.slice(0, 8).toUpperCase();
}

export function formatIpDisplay(
  ipAddress: string | null | undefined,
  ipHash?: string | null | undefined
): string | null {
  if (ipAddress && ipAddress !== "unknown") return ipAddress;
  return formatIpFingerprint(ipHash);
}

export function ipGroupKey(
  ipAddress: string | null | undefined,
  ipHash: string | null | undefined
): string | null {
  if (ipAddress && ipAddress !== "unknown") return `addr:${ipAddress}`;
  if (ipHash) return `hash:${ipHash}`;
  return null;
}

export function buildVisitorDisplayName(
  ipAddress: string | null | undefined,
  ipHash: string | null | undefined,
  browser: string | null,
  os: string | null,
  device: string | null
): string {
  const ip = formatIpDisplay(ipAddress, ipHash);
  const parts: string[] = [];
  if (ip) parts.push(ip);
  if (browser && browser !== "غير معروف") parts.push(browser);
  if (os && os !== "غير معروف") parts.push(os);
  if (device && device !== "كمبيوتر") parts.push(device);
  return parts.length ? parts.join(" · ") : "زائر — IP غير معروف";
}

export function countUniqueIps(
  clicks: Array<{
    ipAddress?: string | null;
    ipHash: string | null;
    visitor?: { ipAddress?: string | null; ipHash: string | null } | null;
  }>
): number {
  const ips = new Set<string>();
  for (const click of clicks) {
    const key = ipGroupKey(
      click.ipAddress ?? click.visitor?.ipAddress,
      click.ipHash ?? click.visitor?.ipHash
    );
    if (key) ips.add(key);
  }
  return ips.size;
}

export type VisitorWithIpAnalysis<T> = T & {
  same_ip_visitor_count: number;
  suspicious_multi_browser: boolean;
};

export function annotateVisitorsWithIpAnalysis<
  T extends { ip_group_key: string | null },
>(visitors: T[]): VisitorWithIpAnalysis<T>[] {
  const ipCounts = new Map<string, number>();
  for (const visitor of visitors) {
    const key = visitor.ip_group_key;
    if (!key) continue;
    ipCounts.set(key, (ipCounts.get(key) ?? 0) + 1);
  }

  return visitors.map((visitor) => {
    const key = visitor.ip_group_key;
    const sameIpCount = key ? (ipCounts.get(key) ?? 1) : 1;
    return {
      ...visitor,
      same_ip_visitor_count: sameIpCount,
      suspicious_multi_browser: sameIpCount > 1,
    };
  });
}

export function buildIpGroups<
  T extends {
    ip_group_key: string | null;
    ip_address: string | null;
    display_name: string;
    browser: string | null;
    session_count: number;
    suspicious_multi_browser: boolean;
  },
>(visitors: T[]) {
  const groups = new Map<
    string,
    {
      ip_address: string;
      visitor_count: number;
      session_count: number;
      browsers: string[];
      suspicious_multi_browser: boolean;
      visitors: Array<{ display_name: string; browser: string | null; session_count: number }>;
    }
  >();

  for (const visitor of visitors) {
    const key = visitor.ip_group_key;
    if (!key) continue;

    const ipLabel = visitor.ip_address ?? key.replace(/^hash:/, "").slice(0, 8).toUpperCase();
    const existing = groups.get(key);
    if (existing) {
      existing.visitor_count += 1;
      existing.session_count += visitor.session_count;
      if (visitor.browser && !existing.browsers.includes(visitor.browser)) {
        existing.browsers.push(visitor.browser);
      }
      existing.suspicious_multi_browser = existing.visitor_count > 1;
      existing.visitors.push({
        display_name: visitor.display_name,
        browser: visitor.browser,
        session_count: visitor.session_count,
      });
    } else {
      groups.set(key, {
        ip_address: ipLabel,
        visitor_count: 1,
        session_count: visitor.session_count,
        browsers: visitor.browser ? [visitor.browser] : [],
        suspicious_multi_browser: false,
        visitors: [
          {
            display_name: visitor.display_name,
            browser: visitor.browser,
            session_count: visitor.session_count,
          },
        ],
      });
    }
  }

  return Array.from(groups.values()).sort((a, b) => b.visitor_count - a.visitor_count);
}

function countByStatus(clicks: ClickLike[], status: string): number {
  return clicks.filter((click) => click.completionStatus === status).length;
}

export function buildVisitorProfile(clicks: ClickLike[], visitor: VisitorLike) {
  const sorted = [...clicks].sort((a, b) => b.clickedAt.getTime() - a.clickedAt.getTime());
  const validClicks = clicks.filter((click) => click.isValid !== false);
  const latestClick = sorted[0] ?? null;
  const userAgent = visitor?.userAgent ?? latestClick?.userAgent ?? null;
  const parsed = parseUserAgent(userAgent);
  const totalEngagedSeconds = validClicks.reduce(
    (sum, click) => sum + getTotalEngagedSeconds(click),
    0
  );

  const firstSeenOnTask = clicks.reduce(
    (min, click) => (click.clickedAt < min ? click.clickedAt : min),
    clicks[0]?.clickedAt ?? new Date()
  );
  const lastSeenOnTask = clicks.reduce(
    (max, click) => (click.clickedAt > max ? click.clickedAt : max),
    clicks[0]?.clickedAt ?? new Date()
  );

  const ipAddress = visitor?.ipAddress ?? latestClick?.ipAddress ?? null;
  const ipHash = visitor?.ipHash ?? latestClick?.ipHash ?? null;
  const groupKey = ipGroupKey(ipAddress, ipHash);

  return {
    visitor_id: visitor?.id ?? null,
    visitor_label: visitor?.label ?? "زائر",
    ip_address: formatIpDisplay(ipAddress, ipHash),
    ip_hash: ipHash,
    ip_group_key: groupKey,
    display_name: buildVisitorDisplayName(ipAddress, ipHash, parsed.browser, parsed.os, parsed.device),
    registered_at: visitor?.firstSeenAt ?? firstSeenOnTask,
    last_active_at: visitor?.lastSeenAt ?? lastSeenOnTask,
    first_seen_on_task: firstSeenOnTask,
    last_seen_on_task: lastSeenOnTask,
    user_agent: userAgent,
    browser: parsed.browser,
    os: parsed.os,
    device_type: parsed.device,
    latest_referer: latestClick?.referer ?? null,
    latest_tracking_mode: latestClick?.trackingMode ?? null,
    session_count: clicks.length,
    valid_session_count: validClicks.length,
    invalid_session_count: clicks.length - validClicks.length,
    completed_sessions: countByStatus(validClicks, "completed"),
    partial_sessions: countByStatus(validClicks, "partial"),
    in_progress_sessions: countByStatus(validClicks, "in_progress"),
    abandoned_sessions: countByStatus(validClicks, "abandoned"),
    total_engaged_seconds: totalEngagedSeconds,
    total_engaged_label: formatDurationLong(totalEngagedSeconds),
    sessions: sorted.map((click) => ({
      click_id: click.id,
      started_at: click.clickedAt,
      ended_at: click.endedAt,
      completion_status: click.completionStatus,
      completion_percent: click.completionPercent,
      engaged_seconds: getTotalEngagedSeconds(click),
      engaged_label: formatDurationLong(getTotalEngagedSeconds(click)),
      tracking_mode: click.trackingMode,
      referer: click.referer,
      is_valid: click.isValid,
      invalid_reason: click.invalidReason,
      summary: buildSessionSummary(click),
    })),
    report_click: pickReportClick(clicks),
  };
}

export function countUniqueVisitors(
  clicks: Array<{ visitorId: string | null; userId?: string | null }>
): number {
  const ids = new Set<string>();
  for (const click of clicks) {
    if (click.visitorId) ids.add(click.visitorId);
    else if (click.userId) ids.add(`user:${click.userId}`);
  }
  return ids.size;
}
