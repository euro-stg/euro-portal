import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db/db";
import { createNotification } from "@/lib/notifications";

// PUT: upsert IT document
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { content } = body as { content?: string };

    if (!content?.trim()) return NextResponse.json({ message: "Konten dokumen wajib diisi" }, { status: 400 });

    const req = await db.sdRequest.findFirst({ where: { id, deletedAt: null } });
    if (!req) return NextResponse.json({ message: "Pengajuan tidak ditemukan" }, { status: 404 });

    if (!req.picId) {
      return NextResponse.json({ message: "IT PIC belum ditentukan untuk pengajuan ini" }, { status: 403 });
    }
    if (session.user.id !== req.picId) {
      return NextResponse.json({ message: "Hanya IT PIC yang dapat membuat atau mengedit dokumen IT" }, { status: 403 });
    }

    const existing = await db.sdItDocument.findUnique({ where: { requestId: id } });
    let doc;

    if (existing) {
      doc = await db.sdItDocument.update({
        where: { requestId: id },
        data: { content: content.trim(), updatedAt: new Date() },
      });
    } else {
      doc = await db.sdItDocument.create({
        data: { requestId: id, content: content.trim(), createdBy: session.user.id },
      });
    }

    // Auto transition: SUBMITTED → IT_REVIEW
    if (req.status === "SUBMITTED") {
      await db.sdRequest.update({ where: { id }, data: { status: "IT_REVIEW", updatedAt: new Date() } });
    }
    // Auto transition: IT_REVIEW → APPROVED_IT when doc saved
    if (req.status === "IT_REVIEW" || req.status === "SUBMITTED") {
      await db.sdRequest.update({ where: { id }, data: { status: "APPROVED_IT", updatedAt: new Date() } });
    }

    await db.sdActivity.create({
      data: {
        requestId: id,
        userId: session.user.id,
        action: "IT_DOC_SAVED",
        note: existing ? "Dokumen IT diperbarui" : "Dokumen IT dibuat",
      },
    });

    // Notify requester: dokumen IT perlu direview
    if (req.requestedBy !== session.user.id) {
      await createNotification(req.requestedBy, "Dokumen IT Perlu Persetujuan",
        `PIC telah ${existing ? "memperbarui" : "membuat"} dokumen IT untuk "${req.title}". Mohon ditinjau dan disetujui.`,
        "APPROVAL_REQUEST", id, "SD");
    }

    return NextResponse.json({ data: doc });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
