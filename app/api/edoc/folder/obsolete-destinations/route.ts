import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { unauthorized } from "@/lib/api-auth";
import db from "@/lib/db/db";
import { resolveFolderContentAccess } from "@/lib/edoc";

// Daftar folder Obsolete SIBLING (parentFolderId sama) untuk dipilih sebagai "Folder
// Tujuan Obsolete" saat upload file (End Date). Sengaja TERPISAH dari GET /api/edoc/folder
// biasa — folder Obsolete sekarang disembunyikan total dari listing/search untuk siapapun
// selain pembuat/superadmin (lihat catatan desain 2026-09-15), tapi memilihnya sebagai
// TUJUAN arsip otomatis adalah kebutuhan berbeda: siapapun yang punya akses upload
// (canWrite) di folder ini tetap harus bisa pilih ke mana filenya nanti dipindah, terlepas
// dari apakah mereka pemilik folder Obsolete itu sendiri. Cuma id+name yang dikembalikan —
// tidak membuka akses baca ke ISI folder Obsolete itu.
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();
    const userId = session.user.id;

    const { searchParams } = new URL(request.url);
    const parentFolderId = searchParams.get("parentFolderId");
    if (!parentFolderId) return NextResponse.json({ message: "parentFolderId wajib diisi" }, { status: 400 });

    const access = await resolveFolderContentAccess(userId, parentFolderId);
    if (!access.folder) return NextResponse.json({ message: "Folder tidak ditemukan" }, { status: 404 });
    if (!access.canWrite) return NextResponse.json({ data: [] });

    const folders = await db.eDocFolder.findMany({
      where: { parentFolderId, deletedAt: null, type: "OBSOLETE" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ data: folders });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
