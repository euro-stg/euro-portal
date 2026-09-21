import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { unauthorized } from "@/lib/api-auth";
import db from "@/lib/db/db";
import { isSuperadmin } from "@/lib/edoc";

// Edit nama + toggle status (active/inactive) — `code` SENGAJA tidak bisa diubah setelah
// dibuat: kode ini disimpan apa adanya (bukan foreign key) di banyak tempat lain
// (EDocFile.businessUnitCodes, EDocFolder.*BusinessUnitCodes,
// EDocBranchPrefixMapping.businessUnitCodes) — ganti code di sini akan bikin semua
// referensi lama itu "yatim" secara diam-diam. "Hapus" = set status inactive (bukan hard
// delete) — cuma hilang dari pilihan form baru (GET /api/edoc/reference filter
// status=active), referensi lama tidak terpengaruh sama sekali.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();
    if (!(await isSuperadmin(session.user.id))) {
      return NextResponse.json({ message: "Hanya superadmin yang bisa mengatur Master Business Unit" }, { status: 403 });
    }

    const { id } = await params;
    const existing = await db.eDocBusinessUnit.findFirst({ where: { id, deletedAt: null } });
    if (!existing) return NextResponse.json({ message: "Tidak ditemukan" }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = { updatedAt: new Date() };
    if (typeof body.name === "string") {
      const name = body.name.trim();
      if (!name) return NextResponse.json({ message: "Name tidak boleh kosong" }, { status: 400 });
      data.name = name;
    }
    if (body.status === "active" || body.status === "inactive") data.status = body.status;

    const updated = await db.eDocBusinessUnit.update({ where: { id }, data });
    return NextResponse.json({ message: "Business Unit berhasil diperbarui", data: updated });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
