import { NextResponse } from "next/server";
import db from "@/lib/db/db";
import { requireSession, unauthorized } from "@/lib/api-auth";
import { isBirthdayToday } from "@/lib/eu-birthday";

// Riwayat thread ulang tahun satu orang (2026-11-16) — tahun-tahun yang punya ucapan/reaction,
// untuk kartu profil & tab "Ucapan Ulang Tahun" di halaman Profil. Terbuka untuk semua
// karyawan, sama seperti thread-nya saat hari H. Tahun ini selalu ikut kalau hari ini
// ulang tahunnya (supaya bisa langsung mengucapkan walau belum ada ucapan).
export async function GET(request: Request) {
  try {
    if (!(await requireSession())) return unauthorized();

    const userId = new URL(request.url).searchParams.get("userId");
    if (!userId) return NextResponse.json({ message: "userId wajib diisi" }, { status: 400 });

    const prefix = `${userId}_`;
    const [comments, reactions, user] = await Promise.all([
      db.euComment.groupBy({
        by: ["targetId"],
        where: { targetType: "birthday", targetId: { startsWith: prefix }, deletedAt: null },
        _count: { _all: true },
      }),
      db.euReaction.groupBy({
        by: ["targetId"],
        where: { targetType: "birthday", targetId: { startsWith: prefix } },
        _count: { _all: true },
      }),
      db.user.findUnique({ where: { id: userId }, select: { birthDate: true } }),
    ]);

    const byYear = new Map<number, { year: number; comments: number; reactions: number }>();
    const row = (targetId: string) => {
      const year = Number(targetId.slice(prefix.length));
      if (!Number.isInteger(year)) return null;
      if (!byYear.has(year)) byYear.set(year, { year, comments: 0, reactions: 0 });
      return byYear.get(year)!;
    };
    for (const c of comments) { const r = row(c.targetId); if (r) r.comments = c._count._all; }
    for (const x of reactions) { const r = row(x.targetId); if (r) r.reactions = x._count._all; }

    const today = isBirthdayToday(user?.birthDate ?? null);
    if (today) row(`${prefix}${new Date().getFullYear()}`);

    const years = [...byYear.values()].sort((a, b) => b.year - a.year);
    return NextResponse.json({ data: { years, birthdayToday: today } });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}
