import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db/db";

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
      include: { uat: true },
    });

    if (!req) return NextResponse.json({ message: "Tidak ditemukan" }, { status: 404 });

    if (session.user.id !== req.requestedBy) {
      return NextResponse.json({ message: "Hanya pengaju yang dapat menyetujui UAT" }, { status: 403 });
    }

    if (req.status !== "UAT") return NextResponse.json({ message: "Status harus UAT" }, { status: 400 });

    await db.$transaction([
      db.sdUat.update({
        where: { requestId: id },
        data: { approvedBy: session.user.id, approvedAt: new Date(), updatedAt: new Date() },
      }),
      db.sdRequest.update({
        where: { id },
        data: { status: "DONE", updatedAt: new Date() },
      }),
      db.sdActivity.create({
        data: {
          requestId: id,
          userId: session.user.id,
          action: "UAT_APPROVED",
          note: note?.trim() || "User menyetujui hasil UAT",
        },
      }),
    ]);

    return NextResponse.json({ message: "UAT disetujui, pengajuan DONE" });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
