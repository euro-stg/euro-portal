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
    const userId = session.user.id;

    const { id } = await params;
    const req = await db.sdRequest.findFirst({ where: { id, deletedAt: null } });
    if (!req) return NextResponse.json({ message: "Pengajuan tidak ditemukan" }, { status: 404 });
    if (req.status !== "APPROVED_IT")
      return NextResponse.json({ message: "Hanya bisa revisi dari status menunggu persetujuan" }, { status: 400 });
    if (req.requestedBy !== userId)
      return NextResponse.json({ message: "Hanya pengaju yang dapat meminta revisi dokumen IT" }, { status: 403 });

    const body = await request.json().catch(() => ({}));
    const note = (body.note as string | undefined)?.trim() || null;

    await db.$transaction([
      db.sdRequest.update({
        where: { id },
        data: { status: "IT_REVIEW", updatedAt: new Date() },
      }),
      db.sdActivity.create({
        data: {
          requestId: id,
          userId,
          action: "IT_DOC_REVISION",
          note: note ?? "Pengaju meminta revisi dokumen IT",
        },
      }),
    ]);

    if (req.picId && req.picId !== userId) {
      await createNotification(
        req.picId,
        "Revisi Dokumen IT Diminta",
        `"${req.title}": ${note ?? "Pengaju meminta revisi pada dokumen IT"}`,
        "APPROVAL_REQUEST", id, "SD"
      );
    }

    return NextResponse.json({ message: "Dokumen IT dikembalikan untuk revisi" });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
