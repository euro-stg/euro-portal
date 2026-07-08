import { NextResponse } from "next/server";
import { requireSession, unauthorized } from "@/lib/api-auth";
import db from "@/lib/db/db";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!await requireSession()) return unauthorized();

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { name, parentOrganizationId, branchId, code } = body as {
      name?: string; parentOrganizationId?: string | null; branchId?: string | null; code?: string | null;
    };

    const existing = await db.organization.findFirst({ where: { id, deletedAt: null } });
    if (!existing) return NextResponse.json({ message: "Tidak ditemukan" }, { status: 404 });

    if (parentOrganizationId && parentOrganizationId === id)
      return NextResponse.json({ message: "Tidak bisa jadi parent diri sendiri" }, { status: 400 });

    const org = await db.organization.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name: name.trim() } : {}),
        ...(parentOrganizationId !== undefined ? { parentOrganizationId: parentOrganizationId || null } : {}),
        ...(branchId !== undefined ? { branchId: branchId || null } : {}),
        ...(code !== undefined ? { code: code?.trim() || null } : {}),
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({ data: org });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!await requireSession()) return unauthorized();

    const { id } = await params;

    const hasChildren = await db.organization.findFirst({ where: { parentOrganizationId: id, deletedAt: null } });
    if (hasChildren) return NextResponse.json({ message: "Hapus sub-org di bawahnya terlebih dahulu" }, { status: 400 });

    await db.organization.update({ where: { id }, data: { deletedAt: new Date() } });

    return NextResponse.json({ message: "Dihapus" });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
