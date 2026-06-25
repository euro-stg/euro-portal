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

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!(await requireSuperadmin(session.user.id))) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const roles = await db.appTokenRole.findMany({
    where: { deletedAt: null },
    include: { _count: { select: { appTokens: { where: { deletedAt: null } } } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ data: roles });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  if (!(await requireSuperadmin(session.user.id))) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const { name, description, permissions } = body as {
    name?: string;
    description?: string;
    permissions?: string[];
  };

  if (!name?.trim()) return NextResponse.json({ message: "Nama role wajib diisi" }, { status: 400 });

  const validPermissions = (permissions ?? []).filter((p) => (SSO_PERMISSIONS as readonly string[]).includes(p));
  if (validPermissions.length === 0) return NextResponse.json({ message: "Pilih minimal satu permission" }, { status: 400 });

  const exists = await db.appTokenRole.findFirst({ where: { name: name.trim(), deletedAt: null } });
  if (exists) return NextResponse.json({ message: `Role "${name.trim()}" sudah ada` }, { status: 409 });

  const role = await db.appTokenRole.create({
    data: { name: name.trim(), description: description?.trim() || null, permissions: validPermissions },
  });

  return NextResponse.json({ data: role }, { status: 201 });
}
