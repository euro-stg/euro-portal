import db from "@/lib/db/db";

export async function createNotification(
  userId: string,
  title: string,
  body: string,
  type: string,
  refId?: string,
  appType?: string,
) {
  return db.notification.create({ data: { userId, title, body, type, refId: refId ?? null, appType: appType ?? null } });
}

export async function notifyMany(
  userIds: string[],
  title: string,
  body: string,
  type: string,
  refId?: string,
  appType?: string,
) {
  const unique = [...new Set(userIds)].filter(Boolean);
  if (unique.length === 0) return;
  return db.notification.createMany({
    data: unique.map((userId) => ({ userId, title, body, type, refId: refId ?? null, appType: appType ?? null })),
  });
}

// Cari user yang cocok dengan kriteria step approval
export async function findStepUsers(step: {
  jobPositionId: string | null;
  organizationId: string | null;
  branchId: string | null;
}, excludeUserId?: string): Promise<string[]> {
  if (!step.jobPositionId && !step.organizationId && !step.branchId) return [];
  const users = await db.user.findMany({
    where: {
      status: "active",
      ...(step.jobPositionId ? { jobPositionId: step.jobPositionId } : {}),
      ...(step.organizationId ? { organizationId: step.organizationId } : {}),
      ...(step.branchId ? { branchId: step.branchId } : {}),
    },
    select: { id: true },
  });
  return users.map((u) => u.id).filter((id) => id !== excludeUserId);
}
