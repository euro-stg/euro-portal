import db from "@/lib/db/db";

/**
 * Gerbang server-side untuk halaman pengaturan miniapp (2026-10-09) — aturannya SAMA dengan
 * sidebar di app/(pages)/apps/[appSlug]/layout.tsx: superadmin, ATAU role user di app itu
 * punya module `modulePath`. Sebelumnya API pengaturan cuma cek login, jadi menyembunyikan
 * menu adalah satu-satunya pembatas — user biasa yang tahu endpoint-nya tetap bisa ubah data.
 */
export async function hasAppModuleAccess(userId: string, appPath: string, modulePath: string): Promise<boolean> {
  const portalRole = await db.userRole.findFirst({
    where: { userId, appId: null, role: { appId: null, status: "active", deletedAt: null } },
    select: { role: { select: { name: true } } },
  });
  if (portalRole?.role.name === "superadmin") return true;

  const app = await db.module.findFirst({
    where: { path: appPath, type: "app", status: "active", deletedAt: null },
    select: { id: true },
  });
  if (!app) return false;

  const [settingsModule, userRole] = await Promise.all([
    db.module.findFirst({
      where: { path: modulePath, type: "module", appId: app.id, status: "active", deletedAt: null },
      select: { id: true },
    }),
    db.userRole.findFirst({ where: { userId, appId: app.id }, select: { roleId: true } }),
  ]);
  if (!settingsModule || !userRole) return false;

  const roleModule = await db.roleModule.findFirst({ where: { roleId: userRole.roleId, moduleId: settingsModule.id } });
  return !!roleModule;
}

/** Menu "Pengaturan" SSD (Kategori, Template Approval, Org Admin). */
export const canManageSsdSettings = (userId: string) =>
  hasAppModuleAccess(userId, "/apps/ssd", "/apps/ssd/ssd-settings");

/** Menu "Master Approval" Software Development. */
export const canManageSdApprovalTemplate = (userId: string) =>
  hasAppModuleAccess(userId, "/apps/software-development", "/apps/software-development/approval/template");

/**
 * Versi level portal dari hasAppModuleAccess (2026-10-13) — aturannya SAMA dengan sidebar &
 * gerbang halaman di app/(pages)/layout.tsx: superadmin, ATAU role portal user (UserRole
 * appId=null) punya salah satu module di `modulePaths`. Dipakai API admin portal (user, role,
 * module, company, organization, system, sync Talenta) yang sebelumnya cuma cek login —
 * user biasa bisa ganti password superadmin atau assign role superadmin ke dirinya sendiri.
 */
export async function hasPortalModuleAccess(userId: string, modulePaths: string[]): Promise<boolean> {
  const portalRole = await db.userRole.findFirst({
    where: { userId, appId: null, role: { appId: null, status: "active", deletedAt: null } },
    select: { roleId: true, role: { select: { name: true } } },
  });
  if (!portalRole) return false;
  if (portalRole.role.name === "superadmin") return true;

  const roleModule = await db.roleModule.findFirst({
    where: {
      roleId: portalRole.roleId,
      module: { path: { in: modulePaths }, appId: null, status: "active", deletedAt: null },
    },
    select: { id: true },
  });
  return !!roleModule;
}

export const PORTAL_MODULE = {
  user: "/user/list-user",
  userBulkAssign: "/user/bulk-assign",
  role: "/role/list-role",
  module: "/module/list-module",
  company: "/company",
  organization: "/master/organization",
  branch: "/master/branch",
  jobPosition: "/master/job-position",
  masterItem: "/master/item",
  email: "/settings/email",
  notification: "/settings/notification",
  erp: "/settings/erp",
} as const;
