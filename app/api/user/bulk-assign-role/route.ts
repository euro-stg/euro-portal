import { NextResponse } from "next/server";
import db from "@/lib/db/db";
import { requireSession, unauthorized } from "@/lib/api-auth";

export async function POST(request: Request) {
  try {
    if (!await requireSession()) return unauthorized();
    const body = await request.json().catch(() => ({}));
    const { userIds, roleId, appId } = body as {
      userIds?: string[];
      roleId?: string;
      appId?: string | null;
    };

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json({ message: "Pilih minimal 1 user" }, { status: 400 });
    }
    if (!roleId?.trim()) {
      return NextResponse.json({ message: "Role wajib dipilih" }, { status: 400 });
    }

    // Validate role exists and appId matches
    const role = await db.role.findFirst({
      where: { id: roleId, status: "active", deletedAt: null },
    });
    if (!role) {
      return NextResponse.json({ message: "Role tidak ditemukan" }, { status: 404 });
    }

    // Normalize appId: undefined → null
    const targetAppId = appId ?? null;

    // For each user: replace existing role for this app
    await db.$transaction([
      db.userRole.deleteMany({
        where: {
          userId: { in: userIds },
          appId: targetAppId,
        },
      }),
      db.userRole.createMany({
        data: userIds.map((userId) => ({
          userId,
          roleId,
          appId: targetAppId,
        })),
        skipDuplicates: true,
      }),
    ]);

    return NextResponse.json({
      message: `Role berhasil di-assign ke ${userIds.length} user`,
      count: userIds.length,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
