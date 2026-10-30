import db from "@/lib/db/db";
import { normalizeItemName } from "@/lib/master-item-sync";

// Mapping SKU baris item IM ke Master Item (2026-10-30). Dipakai layar mapping saat import
// Excel IM, pemetaan item lama, dan cek item discontinued. Pencocokan by NAMA → kandidat SKU
// dikelompokkan per company; SATU SKU PER COMPANY. Semua kandidat ditampilkan ke user; pilihan
// otomatis hanya untuk company dalam cakupan BU IM & hanya kalau kandidatnya jelas.

/**
 * Cakupan BU IM portal → item ERP. `businesses` = business ERP yang cocok untuk BU itu
 * (null = item tanpa business ikut dianggap cocok). BU yang tidak terdaftar (mis. HO) atau IM
 * tanpa BU → semua company.
 */
const BU_SCOPE: Record<string, { company: string; businesses?: (string | null)[] }[]> = {
  "SKIN+": [{ company: "SKIN+ DEI", businesses: ["SKIN+", null] }],
  "SLIM+": [{ company: "SKIN+ DEI", businesses: ["SLIM+", null] }],
  ESC: [{ company: "European Slimming Centre" }],
  ESL: [{ company: "EUROSKINLAB" }],
  EHL: [{ company: "EUROHAIRLAB" }],
};

/** Kunci pencocokan: huruf kecil, spasi tunggal, variasi tanda hubung disamakan. */
export const matchKey = (name: string) =>
  normalizeItemName(name).replace(/[‐‑‒–—―]/g, "-").replace(/\s*-\s*/g, " - ").trim();

/** Kunci longgar (tanpa tanda baca/spasi) — hanya untuk SARAN, bukan pencocokan otomatis. */
const looseKey = (name: string) => normalizeItemName(name).replace(/[^a-z0-9+%]+/g, "");

function bigrams(s: string) {
  const out = new Map<string, number>();
  for (let i = 0; i < s.length - 1; i++) { const g = s.slice(i, i + 2); out.set(g, (out.get(g) ?? 0) + 1); }
  return out;
}
/** Kemiripan Dice (0..1) atas bigram huruf. */
function similarity(a: string, b: string) {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const A = bigrams(a), B = bigrams(b);
  let overlap = 0;
  for (const [g, n] of A) overlap += Math.min(n, B.get(g) ?? 0);
  return (2 * overlap) / (a.length - 1 + b.length - 1);
}

export type SkuCandidate = {
  itemCode: string; itemName: string; company: string; business: string | null; itemGroup: string;
  status: string; standardPrice: number | null;
};
export type CompanyChoice = {
  company: string;
  inScope: boolean; // company termasuk cakupan BU IM
  candidates: SkuCandidate[];
  selected: string | null; // itemCode terpilih otomatis (null = user perlu memilih / tidak berlaku)
};
export type NameSuggestion = {
  itemName: string; score: number;
  samePunctuationLess: boolean; // hanya beda tanda baca/spasi (mis. "0.5mg" vs "0.5 mg")
  companies: string[]; // company yang punya item dengan nama ini
  inScope: boolean; // ada di company sesuai BU IM
};
export type RowResolution = {
  status: "MATCHED" | "NEEDS_CHOICE" | "NOT_FOUND";
  companies: CompanyChoice[];
  suggestions: NameSuggestion[];
};

type MasterRow = SkuCandidate & { key: string; loose: string };

/** Muat Master Item sekali untuk satu batch pencocokan. */
export async function loadMasterIndex() {
  const items = await db.masterItem.findMany({
    where: { company: { not: null } },
    select: { itemCode: true, itemName: true, company: true, business: true, itemGroup: true, status: true, standardPrice: true },
  });
  const rows: MasterRow[] = items.map((i) => ({ ...i, company: i.company!, key: matchKey(i.itemName), loose: looseKey(i.itemName) }));
  const byKey = new Map<string, MasterRow[]>();
  for (const r of rows) { const a = byKey.get(r.key) ?? []; a.push(r); byKey.set(r.key, a); }
  const byCode = new Map(rows.map((r) => [r.itemCode, r]));
  // Nama unik untuk saran (satu entri per nama) + company yang memilikinya.
  const names = [...byKey.entries()].map(([key, list]) => ({
    key, itemName: list[0].itemName, loose: list[0].loose, companies: [...new Set(list.map((r) => r.company))].sort(),
  }));
  return { byKey, byCode, names };
}
export type MasterIndex = Awaited<ReturnType<typeof loadMasterIndex>>;

const strip = (r: MasterRow): SkuCandidate => ({
  itemCode: r.itemCode, itemName: r.itemName, company: r.company, business: r.business,
  itemGroup: r.itemGroup, status: r.status, standardPrice: r.standardPrice,
});

