import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { unauthorized } from "@/lib/api-auth";
import db from "@/lib/db/db";
import { getEDocFolderBreadcrumb, canEditFileMetadata } from "@/lib/edoc";

// Kelola folder tujuan "Blast" untuk file yang SUDAH ADA (upload lama, atau file baru yang
// belum di-blast sama sekali saat dibuat) — sebelumnya blast cuma bisa diset saat upload.
// Akses: uploader file ini, superadmin, ATAU (kalau file ini hasil Bulk Import) Folder
// Creator manapun / siapa saja dengan write ACL ke folder file ini (2026-09-22, lewat
// canEditFileMetadata — disamakan dengan PATCH edit metadata/import item, supaya siapapun
// yang bisa melengkapi metadata file Bulk Import juga bisa kelola Blast-nya). TIDAK
// dibatasi DRAFT-only seperti revisi/hapus, karena blast cuma soal visibilitas (link ke
// folder lain), tidak menyentuh isi atau status resmi file.
async function canManageBlast(userId: string, file: { folderId: string; uploadedBy: string; requiresNumber: boolean; bulkImported: boolean }): Promise<boolean> {
  if (file.uploadedBy === userId) return true;
  return canEditFileMetadata(userId, file);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();

    const { id } = await params;
    const links = await db.eDocFileBlastFolder.findMany({
      where: { fileId: id },
      select: { folderId: true, folder: { select: { name: true } } },
    });
    // path lengkap ("Root / Sub / ...") — nama folder saja bisa ambigu kalau ada folder
    // dengan nama sama di lokasi lain.
    const data = await Promise.all(
      links.map(async (l) => {
        const breadcrumb = await getEDocFolderBreadcrumb(l.folderId);
        return { id: l.folderId, name: l.folder.name, path: breadcrumb.map((b) => b.name).join(" / ") };
      })
    );
    return NextResponse.json({ data });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

// Tambah satu atau beberapa folder tujuan blast sekaligus (idempotent — folder yang sudah
// ter-link dilewati, bukan error). Bebas folder manapun (tidak dicek akses), tidak boleh
// ke Obsolete — sama seperti aturan blast saat upload.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();
    const userId = session.user.id;

    const { id } = await params;
    const file = await db.eDocFile.findFirst({ where: { id, deletedAt: null }, select: { folderId: true, uploadedBy: true, requiresNumber: true, bulkImported: true } });
    if (!file) return NextResponse.json({ message: "File tidak ditemukan" }, { status: 404 });
    if (!(await canManageBlast(userId, file))) {
      return NextResponse.json({ message: "Hanya pembuat file atau superadmin yang bisa mengatur blast" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const folderIds = Array.isArray((body as { folderIds?: unknown })?.folderIds)
      ? (body as { folderIds: unknown[] }).folderIds.filter((v): v is string => typeof v === "string")
      : [];
    if (folderIds.length === 0) return NextResponse.json({ message: "folderIds wajib diisi" }, { status: 400 });

    // BUG (ditemukan 2026-09-21 dari React key-collision error): sebelumnya filter di sini
    // membandingkan folder id terhadap id FILE (`fid !== id`) — dua jenis entity yang
    // berbeda, jadi tidak pernah nyaring apapun. Seharusnya nyaring folder ASAL file itu
    // sendiri (`file.folderId`) — kalau lolos, file muncul dobel di listing folder itu (satu
    // dari isi folder asli, satu lagi dari link blast ke folder yang sama), match persis
    // sama seperti aturan di upload-time (POST /api/edoc/file, lihat uniqueBlastFolderIds).
    const uniqueIds = Array.from(new Set(folderIds)).filter((fid) => fid !== file.folderId);
    for (const fid of uniqueIds) {
      const folder = await db.eDocFolder.findFirst({ where: { id: fid, deletedAt: null }, select: { type: true } });
      if (!folder) return NextResponse.json({ message: "Salah satu folder tujuan blast tidak ditemukan" }, { status: 404 });
      if (folder.type === "OBSOLETE") return NextResponse.json({ message: "Tidak bisa blast ke folder Obsolete" }, { status: 400 });
    }

    const existing = await db.eDocFileBlastFolder.findMany({ where: { fileId: id, folderId: { in: uniqueIds } }, select: { folderId: true } });
    const existingIds = new Set(existing.map((e) => e.folderId));
    const toCreate = uniqueIds.filter((fid) => !existingIds.has(fid));
    if (toCreate.length > 0) {
      await db.eDocFileBlastFolder.createMany({ data: toCreate.map((fid) => ({ fileId: id, folderId: fid, createdBy: userId })) });
    }

    return NextResponse.json({ message: "Blast diperbarui", added: toCreate.length });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

// Lepas SATU folder tujuan blast (?folderId=...) — file induk & folder aslinya tidak
// terpengaruh sama sekali, cuma kemunculannya di folder itu yang hilang.
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();
    const userId = session.user.id;

    const { id } = await params;
    const file = await db.eDocFile.findFirst({ where: { id, deletedAt: null }, select: { folderId: true, uploadedBy: true, requiresNumber: true, bulkImported: true } });
    if (!file) return NextResponse.json({ message: "File tidak ditemukan" }, { status: 404 });
    if (!(await canManageBlast(userId, file))) {
      return NextResponse.json({ message: "Hanya pembuat file atau superadmin yang bisa mengatur blast" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const folderId = searchParams.get("folderId");
    if (!folderId) return NextResponse.json({ message: "folderId wajib diisi" }, { status: 400 });

    await db.eDocFileBlastFolder.deleteMany({ where: { fileId: id, folderId } });
    return NextResponse.json({ message: "Folder blast dilepas" });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
