import { prisma } from "@/lib/db";
import { getPublicTaskUrl } from "@/lib/public-task";
import { generateSessionToken, getClientIp, hashIp } from "@/lib/tracking";
import { isExternalUrl } from "@/lib/url";
import { getOrCreateVisitor } from "@/lib/visitor";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: taskId } = await params;

  const task = await prisma.trackingTask.findUnique({ where: { id: taskId } });

  if (!task) {
    return Response.json({ error: "المهمة غير موجودة" }, { status: 404 });
  }

  if (task.status !== "active") {
    return Response.json({ error: "المهمة غير نشطة" }, { status: 410 });
  }

  const visitor = await getOrCreateVisitor(request);
  const ipAddress = getClientIp(request);
  const ipHash = hashIp(ipAddress);
  const userAgent = request.headers.get("user-agent") ?? undefined;
  const referer = request.headers.get("referer") ?? undefined;
  const appOrigin = new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").origin;
  const external = isExternalUrl(task.targetUrl, appOrigin);

  const result = await prisma.$transaction(async (tx) => {
    const inProgress = await tx.trackingClick.findFirst({
      where: {
        taskId,
        visitorId: visitor.id,
        isValid: true,
        completionStatus: "in_progress",
      },
      orderBy: { clickedAt: "desc" },
    });

    if (inProgress?.sessionToken) {
      return { click: inProgress, resumed: true, created: false };
    }

    const sessionToken = generateSessionToken();

    const click = await tx.trackingClick.create({
      data: {
        taskId: task.id,
        visitorId: visitor.id,
        sessionToken,
        targetUrl: task.targetUrl,
        requiredDurationSeconds: task.requiredDurationSeconds,
        trackingMode: external ? "external" : "embedded",
        ipAddress,
        ipHash,
        userAgent,
        referer,
        utmCampaign: task.campaignName,
        isValid: true,
        completionStatus: "in_progress",
        activities: {
          create: {
            eventType: "session_start",
            label: "بدء المهمة",
            payload: JSON.stringify({ target_url: task.targetUrl }),
          },
        },
      },
    });

    return { click, resumed: false, created: true };
  });

  return Response.json({
    click_id: result.click.id,
    session_token: result.click.sessionToken,
    work_url: `/t/${taskId}/work?session=${result.click.sessionToken}`,
    public_url: getPublicTaskUrl(taskId),
    task: {
      id: task.id,
      title: task.title,
      target_url: task.targetUrl,
      campaign_name: task.campaignName,
      required_duration_seconds: task.requiredDurationSeconds,
    },
    visitor: {
      id: visitor.id,
      label: visitor.label,
    },
    is_valid: result.click.isValid,
    invalid_reason: result.click.invalidReason,
    resumed: result.resumed,
    created: result.created,
  });
}
