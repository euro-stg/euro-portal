import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db/db";
import { unauthorized } from "@/lib/api-auth";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();

    const { id } = await params;

    try {
      await db.euReadLog.create({ data: { postId: id, userId: session.user.id } });
    } catch (e) {
      if ((e as { code?: string }).code !== "P2002") throw e;
    }

    return NextResponse.json({ message: "Marked as read" });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!await import("@/lib/api-auth").then(m => m.requireSession())) return unauthorized();

    const { id } = await params;
    const logs = await db.euReadLog.findMany({
      where: { postId: id },
      include: { user: { select: { id: true, name: true, employeeId: true, organizationName: true } } },
      orderBy: { readAt: "asc" },
    });
    return NextResponse.json({ data: logs });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
