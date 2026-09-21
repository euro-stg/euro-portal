import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { unauthorized } from "@/lib/api-auth";
import db from "@/lib/db/db";
import { canManageFeedback, type FeedbackQuestionInput } from "@/lib/edoc";

// Tambah satu atau beberapa soal sekaligus — dipakai baik untuk input manual maupun
// sebagai basis untuk endpoint import Excel (keduanya saling melengkapi, bukan eksklusif).
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

    const body = await request.json().catch(() => ({}));
    const rawQuestions = Array.isArray(body?.questions) ? body.questions : [body];

    const questions: FeedbackQuestionInput[] = [];
    for (const q of rawQuestions) {
      const type = q?.type === "MULTIPLE_CHOICE" ? "MULTIPLE_CHOICE" : q?.type === "ESSAY" ? "ESSAY" : null;
      const questionText = typeof q?.questionText === "string" ? q.questionText.trim() : "";
      if (!type || !questionText) {
        return NextResponse.json({ message: "Setiap soal wajib punya type (ESSAY/MULTIPLE_CHOICE) dan questionText" }, { status: 400 });
      }
      const options = Array.isArray(q?.options) ? q.options.filter((o: unknown) => typeof o === "string" && o.trim()) : [];
      if (type === "MULTIPLE_CHOICE" && options.length < 2) {
        return NextResponse.json({ message: "Soal pilihan ganda butuh minimal 2 opsi" }, { status: 400 });
      }
      questions.push({ type, questionText, options: type === "MULTIPLE_CHOICE" ? options : [] });
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

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
