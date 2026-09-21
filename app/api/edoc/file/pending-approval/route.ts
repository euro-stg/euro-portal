import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { unauthorized } from "@/lib/api-auth";
import db from "@/lib/db/db";
import { isSuperadmin, isEDocDocumentApprover } from "@/lib/edoc";

// "Approval Document" menu — daftar semua file DRAFT (requiresNumber=true, belum
// diapprove) di seluruh E Document, lintas folder. Digate oleh role Document Approver,
// BUKAN oleh ACL folder — approver adalah flat pool global (lihat catatan desain).
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();
    const userId = session.user.id;

    const [superadmin, approver] = await Promise.all([isSuperadmin(userId), isEDocDocumentApprover(userId)]);
    if (!superadmin && !approver) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const files = await db.eDocFile.findMany({
      where: { requiresNumber: true, status: "DRAFT", deletedAt: null },
      select: {
        id: true, title: true, description: true, fileUrl: true, createdAt: true,
        category: { select: { id: true, code: true, name: true } },
        categoryType: { select: { id: true, code: true, name: true } },
        folder: { select: { id: true, name: true } },
        uploader: { select: { id: true, name: true, employeeId: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ data: files });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
