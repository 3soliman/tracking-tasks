import { prisma } from "@/lib/db";
import { getPublicTaskUrl } from "@/lib/public-task";
import { requireUser, unauthorizedResponse } from "@/lib/session";
import { countUniqueIps, countUniqueVisitors } from "@/lib/visitor-report";

export async function GET() {
  const user = await requireUser("manager");
  if (!user) return unauthorizedResponse();

  const [tasks, summary] = await Promise.all([
    prisma.trackingTask.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        clicks: {
          select: {
            id: true,
            visitorId: true,
            userId: true,
            ipAddress: true,
            ipHash: true,
            completionStatus: true,
            isValid: true,
            visitor: { select: { ipAddress: true, ipHash: true } },
          },
        },
      },
    }),
    Promise.all([
      prisma.visitor.count(),
      prisma.trackingTask.count(),
      prisma.trackingClick.count({ where: { isValid: true, completionStatus: "completed" } }),
      prisma.trackingClick.count({ where: { isValid: true, completionStatus: "partial" } }),
      prisma.trackingClick.count({ where: { isValid: true, completionStatus: "in_progress" } }),
      prisma.trackingClick.count({ where: { isValid: true, completionStatus: "abandoned" } }),
      prisma.trackingClick.count({ where: { isValid: true } }),
      prisma.trackingClick.count({ where: { isValid: false } }),
    ]),
  ]);

  const [
    visitorCount,
    totalTasks,
    completedSessions,
    partialSessions,
    inProgressSessions,
    abandonedSessions,
    validClicks,
    suspiciousClicks,
  ] = summary;

  const recentTasks = tasks.map((task) => {
    const uniqueVisitors = countUniqueVisitors(task.clicks);
    const uniqueIps = countUniqueIps(task.clicks);
    const completedVisitors = new Set(
      task.clicks
        .filter((c) => c.completionStatus === "completed" && c.visitorId)
        .map((c) => c.visitorId)
    ).size;

    return {
      id: task.id,
      title: task.title,
      target_url: task.targetUrl,
      created_at: task.createdAt,
      public_url: getPublicTaskUrl(task.id),
      visitor_count: uniqueVisitors,
      unique_ip_count: uniqueIps,
      possible_multi_browser: uniqueVisitors > uniqueIps,
      completed_visitor_count: completedVisitors,
      session_count: task.clicks.length,
      in_progress_count: task.clicks.filter((c) => c.completionStatus === "in_progress").length,
      report_url: `/manager/tasks/${task.id}`,
    };
  });

  return Response.json({
    summary: {
      visitors: visitorCount,
      total_tasks: totalTasks,
      completed: completedSessions,
      partial: partialSessions,
      in_progress: inProgressSessions,
      abandoned: abandonedSessions,
      valid_clicks: validClicks,
      suspicious_clicks: suspiciousClicks,
    },
    recent_tasks: recentTasks,
  });
}
