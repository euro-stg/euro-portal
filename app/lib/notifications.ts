import db from "@/lib/db/db";
import { sendNotificationEmail } from "@/lib/mailer";
import { getNotifConfig } from "@/lib/system-config";

const APP_PATH_SUFFIX: Record<string, { modulePathSuffix: string; entityPath: string }> = {
  SD:  { modulePathSuffix: "/requests", entityPath: "requests" },
  SSD: { modulePathSuffix: "/letter",   entityPath: "letter"   },
};

async function buildRefUrl(appType: string | undefined, refId: string | undefined): Promise<string | null> {
  if (!appType || !refId) return null;
  const conf = APP_PATH_SUFFIX[appType];
  if (!conf) return null;
  const mod = await db.module.findFirst({
    where: { path: { endsWith: conf.modulePathSuffix }, deletedAt: null },
    select: { path: true },
  });
  if (!mod) return null;
  const appBase = mod.path.slice(0, mod.path.length - conf.modulePathSuffix.length);
  return `${appBase}/${conf.entityPath}/${refId}`;
}

export async function createNotification(
  userId: string,
  title: string,
  body: string,
  type: string,
  refId?: string,
  appType?: string,
) {
  const [config, refUrl] = await Promise.all([
    getNotifConfig(),
    buildRefUrl(appType, refId),
  ]);

  const [notification, user] = await Promise.all([
    config.inapp
      ? db.notification.create({ data: { userId, title, body, type, refId: refId ?? null, appType: appType ?? null, refUrl } })
      : Promise.resolve(null),
    config.email
      ? db.user.findUnique({ where: { id: userId }, select: { email: true } })
      : Promise.resolve(null),
  ]);

  if (config.email && user?.email) {
    sendNotificationEmail(user.email, title, body, appType ?? "portal").catch(() => null);
  }

  return notification;
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

  const [config, refUrl] = await Promise.all([
    getNotifConfig(),
    buildRefUrl(appType, refId),
  ]);

  const [, users] = await Promise.all([
    config.inapp
      ? db.notification.createMany({
          data: unique.map((userId) => ({ userId, title, body, type, refId: refId ?? null, appType: appType ?? null, refUrl })),
        })
      : Promise.resolve(null),
    config.email
      ? db.user.findMany({ where: { id: { in: unique }, email: { not: null } }, select: { email: true } })
      : Promise.resolve([]),
  ]);

  if (config.email) {
    for (const user of (users ?? [])) {
      if (user.email) {
        sendNotificationEmail(user.email, title, body, appType ?? "portal").catch(() => null);
      }
    }
  }
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
