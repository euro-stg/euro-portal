import db from "@/lib/db/db";

// Field Inisiator & Masa Berlaku E Document (2026-10-19) — dipakai upload (POST /api/edoc/file)
// dan edit metadata (PATCH /api/edoc/file/[id]).

export const VALIDITY_TYPES = ["TETAP", "TEMPORER"] as const;
export type ValidityType = (typeof VALIDITY_TYPES)[number];

/** Validasi kombinasi masa berlaku & End Date. TETAP → End Date harus kosong; TEMPORER → wajib. */
export function checkValidity(validityType: string | null | undefined, endDate: Date | null): { value: ValidityType; error: string | null } {
  if (!validityType || !(VALIDITY_TYPES as readonly string[]).includes(validityType)) {
    return { value: "TETAP", error: "Masa berlaku wajib dipilih (Tetap / Temporer)" };
  }
  if (validityType === "TEMPORER" && !endDate) return { value: "TEMPORER", error: "End Date wajib diisi untuk dokumen Temporer" };
  return { value: validityType as ValidityType, error: null };
}

/**
 * Inisiator wajib & harus user aktif. Jabatan = SNAPSHOT: pakai nilai dari form kalau diisi
 * (bisa dikoreksi untuk data lama), kalau kosong ambil jabatan inisiator saat ini.
 */
export async function resolveInitiator(initiatorId: string | null | undefined, jobPositionName: string | null | undefined):
  Promise<{ initiatorId: string; initiatorJobPositionName: string | null } | { error: string }> {
  if (!initiatorId) return { error: "Inisiator wajib dipilih" };
  const user = await db.user.findFirst({ where: { id: initiatorId, status: "active" }, select: { id: true, jobPositionName: true } });
  if (!user) return { error: "Inisiator tidak ditemukan atau tidak aktif" };
  return { initiatorId: user.id, initiatorJobPositionName: jobPositionName?.trim() || user.jobPositionName || null };
}
