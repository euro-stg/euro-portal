import db from "@/lib/db/db";
import { ErpError, erpGet, erpListAll, getErpConfig } from "@/lib/erp";
import { activeImFileWhere } from "@/lib/im-check";
import {
  type ErpPrice, type ErpRule, eligibleOf, loadPriceListAudience, parseErpImKey, parsePortalImKey, promoOf, territoriesOf, today,
} from "@/lib/im-erp-sync";

// Item / Promo Browser LIVE dari ERP (2026-11-17) — pengganti item edoc (EDocImProduct) yang
// disalin ke portal. Pilih 1 item Master Item → promo aktifnya dibaca langsung dari ERP setiap
// kali (tanpa simpan baris di portal), jadi item discontinued / berubah otomatis mengikuti ERP.
//   - Pricing Rule (apply_on Item Code) = promo: jenis, nilai, periode, Territory (bisa banyak,
//     `multiple_territories`), min qty.
//   - Price List rule = Eligible Client lewat Client Type (New Joiner, Trial, …).
//   - Rule tanpa tanggal akhir ("s/d tetap") ikut — diambil lewat query terpisah karena
//     `or_filters` di ERP ini tidak membatasi hasil.
// Rule yang nomor IM-nya tak cocok dengan IM aktif di portal TETAP tampil (tanpa tautan IM).
// Hasil dicache singkat per item supaya klik berulang tidak membebani ERP.

export type LivePromo = {
  key: string;
  source: "RULE" | "PRICE_LIST";
  imLabel: string | null; // "IM 738_2026" apa adanya dari ERP
  file: { id: string; title: string; documentNumber: string | null } | null;
  /** Lebih dari satu IM aktif di portal bernomor sama → semuanya dicantumkan (tidak ada yang ditautkan otomatis). */
  fileCandidates: { id: string; title: string; documentNumber: string | null }[];
  /** Catatan pencocokan (mis. nomor IM di ERP tanpa tahun) — untuk keterangan di UI. */
  matchNote: string | null;
  title: string;
  mergedRules: number;
  promoType: string;
  discountPercent: number | null;
  promoPrice: number | null;
  normalPrice: number | null;
  validFrom: string | null;
  validUpto: string | null; // null = tanpa batas akhir
  priceList: string | null;
  clientTypes: string[];
  territories: string[];
  audience: string | null; // pembatasan Customer / Customer Group (jarang)
  minQty: number | null;
};
export type LiveResult = {
  item: { itemCode: string; itemName: string; company: string | null; business: string | null; status: string; standardPrice: number | null };
  promos: LivePromo[];
  fetchedAt: string;
};

const TTL_MS = 5 * 60_000;
const MAX_CACHE = 200;
const cache = new Map<string, { at: number; data: LiveResult }>();

const RULE_FIELDS = ["name", "title", "for_price_list", "rate_or_discount", "discount_percentage", "discount_amount", "rate", "valid_from", "valid_upto",
  "applicable_for", "territory", "multiple_territories", "customer_group", "customer", "min_qty"];

