import { prisma } from "@/lib/db";

export async function assignUserToActiveAllTasks(userId: string): Promise<void> {
  const tasks = await prisma.trackingTask.findMany({
    where: { status: "active", assignToAll: true },
    select: { id: true },
  });

  for (const task of tasks) {
    await prisma.trackingTaskAssignment.upsert({
      where: { taskId_userId: { taskId: task.id, userId } },
      create: { taskId: task.id, userId },
      update: {},
    });
  }
}

export async function assignEmployeesToTask(taskId: string, userIds: string[]): Promise<void> {
  for (const userId of userIds) {
    await prisma.trackingTaskAssignment.upsert({
      where: { taskId_userId: { taskId, userId } },
      create: { taskId, userId },
      update: {},
    });
  }
}

export async function getActiveEmployeeIds(selectedIds?: string[]): Promise<string[]> {
  if (selectedIds?.length) {
    const users = await prisma.user.findMany({
      where: { id: { in: selectedIds }, role: "employee", isActive: true },
      select: { id: true },
    });
    return users.map((u) => u.id);
  }

  const users = await prisma.user.findMany({
    where: { role: "employee", isActive: true },
    select: { id: true },
  });
  return users.map((u) => u.id);
}
