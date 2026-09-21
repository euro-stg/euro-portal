import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { unauthorized } from "@/lib/api-auth";
import db from "@/lib/db/db";
import { isSuperadmin } from "@/lib/edoc";

// Master Business Unit (EDocBusinessUnit) — sebelumnya tidak punya UI admin sama sekali,
// baris yang ada di dev database dulu dibuat lewat script sekali pakai, bukan lewat
// aplikasi. Akibatnya di production (belum pernah diisi lewat cara apapun) dropdown
// Business Unit di form upload/edit file selalu kosong. GET dipakai list admin (semua
// status, biar bisa di-reaktivasi); GET /api/edoc/reference (dipakai form) tetap yang
// menentukan mana yang muncul di form (cuma status=active).
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized();

    const data = await db.eDocBusinessUnit.findMany({ where: { deletedAt: null }, orderBy: { code: "asc" } });
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
      return NextResponse.json({ message: "Hanya superadmin yang bisa mengatur Master Business Unit" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const code = String(body.code ?? "").trim().toUpperCase();
    const name = String(body.name ?? "").trim();
    if (!code) return NextResponse.json({ message: "Code wajib diisi" }, { status: 400 });
    if (!name) return NextResponse.json({ message: "Name wajib diisi" }, { status: 400 });

    const existing = await db.eDocBusinessUnit.findFirst({ where: { code } });
    if (existing) return NextResponse.json({ message: `Code "${code}" sudah dipakai` }, { status: 409 });

    const created = await db.eDocBusinessUnit.create({ data: { code, name, status: "active" } });
    return NextResponse.json({ message: "Business Unit berhasil dibuat", data: created }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
