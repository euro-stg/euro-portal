import db from "@/lib/db/db";

// Thread ucapan ulang tahun Euro Update disimpan per orang per tahun (targetId "{userId}_{year}").
// Hanya terbuka (boleh ucapan/reaction baru) di hari ulang tahunnya; setelah itu baca saja
// (2026-11-16). Tanggal dihitung dengan jam server — sama dengan GET /api/eu/birthday.

export function isBirthdayToday(birthDate: Date | null, now = new Date()): boolean {
  if (!birthDate) return false;
  const d = new Date(birthDate);
  return d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

/** true kalau thread `year` milik `userId` masih menerima ucapan/reaction baru. */
export async function isBirthdayThreadOpen(userId: string, year: number): Promise<boolean> {
  const now = new Date();
  if (year !== now.getFullYear()) return false;
  const user = await db.user.findUnique({ where: { id: userId }, select: { birthDate: true } });
  return isBirthdayToday(user?.birthDate ?? null, now);
}

export const BIRTHDAY_CLOSED_MESSAGE = "Ucapan ulang tahun sudah ditutup — hari ulang tahunnya sudah lewat";
