import { prisma } from "@/lib/db";
import { finalizeClickSession, type EngagementMetrics } from "@/lib/engagement";

/** Legacy endpoint — delegates to richer finish logic using active time. */
export async function POST(request: Request) {
  let body: { session_token?: string; duration_seconds?: number };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { session_token, duration_seconds } = body;

  if (!session_token || typeof duration_seconds !== "number" || duration_seconds < 0) {
    return Response.json(
      { error: "session_token and duration_seconds are required" },
      { status: 400 }
    );
  }

  const click = await prisma.trackingClick.findUnique({
    where: { sessionToken: session_token },
    include: { task: true },
  });

  if (!click || !click.isValid) {
    return Response.json({ error: "Session not found or invalid click" }, { status: 404 });
  }

  const metrics: EngagementMetrics = {
    visible_duration_seconds: Math.round(duration_seconds),
    active_duration_seconds: Math.round(duration_seconds),
    focused_duration_seconds: Math.round(duration_seconds),
    external_duration_seconds: click.externalDurationSeconds,
    interaction_count: click.interactionCount,
    click_count: click.clickCount,
    scroll_count: click.scrollCount,
    keypress_count: click.keypressCount,
    blur_count: click.blurCount,
    manual_interaction_count: click.manualInteractionCount,
  };

  const result = await finalizeClickSession(click.id, metrics, "legacy_complete");

  return Response.json({
    ok: true,
    completed: result.completionStatus === "completed",
    completion_status: result.completionStatus,
    required_duration_seconds: click.requiredDurationSeconds || click.task.requiredDurationSeconds,
    recorded_duration_seconds: Math.round(duration_seconds),
  });
}
