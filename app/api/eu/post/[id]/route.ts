import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db/db";
import { requireSession, unauthorized } from "@/lib/api-auth";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();

    const { id } = await params;
    const post = await db.euPost.findFirst({
      where: { id, deletedAt: null },
      include: {
        category:    { select: { id: true, name: true, icon: true, color: true } },
        author:      { select: { id: true, name: true, image: true, jobPositionName: true } },
        attachments: { orderBy: { order: "asc" } },
        _count:      { select: { readLogs: true } },
      },
    });
    if (!post) return NextResponse.json({ message: "Post tidak ditemukan" }, { status: 404 });

    const [reactionGroups, reactorList, comments, myReaction] = await Promise.all([
      db.euReaction.groupBy({ by: ["type"], where: { targetType: "post", targetId: id }, _count: { _all: true } }),
      db.euReaction.findMany({
        where: { targetType: "post", targetId: id },
        include: { user: { select: { id: true, name: true, image: true, jobPositionName: true } } },
        orderBy: { createdAt: "desc" },
      }),
      db.euComment.findMany({
        where: { targetType: "post", targetId: id, deletedAt: null },
        include: { user: { select: { id: true, name: true, image: true, jobPositionName: true } } },
        orderBy: { createdAt: "asc" },
      }),
      db.euReaction.findUnique({ where: { targetType_targetId_userId: { targetType: "post", targetId: id, userId: session.user.id } } }),
    ]);

    const reactionCounts: Record<string, number> = {};
    for (const r of reactionGroups) reactionCounts[r.type] = r._count._all;

    const reactors: Record<string, { id: string; name: string | null; image: string | null; jobPositionName: string | null }[]> = {};
    for (const r of reactorList) {
      if (!reactors[r.type]) reactors[r.type] = [];
      reactors[r.type].push(r.user);
    }

    return NextResponse.json({ data: { ...post, reactions: reactionCounts, reactors, comments, myReaction: myReaction?.type ?? null } });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { title, content, categoryId, isPinned, isMandatory, targetBranchIds, targetOrgIds, targetPositionIds, publishNow, unpublish, attachments } = body as Record<string, unknown>;

    const post = await db.euPost.findFirst({ where: { id, deletedAt: null } });
    if (!post) return NextResponse.json({ message: "Post tidak ditemukan" }, { status: 404 });

    type AttachmentInput = { name: string; url: string; mimeType?: string; size?: number; order?: number };
    const attachmentList = Array.isArray(attachments) ? (attachments as AttachmentInput[]) : null;

    const updated = await db.$transaction(async (tx) => {
      const p = await tx.euPost.update({
        where: { id },
        data: {
          ...(title     !== undefined ? { title:     String(title).trim() }     : {}),
          ...(content   !== undefined ? { content:   String(content).trim() }   : {}),
          ...(categoryId !== undefined ? { categoryId: String(categoryId) }      : {}),
          ...(isPinned  !== undefined ? { isPinned:  Boolean(isPinned) }  : {}),
          ...(isMandatory !== undefined ? { isMandatory: Boolean(isMandatory) } : {}),
          ...(targetBranchIds   !== undefined ? { targetBranchIds:   targetBranchIds as string[] }   : {}),
          ...(targetOrgIds      !== undefined ? { targetOrgIds:      targetOrgIds as string[] }      : {}),
          ...(targetPositionIds !== undefined ? { targetPositionIds: targetPositionIds as string[] } : {}),
          ...(publishNow ? { publishedAt: new Date() } : {}),
          ...(unpublish  ? { publishedAt: null }        : {}),
        },
      });
      if (attachmentList !== null) {
        await tx.euAttachment.deleteMany({ where: { postId: id } });
        if (attachmentList.length > 0) {
          await tx.euAttachment.createMany({
            data: attachmentList.map((a, i) => ({
              postId: id, name: a.name, url: a.url,
              mimeType: a.mimeType ?? null, size: a.size ?? null, order: a.order ?? i,
            })),
          });
        }
      }
      return p;
    });
    return NextResponse.json({ data: updated });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!await requireSession()) return unauthorized();
    const { id } = await params;

    await db.$transaction([
      // Soft-delete post
      db.euPost.update({ where: { id }, data: { deletedAt: new Date() } }),
      // Soft-delete comments
      db.euComment.updateMany({ where: { targetType: "post", targetId: id, deletedAt: null }, data: { deletedAt: new Date() } }),
      // Hard-delete reactions (no soft-delete field)
      db.euReaction.deleteMany({ where: { targetType: "post", targetId: id } }),
    ]);

    return NextResponse.json({ message: "Post dihapus" });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
