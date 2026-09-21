import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { unauthorized } from "@/lib/api-auth";
import { canManageFeedback, generateFeedbackExport } from "@/lib/edoc";

// Export semua response ke Excel — rows = responden, columns = soal.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();

    const { id } = await params;
    const { allowed } = await canManageFeedback(session.user.id, id);
    if (!allowed) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    const buffer = await generateFeedbackExport(id);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": "attachment; filename=feedback-responses.xlsx",
      },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
