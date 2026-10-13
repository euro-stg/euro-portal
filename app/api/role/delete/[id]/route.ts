import { NextResponse } from "next/server";
import prisma from "@/lib/db/db";
import { requireSession, unauthorized, forbidden } from "@/lib/api-auth";
import { hasPortalModuleAccess, PORTAL_MODULE } from "@/lib/module-permission";

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    if (!session?.user?.id) return unauthorized();
    if (!(await hasPortalModuleAccess(session.user.id, [PORTAL_MODULE.role]))) return forbidden();
    const { id } = await params;
    const role = await prisma.role.findUnique({ where: { id } });
    if (!role)         return NextResponse.json({ message: "Tidak ditemukan" },   { status: 404 });
    if (role.isLocked) return NextResponse.json({ message: "Role ini terkunci" }, { status: 403 });

    await prisma.role.update({ where: { id }, data: { deletedAt: new Date() } });
    return NextResponse.json({ message: "Role berhasil dihapus" });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
