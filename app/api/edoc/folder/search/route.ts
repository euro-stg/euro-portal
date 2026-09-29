import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { unauthorized } from "@/lib/api-auth";
import db from "@/lib/db/db";
import { getEDocFolderBreadcrumb } from "@/lib/edoc";

const RESULT_LIMIT = 20;

// Folder picker untuk fitur "Blast" (lihat POST /api/edoc/file) — BEBAS folder manapun
// (tidak dicek akses WRITE/READ terhadap folder tujuan — keputusan eksplisit user
// 2026-09-21). Cuma folder Obsolete yang tidak ditampilkan (tidak boleh jadi tujuan blast,
// sama seperti tidak boleh upload langsung ke situ). Tiga mode:
//   ?tree=1               -> SELURUH folder (flat, dengan parentFolderId), untuk dibangun
//                            jadi tree expandable di client (2026-09-29 — menggantikan
//                            navigasi folder-demi-folder yang lama, lihat BlastFolderPicker).
//   ?q=<teks>              -> cari nama folder di seluruh tree (dipakai untuk filter tree)
//   ?parentFolderId=<id>  -> (LEGACY, sudah tidak dipakai UI manapun sejak tree mode ada,
//                            dibiarkan untuk kompatibilitas) list anak LANGSUNG dari folder itu.
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim() || "";
    const parentFolderId = searchParams.get("parentFolderId");
    const tree = searchParams.get("tree");

    if (tree) {
      const all = await db.eDocFolder.findMany({
        where: { deletedAt: null, type: { not: "OBSOLETE" } },
        select: { id: true, name: true, parentFolderId: true },
        orderBy: { name: "asc" },
      });
      return NextResponse.json({ data: all });
    }

    if (parentFolderId !== null) {
      const targetParentId = parentFolderId === "root" || parentFolderId === "" ? null : parentFolderId;
      const children = await db.eDocFolder.findMany({
        where: { parentFolderId: targetParentId, deletedAt: null, type: { not: "OBSOLETE" } },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      });
      return NextResponse.json({ data: children.map((f) => ({ id: f.id, name: f.name, breadcrumb: [] })) });
    }

    if (!q) return NextResponse.json({ data: [] });

    const candidates = await db.eDocFolder.findMany({
      where: { deletedAt: null, type: { not: "OBSOLETE" }, name: { contains: q, mode: "insensitive" } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: RESULT_LIMIT,
    });

    const results = await Promise.all(
      candidates.map(async (f) => ({ id: f.id, name: f.name, breadcrumb: await getEDocFolderBreadcrumb(f.id) }))
    );

    return NextResponse.json({ data: results });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
