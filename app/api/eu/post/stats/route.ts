import { NextResponse } from "next/server";
import db from "@/lib/db/db";
import { requireSession, unauthorized } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

const MAX_IDS = 30;

/**
 * Angka saja (reaction per jenis, jumlah komentar, jumlah dibaca) untuk post yang sedang tampil —
 * dipakai polling feed Euro Update (2026-11-25) supaya counter ikut berjalan tanpa refresh.
 * Sengaja ringan: tanpa konten/lampiran, dan hanya post yang sudah terbit & belum dihapus.
 * GET /api/eu/post/stats?ids=a,b,c
 */
export async function GET(request: Request) {
  try {
    const session = await requireSession();
    if (!session) return unauthorized();

    const ids = [...new Set((new URL(request.url).searchParams.get("ids") ?? "").split(",").map((s) => s.trim()).filter(Boolean))].slice(0, MAX_IDS);
    if (ids.length === 0) return NextResponse.json({ data: {} });

    const posts = await db.euPost.findMany({
      where: { id: { in: ids }, deletedAt: null, publishedAt: { not: null, lte: new Date() } },
      select: { id: true, _count: { select: { readLogs: true } } },
    });
    const liveIds = posts.map((p) => p.id);

    const [reactions, comments] = await Promise.all([
      db.euReaction.groupBy({ by: ["targetId", "type"], where: { targetType: "post", targetId: { in: liveIds } }, _count: { _all: true } }),
      db.euComment.groupBy({ by: ["targetId"], where: { targetType: "post", targetId: { in: liveIds }, deletedAt: null }, _count: { _all: true } }),
    ]);

    const data: Record<string, { reactions: Record<string, number>; commentCount: number; readCount: number }> = {};
    for (const p of posts) data[p.id] = { reactions: {}, commentCount: 0, readCount: p._count.readLogs };
    for (const r of reactions) data[r.targetId].reactions[r.type] = r._count._all;
    for (const c of comments) data[c.targetId].commentCount = c._count._all;

    return NextResponse.json({ data });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
