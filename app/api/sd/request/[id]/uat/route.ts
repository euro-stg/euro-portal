import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db/db";
import { createNotification } from "@/lib/notifications";

// POST: IT marks as UAT ready (creates UAT record)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const userId = session.user.id;

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { note } = body as { note?: string };

    const req = await db.sdRequest.findFirst({ where: { id, deletedAt: null } });
    if (!req) return NextResponse.json({ message: "Tidak ditemukan" }, { status: 404 });

    if (session.user.id !== req.picId) {
      return NextResponse.json({ message: "Hanya IT PIC yang dapat menandai UAT ready" }, { status: 403 });
    }

    if (req.status !== "IN_PROGRESS") {
      return NextResponse.json({ message: "Status harus IN_PROGRESS untuk masuk UAT" }, { status: 400 });
    }

    await db.$transaction(async (tx) => {
      const existing = await tx.sdUat.findUnique({ where: { requestId: id } });
      if (!existing) {
        await tx.sdUat.create({ data: { requestId: id, note: note?.trim() || null } });
      }
      await tx.sdRequest.update({ where: { id }, data: { status: "UAT", updatedAt: new Date() } });
      await tx.sdActivity.create({
        data: { requestId: id, userId, action: "UAT_READY", note: note?.trim() || "Development selesai, siap UAT" },
      });
    });

    // Notify requester: siap UAT
    if (req.requestedBy !== userId) {
      await createNotification(req.requestedBy, "Siap User Acceptance Test (UAT)",
        `"${req.title}" telah selesai dikembangkan dan siap untuk diuji`,
        "APPROVAL_ACTION", id, "SD");
    }

    return NextResponse.json({ message: "Status diubah ke UAT" });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
