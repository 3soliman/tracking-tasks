import { prisma } from "@/lib/db";
import { getPublicTaskUrl } from "@/lib/public-task";
import { requireUser, unauthorizedResponse } from "@/lib/session";
import { countUniqueVisitors } from "@/lib/visitor-report";

export async function GET() {
  const user = await requireUser("manager");
  if (!user) return unauthorizedResponse();

  const tasks = await prisma.trackingTask.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      clicks: {
        select: {
          visitorId: true,
          userId: true,
        },
      },
      _count: { select: { clicks: true } },
    },
  });

  return Response.json({
    tasks: tasks.map((task) => ({
      id: task.id,
      title: task.title,
      target_url: task.targetUrl,
      status: task.status,
      created_at: task.createdAt,
      public_url: getPublicTaskUrl(task.id),
      visitor_count: countUniqueVisitors(task.clicks),
      session_count: task._count.clicks,
      report_url: `/manager/tasks/${task.id}`,
    })),
  });
}

export async function POST(request: Request) {
  const user = await requireUser("manager");
  if (!user) return unauthorizedResponse();

  let body: {
    title?: string;
    target_url?: string;
    campaign_name?: string;
    required_duration_seconds?: number;
  };

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "بيانات غير صالحة" }, { status: 400 });
  }

  const { title, target_url, campaign_name, required_duration_seconds } = body;

  if (!title?.trim() || !target_url?.trim()) {
    return Response.json({ error: "العنوان والرابط مطلوبان" }, { status: 400 });
  }

  const task = await prisma.trackingTask.create({
    data: {
      title: title.trim(),
      targetUrl: target_url.trim(),
      campaignName: campaign_name?.trim() || null,
      requiredDurationSeconds: required_duration_seconds ?? 1800,
      assignToAll: false,
      createdById: user.id,
    },
  });

  return Response.json(
    {
      task: {
        id: task.id,
        title: task.title,
        target_url: task.targetUrl,
        required_duration_seconds: task.requiredDurationSeconds,
        public_url: getPublicTaskUrl(task.id),
        visitor_count: 0,
        session_count: 0,
      },
    },
    { status: 201 }
  );
}
