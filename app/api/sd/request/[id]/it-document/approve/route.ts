import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db/db";
import { createNotification } from "@/lib/notifications";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { note } = body as { note?: string };

    const req = await db.sdRequest.findFirst({
      where: { id, deletedAt: null },
      include: { itDocument: true },
    });

    if (!req) return NextResponse.json({ message: "Pengajuan tidak ditemukan" }, { status: 404 });
    if (!req.itDocument) return NextResponse.json({ message: "Dokumen IT belum dibuat" }, { status: 400 });

    if (session.user.id !== req.requestedBy) {
      return NextResponse.json({ message: "Hanya pengaju yang dapat menyetujui dokumen IT" }, { status: 403 });
    }

    if (req.status !== "APPROVED_IT") {
      return NextResponse.json({ message: "Status tidak valid untuk approve dokumen" }, { status: 400 });
    }

    await db.$transaction([
      db.sdItDocument.update({
        where: { requestId: id },
        data: { approvedBy: session.user.id, approvedAt: new Date(), updatedAt: new Date() },
      }),
      db.sdRequest.update({
        where: { id },
        data: { status: "APPROVED_USER", updatedAt: new Date() },
      }),
      db.sdActivity.create({
        data: {
          requestId: id,
          userId: session.user.id,
          action: "USER_APPROVED_DOC",
          note: note?.trim() || "User menyetujui dokumen IT",
        },
      }),
    ]);

    // Notify PIC: dokumen disetujui, mulai development
    if (req.picId && req.picId !== session.user.id) {
      await createNotification(req.picId, "Dokumen IT Disetujui",
        `Pengaju menyetujui dokumen IT untuk "${req.title}". Siap memulai development.`,
        "APPROVAL_ACTION", id, "SD");
    }

    return NextResponse.json({ message: "Dokumen IT disetujui" });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
