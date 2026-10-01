import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db/db";
import { unauthorized } from "@/lib/api-auth";
import { getEuPostPermission } from "@/lib/eu-permission";
import { deleteFromNextcloud } from "@/lib/nextcloud";

// Attachment.url disimpan sebagai "/api/eu/file?path=<path-nextcloud-ter-encode>" (lihat
// _eu-feed.tsx saat upload) — untuk hapus fisiknya perlu diekstrak dulu query param `path`.
function extractNextcloudPath(attachmentUrl: string): string | null {
  try {
    return new URL(attachmentUrl, "http://x").searchParams.get("path");
  } catch {
    return null;
  }
}

// Hapus fisik semua file attachment di Nextcloud SEBELUM ubah apapun di DB (2026-10-01,
// sama prinsipnya seperti perbaikan delete file E Doc/SSD — kalau gagal, jangan diam-diam
// dilanjutkan seolah sukses, supaya tidak ada file yatim/orphan yang tidak pernah ketahuan).
// Kalau ADA SATU SAJA yang gagal, lempar error — tidak lanjut ubah apapun di DB.
async function deletePhysicalAttachments(urls: string[]): Promise<void> {
  for (const url of urls) {
    const path = extractNextcloudPath(url);
    if (!path) continue; // bentuk url tidak dikenali, lewati daripada mem-block seluruh aksi
    await deleteFromNextcloud(path);
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

    const { canPost, isSuperadmin } = await getEuPostPermission(session.user.id);
    const canManage = isSuperadmin || canPost || post.authorId === session.user.id;
    if (!canManage) return NextResponse.json({ message: "Anda tidak memiliki izin untuk mengubah post ini" }, { status: 403 });

    type AttachmentInput = { name: string; url: string; mimeType?: string; size?: number; order?: number };
    const attachmentList = Array.isArray(attachments) ? (attachments as AttachmentInput[]) : null;

    // Attachment yang BENAR-BENAR dibuang (ada di set lama, tidak ada lagi di set baru) —
    // client selalu kirim daftar lengkap attachment yang masih dipertahankan (sama persis
    // url-nya) + yang baru, jadi selisihnya adalah yang dihapus user. Hapus fisiknya DULU,
    // sebelum transaksi DB (2026-10-01 — sebelumnya euAttachment.deleteMany di bawah tidak
    // pernah menghapus file fisiknya sama sekali, jadi setiap kali attachment diganti, file
    // lama jadi yatim/orphan selamanya di storage).
    if (attachmentList !== null) {
      const existing = await db.euAttachment.findMany({ where: { postId: id }, select: { url: true } });
      const newUrls = new Set(attachmentList.map((a) => a.url));
      const removedUrls = existing.map((a) => a.url).filter((u) => !newUrls.has(u));
      if (removedUrls.length > 0) {
        try {
          await deletePhysicalAttachments(removedUrls);
        } catch (e) {
          console.error("[eu] gagal menghapus attachment fisik di Nextcloud", e);
          return NextResponse.json({ message: e instanceof Error ? e.message : "Gagal menghapus attachment lama di Nextcloud — perubahan TIDAK disimpan, coba lagi nanti" }, { status: 502 });
        }
      }
    }

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
    const session = await auth();
    if (!session?.user?.id) return unauthorized();

    const { id } = await params;

    const post = await db.euPost.findFirst({ where: { id, deletedAt: null } });
    if (!post) return NextResponse.json({ message: "Post tidak ditemukan" }, { status: 404 });

    const { canPost, isSuperadmin } = await getEuPostPermission(session.user.id);
    const canManage = isSuperadmin || canPost || post.authorId === session.user.id;
    if (!canManage) return NextResponse.json({ message: "Anda tidak memiliki izin untuk menghapus post ini" }, { status: 403 });

    // Hapus fisik attachment DULU, sebelum post ditandai terhapus (2026-10-01 — sebelumnya
    // attachment TIDAK PERNAH dibersihkan sama sekali, baik rownya di DB maupun file
    // fisiknya di Nextcloud, kalau post dihapus). Kalau gagal, batalkan seluruh aksi —
    // konsisten dengan perbaikan delete file E Doc/SSD (fisik dulu baru DB).
    const attachments = await db.euAttachment.findMany({ where: { postId: id }, select: { url: true } });
    if (attachments.length > 0) {
      try {
        await deletePhysicalAttachments(attachments.map((a) => a.url));
      } catch (e) {
        console.error("[eu] gagal menghapus attachment fisik di Nextcloud", e);
        return NextResponse.json({ message: e instanceof Error ? e.message : "Gagal menghapus attachment di Nextcloud — post TIDAK ditandai terhapus, coba lagi nanti" }, { status: 502 });
      }
    }

    await db.$transaction([
      // Soft-delete post
      db.euPost.update({ where: { id }, data: { deletedAt: new Date() } }),
      // Soft-delete comments
      db.euComment.updateMany({ where: { targetType: "post", targetId: id, deletedAt: null }, data: { deletedAt: new Date() } }),
      // Hard-delete reactions (no soft-delete field)
      db.euReaction.deleteMany({ where: { targetType: "post", targetId: id } }),
      // Hard-delete attachment rows juga (fisiknya sudah beres di atas)
      db.euAttachment.deleteMany({ where: { postId: id } }),
    ]);

    return NextResponse.json({ message: "Post dihapus" });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
