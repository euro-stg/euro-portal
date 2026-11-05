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
