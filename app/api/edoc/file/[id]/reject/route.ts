import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { unauthorized } from "@/lib/api-auth";
import db from "@/lib/db/db";
import { isSuperadmin, isEDocDocumentApprover } from "@/lib/edoc";

// Reject = jalur alternatif dari Approve, gerbang sama (role Document Approver/superadmin,
// file DRAFT + requiresNumber). Beda dari Approve: TIDAK generate nomor/stempel PDF, cuma
// pindah status ke REJECTED + catat alasan (WAJIB diisi, beda dari approvalNote yang
// opsional). Uploader bisa merevisi file yang REJECTED untuk resubmit — itu otomatis
// mengembalikan status ke DRAFT (lihat /api/edoc/file/[id]/revision).
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
      return NextResponse.json({ message: "Anda tidak memiliki izin untuk reject dokumen" }, { status: 403 });
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

    const body = await request.json().catch(() => ({}));
    const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
    if (!reason) return NextResponse.json({ message: "Alasan reject wajib diisi" }, { status: 400 });

    const updated = await db.eDocFile.update({
      where: { id },
      data: { status: "REJECTED", rejectedBy: userId, rejectedAt: new Date(), rejectionNote: reason },
    });

    return NextResponse.json({ data: updated });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
