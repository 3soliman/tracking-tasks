import { prisma } from "@/lib/db";
import { logActivityEvents, updateClickMetrics, type EngagementMetrics } from "@/lib/engagement";

export async function POST(request: Request) {
  let body: {
    session_token?: string;
    metrics?: EngagementMetrics;
    events?: Array<{ event_type: string; label?: string; payload?: Record<string, unknown> }>;
  };

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "بيانات غير صالحة" }, { status: 400 });
  }

  const { session_token, metrics, events } = body;
  if (!session_token || !metrics) {
    return Response.json({ error: "session_token و metrics مطلوبان" }, { status: 400 });
  }

  const click = await prisma.trackingClick.findUnique({
    where: { sessionToken: session_token },
    select: { id: true, isValid: true, completionStatus: true },
  });

  if (!click || !click.isValid) {
    return Response.json({ error: "الجلسة غير موجودة" }, { status: 404 });
  }

  if (click.completionStatus !== "in_progress") {
    return Response.json({ ok: true, closed: true });
  }

  await updateClickMetrics(click.id, metrics);
  if (events?.length) {
    await logActivityEvents(click.id, events);
  }

  return Response.json({ ok: true });
}
