import { NextResponse } from "next/server";
import { requireSession, unauthorized, forbidden } from "@/lib/api-auth";
import { hasPortalModuleAccess, PORTAL_MODULE } from "@/lib/module-permission";
import db from "@/lib/db/db";

export async function POST() {
  try {
    const session = await requireSession();
    if (!session?.user?.id) return unauthorized();
    if (!(await hasPortalModuleAccess(session.user.id, [PORTAL_MODULE.organization]))) return forbidden();

    // Hanya karyawan yang resign date-nya KOSONG (2026-11-05) — organisasi dari karyawan yang
    // sudah/akan resign tidak ikut dibuat.
    const users = await db.user.findMany({
      where: { status: "active", resignDate: null, organizationId: { not: null } },
      select: { organizationId: true, organizationName: true },
    });

    const orgMap = new Map<string, string>();
    for (const u of users) {
      if (u.organizationId && u.organizationName) orgMap.set(u.organizationId, u.organizationName);
    }

    let created = 0;
    let skipped = 0;

    for (const [id, name] of orgMap) {
      const existing = await db.organization.findFirst({ where: { id } });
      if (existing) { skipped++; continue; }

      await db.organization.create({
        data: { id, name, source: "user_sync", syncedAt: new Date() },
      });
      created++;
    }

    return NextResponse.json({ message: `${created} org ditambahkan, ${skipped} sudah ada`, created, skipped });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
