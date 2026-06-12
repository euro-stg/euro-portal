import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db/db";

// GET: list progress stages
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const rows = await db.sdProgress.findMany({
      where: { requestId: id },
      orderBy: { order: "asc" },
    });
    return NextResponse.json({ data: rows });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

// POST: replace all progress stages
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
    const { stages } = body as {
      stages?: Array<{ label: string; status: string; note?: string; order: number }>;
    };

    if (!Array.isArray(stages) || stages.length === 0) {
      return NextResponse.json({ message: "Stages wajib diisi" }, { status: 400 });
    }

    const req = await db.sdRequest.findFirst({ where: { id, deletedAt: null } });
    if (!req) return NextResponse.json({ message: "Tidak ditemukan" }, { status: 404 });

    if (session.user.id !== req.picId) {
      return NextResponse.json({ message: "Hanya IT PIC yang dapat mengupdate progress" }, { status: 403 });
    }

    await db.$transaction(async (tx) => {
      await tx.sdProgress.deleteMany({ where: { requestId: id } });
      await tx.sdProgress.createMany({
        data: stages.map((s) => ({
          requestId: id,
          label: s.label,
          status: s.status,
          note: s.note || null,
          order: s.order,
        })),
      });

      // Auto transition to IN_PROGRESS if APPROVED_USER
      if (req.status === "APPROVED_USER") {
        await tx.sdRequest.update({ where: { id }, data: { status: "IN_PROGRESS", updatedAt: new Date() } });
      }

      await tx.sdActivity.create({
        data: { requestId: id, userId, action: "PROGRESS_UPDATE", note: "Progress diperbarui" },
      });
    });

    return NextResponse.json({ message: "Progress diperbarui" });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
