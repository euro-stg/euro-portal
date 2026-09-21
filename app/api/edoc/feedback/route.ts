import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { unauthorized } from "@/lib/api-auth";
import db from "@/lib/db/db";
import { isSuperadmin } from "@/lib/edoc";

// Feedback dikelola sepenuhnya oleh uploader file-nya (bukan Folder Creator, bukan role
// terpisah) — superadmin ikut sebagai safety net. Maksimal 1 Feedback per file.

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();
    const userId = session.user.id;

    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get("fileId");
    if (!fileId) return NextResponse.json({ message: "fileId wajib diisi" }, { status: 400 });

    const feedback = await db.eDocFeedback.findUnique({
      where: { fileId },
      include: { questions: { orderBy: { order: "asc" } } },
    });
    if (!feedback) return NextResponse.json({ data: null });

    const myResponse = await db.eDocFeedbackResponse.findUnique({
      where: { feedbackId_userId: { feedbackId: feedback.id, userId } },
      select: { id: true, submittedAt: true },
    });

    return NextResponse.json({ data: feedback, alreadySubmitted: !!myResponse, submittedAt: myResponse?.submittedAt ?? null });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();
    const userId = session.user.id;

    const body = await request.json().catch(() => ({}));
    const { fileId } = body as { fileId?: string };
    if (!fileId) return NextResponse.json({ message: "fileId wajib diisi" }, { status: 400 });

    const file = await db.eDocFile.findFirst({ where: { id: fileId, deletedAt: null } });
    if (!file) return NextResponse.json({ message: "File tidak ditemukan" }, { status: 404 });

    const superadmin = await isSuperadmin(userId);
    if (!superadmin && file.uploadedBy !== userId) {
      return NextResponse.json({ message: "Hanya uploader file ini yang bisa membuat Feedback" }, { status: 403 });
    }

    const existing = await db.eDocFeedback.findUnique({ where: { fileId } });
    if (existing) return NextResponse.json({ message: "File ini sudah punya Feedback" }, { status: 409 });

    const feedback = await db.eDocFeedback.create({ data: { fileId, createdBy: userId } });
    return NextResponse.json({ data: feedback }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
