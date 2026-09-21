import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { unauthorized } from "@/lib/api-auth";
import { isSuperadmin } from "@/lib/edoc";
import db from "@/lib/db/db";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();
    if (!(await isSuperadmin(session.user.id))) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const { userId } = await params;
    await db.eDocDocumentApprover.delete({ where: { userId } }).catch(() => null);
    return NextResponse.json({ message: "Document Approver role dicabut" });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
