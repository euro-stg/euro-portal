import db from "@/lib/db/db";
import { erpListAll } from "@/lib/erp";
import { activeImFileWhere } from "@/lib/im-check";
import { sanitizeProduct } from "@/lib/im-import";
import type { ImProductInput } from "@/lib/edoc";

// Sync Item ke IM dari ERP (2026-11-03, Tahap 4) — manual, superadmin & Document Approver.
// Alur: pilih 1 item Master Item → cari di ERP promo yang memuat item itu → usulan baris per
// IM portal → user review/edit → simpan. Struktur ERP (diriset 2026-11-03):
//   - Pricing Rule (apply_on "Item Code", child "Pricing Rule Item Code") = PROMO-nya: diskon %,
//     potongan nominal, atau harga khusus; dibatasi territory / customer group / customer /
//     min qty. Nomor IM ada di JUDUL rule ("DEI - IM 441_2025 - Promo 40% ...") dan/atau nama
//     Price List-nya ("Promo ... - IM 441_2025 - DEI"). Satu IM bisa punya banyak rule (mis.
//     rule mingguan W14..W24 berdiskon sama → digabung jadi satu usulan).
//   - Item Price di Price List IM = harga dasar item di promo itu (sama dengan harga normal)
//     → mengisi Harga Normal usulan & dasar MENGHITUNG harga promo (disetujui user 2026-11-03;
//     tetap bisa diedit saat review).
// Nomor IM ERP "IM 486_2026" ↔ Document Number portal "486/Euromedica/IM/BUS/VII/2026"
// (nomor urut + tahun). Format lama tanpa tahun ("IM 274") dicocokkan by nomor urut saja,
// HANYA kalau tepat satu IM aktif portal bernomor itu.

type ErpRule = {
  name: string; title: string | null; for_price_list: string | null; rate_or_discount: string | null;
  discount_percentage: number | null; discount_amount: number | null; rate: number | null;
  valid_from: string | null; valid_upto: string | null; applicable_for: string | null;
  territory: string | null; multiple_territories: string | null; customer_group: string | null; customer: string | null;
  min_qty: number | null;
};
type ErpPrice = { price_list: string; price_list_rate: number; valid_from: string | null; valid_upto: string | null };

type ImKey = { seq: number; year: number | null };
const keyStr = (k: ImKey) => `${k.seq}_${k.year ?? ""}`;

/** "IM 441_2025" / "IM 274" di nama/judul ERP. */
export function parseErpImKey(s: string | null | undefined): ImKey | null {
  const m = s?.match(/\bIM\s*0*(\d+)(?:_(\d{4}))?\b/i);
  return m ? { seq: Number(m[1]), year: m[2] ? Number(m[2]) : null } : null;
}
/** "486/Euromedica/IM/BUS/VII/2026" → { seq: 486, year: 2026 }. */
export function parsePortalImKey(documentNumber: string | null): ImKey | null {
  const seq = documentNumber?.match(/^\s*0*(\d+)/)?.[1];
  if (!seq) return null;
  const year = documentNumber!.match(/(\d{4})\s*$/)?.[1];
  return { seq: Number(seq), year: year ? Number(year) : null };
}

const today = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10); // WIB
const fmtDate = (d: string | null) => (d ? d.split("-").reverse().join("/") : "…");
const rupiah = (n: number) => `Rp${n.toLocaleString("id-ID")}`;

function eligibleOf(r: ErpRule): string | null {
  if (r.applicable_for === "Customer" && r.customer) return `Customer: ${r.customer}`;
  if (r.applicable_for === "Customer Group" && r.customer_group) return `Customer Group: ${r.customer_group}`;
  let terr: string[] = [];
  try { terr = r.multiple_territories ? JSON.parse(r.multiple_territories) : []; } catch { /* abaikan format aneh */ }
  if (!terr.length && r.territory) terr = [r.territory];
  return terr.length ? `Klinik: ${terr.join(", ")}` : null;
}

function promoOf(r: ErpRule, baseRate: number | null) {
  const pct = r.discount_percentage ?? 0, amt = r.discount_amount ?? 0, rate = r.rate ?? 0;
  if (r.rate_or_discount === "Discount Percentage" && pct > 0)
    return { promoType: `Diskon ${pct}%`, discountPercent: pct, promoPrice: baseRate != null ? Math.round(baseRate * (1 - pct / 100)) : null };
  if (r.rate_or_discount === "Discount Amount" && amt > 0)
    return { promoType: `Potongan ${rupiah(amt)}`, discountPercent: null, promoPrice: baseRate != null ? Math.max(0, baseRate - amt) : null };
  if (r.rate_or_discount === "Rate" && rate > 0) return { promoType: "Harga Khusus", discountPercent: null, promoPrice: rate };
  // Rule tanpa nilai diskon (mis. B2G3 / bundling) — detailnya hanya ada di judul rule.
  return { promoType: "Lainnya (lihat detail)", discountPercent: null, promoPrice: null };
}

