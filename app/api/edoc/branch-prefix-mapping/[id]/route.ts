import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { unauthorized } from "@/lib/api-auth";
import db from "@/lib/db/db";
import { isSuperadmin } from "@/lib/edoc";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();
    if (!(await isSuperadmin(session.user.id))) {
      return NextResponse.json({ message: "Hanya superadmin yang bisa mengatur Branch Prefix Mapping" }, { status: 403 });
    }

    const { id } = await params;
    const existing = await db.eDocBranchPrefixMapping.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ message: "Tidak ditemukan" }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = { updatedAt: new Date() };

    if (typeof body.prefix === "string") {
      const prefix = body.prefix.trim().toUpperCase();
      if (!prefix) return NextResponse.json({ message: "Prefix tidak boleh kosong" }, { status: 400 });
      if (prefix !== existing.prefix) {
        const dup = await db.eDocBranchPrefixMapping.findFirst({ where: { prefix, id: { not: id } } });
        if (dup) return NextResponse.json({ message: `Prefix "${prefix}" sudah dipakai` }, { status: 409 });
      }
      data.prefix = prefix;
    }
    if (Array.isArray(body.businessUnitCodes)) {
      const businessUnitCodes = body.businessUnitCodes.map(String).filter(Boolean);
      if (businessUnitCodes.length === 0) return NextResponse.json({ message: "Pilih minimal 1 Business Unit" }, { status: 400 });
      const validCodes = await db.eDocBusinessUnit.findMany({ where: { code: { in: businessUnitCodes } }, select: { code: true } });
      if (validCodes.length !== businessUnitCodes.length) {
        return NextResponse.json({ message: "Ada Business Unit code yang tidak dikenal" }, { status: 400 });
      }
      data.businessUnitCodes = businessUnitCodes;
    }
    const settingDefault = typeof body.isDefault === "boolean" ? body.isDefault : null;
    if (settingDefault !== null) data.isDefault = settingDefault;

    const updated = await db.$transaction(async (tx) => {
      if (settingDefault === true) await tx.eDocBranchPrefixMapping.updateMany({ where: { isDefault: true, id: { not: id } }, data: { isDefault: false } });
      return tx.eDocBranchPrefixMapping.update({ where: { id }, data });
    });

    return NextResponse.json({ message: "Mapping berhasil diperbarui", data: updated });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();
    if (!(await isSuperadmin(session.user.id))) {
      return NextResponse.json({ message: "Hanya superadmin yang bisa mengatur Branch Prefix Mapping" }, { status: 403 });
    }

    const { id } = await params;
    const existing = await db.eDocBranchPrefixMapping.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ message: "Tidak ditemukan" }, { status: 404 });

    // Model ini tidak punya soft-delete (tidak ada deletedAt/status) — hard delete aman,
    // tidak ada tabel lain yang nyimpen reference ke row ini (prefix cuma dicocokkan
    // dinamis terhadap User.branchName saat runtime, bukan disimpan sebagai FK).
    await db.eDocBranchPrefixMapping.delete({ where: { id } });
    return NextResponse.json({ message: "Mapping dihapus" });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
