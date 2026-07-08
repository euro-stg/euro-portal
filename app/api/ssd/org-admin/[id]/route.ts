import { NextResponse } from "next/server";
import { requireSession, unauthorized } from "@/lib/api-auth";
import db from "@/lib/db/db";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!await requireSession()) return unauthorized();

    const { id } = await params;
    const existing = await db.ssdOrgAdmin.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ message: "Tidak ditemukan" }, { status: 404 });

    await db.ssdOrgAdmin.delete({ where: { id } });
    return NextResponse.json({ message: "Assignment dihapus" });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
