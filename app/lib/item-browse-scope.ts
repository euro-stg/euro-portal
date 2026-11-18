import db from "@/lib/db/db";
import { getUserBusinessUnits, isSuperadmin } from "@/lib/edoc";

// Cakupan Item / Promo Browser per user (2026-11-17):
//   - Grup item: hanya Treatment, Retail Product 01, Retail Product 02. Item discontinued ikut
//     HANYA kalau grup di Master Item-nya masih salah satu dari itu (item yang dipindah ke grup
//     "Discontinued" ERP tidak ditampilkan — keputusan user).
//   - Business unit: BU user = getUserBusinessUnits (lib/edoc: prefix cabang → mapping prefix
//     di Pengaturan edoc; tak cocok → baris isDefault = HO), sama dengan yang dipakai modul edoc. BU → company
//     item: SKIN+ & SLIM+ sama-sama company "SKIN+ DEI"; HO & superadmin melihat semua company.
// Dicek di SERVER untuk daftar maupun detail promo, bukan hanya disembunyikan di UI.

export const BROWSE_GROUPS = ["Treatment", "Retail Product 01", "Retail Product 02"];

// null = semua company. Company = nilai field `company` Master Item apa adanya dari ERP.
const BU_COMPANY: Record<string, string | null> = {
  "SKIN+": "SKIN+ DEI", "SLIM+": "SKIN+ DEI",
  ESC: "European Slimming Centre", ESL: "EUROSKINLAB", EHL: "EUROHAIRLAB", HO: null,
};

/**
 * Hasil resolusi cakupan user: dipakai untuk filter (itemScopeWhere) dan info di UI. Superadmin
 * tetap AKSES PENUH (semua company; keputusan user 2026-11-17) — info pembatasan di UI hanya
 * untuk user biasa. HO = semua company (BU HO memang tidak terikat satu company).
 */
export async function resolveItemScope(userId: string) {
  const superadmin = await isSuperadmin(userId);
  const businessUnits = superadmin ? [] : await getUserBusinessUnits(userId);
  const all = superadmin || businessUnits.some((b) => BU_COMPANY[b] === null);
  const fixed = [...new Set(businessUnits.map((b) => BU_COMPANY[b]).filter((c): c is string => !!c))];
  // Nama company yang benar-benar terlihat (untuk HO: semua company yang punya item di grup cakupan).
  const companies = all
    ? (await db.masterItem.findMany({ where: { itemGroup: { in: BROWSE_GROUPS }, company: { not: null } }, distinct: ["company"], select: { company: true }, orderBy: { company: "asc" } })).map((c) => c.company!)
    : fixed;
  const buCompanies = Object.entries(BU_COMPANY).map(([bu, company]) => ({ bu, company })); // contoh pemetaan untuk info di UI
  return { superadmin, businessUnits, all, companies, groups: BROWSE_GROUPS, buCompanies };
}

export async function itemScopeWhere(userId: string) {
  const sc = await resolveItemScope(userId);
  const base = { itemGroup: { in: sc.groups } };
  return { ...base, company: { in: sc.companies } }; // tanpa BU dikenal → kosong
}
