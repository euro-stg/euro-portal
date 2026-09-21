import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { unauthorized } from "@/lib/api-auth";
import db from "@/lib/db/db";
import { getEDocFolderBreadcrumb } from "@/lib/edoc";

const RESULT_LIMIT = 20;

// Folder picker untuk fitur "Blast" (lihat POST /api/edoc/file) — BEBAS folder manapun
// (tidak dicek akses WRITE/READ terhadap folder tujuan — keputusan eksplisit user
// 2026-09-21). Cuma folder Obsolete yang tidak ditampilkan (tidak boleh jadi tujuan blast,
// sama seperti tidak boleh upload langsung ke situ). Dua mode:
//   ?q=<teks>            -> cari nama folder di seluruh tree (lompat langsung)
//   ?parentFolderId=<id> -> list anak LANGSUNG dari folder itu (mode browsing — id kosong
//                           string ("root") berarti level teratas), untuk UI navigasi
//                           folder-demi-folder ala halaman utama E Doc, TANPA filter ACL
//                           (beda dari GET /api/edoc/folder biasa yang memang menyaring ACL).
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim() || "";
    const parentFolderId = searchParams.get("parentFolderId");

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
