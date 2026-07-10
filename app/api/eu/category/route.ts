import { NextResponse } from "next/server";
import db from "@/lib/db/db";
import { requireSession, unauthorized } from "@/lib/api-auth";

export async function GET() {
  try {
    if (!await requireSession()) return unauthorized();
    const categories = await db.euCategory.findMany({
      where: { isActive: true },
      orderBy: { order: "asc" },
    });
    return NextResponse.json({ data: categories });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    if (!await requireSession()) return unauthorized();
    const body = await request.json().catch(() => ({}));
    const { name, icon, color, order } = body as Record<string, string>;
    if (!name?.trim()) return NextResponse.json({ message: "Nama wajib diisi" }, { status: 400 });

    const category = await db.euCategory.create({
      data: { name: name.trim(), icon: icon?.trim() || null, color: color?.trim() || null, order: Number(order) || 0 },
    });
    return NextResponse.json({ data: category }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
