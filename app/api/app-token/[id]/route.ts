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

// PATCH: update name/description/active, atau regenerate token
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!(await requireSuperadmin(session.user.id))) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const existing = await db.appToken.findFirst({ where: { id, deletedAt: null } });
  if (!existing) return NextResponse.json({ message: "Tidak ditemukan" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const { description, active, regenerate } = body as {
    description?: string; active?: boolean; regenerate?: boolean;
  };

  const data: Record<string, unknown> = { updatedAt: new Date() };
  if (description !== undefined) data.description = description?.trim() || null;
  if (active !== undefined)      data.active      = active;
  if (regenerate) {
    data.token = randomBytes(32).toString("hex");
    await db.ssoSession.deleteMany({ where: { appTokenId: id } });
  }

  const updated = await db.appToken.update({
    where: { id },
    data,
    include: { module: { select: { id: true, name: true, externalUrl: true } } },
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
