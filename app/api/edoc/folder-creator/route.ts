import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { unauthorized } from "@/lib/api-auth";
import { isSuperadmin } from "@/lib/edoc";
import db from "@/lib/db/db";

// Folder Creator adalah role global E Document, independen dari Role/Module Portal.
// Hanya superadmin yang boleh assign/revoke — lihat catatan desain E Document.

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();
    if (!(await isSuperadmin(session.user.id))) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const rows = await db.eDocFolderCreator.findMany({
      include: { user: { select: { id: true, name: true, employeeId: true, branchName: true, jobPositionName: true } } },
      orderBy: { assignedAt: "desc" },
    });
    return NextResponse.json({ data: rows });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();
    if (!(await isSuperadmin(session.user.id))) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const { userId } = body as { userId?: string };
    if (!userId) return NextResponse.json({ message: "userId wajib diisi" }, { status: 400 });

    const targetUser = await db.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!targetUser) return NextResponse.json({ message: "User tidak ditemukan" }, { status: 404 });

    const row = await db.eDocFolderCreator.upsert({
      where: { userId },
      create: { userId, assignedBy: session.user.id },
      update: { assignedBy: session.user.id, assignedAt: new Date() },
    });
    return NextResponse.json({ data: row }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
