import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { unauthorized } from "@/lib/api-auth";
import db from "@/lib/db/db";
import {
  isSuperadmin,
  isEDocFolderCreator,
  getUserProfileForAccess,
  getUserFolderAccess,
  canBrowseFolderContents,
  resolveAccessStep,
  ensureEDocFolderPath,
  FOLDER_ACL_SELECT,
  type EDocAccess,
} from "@/lib/edoc";

// List langsung anak-anak dari parentFolderId (null/absen = level root). Folder yang
// tidak diakses user disembunyikan total dari hasil — tidak ada entry "terkunci". Folder
// Obsolete secara khusus disembunyikan dari SIAPAPUN selain pembuat/superadmin, terlepas
// dari ACL-nya sendiri (dipertegas 2026-09-15 — sebelumnya cuma browse-ke-isinya yang
// diblokir absolut, tapi tile-nya sendiri masih bisa muncul di listing).
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();
    const userId = session.user.id;

    const { searchParams } = new URL(request.url);
    const parentFolderId = searchParams.get("parentFolderId");

    const superadmin = await isSuperadmin(userId);

    let parentAccess: EDocAccess = { canRead: true, canWrite: true };
    if (parentFolderId) {
      const parent = await db.eDocFolder.findFirst({
        where: { id: parentFolderId, deletedAt: null },
        select: { type: true, createdBy: true },
      });
      if (!parent) return NextResponse.json({ message: "Folder tidak ditemukan" }, { status: 404 });

      if (!superadmin) {
        parentAccess = await getUserFolderAccess(userId, parentFolderId);
        parentAccess = canBrowseFolderContents(parentAccess, parent, userId, superadmin);
        if (!parentAccess.canRead) return NextResponse.json({ data: [] });
      }
    }

    const profile = superadmin ? null : await getUserProfileForAccess(userId);

    // fileCount = jumlah file LANGSUNG di folder itu (folderId persis, bukan rekursif ke
    // subfolder, dan TIDAK ikut menghitung file "Blast" dari folder lain) — angka
    // ringkas "isi berapa file" di tile folder (2026-09-22), sengaja disederhanakan biar
    // query-nya murah (1 count terfilter per folder, bukan replikasi logic gabungan
    // Blast+DRAFT-visibility yang dipakai listing file sungguhan).
    const fileVisibilityFilter = { deletedAt: null, OR: [{ endDate: null }, { endDate: { gt: new Date() } }] };
    const children = await db.eDocFolder.findMany({
      where: { parentFolderId: parentFolderId ?? null, deletedAt: null },
      select: {
        ...FOLDER_ACL_SELECT, name: true, type: true, createdBy: true, createdAt: true,
        _count: { select: { files: { where: fileVisibilityFilter } } },
      },
      orderBy: { name: "asc" },
    });

    const data = children
      .map((f) => {
        const isOwner = f.createdBy === userId;
        let access: EDocAccess;
        if (superadmin || isOwner) {
          access = { canRead: true, canWrite: true };
        } else if (f.type === "OBSOLETE") {
          // Folder Obsolete tersembunyi TOTAL dari listing untuk siapapun selain
          // pembuat/superadmin — bukan cuma diblokir saat browse ke isinya. Konsisten
          // dengan absolute override yang sudah ada di canBrowseFolderContents.
          access = { canRead: false, canWrite: false };
        } else {
          access = resolveAccessStep(parentAccess, f, profile!);
        }
        return {
          id: f.id,
          name: f.name,
          type: f.type,
          createdBy: f.createdBy,
          createdAt: f.createdAt,
          canRead: access.canRead,
          canWrite: access.canWrite,
          fileCount: f._count.files,
        };
      })
      .filter((f) => f.canRead);

    return NextResponse.json({ data });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

// Folder Creator bisa bikin folder di mana saja dalam tree, tidak digate oleh ACL parent —
// role Folder Creator sendiri yang jadi gerbangnya (lihat catatan desain E Document).
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();
    const userId = session.user.id;

    const [superadmin, folderCreator] = await Promise.all([isSuperadmin(userId), isEDocFolderCreator(userId)]);
    if (!superadmin && !folderCreator) {
      return NextResponse.json({ message: "Anda tidak memiliki izin untuk membuat folder" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const {
      name, parentFolderId, type,
      readBranchIds, readOrgIds, readPositionIds, readBusinessUnitCodes,
      writeBranchIds, writeOrgIds, writePositionIds, writeBusinessUnitCodes,
    } = body as Record<string, unknown>;

    if (typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ message: "Nama folder wajib diisi" }, { status: 400 });
    }
    if (type !== undefined && type !== "NORMAL" && type !== "OBSOLETE") {
      return NextResponse.json({ message: "Type folder tidak valid" }, { status: 400 });
    }

    let parentId: string | null = null;
    if (parentFolderId) {
      const parent = await db.eDocFolder.findFirst({ where: { id: String(parentFolderId), deletedAt: null }, select: { id: true } });
      if (!parent) return NextResponse.json({ message: "Parent folder tidak ditemukan" }, { status: 404 });
      parentId = parent.id;
    }

    // Nama folder fisik di Nextcloud sekarang mengikuti nama asli (bukan ID) supaya mudah
    // diaudit langsung — jadi nama harus unik di antara sibling-nya di level yang sama,
    // persis seperti aturan folder biasa. Dicek eksplisit (bukan lewat unique index DB)
    // supaya level root (parentFolderId = NULL) ikut tercakup dengan benar.
    const sibling = await db.eDocFolder.findFirst({
      where: { parentFolderId: parentId, deletedAt: null, name: { equals: name.trim(), mode: "insensitive" } },
      select: { id: true },
    });
    if (sibling) {
      return NextResponse.json({ message: "Sudah ada folder dengan nama ini di level yang sama" }, { status: 409 });
    }

    const toStringArray = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x) => typeof x === "string") : []);

    const folder = await db.eDocFolder.create({
      data: {
        name: name.trim(),
        parentFolderId: parentId,
        type: type === "OBSOLETE" ? "OBSOLETE" : "NORMAL",
        createdBy: userId,
        readBranchIds: toStringArray(readBranchIds),
        readOrgIds: toStringArray(readOrgIds),
        readPositionIds: toStringArray(readPositionIds),
        readBusinessUnitCodes: toStringArray(readBusinessUnitCodes),
        writeBranchIds: toStringArray(writeBranchIds),
        writeOrgIds: toStringArray(writeOrgIds),
        writePositionIds: toStringArray(writePositionIds),
        writeBusinessUnitCodes: toStringArray(writeBusinessUnitCodes),
      },
    });

    try {
      await ensureEDocFolderPath(folder.id);
    } catch (e) {
      // Jangan biarkan row DB "phantom" tanpa folder fisik di Nextcloud — rollback.
      await db.eDocFolder.delete({ where: { id: folder.id } }).catch(() => {});
      console.error("[edoc] gagal membuat folder fisik di Nextcloud", e);
      return NextResponse.json({ message: "Gagal membuat folder di storage" }, { status: 500 });
    }

    return NextResponse.json({ data: folder }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
