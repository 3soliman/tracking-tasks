import { prisma } from "@/lib/db";
import { enrichActivitiesWithDuration, formatActivityForResponse } from "@/lib/activity-display";
import { getVisitorKeyFromCookie } from "@/lib/visitor";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionToken: string }> }
) {
  const { sessionToken } = await params;

  const click = await prisma.trackingClick.findUnique({
    where: { sessionToken },
    include: {
      task: true,
      visitor: true,
      activities: {
        orderBy: { occurredAt: "desc" },
        take: 30,
      },
    },
  });

  if (!click) {
    return Response.json({ error: "الجلسة غير موجودة" }, { status: 404 });
  }

  if (click.visitorId) {
    const visitorKey = await getVisitorKeyFromCookie();
    if (visitorKey) {
      const visitor = await prisma.visitor.findUnique({ where: { visitorKey } });
      if (visitor && visitor.id !== click.visitorId) {
        return Response.json({ error: "الجلسة غير موجودة" }, { status: 404 });
      }
    }
  }

  return Response.json({
    click_id: click.id,
    session_token: click.sessionToken,
    target_url: click.targetUrl,
    completion_status: click.completionStatus,
    required_duration_seconds: click.requiredDurationSeconds || click.task.requiredDurationSeconds,
    task: {
      id: click.task.id,
      title: click.task.title,
      campaign_name: click.task.campaignName,
    },
    visitor: click.visitor
      ? { id: click.visitor.id, label: click.visitor.label }
      : null,
    metrics: {
      visible_duration_seconds: click.visibleDurationSeconds,
      active_duration_seconds: click.activeDurationSeconds,
      focused_duration_seconds: click.focusedDurationSeconds,
      external_duration_seconds: click.externalDurationSeconds,
      interaction_count: click.interactionCount,
      click_count: click.clickCount,
      scroll_count: click.scrollCount,
      keypress_count: click.keypressCount,
      blur_count: click.blurCount,
      manual_interaction_count: click.manualInteractionCount,
      completion_percent: click.completionPercent,
    },
    tracking_mode: click.trackingMode,
    recent_activities: enrichActivitiesWithDuration(
      click.activities.map((a) =>
        formatActivityForResponse(a.eventType, a.label, a.payload, click.targetUrl, a.occurredAt)
      ),
      click.completionStatus === "in_progress" ? { until: Date.now() } : undefined
    ),
  });
}
