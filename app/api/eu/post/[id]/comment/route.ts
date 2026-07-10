import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db/db";
import { unauthorized } from "@/lib/api-auth";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();

    const { id } = await params;
    const comments = await db.euComment.findMany({
      where: { targetType: "post", targetId: id, deletedAt: null },
      include: { user: { select: { id: true, name: true, image: true, jobPositionName: true } } },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({ data: comments });
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
    if (!session?.user?.id) return unauthorized();

    const { id } = await params;
    const { content } = await request.json().catch(() => ({}));
    if (!content?.trim()) return NextResponse.json({ message: "Komentar tidak boleh kosong" }, { status: 400 });

    const comment = await db.euComment.create({
      data: { targetType: "post", targetId: id, userId: session.user.id, content: content.trim() },
      include: { user: { select: { id: true, name: true, image: true, jobPositionName: true } } },
    });
    return NextResponse.json({ data: comment }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();

    const { id: postId } = await params;
    const { commentId } = await request.json().catch(() => ({}));

    const comment = await db.euComment.findUnique({ where: { id: commentId } });
    if (!comment) return NextResponse.json({ message: "Komentar tidak ditemukan" }, { status: 404 });
    if (comment.userId !== session.user.id)
      return NextResponse.json({ message: "Tidak bisa hapus komentar orang lain" }, { status: 403 });

    await db.euComment.update({ where: { id: commentId }, data: { deletedAt: new Date() } });
    return NextResponse.json({ message: "Komentar dihapus" });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
