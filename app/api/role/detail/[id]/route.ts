import { NextResponse } from "next/server";
import prisma from "@/lib/db/db";
import { requireSession, unauthorized } from "@/lib/api-auth";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!await requireSession()) return unauthorized();
    const { id } = await params;
    const role = await prisma.role.findUnique({ where: { id } });
    if (!role) return NextResponse.json({ message: "Tidak ditemukan" }, { status: 404 });
    return NextResponse.json({ data: role });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
