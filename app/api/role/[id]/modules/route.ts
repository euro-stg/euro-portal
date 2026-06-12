import { NextResponse } from "next/server";
import prisma from "@/lib/db/db";

// GET — ambil module yang sudah di-assign ke role ini
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const role = await prisma.role.findUnique({
      where: { id },
      include: { modules: { include: { module: true }, orderBy: { module: { order: "asc" } } } },
    });
    if (!role) return NextResponse.json({ message: "Tidak ditemukan" }, { status: 404 });

    return NextResponse.json({
      isLocked:      role.isLocked,
      assignedModuleIds: role.modules.map((rm) => rm.moduleId),
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

// POST — set module untuk role (replace all)
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id }    = await params;
    const body      = await request.json().catch(() => ({}));
    const moduleIds: string[] = Array.isArray(body.moduleIds) ? body.moduleIds : [];

    const role = await prisma.role.findUnique({ where: { id } });
    if (!role)         return NextResponse.json({ message: "Tidak ditemukan" },   { status: 404 });
    if (role.isLocked) return NextResponse.json({ message: "Role ini terkunci" }, { status: 403 });

    // Replace: hapus semua lalu insert baru
    await prisma.roleModule.deleteMany({ where: { roleId: id } });
    if (moduleIds.length > 0) {
      await prisma.roleModule.createMany({
        data: moduleIds.map((moduleId) => ({ roleId: id, moduleId })),
        skipDuplicates: true,
      });
    }

    return NextResponse.json({ message: "Modul berhasil diperbarui" });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
