import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { auth } from "@/lib/auth";
import db from "@/lib/db/db";
import { signAppTokenJwt } from "@/lib/sso-jwt";

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
      role: { select: { id: true, name: true, permissions: true } },
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
  const { moduleId, description, roleId } = body as { moduleId?: string; description?: string; roleId?: string };

  if (!moduleId?.trim()) return NextResponse.json({ message: "Pilih aplikasi eksternal terlebih dahulu" }, { status: 400 });
  if (!roleId?.trim()) return NextResponse.json({ message: "Pilih role untuk app token ini" }, { status: 400 });

  const mod = await db.module.findFirst({
    where: { id: moduleId, type: "app", isExternal: true, deletedAt: null },
  });
  if (!mod) return NextResponse.json({ message: "Aplikasi eksternal tidak ditemukan" }, { status: 404 });

  const role = await db.appTokenRole.findFirst({ where: { id: roleId, deletedAt: null } });
  if (!role) return NextResponse.json({ message: "Role tidak ditemukan" }, { status: 404 });

  // Satu apps = satu token
  const existing = await db.appToken.findUnique({ where: { moduleId } });
  if (existing) {
    if (!existing.deletedAt)
      return NextResponse.json({ message: `Apps "${mod.name}" sudah memiliki token aktif` }, { status: 409 });

    // Restore token yang sudah di-delete — buat JWT baru
    const placeholder = randomBytes(16).toString("hex");
    const restored = await db.appToken.update({
      where: { id: existing.id },
      data: {
        name: mod.name,
        description: description?.trim() || null,
        token: placeholder,
        roleId: role.id,
        active: true,
        deletedAt: null,
        createdBy: session.user.id,
        updatedAt: new Date(),
      },
      include: { module: { select: { id: true, name: true, externalUrl: true } }, role: { select: { id: true, name: true, permissions: true } } },
    });
    const jwt = await signAppTokenJwt({ sub: restored.id, name: restored.name, permissions: role.permissions });
    const final = await db.appToken.update({
      where: { id: restored.id },
      data: { token: jwt },
      include: { module: { select: { id: true, name: true, externalUrl: true } }, role: { select: { id: true, name: true, permissions: true } } },
    });
    return NextResponse.json({ data: final }, { status: 201 });
  }

  // Buat baru — placeholder dulu, lalu update dengan JWT (butuh id)
  const placeholder = randomBytes(16).toString("hex");
  const created = await db.appToken.create({
    data: {
      name: mod.name,
      description: description?.trim() || null,
      token: placeholder,
      moduleId,
      roleId: role.id,
      createdBy: session.user.id,
    },
    include: { module: { select: { id: true, name: true, externalUrl: true } }, role: { select: { id: true, name: true, permissions: true } } },
  });

  const jwt = await signAppTokenJwt({ sub: created.id, name: created.name, permissions: role.permissions });
  const final = await db.appToken.update({
    where: { id: created.id },
    data: { token: jwt },
    include: { module: { select: { id: true, name: true, externalUrl: true } }, role: { select: { id: true, name: true, permissions: true } } },
  });

  return NextResponse.json({ data: final }, { status: 201 });
}