export type Proposal = {
  key: string;
  source: "RULE" | "PRICE_LIST";
  defaultInclude: boolean;
  product: ImProductInput;
  info: { rules: string[]; priceList: string | null; baseRate: number | null };
};
export type SyncGroup = {
  file: { id: string; title: string; documentNumber: string | null; businessUnitCodes: string[]; endDate: Date | null };
  matchNote: string | null;
  erpNames: string[];
  existing: { id: string; itemName: string; promoType: string | null; promoPrice: number | null; discountPercent: number | null; validity: string | null; eligibleClient: string | null }[];
  proposals: Proposal[];
};

export async function buildErpProposals(itemCode: string): Promise<{ error: string; status?: number } | {
  item: { itemCode: string; itemName: string; company: string | null; business: string | null; standardPrice: number | null };
  groups: SyncGroup[]; unmatched: { key: string; names: string[]; validFrom: string | null; validUpto: string | null }[];
}> {
  const item = await db.masterItem.findUnique({ where: { itemCode }, select: { itemCode: true, itemName: true, company: true, business: true, status: true, standardPrice: true } });
  if (!item) return { error: "Item tidak ada di Master Item", status: 404 };
  if (item.status !== "ACTIVE") return { error: `${item.itemCode} sudah Discontinued — tidak bisa ditambahkan ke IM` };

  const t = today();
  const [rules, prices] = await Promise.all([
    erpListAll<ErpRule>("Pricing Rule", {
      fields: ["name", "title", "for_price_list", "rate_or_discount", "discount_percentage", "discount_amount", "rate", "valid_from", "valid_upto",
        "applicable_for", "territory", "multiple_territories", "customer_group", "customer", "min_qty"],
      filters: [["Pricing Rule Item Code", "item_code", "=", itemCode], ["disable", "=", 0], ["selling", "=", 1], ["valid_upto", ">=", t]],
      orderBy: "`tabPricing Rule`.valid_from asc", pageSize: 500,
    }),
    erpListAll<ErpPrice>("Item Price", {
      fields: ["price_list", "price_list_rate", "valid_from", "valid_upto"],
      filters: [["item_code", "=", itemCode], ["price_list", "like", "%IM %"]], orderBy: "valid_from desc", pageSize: 500,
    }),
  ]);
  const activePrices = prices.filter((p) => !p.valid_upto || p.valid_upto >= t);
  const rateByList = new Map<string, number>();
  for (const p of activePrices) if (!rateByList.has(p.price_list)) rateByList.set(p.price_list, p.price_list_rate);

  // Kelompokkan sumber ERP per nomor IM.
  type Entry = { key: ImKey; names: Set<string>; rules: ErpRule[]; priceLists: Set<string>; from: string | null; upto: string | null };
  const entries = new Map<string, Entry>();
  const entryFor = (k: ImKey) => {
    let e = entries.get(keyStr(k));
    if (!e) { e = { key: k, names: new Set(), rules: [], priceLists: new Set(), from: null, upto: null }; entries.set(keyStr(k), e); }
    return e;
  };
  const widen = (e: Entry, from: string | null, upto: string | null) => {
    if (from && (!e.from || from < e.from)) e.from = from;
    if (!upto) e.upto = e.upto ?? null; else if (!e.upto || upto > e.upto) e.upto = upto;
  };
  for (const r of rules) {
    const k = parseErpImKey(r.title) ?? parseErpImKey(r.name) ?? parseErpImKey(r.for_price_list);
    if (!k) continue;
    const e = entryFor(k); e.rules.push(r); e.names.add(r.title ?? r.name); widen(e, r.valid_from, r.valid_upto);
  }
  for (const p of activePrices) {
    const k = parseErpImKey(p.price_list);
    if (!k) continue;
    const e = entryFor(k); e.priceLists.add(p.price_list); e.names.add(p.price_list); widen(e, p.valid_from, p.valid_upto);
  }

  // IM aktif portal → kunci nomor.
  const files = await db.eDocFile.findMany({ where: activeImFileWhere(), select: { id: true, title: true, documentNumber: true, businessUnitCodes: true, endDate: true } });
  const portal = files.map((f) => ({ f, k: parsePortalImKey(f.documentNumber) })).filter((x) => x.k);
  const groups: SyncGroup[] = [];
  const unmatched: { key: string; names: string[]; validFrom: string | null; validUpto: string | null }[] = [];
  const existingRows = await db.eDocImProduct.findMany({
    where: { fileId: { in: files.map((f) => f.id) }, OR: [{ skus: { some: { itemCode } } }, { sku: itemCode }] },
    select: { id: true, fileId: true, itemName: true, promoType: true, promoPrice: true, discountPercent: true, validity: true, eligibleClient: true },
  });

  for (const e of [...entries.values()].sort((a, b) => (b.key.year ?? 0) - (a.key.year ?? 0) || b.key.seq - a.key.seq)) {
    let candidates = portal.filter((p) => p.k!.seq === e.key.seq && (e.key.year == null || p.k!.year === e.key.year));
    let matchNote: string | null = null;
    if (e.key.year == null) {
      if (candidates.length === 1) matchNote = `Nomor IM di ERP tanpa tahun (IM ${e.key.seq}) — dicocokkan by nomor urut saja, pastikan benar`;
      else candidates = [];
    }
    if (candidates.length !== 1) {
      unmatched.push({ key: e.key.year ? `IM ${e.key.seq}_${e.key.year}` : `IM ${e.key.seq}${candidates.length > 1 ? " (lebih dari satu IM portal bernomor ini)" : ""}`, names: [...e.names], validFrom: e.from, validUpto: e.upto });
      continue;
    }
    const f = candidates[0].f;
    const base: ImProductInput = {
      itemName: item.itemName, sku: item.itemCode, category: null, discountClass: null, normalPrice: null, promoType: null, promoDetail: null,
      promoPrice: null, discountPercent: null, qty: null, imNumber: f.documentNumber, imSubject: f.title, validity: null,
      eligibleClient: null, keyConditions: null, extra: null,
    };

    // Gabungkan rule yang "sama" (jenis & nilai promo + syarat sama) — mis. rule mingguan.
    const bySig = new Map<string, ErpRule[]>();
    for (const r of e.rules) {
      const sig = [r.rate_or_discount, r.discount_percentage, r.discount_amount, r.rate, eligibleOf(r), r.min_qty, r.for_price_list].join("|");
      bySig.set(sig, [...(bySig.get(sig) ?? []), r]);
    }
    const proposals: Proposal[] = [];
    for (const [sig, rs] of bySig) {
      const r = rs[0];
      const baseRate = (r.for_price_list ? rateByList.get(r.for_price_list) : undefined) ?? (r.for_price_list === "Standard Selling" ? item.standardPrice : null) ?? null;
      const promo = promoOf(r, baseRate);
      const from = rs.map((x) => x.valid_from).filter(Boolean).sort()[0] ?? null;
      const upto = rs.map((x) => x.valid_upto).filter(Boolean).sort().at(-1) ?? null;
      const minQty = rs[0].min_qty && rs[0].min_qty > 1 ? `Minimal qty ${rs[0].min_qty}` : null;
      proposals.push({
        key: `R:${sig}`, source: "RULE", defaultInclude: true,
        product: {
          ...base, ...promo, normalPrice: baseRate, validity: `${fmtDate(from)} s/d ${fmtDate(upto)}`, eligibleClient: eligibleOf(r), keyConditions: minQty,
          promoDetail: rs.length > 1 ? `${r.title ?? r.name} (+${rs.length - 1} rule periode lain)` : (r.title ?? r.name),
        },
        info: { rules: rs.map((x) => x.title ?? x.name), priceList: r.for_price_list, baseRate },
      });
    }
    // Price List IM yang memuat item tapi TIDAK ada rule-nya untuk item ini — tidak jelas
    // apakah rate-nya harga promo atau harga normal, jadi diusulkan tapi tidak dicentang.
    const ruleLists = new Set(e.rules.map((r) => r.for_price_list));
    for (const pl of e.priceLists) {
      if (ruleLists.has(pl)) continue;
      const rate = rateByList.get(pl) ?? null;
      proposals.push({
        key: `P:${pl}`, source: "PRICE_LIST", defaultInclude: false,
        product: { ...base, promoType: "Harga Price List", promoPrice: rate, promoDetail: pl, validity: `${fmtDate(e.from)} s/d ${fmtDate(e.upto)}` },
        info: { rules: [], priceList: pl, baseRate: rate },
      });
    }
    groups.push({
      file: f, matchNote, erpNames: [...e.names],
      existing: existingRows.filter((x) => x.fileId === f.id).map((x) => ({
        id: x.id, itemName: x.itemName, promoType: x.promoType, promoPrice: x.promoPrice, discountPercent: x.discountPercent, validity: x.validity, eligibleClient: x.eligibleClient,
      })),
      proposals,
    });
  }
  return { item: { itemCode: item.itemCode, itemName: item.itemName, company: item.company, business: item.business, standardPrice: item.standardPrice }, groups, unmatched };
}

