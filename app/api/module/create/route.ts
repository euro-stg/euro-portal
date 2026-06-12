import { NextResponse } from "next/server";
import prisma from "@/lib/db/db";

export async function POST(request: Request) {
  try {
    const body   = await request.json();
    const name       = String(body.name       ?? "").trim();
    const path       = String(body.path       ?? "").trim();
    const icon       = String(body.icon       ?? "").trim() || null;
    const color      = String(body.color      ?? "").trim() || null;
    const group      = String(body.group      ?? "").trim() || null;
    const order      = Number(body.order      ?? 0);
    const status     = String(body.status     ?? "active").trim();
    const type        = String(body.type        ?? "module").trim();
    const description = String(body.description ?? "").trim() || null;
    const isExternal  = Boolean(body.isExternal ?? false);
    const externalUrl = String(body.externalUrl ?? "").trim() || null;

    if (!name) return NextResponse.json({ message: "Name wajib diisi" }, { status: 400 });
    if (!path) return NextResponse.json({ message: "Path wajib diisi" }, { status: 400 });

    const mod = await prisma.module.create({ data: { name, path, icon, color, group, order, status, type, description, isExternal, externalUrl } });
    return NextResponse.json({ message: "Module berhasil dibuat", data: mod }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
