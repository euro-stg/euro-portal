import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { unauthorized } from "@/lib/api-auth";
import db from "@/lib/db/db";

// Submit sekali, terkunci — enforced lewat unique constraint (feedbackId, userId) di
// EDocFeedbackResponse. Tidak ada endpoint edit setelah submit.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();
    const userId = session.user.id;

    const { id } = await params;
    const feedback = await db.eDocFeedback.findUnique({
      where: { id },
      include: { questions: { select: { id: true, type: true } } },
    });
    if (!feedback) return NextResponse.json({ message: "Feedback tidak ditemukan" }, { status: 404 });

    const existing = await db.eDocFeedbackResponse.findUnique({ where: { feedbackId_userId: { feedbackId: id, userId } } });
    if (existing) return NextResponse.json({ message: "Anda sudah pernah submit Feedback ini" }, { status: 409 });

    const body = await request.json().catch(() => ({}));
    const rawAnswers = Array.isArray(body?.answers) ? body.answers : [];
    const questionMap = new Map(feedback.questions.map((q) => [q.id, q.type]));

    type AnswerRow = { questionId: string; essayText: string | null; selectedOptions: string[] };
    const answers: AnswerRow[] = [];
    for (const a of rawAnswers) {
      const type = questionMap.get(a?.questionId);
      if (!type) continue; // soal tidak dikenal / bukan bagian dari feedback ini — diabaikan, bukan error keras
      if (type === "MULTIPLE_CHOICE") {
        const selectedOptions = Array.isArray(a?.selectedOptions) ? a.selectedOptions.filter((o: unknown) => typeof o === "string") : [];
        answers.push({ questionId: a.questionId, essayText: null, selectedOptions });
      } else {
        answers.push({ questionId: a.questionId, essayText: typeof a?.essayText === "string" ? a.essayText : null, selectedOptions: [] });
      }
    }

    const response = await db.eDocFeedbackResponse.create({
      data: {
        feedbackId: id,
        userId,
        answers: { create: answers },
      },
      include: { answers: true },
    });

    return NextResponse.json({ data: response }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
