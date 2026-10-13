import { NextResponse } from "next/server";
import prisma from "@/lib/db/db";
import { requireSession, unauthorized, forbidden } from "@/lib/api-auth";
import { hasPortalModuleAccess, PORTAL_MODULE } from "@/lib/module-permission";

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    if (!session?.user?.id) return unauthorized();
    if (!(await hasPortalModuleAccess(session.user.id, [PORTAL_MODULE.module]))) return forbidden();
    const { id } = await params;
    const exists = await prisma.module.findUnique({ where: { id } });
    if (!exists) return NextResponse.json({ message: "Tidak ditemukan" }, { status: 404 });
    await prisma.module.update({ where: { id }, data: { deletedAt: new Date() } });
    return NextResponse.json({ message: "Module berhasil dihapus" });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
