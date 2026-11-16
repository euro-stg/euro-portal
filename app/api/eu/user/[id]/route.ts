import { NextResponse } from "next/server";
import db from "@/lib/db/db";
import { requireSession, unauthorized } from "@/lib/api-auth";

// Kartu profil Euro Update (2026-11-16) — klik foto/nama di artikel, komentar, reaction, atau
// ulang tahun. Sengaja HANYA field yang boleh dilihat sesama karyawan; data pribadi (tanggal
// lahir, kontak, NIK, dll.) tidak pernah dikirim dari sini.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await requireSession())) return unauthorized();

    const { id } = await params;
    const user = await db.user.findUnique({
      where: { id },
      select: { id: true, name: true, image: true, jobPositionName: true, organizationName: true, branchName: true, joinDate: true },
    });
    if (!user) return NextResponse.json({ message: "User tidak ditemukan" }, { status: 404 });

    return NextResponse.json({ data: user });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
