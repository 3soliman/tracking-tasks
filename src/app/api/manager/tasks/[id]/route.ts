import { prisma } from "@/lib/db";
import { enrichActivitiesWithDuration, formatActivityForResponse } from "@/lib/activity-display";
import { getPublicTaskUrl } from "@/lib/public-task";
import { buildSessionSummary, pickReportClick } from "@/lib/session-report";
import { aggregateSiteVisits } from "@/lib/site-visits";
import { requireUser, unauthorizedResponse } from "@/lib/session";
import { formatDurationLong } from "@/lib/format";
import {
  annotateVisitorsWithIpAnalysis,
  buildIpGroups,
  buildVisitorProfile,
  countSharedNetworkGroups,
  countUniqueIps,
  countUniqueVisitors,
  formatIpDisplay,
} from "@/lib/visitor-report";

type TaskClickWithActivities = {
  id: string;
  clickedAt: Date;
  endedAt: Date | null;
  targetUrl: string;
  completionStatus: string;
  completionPercent: number;
  requiredDurationSeconds: number;
  visibleDurationSeconds: number;
  activeDurationSeconds: number;
  focusedDurationSeconds: number;
  interactionCount: number;
  clickCount: number;
  scrollCount: number;
  keypressCount: number;
  blurCount: number;
  externalDurationSeconds: number;
  manualInteractionCount: number;
  trackingMode: string;
  referer: string | null;
  userAgent: string | null;
  ipAddress: string | null;
  ipHash: string | null;
  isValid: boolean;
  invalidReason: string | null;
  activities: Array<{
    eventType: string;
    label: string | null;
    payload: string | null;
    occurredAt: Date;
  }>;
};

function buildSessionPayload(reportClick: TaskClickWithActivities) {
  const activities = enrichActivitiesWithDuration(
    reportClick.activities.map((a) =>
      formatActivityForResponse(
        a.eventType,
        a.label,
        a.payload,
        reportClick.targetUrl,
        a.occurredAt
      )
    ),
    reportClick.completionStatus === "in_progress" ? { until: Date.now() } : undefined
  );

  return {
    click_id: reportClick.id,
    started_at: reportClick.clickedAt,
    ended_at: reportClick.endedAt,
    completion_status: reportClick.completionStatus,
    completion_percent: reportClick.completionPercent,
    required_seconds: reportClick.requiredDurationSeconds,
    visible_seconds: reportClick.visibleDurationSeconds,
    active_seconds: reportClick.activeDurationSeconds,
    focused_seconds: reportClick.focusedDurationSeconds,
    interaction_count: reportClick.interactionCount,
    click_count: reportClick.clickCount,
    scroll_count: reportClick.scrollCount,
    keypress_count: reportClick.keypressCount,
    blur_count: reportClick.blurCount,
    external_seconds: reportClick.externalDurationSeconds,
    manual_interactions: reportClick.manualInteractionCount,
    tracking_mode: reportClick.trackingMode,
    referer: reportClick.referer,
    user_agent: reportClick.userAgent,
    ip_address: formatIpDisplay(reportClick.ipAddress, reportClick.ipHash),
    summary: buildSessionSummary(reportClick),
    activities,
    visited_sites: aggregateSiteVisits(activities),
  };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireUser("manager");
  if (!user) return unauthorizedResponse();

  const { id } = await params;

  const task = await prisma.trackingTask.findUnique({
    where: { id },
    include: {
      clicks: {
        orderBy: { clickedAt: "desc" },
        include: {
          visitor: true,
          user: true,
          activities: {
            orderBy: { occurredAt: "desc" },
            take: 50,
          },
        },
      },
    },
  });

  if (!task) {
    return Response.json({ error: "المهمة غير موجودة" }, { status: 404 });
  }

  const visitorGroups = new Map<
    string,
    {
      visitor: (typeof task.clicks)[number]["visitor"];
      legacyUser: (typeof task.clicks)[number]["user"] | null;
      clicks: typeof task.clicks;
    }
  >();

  for (const click of task.clicks) {
    if (click.visitor) {
      const existing = visitorGroups.get(click.visitor.id);
      if (existing) {
        existing.clicks.push(click);
      } else {
        visitorGroups.set(click.visitor.id, {
          visitor: click.visitor,
          legacyUser: null,
          clicks: [click],
        });
      }
      continue;
    }

    if (click.user) {
      const legacyKey = `user:${click.user.id}`;
      const existing = visitorGroups.get(legacyKey);
      if (existing) {
        existing.clicks.push(click);
      } else {
        visitorGroups.set(legacyKey, {
          visitor: null,
          legacyUser: click.user,
          clicks: [click],
        });
      }
    }
  }

  const rawVisitors = Array.from(visitorGroups.values())
    .sort((a, b) => {
      const aTime = a.clicks[0]?.clickedAt.getTime() ?? 0;
      const bTime = b.clicks[0]?.clickedAt.getTime() ?? 0;
      return bTime - aTime;
    })
    .map((group) => {
      const profile = buildVisitorProfile(group.clicks, group.visitor);
      const { report_click: reportClick, ...profileRest } = profile;

      return {
        ...profileRest,
        visitor_id: group.visitor?.id ?? profile.visitor_id,
        legacy_user: group.legacyUser
          ? {
              name: group.legacyUser.name,
              email: group.legacyUser.email,
              employee_code: group.legacyUser.employeeCode,
            }
          : null,
        latest_session: reportClick
          ? buildSessionPayload(reportClick as TaskClickWithActivities)
          : null,
      };
    });

  const visitors = annotateVisitorsWithIpAnalysis(rawVisitors);
  const ipGroups = buildIpGroups(visitors);
  const uniqueIpCount = countUniqueIps(task.clicks);
  const sharedNetworkCount = countSharedNetworkGroups(ipGroups);
  const visitorCount = countUniqueVisitors(task.clicks);

  return Response.json(
    {
      task: {
        id: task.id,
        title: task.title,
        target_url: task.targetUrl,
        required_duration_seconds: task.requiredDurationSeconds,
        required_duration_label: formatDurationLong(task.requiredDurationSeconds),
        created_at: task.createdAt,
        status: task.status,
        public_url: getPublicTaskUrl(task.id),
        visitor_count: visitorCount,
        unique_ip_count: uniqueIpCount,
        shared_network_count: sharedNetworkCount,
        session_count: task.clicks.length,
        completed_visitors: visitors.filter((v) => v.completed_sessions > 0).length,
        in_progress_visitors: visitors.filter((v) => v.in_progress_sessions > 0).length,
      },
      ip_groups: ipGroups,
      visitors,
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    }
  );
}
