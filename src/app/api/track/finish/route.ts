import { prisma } from "@/lib/db";
import { finalizeClickSession, getTotalEngagedSeconds, type EngagementMetrics } from "@/lib/engagement";
import { formatDurationLong } from "@/lib/format";

export async function POST(request: Request) {
  let body: {
    session_token?: string;
    metrics?: EngagementMetrics;
    reason?: string;
  };

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "بيانات غير صالحة" }, { status: 400 });
  }

  const { session_token, metrics, reason } = body;
  if (!session_token || !metrics) {
    return Response.json({ error: "session_token و metrics مطلوبان" }, { status: 400 });
  }

  const click = await prisma.trackingClick.findUnique({
    where: { sessionToken: session_token },
    include: { task: true },
  });

  if (!click || !click.isValid) {
    return Response.json({ error: "الجلسة غير موجودة" }, { status: 404 });
  }

  if (click.completionStatus !== "in_progress") {
    return Response.json({
      ok: true,
      already_finalized: true,
      completion_status: click.completionStatus,
      completion_percent: click.completionPercent,
    });
  }

  const result = await finalizeClickSession(click.id, metrics, reason ?? "manual_end");
  const required = click.requiredDurationSeconds || click.task.requiredDurationSeconds;
  const actual = getTotalEngagedSeconds(metrics) || metrics.visible_duration_seconds;

  return Response.json({
    ok: true,
    completion_status: result.completionStatus,
    completion_percent: result.completionPercent,
    assignment_status: result.assignmentStatus,
    required_duration_seconds: required,
    actual_duration_seconds: actual,
    external_duration_seconds: metrics.external_duration_seconds,
    manual_interactions: metrics.manual_interaction_count,
    summary: `المطلوب ${formatDurationLong(required)} — الفعلي ${formatDurationLong(actual)} (خارجي: ${formatDurationLong(metrics.external_duration_seconds)}، تفاعلات: ${metrics.manual_interaction_count})`,
  });
}
