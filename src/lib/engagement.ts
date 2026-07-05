import { prisma } from "@/lib/db";

export type EngagementMetrics = {
  visible_duration_seconds: number;
  active_duration_seconds: number;
  focused_duration_seconds: number;
  external_duration_seconds: number;
  interaction_count: number;
  click_count: number;
  scroll_count: number;
  keypress_count: number;
  blur_count: number;
  manual_interaction_count: number;
};

export type FinalizeResult = {
  completionStatus: string;
  completionPercent: number;
  assignmentStatus: string;
  markAssignmentComplete: boolean;
};

export function getTotalEngagedSeconds(metrics: EngagementMetrics): number {
  return metrics.active_duration_seconds + metrics.external_duration_seconds;
}

export function computeCompletion(
  requiredSeconds: number,
  metrics: EngagementMetrics
): { completionPercent: number; completionStatus: string; assignmentStatus: string; markComplete: boolean } {
  const basis = getTotalEngagedSeconds(metrics) || metrics.visible_duration_seconds;
  const percent = requiredSeconds > 0 ? Math.min(100, (basis / requiredSeconds) * 100) : 0;

  if (percent >= 100) {
    return {
      completionPercent: 100,
      completionStatus: "completed",
      assignmentStatus: "completed",
      markComplete: true,
    };
  }

  if (basis >= 30 || metrics.manual_interaction_count >= 3) {
    return {
      completionPercent: Math.round(percent * 10) / 10,
      completionStatus: "partial",
      assignmentStatus: "partial",
      markComplete: false,
    };
  }

  return {
    completionPercent: Math.round(percent * 10) / 10,
    completionStatus: "abandoned",
    assignmentStatus: "pending",
    markComplete: false,
  };
}

function metricsToDb(metrics: EngagementMetrics) {
  const total = getTotalEngagedSeconds(metrics);
  return {
    visibleDurationSeconds: metrics.visible_duration_seconds,
    activeDurationSeconds: metrics.active_duration_seconds,
    focusedDurationSeconds: metrics.focused_duration_seconds,
    externalDurationSeconds: metrics.external_duration_seconds,
    durationSeconds: total || metrics.visible_duration_seconds,
    interactionCount: metrics.interaction_count,
    clickCount: metrics.click_count,
    scrollCount: metrics.scroll_count,
    keypressCount: metrics.keypress_count,
    blurCount: metrics.blur_count,
    manualInteractionCount: metrics.manual_interaction_count,
  };
}

export async function updateClickMetrics(
  clickId: string,
  metrics: EngagementMetrics
): Promise<void> {
  const required = await prisma.trackingClick.findUnique({
    where: { id: clickId },
    select: { requiredDurationSeconds: true },
  });

  if (!required) return;

  const result = computeCompletion(required.requiredDurationSeconds, metrics);

  await prisma.trackingClick.update({
    where: { id: clickId },
    data: {
      ...metricsToDb(metrics),
      completionPercent: result.completionPercent,
      completionStatus: "in_progress",
    },
  });
}

export async function finalizeClickSession(
  clickId: string,
  metrics: EngagementMetrics,
  reason = "session_end"
): Promise<FinalizeResult> {
  const click = await prisma.trackingClick.findUnique({
    where: { id: clickId },
    include: { assignment: true, task: true },
  });

  if (!click) {
    throw new Error("Session not found");
  }

  const required = click.requiredDurationSeconds || click.task.requiredDurationSeconds;
  const result = computeCompletion(required, metrics);

  await prisma.trackingActivityEvent.create({
    data: {
      clickId,
      eventType: "session_end",
      label: reasonLabel(reason),
      payload: JSON.stringify({ metrics, result, reason }),
    },
  });

  await prisma.trackingClick.update({
    where: { id: clickId },
    data: {
      endedAt: new Date(),
      ...metricsToDb(metrics),
      completionPercent: result.completionPercent,
      completionStatus: result.completionStatus,
    },
  });

  if (click.assignment) {
    await prisma.trackingTaskAssignment.update({
      where: { id: click.assignment.id },
      data: {
        status: result.assignmentStatus,
        completedAt: result.markComplete ? new Date() : click.assignment.completedAt,
      },
    });
  }

  return {
    completionStatus: result.completionStatus,
    completionPercent: result.completionPercent,
    assignmentStatus: result.assignmentStatus,
    markAssignmentComplete: result.markComplete,
  };
}

function reasonLabel(reason: string): string {
  if (reason === "manual_end") return "إنهاء يدوي";
  if (reason === "page_leave") return "إغلاق الصفحة";
  if (reason === "auto_complete") return "اكتمال تلقائي";
  return reason;
}

export async function logActivityEvents(
  clickId: string,
  events: Array<{ event_type: string; label?: string; payload?: Record<string, unknown> }>
): Promise<void> {
  if (!events.length) return;

  await prisma.trackingActivityEvent.createMany({
    data: events.map((event) => ({
      clickId,
      eventType: event.event_type,
      label: event.label ?? null,
      payload: event.payload ? JSON.stringify(event.payload) : null,
    })),
  });
}
