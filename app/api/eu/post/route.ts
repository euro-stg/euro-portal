import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db/db";
import { requireSession, unauthorized } from "@/lib/api-auth";

const PAGE_SIZE = 10;

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();

    const { searchParams } = new URL(request.url);
    const page       = Math.max(1, Number(searchParams.get("page") ?? "1"));
    const categoryId = searchParams.get("categoryId") ?? undefined;
    const search     = searchParams.get("search")?.trim() ?? undefined;
    const all        = searchParams.get("all") === "true";
    const pinned     = searchParams.get("pinned") === "true";

    const where = {
      deletedAt: null,
      publishedAt: { not: null, lte: new Date() },
      ...(categoryId ? { categoryId } : {}),
      ...(pinned ? { isPinned: true } : {}),
      ...(search ? {
        OR: [
          { title: { contains: search, mode: "insensitive" as const } },
          { content: { contains: search, mode: "insensitive" as const } },
        ],
      } : {}),
    };

    const [posts, total] = await Promise.all([
      db.euPost.findMany({
        where,
        include: {
          category: { select: { id: true, name: true, icon: true, color: true } },
          author:   { select: { id: true, name: true, image: true, jobPositionName: true } },
          attachments: { orderBy: { order: "asc" } },
          _count: { select: { readLogs: true } },
        },
        orderBy: [{ isPinned: "desc" }, { publishedAt: "desc" }],
        ...(all ? {} : { skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
      }),
      db.euPost.count({ where }),
    ]);

    // Ambil reaction + comment count per post
    const postIds = posts.map((p) => p.id);
    const [reactions, comments] = await Promise.all([
      db.euReaction.groupBy({ by: ["targetId", "type"], where: { targetType: "post", targetId: { in: postIds } }, _count: { _all: true } }),
      db.euComment.groupBy({ by: ["targetId"], where: { targetType: "post", targetId: { in: postIds }, deletedAt: null }, _count: { _all: true } }),
    ]);

    const myReactions = postIds.length
      ? await db.euReaction.findMany({
          where: { targetType: "post", targetId: { in: postIds }, userId: session.user.id },
          select: { targetId: true, type: true },
        })
      : [];

    const reactionMap: Record<string, Record<string, number>> = {};
    for (const r of reactions) {
      if (!reactionMap[r.targetId]) reactionMap[r.targetId] = {};
      reactionMap[r.targetId][r.type] = r._count._all;
    }
    const commentMap: Record<string, number> = {};
    for (const c of comments) commentMap[c.targetId] = c._count._all;
    const myReactionMap: Record<string, string> = {};
    for (const r of myReactions) myReactionMap[r.targetId] = r.type;

    const data = posts.map((p) => ({
      ...p,
      reactions: reactionMap[p.id] ?? {},
      myReaction: myReactionMap[p.id] ?? null,
      commentCount: commentMap[p.id] ?? 0,
    }));

    return NextResponse.json({ data, meta: { total, page, pageSize: PAGE_SIZE, totalPages: Math.ceil(total / PAGE_SIZE) } });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();

    const body = await request.json().catch(() => ({}));
    const { title, content, categoryId, isPinned, isMandatory, targetBranchIds, targetOrgIds, targetPositionIds, publishNow, attachments } = body as {
      title?: string; content?: string; categoryId?: string;
      isPinned?: boolean; isMandatory?: boolean;
      targetBranchIds?: string[]; targetOrgIds?: string[]; targetPositionIds?: string[];
      publishNow?: boolean; attachments?: { name: string; url: string; mimeType?: string; size?: number; order?: number }[];
    };

    if (!title?.trim())     return NextResponse.json({ message: "Judul wajib diisi" }, { status: 400 });
    if (!content?.trim())   return NextResponse.json({ message: "Konten wajib diisi" }, { status: 400 });
    if (!categoryId)        return NextResponse.json({ message: "Kategori wajib dipilih" }, { status: 400 });

    const post = await db.euPost.create({
      data: {
        title: title.trim(),
        content: content.trim(),
        categoryId,
        authorId: session.user.id,
        isPinned:          isPinned ?? false,
        isMandatory:       isMandatory ?? false,
        targetBranchIds:   targetBranchIds ?? [],
        targetOrgIds:      targetOrgIds ?? [],
        targetPositionIds: targetPositionIds ?? [],
        publishedAt: publishNow ? new Date() : null,
        attachments: attachments?.length
          ? { create: attachments.map((a, i) => ({ name: a.name, url: a.url, mimeType: a.mimeType, size: a.size, order: a.order ?? i })) }
          : undefined,
      },
      include: { category: true, author: { select: { id: true, name: true } }, attachments: true },
    });

    return NextResponse.json({ data: post }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
