import { NextResponse } from "next/server";
import db from "@/lib/db/db";
import { requireSession, unauthorized } from "@/lib/api-auth";

// DELETE: remove a specific role from a user by userId + appId scope
export async function DELETE(request: Request) {
  try {
    if (!await requireSession()) return unauthorized();
    const body = await request.json().catch(() => ({}));
    const { userId, appId } = body as { userId?: string; appId?: string | null };

    if (!userId?.trim()) {
      return NextResponse.json({ message: "userId wajib diisi" }, { status: 400 });
    }

    // appId can be null (portal) or a string (app-specific)
    const targetAppId: string | null = appId === undefined ? null : (appId === null ? null : String(appId));

    const deleted = await db.userRole.deleteMany({
      where: { userId, appId: targetAppId },
    });

    if (deleted.count === 0) {
      return NextResponse.json({ message: "Role tidak ditemukan untuk user ini" }, { status: 404 });
    }

    return NextResponse.json({ message: "Role berhasil dihapus" });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