/**
 * Simpan hasil review. Input `{ itemCode, entries: [{ fileId, action: "ADD" | "UPDATE",
 * productId?, product }] }` — baris yang dilewati user tidak dikirim. Semua dicek ulang:
 * item aktif, IM aktif, baris yang diperbarui memang milik IM itu & ber-SKU item ini. Nama &
 * SKU selalu dari Master Item; baris lain di IM tidak disentuh.
 */
export async function saveErpProposals(body: unknown, userId: string): Promise<{ error: string } | { added: number; updated: number }> {
  const b = (body ?? {}) as { itemCode?: unknown; entries?: unknown };
  const itemCode = typeof b.itemCode === "string" ? b.itemCode : "";
  if (!Array.isArray(b.entries) || b.entries.length === 0) return { error: "Tidak ada baris untuk disimpan" };
  const item = await db.masterItem.findUnique({ where: { itemCode }, select: { itemCode: true, itemName: true, company: true, status: true } });
  if (!item) return { error: "Item tidak ada di Master Item" };
  if (item.status !== "ACTIVE") return { error: `${item.itemCode} sudah Discontinued` };
  if (!item.company) return { error: `${item.itemCode} tidak punya company di Master Item` };

  const entries = b.entries.map((raw) => {
    const x = (raw ?? {}) as { fileId?: unknown; action?: unknown; productId?: unknown; product?: Record<string, unknown> };
    return { fileId: String(x.fileId ?? ""), action: x.action === "UPDATE" ? "UPDATE" as const : "ADD" as const, productId: x.productId ? String(x.productId) : null, product: sanitizeProduct(x.product ?? {}) };
  });
  const files = new Set((await db.eDocFile.findMany({ where: { ...activeImFileWhere(), id: { in: entries.map((e) => e.fileId) } }, select: { id: true } })).map((f) => f.id));
  const updIds = entries.filter((e) => e.action === "UPDATE").map((e) => e.productId ?? "");
  if (new Set(updIds).size !== updIds.length) return { error: "Satu baris lama dipilih untuk diperbarui lebih dari sekali" };
  const owned = new Map((await db.eDocImProduct.findMany({
    where: { id: { in: updIds }, OR: [{ skus: { some: { itemCode } } }, { sku: itemCode }] }, select: { id: true, fileId: true },
  })).map((p) => [p.id, p.fileId]));
  for (const e of entries) {
    if (!files.has(e.fileId)) return { error: "IM tujuan tidak ditemukan / sudah tidak aktif — muat ulang" };
    if (e.action === "UPDATE" && owned.get(e.productId ?? "") !== e.fileId) return { error: "Baris yang akan diperbarui tidak ditemukan di IM itu — muat ulang" };
  }

  let added = 0, updated = 0;
  await db.$transaction(async (tx) => {
    for (const e of entries) {
      const p = e.product;
      const data = {
        itemName: item.itemName, sku: item.itemCode, category: p.category, discountClass: p.discountClass, normalPrice: p.normalPrice,
        promoType: p.promoType, promoDetail: p.promoDetail, promoPrice: p.promoPrice, discountPercent: p.discountPercent, qty: p.qty,
        imNumber: p.imNumber, imSubject: p.imSubject, validity: p.validity, eligibleClient: p.eligibleClient, keyConditions: p.keyConditions,
      };
      if (e.action === "UPDATE") {
        await tx.eDocImProductSku.deleteMany({ where: { productId: e.productId! } });
        await tx.eDocImProduct.update({ where: { id: e.productId! }, data: { ...data, skus: { create: { company: item.company!, itemCode: item.itemCode, mappedBy: userId } } } });
        updated++;
      } else {
        await tx.eDocImProduct.create({ data: { ...data, fileId: e.fileId, importedBy: userId, skus: { create: { company: item.company!, itemCode: item.itemCode, mappedBy: userId } } } });
        added++;
      }
    }
  });
  return { added, updated };
}
