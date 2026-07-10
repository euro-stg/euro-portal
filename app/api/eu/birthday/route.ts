import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db/db";
import { unauthorized } from "@/lib/api-auth";

// Ambil karyawan yang berulang tahun hari ini
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();

    const now = new Date();
    const month = now.getMonth() + 1;
    const day   = now.getDate();

    // Query berdasarkan bulan dan tanggal lahir (abaikan tahun)
    const users = await db.user.findMany({
      where: {
        status: "active",
        birthDate: { not: null },
      },
      select: {
        id: true, name: true, image: true,
        jobPositionName: true, organizationName: true, birthDate: true,
      },
    });

    const birthdays = users.filter((u) => {
      if (!u.birthDate) return false;
      const d = new Date(u.birthDate);
      return d.getMonth() + 1 === month && d.getDate() === day;
    });

    // Ambil reaction counts untuk hari ini
    const year = now.getFullYear();
    const targetIds = birthdays.map((u) => `${u.id}_${year}`);

    const reactions = targetIds.length
      ? await db.euReaction.groupBy({
          by: ["targetId", "type"],
          where: { targetType: "birthday", targetId: { in: targetIds } },
          _count: { _all: true },
        })
      : [];

    const myReactions = targetIds.length
      ? await db.euReaction.findMany({
          where: { targetType: "birthday", targetId: { in: targetIds }, userId: session.user.id },
          select: { targetId: true, type: true },
        })
      : [];

    const commentCounts = targetIds.length
      ? await db.euComment.groupBy({
          by: ["targetId"],
          where: { targetType: "birthday", targetId: { in: targetIds }, deletedAt: null },
          _count: { _all: true },
        })
      : [];

    const reactionMap: Record<string, Record<string, number>> = {};
    for (const r of reactions) {
      if (!reactionMap[r.targetId]) reactionMap[r.targetId] = {};
      reactionMap[r.targetId][r.type] = r._count._all;
    }

    const myReactionMap: Record<string, string> = {};
    for (const r of myReactions) myReactionMap[r.targetId] = r.type;

    const commentMap: Record<string, number> = {};
    for (const c of commentCounts) commentMap[c.targetId] = c._count._all;

    const data = birthdays.map((u) => {
      const targetId = `${u.id}_${year}`;
      return {
        ...u,
        reactions:    reactionMap[targetId]   ?? {},
        myReaction:   myReactionMap[targetId] ?? null,
        commentCount: commentMap[targetId]    ?? 0,
      };
    });

    return NextResponse.json({ data });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
