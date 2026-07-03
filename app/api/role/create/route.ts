import { NextResponse } from "next/server";
import prisma from "@/lib/db/db";
import { requireSession, unauthorized } from "@/lib/api-auth";

export async function POST(request: Request) {
  try {
    if (!await requireSession()) return unauthorized();
    const body        = await request.json();
    const name        = String(body.name        ?? "").trim();
    const description = String(body.description ?? "").trim() || null;
    const status      = String(body.status      ?? "active").trim();
    const appId: string | null = body.appId !== undefined
      ? (body.appId === null ? null : String(body.appId))
      : null;

    if (!name) return NextResponse.json({ message: "Name wajib diisi" }, { status: 400 });

    const exists = await prisma.role.findFirst({ where: { name, appId, deletedAt: null } });
    if (exists)  return NextResponse.json({ message: "Nama role sudah ada" }, { status: 409 });

    const role = await prisma.role.create({ data: { name, description, status, appId } });
    return NextResponse.json({ message: "Role berhasil dibuat", data: role }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
