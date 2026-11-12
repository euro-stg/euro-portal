// Level Organisasi/Departemen per Category E Document (2026-11-04). Dipakai form upload &
// edit (client) serta POST/PATCH file (server) — modul ini sengaja tanpa import server.
//   Departemen     = organisasi TANPA parent
//   Sub Departemen = organisasi yang PUNYA parent
// Category yang tidak terdaftar di sini bebas memilih organisasi apa pun (yang punya kode).
// File lama yang organisasinya tidak sesuai dibiarkan (keputusan user) — aturan hanya dicek
// saat organisasi/kategori diisi atau diubah.
export type OrgLevel = "DEPARTMENT" | "SUB_DEPARTMENT";

export const ORG_LEVEL_BY_CATEGORY_CODE: Record<string, OrgLevel> = {
  IM: "DEPARTMENT",
  SOP: "SUB_DEPARTMENT",
};

export const orgLevelFor = (categoryCode: string | null | undefined): OrgLevel | null =>
  (categoryCode && ORG_LEVEL_BY_CATEGORY_CODE[categoryCode.trim().toUpperCase()]) || null;

export const orgLevelLabel = (level: OrgLevel) => (level === "DEPARTMENT" ? "Departemen" : "Sub Departemen");

export const orgMatchesLevel = (org: { parentOrganizationId: string | null }, level: OrgLevel | null) =>
  !level || (level === "DEPARTMENT" ? !org.parentOrganizationId : !!org.parentOrganizationId);

// Aturan isian dari Number Format Category (2026-11-12) — dihitung server (getCategoryNumbering
// di app/lib/edoc.ts) dan dikirim lewat /api/edoc/reference:
//   subDepartment      = counter nomor per Sub Departemen (sequenceScope PER_SUB_DEPARTMENT)
//                        -> organisasi wajib Sub Departemen
//   singleBusinessUnit = counter per Business Unit (PER_BUSINESS_UNIT) atau nomornya memuat
//                        segmen Kode Business Unit -> Business Unit wajib tepat 1
export type CategoryNumbering = { subDepartment: boolean; singleBusinessUnit: boolean };

/** Level organisasi efektif: aturan Number Format menang, lalu aturan per kode Category. */
export const categoryOrgLevel = (cat: { code: string; numbering?: CategoryNumbering } | null | undefined): OrgLevel | null =>
  cat?.numbering?.subDepartment ? "SUB_DEPARTMENT" : orgLevelFor(cat?.code);

export const SINGLE_BU_MESSAGE = "Category ini memakai nomor per Business Unit — pilih tepat 1 Business Unit";

// Category ber-kode prefix "SOP" (SOP, SOPHO, SOPTR, ...) (2026-11-12): Masa Berlaku selalu
// Tetap & Start Date = tanggal upload (WIB), dikunci di form upload/edit dan ditegakkan server.
export const isSopCategory = (code: string | null | undefined) => !!code && code.trim().toUpperCase().startsWith("SOP");
/** Tanggal hari ini di WIB, format YYYY-MM-DD (konvensi kolom tanggal E Document). */
export const todayWibDate = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
export const SOP_VALIDITY_NOTE = "Category SOP: Masa Berlaku selalu Tetap & Start Date = tanggal upload";
