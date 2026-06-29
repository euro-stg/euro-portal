import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/db/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const companies = await prisma.company.findMany({
    where: { deletedAt: null },
    orderBy: { order: "asc" },
  });

  return NextResponse.json({ data: companies });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { code, name, order, status } = body as {
    code?: string;
    name?: string;
    order?: number;
    status?: string;
  };

  if (!code?.trim() || !name?.trim()) {
    return NextResponse.json({ message: "code dan name wajib diisi" }, { status: 400 });
  }

  const existing = await prisma.company.findFirst({ where: { code: code.trim(), deletedAt: null } });
  if (existing) {
    return NextResponse.json({ message: "Kode perusahaan sudah digunakan" }, { status: 409 });
  }

  const company = await prisma.company.create({
    data: {
      code: code.trim().toUpperCase(),
      name: name.trim(),
      order: order ?? 0,
      status: status ?? "active",
    },
  });

  return NextResponse.json({ data: company }, { status: 201 });
}
