import { NextResponse } from "next/server";
import db from "@/lib/db/db";
import { requireSession, unauthorized, forbidden } from "@/lib/api-auth";
import { hasPortalModuleAccess, PORTAL_MODULE } from "@/lib/module-permission";

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    if (!session?.user?.id) return unauthorized();
    if (!(await hasPortalModuleAccess(session.user.id, [PORTAL_MODULE.user, PORTAL_MODULE.userBulkAssign]))) return forbidden();
    const body = await request.json().catch(() => ({}));
    const { userIds, roleId, appId, assignments } = body as {
      userIds?: string[];
      roleId?: string;
      appId?: string | null;
      // Beberapa aplikasi sekaligus (2026-10-19): [{ appId, roleId }], maks. 1 role per aplikasi.
      assignments?: { appId?: string | null; roleId?: string }[];
    };

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json({ message: "Pilih minimal 1 user" }, { status: 400 });
    }
    // Format lama { roleId, appId } tetap didukung (dipakai modal Assign Role di daftar user).
    const pairs = Array.isArray(assignments) ? assignments : [{ appId, roleId }];
    if (pairs.length === 0 || pairs.some((a) => !a?.roleId?.trim())) {
      return NextResponse.json({ message: "Role wajib dipilih" }, { status: 400 });
    }
    const targetAppIds = pairs.map((a) => a.appId ?? null);
    if (new Set(targetAppIds).size !== targetAppIds.length) {
      return NextResponse.json({ message: "Satu aplikasi hanya boleh dipilih sekali" }, { status: 400 });
    }

    // Role harus aktif dan memang milik aplikasi yang dituju.
    const roleIds = pairs.map((a) => a.roleId!);
    const roles = await db.role.findMany({
      where: { id: { in: roleIds }, status: "active", deletedAt: null },
      select: { id: true, appId: true },
    });
    const roleById = new Map(roles.map((r) => [r.id, r]));
    for (let i = 0; i < pairs.length; i++) {
      const role = roleById.get(roleIds[i]);
      if (!role) return NextResponse.json({ message: "Role tidak ditemukan" }, { status: 404 });
      if (role.appId !== targetAppIds[i]) {
        return NextResponse.json({ message: "Role tidak sesuai dengan aplikasi yang dipilih" }, { status: 400 });
      }
    }

    // Per aplikasi: role lama user di aplikasi itu diganti role baru — semua dalam satu transaksi.
    await db.$transaction(pairs.flatMap((_, i) => [
      db.userRole.deleteMany({
        where: { userId: { in: userIds }, appId: targetAppIds[i] },
      }),
      db.userRole.createMany({
        data: userIds.map((userId) => ({ userId, roleId: roleIds[i], appId: targetAppIds[i] })),
        skipDuplicates: true,
      }),
    ]));

    return NextResponse.json({
      message: pairs.length > 1
        ? `${pairs.length} role berhasil di-assign ke ${userIds.length} user`
        : `Role berhasil di-assign ke ${userIds.length} user`,
      count: userIds.length,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
