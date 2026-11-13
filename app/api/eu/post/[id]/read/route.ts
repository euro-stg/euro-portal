import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db/db";
import { unauthorized } from "@/lib/api-auth";
import { getEuPostPermission } from "@/lib/eu-permission";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();

    const { id } = await params;

    try {
      await db.euReadLog.create({ data: { postId: id, userId: session.user.id } });
    } catch (e) {
      if ((e as { code?: string }).code !== "P2002") throw e;
    }

    return NextResponse.json({ message: "Marked as read" });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();

    const { id } = await params;
    // Daftar pembaca hanya untuk pembuat post & superadmin (2026-11-13) — jumlahnya
    // (_count.readLogs) tetap terlihat semua orang lewat GET /api/eu/post.
    const post = await db.euPost.findFirst({ where: { id, deletedAt: null }, select: { authorId: true } });
    if (!post) return NextResponse.json({ message: "Post tidak ditemukan" }, { status: 404 });
    if (post.authorId !== session.user.id && !(await getEuPostPermission(session.user.id)).isSuperadmin) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const logs = await db.euReadLog.findMany({
      where: { postId: id },
      include: { user: { select: { id: true, name: true, image: true, employeeId: true, organizationName: true, jobPositionName: true } } },
      orderBy: { readAt: "asc" },
    });
    return NextResponse.json({ data: logs });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
