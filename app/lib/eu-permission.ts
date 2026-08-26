import db from "@/lib/db/db";

export async function getEuPostPermission(userId: string): Promise<{ canPost: boolean; isSuperadmin: boolean }> {
  const portalRole = await db.userRole.findFirst({
    where: { userId, appId: null, role: { appId: null, status: "active", deletedAt: null } },
    select: { role: { select: { name: true } } },
  });
  const isSuperadmin = portalRole?.role.name === "superadmin";
  if (isSuperadmin) return { canPost: true, isSuperadmin: true };

  const euApp = await db.module.findFirst({
    where: { path: "/apps/euro-update", type: "app", status: "active", deletedAt: null },
    select: { id: true },
  });
  if (!euApp) return { canPost: false, isSuperadmin: false };

  const settingsModule = await db.module.findFirst({
    where: { path: "/apps/euro-update/eu-settings", type: "module", appId: euApp.id, status: "active", deletedAt: null },
    select: { id: true },
  });
  if (!settingsModule) return { canPost: false, isSuperadmin: false };

  const userRole = await db.userRole.findFirst({
    where: { userId, appId: euApp.id },
    select: { roleId: true },
  });
  if (!userRole) return { canPost: false, isSuperadmin: false };

  const hasSettingsAccess = await db.roleModule.findFirst({
    where: { roleId: userRole.roleId, moduleId: settingsModule.id },
  });

  return { canPost: !!hasSettingsAccess, isSuperadmin: false };
}
