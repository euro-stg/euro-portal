import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { unauthorized } from "@/lib/api-auth";
import db from "@/lib/db/db";
import { canManageFeedback, parseFeedbackImport } from "@/lib/edoc";

// Import Excel yang sudah diisi -> bulk-generate soal. Additive terhadap soal yang sudah
// ada (manual atau dari import sebelumnya), bukan replace.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();

    const { id } = await params;
    const { allowed } = await canManageFeedback(session.user.id, id);
    if (!allowed) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ message: "File Excel wajib diupload" }, { status: 400 });

    let questions;
    try {
      questions = parseFeedbackImport(await file.arrayBuffer());
    } catch (e) {
      return NextResponse.json({ message: e instanceof Error ? e.message : "Gagal membaca file" }, { status: 400 });
    }

    const currentMax = await db.eDocFeedbackQuestion.aggregate({ where: { feedbackId: id }, _max: { order: true } });
    let nextOrder = (currentMax._max.order ?? -1) + 1;

    const created = await db.$transaction(
      questions.map((q) =>
        db.eDocFeedbackQuestion.create({
          data: { feedbackId: id, order: nextOrder++, type: q.type, questionText: q.questionText, options: q.options },
        })
      )
    );

    return NextResponse.json({ data: created, imported: created.length }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
