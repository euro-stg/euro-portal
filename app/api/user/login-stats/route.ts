import { NextResponse } from "next/server";
import { requireSession, unauthorized, forbidden } from "@/lib/api-auth";
import { hasPortalModuleAccess, PORTAL_MODULE } from "@/lib/module-permission";
import { activeEmployeeWhere } from "@/lib/employee";
import db from "@/lib/db/db";

// Statistik Login (2026-11-11) — tombol "Statistik Login" di halaman User. Khusus yang punya menu
// User. Dasar hitungan = karyawan aktif (activeEmployeeWhere). "Pernah login" = lastLoginAt terisi
// (sebelum fitur ini rilis: perkiraan dari jejak Session/SSO, lihat migrasi 20261111090000).
const DAY = 86_400_000;

type Bucket = { name: string; total: number; everLoggedIn: number; active30: number };

export async function GET() {
  try {
    const session = await requireSession();
    if (!session?.user?.id) return unauthorized();
    if (!(await hasPortalModuleAccess(session.user.id, [PORTAL_MODULE.user]))) return forbidden();

    const now = Date.now();
    const [users, orgs, recent, failed7, firstLog] = await Promise.all([
      db.user.findMany({
        where: activeEmployeeWhere(),
        select: { id: true, employeeId: true, name: true, organizationId: true, organizationName: true, branchName: true, jobPositionName: true, lastLoginAt: true, loginCount: true },
        orderBy: { name: "asc" },
      }),
      db.organization.findMany({ select: { id: true, name: true, parentOrganizationId: true } }),
      db.loginLog.findMany({
        orderBy: { createdAt: "desc" }, take: 100,
        select: { id: true, employeeId: true, channel: true, appName: true, success: true, reason: true, ip: true, createdAt: true, user: { select: { name: true } } },
      }),
      db.loginLog.count({ where: { success: false, channel: "PORTAL", createdAt: { gte: new Date(now - 7 * DAY) } } }),
      db.loginLog.findFirst({ orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
    ]);

    // Departemen = org paling atas dari org karyawan (sub-departemen digabung ke induknya).
    const orgById = new Map(orgs.map((o) => [o.id, o]));
    const departmentOf = (orgId: string | null, fallback: string | null) => {
      let cur = orgId ? orgById.get(orgId) : undefined;
      if (!cur) return fallback || "Tanpa Departemen";
      for (let i = 0; cur.parentOrganizationId && orgById.has(cur.parentOrganizationId) && i < 20; i++) cur = orgById.get(cur.parentOrganizationId)!;
      return cur.name;
    };

    const byDept = new Map<string, Bucket>();
    const byBranch = new Map<string, Bucket>();
    const add = (map: Map<string, Bucket>, name: string, ever: boolean, a30: boolean) => {
      const b = map.get(name) ?? { name, total: 0, everLoggedIn: 0, active30: 0 };
      b.total++; if (ever) b.everLoggedIn++; if (a30) b.active30++;
      map.set(name, b);
    };
    let ever = 0, active7 = 0, active30 = 0;
    const rows = users.map((u) => {
      const t = u.lastLoginAt?.getTime() ?? 0;
      const isEver = !!u.lastLoginAt, a7 = t > now - 7 * DAY, a30 = t > now - 30 * DAY;
      if (isEver) ever++; if (a7) active7++; if (a30) active30++;
      const department = departmentOf(u.organizationId, u.organizationName);
      add(byDept, department, isEver, a30);
      add(byBranch, u.branchName || "Tanpa Branch", isEver, a30);
      return { id: u.id, employeeId: u.employeeId, name: u.name, department, organizationName: u.organizationName, branchName: u.branchName, jobPositionName: u.jobPositionName, lastLoginAt: u.lastLoginAt, loginCount: u.loginCount };
    });
    const sortBuckets = (m: Map<string, Bucket>) => [...m.values()].sort((a, b) => a.everLoggedIn / a.total - b.everLoggedIn / b.total || b.total - a.total);

    return NextResponse.json({
      summary: { total: users.length, everLoggedIn: ever, neverLoggedIn: users.length - ever, active7, active30, failed7 },
      trackingSince: firstLog?.createdAt ?? null,
      byDepartment: sortBuckets(byDept),
      byBranch: sortBuckets(byBranch),
      users: rows,
      recent: recent.map((r) => ({ ...r, userName: r.user?.name ?? null, user: undefined })),
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
