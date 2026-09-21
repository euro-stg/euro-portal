import { NextResponse } from "next/server";
import prisma from "@/lib/db/db";
import { requireSession, unauthorized } from "@/lib/api-auth";

export async function POST(request: Request) {
  try {
    if (!await requireSession()) return unauthorized();
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
    // App Induk — cuma relevan untuk type "module" (menu sidebar di dalam sebuah app);
    // module portal-level (sidebar utama, di luar app manapun) appId-nya tetap null,
    // begitu juga row type "app" itu sendiri (dia yang jadi tujuan, bukan yang menunjuk).
    const appIdRaw = String(body.appId ?? "").trim() || null;
    const appId    = type === "module" ? appIdRaw : null;

    if (!name) return NextResponse.json({ message: "Name wajib diisi" }, { status: 400 });
    if (!path) return NextResponse.json({ message: "Path wajib diisi" }, { status: 400 });
    if (appId) {
      const parentApp = await prisma.module.findFirst({ where: { id: appId, type: "app", deletedAt: null } });
      if (!parentApp) return NextResponse.json({ message: "App Induk tidak ditemukan" }, { status: 400 });
    }

    const mod = await prisma.module.create({ data: { name, path, icon, color, group, order, status, type, description, isExternal, externalUrl, appId } });
    return NextResponse.json({ message: "Module berhasil dibuat", data: mod }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
