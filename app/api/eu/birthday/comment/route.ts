import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db/db";
import { unauthorized } from "@/lib/api-auth";
import { isBirthdayThreadOpen, BIRTHDAY_CLOSED_MESSAGE } from "@/lib/eu-birthday";
import { createNotification } from "@/lib/notifications";

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();

    const { searchParams } = new URL(request.url);
    const birthdayUserId = searchParams.get("birthdayUserId");
    const year = searchParams.get("year") ?? String(new Date().getFullYear());
    if (!birthdayUserId) return NextResponse.json({ message: "birthdayUserId wajib diisi" }, { status: 400 });

    const targetId = `${birthdayUserId}_${year}`;
    const comments = await db.euComment.findMany({
      where: { targetType: "birthday", targetId, deletedAt: null },
      include: { user: { select: { id: true, name: true, image: true, jobPositionName: true } } },
      orderBy: { createdAt: "asc" },
    });

    // Reactions juga
    const reactions = await db.euReaction.groupBy({
      by: ["type"],
      where: { targetType: "birthday", targetId },
      _count: { _all: true },
    });
    const myReaction = await db.euReaction.findUnique({
      where: { targetType_targetId_userId: { targetType: "birthday", targetId, userId: session.user.id } },
    });

    const reactionCounts: Record<string, number> = {};
    for (const r of reactions) reactionCounts[r.type] = r._count._all;

    // Siapa yang bereaksi per jenis (2026-11-16) — "N reaction" di modal ucapan bisa diklik.
    const reactorList = await db.euReaction.findMany({
      where: { targetType: "birthday", targetId },
      include: { user: { select: { id: true, name: true, image: true, jobPositionName: true } } },
      orderBy: { createdAt: "desc" },
    });
    const reactors: Record<string, { id: string; name: string | null; image: string | null; jobPositionName: string | null }[]> = {};
    for (const r of reactorList) (reactors[r.type] ??= []).push(r.user);

    // open = masih hari ulang tahunnya (boleh ucapan/reaction baru); false = baca saja.
    const open = await isBirthdayThreadOpen(birthdayUserId, Number(year));

    return NextResponse.json({ data: { comments, reactions: reactionCounts, reactors, myReaction: myReaction?.type ?? null, open } });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();

    const { birthdayUserId, content } = await request.json().catch(() => ({}));
    if (!birthdayUserId) return NextResponse.json({ message: "birthdayUserId wajib diisi" }, { status: 400 });
    if (!content?.trim()) return NextResponse.json({ message: "Komentar tidak boleh kosong" }, { status: 400 });

    const year = new Date().getFullYear();
    if (!(await isBirthdayThreadOpen(birthdayUserId, year))) return NextResponse.json({ message: BIRTHDAY_CLOSED_MESSAGE }, { status: 403 });
    const targetId = `${birthdayUserId}_${year}`;

    const comment = await db.euComment.create({
      data: { targetType: "birthday", targetId, userId: session.user.id, content: content.trim() },
      include: { user: { select: { id: true, name: true, image: true, jobPositionName: true } } },
    });

    // Notifikasi lonceng + email (mengikuti saklar global) ke yang berulang tahun — hanya untuk
    // ucapan, bukan reaction (2026-11-16). Gagal kirim tidak membatalkan ucapannya.
    if (birthdayUserId !== session.user.id) {
      const text = comment.content.length > 140 ? `${comment.content.slice(0, 140)}…` : comment.content;
      await createNotification(
        birthdayUserId,
        `🎂 Ucapan ulang tahun dari ${comment.user.name ?? "rekan kerja"}`,
        `"${text}"`,
        "EU_BIRTHDAY",
        comment.id,
        "EU",
        { refUrl: "/profile/ulang-tahun" },
      ).catch((e) => console.error("[eu] notifikasi ucapan ulang tahun gagal:", e));
    }

    return NextResponse.json({ data: comment }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();

    const { commentId } = await request.json().catch(() => ({}));
    if (!commentId) return NextResponse.json({ message: "commentId wajib diisi" }, { status: 400 });

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
