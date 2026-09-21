import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { unauthorized } from "@/lib/api-auth";
import db from "@/lib/db/db";
import { isEDocDocumentApprover, isSuperadmin, deleteEDocFile, canViewFile, canEditFileMetadata } from "@/lib/edoc";

// DRAFT files are visible only to superadmin, their own uploader, or any Document
// Approver (flat global pool, bypasses folder ACL — same rule as the pending-approval
// queue). RELEASE files fall back to normal folder ACL. `canWrite`/`canDelete` no longer
// reflect folder ACL — both now mean "superadmin, OR the uploader as long as this file
// hasn't passed real approval yet" (requiresNumber=false, or still DRAFT). Once a
// requiresNumber file is RELEASE (approved, has a real Document Number), only superadmin
// can revise or delete it — decoupled from folder write access entirely.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();
    const userId = session.user.id;

    const { id } = await params;
    const file = await db.eDocFile.findFirst({
      where: { id, deletedAt: null },
      include: {
        category: { select: { id: true, code: true, name: true } },
        categoryType: { select: { id: true, code: true, name: true } },
        uploader: { select: { id: true, name: true, employeeId: true } },
        approver: { select: { id: true, name: true } },
        rejecter: { select: { id: true, name: true } },
        revisions: { orderBy: { replacedAt: "desc" }, include: { replacer: { select: { name: true } } } },
      },
    });
    if (!file) return NextResponse.json({ message: "File tidak ditemukan" }, { status: 404 });

    const [superadmin, approver, viewable, canEditMetadata] = await Promise.all([
      isSuperadmin(userId),
      isEDocDocumentApprover(userId),
      canViewFile(userId, file),
      canEditFileMetadata(userId, file),
    ]);
    if (!viewable) return NextResponse.json({ message: "File tidak ditemukan" }, { status: 404 });

    // Uploader boleh revisi/hapus selagi file belum lolos approval resmi (requiresNumber=false,
    // atau masih DRAFT/REJECTED — file yang ditolak boleh direvisi & resubmit, lihat
    // revision/route.ts) — begitu requiresNumber sudah RELEASE, cuma superadmin yang boleh
    // (dipertegas 2026-09-15, sama untuk revisi & hapus).
    const canManage = superadmin || (file.uploadedBy === userId && (!file.requiresNumber || file.status === "DRAFT" || file.status === "REJECTED"));
    // Blast TIDAK ikut dibatasi status (2026-09-21) — cuma link visibilitas, tidak
    // menyentuh isi/status resmi file, jadi aman diatur kapan saja oleh uploader/superadmin,
    // atau Folder Creator manapun kalau file ini hasil Bulk Import (2026-09-21, sama seperti
    // canEditMetadata — biar sesama Folder Creator bisa kolaboratif melengkapi Blast juga,
    // bukan cuma metadata dasar).
    const canManageBlast = superadmin || file.uploadedBy === userId || canEditMetadata;

    return NextResponse.json({
      data: file, canWrite: canManage, canDelete: canManage, canManageBlast, canEditMetadata,
      isDocumentApprover: approver || superadmin,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

// Delete = soft delete (deletedAt) + hapus PDF aktifnya dari Nextcloud. Versi-versi lama
// yang tercatat di EDocFileRevisionLog SENGAJA tidak ikut dihapus fisik — tetap jadi jejak
// audit historis, sama seperti perilaku upload revisi (revisi juga tidak menghapus versi
// lama). Akses: HANYA uploader file ini, atau superadmin — bukan lagi siapa saja yang
// punya write ACL folder (dipersempit 2026-09-15, sama seperti upload revisi).
//
// Tambahan (2026-09-15): file yang MELALUI proses approval (requiresNumber=true) hanya
// boleh dihapus selagi masih DRAFT — begitu di-approve (RELEASE, sudah punya Document
// Number resmi), tidak boleh dihapus lagi (superadmin tetap bisa override, konsisten
// dengan seluruh app ini). File yang memang tidak butuh approval (requiresNumber=false,
// langsung RELEASE saat upload) TIDAK kena aturan ini — boleh dihapus kapan saja, karena
// "RELEASE"-nya bukan hasil approval resmi, cuma penanda "tidak ada gerbang approval".
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();
    const userId = session.user.id;

    const { id } = await params;
    const file = await db.eDocFile.findFirst({ where: { id, deletedAt: null } });
    if (!file) return NextResponse.json({ message: "File tidak ditemukan" }, { status: 404 });

    const superadmin = await isSuperadmin(userId);
    if (!superadmin && file.uploadedBy !== userId) {
      return NextResponse.json({ message: "Hanya pembuat file atau superadmin yang bisa menghapus file ini" }, { status: 403 });
    }
    if (!superadmin && file.requiresNumber && file.status !== "DRAFT" && file.status !== "REJECTED") {
      return NextResponse.json({ message: "File yang sudah di-approve (punya Document Number resmi) tidak bisa dihapus" }, { status: 409 });
    }

    await db.eDocFile.update({ where: { id }, data: { deletedAt: new Date() } });
    await deleteEDocFile(file.fileUrl).catch((e) => console.error("[edoc] gagal menghapus file fisik di Nextcloud", e));

    return NextResponse.json({ message: "File dihapus" });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

// Edit metadata (title/description/category/BU/branch/tanggal/nomor dokumen & MOC/toggle
// promo) — TIDAK termasuk mengganti file PDF-nya sendiri (itu tetap lewat revision/route.ts)
// atau import item promo (tetap lewat /api/edoc/im-product/import, sudah dipakai berulang
// dari halaman detail). Dibuat terutama untuk melengkapi file hasil Bulk Import (2026-09-21)
// yang sengaja dibuat minim data saat upload — lihat canEditFileMetadata untuk gerbang akses
// lengkapnya (superadmin selalu; Folder Creator manapun untuk file bulkImported; uploader
// sendiri selagi requiresNumber=false).
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();
    const userId = session.user.id;

    const { id } = await params;
    const file = await db.eDocFile.findFirst({ where: { id, deletedAt: null } });
    if (!file) return NextResponse.json({ message: "File tidak ditemukan" }, { status: 404 });

    if (!(await canEditFileMetadata(userId, file))) {
      return NextResponse.json({ message: "Anda tidak memiliki izin untuk mengedit file ini" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = {};

    if (typeof body.title === "string") {
      const title = body.title.trim();
      if (!title) return NextResponse.json({ message: "Title tidak boleh kosong" }, { status: 400 });
      data.title = title;
    }
    if ("description" in body) data.description = typeof body.description === "string" ? body.description.trim() || null : null;

    if (typeof body.categoryId === "string" && body.categoryId) {
      const category = await db.eDocCategory.findFirst({ where: { id: body.categoryId, deletedAt: null } });
      if (!category) return NextResponse.json({ message: "Category tidak ditemukan" }, { status: 404 });
      data.categoryId = body.categoryId;
    }
    if ("categoryTypeId" in body) {
      const categoryTypeId = body.categoryTypeId || null;
      const categoryId = data.categoryId ?? file.categoryId;
      if (categoryTypeId) {
        const categoryType = await db.eDocCategoryType.findFirst({ where: { id: categoryTypeId, categoryId } });
        if (!categoryType) return NextResponse.json({ message: "Category Type tidak sesuai dengan Category" }, { status: 400 });
      }
      data.categoryTypeId = categoryTypeId;
    }

    if (Array.isArray(body.businessUnitCodes)) data.businessUnitCodes = body.businessUnitCodes.map(String).filter(Boolean);
    if (Array.isArray(body.branchIds)) data.branchIds = body.branchIds.map(String).filter(Boolean);
    if ("organizationId" in body) data.organizationId = body.organizationId || null;

    if ("startDate" in body) data.startDate = body.startDate ? new Date(body.startDate) : null;

    const endDateProvided = "endDate" in body;
    const nextEndDate = endDateProvided ? (body.endDate ? new Date(body.endDate) : null) : file.endDate;
    const nextObsoleteDestinationFolderId = "obsoleteDestinationFolderId" in body
      ? (body.obsoleteDestinationFolderId || null)
      : file.obsoleteDestinationFolderId;
    if (nextEndDate) {
      if (isNaN(nextEndDate.getTime())) return NextResponse.json({ message: "End date tidak valid" }, { status: 400 });
      if (!nextObsoleteDestinationFolderId) {
        return NextResponse.json({ message: "Pilih folder tujuan Obsolete jika mengisi end date" }, { status: 400 });
      }
      const dest = await db.eDocFolder.findFirst({ where: { id: nextObsoleteDestinationFolderId, deletedAt: null } });
      if (!dest || dest.type !== "OBSOLETE") {
        return NextResponse.json({ message: "Folder tujuan harus bertipe Obsolete" }, { status: 400 });
      }
    }
    if (endDateProvided) data.endDate = nextEndDate;
    if ("obsoleteDestinationFolderId" in body) data.obsoleteDestinationFolderId = nextObsoleteDestinationFolderId;

    // Diketik manual (bukan hasil generateEDocNumber) — biasanya untuk dokumen lama hasil
    // Bulk Import yang sudah punya nomor asli dari arsip. Dicek unik terhadap file lain saja
    // (biar tidak bentrok/kelihatan seperti approval ganda) — bukan constraint DB, murni jaga
    // dari typo/duplikasi tidak sengaja.
    if ("documentNumber" in body) {
      const documentNumber = typeof body.documentNumber === "string" ? body.documentNumber.trim() || null : null;
      if (documentNumber) {
        const dup = await db.eDocFile.findFirst({ where: { documentNumber, deletedAt: null, id: { not: id } }, select: { id: true } });
        if (dup) return NextResponse.json({ message: "Nomor Dokumen ini sudah dipakai file lain" }, { status: 409 });
      }
      data.documentNumber = documentNumber;
    }
    if ("mocNumber" in body) data.mocNumber = typeof body.mocNumber === "string" ? body.mocNumber.trim() || null : null;

    if (typeof body.requiresItemImport === "boolean") data.requiresItemImport = body.requiresItemImport;

    const updated = await db.eDocFile.update({ where: { id }, data });
    return NextResponse.json({ data: updated });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
