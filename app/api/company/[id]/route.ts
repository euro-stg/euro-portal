import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/db/db";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { code, name, order, status } = body as {
    code?: string;
    name?: string;
    order?: number;
    status?: string;
  };

  const company = await prisma.company.findFirst({ where: { id, deletedAt: null } });
  if (!company) return NextResponse.json({ message: "Perusahaan tidak ditemukan" }, { status: 404 });

  if (code) {
    const dup = await prisma.company.findFirst({ where: { code: code.trim().toUpperCase(), deletedAt: null, NOT: { id } } });
    if (dup) return NextResponse.json({ message: "Kode perusahaan sudah digunakan" }, { status: 409 });
  }

  const updated = await prisma.company.update({
    where: { id },
    data: {
      ...(code  ? { code: code.trim().toUpperCase() }  : {}),
      ...(name  ? { name: name.trim() }                : {}),
      ...(order !== undefined ? { order }               : {}),
      ...(status ? { status }                           : {}),
      updatedAt: new Date(),
    },
  });

  return NextResponse.json({ data: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const company = await prisma.company.findFirst({ where: { id, deletedAt: null } });
  if (!company) return NextResponse.json({ message: "Perusahaan tidak ditemukan" }, { status: 404 });

  await prisma.company.update({ where: { id }, data: { deletedAt: new Date() } });
  return NextResponse.json({ message: "Perusahaan dihapus" });
}
