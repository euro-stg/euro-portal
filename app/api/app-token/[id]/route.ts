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

// PATCH: update description/active/roleId, atau regenerate token
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!(await requireSuperadmin(session.user.id))) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const existing = await db.appToken.findFirst({
    where: { id, deletedAt: null },
    include: { role: true },
  });
  if (!existing) return NextResponse.json({ message: "Tidak ditemukan" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const { description, active, roleId, regenerate } = body as {
    description?: string;
    active?: boolean;
    roleId?: string;
    regenerate?: boolean;
  };

  const data: Record<string, unknown> = { updatedAt: new Date() };
  if (description !== undefined) data.description = description?.trim() || null;
  if (active !== undefined) data.active = active;
  if (roleId !== undefined) {
    const role = await db.appTokenRole.findFirst({ where: { id: roleId, deletedAt: null } });
    if (!role) return NextResponse.json({ message: "Role tidak ditemukan" }, { status: 404 });
    data.roleId = roleId;
  }

  if (regenerate) {
    // Tentukan role yang akan dipakai (baru atau existing)
    const effectiveRoleId = (roleId ?? existing.roleId) as string | null;
    if (!effectiveRoleId) return NextResponse.json({ message: "Assign role dulu sebelum regenerate token" }, { status: 400 });

    const role = roleId
      ? await db.appTokenRole.findFirst({ where: { id: roleId, deletedAt: null } })
      : existing.role;
    if (!role) return NextResponse.json({ message: "Role tidak ditemukan" }, { status: 404 });

    const placeholder = randomBytes(16).toString("hex");
    data.token = placeholder;
    data.roleId = role.id;

    await db.ssoSession.deleteMany({ where: { appTokenId: id } });

    const updated = await db.appToken.update({ where: { id }, data });
    const jwt = await signAppTokenJwt({ sub: updated.id, name: updated.name, permissions: role.permissions });
    const final = await db.appToken.update({
      where: { id },
      data: { token: jwt },
      include: { module: { select: { id: true, name: true, externalUrl: true } }, role: { select: { id: true, name: true, permissions: true } } },
    });
    return NextResponse.json({ data: final });
  }

  const updated = await db.appToken.update({
    where: { id },
    data,
    include: { module: { select: { id: true, name: true, externalUrl: true } }, role: { select: { id: true, name: true, permissions: true } } },
  });
  return NextResponse.json({ data: updated });
}

// DELETE: soft delete
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!(await requireSuperadmin(session.user.id))) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const existing = await db.appToken.findFirst({ where: { id, deletedAt: null } });
  if (!existing) return NextResponse.json({ message: "Tidak ditemukan" }, { status: 404 });

  await db.$transaction([
    db.ssoSession.deleteMany({ where: { appTokenId: id } }),
    db.appToken.update({ where: { id }, data: { deletedAt: new Date(), active: false } }),
  ]);

  return NextResponse.json({ message: "App token dihapus" });
}
