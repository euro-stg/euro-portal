import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireSession, unauthorized, forbidden } from "@/lib/api-auth";
import { hasPortalModuleAccess, PORTAL_MODULE } from "@/lib/module-permission";
import db from "@/lib/db/db";

export async function GET() {
  try {
    if (!await requireSession()) return unauthorized();

    const orgs = await db.organization.findMany({
      where: { deletedAt: null },
      orderBy: [{ parentOrganizationId: "asc" }, { name: "asc" }],
    });

    return NextResponse.json({ data: orgs });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    if (!session?.user?.id) return unauthorized();
    if (!(await hasPortalModuleAccess(session.user.id, [PORTAL_MODULE.organization]))) return forbidden();

    const body = await request.json().catch(() => ({}));
    const { name, parentOrganizationId, branchId, code } = body as {
      name?: string; parentOrganizationId?: string; branchId?: string; code?: string;
    };

    if (!name?.trim()) return NextResponse.json({ message: "Nama wajib diisi" }, { status: 400 });

    if (parentOrganizationId) {
      const parent = await db.organization.findFirst({ where: { id: parentOrganizationId, deletedAt: null } });
      if (!parent) return NextResponse.json({ message: "Parent organization tidak ditemukan" }, { status: 400 });
    }

    const org = await db.organization.create({
      data: {
        id: randomUUID(),
        name: name.trim(),
        parentOrganizationId: parentOrganizationId || null,
        branchId: branchId || null,
        code: code?.trim() || null,
        source: "manual",
      },
    });

    return NextResponse.json({ data: org }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
