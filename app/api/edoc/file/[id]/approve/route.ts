import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { unauthorized } from "@/lib/api-auth";
import db from "@/lib/db/db";
import {
  isSuperadmin, isEDocDocumentApprover, generateEDocNumber,
  downloadEDocFile, stampEDocPdf, uploadEDocFileToFolder,
} from "@/lib/edoc";

// Approve = generate Document Number (via Number Format Builder milik Category file ini),
// stempel Document Number + Watermark (kalau Category-nya sudah punya EDocWatermarkConfig)
// ke halaman 1 PDF sesuai posisi yang dikonfigurasi, lalu set status RELEASE. Versi PDF
// sebelum di-stamp dicatat di EDocFileRevisionLog untuk audit (reuse mekanisme revisi yang
// sudah ada). MOC Number sengaja TIDAK digenerate di sini — itu aksi terpisah, lihat
// /api/edoc/file/[id]/moc.
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
      return NextResponse.json({ message: "Anda tidak memiliki izin untuk approve dokumen" }, { status: 403 });
    }

    const { id } = await params;
    const file = await db.eDocFile.findFirst({ where: { id, deletedAt: null } });
    if (!file) return NextResponse.json({ message: "File tidak ditemukan" }, { status: 404 });
    if (!file.requiresNumber) {
      return NextResponse.json({ message: "File ini tidak meminta nomor dokumen" }, { status: 400 });
    }
    if (file.status !== "DRAFT") {
      return NextResponse.json({ message: "File ini sudah tidak berstatus DRAFT" }, { status: 409 });
    }
    if (file.requiresItemImport) {
      const productCount = await db.eDocImProduct.count({ where: { fileId: id } });
      if (productCount === 0) {
        return NextResponse.json({ message: "File ini ditandai sebagai promo — import minimal 1 item/produk dulu sebelum bisa di-approve" }, { status: 400 });
      }
    }

    const body = await request.json().catch(() => ({}));
    const note = typeof body?.note === "string" ? body.note.trim() || null : null;

    let documentNumber: string;
    try {
      documentNumber = await generateEDocNumber(id, "DOCUMENT_NUMBER");
    } catch (e) {
      return NextResponse.json({ message: e instanceof Error ? e.message : "Gagal generate nomor dokumen" }, { status: 400 });
    }

    // Stempel Document Number + Watermark (kalau ada) ke PDF sesuai posisi per-Category.
    const [docNumberFormat, watermark] = await Promise.all([
      db.eDocNumberFormat.findUnique({ where: { categoryId_type: { categoryId: file.categoryId, type: "DOCUMENT_NUMBER" } } }),
      db.eDocWatermarkConfig.findUnique({ where: { categoryId: file.categoryId } }),
    ]);

    let newFileUrl = file.fileUrl;
    try {
      const nextcloudRes = await downloadEDocFile(file.fileUrl);
      if (!nextcloudRes.ok) throw new Error(`File tidak ditemukan di storage (${nextcloudRes.status})`);
      const originalBuffer = await nextcloudRes.arrayBuffer();

      const stamps = [];
      if (docNumberFormat?.positionXMm != null && docNumberFormat?.positionYMm != null) {
        stamps.push({ text: documentNumber, positionXMm: docNumberFormat.positionXMm, positionYMm: docNumberFormat.positionYMm, fontSize: docNumberFormat.fontSize ?? undefined });
      }
      if (watermark) {
        stamps.push({ text: watermark.text, positionXMm: watermark.positionXMm, positionYMm: watermark.positionYMm, fontSize: watermark.fontSize, color: watermark.color });
      }

      if (stamps.length > 0) {
        const stampedBuffer = await stampEDocPdf(originalBuffer, stamps);
        const filename = `approved-${Date.now()}.pdf`;
        newFileUrl = await uploadEDocFileToFolder(stampedBuffer, filename, file.folderId);
      }
    } catch (e) {
      console.error("[edoc] gagal stempel PDF saat approve — melanjutkan tanpa stempel", e);
      // Tidak menggagalkan approval hanya karena stamping gagal — nomor tetap wajib jalan,
      // admin bisa cek log dan stempel manual kalau perlu.
    }

    const updated = await db.$transaction(async (tx) => {
      if (newFileUrl !== file.fileUrl) {
        await tx.eDocFileRevisionLog.create({ data: { fileId: id, previousFileUrl: file.fileUrl, replacedBy: userId } });
      }
      return tx.eDocFile.update({
        where: { id },
        data: {
          documentNumber,
          status: "RELEASE",
          approvedBy: userId,
          approvedAt: new Date(),
          approvalNote: note,
          fileUrl: newFileUrl,
        },
      });
    });

    return NextResponse.json({ data: updated });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
