import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { unauthorized } from "@/lib/api-auth";
import db from "@/lib/db/db";
import { isSuperadmin, renameEDocFolder, FOLDER_ACL_SELECT, getEDocFolderSubtreeCounts, deleteEDocFolderRecursive } from "@/lib/edoc";

// Ambil detail 1 folder termasuk 8 field ACL mentah — dipakai untuk mengisi form Edit
// Folder. Berbeda dari GET list (/api/edoc/folder) yang menyembunyikan ACL mentah dan
// hanya mengembalikan hasil resolve canRead/canWrite, endpoint ini mengembalikan ACL
// aslinya apa adanya, jadi dibatasi hanya untuk pembuat folder atau superadmin.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();
    const userId = session.user.id;

    const { id } = await params;
    const folder = await db.eDocFolder.findFirst({
      where: { id, deletedAt: null },
      select: { name: true, type: true, createdBy: true, ...FOLDER_ACL_SELECT },
    });
    if (!folder) return NextResponse.json({ message: "Folder tidak ditemukan" }, { status: 404 });

    const superadmin = await isSuperadmin(userId);
    if (!superadmin && folder.createdBy !== userId) {
      return NextResponse.json({ message: "Hanya pembuat folder atau superadmin yang bisa melihat detail ini" }, { status: 403 });
    }

    return NextResponse.json({ data: folder });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

// Edit nama dan/atau ACL. Sama seperti DELETE — hanya pembuat folder atau superadmin yang
// boleh, bukan sekadar siapa pun yang punya akses WRITE via ACL (ini aksi struktural, bukan
// sekadar isi folder). Rename nama fisik di Nextcloud (via renameEDocFolder) hanya
// dijalankan kalau nama benar-benar berubah — ACL-only edit tidak menyentuh Nextcloud sama
// sekali.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();
    const userId = session.user.id;

    const { id } = await params;
    const folder = await db.eDocFolder.findFirst({ where: { id, deletedAt: null } });
    if (!folder) return NextResponse.json({ message: "Folder tidak ditemukan" }, { status: 404 });

    const superadmin = await isSuperadmin(userId);
    if (!superadmin && folder.createdBy !== userId) {
      return NextResponse.json({ message: "Hanya pembuat folder atau superadmin yang bisa mengedit folder ini" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const {
      name, type,
      readBranchIds, readOrgIds, readPositionIds, readBusinessUnitCodes,
      writeBranchIds, writeOrgIds, writePositionIds, writeBusinessUnitCodes,
    } = body as Record<string, unknown>;

    if (type !== undefined && type !== "NORMAL" && type !== "OBSOLETE") {
      return NextResponse.json({ message: "Type folder tidak valid" }, { status: 400 });
    }

    const trimmedName = typeof name === "string" ? name.trim() : undefined;
    if (trimmedName !== undefined && !trimmedName) {
      return NextResponse.json({ message: "Nama folder wajib diisi" }, { status: 400 });
    }
    if (trimmedName !== undefined && trimmedName !== folder.name) {
      const sibling = await db.eDocFolder.findFirst({
        where: { id: { not: id }, parentFolderId: folder.parentFolderId, deletedAt: null, name: { equals: trimmedName, mode: "insensitive" } },
        select: { id: true },
      });
      if (sibling) {
        return NextResponse.json({ message: "Sudah ada folder dengan nama ini di level yang sama" }, { status: 409 });
      }
      try {
        await renameEDocFolder(id, trimmedName);
      } catch (e) {
        console.error("[edoc] gagal rename folder fisik di Nextcloud", e);
        return NextResponse.json({ message: "Gagal mengganti nama folder di storage" }, { status: 500 });
      }
    }

    const toStringArray = (v: unknown): string[] | undefined => (Array.isArray(v) ? v.filter((x) => typeof x === "string") : undefined);
    const aclData: Record<string, string[]> = {};
    for (const [key, value] of Object.entries({
      readBranchIds, readOrgIds, readPositionIds, readBusinessUnitCodes,
      writeBranchIds, writeOrgIds, writePositionIds, writeBusinessUnitCodes,
    })) {
      const arr = toStringArray(value);
      if (arr !== undefined) aclData[key] = arr;
    }
    if (type !== undefined || Object.keys(aclData).length > 0) {
      await db.eDocFolder.update({
        where: { id },
        data: { ...(type !== undefined ? { type } : {}), ...aclData },
      });
    }

    const updated = await db.eDocFolder.findUnique({
      where: { id },
      select: { name: true, type: true, createdBy: true, ...FOLDER_ACL_SELECT },
    });
    return NextResponse.json({ data: updated });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

// Delete = soft delete (deletedAt), konsisten dengan pola dominan di schema ini.
// Hanya Folder Creator yang MEMBUAT folder ini (atau superadmin) yang boleh hapus —
// bukan sekadar siapa pun yang punya akses WRITE via ACL.
//
// Konfirmasi WAJIB selalu (`{ confirm: "DELETE" }` di body) — termasuk folder yang kosong
// (dipertegas 2026-09-15: sebelumnya folder kosong langsung terhapus tanpa konfirmasi sama
// sekali, cuma folder berisi yang diminta konfirmasi). Tanpa confirm yang benar, dibalas
// 409 berisi folderCount/fileCount (bisa 0/0 untuk folder kosong) supaya UI selalu bisa
// menampilkan dialog konfirmasi yang sesuai sebelum benar-benar menghapus.
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();
    const userId = session.user.id;

    const { id } = await params;
    const folder = await db.eDocFolder.findFirst({ where: { id, deletedAt: null } });
    if (!folder) return NextResponse.json({ message: "Folder tidak ditemukan" }, { status: 404 });

    const superadmin = await isSuperadmin(userId);
    if (!superadmin && folder.createdBy !== userId) {
      return NextResponse.json({ message: "Hanya pembuat folder atau superadmin yang bisa menghapus folder ini" }, { status: 403 });
    }

    const { folderCount, fileCount } = await getEDocFolderSubtreeCounts(id);
    const body = await request.json().catch(() => ({}));
    const confirm = typeof (body as { confirm?: unknown })?.confirm === "string" ? (body as { confirm: string }).confirm : "";
    if (confirm !== "DELETE") {
      return NextResponse.json(
        { message: "Konfirmasi diperlukan untuk menghapus folder ini", requiresConfirm: true, folderCount, fileCount },
        { status: 409 }
      );
    }

    try {
      await deleteEDocFolderRecursive(id);
    } catch (e) {
      console.error("[edoc] gagal menghapus folder fisik di Nextcloud", e);
      return NextResponse.json({ message: "Gagal menghapus folder di storage" }, { status: 500 });
    }

    return NextResponse.json({ message: "Folder dihapus", folderCount, fileCount });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
