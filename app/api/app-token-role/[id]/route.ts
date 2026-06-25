import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import db from "@/lib/db/db";
import { SSO_PERMISSIONS } from "@/lib/sso-jwt";

async function requireSuperadmin(userId: string) {
  const row = await db.userRole.findFirst({
    where: { userId, role: { appId: null, name: "superadmin", status: "active", deletedAt: null } },
  });
  return !!row;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!(await requireSuperadmin(session.user.id))) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const existing = await db.appTokenRole.findFirst({ where: { id, deletedAt: null } });
  if (!existing) return NextResponse.json({ message: "Role tidak ditemukan" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const { name, description, permissions } = body as {
    name?: string;
    description?: string;
    permissions?: string[];
  };

  if (!name?.trim()) return NextResponse.json({ message: "Nama role wajib diisi" }, { status: 400 });

  const validPermissions = (permissions ?? []).filter((p) => (SSO_PERMISSIONS as readonly string[]).includes(p));
  if (validPermissions.length === 0) return NextResponse.json({ message: "Pilih minimal satu permission" }, { status: 400 });

  if (name.trim() !== existing.name) {
    const dup = await db.appTokenRole.findFirst({ where: { name: name.trim(), deletedAt: null, NOT: { id } } });
    if (dup) return NextResponse.json({ message: `Role "${name.trim()}" sudah ada` }, { status: 409 });
  }

  const updated = await db.appTokenRole.update({
    where: { id },
    data: { name: name.trim(), description: description?.trim() || null, permissions: validPermissions, updatedAt: new Date() },
  });

  return NextResponse.json({ data: updated });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!(await requireSuperadmin(session.user.id))) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const existing = await db.appTokenRole.findFirst({ where: { id, deletedAt: null } });
  if (!existing) return NextResponse.json({ message: "Role tidak ditemukan" }, { status: 404 });

  const inUse = await db.appToken.count({ where: { roleId: id, deletedAt: null } });
  if (inUse > 0) return NextResponse.json({ message: `Role masih digunakan oleh ${inUse} app token aktif` }, { status: 409 });

  await db.appTokenRole.update({ where: { id }, data: { deletedAt: new Date() } });

  return NextResponse.json({ message: "Role dihapus" });
}
