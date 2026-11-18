import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db/db";
import { canAccessSsdLetter } from "@/lib/ssd";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const { id: letterId } = await params;
    if (!(await canAccessSsdLetter(session.user.id, letterId))) return NextResponse.json({ message: "Tidak ditemukan" }, { status: 404 });
    const activities = await db.ssdActivity.findMany({
      where: { letterId },
      orderBy: { createdAt: "asc" },
      include: { actor: { select: { id: true, name: true, jobPositionName: true } } },
    });

    return NextResponse.json({ data: activities });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const userId = session.user.id;

    const { id: letterId } = await params;
    if (!(await canAccessSsdLetter(userId, letterId))) return NextResponse.json({ message: "Tidak ditemukan" }, { status: 404 });
    const body = await request.json().catch(() => ({}));
    const { note } = body as { note?: string };

    if (!note?.trim()) return NextResponse.json({ message: "Komentar tidak boleh kosong" }, { status: 400 });

    const activity = await db.ssdActivity.create({
      data: { letterId, userId, action: "COMMENT", note: note.trim() },
      include: { actor: { select: { id: true, name: true, jobPositionName: true } } },
    });

    return NextResponse.json({ data: activity }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
