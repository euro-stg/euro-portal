import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { unauthorized } from "@/lib/api-auth";
import db from "@/lib/db/db";
import { isEDocDocumentApprover, isSuperadmin, deleteEDocFile, canViewFile, canEditFileMetadata } from "@/lib/edoc";
import { checkValidity, resolveInitiator } from "@/lib/edoc-file-fields";

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
        folder: { select: { id: true, name: true } },
        obsoleteDestination: { select: { id: true, name: true } },
        initiator: { select: { id: true, name: true, employeeId: true } },
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
    // Move File (2026-09-30) — sama filosofinya seperti Blast (murni soal lokasi, tidak
    // menyentuh isi/status resmi), TAPI sengaja tidak diperluas ke folder-ACL-write seperti
    // canManageBlast/canEditMetadata (dikonfirmasi user: cuma uploader file ini atau
    // superadmin, titik).
    const canMove = superadmin || file.uploadedBy === userId;

    // Download (2026-10-07) murni ikut flag per file — tidak ada role yang dikecualikan,
    // lihat EDocFile.allowDownload. Melihat isi PDF selalu boleh lewat viewer (/view).
    // File diproteksi tetap bisa di-download superadmin & Document Approver (2026-10-28).
    const canDownload = file.allowDownload || superadmin || approver;

    return NextResponse.json({
      data: file, canWrite: canManage, canDelete: canManage, canManageBlast, canEditMetadata, canMove, canDownload,
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

    // Urutan disamakan dengan Upload/Move (2026-10-01, sebelumnya kebalik — DB ditandai
    // terhapus DULU baru coba hapus fisik, kegagalan fisiknya didiamkan lewat .catch() —
    // kalau Nextcloud lagi mati, user melihat "File dihapus" sukses padahal file fisiknya
    // jadi yatim/orphan selamanya, tidak pernah ketahuan/dibersihkan). Sekarang: hapus fisik
    // DULU, DB cuma ditandai terhapus kalau itu benar-benar berhasil — konsisten dengan
    // uploadEDocFileToFolder (upload dulu baru insert DB) dan moveEDocFile (move dulu baru
    // update DB). deleteEDocFile sendiri sudah menganggap 404 (file sudah tidak ada) sebagai
    // sukses, jadi file yang kebetulan sudah hilang duluan tetap bisa ditandai terhapus.
    try {
      await deleteEDocFile(file.fileUrl);
    } catch (e) {
      console.error("[edoc] gagal menghapus file fisik di Nextcloud", e);
      return NextResponse.json({ message: e instanceof Error ? e.message : "Gagal menghapus file di Nextcloud — file TIDAK ditandai terhapus, coba lagi nanti" }, { status: 502 });
    }
    await db.eDocFile.update({ where: { id }, data: { deletedAt: new Date() } });

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
    if ("organizationId" in body) {
      // Wajib sejak 2026-10-15 (lihat POST /api/edoc/file) — tidak boleh dikosongkan lewat Edit.
      if (!body.organizationId) return NextResponse.json({ message: "Organisasi/Departemen wajib dipilih" }, { status: 400 });
      const org = await db.organization.findFirst({ where: { id: String(body.organizationId), deletedAt: null }, select: { id: true, code: true } });
      if (!org) return NextResponse.json({ message: "Organisasi/Departemen tidak ditemukan" }, { status: 400 });
      if (!org.code?.trim()) {
        return NextResponse.json({ message: "Organisasi/Departemen ini belum punya kode — isi kodenya di Master Organization dulu" }, { status: 400 });
      }
      data.organizationId = org.id;
    }

    if ("startDate" in body) data.startDate = body.startDate ? new Date(body.startDate) : null;

    // Masa berlaku (2026-10-19): TETAP memaksa End Date & folder Obsolete kosong.
    const nextValidityType: string = "validityType" in body ? String(body.validityType ?? "") : file.validityType;
    const forceNoEnd = nextValidityType === "TETAP";
    const endDateProvided = "endDate" in body || forceNoEnd;
    const nextEndDate = forceNoEnd ? null : ("endDate" in body ? (body.endDate ? new Date(body.endDate) : null) : file.endDate);
    const nextObsoleteDestinationFolderId = forceNoEnd ? null : ("obsoleteDestinationFolderId" in body
      ? (body.obsoleteDestinationFolderId || null)
      : file.obsoleteDestinationFolderId);
    if ("validityType" in body || "endDate" in body) {
      const validity = checkValidity(nextValidityType, nextEndDate);
      if (validity.error) return NextResponse.json({ message: validity.error }, { status: 400 });
      data.validityType = validity.value;
    }
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
    if ("obsoleteDestinationFolderId" in body || forceNoEnd) data.obsoleteDestinationFolderId = nextObsoleteDestinationFolderId;

    // Inisiator (2026-10-19): ganti orang → jabatan di-snapshot ulang (atau pakai isian form);
    // kalau cuma jabatan yang dikirim, snapshot-nya saja yang dikoreksi.
    if ("initiatorId" in body) {
      const initiator = await resolveInitiator(body.initiatorId ? String(body.initiatorId) : null,
        typeof body.initiatorJobPositionName === "string" ? body.initiatorJobPositionName : null);
      if ("error" in initiator) return NextResponse.json({ message: initiator.error }, { status: 400 });
      data.initiatorId = initiator.initiatorId;
      data.initiatorJobPositionName = initiator.initiatorJobPositionName;
    } else if ("initiatorJobPositionName" in body) {
      data.initiatorJobPositionName = typeof body.initiatorJobPositionName === "string" ? body.initiatorJobPositionName.trim() || null : null;
    }

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
    if (typeof body.allowDownload === "boolean") data.allowDownload = body.allowDownload;

    const updated = await db.eDocFile.update({ where: { id }, data });
    return NextResponse.json({ data: updated });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
