import { NextResponse } from "next/server";
import { requireSession, unauthorized, forbidden } from "@/lib/api-auth";
import { isPortalSuperadmin, ONLINE_WINDOW_MS } from "@/lib/presence";
import db from "@/lib/db/db";

// Daftar user online — khusus superadmin (dicek di server).
export async function GET() {
  try {
    const session = await requireSession();
    if (!session?.user?.id) return unauthorized();
    if (!(await isPortalSuperadmin(session.user.id))) return forbidden();

    const rows = await db.userPresence.findMany({
      where: { lastSeenAt: { gte: new Date(Date.now() - ONLINE_WINDOW_MS) } },
      orderBy: { lastSeenAt: "desc" },
      select: {
        userId: true, lastSeenAt: true, path: true,
        user: { select: { employeeId: true, name: true, organizationName: true, branchName: true, jobPositionName: true } },
      },
    });
    const data = rows.map((r) => ({
      id: r.userId, lastSeenAt: r.lastSeenAt.toISOString(), path: r.path,
      employeeId: r.user.employeeId, name: r.user.name, organizationName: r.user.organizationName,
      branchName: r.user.branchName, jobPositionName: r.user.jobPositionName,
    }));
    return NextResponse.json({ data, total: data.length }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("error:", error);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