/**
 * Kandidat SKU satu baris IM. `buCodes` = Business Unit IM (EDocFile.businessUnitCodes);
 * `hintSku` = isi kolom SKU Excel (dipakai kalau cocok dengan item bernama sama).
 */
export function resolveRow(index: MasterIndex, name: string, buCodes: string[], hintSku?: string | null): RowResolution {
  const scopes = buCodes.flatMap((bu) => BU_SCOPE[bu] ?? []);
  const allCompanies = buCodes.length === 0 || buCodes.some((bu) => !BU_SCOPE[bu]); // HO / tanpa BU / BU tak dikenal
  const inScope = (company: string) => allCompanies || scopes.some((s) => s.company === company);
  const businessOk = (c: MasterRow) => {
    if (allCompanies) return true;
    const sc = scopes.filter((s) => s.company === c.company);
    return sc.some((s) => !s.businesses || s.businesses.includes(c.business));
  };

  const key = matchKey(name);
  const cands = index.byKey.get(key) ?? [];
  // Saran nama terdekat — dipakai kalau tidak ada kandidat di company sesuai BU (termasuk
  // kalau nama persisnya hanya ada di company lain). Yang ada di cakupan BU diutamakan.
  const suggest = (): NameSuggestion[] => {
    const loose = looseKey(name);
    return index.names
      .filter((n) => n.key !== key)
      .map((n) => ({
        itemName: n.itemName, companies: n.companies, inScope: n.companies.some(inScope),
        samePunctuationLess: n.loose === loose, score: n.loose === loose ? 1 : similarity(loose, n.loose),
      }))
      .filter((s) => s.score >= 0.55)
      .sort((a, b) => Number(b.inScope) - Number(a.inScope) || b.score - a.score)
      .slice(0, 5)
      .map((s) => ({ ...s, score: Math.round(s.score * 100) / 100 }));
  };
  if (cands.length === 0) return { status: "NOT_FOUND", companies: [], suggestions: suggest() };

  const hint = hintSku ? cands.find((c) => c.itemCode === hintSku.trim()) : undefined;
  const companies = [...new Set(cands.map((c) => c.company))].sort();
  let pending = false; // ada company dalam cakupan yang punya kandidat relevan tapi belum terpilih
  const choices: CompanyChoice[] = companies.map((company) => {
    const list = cands.filter((c) => c.company === company);
    const scoped = inScope(company);
    let selected: string | null = null;
    if (scoped) {
      if (hint && hint.company === company) selected = hint.itemCode;
      else {
        const preferred = list.filter((c) => businessOk(c) && c.status === "ACTIVE");
        if (preferred.length === 1) selected = preferred[0].itemCode;
        else if (preferred.length === 0 && list.filter(businessOk).length === 1) selected = list.filter(businessOk)[0].itemCode;
        else if (list.length === 1 && businessOk(list[0])) selected = list[0].itemCode;
      }
      if (selected === null && list.some(businessOk)) pending = true;
    }
    return {
      company, inScope: scoped,
      // Kandidat sesuai BU & aktif di atas, sisanya di bawah.
      candidates: list.sort((a, b) => Number(businessOk(b)) - Number(businessOk(a)) || (a.status === "ACTIVE" ? -1 : 1) - (b.status === "ACTIVE" ? -1 : 1)).map(strip),
      selected,
    };
  });
  // Company dalam cakupan tampil lebih dulu.
  choices.sort((a, b) => Number(b.inScope) - Number(a.inScope) || a.company.localeCompare(b.company));

  const anySelected = choices.some((c) => c.selected);
  const status = anySelected && !pending ? "MATCHED" : "NEEDS_CHOICE";
  const noScopedCandidates = !choices.some((c) => c.inScope);
  return { status, companies: choices, suggestions: noScopedCandidates ? suggest() : [] };
}

/**
 * Status baris dari SKU yang dipetakan: ALL_DISCONTINUED (semua discontinued → rekomendasi
 * dikeluarkan), PARTIAL (sebagian), ACTIVE, atau UNMAPPED (belum ada mapping). SKU yang sudah
 * tidak ada di Master Item (mis. company dikecualikan) diabaikan.
 */
export function evaluateMappedSkus(index: MasterIndex, itemCodes: string[]) {
  const known = itemCodes.map((c) => index.byCode.get(c)).filter((r): r is MasterRow => !!r);
  if (itemCodes.length === 0) return { status: "UNMAPPED" as const, discontinued: [] as SkuCandidate[], active: [] as SkuCandidate[] };
  const discontinued = known.filter((r) => r.status === "DISCONTINUED").map(strip);
  const active = known.filter((r) => r.status !== "DISCONTINUED").map(strip);
  const status = known.length === 0 ? ("UNMAPPED" as const)
    : discontinued.length === known.length ? ("ALL_DISCONTINUED" as const)
    : discontinued.length > 0 ? ("PARTIAL" as const) : ("ACTIVE" as const);
  return { status, discontinued, active };
}
