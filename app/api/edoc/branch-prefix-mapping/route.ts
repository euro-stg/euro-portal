import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { unauthorized } from "@/lib/api-auth";
import db from "@/lib/db/db";
import { isSuperadmin } from "@/lib/edoc";

// Master Branch Prefix Mapping (EDocBranchPrefixMapping) — sama seperti Business Unit,
// sebelumnya cuma pernah diisi lewat script sekali pakai di dev, tidak ada UI admin.
// Dipakai 2 tempat: getUserBusinessUnits (resolve BU seorang user dari branchName-nya,
// untuk ACL folder) dan auto-checklist Branch saat Business Unit dipilih di form upload.
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();

    const data = await db.eDocBranchPrefixMapping.findMany({ orderBy: { prefix: "asc" } });
    return NextResponse.json({ data });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();
    if (!(await isSuperadmin(session.user.id))) {
      return NextResponse.json({ message: "Hanya superadmin yang bisa mengatur Branch Prefix Mapping" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const prefix = String(body.prefix ?? "").trim().toUpperCase();
    const businessUnitCodes = Array.isArray(body.businessUnitCodes) ? body.businessUnitCodes.map(String).filter(Boolean) : [];
    const isDefault = Boolean(body.isDefault);

    if (!prefix) return NextResponse.json({ message: "Prefix wajib diisi" }, { status: 400 });
    if (businessUnitCodes.length === 0) return NextResponse.json({ message: "Pilih minimal 1 Business Unit" }, { status: 400 });

    const existingPrefix = await db.eDocBranchPrefixMapping.findFirst({ where: { prefix } });
    if (existingPrefix) return NextResponse.json({ message: `Prefix "${prefix}" sudah dipakai` }, { status: 409 });

    const validCodes = await db.eDocBusinessUnit.findMany({ where: { code: { in: businessUnitCodes } }, select: { code: true } });
    if (validCodes.length !== businessUnitCodes.length) {
      return NextResponse.json({ message: "Ada Business Unit code yang tidak dikenal" }, { status: 400 });
    }

    // Cuma boleh ada 1 row fallback default — kalau row baru ini di-set default, matikan
    // default di row lain dulu (transaction, biar tidak pernah ada 2 default sekaligus).
    const created = await db.$transaction(async (tx) => {
      if (isDefault) await tx.eDocBranchPrefixMapping.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
      return tx.eDocBranchPrefixMapping.create({ data: { prefix, businessUnitCodes, isDefault } });
    });

    return NextResponse.json({ message: "Mapping berhasil dibuat", data: created }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
