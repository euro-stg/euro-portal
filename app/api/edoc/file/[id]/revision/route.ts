import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { unauthorized } from "@/lib/api-auth";
import db from "@/lib/db/db";
import { isSuperadmin, uploadEDocFileToFolder } from "@/lib/edoc";

export const maxDuration = 60;

const ALLOWED_MIME = ["application/pdf"];

// Revisi TIDAK memicu approval ulang dan TIDAK mengubah documentNumber/mocNumber — versi
// baru langsung aktif, versi lama dicatat di EDocFileRevisionLog untuk audit. Feedback yang
// sudah masuk terhadap file ini juga tidak terpengaruh (dibiarkan apa adanya). PENGECUALIAN:
// kalau file sedang REJECTED, revisi otomatis balik status-nya ke DRAFT (resubmit — masuk
// lagi ke antrian Approval Document), catatan reject lama dibiarkan sebagai jejak historis
// (tidak dihapus, cuma tidak lagi relevan untuk status yang aktif).
//
// Akses (dipertegas 2026-09-15, sama seperti aturan DELETE): uploader boleh revisi HANYA
// selagi file belum lolos approval resmi (requiresNumber=false, ATAU masih DRAFT/REJECTED).
// Begitu file requiresNumber sudah RELEASE (sudah punya Document Number resmi), cuma
// superadmin yang boleh revisi — uploader sendiri pun tidak lagi cukup.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();
    const userId = session.user.id;

    const { id } = await params;
    const existing = await db.eDocFile.findFirst({ where: { id, deletedAt: null } });
    if (!existing) return NextResponse.json({ message: "File tidak ditemukan" }, { status: 404 });

    const superadmin = await isSuperadmin(userId);
    const isUploader = existing.uploadedBy === userId;
    const canRevise = superadmin || (isUploader && (!existing.requiresNumber || existing.status === "DRAFT" || existing.status === "REJECTED"));
    if (!canRevise) {
      const message = isUploader
        ? "File yang sudah di-approve (punya Document Number resmi) hanya bisa direvisi oleh superadmin"
        : "Hanya pembuat file atau superadmin yang bisa merevisi file ini";
      return NextResponse.json({ message }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ message: "File wajib diupload" }, { status: 400 });
    if (!ALLOWED_MIME.includes(file.type) && !file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ message: "Hanya file PDF yang diperbolehkan" }, { status: 400 });
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const filename = `${ts}-${safeName}`;
    const buffer = await file.arrayBuffer();
    const newFileUrl = await uploadEDocFileToFolder(buffer, filename, existing.folderId);

    const [, updated] = await db.$transaction([
      db.eDocFileRevisionLog.create({
        data: { fileId: id, previousFileUrl: existing.fileUrl, replacedBy: userId },
      }),
      db.eDocFile.update({
        where: { id },
        data: { fileUrl: newFileUrl, status: existing.status === "REJECTED" ? "DRAFT" : existing.status },
      }),
    ]);

    return NextResponse.json({ data: updated });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
