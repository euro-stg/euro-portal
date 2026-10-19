import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db/db";
import { forbidden } from "@/lib/api-auth";
import { hasPortalModuleAccess, PORTAL_MODULE } from "@/lib/module-permission";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    if (!(await hasPortalModuleAccess(session.user.id, [PORTAL_MODULE.user, PORTAL_MODULE.userBulkAssign]))) return forbidden();

    const body = await request.json().catch(() => ({}));
    const { userIds, appId, roleId, assignments } = body as {
      userIds?: string[]; appId?: string | null; roleId?: string;
      assignments?: { appId?: string | null; roleId?: string }[];
    };

    if (!Array.isArray(userIds) || userIds.length === 0)
      return NextResponse.json({ message: "userIds wajib diisi" }, { status: 400 });
    const pairs = Array.isArray(assignments) ? assignments : [{ appId, roleId }];
    if (pairs.length === 0 || pairs.some((a) => !a?.roleId))
      return NextResponse.json({ message: "roleId wajib diisi" }, { status: 400 });

    // Hanya baris yang cocok persis (user + aplikasi + role) yang dihapus.
    const result = await db.userRole.deleteMany({
      where: {
        userId: { in: userIds },
        OR: pairs.map((a) => ({ appId: a.appId == null ? null : String(a.appId), roleId: String(a.roleId) })),
      },
    });

    return NextResponse.json({
      message: `${result.count} role berhasil dihapus dari user terpilih`,
      count: result.count,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
