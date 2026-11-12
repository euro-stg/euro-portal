import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { unauthorized } from "@/lib/api-auth";
import db from "@/lib/db/db";
import {
  isSuperadmin, isEDocDocumentApprover, generateEDocNumber, validateManualEDocNumber,
  downloadEDocFile, stampEDocPdf, uploadEDocFileToFolder,
} from "@/lib/edoc";

// Generate MOC Number — aksi TERPISAH dari approve Document Number (confirmed 2026-08-27),
// bisa dijalankan kapan saja setelah Document Number sudah ada, oleh Document Approver.
// Optional per Category: kalau Category-nya belum punya EDocNumberFormat type MOC_NUMBER,
// generateEDocNumber akan melempar error yang informatif. MOC Number distempel ke PDF di
// kiri bawah semua halaman — versi sebelumnya dicatat di EDocFileRevisionLog.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();
    const userId = session.user.id;

    const [superadmin, approver] = await Promise.all([isSuperadmin(userId), isEDocDocumentApprover(userId)]);
    if (!superadmin && !approver) {
      return NextResponse.json({ message: "Anda tidak memiliki izin untuk generate MOC Number" }, { status: 403 });
    }

    const { id } = await params;
    const file = await db.eDocFile.findFirst({ where: { id, deletedAt: null } });
    if (!file) return NextResponse.json({ message: "File tidak ditemukan" }, { status: 404 });
    if (!file.documentNumber) {
      return NextResponse.json({ message: "Document Number belum ada — generate itu dulu sebelum MOC Number" }, { status: 409 });
    }
    if (file.mocNumber) {
      return NextResponse.json({ message: "MOC Number untuk file ini sudah pernah digenerate" }, { status: 409 });
    }

    // Body opsional: { manualNumber } = nomor diketik approver sendiri (divalidasi terhadap
    // format Category, tidak menaikkan counter urut). Tanpa body = otomatis dari format.
    const body = await request.json().catch(() => ({}));
    const manualNumber = typeof body?.manualNumber === "string" ? body.manualNumber : null;

    let mocNumber: string;
    try {
      if (manualNumber !== null) {
        mocNumber = await validateManualEDocNumber(id, "MOC_NUMBER", manualNumber);
        // MOC Number harus unik di seluruh file (yang belum dihapus).
        const dup = await db.eDocFile.findFirst({ where: { mocNumber, deletedAt: null, id: { not: id } }, select: { id: true } });
        if (dup) return NextResponse.json({ message: `MOC Number "${mocNumber}" sudah dipakai file lain` }, { status: 409 });
      } else {
        mocNumber = await generateEDocNumber(id, "MOC_NUMBER");
      }
    } catch (e) {
      return NextResponse.json({ message: e instanceof Error ? e.message : "Gagal generate MOC Number" }, { status: 400 });
    }

    // MOC Number di kiri bawah SEMUA halaman (posisi tetap, lihat stampEDocPdf), tepat di kanan
    // watermark approve kalau file ini di-approve lewat alur normal & Category punya watermark
    // (watermark itulah yang sudah tertempel di kiri bawah saat approve).
    const watermark = file.approvedBy ? await db.eDocWatermarkConfig.findUnique({ where: { categoryId: file.categoryId } }) : null;

    let newFileUrl = file.fileUrl;
    try {
      const nextcloudRes = await downloadEDocFile(file.fileUrl);
      if (!nextcloudRes.ok) throw new Error(`File tidak ditemukan di storage (${nextcloudRes.status})`);
      const originalBuffer = await nextcloudRes.arrayBuffer();
      const stampedBuffer = await stampEDocPdf(originalBuffer, [
        { text: mocNumber, corner: "BOTTOM_LEFT", allPages: true, after: watermark?.text },
      ]);
      newFileUrl = await uploadEDocFileToFolder(stampedBuffer, `moc-${Date.now()}.pdf`, file.folderId);
    } catch (e) {
      console.error("[edoc] gagal stempel MOC Number ke PDF — melanjutkan tanpa stempel", e);
    }

    const updated = await db.$transaction(async (tx) => {
      if (newFileUrl !== file.fileUrl) {
        await tx.eDocFileRevisionLog.create({ data: { fileId: id, previousFileUrl: file.fileUrl, replacedBy: userId } });
      }
      return tx.eDocFile.update({
        where: { id },
        data: { mocNumber, mocGeneratedBy: userId, mocGeneratedAt: new Date(), fileUrl: newFileUrl },
      });
    });

    return NextResponse.json({ data: updated });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