export async function buildLivePromos(itemCode: string, refresh = false): Promise<{ error: string; status?: number } | LiveResult> {
  const hit = cache.get(itemCode);
  if (!refresh && hit && Date.now() - hit.at < TTL_MS) return hit.data;

  const item = await db.masterItem.findUnique({
    where: { itemCode }, select: { itemCode: true, itemName: true, company: true, business: true, status: true, standardPrice: true },
  });
  if (!item) return { error: "Item tidak ada di Master Item", status: 404 };

  const t = today();
  const base = [["Pricing Rule Item Code", "item_code", "=", itemCode], ["disable", "=", 0], ["selling", "=", 1]];
  const [ruleActive, ruleOpen, prices] = await Promise.all([
    erpListAll<ErpRule>("Pricing Rule", { fields: RULE_FIELDS, filters: [...base, ["valid_upto", ">=", t]], orderBy: "`tabPricing Rule`.valid_from asc", pageSize: 500 }),
    erpListAll<ErpRule>("Pricing Rule", { fields: RULE_FIELDS, filters: [...base, ["valid_upto", "is", "not set"]], orderBy: "`tabPricing Rule`.valid_from asc", pageSize: 500 }),
    erpListAll<ErpPrice>("Item Price", {
      fields: ["price_list", "price_list_rate", "valid_from", "valid_upto"],
      filters: [["item_code", "=", itemCode], ["price_list", "like", "%IM %"]], orderBy: "valid_from desc", pageSize: 500,
    }),
  ]);
  const rules = [...new Map([...ruleActive, ...ruleOpen].map((r) => [r.name, r])).values()];
  const activePrices = prices.filter((p) => !p.valid_upto || p.valid_upto >= t);
  const rateByList = new Map<string, number>();
  for (const p of activePrices) if (!rateByList.has(p.price_list)) rateByList.set(p.price_list, p.price_list_rate);

  const audience = await loadPriceListAudience([...new Set(rules.map((r) => r.for_price_list).filter((l): l is string => !!l))]);

  // Cocokkan nomor IM ERP ke IM aktif di portal (tahun wajib; tanpa tahun hanya bila tepat satu).
  const files = await db.eDocFile.findMany({ where: activeImFileWhere(), select: { id: true, title: true, documentNumber: true } });
  const portal = files.map((f) => ({ f, k: parsePortalImKey(f.documentNumber) })).filter((x) => x.k);
  const fileFor = (title: string | null, name: string, priceList: string | null) => {
    const k = parseErpImKey(title) ?? parseErpImKey(name) ?? parseErpImKey(priceList);
    if (!k) return { label: null, file: null, candidates: [], matchNote: null };
    const cands = portal.filter((p) => p.k!.seq === k.seq && (k.year == null || p.k!.year === k.year));
    const raw = [title, name, priceList].map((x) => x?.match(/\bIM\s*\d+(?:_\d{4})?\b/i)?.[0]).find(Boolean);
    return {
      label: raw ? raw.toUpperCase().replace(/\s+/, " ") : `IM ${k.seq}`,
      file: cands.length === 1 ? cands[0].f : null,
      candidates: cands.length > 1 ? cands.map((c) => c.f) : [],
      matchNote: k.year == null && cands.length === 1 ? "Nomor IM di ERP tanpa tahun — dicocokkan hanya lewat nomor urut, pastikan IM-nya benar" : null,
    };
  };

  // Gabungkan rule yang "sama" (jenis & nilai promo, syarat, territory, price list) — mis. rule mingguan.
  const bySig = new Map<string, ErpRule[]>();
  for (const r of rules) {
    const sig = [r.rate_or_discount, r.discount_percentage, r.discount_amount, r.rate, eligibleOf(r), territoriesOf(r).join(";"), r.min_qty, r.for_price_list,
      (r.for_price_list && audience.get(r.for_price_list)?.join(",")) || "", fileFor(r.title, r.name, r.for_price_list).label].join("|");
    bySig.set(sig, [...(bySig.get(sig) ?? []), r]);
  }
  const promos: LivePromo[] = [];
  for (const [sig, rs] of bySig) {
    const r = rs[0];
    const baseRate = (r.for_price_list ? rateByList.get(r.for_price_list) : undefined) ?? (r.for_price_list === "Standard Selling" ? item.standardPrice : null) ?? null;
    const m = fileFor(r.title, r.name, r.for_price_list);
    const open = rs.some((x) => !x.valid_upto);
    promos.push({
      key: `R:${sig}`, source: "RULE", imLabel: m.label, file: m.file, fileCandidates: m.candidates, matchNote: m.matchNote, title: r.title ?? r.name, mergedRules: rs.length,
      ...promoOf(r, baseRate), normalPrice: baseRate,
      validFrom: rs.map((x) => x.valid_from).filter(Boolean).sort()[0] ?? null,
      validUpto: open ? null : rs.map((x) => x.valid_upto).filter(Boolean).sort().at(-1) ?? null,
      priceList: r.for_price_list, clientTypes: (r.for_price_list && audience.get(r.for_price_list)) || [], territories: territoriesOf(r),
      audience: eligibleOf(r), minQty: r.min_qty && r.min_qty > 1 ? r.min_qty : null,
    });
  }
  // Price List IM yang memuat item tapi tanpa rule-nya — harga saja, tidak jelas promo atau normal.
  const ruleLists = new Set(rules.map((r) => r.for_price_list));
  const plRows = new Map<string, ErpPrice>();
  for (const p of activePrices) if (!plRows.has(p.price_list)) plRows.set(p.price_list, p);
  for (const [pl, p] of plRows) {
    if (ruleLists.has(pl)) continue;
    const m = fileFor(null, "", pl);
    promos.push({
      key: `P:${pl}`, source: "PRICE_LIST", imLabel: m.label, file: m.file, fileCandidates: m.candidates, matchNote: m.matchNote, title: pl, mergedRules: 0, promoType: "Harga Price List",
      discountPercent: null, promoPrice: p.price_list_rate, normalPrice: null, validFrom: p.valid_from, validUpto: p.valid_upto,
      priceList: pl, clientTypes: [], territories: [], audience: null, minQty: null,
    });
  }
  promos.sort((a, b) => (a.source === b.source ? (b.validFrom ?? "").localeCompare(a.validFrom ?? "") : a.source === "RULE" ? -1 : 1));

  const data: LiveResult = { item, promos, fetchedAt: new Date().toISOString() };
  if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value!);
  cache.set(itemCode, { at: Date.now(), data });
  return data;
}

// Status koneksi ERP untuk ikon di Item Browser (2026-11-17): cek ringan (1 baris Company), cache
// 30 dtk supaya banyak user tidak memicu banyak request. Tidak membocorkan URL / akun.
export type ErpStatus = { state: "OK" | "ERROR" | "NOT_CONFIGURED"; message: string | null; latencyMs: number | null; checkedAt: string };
let statusCache: { at: number; data: ErpStatus } | null = null;

export async function checkErpStatus(force = false): Promise<ErpStatus> {
  if (!force && statusCache && Date.now() - statusCache.at < 30_000) return statusCache.data;
  const checkedAt = new Date().toISOString();
  let data: ErpStatus;
  try {
    if (!(await getErpConfig())) data = { state: "NOT_CONFIGURED", message: "Koneksi ERP belum dikonfigurasi (Pengaturan → ERP)", latencyMs: null, checkedAt };
    else {
      const t0 = Date.now();
      await erpGet("/api/resource/Company", { limit_page_length: "1" });
      data = { state: "OK", message: null, latencyMs: Date.now() - t0, checkedAt };
    }
  } catch (err) {
    data = { state: "ERROR", message: err instanceof ErpError ? err.message : "Tidak dapat menghubungi ERP", latencyMs: null, checkedAt };
  }
  statusCache = { at: Date.now(), data };
  return data;
}
