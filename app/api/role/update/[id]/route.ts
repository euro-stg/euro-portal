import { NextResponse } from "next/server";
import prisma from "@/lib/db/db";
import { requireSession, unauthorized } from "@/lib/api-auth";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!await requireSession()) return unauthorized();
    const { id }      = await params;
    const body        = await request.json().catch(() => ({}));
    const name        = String(body.name        ?? "").trim();
    const description = String(body.description ?? "").trim() || null;
    const status      = String(body.status      ?? "").trim();

    const role = await prisma.role.findUnique({ where: { id } });
    if (!role)           return NextResponse.json({ message: "Tidak ditemukan" },   { status: 404 });
    if (role.isLocked)   return NextResponse.json({ message: "Role ini terkunci" }, { status: 403 });
    if (!name)           return NextResponse.json({ message: "Name wajib diisi" },  { status: 400 });

    const dup = await prisma.role.findFirst({ where: { name, deletedAt: null, NOT: { id } } });
    if (dup) return NextResponse.json({ message: "Nama role sudah ada" }, { status: 409 });

    const updated = await prisma.role.update({
      where: { id },
      data: { name, description, status: status || role.status, updatedAt: new Date() },
    });
    return NextResponse.json({ message: "Role berhasil diperbarui", data: updated });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
