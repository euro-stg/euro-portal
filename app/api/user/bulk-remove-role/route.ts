import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db/db";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const { userIds, appId, roleId } = body as { userIds?: string[]; appId?: string | null; roleId?: string };

    if (!Array.isArray(userIds) || userIds.length === 0)
      return NextResponse.json({ message: "userIds wajib diisi" }, { status: 400 });
    if (!roleId)
      return NextResponse.json({ message: "roleId wajib diisi" }, { status: 400 });

    const targetAppId: string | null = appId === undefined || appId === null ? null : String(appId);

    const result = await db.userRole.deleteMany({
      where: { userId: { in: userIds }, appId: targetAppId, roleId },
    });

    return NextResponse.json({
      message: `Role berhasil dihapus dari ${result.count} user`,
      count: result.count,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
