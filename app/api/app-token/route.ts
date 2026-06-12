import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { auth } from "@/lib/auth";
import db from "@/lib/db/db";

async function requireSuperadmin(userId: string) {
  const row = await db.userRole.findFirst({
    where: { userId, role: { appId: null, name: "superadmin", status: "active", deletedAt: null } },
  });
  return !!row;
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!(await requireSuperadmin(session.user.id))) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const tokens = await db.appToken.findMany({
    where: { deletedAt: null },
    include: {
      creator: { select: { id: true, name: true } },
      module: { select: { id: true, name: true, externalUrl: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ data: tokens });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!(await requireSuperadmin(session.user.id))) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const { moduleId, description } = body as { moduleId?: string; description?: string };

  if (!moduleId?.trim()) return NextResponse.json({ message: "Pilih aplikasi eksternal terlebih dahulu" }, { status: 400 });

  const mod = await db.module.findFirst({
    where: { id: moduleId, type: "app", isExternal: true, deletedAt: null },
  });
  if (!mod) return NextResponse.json({ message: "Aplikasi eksternal tidak ditemukan" }, { status: 404 });

  // Satu apps = satu token
  const existing = await db.appToken.findUnique({ where: { moduleId } });
  if (existing && !existing.deletedAt)
    return NextResponse.json({ message: `Apps "${mod.name}" sudah memiliki token aktif` }, { status: 409 });

  const token = randomBytes(32).toString("hex");

  const appToken = await db.appToken.create({
    data: {
      name: mod.name,
      description: description?.trim() || null,
      token,
      moduleId,
      createdBy: session.user.id,
    },
    include: { module: { select: { id: true, name: true, externalUrl: true } } },
  });

  return NextResponse.json({ data: appToken }, { status: 201 });
}
