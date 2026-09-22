import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { unauthorized } from "@/lib/api-auth";
import { resolveFolderContentAccess, getEDocFolderBreadcrumb } from "@/lib/edoc";

// Breadcrumb standalone untuk 1 folder id (2026-09-22) — sebelumnya breadcrumb cuma pernah
// dikembalikan MENEMPEL di response lain (hasil search, dsb), tidak ada cara ambil
// langsung dari folder id. Dibuat supaya halaman detail file bisa navigasi "Back" balik
// ke folder asalnya (bukan ke root E Document) — lihat _edoc-app.tsx, baca query
// ?folderId= saat mount lalu panggil endpoint ini buat rekonstruksi breadcrumb-nya.
// Akses: read ACL folder biasa (BUKAN creator/superadmin-only seperti GET
// /api/edoc/folder/[id]) — breadcrumb cuma nama+path, bukan isi/ACL folder.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();
    const userId = session.user.id;

    const { id } = await params;
    const access = await resolveFolderContentAccess(userId, id);
    if (!access.folder) return NextResponse.json({ message: "Folder tidak ditemukan" }, { status: 404 });
    if (!access.canRead) return NextResponse.json({ message: "Folder tidak ditemukan" }, { status: 404 }); // hidden, not 403

    const breadcrumb = await getEDocFolderBreadcrumb(id);
    return NextResponse.json({ data: breadcrumb });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
