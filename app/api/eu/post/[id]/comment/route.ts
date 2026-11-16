import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db/db";
import { unauthorized } from "@/lib/api-auth";
import { createNotification } from "@/lib/notifications";

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

    const post = await db.euPost.findFirst({ where: { id, deletedAt: null }, select: { authorId: true, title: true } });
    if (!post) return NextResponse.json({ message: "Post tidak ditemukan" }, { status: 404 });

    const comment = await db.euComment.create({
      data: { targetType: "post", targetId: id, userId: session.user.id, content: content.trim() },
      include: { user: { select: { id: true, name: true, image: true, jobPositionName: true } } },
    });

    // Notifikasi lonceng + email (mengikuti saklar global) ke penulis artikel — hanya komentar,
    // bukan reaction, karena komentar perlu dibaca/dibalas (2026-11-16). Gagal kirim tidak
    // membatalkan komentarnya.
    if (post.authorId !== session.user.id) {
      const text = comment.content.length > 140 ? `${comment.content.slice(0, 140)}…` : comment.content;
      await createNotification(
        post.authorId,
        `💬 Komentar baru dari ${comment.user.name ?? "rekan kerja"}`,
        `Pada artikel "${post.title}": "${text}"`,
        "EU_COMMENT",
        id,
        "EU",
        { refUrl: `/apps/euro-update?post=${id}` },
      ).catch((e) => console.error("[eu] notifikasi komentar gagal:", e));
    }

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
