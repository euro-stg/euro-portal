import { NextResponse } from "next/server";
import db from "@/lib/db/db";
import { requireSession, unauthorized } from "@/lib/api-auth";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!await requireSession()) return unauthorized();

    const { id } = await params;
    const user = await db.user.findUnique({ where: { id }, select: { id: true, source: true } });

    if (!user) return NextResponse.json({ message: "User tidak ditemukan" }, { status: 404 });
    if (user.source !== "manual")
      return NextResponse.json({ message: "Hanya user manual yang bisa dihapus" }, { status: 403 });

    await db.user.update({ where: { id }, data: { status: "inactive" } });

    return NextResponse.json({ message: "User dinonaktifkan" });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
