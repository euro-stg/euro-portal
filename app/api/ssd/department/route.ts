import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db/db";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const data = await db.ssdDepartment.findMany({
      where: { deletedAt: null },
      orderBy: { order: "asc" },
    });
    return NextResponse.json({ data });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const { code, name, order } = body as { code?: string; name?: string; order?: number };

    if (!code?.trim()) return NextResponse.json({ message: "Kode wajib diisi" }, { status: 400 });
    if (!name?.trim()) return NextResponse.json({ message: "Nama wajib diisi" }, { status: 400 });

    const existing = await db.ssdDepartment.findFirst({ where: { code: code.trim().toUpperCase(), deletedAt: null } });
    if (existing) return NextResponse.json({ message: "Kode departemen sudah digunakan" }, { status: 409 });

    const data = await db.ssdDepartment.create({
      data: { code: code.trim().toUpperCase(), name: name.trim(), order: order ?? 0 },
    });
    return NextResponse.json({ data }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
