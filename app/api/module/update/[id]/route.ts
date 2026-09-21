import { NextResponse } from "next/server";
import prisma from "@/lib/db/db";
import { requireSession, unauthorized } from "@/lib/api-auth";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!await requireSession()) return unauthorized();
    const { id } = await params;
    const body   = await request.json().catch(() => ({}));
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
    // App Induk — lihat catatan yang sama di create/route.ts.
    const appIdRaw = String(body.appId ?? "").trim() || null;
    const appId    = type === "module" ? appIdRaw : null;

    if (!name) return NextResponse.json({ message: "Name wajib diisi" }, { status: 400 });
    if (!path) return NextResponse.json({ message: "Path wajib diisi" }, { status: 400 });
    if (appId) {
      if (appId === id) return NextResponse.json({ message: "App Induk tidak boleh module itu sendiri" }, { status: 400 });
      const parentApp = await prisma.module.findFirst({ where: { id: appId, type: "app", deletedAt: null } });
      if (!parentApp) return NextResponse.json({ message: "App Induk tidak ditemukan" }, { status: 400 });
    }

    const exists = await prisma.module.findUnique({ where: { id } });
    if (!exists) return NextResponse.json({ message: "Tidak ditemukan" }, { status: 404 });

    const updated = await prisma.module.update({
      where: { id },
      data: { name, path, icon, color, group, order, status, type, description, isExternal, externalUrl, appId, updatedAt: new Date() },
    });
    return NextResponse.json({ message: "Module berhasil diperbarui", data: updated });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
